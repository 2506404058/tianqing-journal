const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer}=require('./server');
test('本机保存可跨服务重启恢复，拒绝跨站写入、无会话读取和过期覆盖',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tianqing-autosave-test-'));
 const dataFile=path.join(dir,'records.json'),token='test-session';
 let server,base;
 const start=async()=>{server=createServer({dataFile,token});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port};
 const close=()=>new Promise(r=>server.close(r));
 const get=()=>fetch(base+'/api/local-records',{headers:{Authorization:'Bearer '+token}});
 const put=(records,revision,origin=base)=>fetch(base+'/api/local-records',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','If-Match':revision,Origin:origin},body:JSON.stringify(records)});
 await start();
 try{
  assert.equal((await fetch(base+'/api/local-records')).status,401);
  assert.equal((await fetch(base+'/runtime.js',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  const initial=await (await get()).json();assert.equal(initial.exists,false);
  const records={moods:[],tasks:[{id:'test-task',title:'测试自动保存',date:'2026-11-15',time:'15:00',category:'学习'}]};
  assert.equal((await put(records,'none','https://untrusted.example')).status,403);
  const first=await (await put(records,'none')).json();assert.equal(first.records.tasks[0].title,'测试自动保存');
  assert.equal((await put(records,'none')).status,409);
  records.tasks[0].done=true;const second=await (await put(records,first.revision)).json();assert.equal(second.records.tasks[0].done,true);
  assert.ok(fs.existsSync(dataFile+'.bak'));assert.equal(JSON.parse(fs.readFileSync(dataFile+'.bak','utf8')).tasks[0].done,false);
  await close();await start();assert.equal((await (await get()).json()).records.tasks[0].done,true);
  assert.equal((await fetch(base+'/records.json')).status,404);
  // Corrupt data must never silently turn into an empty editable collection.
  fs.writeFileSync(dataFile,'invalid-json');assert.equal((await get()).status,500);assert.equal((await put(records,second.revision)).status,409);
 }finally{
  await close();
  for(const file of ['records.json','records.json.bak','records.json.tmp','records.json.migration.bak']){const target=path.join(dir,file);if(fs.existsSync(target))fs.unlinkSync(target);}
  fs.rmdirSync(dir);
 }
});

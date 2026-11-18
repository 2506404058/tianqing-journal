const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {create,validate}=require('./public/storage');
const {createServer}=require('./server');
function memory(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)}}
const records={moods:[{date:'2026-11-15',weather:1,intensity:3,note:'test'}],tasks:[{id:'example',title:'开会',date:'2026-11-16',time:'15:00',category:'工作'}]};
test('不同浏览器存储独立，同一存储重载可恢复',()=>{
 const a=memory(),b=memory();create(a).save(records);
 assert.equal(create(a).load().tasks[0].title,'开会');
 assert.deepEqual(create(b).load(),{moods:[],tasks:[]});
});
test('非法导入不会覆盖已有数据',()=>{
 const a=memory();const store=create(a);store.save(records);
 assert.throws(()=>store.save({moods:[{date:'2026-02-30',weather:0}],tasks:[]}));
 assert.equal(store.load().tasks[0].title,'开会');
 assert.throws(()=>validate({moods:[],tasks:[{title:'x',date:'2026-11-15',time:'99:99'}]}));
});
test('导入不可信编号和未知字段被清理',()=>{
 const input=structuredClone(records);input.tasks[0].id="');alert(1)//";input.secret='not stored';
 const clean=validate(input);assert.match(clean.tasks[0].id,/^[\w-]+$/);assert.equal(clean.secret,undefined);
});
test('浏览器存储写入失败不伪报成功',()=>{
 const store=create({getItem:()=>null,setItem:()=>{throw Error('quota')}});
 assert.throws(()=>store.save(records),/quota|空间不足/);
});
test('服务仅提供静态页面，旧数据接口、私密目录和写入均不可访问',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(base+'/')).status,200);
  for(const url of ['/api/data','/data/records.json','/server.log','/package.json','/.env','/%2e%2e%2fdata/records.json'])assert.notEqual((await fetch(base+url)).status,200,url);
  assert.equal((await fetch(base+'/api/data',{method:'PUT',body:'{}'})).status,405);
  const html=await (await fetch(base+'/')).text();assert.ok(html.includes('./storage.js'));assert.ok(html.includes('id="import-file"'));
 }finally{await new Promise(resolve=>server.close(resolve))}
});
test('前端无数据网络调用，资源支持 GitHub Pages 子路径',()=>{
 const app=fs.readFileSync('public/app.js','utf8');assert.doesNotMatch(app,/fetch\(|\/api\/data/);
 const html=fs.readFileSync('public/index.html','utf8');assert.doesNotMatch(html,/(?:src|href)="\//);
});



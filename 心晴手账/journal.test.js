const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const storage=require('./public/storage'),parser=require('./public/parser'),breathing=require('./public/breathing');
const memory=()=>{const map=new Map();return {getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,value)}};
const legacy={moods:[{date:'2026-11-15',weather:0,note:'早上'},{date:'2026-11-15',weather:3,note:'晚上'}],tasks:['高','中','低'].map((priority,i)=>({id:'task-'+i,title:'安排',date:'2026-11-15',priority}))};
test('旧备份可迁移为同日多条，稳定编号和占位时间反复校验不变',()=>{
 const migrated=storage.validate(legacy);assert.equal(migrated.moods.length,2);assert.equal(new Set(migrated.moods.map(m=>m.id)).size,2);
 assert.ok(migrated.moods.every(m=>m.timeUnknown&&m.recordedAt));assert.deepEqual(storage.validate(migrated),migrated);assert.deepEqual(storage.validate(legacy),migrated);
});
test('旧优先级映射，显式新字段优先；自定义分类和偏好不会被清理',()=>{
 const migrated=storage.validate(legacy);assert.deepEqual(migrated.tasks.map(t=>storage.quadrant(t).key),['11','10','00']);
 migrated.tasks[0].important=false;migrated.tasks[0].urgent=true;migrated.tasks[0].category='毕业设计';
 migrated.preferences.recentCategories=['毕业设计','毕业设计','社团'];migrated.preferences.breathing={inhale:3,exhale:6};
 const result=storage.validate(migrated);assert.equal(storage.quadrant(result.tasks[0]).key,'01');assert.equal(result.tasks[0].category,'毕业设计');assert.deepEqual(result.preferences.recentCategories,['毕业设计','社团']);assert.equal(result.preferences.breathing.exhale,6);
});
test('迁移前备份保留；容量写入失败时不覆盖原记录',()=>{
 const memoryStore=memory();memoryStore.setItem(storage.KEY,JSON.stringify(legacy));storage.create(memoryStore).save(legacy);
 assert.equal(memoryStore.getItem(storage.BACKUP_KEY),JSON.stringify(legacy));const original=memoryStore.getItem(storage.KEY);
 const failing={getItem:key=>memoryStore.getItem(key),setItem:()=>{throw Object.assign(Error('full'),{name:'QuotaExceededError'})}};
 assert.throws(()=>storage.create(failing).save(legacy),/空间不足/);assert.equal(memoryStore.getItem(storage.KEY),original);
});
test('附件、时间和多条记录导出再导入完整保留；不接受远程或SVG附件',()=>{
 const migrated=storage.validate(legacy);migrated.moods[0].images=[{id:'photo-1',dataUrl:'data:image/jpeg;base64,/9j/2Q==',width:10,height:10}];
 assert.deepEqual(storage.validate(JSON.parse(JSON.stringify(migrated))),migrated);
 const invalid=structuredClone(migrated);invalid.moods[0].images[0].dataUrl='https://example.com/private.jpg';assert.throws(()=>storage.validate(invalid),/图片格式/);
 invalid.moods[0].images[0].dataUrl='data:image/svg+xml;base64,AAAA';assert.throws(()=>storage.validate(invalid),/图片格式/);
 invalid.moods[0].images=Array(4).fill(migrated.moods[0].images[0]);assert.throws(()=>storage.validate(invalid),/3 张/);
});
test('整体容量保护与重复ID校验不会静默丢数据',()=>{
 const sample=storage.validate(legacy);sample.moods[1].id=sample.moods[0].id;assert.throws(()=>storage.validate(sample),/编号重复/);
 const large={moods:[],tasks:Array.from({length:1300},(_,i)=>({id:'task-'+i,title:'x',date:'2026-11-15',note:'x'.repeat(2000)}))};assert.throws(()=>storage.serialize(large),/容量上限/);
});
test('一句话生成无需已有日程，支持高等数学、空输入和否定四象限',()=>{
 const [draft]=parser.parse('明天 8:40 高等数学',new Date(2026,10,15));assert.equal(draft.date,'2026-11-16');assert.equal(draft.time,'08:40');assert.equal(draft.title,'高等数学');assert.equal(draft.category,'学习');
 assert.deepEqual(parser.parse(''),[]);assert.deepEqual(parser.parse('明天'),[]);assert.deepEqual(parser.parse('？？？'),[]);
 const [q]=parser.parse('明天重要不紧急写报告');assert.equal(q.important,true);assert.equal(q.urgent,false);
 const [q2]=parser.parse('明天紧急不重要取快递');assert.equal(q2.important,false);assert.equal(q2.urgent,true);
});
test('呼吸阶段按配置在准确边界换气',()=>{
 assert.equal(breathing.phaseAt(0).label,'吸气');assert.equal(breathing.phaseAt(3999).label,'吸气');assert.equal(breathing.phaseAt(4000).label,'呼气');assert.equal(breathing.phaseAt(8000).label,'吸气');
 assert.equal(breathing.phaseAt(3000,3,5).label,'呼气');assert.equal(breathing.phaseAt(0).scale,.7);assert.equal(breathing.phaseAt(4000).scale,1.3);
});
test('新增前端脚本语法检查',()=>{
 for(const file of ['app.js','storage.js','parser.js','breathing.js','images.js','data-store.js'])new vm.Script(fs.readFileSync('public/'+file,'utf8'),{filename:file});
});
test('旧本机文件首次保存前保留永久迁移快照，后续保存不覆盖快照',async()=>{
 const os=require('node:os'),path=require('node:path'),{createServer}=require('./server');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tianqing-v2-test-')),file=path.join(dir,'records.json'),raw=JSON.stringify(legacy);
 fs.writeFileSync(file,raw);const token='migration-test',server=createServer({dataFile:file,token});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,headers={Authorization:'Bearer '+token};
 try{
  let current=await (await fetch(base+'/api/local-records',{headers})).json();assert.equal(current.records.schemaVersion,2);assert.equal(fs.readFileSync(file,'utf8'),raw);
  const put=()=>fetch(base+'/api/local-records',{method:'PUT',headers:{...headers,Origin:base,'If-Match':current.revision,'Content-Type':'application/json'},body:JSON.stringify(current.records)});
  current=await (await put()).json();assert.equal(fs.readFileSync(file+'.migration.bak','utf8'),raw);
  current.records.moods[0].note='更新后';assert.equal((await put()).status,200);assert.equal(fs.readFileSync(file+'.migration.bak','utf8'),raw);
 }finally{
  await new Promise(r=>server.close(r));for(const name of ['records.json','records.json.bak','records.json.migration.bak'])if(fs.existsSync(path.join(dir,name)))fs.unlinkSync(path.join(dir,name));fs.rmdirSync(dir);
 }
});

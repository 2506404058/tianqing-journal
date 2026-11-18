// Run application handlers in a detached DOM model. This checks data flow, not
// browser layout, pointer behavior or the browser's image decoder.
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const storage=require('./public/storage'),parser=require('./public/parser');
async function application(initial={moods:[],tasks:[]}){
 let saved=storage.validate(initial),failed=false,sequence=0;
 const elements=new Map();
 function element(selector){
  if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',value:'',open:false,dataset:{},style:{},events:{},classList:{add(){},remove(){},toggle(){}},querySelector:child=>element(selector+' '+child),querySelectorAll:()=>[],addEventListener(name,fn){this.events[name]=fn;},showModal(){this.open=true;},close(){this.open=false;this.events.close?.();}});
  return elements.get(selector);
 }
 const context=vm.createContext({WeatherAnalysis:require('./public/weather-analysis'),console,structuredClone,Date,Math,JSON,Blob,crypto:{randomUUID:()=>`test-id-${++sequence}`},location:{hash:'#home',reload(){}},document:{hidden:false,querySelector:element,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},setTimeout:()=>1,clearTimeout(){},clearInterval(){},setInterval:()=>1,confirm:()=>true,FormData:class{constructor(form){this.entries=Object.entries(form.values)}[Symbol.iterator](){return this.entries[Symbol.iterator]()}},TianqingStorage:storage,ScheduleParser:parser,DailyQuote:{forDate:()=> 'test'},TianqingRuntime:{desktop:false},TianqingRecords:{desktop:false,load:async()=>saved,save:async next=>{if(failed)throw Error('保存失败');saved=storage.validate(next);return saved;}},JournalImages:{mount:()=>({busy:false,dispose(){}})},Breathing:{start:()=>()=>{}}});
 vm.runInContext(fs.readFileSync('public/app.js','utf8'),context);await new Promise(resolve=>setImmediate(resolve));
 return {context,element,run:code=>vm.runInContext(code,context),records:()=>saved,fail:()=>{failed=true}};
}
test('点击生成会打开草稿确认框，不需要已有任务；空输入可见提示',async()=>{
 const app=await application();app.run("generate('明天 8:40 高等数学')");assert.equal(app.element('#modal').open,true);assert.match(app.element('#modal-content').innerHTML,/确认识别结果/);assert.match(app.element('#modal-content').innerHTML,/08:40/);assert.equal(app.records().tasks.length,0);
 app.run("closeModal();generate('')");assert.match(app.element('#toast').textContent,/请先输入/);
});
test('同一天新增两条、按ID编辑和删除，不影响另一条；日历和报告可渲染',async()=>{
 const app=await application();
 const submit=async note=>{
  app.run('moodForm()');
  await app.element('#mood-form').onsubmit({preventDefault(){},target:{values:{date:'2026-11-15',time:'09:00',weather:'0',intensity:'1',tag:'日常',note}},submitter:{disabled:false}});
 };
 await submit('早上');await submit('晚上');assert.equal(app.records().moods.length,2);
 const [first,second]=app.records().moods;app.run(`moodForm('${first.id}')`);
 await app.element('#mood-form').onsubmit({preventDefault(){},target:{values:{date:'2026-11-15',time:'08:30',weather:'1',intensity:'5',tag:'学习',note:'只编辑第一条'}},submitter:{disabled:false}});
 assert.equal(app.records().moods.find(m=>m.id===second.id).note,'晚上');assert.equal(app.records().moods.find(m=>m.id===first.id).intensity,5);
 assert.match(app.run('calendarPage()'),/2 条心情/);assert.match(app.run('report()'),/平均强度/);
 await app.run(`deleteItem('moods','${first.id}')`);assert.equal(app.records().moods.length,1);assert.equal(app.records().moods[0].id,second.id);
});
test('自定义分类与四象限保存后可重新编辑；保存失败不清空表单',async()=>{
 const app=await application();app.run('taskForm()');app.element('#custom-category').value='毕业设计';
 await app.element('#task-form').onsubmit({preventDefault(){},target:{values:{title:'写开题报告',date:'2026-11-16',time:'08:40',category:'__custom__',quadrant:'01',duration:'20',reminder:'0',note:''}},submitter:{disabled:false}});
 assert.equal(app.records().tasks[0].category,'毕业设计');assert.equal(storage.quadrant(app.records().tasks[0]).key,'01');assert.deepEqual(app.records().preferences.recentCategories,['毕业设计']);
 app.run(`taskForm('${app.records().tasks[0].id}')`);assert.match(app.element('#modal-content').innerHTML,/毕业设计/);
 app.fail();app.run('moodForm()');await app.element('#mood-form').onsubmit({preventDefault(){},target:{values:{date:'2026-11-15',time:'09:00',weather:'0',intensity:'3',tag:'日常',note:'不要丢失'}},submitter:{disabled:false}});
 assert.equal(app.element('#modal').open,true);assert.equal(app.records().moods.length,0);assert.match(app.element('#toast').textContent,/保存失败/);
});
test('图片压缩执行缩放和质量限制，并在失败时释放资源',async()=>{
 const draws=[],qualities=[];let released=0;
 class FakeImage{set src(value){this.naturalWidth=3000;this.naturalHeight=2000;queueMicrotask(()=>this.onload());}}
 class Reader{readAsDataURL(){this.result='data:image/jpeg;base64,/9j/2Q==';this.onload();}}
 const context=vm.createContext({Image:FakeImage,FileReader:Reader,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>released++},document:{createElement:()=>({width:0,height:0,getContext(){return {fillRect(){},drawImage:(...args)=>draws.push(args)}} ,toBlob(callback,type,quality){qualities.push(quality);callback({size:qualities.length===1?300000:100000});}})},queueMicrotask,structuredClone,Date,Math});
 vm.runInContext(fs.readFileSync('public/images.js','utf8'),context);
 const image=await context.JournalImages.compress({type:'image/png',size:100000});assert.equal(image.width,1280);assert.ok(image.height<=1280);assert.equal(qualities[0],.7);assert.ok(qualities[1]<.7);assert.equal(released,1);assert.ok(draws.length>=2);
 await assert.rejects(context.JournalImages.compress({type:'image/svg+xml',size:10}),/JPEG/);
});

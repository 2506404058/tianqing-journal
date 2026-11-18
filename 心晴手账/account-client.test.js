const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const storage=require('./public/storage');
function client({accounts=true,desktop=false}={}){
 let user={id:'alice'},expired=false,requests=[],next={status:200,value:{exists:false,revision:'none',records:{moods:[],tasks:[]}}},browserReads=0,browserWrites=0,onJson=()=>{};
 const browser={getItem(){browserReads++;return JSON.stringify({moods:[{date:'2026-11-18',weather:0,note:'old browser private'}],tasks:[]});},setItem(){browserWrites++;}};
 const context=vm.createContext({TianqingRuntime:{accounts,desktop,token:'desktop-only'},TianqingAuth:{get user(){return user;},headers:()=>({'X-Tianqing-Account':user?.id,'X-Tianqing-CSRF':'csrf'}),expire(){expired=true;user=null;}},TianqingStorage:storage,localStorage:browser,fetch:async(url,options)=>{requests.push({url,options});return {status:next.status,ok:next.status<400,json:async()=>{onJson();return next.value;}};}});
 vm.runInContext(fs.readFileSync('public/data-store.js','utf8'),context);
 return {store:context.TianqingRecords,requests,next:(status,value)=>{next={status,value};},duringResponse:fn=>{onJson=fn;},switchUser:id=>{user={id};},reads:()=>browserReads,writes:()=>browserWrites,expired:()=>expired};
}
test('账号模式从不自动读取或上传旧浏览器日记，保存不写localStorage',async()=>{
 const c=client();assert.equal((await c.store.load()).moods.length,0);assert.equal(c.reads(),0);
 await c.store.save({moods:[],tasks:[]});assert.equal(c.writes(),0);
 assert.equal(c.requests[0].url,'./api/account-records');assert.equal(c.requests[1].options.headers['X-Tianqing-Account'],'alice');assert.equal(c.requests[1].options.headers.Authorization,undefined);
});
test('账号请求失效会锁定，切换账号后不会接纳上一账号响应，修订可重置',async()=>{
 const c=client();c.next(401,{error:'expired'});await assert.rejects(c.store.load(),/expired/);assert.equal(c.expired(),true);
 const d=client();d.duringResponse(()=>d.switchUser('bob'));await assert.rejects(d.store.load(),/账号已切换/);
 const e=client();e.next(200,{exists:true,revision:'old-revision',records:{moods:[],tasks:[]}});await e.store.load();e.store.reset();await e.store.save({moods:[],tasks:[]});assert.equal(e.requests[1].options.headers['If-Match'],'none');
});
test('静态版继续只用浏览器，桌面版仍使用原来的本机接口',async()=>{
 const s=client({accounts:false});assert.equal((await s.store.load()).moods[0].note,'old browser private');assert.equal(s.requests.length,0);
 const d=client({accounts:false,desktop:true});d.next(200,{exists:true,revision:'desktop-revision',records:{moods:[],tasks:[]}});await d.store.load();assert.equal(d.requests[0].url,'./api/local-records');assert.equal(d.requests[0].options.headers.Authorization,'Bearer desktop-only');
});

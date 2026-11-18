const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createManager}=require('./server'),{writeJson,hash}=require('./lib/io');
const adminSecret='manager QA passphrase 2026';
async function fixture(t,{clock}={}){
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'site-manager-test-')),directory=path.join(home,'data','accounts'),userId=crypto.randomUUID(),userFile=path.join(directory,'users',hash('alice')+'.json'),recordFile=path.join(directory,'records',userId+'.json');
 writeJson(userFile,{id:userId,username:'Alice',createdAt:'2026-11-18T01:00:00.000Z',password:{salt:'DO_NOT_EXPOSE_SALT',hash:'DO_NOT_EXPOSE_HASH'},profile:{displayName:'小晴',bio:'ordinary bio',avatar:'🌿'}});
 writeJson(recordFile,{moods:[{date:'2026-11-18',weather:3,intensity:4,note:'PRIVATE_DIARY_BODY',images:[{id:'image-1',dataUrl:'data:image/jpeg;base64,/9j/AA==',width:1,height:1}]}],tasks:[{id:'task-1',title:'完成作业',date:'2026-11-18',done:true}]});
 writeJson(path.join(directory,'sessions','secret.json'),{token:'DO_NOT_BACK_UP_SESSION'});
 writeJson(path.join(home,'data','manager','sites.json'),{version:1,sites:[{id:'tianqing',name:'心晴手账',adapter:'tianqing',directory,url:'http://127.0.0.1:3000/',archived:false}]});
 let server,base;async function start(){server=createManager({home,now:clock});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}async function stop(){await new Promise(r=>server.close(r));}await start();t.after(async()=>{await stop();fs.rmSync(home,{recursive:true,force:true});});
 async function call(route,{method='GET',session,body,headers={}}={}){const res=await fetch(base+route,{method,headers:{...(session?{Cookie:session.cookie,'X-Manage-CSRF':session.csrf}:{}),...(method!=='GET'?{Origin:base,'X-Manage-Request':'1','Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});const raw=await res.text();let value;try{value=JSON.parse(raw);}catch{value=raw;}return {status:res.status,value,cookie:res.headers.get('set-cookie'),headers:res.headers};}
 async function setup(){const result=await call('/api/manage/setup',{method:'POST',body:{username:'本机管理员',password:adminSecret}});assert.equal(result.status,201,JSON.stringify(result.value));return {...result.value,cookie:result.cookie.split(';')[0]};}
 return {home,directory,userId,userFile,recordFile,call,setup,restart:async()=>{await stop();await start();}};
}
test('管理中心需要独立账号，普通用户Cookie和角色字段不能越权，静态路由不暴露数据',async t=>{
 const f=await fixture(t);assert.equal((await f.call('/api/manage/session')).value.initialized,false);
 for(const route of ['/api/manage/sites','/api/manage/sites/tianqing/users','/api/manage/audit'])assert.equal((await f.call(route)).status,401);
 assert.equal((await f.call('/api/manage/sites',{headers:{Cookie:'tianqing_session='+'a'.repeat(64),'X-Role':'admin'}})).status,401);
 const admin=await f.setup();assert.match(admin.cookie,/site_manager_admin=/);const stored=fs.readFileSync(path.join(f.home,'data','manager','admin.json'),'utf8');assert.equal(stored.includes(adminSecret),false);
 assert.equal((await f.call('/api/manage/setup',{method:'POST',body:{username:'another',password:adminSecret}})).status,409);
 for(const route of ['/server.js','/lib/auth.js','/data/manager/admin.json','/.env','/../data/accounts'])assert.notEqual((await f.call(route)).status,200);
 const html=await f.call('/');assert.equal(html.status,200);assert.match(html.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
test('跨站、缺失CSRF、非法数据路径和伪装私网域名均被拒绝',async t=>{
 const f=await fixture(t),admin=await f.setup(),request={name:'Test',adapter:'link',url:'https://example.com'};
 assert.equal((await f.call('/api/manage/sites',{session:admin,headers:{Origin:'http://evil.invalid'}})).status,403);
 assert.equal((await f.call('/api/manage/sites',{method:'POST',session:admin,body:request,headers:{'X-Manage-CSRF':'bad'}})).status,403);
 assert.equal((await f.call('/api/manage/login',{method:'POST',body:{username:'本机管理员',password:adminSecret},headers:{'X-Manage-Request':''}})).status,403);
 assert.equal((await f.call('/api/manage/sites',{method:'POST',session:admin,body:{...request,url:'javascript:alert(1)'}})).status,400);
 assert.equal((await f.call('/api/manage/sites',{method:'POST',session:admin,body:{...request,adapter:'tianqing',directory:f.directory,url:'http://10.attacker.invalid'}})).status,400);
 assert.equal((await f.call('/api/manage/sites',{method:'POST',session:admin,body:{...request,adapter:'tianqing',directory:os.tmpdir(),url:'http://127.0.0.1:3001'}})).status,403);
 assert.equal((await f.call('/api/manage/sites',{method:'POST',session:admin,body:{...request,adapter:'tianqing',directory:path.join(f.home,'data','manager'),url:'http://127.0.0.1:3001'}})).status,403);
});
test('只返回允许的资料与完整记录，不返回密码哈希或会话，用户导出保持原备份格式',async t=>{
 const f=await fixture(t),admin=await f.setup(),list=await f.call('/api/manage/sites/tianqing/users',{session:admin});assert.equal(list.status,200);assert.equal(list.value.users[0].displayName,'小晴');assert.doesNotMatch(JSON.stringify(list.value),/DO_NOT_EXPOSE|PRIVATE_DIARY_BODY/);
 const detail=await f.call('/api/manage/sites/tianqing/users/'+f.userId,{session:admin});assert.equal(detail.value.records.moods[0].note,'PRIVATE_DIARY_BODY');assert.equal(detail.value.stats.photos,1);assert.doesNotMatch(JSON.stringify(detail.value),/DO_NOT_EXPOSE|password/);
 const exported=await f.call('/api/manage/sites/tianqing/users/'+f.userId+'/export',{session:admin});assert.equal(exported.value.schemaVersion,2);assert.equal(exported.value.moods[0].images[0].dataUrl,'data:image/jpeg;base64,/9j/AA==');assert.equal(exported.value.user,undefined);
});
test('停用恢复与强制下线先备份并递增会话版本，不修改日记；审计不记录正文或密码',async t=>{
 const f=await fixture(t),admin=await f.setup(),original=fs.readFileSync(f.recordFile,'utf8'),oldUser=fs.readFileSync(f.userFile,'utf8');
 const disabled=await f.call('/api/manage/sites/tianqing/users/'+f.userId+'/status',{method:'POST',session:admin,body:{disabled:true}});assert.equal(disabled.status,200);assert.equal(disabled.value.user.disabled,true);assert.equal(JSON.parse(fs.readFileSync(f.userFile)).authVersion,1);
 await f.call('/api/manage/sites/tianqing/users/'+f.userId+'/status',{method:'POST',session:admin,body:{disabled:false}});await f.call('/api/manage/sites/tianqing/users/'+f.userId+'/signout',{method:'POST',session:admin,body:{}});assert.equal(JSON.parse(fs.readFileSync(f.userFile)).authVersion,3);assert.equal(fs.readFileSync(f.recordFile,'utf8'),original);
 const parent=path.join(f.home,'backups','manager','user-changes','tianqing'),folders=fs.readdirSync(parent);assert.equal(folders.length,3);assert.ok(folders.some(folder=>fs.readFileSync(path.join(parent,folder,path.basename(f.userFile)),'utf8')===oldUser));
 const audit=await f.call('/api/manage/audit',{session:admin});assert.ok(audit.value.events.some(e=>e.action==='user.status'));assert.doesNotMatch(JSON.stringify(audit.value),/PRIVATE_DIARY_BODY|DO_NOT_EXPOSE|manager QA passphrase/);
});
test('网站备份完整校验并排除登录凭证；链接型网站可登记和归档但不会伪造用户接入',async t=>{
 const f=await fixture(t),admin=await f.setup(),result=await f.call('/api/manage/sites/tianqing/backup',{method:'POST',session:admin,body:{}});assert.equal(result.status,200);assert.equal(result.value.files,2);assert.equal(fs.existsSync(path.join(result.value.directory,'sessions')),false);
 const manifest=JSON.parse(fs.readFileSync(path.join(result.value.directory,'manifest.json')));for(const entry of manifest.files)assert.equal(hash(fs.readFileSync(path.join(result.value.directory,entry.file))),entry.sha256);
 const added=await f.call('/api/manage/sites',{method:'POST',session:admin,body:{name:'将来的网站',adapter:'link',url:'https://example.com'}});assert.equal(added.status,201);const id=added.value.site.id;
 assert.equal((await f.call('/api/manage/sites/'+id+'/users',{session:admin})).status,400);
 assert.equal((await f.call('/api/manage/sites/'+id,{method:'PUT',session:admin,body:{name:'将来的网站',adapter:'link',url:'https://example.com',archived:true}})).status,200);
 assert.equal((await f.call('/api/manage/sites',{session:admin})).value.sites.find(s=>s.id===id).archived,true);
});
test('管理员登出、重启和空闲会话过期生效，凭证与数据目录隔离',async t=>{
 let time=100000;const f=await fixture(t,{clock:()=>time}),admin=await f.setup();time+=3600001;assert.equal((await f.call('/api/manage/sites',{session:admin})).status,401);
 const login=await f.call('/api/manage/login',{method:'POST',body:{username:'本机管理员',password:adminSecret}}),session={...login.value,cookie:login.cookie.split(';')[0]};assert.equal((await f.call('/api/manage/sites',{session})).status,200);
 await f.restart();assert.equal((await f.call('/api/manage/sites',{session})).status,401);
 const next=await f.call('/api/manage/login',{method:'POST',body:{username:'本机管理员',password:adminSecret}}),active={...next.value,cookie:next.cookie.split(';')[0]};await f.call('/api/manage/logout',{method:'POST',session:active,body:{}});assert.equal((await f.call('/api/manage/sites',{session:active})).status,401);
});
test('管理员密码更新撤销旧窗口，登录限流且失败不会覆盖已有密码',async t=>{
 const f=await fixture(t),admin=await f.setup(),wrong=await f.call('/api/manage/password',{method:'POST',session:admin,body:{currentPassword:'wrong previous password',newPassword:'new manager secret phrase'}});assert.equal(wrong.status,400);
 const changed=await f.call('/api/manage/password',{method:'POST',session:admin,body:{currentPassword:adminSecret,newPassword:'new manager secret phrase'}});assert.equal(changed.status,200);assert.equal((await f.call('/api/manage/sites',{session:admin})).status,401);
 assert.equal((await f.call('/api/manage/login',{method:'POST',body:{username:'本机管理员',password:adminSecret}})).status,401);
 for(let i=0;i<21;i++)var last=await f.call('/api/manage/login',{method:'POST',body:{username:'x',password:'short'}});assert.equal(last.status,429);
});

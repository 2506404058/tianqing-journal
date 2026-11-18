const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer}=require('./server');
const secret='a separate test passphrase';
async function fixture(t,{clock}={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'tianqing-accounts-'));
 let server,base;
 async function start(){server=createServer({sharing:true,accountsDirectory:directory,accountOptions:clock?{now:clock}:undefined});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
 async function stop(){await new Promise(r=>server.close(r));}
 await start();t.after(async()=>{await stop();fs.rmSync(directory,{recursive:true,force:true});});
 async function call(route,{method='GET',session,body,headers={}}={}){
  const response=await fetch(base+route,{method,headers:{...(session?{Cookie:session.cookie,'X-Tianqing-CSRF':session.csrf,'X-Tianqing-Account':session.user.id}:{}),...(method!=='GET'?{Origin:base,'X-Tianqing-Request':'1','Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();let value;try{value=JSON.parse(text);}catch{value=text;}
  return {status:response.status,value,cookie:response.headers.get('set-cookie')};
 }
 async function register(username,rememberMe=false){const result=await call('/api/auth/register',{method:'POST',body:{username,password:secret,rememberMe}});assert.equal(result.status,201,JSON.stringify(result.value));return {...result.value,cookie:result.cookie.split(';')[0],cookieHeader:result.cookie};}
 return {directory,call,register,restart:async()=>{await stop();await start();}};
}
test('注册使用独立密码哈希，用户名规范化，重复注册不覆盖；会话不暴露哈希',async t=>{
 const f=await fixture(t),a=await f.register('小晴');
 const [file]=fs.readdirSync(path.join(f.directory,'users'));
 const raw=fs.readFileSync(path.join(f.directory,'users',file),'utf8'),stored=JSON.parse(raw);
 assert.equal(raw.includes(secret),false);assert.equal(stored.password.algorithm,'scrypt');assert.equal(stored.password.N,131072);assert.equal(stored.password.salt.length,32);
 assert.equal((await f.call('/api/auth/register',{method:'POST',body:{username:'小晴',password:secret}})).status,409);
 assert.equal((await f.call('/api/auth/login',{method:'POST',body:{username:'小晴',password:'incorrect test password'}})).status,401);
 const info=await f.call('/api/auth/session',{session:a});assert.equal(info.value.user.username,'小晴');assert.equal(info.value.password,undefined);
 const b=await f.register('Ash');assert.equal((await f.call('/api/auth/register',{method:'POST',body:{username:'ＡＳＨ',password:secret}})).status,409);
 assert.equal((await f.call('/api/auth/login',{method:'POST',body:{username:'ash',password:secret}})).status,200);
 const bFile=fs.readdirSync(path.join(f.directory,'users')).map(n=>JSON.parse(fs.readFileSync(path.join(f.directory,'users',n),'utf8'))).find(x=>x.id===b.user.id);
 assert.notEqual(stored.password.hash,bFile.password.hash);assert.notEqual(stored.password.salt,bFile.password.salt);
});
test('未登录、跨站、缺少CSRF和账号错位均不能写；退出立即失效',async t=>{
 const f=await fixture(t),a=await f.register('Alice');
 assert.equal((await f.call('/api/account-records')).status,401);
 assert.equal((await f.call('/api/auth/login',{method:'POST',body:{username:'Alice',password:secret},headers:{Origin:'http://attacker.invalid'}})).status,403);
 assert.equal((await f.call('/api/auth/register',{method:'POST',body:{username:'Attacker',password:secret},headers:{'X-Tianqing-Request':''}})).status,403);
 assert.equal((await f.call('/api/account-records',{session:a,headers:{Origin:'http://attacker.invalid'}})).status,403);
 assert.equal((await f.call('/api/account-records',{method:'PUT',session:a,headers:{'X-Tianqing-CSRF':'','If-Match':'none'},body:{moods:[],tasks:[]}})).status,403);
 assert.equal((await f.call('/api/account-records',{session:a,headers:{'X-Tianqing-Account':'another-id'}})).status,409);
 const out=await f.call('/api/auth/logout',{method:'POST',session:a,body:{}});assert.equal(out.status,200);assert.match(out.cookie,/Max-Age=0/);
 assert.equal((await f.call('/api/account-records',{session:a})).status,401);
});
test('两个账号心情日程图片互相隔离，旧备份可导入，版本冲突和坏文件不覆盖',async t=>{
 const f=await fixture(t),a=await f.register('Alice'),b=await f.register('Bob');
 const records={moods:[{date:'2026-11-18',weather:3,intensity:4,note:'Alice private note',images:[{id:'image-one',dataUrl:'data:image/jpeg;base64,/9j/AA==',width:1,height:1}]}],tasks:[{id:'private-task',title:'Alice的计划',date:'2026-11-19',priority:'高'}]};
 const first=await f.call('/api/account-records',{method:'PUT',session:a,headers:{'If-Match':'none'},body:records});assert.equal(first.status,200);
 assert.equal(first.value.records.tasks[0].important,true);assert.ok(first.value.records.moods[0].id);
 const bRead=await f.call('/api/account-records?user='+a.user.id,{session:b});assert.deepEqual(bRead.value.records.moods,[]);assert.deepEqual(bRead.value.records.tasks,[]);
 const aRead=await f.call('/api/account-records',{session:a});assert.equal(aRead.value.records.moods[0].images[0].dataUrl,records.moods[0].images[0].dataUrl);
 assert.equal((await f.call('/api/account-records',{method:'PUT',session:a,headers:{'If-Match':'none'},body:records})).status,409);
 assert.equal((await f.call('/api/account-records',{method:'PUT',session:a,headers:{'If-Match':first.value.revision},body:{moods:[{date:'invalid'}]}})).status,400);
 const second=await f.call('/api/account-records',{method:'PUT',session:a,headers:{'If-Match':first.value.revision},body:{moods:[],tasks:[]}});assert.equal(second.status,200);
 const file=path.join(f.directory,'records',a.user.id+'.json');assert.equal(JSON.parse(fs.readFileSync(file+'.bak','utf8')).moods[0].note,'Alice private note');
 fs.writeFileSync(file,'corrupt-file');assert.equal((await f.call('/api/account-records',{session:a})).status,409);
 assert.equal((await f.call('/api/account-records',{method:'PUT',session:a,headers:{'If-Match':second.value.revision},body:records})).status,409);assert.equal(fs.readFileSync(file,'utf8'),'corrupt-file');
 for(const route of ['/accounts.js','/shared-accounts/users','/records/'+a.user.id+'.json','/api/local-records'])assert.notEqual((await f.call(route,{session:a})).status,200);
});
test('重启保留账号和记录但使会话失效；重新登录可跨设备读取',async t=>{
 const f=await fixture(t),a=await f.register('Alice');
 await f.call('/api/account-records',{method:'PUT',session:a,headers:{'If-Match':'none'},body:{moods:[{date:'2026-11-18',weather:0,note:'after restart'}],tasks:[]}});
 await f.restart();assert.equal((await f.call('/api/account-records',{session:a})).status,401);
 const login=await f.call('/api/auth/login',{method:'POST',body:{username:'Alice',password:secret}});assert.equal(login.status,200);
 assert.match(login.cookie,/HttpOnly/);assert.match(login.cookie,/SameSite=Strict/);
 const session={...login.value,cookie:login.cookie.split(';')[0]};assert.equal((await f.call('/api/account-records',{session})).value.records.moods[0].note,'after restart');
});
test('修改密码验证原密码并注销其他设备，旧密码无法登录',async t=>{
 const f=await fixture(t),a=await f.register('Alice');
 const login=await f.call('/api/auth/login',{method:'POST',body:{username:'Alice',password:secret}}),other={...login.value,cookie:login.cookie.split(';')[0]};
 assert.equal((await f.call('/api/auth/password',{method:'POST',session:a,body:{currentPassword:'a wrong old password',newPassword:'a new separate passphrase'}})).status,400);
 const changed=await f.call('/api/auth/password',{method:'POST',session:a,body:{currentPassword:secret,newPassword:'a new separate passphrase'}});assert.equal(changed.status,200);
 assert.equal((await f.call('/api/account-records',{session:other})).status,401);
 assert.equal((await f.call('/api/auth/login',{method:'POST',body:{username:'Alice',password:secret}})).status,401);
 assert.equal((await f.call('/api/auth/login',{method:'POST',body:{username:'Alice',password:'a new separate passphrase'}})).status,200);
});
test('空闲超时、绝对超时和登录限流生效，静态版没有账号API',async t=>{
 let time=100000;const f=await fixture(t,{clock:()=>time}),a=await f.register('Alice');
 time+=2*3600000+1;assert.equal((await f.call('/api/account-records',{session:a})).status,401);
 const login=await f.call('/api/auth/login',{method:'POST',body:{username:'Alice',password:secret}}),b={...login.value,cookie:login.cookie.split(';')[0]};
 for(let i=0;i<11;i++){time+=3600000;assert.equal((await f.call('/api/account-records',{session:b})).status,200);}
 time+=3600000;assert.equal((await f.call('/api/account-records',{session:b})).status,401);
 // Invalid input still counts toward the per-IP limiter, without expensive hashes.
 for(let i=0;i<31;i++)var last=await f.call('/api/auth/login',{method:'POST',body:{username:'x',password:''}});
 assert.equal(last.status,429);
 const staticServer=createServer();await new Promise(r=>staticServer.listen(0,'127.0.0.1',r));
 try{assert.equal((await fetch('http://127.0.0.1:'+staticServer.address().port+'/api/auth/session')).status,404);}
 finally{await new Promise(r=>staticServer.close(r));}
 assert.throws(()=>createServer({sharing:true,accountsDirectory:path.join(__dirname,'public','private')}),/公开网页目录/);
});

test('旧账号个人资料有兼容默认值和真实统计，读取不重写文件或返回密码字段',async t=>{
 const f=await fixture(t),a=await f.register('小晴');
 const userFile=path.join(f.directory,'users',fs.readdirSync(path.join(f.directory,'users'))[0]),original=fs.readFileSync(userFile,'utf8');
 const records={moods:[{date:'2026-11-18',weather:1,images:[{id:'first-image',dataUrl:'data:image/jpeg;base64,/9j/AA==',width:1,height:1}]},{date:'2026-11-18',weather:3},{date:'2026-11-17',weather:0}],tasks:[{id:'todo-one',title:'待完成',date:'2026-11-18'},{id:'done-one',title:'已完成',date:'2026-11-17',done:true}]};
 const saved=await f.call('/api/account-records',{method:'PUT',session:a,headers:{'If-Match':'none'},body:records});assert.equal(saved.status,200);
 const result=await f.call('/api/auth/profile',{session:a});assert.equal(result.status,200);
 assert.equal(result.value.user.username,'小晴');assert.equal(result.value.user.displayName,'小晴');assert.equal(result.value.user.avatar,'☀️');assert.equal(result.value.user.bio,'');assert.equal(result.value.user.createdAt,JSON.parse(original).createdAt);
 assert.deepEqual(result.value.stats,{moods:3,recordedDays:2,tasks:2,completedTasks:1,photos:1});
 assert.equal(fs.readFileSync(userFile,'utf8'),original);assert.doesNotMatch(JSON.stringify(result.value),/password|hash|salt|scrypt|directory/);
 const b=await f.register('另一朵云');const own=await f.call('/api/auth/profile?user='+a.user.id,{session:b});assert.equal(own.value.user.id,b.user.id);assert.equal(own.value.stats.moods,0);
});

test('资料修改仅更新当前账号的允许字段，记录和登录凭证不变，跨设备和重启可恢复',async t=>{
 const f=await fixture(t),a=await f.register('Alice'),b=await f.register('Bob');
 const files=fs.readdirSync(path.join(f.directory,'users')).map(name=>({name,user:JSON.parse(fs.readFileSync(path.join(f.directory,'users',name),'utf8'))}));
 const original=files.find(file=>file.user.id===a.user.id),bob=files.find(file=>file.user.id===b.user.id),bobRaw=fs.readFileSync(path.join(f.directory,'users',bob.name),'utf8');
 const login=await f.call('/api/auth/login',{method:'POST',body:{username:'Alice',password:secret}}),other={...login.value,cookie:login.cookie.split(';')[0]};
 const saved=await f.call('/api/auth/profile',{method:'PUT',session:a,body:{displayName:'  今天也晴朗  ',bio:'  慢慢安排每一天。  ',avatar:'🌿',id:b.user.id,username:'Bob',createdAt:'2000-01-01',password:{hash:'forged'},admin:true}});assert.equal(saved.status,200);
 assert.equal(saved.value.user.displayName,'今天也晴朗');assert.equal(saved.value.user.bio,'慢慢安排每一天。');assert.equal(saved.value.user.avatar,'🌿');assert.equal(saved.value.user.username,'Alice');assert.equal(saved.value.user.id,a.user.id);
 const stored=JSON.parse(fs.readFileSync(path.join(f.directory,'users',original.name),'utf8'));
 assert.deepEqual(stored.password,original.user.password);assert.equal(stored.createdAt,original.user.createdAt);assert.equal(stored.admin,undefined);assert.equal(fs.readFileSync(path.join(f.directory,'users',bob.name),'utf8'),bobRaw);
 assert.equal((await f.call('/api/auth/session',{session:other})).value.user.displayName,'今天也晴朗');
 assert.equal((await f.call('/api/auth/profile',{session:other})).value.user.bio,'慢慢安排每一天。');
 assert.equal((await f.call('/api/account-records',{session:a})).value.revision,'none');
 const changed=await f.call('/api/auth/password',{method:'POST',session:a,body:{currentPassword:secret,newPassword:'a separate updated passphrase'}});assert.equal(changed.status,200);assert.equal(changed.value.user.displayName,'今天也晴朗');
 await f.restart();const again=await f.call('/api/auth/login',{method:'POST',body:{username:'Alice',password:'a separate updated passphrase'}});assert.equal(again.status,200);
 const session={...again.value,cookie:again.cookie.split(';')[0]},profile=await f.call('/api/auth/profile',{session});assert.equal(profile.value.user.bio,'慢慢安排每一天。');assert.equal(profile.value.user.avatar,'🌿');
});

test('个人资料拒绝未登录、跨站、伪造账号、非法头像和超长输入，失败不写文件',async t=>{
 const f=await fixture(t),a=await f.register('Alice'),input={displayName:'小晴',bio:'',avatar:'🌷'};
 const file=path.join(f.directory,'users',fs.readdirSync(path.join(f.directory,'users'))[0]),original=fs.readFileSync(file,'utf8');
 assert.equal((await f.call('/api/auth/profile')).status,401);
 assert.equal((await f.call('/api/auth/profile',{session:a,headers:{'X-Tianqing-Account':'someone-else'}})).status,409);
 assert.equal((await f.call('/api/auth/profile',{method:'PUT',session:a,body:input,headers:{Origin:'http://attacker.invalid'}})).status,403);
 assert.equal((await f.call('/api/auth/profile',{method:'PUT',session:a,body:input,headers:{'X-Tianqing-CSRF':'invalid'}})).status,403);
 for(const body of [{...input,displayName:'a'.repeat(25)},{...input,bio:'b'.repeat(141)},{...input,avatar:'<img src=x>'},{...input,bio:{text:'x'}},null,[]])assert.equal((await f.call('/api/auth/profile',{method:'PUT',session:a,body})).status,400);
 assert.equal(fs.readFileSync(file,'utf8'),original);
 const blank=await f.call('/api/auth/profile',{method:'PUT',session:a,body:{displayName:' ',bio:'',avatar:'☀️'}});assert.equal(blank.status,200);assert.equal(blank.value.user.displayName,'Alice');
});

test('普通登录刷新同一会话可恢复，默认不创建自动登录文件或持久Cookie',async t=>{
 const f=await fixture(t),a=await f.register('Alice');
 assert.doesNotMatch(a.cookieHeader,/Max-Age|Expires/);assert.equal(a.rememberMe,false);
 for(let i=0;i<5;i++){const response=await f.call('/api/auth/session',{session:a});assert.equal(response.value.user.id,a.user.id);assert.equal(response.value.csrf,a.csrf);}
 assert.equal(fs.existsSync(path.join(f.directory,'sessions')),false);
 await f.restart();assert.equal((await f.call('/api/auth/session',{session:a})).value.user,null);
});

test('勾选自动登录使用30天Cookie和摘要文件，重启后恢复CSRF和账号并可继续保存',async t=>{
 const f=await fixture(t),a=await f.register('Alice',true);
 assert.match(a.cookieHeader,/Max-Age=2592000/);assert.match(a.cookieHeader,/HttpOnly/);assert.match(a.cookieHeader,/SameSite=Strict/);assert.equal(a.rememberMe,true);
 const [name]=fs.readdirSync(path.join(f.directory,'sessions')),raw=fs.readFileSync(path.join(f.directory,'sessions',name),'utf8'),token=a.cookie.split('=')[1];
 assert.match(name,/^[a-f0-9]{64}\.json$/);assert.notEqual(name.slice(0,-5),token);assert.equal(raw.includes(token),false);assert.equal(raw.includes(secret),false);
 await f.restart();const current=await f.call('/api/auth/session',{session:a});assert.equal(current.value.user.id,a.user.id);assert.equal(current.value.rememberMe,true);assert.equal(current.value.csrf,a.csrf);
 const saved=await f.call('/api/account-records',{method:'PUT',session:a,headers:{'If-Match':'none'},body:{moods:[],tasks:[{id:'remembered-task',title:'恢复后继续安排',date:'2026-11-18'}]}});assert.equal(saved.status,200);
 const forged={...a,cookie:'tianqing_session='+name.slice(0,-5)};assert.equal((await f.call('/api/auth/session',{session:forged})).value.user,null);
});

test('自动登录不受普通2小时空闲限制，30天固定到期后清理凭证',async t=>{
 let time=100000;const f=await fixture(t,{clock:()=>time}),a=await f.register('Alice',true);
 time+=29*24*3600000;await f.restart();assert.equal((await f.call('/api/account-records',{session:a})).status,200);
 time+=24*3600000;assert.equal((await f.call('/api/account-records',{session:a})).status,401);assert.equal(fs.readdirSync(path.join(f.directory,'sessions')).length,0);
});

test('退出自动登录在服务重启后仍失效，重新选择普通登录会撤销之前的持久凭证',async t=>{
 const f=await fixture(t),a=await f.register('Alice',true);await f.restart();
 assert.equal((await f.call('/api/auth/logout',{method:'POST',session:a,body:{}})).status,200);assert.equal(fs.readdirSync(path.join(f.directory,'sessions')).length,0);
 await f.restart();assert.equal((await f.call('/api/auth/session',{session:a})).value.user,null);
 const remembered=await f.call('/api/auth/login',{method:'POST',body:{username:'Alice',password:secret,rememberMe:true}}),b={...remembered.value,cookie:remembered.cookie.split(';')[0]};
 const ordinary=await f.call('/api/auth/login',{method:'POST',session:b,body:{username:'Alice',password:secret,rememberMe:false}});assert.equal(ordinary.status,200);assert.doesNotMatch(ordinary.cookie,/Max-Age/);assert.equal(fs.readdirSync(path.join(f.directory,'sessions')).length,0);
 await f.restart();assert.equal((await f.call('/api/auth/session',{session:b})).value.user,null);
});

test('改密码撤销未加载的设备凭证，恢复旧会话文件也无法绕过会话版本，其他账号不受影响',async t=>{
 const f=await fixture(t),a=await f.register('Alice',true),bob=await f.register('Bob',true);
 const login=await f.call('/api/auth/login',{method:'POST',body:{username:'Alice',password:secret,rememberMe:true}}),other={...login.value,cookie:login.cookie.split(';')[0]};
 const digest=require('node:crypto').createHash('sha256').update(other.cookie.split('=')[1]).digest('hex'),oldFile=path.join(f.directory,'sessions',digest+'.json'),oldRaw=fs.readFileSync(oldFile,'utf8');
 await f.restart();const changed=await f.call('/api/auth/password',{method:'POST',session:a,body:{currentPassword:secret,newPassword:'updated remembered passphrase'}});assert.equal(changed.status,200);assert.equal(changed.value.rememberMe,true);
 const active={...changed.value,cookie:changed.cookie.split(';')[0]};assert.equal(fs.existsSync(oldFile),false);fs.writeFileSync(oldFile,oldRaw);
 await f.restart();assert.equal((await f.call('/api/account-records',{session:other})).status,401);assert.equal((await f.call('/api/account-records',{session:a})).status,401);assert.equal((await f.call('/api/account-records',{session:active})).status,200);assert.equal((await f.call('/api/account-records',{session:bob})).status,200);
});

test('自动登录参数和损坏或超期扩展的凭证不会被信任',async t=>{
 const f=await fixture(t),a=await f.register('Alice',true),folder=path.join(f.directory,'sessions'),[name]=fs.readdirSync(folder),file=path.join(folder,name);
 assert.equal((await f.call('/api/auth/login',{method:'POST',body:{username:'Alice',password:secret,rememberMe:'true'}})).status,400);
 const saved=JSON.parse(fs.readFileSync(file,'utf8'));saved.expires+=1000;fs.writeFileSync(file,JSON.stringify(saved));await f.restart();assert.equal((await f.call('/api/auth/session',{session:a})).value.user,null);assert.equal(fs.existsSync(file),false);
 const b=await f.register('Bob',true),[next]=fs.readdirSync(folder);fs.writeFileSync(path.join(folder,next),'not-json');await f.restart();assert.equal((await f.call('/api/auth/session',{session:b})).value.user,null);
});

test('管理员停用后普通与自动登录立即失效，恢复账号不能复活旧凭证，原记录保留',async t=>{
 const f=await fixture(t),ordinary=await f.register('Alice'),login=await f.call('/api/auth/login',{method:'POST',body:{username:'Alice',password:secret,rememberMe:true}}),remembered={...login.value,cookie:login.cookie.split(';')[0]};
 const data={moods:[{date:'2026-11-18',weather:0,note:'should remain'}],tasks:[]};await f.call('/api/account-records',{method:'PUT',session:ordinary,headers:{'If-Match':'none'},body:data});
 const userFile=path.join(f.directory,'users',fs.readdirSync(path.join(f.directory,'users'))[0]),user=JSON.parse(fs.readFileSync(userFile,'utf8'));
 fs.writeFileSync(userFile,JSON.stringify({...user,disabled:true,authVersion:1}));
 assert.equal((await f.call('/api/account-records',{session:ordinary})).status,401);assert.equal((await f.call('/api/account-records',{session:remembered})).status,401);
 assert.equal((await f.call('/api/auth/login',{method:'POST',body:{username:'Alice',password:secret}})).status,403);
 fs.writeFileSync(userFile,JSON.stringify({...user,disabled:false,authVersion:2}));assert.equal((await f.call('/api/account-records',{session:remembered})).status,401);
 const again=await f.call('/api/auth/login',{method:'POST',body:{username:'Alice',password:secret}}),restored={...again.value,cookie:again.cookie.split(';')[0]};assert.equal(again.status,200);assert.equal((await f.call('/api/account-records',{session:restored})).value.records.moods[0].note,'should remain');
});

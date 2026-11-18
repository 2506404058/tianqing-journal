// Optional Node-only accounts. Never mount this directory in the static server.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const {validate,serialize}=require('./public/storage');
const scrypt=promisify(crypto.scrypt);
const {createSessions}=require('./sessions');
const error=(status,message)=>Object.assign(Error(message),{status});
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const AVATARS=['☀️','🌤️','🌿','🌷','🌙','🌈'];
const publicUser=user=>({id:user.id,username:user.username,createdAt:user.createdAt||null,displayName:user.profile?.displayName||user.username,avatar:AVATARS.includes(user.profile?.avatar)?user.profile.avatar:AVATARS[0]});
function atomicWrite(file,value){
 fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
 const temporary=file+'.tmp';
 fs.writeFileSync(temporary,JSON.stringify(value),{mode:0o600});
 fs.renameSync(temporary,file);
}
function createAccounts({directory,now=Date.now,originProtocol='http',cookieName='tianqing_session',secureCookie=false,authOnly=false}){
 if(!directory)throw Error('账号目录未配置');
 const attempts=new Map();let activeHashes=0;
 const usersDir=path.join(directory,'users'),recordsDir=path.join(directory,'records');
 function username(value){
  if(typeof value!=='string')throw error(400,'请填写用户名');
  const name=value.trim().normalize('NFKC');
  if(!/^[\p{L}\p{N}_-]{2,24}$/u.test(name))throw error(400,'用户名需为2～24位中文、字母、数字、下划线或短横线');
  return name;
 }
 function password(value){
  if(typeof value!=='string'||[...value].length<10||value.length>128||Buffer.byteLength(value)>512)throw error(400,'密码需为10～128个字符，可以使用一句好记的话');
  return value;
 }
 function userFile(name){return path.join(usersDir,digest(name.toLowerCase())+'.json');}
 function readUser(name){const file=userFile(name);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;}
 const sessions=createSessions({directory:path.join(directory,'sessions'),now,readUser,publicUser,cookieName,secureCookie});
 function limit(key,maximum){
  const time=now();for(const [key,item] of attempts)if(item.until<=time)attempts.delete(key);
  let item=attempts.get(key);
  if(!item){if(attempts.size>=4096)throw error(429,'访问较多，请稍后再试');attempts.set(key,item={count:0,until:time+15*60000});}
  if(++item.count>maximum)throw error(429,'尝试过于频繁，请15分钟后再试');
 }
 async function derive(value,salt){
  if(activeHashes>=2)throw error(429,'登录服务正忙，请稍后重试');
  activeHashes++;
  try{return await scrypt(value,salt,64,{N:131072,r:8,p:1,maxmem:160*1024*1024});}
  finally{activeHashes--;}
 }
 function session(req){return sessions.get(req);}
 function startSession(req,res,user,remember=false){return sessions.start(req,res,user,remember);}
 function readRecords(id){
  const file=path.join(recordsDir,id+'.json');
  if(!fs.existsSync(file))return {exists:false,revision:'none',records:validate({moods:[],tasks:[]})};
  try{const raw=fs.readFileSync(file,'utf8');return {exists:true,revision:digest(raw),records:validate(JSON.parse(raw))};}
  catch{throw error(409,'账号记录文件无法读取，原文件已保留，请联系服务器主人检查备份');}
 }
 function profileResult(user){
  const records=readRecords(user.id).records;
  return {user:{...publicUser(user),bio:user.profile?.bio||''},stats:{moods:records.moods.length,recordedDays:new Set(records.moods.map(m=>m.date)).size,tasks:records.tasks.length,completedTasks:records.tasks.filter(t=>t.done).length,photos:records.moods.reduce((sum,m)=>sum+m.images.length,0)}};
 }
 function cleanProfile(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw error(400,'资料格式无效');
  const text=(key,max)=>{if(typeof input[key]!=='string')throw error(400,'请填写有效的昵称和简介');const value=input[key].trim();if(value.length>max)throw error(400,key==='displayName'?'昵称最多24个字符':'简介最多140个字符');return value;};
  const displayName=text('displayName',24),bio=text('bio',140);
  if(!AVATARS.includes(input.avatar))throw error(400,'请从提供的天气头像中选择一个');
  // Only these editable fields are accepted: identity and password are immutable here.
  return {displayName,bio,avatar:input.avatar};
 }
 async function body(req,maximum){
  if(!(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw error(415,'请使用JSON格式');
  return new Promise((resolve,reject)=>{
   const chunks=[];let bytes=0,overflow=false;
   req.on('data',chunk=>{
    bytes+=chunk.length;
    if(bytes>maximum){if(!overflow){overflow=true;chunks.length=0;reject(error(413,'内容过大；每个账号的记录最多5MB，请导出后清理部分图片'));}return;}
    chunks.push(chunk);
   });
   req.on('end',()=>{if(overflow)return;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(error(400,'内容格式无效'));}});
   req.on('error',reject);
  });
 }
 async function handle(req,res,pathname,host){
  if(authOnly&&!['/api/auth/session','/api/auth/register','/api/auth/login','/api/auth/logout'].includes(pathname))return false;
  if(!['/api/auth/session','/api/auth/register','/api/auth/login','/api/auth/logout','/api/auth/password','/api/auth/profile','/api/account-records'].includes(pathname))return false;
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  try{
   // Exact origin also separates other services on the same ZeroTier host.
   if(req.headers.origin&&req.headers.origin!==originProtocol+'://'+host)throw error(403,'拒绝跨站访问');
   if(req.headers['sec-fetch-site']==='cross-site')throw error(403,'拒绝跨站访问');
   if(req.method!=='GET'&&(req.headers.origin!==originProtocol+'://'+host||req.headers['x-tianqing-request']!=='1'))throw error(403,'请从心晴手账页面提交');
   if(pathname==='/api/auth/session'){
    if(req.method!=='GET')throw error(405,'不支持的请求方式');
    const current=session(req);json(200,current?{user:current.user,csrf:current.csrf,rememberMe:current.remember}:{user:null});return true;
   }
   if(pathname==='/api/auth/register'||pathname==='/api/auth/login'){
    if(req.method!=='POST')throw error(405,'不支持的请求方式');
    limit('ip:'+req.socket.remoteAddress,30);
    const input=await body(req,8192),name=username(input?.username),secret=password(input?.password),isRegister=pathname.endsWith('/register');
    if(input.rememberMe!==undefined&&typeof input.rememberMe!=='boolean')throw error(400,'自动登录选项格式无效');
    const remember=input.rememberMe===true;
    limit('name:'+name.toLowerCase(),12);
    const existing=readUser(name);
    if(isRegister){
     limit('registration:'+req.socket.remoteAddress,5);
     if(existing)throw error(409,'这个用户名已被使用，请换一个');
     if(fs.existsSync(usersDir)&&fs.readdirSync(usersDir).filter(f=>f.endsWith('.json')).length>=1000)throw error(503,'暂时无法注册，请联系服务器主人');
     const salt=crypto.randomBytes(16).toString('hex'),hash=(await derive(secret,salt)).toString('hex');
     // Recheck after asynchronous hashing: concurrent registrations cannot overwrite.
     if(readUser(name))throw error(409,'这个用户名已被使用，请换一个');
     const user={id:crypto.randomUUID(),username:name,createdAt:new Date(now()).toISOString(),password:{algorithm:'scrypt',N:131072,r:8,p:1,salt,hash}};
     atomicWrite(userFile(name),user);json(201,startSession(req,res,user,remember));return true;
    }
    const actual=await derive(secret,existing?.password.salt||'00000000000000000000000000000000');
    const expected=existing?Buffer.from(existing.password.hash,'hex'):Buffer.alloc(64);
    if(!existing||expected.length!==actual.length||!crypto.timingSafeEqual(actual,expected))throw error(401,'用户名或密码不正确');
    if(existing.disabled===true)throw error(403,'账号已被管理员停用，请联系网站管理员');
    json(200,startSession(req,res,existing,remember));return true;
   }
   const current=session(req);
   if(!current)throw error(401,'登录已过期，请重新登录；服务器上的记录仍然保留');
   // Prevent a stale tab for account A from writing A's records into account B.
   if(req.headers['x-tianqing-account']!==current.user.id)throw error(409,'当前账号已切换，请刷新页面再操作');
   if(req.method!=='GET'&&req.headers['x-tianqing-csrf']!==current.csrf)throw error(403,'页面验证已过期，请刷新后重试');
   if(pathname==='/api/auth/profile'){
    if(!['GET','PUT'].includes(req.method))throw error(405,'不支持的请求方式');
    const profile=req.method==='PUT'?cleanProfile(await body(req,8192)):null;
    const user=readUser(current.user.username);
    if(!user||user.id!==current.user.id)throw error(409,'账号资料暂时无法读取，请重新登录');
    if(!profile){json(200,profileResult(user));return true;}
    const next={...user,profile},result=profileResult(next);
    atomicWrite(userFile(user.username),next);

    json(200,result);return true;
   }
   if(pathname==='/api/auth/logout'){
    if(req.method!=='POST')throw error(405,'不支持的请求方式');
    sessions.end(res,current);json(200,{ok:true});return true;
   }
   if(pathname==='/api/auth/password'){
    if(req.method!=='POST')throw error(405,'不支持的请求方式');
    limit('password:'+current.user.id,8);
    const input=await body(req,8192),old=password(input?.currentPassword),next=password(input?.newPassword),user=readUser(current.user.username);
    const actual=await derive(old,user.password.salt),expected=Buffer.from(user.password.hash,'hex');
    if(expected.length!==actual.length||!crypto.timingSafeEqual(actual,expected))throw error(400,'原密码不正确');
    const salt=crypto.randomBytes(16).toString('hex'),hash=(await derive(next,salt)).toString('hex');
    // A password change invalidates all devices' sessions.
    const latest=readUser(user.username);
    if(!latest||latest.id!==user.id||latest.password.hash!==user.password.hash)throw error(409,'密码已在其他页面更新，请重新登录');
    const updated={...latest,authVersion:(latest.authVersion||0)+1,password:{algorithm:'scrypt',N:131072,r:8,p:1,salt,hash}};
    atomicWrite(userFile(user.username),updated);sessions.revokeUser(user.id);
    json(200,startSession(req,res,updated,current.remember));return true;
   }
   if(req.method==='GET'){json(200,readRecords(current.user.id));return true;}
   if(req.method!=='PUT')throw error(405,'不支持的请求方式');
   const input=await body(req,5000000);
   let records;try{records=validate(input);serialize(records);}catch(err){throw error(400,err.message||'记录格式无效');}
   const previous=readRecords(current.user.id);
   if(req.headers['if-match']!==previous.revision)throw error(409,'另一台设备或页面更新了记录，请先导出当前记录备份，再刷新读取最新版本');
   const file=path.join(recordsDir,current.user.id+'.json');
   if(previous.exists)fs.copyFileSync(file,file+'.bak');
   atomicWrite(file,records);json(200,readRecords(current.user.id));
  }catch(err){
   if(err.status===429)res.setHeader('Retry-After','900');
   json(err.status||500,{error:err.status?err.message:'账号服务暂时不可用，原记录未覆盖，请联系服务器主人检查磁盘与备份'});
  }
  return true;
 }
 return {handle,session};
}
module.exports={createAccounts};

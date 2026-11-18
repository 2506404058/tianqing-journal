const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{promisify}=require('node:util');
const {fail,hash,readJson,writeJson,body}=require('./io');
const derive=promisify(crypto.scrypt),COOKIE='site_manager_admin';
async function passwordHash(secret,salt){return derive(secret,salt,64,{N:131072,r:8,p:1,maxmem:160*1024*1024});}
function password(value){if(typeof value!=='string'||value.length<12||value.length>128)throw fail(400,'管理员密码需为12～128个字符');return value;}
const publicAdmin=user=>({id:user.id,username:user.username,createdAt:user.createdAt});
function createAuth(directory,{now=Date.now,audit=()=>{}}={}){
 const file=path.join(directory,'admin.json'),sessions=new Map(),attempts=new Map();let busy=0;
 function read(){return fs.existsSync(file)?readJson(file,8192):null;}
 function cookie(res,value,maxAge){res.setHeader('Set-Cookie',`${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict${maxAge===undefined?'':'; Max-Age='+maxAge}`);}
 function limit(req){const key=req.socket.remoteAddress,time=now(),old=attempts.get(key);if(!old||old.until<=time)attempts.set(key,{count:1,until:time+15*60000});else if(++old.count>20)throw fail(429,'尝试过于频繁，请15分钟后再试');}
 function get(req){
  const raw=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);if(!raw||! /^[a-f0-9]{64}$/.test(raw))return null;
  const key=hash(raw),item=sessions.get(key);if(!item)return null;const admin=read();
  if(!admin||item.version!==(admin.authVersion||0)||item.expires<=now()||item.seen+60*60000<=now()){sessions.delete(key);return null;}
  item.seen=now();return {...item,key,user:publicAdmin(admin)};
 }
 function start(req,res,admin){
  const previous=get(req);if(previous)sessions.delete(previous.key);
  for(const [key,item] of sessions)if(item.expires<=now()||item.seen+60*60000<=now())sessions.delete(key);
  if(sessions.size>=100)sessions.delete(sessions.keys().next().value);
  const raw=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomBytes(32).toString('hex');sessions.set(hash(raw),{version:admin.authVersion||0,csrf,seen:now(),expires:now()+8*3600000});cookie(res,raw);return {admin:publicAdmin(admin),csrf};
 }
 async function verify(secret,stored){const actual=await passwordHash(secret,stored?.salt||'00000000000000000000000000000000'),expected=stored?Buffer.from(stored.hash,'hex'):Buffer.alloc(64);return Boolean(stored&&actual.length===expected.length&&crypto.timingSafeEqual(actual,expected));}
 async function handle(req,res,route,json){
  if(route==='/api/manage/session'){
   if(req.method!=='GET')throw fail(405,'请求方式不支持');const current=get(req);json(200,{app:'local-site-manager-v1',initialized:Boolean(read()),...(current?{admin:current.user,csrf:current.csrf}:{admin:null})});return true;
  }
  if(!['/api/manage/setup','/api/manage/login','/api/manage/logout','/api/manage/password'].includes(route))return false;
  if(req.method!=='POST')throw fail(405,'请求方式不支持');
  if(route==='/api/manage/logout'){const current=requireAdmin(req);await body(req);sessions.delete(current.key);cookie(res,'',0);audit(current.user,'admin.logout');json(200,{ok:true});return true;}
  limit(req);if(busy>=2)throw fail(429,'账号服务正忙，请稍后重试');
  const input=await body(req);busy++;
  try{
   const admin=read();
   if(route==='/api/manage/password'){
    const current=requireAdmin(req),old=password(input.currentPassword),next=password(input.newPassword);
    if(!await verify(old,admin.password))throw fail(400,'原管理员密码不正确');
    const salt=crypto.randomBytes(16).toString('hex'),derived=(await passwordHash(next,salt)).toString('hex'),latest=read();
    if(latest.password.hash!==admin.password.hash)throw fail(409,'密码已在其他窗口更新，请重新登录');
    const updated={...latest,authVersion:(latest.authVersion||0)+1,password:{algorithm:'scrypt',salt,hash:derived}};audit(current.user,'admin.password_change');writeJson(file,updated);sessions.clear();json(200,start(req,res,updated));return true;
   }
   if(route==='/api/manage/setup'&&admin)throw fail(409,'管理员已设置，请使用登录入口');
   const username=typeof input.username==='string'?input.username.trim().normalize('NFKC'):'';
   if(!/^[\p{L}\p{N}_-]{2,24}$/u.test(username))throw fail(400,'用户名需为2～24位中文、字母、数字或 _ -');
   const secret=password(input.password);
   if(route==='/api/manage/setup'){
    const salt=crypto.randomBytes(16).toString('hex'),derived=(await passwordHash(secret,salt)).toString('hex');
    if(read())throw fail(409,'管理员已设置，请使用登录入口');
    const created={id:crypto.randomUUID(),username,createdAt:new Date(now()).toISOString(),authVersion:0,password:{algorithm:'scrypt',salt,hash:derived}};
    fs.mkdirSync(directory,{recursive:true,mode:0o700});fs.writeFileSync(file,JSON.stringify(created,null,2),{flag:'wx',mode:0o600});audit(publicAdmin(created),'admin.setup');json(201,start(req,res,created));return true;
   }
   const valid=await verify(secret,admin?.password);if(!admin||username.toLowerCase()!==admin.username.toLowerCase()||!valid)throw fail(401,'管理员用户名或密码不正确');
   audit(publicAdmin(admin),'admin.login');json(200,start(req,res,admin));return true;
  }finally{busy--;}
 }
 function requireAdmin(req){const current=get(req);if(!current)throw fail(401,'请先登录管理员账号');if(req.method!=='GET'&&req.headers['x-manage-csrf']!==current.csrf)throw fail(403,'页面验证已过期，请刷新重试');return current;}
 return {handle,requireAdmin};
}
module.exports={createAuth};

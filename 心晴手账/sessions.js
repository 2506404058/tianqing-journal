const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const COOKIE='tianqing_session',HOUR=3600000,REMEMBER_DAYS=30;
const digest=token=>crypto.createHash('sha256').update(token).digest('hex');
const random=()=>crypto.randomBytes(32).toString('hex');
function createSessions({directory,now=Date.now,readUser,publicUser,cookieName=COOKIE,secureCookie=false}){
 const memory=new Map();
 const fileFor=key=>path.join(directory,key+'.json');
 function forget(key){
  const file=fileFor(key);if(fs.existsSync(file))fs.unlinkSync(file);
  memory.delete(key);
 }
 function cookie(res,value,maxAge){
  res.setHeader('Set-Cookie',`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict${secureCookie?'; Secure':''}${maxAge===undefined?'':'; Max-Age='+maxAge}`);
 }
 function load(key){
  const file=fileFor(key);if(!fs.existsSync(file))return null;
  try{
   const saved=JSON.parse(fs.readFileSync(file,'utf8'));
   if(saved.version!==1||saved.remember!==true||typeof saved.username!=='string'||typeof saved.userId!=='string'||! /^[a-f0-9]{64}$/.test(saved.csrf)||!Number.isFinite(saved.createdAt)||!Number.isFinite(saved.expires)||saved.expires<=saved.createdAt||saved.expires-saved.createdAt>REMEMBER_DAYS*24*HOUR||!Number.isInteger(saved.authVersion))throw Error('Invalid session');
   return {user:{id:saved.userId,username:saved.username},csrf:saved.csrf,createdAt:saved.createdAt,expires:saved.expires,seen:now(),remember:true,authVersion:saved.authVersion};
  }catch(error){if(error.code)throw error;forget(key);return null;}
 }
 function get(req){
  const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!token||! /^[a-f0-9]{64}$/.test(token))return null;
  const key=digest(token);let item=memory.get(key);
  if(!item)item=load(key);if(!item)return null;
  const time=now();
  if(item.expires<=time||(!item.remember&&item.seen+2*HOUR<=time)){forget(key);return null;}
  // A deleted token stays revoked even if another running process cached it.
  if(item.remember&&!fs.existsSync(fileFor(key))){memory.delete(key);return null;}
  const user=readUser(item.user.username);
  if(!user||user.disabled===true||user.id!==item.user.id||(user.authVersion||0)!==item.authVersion){forget(key);return null;}
  item.user=publicUser(user);item.seen=time;memory.set(key,item);
  return {...item,key};
 }
 function prune(){
  const time=now();
  for(const [key,item] of memory)if(item.expires<=time||(!item.remember&&item.seen+2*HOUR<=time))forget(key);
  if(!fs.existsSync(directory))return;
  const existing=[];
  for(const name of fs.readdirSync(directory)){
   if(!/^[a-f0-9]{64}\.json$/.test(name))continue;
   const key=name.slice(0,-5),item=load(key);
   if(!item)continue;
   if(item.expires<=time)forget(key);else existing.push({key,createdAt:item.createdAt});
  }
  // Bound disk usage as well as the in-memory session cache.
  existing.sort((a,b)=>a.createdAt-b.createdAt);
  while(existing.length>=2000)forget(existing.shift().key);
 }
 function start(req,res,user,remember=false){
  prune();const previous=get(req);if(previous)forget(previous.key);
  if(memory.size>=2000)forget(memory.keys().next().value);
  const time=now(),token=random(),key=digest(token),item={user:publicUser(user),csrf:random(),createdAt:time,expires:time+(remember?REMEMBER_DAYS*24:12)*HOUR,seen:time,remember,authVersion:user.authVersion||0};
  if(remember){
   fs.mkdirSync(directory,{recursive:true,mode:0o700});
   const file=fileFor(key),saved={version:1,userId:user.id,username:user.username,csrf:item.csrf,createdAt:item.createdAt,expires:item.expires,remember:true,authVersion:item.authVersion};
   fs.writeFileSync(file+'.tmp',JSON.stringify(saved),{mode:0o600});fs.renameSync(file+'.tmp',file);
  }
  memory.set(key,item);cookie(res,token,remember?REMEMBER_DAYS*24*3600:undefined);
  return {user:item.user,csrf:item.csrf,rememberMe:remember};
 }
 function end(res,current){forget(current.key);cookie(res,'',0);}
 function revokeUser(id){
  // The user's authVersion is incremented before this cleanup, so old sessions
  // fail validation even if a stale file cannot be removed immediately.
  for(const [key,item] of memory)if(item.user.id===id){memory.delete(key);try{if(fs.existsSync(fileFor(key)))fs.unlinkSync(fileFor(key));}catch{}}
  if(!fs.existsSync(directory))return;
  for(const name of fs.readdirSync(directory)){
   if(!/^[a-f0-9]{64}\.json$/.test(name))continue;
   try{const item=JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));if(item.userId===id)fs.unlinkSync(path.join(directory,name));}catch{}
  }
 }
 return {get,start,end,revokeUser};
}
module.exports={createSessions};

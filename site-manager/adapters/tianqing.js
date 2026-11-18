const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fail,hash,inside,readJson,writeJson}=require('../lib/io');
const {validate}=require('./tianqing-storage');
const idPattern=/^[a-f0-9-]{36}$/i;
function createAdapter(site,{home,backups,audit}){
 const directory=fs.realpathSync(site.directory),realHome=fs.realpathSync(home);
 if(!inside(realHome,directory))throw fail(403,'数据目录不在已允许的服务器根目录中');
 function safe(file){if(!inside(directory,file))throw fail(403,'路径越界');if(fs.existsSync(file)&&!inside(directory,fs.realpathSync(file)))throw fail(403,'数据目录中存在越界链接，操作已停止');return file;}
 function all(){
  const folder=safe(path.join(directory,'users'));if(!fs.existsSync(folder))return [];
  const rows=[];for(const name of fs.readdirSync(folder).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).slice(0,1000)){
   try{const file=safe(path.join(folder,name)),user=readJson(file,65536);if(!idPattern.test(user.id)||typeof user.username!=='string')continue;rows.push({file,user});}catch{rows.push({invalid:true});}
  }return rows;
 }
 function find(id){if(!idPattern.test(id))throw fail(400,'用户编号格式无效');const row=all().find(x=>x.user?.id===id);if(!row)throw fail(404,'用户不存在');return row;}
 function recordFile(id){return safe(path.join(directory,'records',id+'.json'));}
 function metadata(row){
  const user=row.user,file=recordFile(user.id),stat=fs.existsSync(file)?fs.statSync(file):null;
  return {id:user.id,username:user.username,displayName:user.profile?.displayName||user.username,avatar:user.profile?.avatar||'☀️',bio:user.profile?.bio||'',createdAt:user.createdAt||null,disabled:user.disabled===true,bytes:stat?.size||0,lastSavedAt:stat?.mtime.toISOString()||null};
 }
 function list(){const rows=all();return {users:rows.filter(x=>!x.invalid).map(metadata),invalid:rows.filter(x=>x.invalid).length};}
 function records(id){const file=recordFile(id);if(!fs.existsSync(file))return validate({moods:[],tasks:[]});try{return validate(readJson(file));}catch{throw fail(409,'记录文件无法读取，原文件已保留，请检查备份');}}
 function backupUser(row,action){const destination=path.join(backups,'user-changes',site.id,new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(4).toString('hex'));fs.mkdirSync(destination,{recursive:true,mode:0o700});fs.copyFileSync(row.file,path.join(destination,path.basename(row.file)));return destination;}
 function mutate(id,operation,actor,value){
  const row=find(id),backup=backupUser(row,operation),next={...row.user,authVersion:(row.user.authVersion||0)+1};
  if(operation==='user.status')next.disabled=value;
  audit(actor,operation,{siteId:site.id,targetId:id,disabled:next.disabled===true,backup});writeJson(row.file,next);
  // authVersion revokes both in-memory and remembered sessions in the website.
  return metadata({file:row.file,user:next});
 }
 function detail(id){const row=find(id),data=records(id);return {user:metadata(row),records:data,stats:{moods:data.moods.length,days:new Set(data.moods.map(m=>m.date)).size,tasks:data.tasks.length,completedTasks:data.tasks.filter(t=>t.done).length,photos:data.moods.reduce((sum,m)=>sum+m.images.length,0)}};}
 function backupAll(actor){
  const target=path.join(backups,'sites',site.id,new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(4).toString('hex'));fs.mkdirSync(target,{recursive:true,mode:0o700});const entries=[];
  for(const folder of ['users','records']){
   const source=safe(path.join(directory,folder));if(!fs.existsSync(source))continue;fs.mkdirSync(path.join(target,folder),{recursive:true});
   for(const name of fs.readdirSync(source)){
    const allowed=folder==='users'?/^[a-f0-9]{64}\.json$/.test(name):/^[a-f0-9-]{36}\.json(?:\.bak|\.migration\.bak)?$/i.test(name);if(!allowed)continue;
    const file=safe(path.join(source,name)),stat=fs.statSync(file);if(!stat.isFile()||stat.size>6000000)throw fail(409,'备份遇到无效文件，已保留原数据');
    const raw=fs.readFileSync(file),relative=folder+'/'+name;fs.writeFileSync(path.join(target,relative),raw,{mode:0o600});entries.push({file:relative,bytes:raw.length,sha256:hash(raw)});
   }
  }
  writeJson(path.join(target,'manifest.json'),{siteId:site.id,createdAt:new Date().toISOString(),files:entries,excluded:'sessions'});audit(actor,'site.backup',{siteId:site.id,files:entries.length,backup:target});return {directory:target,files:entries.length,bytes:entries.reduce((n,e)=>n+e.bytes,0)};
 }
 return {list,detail,records,setDisabled:(id,value,actor)=>mutate(id,'user.status',actor,value),revoke:(id,actor)=>mutate(id,'user.signout_all',actor),backupAll};
}
module.exports={createAdapter};

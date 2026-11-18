const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function inside(root,target){const relative=path.relative(root,target);return !relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));}
function storageFingerprint(directory){const absolute=path.resolve(directory);return crypto.createHash('sha256').update(process.platform==='win32'?absolute.toLowerCase():absolute).digest('hex');}
function resolvePaths({environment=process.env,projectRoot=__dirname}={}){
 const configFile=path.join(projectRoot,'server-location.json');let local={};
 if(fs.existsSync(configFile)){
  try{local=JSON.parse(fs.readFileSync(configFile,'utf8'));if(!local||typeof local.home!=='string'||!path.isAbsolute(local.home))throw Error();}
  catch{throw Error('服务器目录配置无效，请检查 server-location.json；不会回退到C盘保存。');}
 }
 const home=path.resolve(environment.TIANQING_SERVER_HOME||local.home||path.join(projectRoot,'private','server'));
 if(inside(path.join(projectRoot,'public'),home))throw Error('服务器数据不能放在公开网页目录中');
 const contained=(value,fallback)=>{const target=path.resolve(value||fallback);if(!inside(home,target))throw Error('数据目录必须位于服务器根目录内，请检查 TIANQING_ACCOUNTS_DIR / TIANQING_DATA_DIR');return target;};
 return {
  home,accounts:contained(environment.TIANQING_ACCOUNTS_DIR,path.join(home,'data','accounts')),
  desktop:contained(environment.TIANQING_DATA_DIR,path.join(home,'data','desktop')),
  logs:path.join(home,'logs'),backups:path.join(home,'backups'),temp:path.join(home,'temp'),cache:path.join(home,'cache')
 };
}
module.exports={resolvePaths,storageFingerprint,inside};

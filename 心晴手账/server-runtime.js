const fs=require('node:fs'),path=require('node:path'),util=require('node:util');
const {resolvePaths}=require('./server-paths');
let configured;
function configureRuntime(mode='share'){
 if(configured)return configured;
 const locations=resolvePaths();
 for(const key of ['accounts','desktop','logs','backups','temp','cache'])fs.mkdirSync(locations[key],{recursive:true,mode:0o700});
 process.env.TEMP=locations.temp;process.env.TMP=locations.temp;process.env.TMPDIR=locations.temp;
 process.env.NPM_CONFIG_CACHE=path.join(locations.cache,'npm');
 if(process.report)process.report.directory=locations.logs;
 const logFile=path.join(locations.logs,mode==='desktop'?'desktop.log':'server.log');
 function append(text){
  const line='['+new Date().toISOString()+'] '+text.replace(/\x1b\[[0-9;]*m/g,'')+'\n';
  if(fs.existsSync(logFile)&&fs.statSync(logFile).size+Buffer.byteLength(line)>5*1024*1024){
   const previous=logFile+'.1';if(fs.existsSync(previous))fs.unlinkSync(previous);fs.renameSync(logFile,previous);
  }
  fs.appendFileSync(logFile,line,{mode:0o600});
 }
 // Persist console output including access metadata; never include cookies or journal bodies.
 for(const name of ['log','warn','error']){
  const original=console[name].bind(console);
  console[name]=(...values)=>{append(util.format(...values));original(...values);};
 }
 configured=locations;return locations;
}
module.exports={configureRuntime};

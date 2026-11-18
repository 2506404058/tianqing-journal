const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {resolvePaths,storageFingerprint}=require('./server-paths');
const {configureRuntime}=require('./server-runtime');
const {logRequest}=require('./access-log');
const {validate}=require('./public/storage');
const {createAccounts}=require('./accounts');
const root=path.join(__dirname,'public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
function createServer({dataFile,token=crypto.randomBytes(32).toString('hex'),allowedHosts=['localhost','127.0.0.1'],sharing=false,accountsDirectory,accountOptions={},requestLogger=null}={}){
 if(sharing&&dataFile)throw Error('分享模式不能同时启用本机记录文件');
 if(accountsDirectory&&(!sharing||dataFile))throw Error('账号功能仅用于独立的分享模式');
 if(accountsDirectory){
  const target=path.resolve(accountsDirectory),relative=path.relative(root,target);
  if(!relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw Error('账号目录不能位于公开网页目录中');
 }
 const accounts=accountsDirectory?createAccounts({...accountOptions,directory:accountsDirectory}):null;
 const desktop=Boolean(dataFile);
 function read(){
  if(!fs.existsSync(dataFile))return {exists:false,revision:'none',records:{moods:[],tasks:[]}};
  const raw=fs.readFileSync(dataFile,'utf8');
  return {exists:true,revision:crypto.createHash('sha256').update(raw).digest('hex'),records:validate(JSON.parse(raw))};
 }
 return http.createServer(async(req,res)=>{
  if(requestLogger)requestLogger(req,res);
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Frame-Options','DENY');
  const json=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body))};
  try{
   const host=req.headers.host||'';
   if(!allowedHosts.includes(host.replace(/:\d+$/,''))){res.writeHead(403);res.end();return;}
   const url=new URL(req.url,'http://localhost');
   const pathname=decodeURIComponent(url.pathname);
   if(sharing&&pathname==='/api/share-status'&&req.method==='GET'){json(200,{app:'tianqing-share-v1',accounts:Boolean(accounts),storageId:accountsDirectory?storageFingerprint(accountsDirectory):null});return;}
   if(accounts&&pathname==='/runtime.js'){
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});
    res.end(req.method==='HEAD'?undefined:'window.TianqingRuntime={desktop:false,accounts:true};');return;
   }
   if(accounts&&await accounts.handle(req,res,pathname,host))return;
   if(desktop&&pathname==='/api/desktop-status'){
    if(req.method!=='GET'){json(405,{error:'Method not allowed'});return;}
    json(200,{app:'tianqing-desktop-v1',storageId:storageFingerprint(dataFile)});return;
   }
   if(desktop&&pathname==='/runtime.js'){
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    if(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'){res.writeHead(403);res.end();return;}
    res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});
    res.end(req.method==='HEAD'?undefined:'window.TianqingRuntime='+JSON.stringify({desktop:true,token})+';');return;
   }
   if(desktop&&pathname==='/api/local-records'){
    if(req.headers.authorization!=='Bearer '+token){json(401,{error:'本机会话已失效，请刷新页面后重试。'});return;}
    if(req.headers.origin&&req.headers.origin!=='http://'+host){json(403,{error:'拒绝跨站访问'});return;}
    if(req.method==='GET'){
     try{json(200,read());}catch{json(500,{error:'本机数据文件无法读取，请保留原文件和备份，勿反复导入覆盖。'});}return;
    }
    if(req.method!=='PUT'){json(405,{error:'Method not allowed'});return;}
    if(req.headers.origin!=='http://'+host){json(403,{error:'拒绝跨站写入'});return;}
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>5000000){json(413,{error:'记录超过5MB，请先导出备份。'});return;}}
    let records;try{records=validate(JSON.parse(body));}catch{json(400,{error:'记录格式无效，未保存'});return;}
    let current;try{current=read();}catch{json(409,{error:'已有文件无法读取，已保护原文件，请先检查备份。'});return;}
    if(req.headers['if-match']!==current.revision){json(409,{error:'其他页面已更新记录，请刷新后再修改，避免覆盖。'});return;}
    fs.mkdirSync(path.dirname(dataFile),{recursive:true,mode:0o700});
    if(current.exists){
     if(!fs.existsSync(dataFile+'.migration.bak')&&JSON.parse(fs.readFileSync(dataFile,'utf8')).schemaVersion!==2)fs.copyFileSync(dataFile,dataFile+'.migration.bak');
     fs.copyFileSync(dataFile,dataFile+'.bak');
    }
    fs.writeFileSync(dataFile+'.tmp',JSON.stringify(records,null,2),{mode:0o600});fs.renameSync(dataFile+'.tmp',dataFile);
    json(200,read());return;
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
   if(pathname.split('/').some(segment=>segment.startsWith('.'))){res.writeHead(403);res.end();return;}
   const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
   if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
   res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
   res.end(req.method==='HEAD'?undefined:fs.readFileSync(file));
  }catch{if(!res.headersSent)json(500,{error:'本机保存失败，请检查磁盘空间和文件权限。'});else res.end();}
 });
}
function startDesktop(onListening){
 const port=Number(process.env.PORT)||3177;
 configureRuntime('desktop');
 const dataDir=resolvePaths().desktop;
 const server=createServer({dataFile:path.join(dataDir,'records.json'),requestLogger:logRequest});
 server.on('error',err=>{console.error('启动失败：'+err.message);process.exitCode=1});
 server.listen(port,'127.0.0.1',()=>{console.log('心晴手账：http://localhost:'+port+'\n自动保存目录：'+dataDir+'\n请保留此窗口；再次双击启动脚本会打开现有服务。');onListening?.();});
 return server;
}
if(require.main===module)startDesktop();
module.exports={createServer,startDesktop};

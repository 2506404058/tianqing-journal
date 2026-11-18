const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {fail,hash,body,appendJson}=require('./lib/io');
const {createAuth}=require('./lib/auth');
const {createSites}=require('./lib/sites');
const assets=new Map([['/','index.html'],['/app.js','app.js'],['/style.css','style.css']]);
function createManager({home,now=Date.now}={}){
 if(!home||!path.isAbsolute(home))throw Error('需要配置服务器根目录');
 const directory=path.join(home,'data','manager'),backups=path.join(home,'backups','manager'),logs=path.join(home,'logs');
 for(const folder of [directory,backups,logs])fs.mkdirSync(folder,{recursive:true,mode:0o700});
 const audit=(actor,action,extra={})=>appendJson(path.join(logs,'manager-audit.jsonl'),{at:new Date(now()).toISOString(),actor:actor?.username||'local-owner',action,...extra});
 const auth=createAuth(directory,{now,audit}),sites=createSites({home,directory,backups,audit});
 return http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cross-Origin-Resource-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  try{
   const host=req.headers.host||'',remote=req.socket.remoteAddress;
   if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)||! /^(localhost|127\.0\.0\.1):\d+$/.test(host))throw fail(403,'管理中心仅允许本机访问');
   const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   if(req.headers.origin&&req.headers.origin!=='http://'+host)throw fail(403,'拒绝跨站访问');
   if(req.headers['sec-fetch-site']==='cross-site')throw fail(403,'拒绝跨站访问');
   if(req.method!=='GET'&&(req.headers.origin!=='http://'+host||req.headers['x-manage-request']!=='1'))throw fail(403,'请从管理中心页面提交操作');
   if(route==='/health'&&req.method==='GET'){json(200,{app:'local-site-manager-v1',storageId:hash(path.resolve(home).toLowerCase())});return;}
   if(assets.has(route)){
    if(req.method!=='GET'){json(405,{error:'请求方式不支持'});return;}
    const name=assets.get(route);res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');res.end(fs.readFileSync(path.join(__dirname,'web',name)));return;
   }
   if(await auth.handle(req,res,route,json))return;
   if(!route.startsWith('/api/manage/'))throw fail(404,'页面不存在');
   const current=auth.requireAdmin(req),actor=current.user;
   if(route==='/api/manage/sites'){
    if(req.method==='GET'){json(200,{sites:sites.list()});return;}
    if(req.method==='POST'){json(201,{site:sites.save(await body(req),null,actor)});return;}
    throw fail(405,'请求方式不支持');
   }
   if(route==='/api/manage/audit'&&req.method==='GET'){
    const file=path.join(logs,'manager-audit.jsonl');let events=[];if(fs.existsSync(file))events=fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).slice(-100).map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(Boolean);json(200,{events:events.reverse()});return;
   }
   const match=route.match(/^\/api\/manage\/sites\/([a-zA-Z0-9-]+)(?:\/(health|backup|users)(?:\/([a-f0-9-]{36})(?:\/(status|signout|export))?)?)?$/);
   if(!match)throw fail(404,'接口不存在');
   const [,siteId,resource,userId,action]=match;
   if(!resource&&req.method==='PUT'){json(200,{site:sites.save(await body(req),siteId,actor)});return;}
   if(resource==='health'&&req.method==='GET'){json(200,await sites.health(siteId));return;}
   if(resource==='backup'&&req.method==='POST'){await body(req);json(200,sites.adapter(siteId).backupAll(actor));return;}
   if(resource==='users'){
    const adapter=sites.adapter(siteId);
    if(!userId&&req.method==='GET'){json(200,adapter.list());return;}
    if(userId&&!action&&req.method==='GET'){const detail=adapter.detail(userId);audit(actor,'user.view_records',{siteId,targetId:userId});json(200,detail);return;}
    if(action==='status'&&req.method==='POST'){const input=await body(req);if(typeof input.disabled!=='boolean')throw fail(400,'账号状态无效');json(200,{user:adapter.setDisabled(userId,input.disabled,actor)});return;}
    if(action==='signout'&&req.method==='POST'){await body(req);json(200,{user:adapter.revoke(userId,actor)});return;}
    if(action==='export'&&req.method==='GET'){const records=adapter.records(userId);adapter.detail(userId);audit(actor,'user.export',{siteId,targetId:userId});json(200,records);return;}
   }
   throw fail(405,'请求方式不支持');
  }catch(error){if(error.status===429)res.setHeader('Retry-After','900');if(!res.headersSent)json(error.status||500,{error:error.status?error.message:'操作未完成，请保留原数据并检查管理日志和文件权限'});else res.end();}
 });
}
module.exports={createManager};

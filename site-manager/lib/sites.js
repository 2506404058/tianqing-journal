const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http'),https=require('node:https');
const {fail,inside,readJson,writeJson}=require('./io');
const {createAdapter}=require('../adapters/tianqing');
function localHost(host){if(host==='localhost')return true;if(require('node:net').isIP(host)!==4)return false;const [a,b]=host.split('.').map(Number);return a===127||a===10||(a===192&&b===168)||(a===172&&b>=16&&b<=31);}
function createSites({home,directory,backups,audit}){
 const file=path.join(directory,'sites.json');
 const read=()=>fs.existsSync(file)?readJson(file,300000):{version:1,sites:[]};
 function validate(input,id){
  if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.length>60)throw fail(400,'网站名称需为1～60个字符');
  if(!['tianqing','link'].includes(input.adapter))throw fail(400,'请选择有效的网站接入方式');
  let url;try{url=new URL(input.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error();}catch{throw fail(400,'请输入http或https网址，不要包含账号密码');}
  let target=null;
  if(input.adapter==='tianqing'){
   if(!localHost(url.hostname)||url.pathname!=='/'||url.search||url.hash)throw fail(400,'心晴兼容接入请使用本机或私网IP的服务器根网址');
   if(typeof input.directory!=='string'||!path.isAbsolute(input.directory)||!fs.existsSync(input.directory))throw fail(400,'账号目录不存在，请填写绝对路径');
   target=fs.realpathSync(input.directory);if(!inside(fs.realpathSync(home),target)||inside(path.join(home,'data','manager'),target)||inside(directory,target))throw fail(403,'只能接入服务器根目录下的网站账号目录，不能接入管理中心自身数据');
   if(fs.existsSync(path.join(target,'users'))&&!fs.statSync(path.join(target,'users')).isDirectory())throw fail(400,'账号目录结构无效');
  }
  return {id:id||crypto.randomUUID(),name:input.name.trim(),url:url.href,adapter:input.adapter,directory:target,archived:input.archived===true};
 }
 function get(id){const site=read().sites.find(s=>s.id===id);if(!site)throw fail(404,'网站不存在');return site;}
 function list(){return read().sites.map(site=>{
  if(site.adapter==='link')return {...site,users:null,disabled:null,bytes:null};
  try{const summary=createAdapter(site,{home,backups,audit}).list();return {...site,users:summary.users.length,disabled:summary.users.filter(u=>u.disabled).length,bytes:summary.users.reduce((n,u)=>n+u.bytes,0),invalid:summary.invalid};}catch(error){return {...site,users:null,disabled:null,bytes:null,error:error.status?error.message:'账号目录暂时无法读取'};}
 });}
 function save(input,id,actor){const config=read(),site=validate(input,id);if(config.sites.length>=100&&!id)throw fail(400,'最多登记100个网站');if(id&&!config.sites.some(s=>s.id===id))throw fail(404,'网站不存在');if(site.directory&&config.sites.some(s=>s.id!==site.id&&s.directory===site.directory))throw fail(409,'这个账号目录已经接入，请编辑原网站');audit(actor,id?'site.update':'site.add',{siteId:site.id});const previous=config.sites.find(s=>s.id===id);config.sites=config.sites.filter(s=>s.id!==site.id);config.sites.push({...site,createdAt:previous?.createdAt||new Date().toISOString()});writeJson(file,config);return site;}
 function adapter(id){const site=get(id);if(site.adapter!=='tianqing')throw fail(400,'该网站目前仅登记入口，尚未接入用户管理');if(site.archived)throw fail(409,'请先恢复网站接入，再管理用户');return createAdapter(site,{home,backups,audit});}
 function health(id){const site=get(id);if(site.adapter!=='tianqing')return Promise.resolve({state:'link',message:'已登记入口，用户管理待接入'});if(!localHost(new URL(site.url).hostname))throw fail(400,'仅检查本机或私网IP服务');return new Promise(resolve=>{
  const url=new URL('/api/share-status',site.url),client=url.protocol==='https:'?https:http,req=client.get(url,{timeout:1800},res=>{let text='';res.on('data',c=>{if(text.length+c.length>4096){req.destroy();resolve({state:'error',message:'响应不符合预期'});}else text+=c;});res.on('end',()=>{try{const result=JSON.parse(text);resolve({state:res.statusCode===200&&result.app==='tianqing-share-v1'&&result.accounts?'online':'error',message:result.app==='tianqing-share-v1'?'心晴服务已响应':'非心晴账号服务'});}catch{resolve({state:'error',message:'服务返回内容无法识别'});}});res.on('error',()=>resolve({state:'error',message:'连接中断'}));});req.on('timeout',()=>req.destroy());req.on('error',()=>resolve({state:'offline',message:'暂时无法连接，请检查网站是否启动'}));
 });}
 return {get,list,save,adapter,health};
}
module.exports={createSites};

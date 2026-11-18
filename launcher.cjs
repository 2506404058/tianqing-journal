const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),https=require('node:https'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),readline=require('node:readline');
function siteSettings(home,environment=process.env){
 const site=environment.TIANQING_SITE_DIR||path.join(home,'心晴手账'),file=path.join(site,'server-location.json');
 let local={};if(fs.existsSync(file)){try{local=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw Error('心晴位置配置无法读取，请检查server-location.json');}}
 const port=Number(environment.TIANQING_SHARE_PORT||(local.sharePort??3000));
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('心晴端口配置无效');return {site,port};
}
function definitions(home,environment=process.env){
 const {site,port}=siteSettings(home,environment);
 const ip=Object.entries(os.networkInterfaces()).filter(([name])=>/zerotier/i.test(name)).flatMap(([,all])=>all||[]).find(a=>a.family==='IPv4')?.address;
 const chat=path.join(home,'开黑聊天室');
 return [
  {key:'1',name:'心晴网站',entry:path.join(site,'share-server.js'),cwd:site,url:ip?`http://${ip}:${port}`:null,endpoint:'/api/share-status',match:body=>{const value=JSON.parse(body);return value.app==='tianqing-share-v1'&&value.accounts===true&&value.storageId===crypto.createHash('sha256').update(path.resolve(home,'data','accounts').toLowerCase()).digest('hex');}},
  {key:'2',name:'开黑聊天室',entry:path.join(chat,'server.cjs'),cwd:chat,url:ip?`https://${ip}:3443`:null,endpoint:'/',caFile:path.join(chat,'certs','给朋友的证书.cer'),match:body=>body.includes('<title>同频 · 开黑聊天室</title>'),env:{PORT:'3443',HOST:ip||'',CHAT_HTTP:'0'}},
  {key:'3',name:'网站管理中心',entry:path.join(home,'site-manager','launch.js'),cwd:path.join(home,'site-manager'),url:`http://127.0.0.1:${environment.SITE_MANAGER_PORT||3190}`,endpoint:'/health',match:body=>{const value=JSON.parse(body);return value.app==='local-site-manager-v1'&&value.storageId===crypto.createHash('sha256').update(path.resolve(home).toLowerCase()).digest('hex');}}
 ];
}
function probe(service){return new Promise(resolve=>{
 if(!service.url)return resolve({state:'unavailable',text:'未找到ZeroTier IPv4'});
 let options={timeout:1800};try{if(service.caFile)options.ca=new crypto.X509Certificate(fs.readFileSync(service.caFile)).toString();}catch{return resolve({state:'unavailable',text:'聊天室证书缺失或无效'});}
 const url=new URL(service.endpoint,service.url);const req=(url.protocol==='https:'?https:http).get(url,options,res=>{let body='';res.on('data',chunk=>{body+=chunk;if(body.length>100000)req.destroy(Error('响应过大'));});res.on('end',()=>{try{resolve(res.statusCode===200&&service.match(body)?{state:'online',text:'正在运行'}:{state:'occupied',text:'端口响应不符合预期'});}catch{resolve({state:'occupied',text:'端口被其他服务占用'});}});res.on('error',()=>resolve({state:'occupied',text:'服务响应中断'}));});req.on('timeout',()=>req.destroy(Error('连接超时')));req.on('error',e=>resolve({state:e.code==='ECONNREFUSED'?'offline':'unknown',text:e.code==='ECONNREFUSED'?'未运行':'连接失败：'+e.message}));
});}
function createController({services,env=process.env,probeService=probe,write=console.log}){
 const owned=new Map();let closing=false;
 async function start(key){const service=services.find(s=>s.key===key);if(!service)throw Error('项目不存在');if(closing)return;if(owned.has(key)){write(service.name+' 已由本窗口启动，请勿重复启动。');return;}
  const state=await probeService(service);if(state.state==='online'){write(service.name+' 已在其他窗口运行，继续使用：'+service.url);return;}if(!['offline','unknown'].includes(state.state)){write(service.name+' 暂不启动：'+state.text);return;}if(state.state==='unknown')write(service.name+' 状态尚未确认，将尝试启动；如端口被占用，新进程会报错退出，已有服务不受影响。');
  if(!fs.existsSync(service.entry)){write('缺少入口：'+service.entry);return;}
  const child=spawn(process.execPath,[service.entry],{cwd:service.cwd,env:{...env,...service.env},stdio:['ignore','pipe','pipe'],windowsHide:true});owned.set(key,child);
  for(const pipe of [child.stdout,child.stderr]){const lines=readline.createInterface({input:pipe});lines.on('line',line=>write('['+service.name+'] '+line));}
  child.once('error',e=>write(service.name+' 启动失败：'+e.message));child.once('close',(code,signal)=>{if(owned.get(key)===child)owned.delete(key);write(service.name+' 进程已结束'+(code?'，退出码 '+code:''));});
  write('正在启动 '+service.name+'：'+service.url);
 }
 async function stop(key){const child=owned.get(key);if(!child){write('本窗口未持有该项目进程，不停止其他窗口的服务。');return;}await new Promise(resolve=>{child.once('close',resolve);try{if(!child.kill())resolve();}catch(e){write(e.message);resolve();}});}
 async function stopAll(){for(const key of [...owned.keys()])await stop(key);}
 async function status(){for(const s of services){const state=await probeService(s);write(s.name+'：'+state.text+(owned.has(s.key)?'（本窗口启动）':'')+' '+(s.url||''));}}
 return {start,stop,stopAll,status,owned,async close(){closing=true;await stopAll();}};
}
function menu(){console.log('\n════════════ 项目启动中心 ════════════\n  1  启动心晴网站        2  启动开黑聊天室\n  3  启动网站管理中心    4  一键启动全部\n  5  查看运行状态        6  停止本窗口全部项目\n  s1 / s2 / s3  停止指定项目\n  m  显示菜单           0  停止本窗口项目并退出\n────────────────────────────────────\n启动后窗口会持续显示各项目日志，还可以输入编号操作。\n其他窗口已经运行的项目会复用，不会由此窗口停止。');}
async function main({args=process.argv.slice(2)}={}){if(args.length&&!(args.length===1&&args[0]==='--status'))throw Error('支持菜单启动或 --status 检查');const home=__dirname,temp=path.join(home,'temp'),settings=siteSettings(home);fs.mkdirSync(temp,{recursive:true});const env={...process.env,TIANQING_SITE_DIR:settings.site,TIANQING_SHARE_PORT:String(settings.port),TIANQING_LAUNCHER_DIR:home,TIANQING_SERVER_HOME:home,TIANQING_ACCOUNTS_DIR:path.join(home,'data','accounts'),TIANQING_DATA_DIR:path.join(home,'data','desktop'),TEMP:temp,TMP:temp,TMPDIR:temp,NODE_COMPILE_CACHE:path.join(home,'cache','node'),NPM_CONFIG_CACHE:path.join(home,'cache','npm'),SITE_MANAGER_HOME:home,SITE_MANAGER_NO_BROWSER:'1',SITE_MANAGER_COMPACT:'1',TIANQING_MANAGER_URL:'http://localhost:'+(process.env.SITE_MANAGER_PORT||3190)};
 const controller=createController({services:definitions(home,env),env});if(args[0]==='--status'){await controller.status();return;}const input=readline.createInterface({input:process.stdin,output:process.stdout,terminal:Boolean(process.stdin.isTTY)});let exiting=false;
 async function exit(){if(exiting)return;exiting=true;input.close();await controller.close();}
 process.on('SIGINT',()=>void exit());process.on('SIGTERM',()=>void exit());menu();
 for await(const line of input){if(exiting)break;const command=line.trim().toLowerCase();try{if(['1','2','3'].includes(command))await controller.start(command);else if(command==='4'){for(const key of ['1','2','3'])await controller.start(key);}else if(command==='5')await controller.status();else if(command==='6')await controller.stopAll();else if(/^s[123]$/.test(command))await controller.stop(command.slice(1));else if(command==='m')menu();else if(command==='0'){await exit();break;}else if(command)console.log('请输入菜单中的编号，输入 m 可查看菜单。');}catch(e){console.error('操作失败：'+e.message);}if(!exiting)console.log('\n请输入编号（m 查看菜单）：');}
 await exit();
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={definitions,probe,createController,siteSettings,main};


const path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const {createManager}=require('./server'),{hash,appendJson}=require('./lib/io');
const home=path.resolve(process.env.SITE_MANAGER_HOME||path.join(__dirname,'..')),port=Number(process.env.SITE_MANAGER_PORT||3190);
for(const name of ['log','error']){const original=console[name].bind(console);console[name]=(...values)=>{appendJson(path.join(home,'logs','manager-runtime.jsonl'),{at:new Date().toISOString(),level:name,text:require('node:util').format(...values)});original(...values);};}
if(!Number.isInteger(port)||port<1||port>65535)throw Error('管理端口无效');
const address='http://localhost:'+port;
function open(){if(process.env.SITE_MANAGER_NO_BROWSER==='1')return;const browser=spawn('cmd.exe',['/d','/c','start','',address],{windowsHide:true,stdio:'ignore'});browser.on('error',()=>console.log('请打开 '+address));browser.unref();}
let decided=false;
function start(){
 if(decided)return;decided=true;
 const server=createManager({home});server.on('error',error=>{console.error('管理中心启动失败：'+error.message);process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>{if(process.env.SITE_MANAGER_COMPACT==='1')console.log('✓ 管理后台已启动：'+address+'（仅本机）');else console.log('\n站点管家 · 本机网站管理中心\n打开：'+address+'\n仅监听127.0.0.1，不对ZeroTier或局域网开放。\n首次打开请自行设置独立的管理员账号。\n管理配置：'+path.join(home,'data','manager')+'\n用户数据：保留各网站原目录，管理操作先备份并记录审计。\n按Ctrl+C停止管理中心，不影响网站服务。');open();});
}
const req=http.get('http://127.0.0.1:'+port+'/health',{timeout:1200},res=>{let text='';res.on('data',c=>{if(text.length<4096)text+=c;});res.on('end',()=>{if(decided)return;try{const value=JSON.parse(text);if(value.app==='local-site-manager-v1'&&value.storageId===hash(home.toLowerCase())){decided=true;console.log('管理中心已在运行：'+address);open();return;}}catch{}decided=true;console.error('端口已被其他程序占用，请检查 '+port);process.exitCode=1;});});req.on('timeout',()=>req.destroy());req.on('error',start);

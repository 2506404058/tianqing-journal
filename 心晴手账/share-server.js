const os=require('node:os');
const {createServer}=require('./server');
const {resolvePaths,storageFingerprint}=require('./server-paths');
const {configureRuntime}=require('./server-runtime');
const {logRequest}=require('./access-log');
const {sharePort,inspectFiles,checksText,heading,readyPanel,queryStatus}=require('./startup-panel');
const {version}=require('./package.json');
function findZeroTierAddress(interfaces=os.networkInterfaces(),requested=process.env.TIANQING_SHARE_HOST){
 const choices=Object.entries(interfaces).filter(([name])=>/zerotier/i.test(name)).flatMap(([name,addresses])=>(addresses||[]).filter(a=>a.family==='IPv4'&&!a.internal).map(a=>({name,address:a.address,netmask:a.netmask})));
 const match=requested?choices.filter(a=>a.address===requested):choices;
 if(match.length!==1)throw Error(match.length?'发现多个ZeroTier地址，请设置 TIANQING_SHARE_HOST 选择一个。':'没有可用的ZeroTier地址。请先连接并授权你的ZeroTier网络。');
 return match[0];
}
function accountDirectory(){return resolvePaths().accounts;}
function createShareServer(address,options={}){return createServer({allowedHosts:[address],sharing:true,accountsDirectory:accountDirectory(),...options});}
async function startShare(){
 console.log(heading('情绪天气 · 日程安排 · 一句话生成 · 个人中心',{version}));
 console.log('\n 准备检查');
 const checks=inspectFiles();console.log(checksText(checks));
 if(checks.some(check=>!check.ok)){console.error('\n 启动取消：请补齐项目文件或更新Node.js，再运行启动脚本。');process.exitCode=1;return;}
 let selected,port;
 try{selected=findZeroTierAddress();port=sharePort();}
 catch(error){console.error('\n ✗ '+error.message);process.exitCode=1;return;}
 console.log(checksText([{ok:true,label:'ZeroTier网卡',detail:selected.name+' · '+selected.address}]));
 const url=`http://${selected.address}:${port}`,status=await queryStatus(url,{timeout:1200});
 if(status.reachable){
  if(!status.compatible){console.error('\n ✗ 分享端口被其他程序占用：'+url+'\n   请检查占用程序，或设置 TIANQING_SHARE_PORT 选择其他端口。');process.exitCode=1;return;}
  if(!status.accounts){console.error('\n ✗ 旧分享服务仍在运行。请关闭原启动窗口后重新运行，以启用登录。');process.exitCode=1;return;}
  if(status.storageId!==storageFingerprint(accountDirectory())){console.error('\n ✗ 正在运行的服务使用了其他或旧版保存配置。请先停止原服务，再用当前入口启动，避免继续向旧目录保存。');process.exitCode=1;return;}
  console.log(readyPanel({address:selected.address,port,directory:accountDirectory(),reused:true}));return;
 }
 const server=createShareServer(selected.address,{requestLogger:logRequest});
 server.on('error',error=>{console.error('\n ✗ 分享服务启动失败：'+error.message+'\n   可运行 npm run doctor 查看环境与连接状态。');process.exitCode=1;});
 server.listen(port,selected.address,()=>console.log(readyPanel({address:selected.address,port,directory:accountDirectory()})));
}
if(require.main===module){
 try{configureRuntime();startShare().catch(error=>{console.error('启动失败：'+error.message);process.exitCode=1;});}
 catch(error){process.stderr.write('启动失败：'+error.message+'\n');process.exitCode=1;}
}
module.exports={findZeroTierAddress,createShareServer};

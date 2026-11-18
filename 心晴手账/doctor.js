// Read-only diagnostics: never writes account records or firewall rules.
const {findZeroTierAddress}=require('./share-server');
const {sharePort,inspectFiles,checksText,heading,queryStatus}=require('./startup-panel');
const {version}=require('./package.json');
const {resolvePaths,storageFingerprint}=require('./server-paths');
async function diagnose(){
 console.log(heading('环境与连接检查 · 只读，不修改防火墙或个人数据',{version}));
 const checks=inspectFiles(),locations=resolvePaths();let selected,port;
 console.log('\n 服务器目录：'+locations.home+'\n 账号保存：'+locations.accounts+'\n 运行日志：'+locations.logs+'\n 临时文件：'+locations.temp);
 try{selected=findZeroTierAddress();checks.push({ok:true,label:'ZeroTier网卡',detail:selected.name+' · '+selected.address});}
 catch(error){checks.push({ok:false,label:'ZeroTier网卡',detail:error.message});}
 try{port=sharePort();checks.push({ok:true,label:'分享端口',detail:String(port)});}
 catch(error){checks.push({ok:false,label:'分享端口',detail:error.message});}
 console.log('\n'+checksText(checks));
 if(!selected||!port){console.log('\n 请先修复上方检查项，再启动分享服务。');process.exitCode=1;return;}
 const url=`http://${selected.address}:${port}`,status=await queryStatus(url);
 const ok=status.compatible&&status.accounts&&status.storageId===storageFingerprint(locations.accounts);
 console.log('\n'+checksText([{ok,label:'服务连通',detail:ok?url+' · 心晴账号服务响应正常':status.reachable?url+' · 不是当前心晴账号服务，请检查端口占用或旧进程':url+' · 暂时无法连接（'+(status.error||'无响应')+'）'}]));
 console.log('\n 本机服务'+(ok?'可以访问。':'未确认可用，请先运行启动脚本。'));
 console.log(' 朋友访问：'+url+'\n 朋友仍需加入同一ZeroTier网络并获授权。\n 此检查不代表朋友端已连通，也不检查或更改Windows防火墙规则。');
 if(!ok||checks.some(check=>!check.ok))process.exitCode=1;
}
if(require.main===module)diagnose().catch(error=>{console.error('检查失败：'+error.message);process.exitCode=1;});
module.exports={diagnose};

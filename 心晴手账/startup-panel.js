const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const line='─'.repeat(64);
function style(value,code,color){return color?'\x1b['+code+'m'+value+'\x1b[0m':value;}
function useColor(){return Boolean(process.stdout.isTTY&&!process.env.NO_COLOR);}
function sharePort(value=process.env.TIANQING_SHARE_PORT,{projectRoot=__dirname}={}){
 let configured;
 if(value===undefined||value===''){
  const file=path.join(projectRoot,'server-location.json');
  if(fs.existsSync(file)){try{configured=JSON.parse(fs.readFileSync(file,'utf8')).sharePort;}catch{throw Error('分享端口配置无法读取，请检查server-location.json');}}
 }
 const port=Number(value===undefined||value===''?(configured??3180):value);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('分享端口必须是1～65535之间的整数，请检查 TIANQING_SHARE_PORT。');
 return port;
}
function inspectFiles(root=__dirname){
 const files=['index.html','style.css','app.js','parser.js','storage.js','runtime.js','data-store.js','auth.js','profile.js','daily-quote.js','breathing.js','images.js','weather-analysis.js'];
 const readable=file=>{try{fs.accessSync(file,fs.constants.R_OK);return fs.statSync(file).isFile();}catch{return false;}};
 const missing=files.filter(file=>!readable(path.join(root,'public',file)));
 return [
  {ok:Number(process.versions.node.split('.')[0])>=20,label:'Node.js',detail:process.version+'（要求20或更新版本）'},
  {ok:missing.length===0,label:'网页资源',detail:missing.length?'缺少或无法读取：'+missing.join('、'):'public/ · '+files.length+'项完整'},
  {ok:['accounts.js','server.js','share-server.js'].every(file=>readable(path.join(root,file))),label:'账号服务',detail:'独立账号、心情日程、照片、个人中心'},
  {ok:true,label:'运行依赖',detail:'仅使用Node.js内置模块，无需npm install'}
 ];
}
function checksText(checks,{color=useColor()}={}){
 return checks.map(check=>{const width=[...check.label].reduce((sum,c)=>sum+(c.codePointAt(0)>255?2:1),0);return ' '+style(check.ok?'✓':'✗',check.ok?'32':'31',color)+' '+check.label+' '.repeat(Math.max(1,15-width))+check.detail;}).join('\n');
}
function heading(title,{version,color=useColor()}={}){
 const suffix=version?' · v'+version:'';
 return '\n'+style(line,'90',color)+'\n '+style('心晴手账 · TIANQING JOURNAL'+suffix,'1;32',color)+'\n '+title+'\n'+style(line,'90',color);
}
function diagnosticHint(){return process.env.TIANQING_LAUNCHER_DIR?path.join(process.env.TIANQING_LAUNCHER_DIR,'doctor.cmd'):'npm run doctor';}
function readyPanel({address,port,directory,reused=false,color=useColor()}){
 const url=`http://${address}:${port}`,blue=value=>style(value,'36',color);
 return [
  '',line,
  ' '+style('✓ 服务器'+(reused?'已在运行 · 复用现有服务':'已启动'),'1;32',color),
  ' 本机打开：  '+blue(url),
  ' 发给朋友：  '+blue(url)+'  （ZeroTier）',
  ' 个人中心：  '+blue(url+'/#profile'),
  ...(process.env.TIANQING_MANAGER_URL?[' 管理后台：  '+blue(process.env.TIANQING_MANAGER_URL)+'  （仅本机，管理员专用）']:[]),
  '',
  ' 账号与数据',
  '   每人独立注册；心情、日程、照片按账号保存。',
  directory?'   保存位置：'+directory:'   保存位置：沿用原服务配置，未读取个人记录。',
  '   原本机/浏览器日记不自动导入。',
  '',
  ' 访问说明',
  '   双方加入同一个ZeroTier网络并获得授权；本机也使用上面的地址。',
  '   本机能打开不代表朋友已连通；当前是HTTP私有网络网址。',
  '',
  ' 故障检查：  '+diagnosticHint(),
  '   检查环境与本机连接，不修改防火墙或记录。',
  process.env.TIANQING_MANAGER_URL?' 按Ctrl+C停止本窗口新启动的服务；复用的已有服务继续运行。':reused?' 复用窗口可直接关闭；停止服务需到原启动窗口按Ctrl+C。':' 请保持电脑及此窗口运行；按Ctrl+C可停止服务。',
  line
 ].join('\n');
}
function queryStatus(url,{timeout=1800}={}){
 return new Promise(resolve=>{
  const req=http.get(url+'/api/share-status',{timeout},res=>{
   let body='';res.on('data',chunk=>{if(body.length+chunk.length>4096){req.destroy(Error('响应内容过长'));return;}body+=chunk;});
   res.on('end',()=>{try{const status=JSON.parse(body);resolve({reachable:true,compatible:res.statusCode===200&&status.app==='tianqing-share-v1',accounts:status.accounts===true,storageId:status.storageId,status:res.statusCode});}catch{resolve({reachable:true,compatible:false,status:res.statusCode});}});
   res.on('error',error=>resolve({reachable:false,error:error.code||error.message}));
  });
  req.on('timeout',()=>req.destroy(Object.assign(Error('请求超时'),{code:'ETIMEDOUT'})));
  req.on('error',error=>resolve({reachable:false,error:error.code||error.message}));
 });
}
module.exports={sharePort,inspectFiles,checksText,heading,readyPanel,queryStatus,useColor};

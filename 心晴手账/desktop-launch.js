const http=require('node:http');
const {spawn}=require('node:child_process');
const {startDesktop}=require('./server');
const path=require('node:path');
const {resolvePaths,storageFingerprint}=require('./server-paths');
const port=Number(process.env.PORT)||3177;
const address='http://localhost:'+port;
function open(){
 const child=spawn('cmd.exe',['/d','/c','start','',address],{windowsHide:true,stdio:'ignore'});
 child.on('error',()=>console.log('请在浏览器打开 '+address));
 child.unref();
}
let decided=false;
function start(){if(decided)return;decided=true;startDesktop(open);}
const req=http.get('http://127.0.0.1:'+port+'/api/desktop-status',{timeout:1000},res=>{
 let text='';res.on('data',chunk=>{if(text.length<1000)text+=chunk});
 res.on('end',()=>{if(decided)return;
  try{const status=JSON.parse(text);if(res.statusCode===200&&status.app==='tianqing-desktop-v1'){
   if(status.storageId!==storageFingerprint(path.join(resolvePaths().desktop,'records.json'))){console.error('已有本机服务仍使用旧保存目录，请先停止旧服务再启动。');process.exitCode=1;decided=true;return;}
   decided=true;open();return;
  }}catch{}
  console.error('端口 '+port+' 已被其他程序或旧版服务占用，请关闭旧服务后重试。');process.exitCode=1;decided=true;
 });
});
req.on('timeout',()=>req.destroy());req.on('error',start);

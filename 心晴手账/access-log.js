const {performance}=require('node:perf_hooks');
const formatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
// Never include headers, query parameters or request/response bodies in access logs.
function requestPath(value){
 try{return new URL(value,'http://localhost').pathname.replace(/[\u0000-\u001f\u007f-\u009f]/g,'').slice(0,200);}catch{return '[无效路径]';}
}
function logRequest(req,res,{write=line=>console.log(line),now=()=>new Date()}={}){
 const started=performance.now(),pathname=requestPath(req.url);
 const address=(req.socket.remoteAddress||'未知IP').replace(/^::ffff:/,'');
 const method=String(req.method||'UNKNOWN').replace(/[^A-Z]/g,'').slice(0,20);
 let logged=false;
 const log=()=>{
  if(logged)return;logged=true;
  const status=res.writableFinished?res.statusCode:'已中断';
  const line=`[访问] ${formatter.format(now())} ${address} ${method} ${pathname} ${status} ${Math.max(0,Math.round(performance.now()-started))}ms`;
  // A full disk or closed console must not turn a completed request into a crash.
  try{write(line);}catch{}
 };
 res.once('finish',log);res.once('close',log);
}
module.exports={logRequest,requestPath};

const http=require('node:http'),https=require('node:https'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function createApp({accountsModule=path.join(process.env.TIANQING_SITE_DIR||path.join(__dirname,'..','心晴手账'),'accounts.js'),accountsDirectory=process.env.TIANQING_ACCOUNTS_DIR||path.join(__dirname,'..','data','accounts'),preview=process.env.CHAT_HTTP==='1'}={}){
 const {createAccounts}=require(accountsModule);
 const accounts=createAccounts({directory:accountsDirectory,originProtocol:preview?'http':'https',cookieName:'squad_account_session',secureCookie:!preview,authOnly:true});
 function valid(c){const current=accounts.session({headers:{cookie:c.authCookie}});return current?.user.id===c.accountId?current:null;}
 const clients=new Map(),rooms=new Map();
 const send=(c,type,data)=>{if(c.stream&&!c.stream.destroyed)c.stream.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);};
 const members=r=>[...r].map(id=>{const c=clients.get(id);return {id,name:c.name,voice:c.voice,muted:c.muted};});
 const broadcast=(room,type,data)=>{for(const id of rooms.get(room)||[])send(clients.get(id),type,data);};
 const roster=room=>broadcast(room,'members',members(rooms.get(room)||new Set()));
 function remove(id){const c=clients.get(id);if(!c)return;c.stream?.end();clients.delete(id);const r=rooms.get(c.room);r?.delete(id);if(r?.size){broadcast(c.room,'left',{id,name:c.name});roster(c.room);}else rooms.delete(c.room);}
 async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'");
  const pathname=new URL(req.url,'http://localhost').pathname;
  res.on('finish',()=>console.log(new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}),req.socket.remoteAddress,req.method,pathname,res.statusCode));
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  try{
   const expected=(req.socket.encrypted?'https':'http')+'://'+req.headers.host;
   if(pathname.startsWith('/api/auth/')){if(await accounts.handle(req,res,pathname,req.headers.host))return;return json(404,{error:'接口不存在'});}
   if(req.method==='POST'&&(req.headers.origin!==expected||req.headers['x-chat-request']!=='1'))return json(403,{error:'请从本站页面操作'});
   const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('squad='))?.slice(6),c=[...clients.values()].find(user=>user.token===token);
   const current=accounts.session(req);
   if((req.method==='POST'||pathname==='/events')&&!current){if(c)remove(c.id);return json(401,{error:'请先使用心晴账号登录'});}
   if(c&&current&&c.accountId!==current.user.id){remove(c.id);return json(409,{error:'账号已切换，请重新加入房间'});}
   if(req.method==='GET'&&pathname==='/events'){
    if(!c)return json(401,{error:'请先加入房间'});
    c.stream?.end();res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});res.write(': connected\n\n');c.stream=res;c.seen=Date.now();send(c,'ready',{id:c.id});roster(c.room);req.on('close',()=>{if(c.stream===res){c.stream=null;c.seen=Date.now();}});return;
   }
   if(req.method==='POST'){
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>32768)return json(413,{error:'请求过大'});}const b=JSON.parse(raw||'{}');
    if(pathname==='/join'){
     if(typeof b.room!=='string'||! /^[a-zA-Z0-9-]{4,40}$/.test(b.room))return json(400,{error:'房间码为4～40位字母、数字或短横线'});
     if(clients.size>=128)return json(503,{error:'服务器人数已满'});
     if((rooms.get(b.room)?.size||0)>=8)return json(409,{error:'房间最多8人'});
     if(c)remove(c.id);const id=crypto.randomBytes(12).toString('hex'),session=crypto.randomBytes(24).toString('hex');const user={id,token:session,name:current.user.displayName||current.user.username,accountId:current.user.id,authCookie:req.headers.cookie,room:b.room,voice:false,muted:true,seen:Date.now(),window:0,count:0};clients.set(id,user);if(!rooms.has(b.room))rooms.set(b.room,new Set());rooms.get(b.room).add(id);
     res.setHeader('Set-Cookie',`squad=${session}; HttpOnly; SameSite=Strict; Path=/${req.socket.encrypted?'; Secure':''}`);json(200,{id,room:b.room});roster(b.room);return;
    }
    if(!c)return json(401,{error:'连接已过期，请重新加入'});c.seen=Date.now();if(Date.now()-c.window>10000){c.window=Date.now();c.count=0;}if(++c.count>250)return json(429,{error:'操作太快，请稍后再试'});
    if(pathname==='/message'){if(typeof b.text!=='string'||!b.text.trim()||b.text.length>2000)return json(400,{error:'消息需为1～2000字'});broadcast(c.room,'message',{name:c.name,text:b.text.trim(),time:Date.now(),id:c.id});}
    else if(pathname==='/state'){c.voice=b.voice===true;c.muted=b.muted!==false;roster(c.room);}
    else if(pathname==='/signal'){const target=clients.get(b.to);if(!target||target.room!==c.room||!b.signal||typeof b.signal!=='object')return json(400,{error:'目标已离开'});send(target,'signal',{from:c.id,signal:b.signal});}
    else if(pathname==='/leave'){remove(c.id);}
    else if(pathname!=='/heartbeat')return json(404,{error:'接口不存在'});
    return json(200,{ok:true});
   }
   const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};if(req.method==='GET'&&files[pathname]){res.writeHead(200,{'Content-Type':pathname.endsWith('.js')?'text/javascript; charset=utf-8':pathname.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'});return res.end(fs.readFileSync(path.join(__dirname,'public',files[pathname])));}
   json(404,{error:'页面不存在'});
  }catch(e){json(e.status||500,{error:e.status?e.message:'服务暂时不可用，请稍后重试'});}
 }
 const timer=setInterval(()=>{for(const [id,c]of clients){try{const current=valid(c);if(!current||Date.now()-c.seen>45000){if(!current)send(c,'auth-expired',{});remove(id);}else{c.name=current.user.displayName||current.user.username;if(c.stream)c.stream.write(': ping\n\n');}}catch{send(c,'auth-expired',{});remove(id);}}},10000);timer.unref();
 return {handler,close(){clearInterval(timer);for(const id of [...clients.keys()])remove(id);}};
}
if(require.main===module){const app=createApp(),port=Number(process.env.PORT||3443),pfx=path.join(__dirname,'certs','server.pfx');const preview=process.env.CHAT_HTTP==='1';if(!preview&&!fs.existsSync(pfx)){console.error('请先运行：pwsh -File .\\生成证书.ps1 -Address 你的ZeroTierIP');process.exit(1);}const server=preview?http.createServer(app.handler):https.createServer({pfx:fs.readFileSync(pfx),passphrase:''},app.handler);server.on('error',e=>{console.error(e.message);process.exitCode=1;});const address=process.env.HOST||(preview?'127.0.0.1':Object.entries(require('node:os').networkInterfaces()).filter(([name])=>/zerotier/i.test(name)).flatMap(([,list])=>list||[]).find(a=>a.family==='IPv4')?.address);if(!address){console.error('未找到ZeroTier IPv4，请先连接ZeroTier。');process.exit(1);}server.listen(port,address,()=>console.log(`开黑聊天室已启动：${preview?'http':'https'}://${address}:${port}\n朋友请使用服务器的ZeroTier IP。按 Ctrl+C 停止。`));}
module.exports={createApp};



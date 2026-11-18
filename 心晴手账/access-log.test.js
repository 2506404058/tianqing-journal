const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),{EventEmitter}=require('node:events');
const {logRequest,requestPath}=require('./access-log'),{createServer}=require('./server');
test('访问日志显示真实来源、路径和状态，忽略查询参数、Cookie、正文和伪造转发IP',async()=>{
 const lines=[],server=createServer({requestLogger:(req,res)=>logRequest(req,res,{write:line=>lines.push(line),now:()=>new Date('2026-11-18T08:00:00Z')})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const request=(url,method='GET')=>new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port:server.address().port,path:url,method,headers:{Cookie:'session=cookie-secret','X-Forwarded-For':'10.1.2.3','Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end(method==='POST'?JSON.stringify({password:'body-secret',note:'journal-secret'}):undefined);
 });
 try{
  assert.equal(await request('/?token=query-secret'),200);
  assert.equal(await request('/missing-page'),404);
  assert.equal(await request('/api/auth/login?password=query-password','POST'),405);
  assert.equal(lines.length,3);assert.match(lines[0],/^\[访问\] 2026-11-18 16:00:00 127\.0\.0\.1 GET \/ 200 \d+ms$/);
  assert.match(lines[1],/GET \/missing-page 404/);assert.match(lines[2],/POST \/api\/auth\/login 405/);
  assert.doesNotMatch(lines.join('\n'),/query-secret|query-password|body-secret|journal-secret|cookie-secret|10\.1\.2\.3/);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('中断的请求只记一次，日志输出失败不会中断服务',()=>{
 const req={url:'/index.html',method:'GET',socket:{remoteAddress:'::ffff:127.0.0.1'}},res=new EventEmitter(),lines=[];
 res.writableFinished=false;logRequest(req,res,{write:line=>lines.push(line)});res.emit('close');res.emit('finish');assert.equal(lines.length,1);assert.match(lines[0],/127\.0\.0\.1 GET \/index.html 已中断/);
 const broken=new EventEmitter();broken.writableFinished=true;broken.statusCode=200;logRequest(req,broken,{write:()=>{throw Error('disk full');}});assert.doesNotThrow(()=>broken.emit('finish'));
});
test('日志路径不包含查询参数、片段或终端控制字符，过长和无效路径有界',()=>{
 assert.equal(requestPath('/index.html?password=secret#private'),'/index.html');assert.equal(requestPath('/%1B%5B31m'), '/%1B%5B31m');assert.doesNotMatch(requestPath('/\u001b[31m\n'),/[\u0000-\u001f]/);assert.equal(requestPath('/'+'a'.repeat(1000)).length,200);assert.equal(requestPath('http://['),'[无效路径]');
});

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const heartModule=fs.existsSync(path.resolve(__dirname,'../heart/accounts.js'))?path.resolve(__dirname,'../heart/accounts.js'):path.join(process.env.TIANQING_SITE_DIR||path.join(__dirname,'..','心晴手账'),'accounts.js');
const {createApp}=require('./server.cjs');const {createAccounts}=require(heartModule);
test('shared accounts work in both directions while sessions and journal records stay isolated',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'shared-squad-auth-'));const heart=createAccounts({directory});
 const hs=http.createServer(async(req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;if(!await heart.handle(req,res,pathname,req.headers.host)){res.writeHead(404);res.end();}});
 const app=createApp({accountsModule:heartModule,accountsDirectory:directory,preview:true});const cs=http.createServer(app.handler);
 await new Promise(r=>hs.listen(0,'127.0.0.1',r));await new Promise(r=>cs.listen(0,'127.0.0.1',r));const hb='http://127.0.0.1:'+hs.address().port,cb='http://127.0.0.1:'+cs.address().port,secret='only a test passphrase';
 async function call(base,route,{cookie='',body,auth,method=body?'POST':'GET',origin=base}={}){const r=await fetch(base+route,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-Tianqing-Request':'1','X-Chat-Request':'1','X-Tianqing-Account':auth?.user.id||'','X-Tianqing-CSRF':auth?.csrf||''},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 try{
  assert.equal((await call(cb,'/join',{body:{room:'test-room'}})).status,401);
  const ha=await call(hb,'/api/auth/register',{body:{username:'Alice',password:secret}});assert.equal(ha.status,201);
  const ca=await call(cb,'/api/auth/login',{body:{username:'Alice',password:secret,rememberMe:true}});assert.equal(ca.status,200);assert.equal(ca.body.user.id,ha.body.user.id);assert.match(ca.cookie,/^squad_account_session=/);assert.match(ha.cookie,/^tianqing_session=/);
  assert.equal((await call(cb,'/api/auth/session',{cookie:ha.cookie})).body.user,null);
  assert.equal((await call(cb,'/api/auth/login',{body:{username:'Alice',password:secret},origin:'https://attacker.invalid'})).status,403);
  assert.equal((await call(cb,'/api/auth/login',{body:{username:'Alice',password:'wrong test password'}})).status,401);
  const profile={displayName:'小晴队友',bio:'private profile',avatar:'🌿'};assert.equal((await call(hb,'/api/auth/profile',{method:'PUT',cookie:ha.cookie,auth:ha.body,body:profile})).status,200);
  const session=await call(cb,'/api/auth/session',{cookie:ca.cookie});assert.equal(session.body.user.displayName,profile.displayName);
  const join=await call(cb,'/join',{cookie:ca.cookie,body:{room:'test-room',name:'spoofed-name'}});assert.equal(join.status,200);const both=ca.cookie+'; '+join.cookie;
  const abort=new AbortController();const eventResponse=await fetch(cb+'/events',{headers:{Cookie:both},signal:abort.signal});const reader=eventResponse.body.getReader();const first=new TextDecoder().decode((await reader.read()).value);assert.match(first,/小晴队友/);assert.ok(!first.includes('spoofed-name'));assert.ok(!first.includes('csrf'));assert.ok(!first.includes('squad_account_session'));abort.abort();
  assert.equal((await call(cb,'/message',{cookie:both,body:{text:'hello'}})).status,200);
  assert.equal((await call(cb,'/api/account-records',{cookie:both})).status,404);assert.equal((await call(cb,'/api/auth/profile',{cookie:both})).status,404);
  const cbReg=await call(cb,'/api/auth/register',{body:{username:'Bob',password:secret}});assert.equal(cbReg.status,201);const hbLogin=await call(hb,'/api/auth/login',{body:{username:'Bob',password:secret}});assert.equal(hbLogin.status,200);assert.equal(hbLogin.body.user.id,cbReg.body.user.id);
  const hj=await call(hb,'/api/auth/password',{cookie:ha.cookie,auth:ha.body,body:{currentPassword:secret,newPassword:'a replacement test passphrase'}});assert.equal(hj.status,200);assert.equal((await call(cb,'/api/auth/session',{cookie:ca.cookie})).body.user,null);
  const ca2=await call(cb,'/api/auth/login',{body:{username:'Alice',password:'a replacement test passphrase'}});assert.equal(ca2.status,200);const join2=await call(cb,'/join',{cookie:ca2.cookie,body:{room:'test-room'}});assert.equal(join2.status,200);const both2=ca2.cookie+'; '+join2.cookie;
  const users=path.join(directory,'users'),file=fs.readdirSync(users).map(n=>path.join(users,n)).find(f=>JSON.parse(fs.readFileSync(f)).username==='Alice');const user=JSON.parse(fs.readFileSync(file));user.disabled=true;user.authVersion=(user.authVersion||0)+1;fs.writeFileSync(file,JSON.stringify(user));
  assert.equal((await call(cb,'/heartbeat',{cookie:both2,body:{}})).status,401);assert.equal((await call(hb,'/api/auth/session',{cookie:hj.cookie})).body.user,null);
  assert.equal((await call(cb,'/api/auth/logout',{cookie:cbReg.cookie,auth:cbReg.body,body:{}})).status,200);assert.equal((await call(cb,'/api/auth/session',{cookie:cbReg.cookie})).body.user,null);assert.ok((await call(hb,'/api/auth/session',{cookie:hbLogin.cookie})).body.user);
 }finally{app.close();hs.closeAllConnections();cs.closeAllConnections();await Promise.all([new Promise(r=>hs.close(r)),new Promise(r=>cs.close(r))]);fs.rmSync(directory,{recursive:true,force:true});}
});

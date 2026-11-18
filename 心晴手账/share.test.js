const {test}=require('node:test'),assert=require('node:assert/strict');
const {findZeroTierAddress,createShareServer}=require('./share-server');
const {createServer}=require('./server');
// Use node:http so the test can explicitly exercise the Host allowlist;
// fetch may replace the custom Host header with the connection destination.
function fetch(url,{method='GET',headers={},body}={}){
 return new Promise((resolve,reject)=>{
  const request=require('node:http').request(url,{method,headers},response=>{
   let data='';response.on('data',chunk=>data+=chunk);response.on('end',()=>resolve({status:response.statusCode,text:async()=>data,json:async()=>JSON.parse(data)}));
  });request.on('error',reject);request.end(body);
 });
}
test('分享服务只使用ZeroTier虚拟IPv4，拒绝普通网卡和任意监听地址',()=>{
 const interfaces={'Ethernet':[{family:'IPv4',address:'192.168.1.10',internal:false}],'ZeroTier One [test]':[{family:'IPv4',address:'10.77.0.2',netmask:'255.255.255.0',internal:false}]};
 assert.equal(findZeroTierAddress(interfaces).address,'10.77.0.2');assert.throws(()=>findZeroTierAddress(interfaces,'0.0.0.0'));assert.throws(()=>findZeroTierAddress({Ethernet:interfaces.Ethernet}));
 assert.throws(()=>createServer({sharing:true,dataFile:'private-records.json'}),/不能同时启用/);
});
test('朋友分享模式没有本机数据接口、令牌或私有文件，且限制Host',async()=>{
 const address='10.77.0.2',server=createShareServer(address);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,headers={Host:address+':3180'};
 try{
  assert.equal((await fetch(base+'/',{headers})).status,200);
  assert.equal((await fetch(base+'/',{headers:{Host:'untrusted.example'}})).status,403);
  const runtime=await (await fetch(base+'/runtime.js',{headers})).text();assert.match(runtime,/desktop:false/);assert.doesNotMatch(runtime,/token\s*:/);
  for(const route of ['/api/local-records','/api/data','/api/desktop-status','/data/records.json','/server.js','/share-server.js','/server.log','/.git/config','/../records.json'])assert.notEqual((await fetch(base+route,{headers})).status,200,route);
  assert.equal((await fetch(base+'/api/local-records',{method:'PUT',headers,body:'{}'})).status,405);
  assert.equal((await (await fetch(base+'/api/share-status',{headers})).json()).app,'tianqing-share-v1');
 }finally{await new Promise(r=>server.close(r));}
});

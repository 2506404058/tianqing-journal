(function(global){
 let revision='none';
 const desktop=global.TianqingRuntime?.desktop===true;
 const accounts=global.TianqingRuntime?.accounts===true;
 async function request(method,records){
  const accountId=accounts?global.TianqingAuth?.user?.id:null;
  if(accounts&&!accountId)throw Error('请先登录再读取或保存记录');
  const headers=accounts?global.TianqingAuth.headers():{Authorization:'Bearer '+global.TianqingRuntime.token};
  if(method==='PUT'){headers['Content-Type']='application/json';headers['If-Match']=revision;}
  let response;
  try{response=await fetch(accounts?'./api/account-records':'./api/local-records',{method,headers,credentials:'same-origin',body:method==='PUT'?JSON.stringify(records):undefined,cache:'no-store'});}
  catch{throw Error(accounts?'无法连接账号服务，请检查ZeroTier网络及服务器是否运行。':'无法连接本机服务，请重新运行启动脚本。');}
  const body=await response.json();
  if(accounts&&response.status===401)global.TianqingAuth.expire();
  if(!response.ok)throw Error(body.error||'本机数据读取或保存失败');
  if(accounts&&global.TianqingAuth.user?.id!==accountId)throw Error('当前账号已切换，请刷新页面后重试');
  revision=body.revision;
  return body;
 }
 const store={
  desktop,
  accounts,
  reset(){revision='none';},
  async load(){
   if(!desktop&&!accounts)return TianqingStorage.create(localStorage).load();
   const saved=await request('GET');
   if(saved.exists)return TianqingStorage.validate(saved.records);
   if(accounts)return TianqingStorage.validate({moods:[],tasks:[]});
   // Migrate this browser's existing records once, without removing its copy.
   let previous;
   try{previous=TianqingStorage.create(localStorage).load();}catch{return {moods:[],tasks:[]};}
   if(previous.moods.length||previous.tasks.length)return store.save(previous);
   return {moods:[],tasks:[]};
  },
  async save(value){
   const clean=TianqingStorage.validate(value);
   TianqingStorage.serialize(clean);
   if(!desktop&&!accounts)return TianqingStorage.create(localStorage).save(clean);
   return TianqingStorage.validate((await request('PUT',clean)).records);
  }
 };
 global.TianqingRecords=store;
})(globalThis);

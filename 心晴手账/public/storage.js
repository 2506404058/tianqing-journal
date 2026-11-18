(function(global){
 const KEY='tianqing.records.v1',BACKUP_KEY=KEY+'.migration-backup',MAX_BYTES=4.5*1024*1024;
 const text=(v,max)=>typeof v==='string'?v.slice(0,max):'';
 const bounded=(v,min,max,fallback)=>v!==undefined&&v!==null&&Number.isFinite(+v)?Math.min(max,Math.max(min,Math.round(+v))):fallback;
 function date(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('记录日期格式不正确');
  const d=new Date(value+'T12:00:00');
  if(Number.isNaN(+d)||d.getFullYear()!==+value.slice(0,4)||d.getMonth()+1!==+value.slice(5,7)||d.getDate()!==+value.slice(8))throw Error('记录日期无效');
  return value;
 }
 const safeId=(v,fallback)=>typeof v==='string'&&/^[\w-]{1,100}$/.test(v)?v:fallback;
 function timestamp(value,fallback){
  if(value===undefined||value===null||value==='')return fallback;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('记录时间格式无效');
  return new Date(value).toISOString();
 }
 function quadrant(task){
  const legacy=task.priority==='高'?[true,true]:task.priority==='低'?[false,false]:[true,false];
  const important=typeof task.important==='boolean'?task.important:legacy[0];
  const urgent=typeof task.urgent==='boolean'?task.urgent:legacy[1];
  return {important,urgent,key:(important?'1':'0')+(urgent?'1':'0'),label:important?(urgent?'重要且紧急':'重要不紧急'):(urgent?'紧急不重要':'不重要不紧急')};
 }
 function image(value,index){
  if(!value||typeof value.dataUrl!=='string'||!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value.dataUrl))throw Error('图片格式无效，仅支持压缩后的 JPEG 附件');
  if(value.dataUrl.length>230000)throw Error('单张图片过大，请重新选择并压缩');
  const width=bounded(value.width,1,1280,1),height=bounded(value.height,1,1280,1);
  return {id:safeId(value.id,'image-'+index),dataUrl:value.dataUrl,width,height};
 }
 function validate(input){
  if(!input||!Array.isArray(input.moods)||!Array.isArray(input.tasks)||input.moods.length>10000||input.tasks.length>10000)throw Error('请选择心晴手账导出的 JSON 文件');
  if(input.schemaVersion!==undefined&&input.schemaVersion!==1&&input.schemaVersion!==2)throw Error('备份版本较新，请使用新版心晴手账');
  const moodIds=new Set();
  const moods=input.moods.map((m,i)=>{
   if(!m||!Number.isInteger(m.weather)||m.weather<0||m.weather>4)throw Error('心情记录格式不正确');
   const day=date(m.date),id=safeId(m.id,'legacy-mood-'+day+'-'+i);
   if(moodIds.has(id))throw Error('心情编号重复');moodIds.add(id);
   const fallback=day+'T00:00:00.000Z',createdAt=timestamp(m.createdAt,fallback),recordedAt=timestamp(m.recordedAt,m.createdAt?createdAt:fallback);
   if(m.images!==undefined&&(!Array.isArray(m.images)||m.images.length>3))throw Error('每条心情最多附带 3 张图片');
   return {id,date:day,weather:m.weather,intensity:bounded(m.intensity,1,5,3),tag:text(m.tag,30)||'日常',note:text(m.note,2000),createdAt,recordedAt,updatedAt:timestamp(m.updatedAt,createdAt),timeUnknown:m.timeUnknown===true||(!m.recordedAt&&!m.createdAt),images:(m.images||[]).map(image)};
  });
  const ids=new Set();
  const tasks=input.tasks.map((t,i)=>{
   if(!t||typeof t.title!=='string'||!t.title.trim())throw Error('日程标题不能为空');
   if(t.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time))throw Error('日程时间无效');
   const day=date(t.date),id=safeId(t.id,'legacy-task-'+day+'-'+i);
   if(ids.has(id))throw Error('日程编号重复');ids.add(id);
   const q=quadrant(t);
   return {id,title:t.title.trim().slice(0,100),date:day,time:t.time||'',category:text(t.category,30).trim()||'其他',important:q.important,urgent:q.urgent,priority:q.important?(q.urgent?'高':'中'):'低',duration:bounded(t.duration,0,1440,0),reminder:bounded(t.reminder,0,10080,0),note:text(t.note,2000),done:t.done===true};
  });
  const p=input.preferences||{},recent=Array.isArray(p.recentCategories)?p.recentCategories:[];
  const preferences={recentCategories:[...new Set(recent.map(x=>text(x,30).trim()).filter(Boolean))].slice(0,8),breathing:{inhale:bounded(p.breathing?.inhale,2,8,4),exhale:bounded(p.breathing?.exhale,2,8,4)}};
  return {schemaVersion:2,moods,tasks,preferences};
 }
 function serialize(value){const json=JSON.stringify(validate(value));if(json.length*2>MAX_BYTES||new TextEncoder().encode(json).byteLength>5000000)throw Error('记录与图片接近浏览器容量上限。请先导出备份，再减少附件；本次未保存。');return json;}
 function create(storage){return {
  load(){const raw=storage.getItem(KEY);return raw===null?{moods:[],tasks:[]}:validate(JSON.parse(raw));},
  save(value){
   const clean=validate(value),json=serialize(clean);
   try{
    const raw=storage.getItem(KEY);
    if(raw&&JSON.parse(raw).schemaVersion!==2&&storage.getItem(BACKUP_KEY)===null)storage.setItem(BACKUP_KEY,raw);
    storage.setItem(KEY,json);
   }catch(err){if(err.name==='QuotaExceededError'||/quota/i.test(err.message))throw Error('浏览器空间不足。请导出备份并减少附件，本次改动未保存。');throw err;}
   return clean;
  }
 };}
 const api={KEY,BACKUP_KEY,MAX_BYTES,validate,serialize,quadrant,create};
 if(typeof module!=='undefined')module.exports=api;else global.TianqingStorage=api;
})(globalThis);

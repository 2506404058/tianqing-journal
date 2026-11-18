(function(global){
 const LIMIT=160*1024;
 function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('图片无法读取，请选择其他照片'));image.src=url;});}
 const asDataUrl=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片转换失败'));reader.readAsDataURL(blob);});
 async function compress(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('请选择 JPEG、PNG 或 WebP 图片');
  if(file.size>15*1024*1024)throw Error('原图超过15MB，请先缩小图片');
  const url=URL.createObjectURL(file);
  try{
   const image=await loadImage(url);
   if(image.naturalWidth*image.naturalHeight>40000000)throw Error('图片像素过大，请先缩小后再选择');
   const scale=Math.min(1,1280/Math.max(image.naturalWidth,image.naturalHeight));
   let width=Math.max(1,Math.round(image.naturalWidth*scale)),height=Math.max(1,Math.round(image.naturalHeight*scale)),quality=.7;
   for(let attempt=0;attempt<12;attempt++){
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');if(!context)throw Error('当前浏览器无法处理图片');
    context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
    if(!blob)throw Error('图片压缩失败，请换一张图片');
    if(blob.size<=LIMIT)return {id:'photo-'+Date.now()+'-'+Math.random().toString(36).slice(2),dataUrl:await asDataUrl(blob),width,height};
    if(quality>.4)quality=Math.max(.4,quality-.1);else{width=Math.max(1,Math.round(width*.75));height=Math.max(1,Math.round(height*.75));}
   }
   throw Error('图片压缩后仍过大，请选择更小的照片');
  }finally{URL.revokeObjectURL(url);}
 }
 async function checkBackup(records){
  for(const mood of records.moods)for(const attachment of mood.images){
   const image=await loadImage(attachment.dataUrl);
   if(image.naturalWidth>1280||image.naturalHeight>1280||!image.naturalWidth)throw Error('备份中的图片尺寸无效');
   attachment.width=image.naturalWidth;attachment.height=image.naturalHeight;
  }
  return records;
 }
 function mount(root,initial,onChange){
  let images=structuredClone(initial),active=true,busy=false;
  root.innerHTML='<label class="field">心情照片（最多3张）</label><div class="photo-thumbnails"></div><label class="secondary photo-picker">＋ 选择照片<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden></label><p class="hint photo-status" role="status">自动压缩后保存，照片会随导出备份一起保留。</p>';
  const thumbnails=root.querySelector('.photo-thumbnails'),picker=root.querySelector('input'),status=root.querySelector('.photo-status');
  function draw(){
   thumbnails.innerHTML=images.map((image,i)=>'<div class="photo-thumb"><img src="'+image.dataUrl+'" alt="已选图片 '+(i+1)+'"><button type="button" class="photo-remove" data-index="'+i+'" aria-label="删除图片 '+(i+1)+'">×</button></div>').join('');
   thumbnails.querySelectorAll('button').forEach(button=>{button.disabled=busy;button.onclick=()=>{const next=images.filter((_,i)=>i!==+button.dataset.index);onChange(next);images=next;draw();status.textContent='已选 '+images.length+' / 3 张';};});
  }
  picker.onchange=async()=>{
   const files=Array.from(picker.files);picker.value='';
   if(!files.length)return;
   if(images.length+files.length>3){status.textContent='每条最多3张，请先删除图片再添加。';return;}
   busy=true;picker.disabled=true;draw();status.textContent='正在压缩图片，请稍候…';
   try{
    let next=images.slice();
    for(const file of files){const attachment=await compress(file);if(!active)return;next.push(attachment);}
    onChange(next);images=next;status.textContent='已选 '+images.length+' / 3 张；已压缩，可预览或删除。';
   }catch(err){if(active)status.textContent=err.message+'。已保留原有图片。';}
   finally{busy=false;if(active){picker.disabled=false;draw();}}
  };
  draw();return {get busy(){return busy;},dispose(){active=false;}};
 }
 global.JournalImages={compress,checkBackup,mount};
})(globalThis);

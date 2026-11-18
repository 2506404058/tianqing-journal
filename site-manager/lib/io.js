const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const fail=(status,message)=>Object.assign(Error(message),{status});
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function inside(root,target){const relative=path.relative(path.resolve(root),path.resolve(target));return !relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));}
function readJson(file,max=6000000){if(fs.statSync(file).size>max)throw fail(413,'数据文件过大，请先检查服务器文件');return JSON.parse(fs.readFileSync(file,'utf8'));}
function writeJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(temp,file);}
function appendJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});if(fs.existsSync(file)&&fs.statSync(file).size>5*1024*1024){if(fs.existsSync(file+'.1'))fs.unlinkSync(file+'.1');fs.renameSync(file,file+'.1');}fs.appendFileSync(file,JSON.stringify(value)+'\n',{mode:0o600});}
async function body(req,max=16384){
 if(!(req.headers['content-type']||'').startsWith('application/json'))throw fail(415,'请使用JSON格式提交');
 return new Promise((resolve,reject)=>{let bytes=0,overflow=false;const chunks=[];req.on('data',chunk=>{bytes+=chunk.length;if(bytes>max){if(!overflow){overflow=true;chunks.length=0;reject(fail(413,'提交内容过大'));}return;}chunks.push(chunk);});req.on('end',()=>{if(overflow)return;try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();resolve(value);}catch{reject(fail(400,'内容格式无效'));}});req.on('error',reject);});
}
module.exports={fail,hash,inside,readJson,writeJson,appendJson,body};

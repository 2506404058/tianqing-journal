const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');const result=spawnSync('git',['-c','core.quotepath=false','diff','--cached','--name-only','--diff-filter=ACMR','-z'],{cwd:root,encoding:'utf8'});
if(result.status!==0)throw Error('无法读取待提交清单');
// Inspect all tracked files as well as staged additions, so CI audits a clean checkout too.
const tracked=spawnSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'});if(tracked.status!==0)throw Error('无法读取仓库文件');
const files=[...new Set([...result.stdout.split('\0'),...tracked.stdout.split('\0')].filter(Boolean))];const errors=[];
const rootFiles=new Set(['README.md','.gitignore','.gitattributes','package.json','start.cmd','server.cjs','launcher.cjs','launcher.test.cjs','doctor.cmd','启动网站管理中心.cmd']);
for(const file of files){
 const absolute=path.join(root,file);if(!fs.existsSync(absolute))continue;
 if(!rootFiles.has(file)&&! /^(心晴手账|开黑聊天室|site-manager|scripts|\.github)\//.test(file))errors.push(file+'：不在源码目录白名单');
 if(/(^|\/)(data|private|users|records|sessions|uploads?|attachments|exports|backups|logs|temp|cache|certs|node_modules|shared-accounts|accounts-data|desktop-data)(\/|$)/i.test(file)||/\.(pfx|p12|pem|key|cer|crt|log|jsonl|bak|zip|7z|bundle|tmp)$/i.test(file)||/(^|\/)(\.env(?:\..*)?|\.npmrc|server-location\.json|\.zerotier-.*\.json)$/.test(file))errors.push(file+'：禁止上传的本机数据或配置');
 if(! /\.(js|cjs|mjs|html|css|md|txt|cmd|ps1|json|yml|yaml)$/.test(file)&&!['.gitignore','.gitattributes'].includes(path.basename(file)))errors.push(file+'：未经审核的文件类型');
 const contents=fs.readFileSync(absolute,'utf8');
 if(/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/.test(contents)||/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/.test(contents)||/https:\/\/[^\s/]+:[^\s/@]+@github\.com/.test(contents))errors.push(file+'：疑似私钥或访问凭证');
 if(contents.includes(['10','202','170','97'].join('.'))||contents.includes('cf719fd5'+'40ba444f'))errors.push(file+'：包含服务器本机地址或网络标识');
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('隐私检查通过：'+files.length+' 个索引文件，仅包含允许的源码和文档。');


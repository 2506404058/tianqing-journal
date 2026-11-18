const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {resolvePaths,inside}=require('./server-paths');
test('保存位置由本地配置或显式根目录确定，拒绝越界覆盖和无效配置，不使用LOCALAPPDATA兜底',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tianqing-paths-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const project=path.join(root,'project'),home=path.join(root,'server');fs.mkdirSync(project);
 const fallback=resolvePaths({projectRoot:project,environment:{LOCALAPPDATA:'unused-c-drive-location'}});assert.equal(fallback.home,path.join(project,'private','server'));
 fs.writeFileSync(path.join(project,'server-location.json'),JSON.stringify({home}));
 const locations=resolvePaths({projectRoot:project,environment:{}});assert.equal(locations.accounts,path.join(home,'data','accounts'));assert.equal(locations.desktop,path.join(home,'data','desktop'));for(const value of Object.values(locations))assert.ok(inside(home,value));
 assert.throws(()=>resolvePaths({projectRoot:project,environment:{TIANQING_ACCOUNTS_DIR:path.join(root,'outside')}}),/根目录内/);
 assert.throws(()=>resolvePaths({projectRoot:project,environment:{TIANQING_SERVER_HOME:path.join(project,'public','exposed')}}),/公开网页目录/);
 fs.writeFileSync(path.join(project,'server-location.json'),'invalid-json');assert.throws(()=>resolvePaths({projectRoot:project,environment:{}}),/不会回退/);
});
test('运行日志、临时目录和报告目录均位于指定服务器根目录，重复配置不会重复写日志',t=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'tianqing-runtime-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
 const code="const {configureRuntime}=require('./server-runtime');const os=require('node:os');const a=configureRuntime(),b=configureRuntime();console.log('runtime marker');console.warn('warning marker');process.stdout.write(JSON.stringify({same:a===b,temp:os.tmpdir(),report:process.report.directory}));";
 const result=spawnSync(process.execPath,['-e',code],{cwd:__dirname,env:{...process.env,TIANQING_SERVER_HOME:home,TIANQING_ACCOUNTS_DIR:'',TIANQING_DATA_DIR:''},encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,result.stderr);const detail=JSON.parse(result.stdout.split('\n').at(-1));assert.equal(detail.same,true);assert.equal(detail.temp,path.join(home,'temp'));assert.equal(detail.report,path.join(home,'logs'));
 const log=fs.readFileSync(path.join(home,'logs','server.log'),'utf8');assert.equal(log.match(/runtime marker/g).length,1);assert.match(log,/warning marker/);for(const name of ['data/accounts','data/desktop','logs','backups','temp','cache'])assert.ok(fs.statSync(path.join(home,name)).isDirectory());
});

test('分享入口与诊断共用本地端口配置，未配置的项目仍默认3180',t=>{
 const {sharePort}=require('./startup-panel'),root=fs.mkdtempSync(path.join(os.tmpdir(),'tianqing-port-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 assert.equal(sharePort('',{projectRoot:root}),3180);
 fs.writeFileSync(path.join(root,'server-location.json'),JSON.stringify({home:root,sharePort:3000}));
 assert.equal(sharePort('',{projectRoot:root}),3000);assert.equal(sharePort('3222',{projectRoot:root}),3222);
 fs.writeFileSync(path.join(root,'server-location.json'),JSON.stringify({sharePort:0}));assert.throws(()=>sharePort('',{projectRoot:root}),/端口/);
 fs.writeFileSync(path.join(root,'server-location.json'),'invalid-json');assert.throws(()=>sharePort('',{projectRoot:root}),/配置无法读取/);
});

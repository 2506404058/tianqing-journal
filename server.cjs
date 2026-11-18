// Compatibility entry: all startup behavior lives in launcher.cjs.
const launcher=require('./launcher.cjs');
if(require.main===module)launcher.main().catch(error=>{console.error('启动失败：'+error.message);process.exitCode=1;});
module.exports=launcher;

(function(global){
 const enabled=global.TianqingRuntime?.accounts===true;
 let user=null,csrf='',callbacks={},busy=false,mode='login';
 const $=selector=>document.querySelector(selector);
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function headers(){return {'X-Tianqing-Request':'1','X-Tianqing-CSRF':csrf,'X-Tianqing-Account':user?.id||''};}
 async function request(route,method='GET',body){
  let response;
  try{response=await fetch('./api/auth/'+route,{method,credentials:'same-origin',cache:'no-store',headers:{...headers(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}
  catch{throw Error('连接不到心晴服务，请检查网络，并确认服务器电脑和启动窗口仍在运行');}
  const result=await response.json();
  if(!response.ok){const err=Error(result.error||'账号操作失败');err.status=response.status;throw err;}
  return result;
 }
 function message(text){$('#auth-message').textContent=text;}
 function paintUser(){
  $('#account-name').textContent=user?.displayName||user?.username||'';
  $('#account-profile').textContent=user?.avatar||'☀️';
  $('#account-profile').hidden=!user;$('#guest-avatar').hidden=Boolean(user);
 }
 async function profileRequest(method='GET',input){
  const accountId=user?.id;if(!accountId)throw Error('请先登录再查看个人资料');
  let result;
  try{result=await request('profile',method,input);}
  catch(err){if(err.status===401&&user?.id===accountId)lock(err.message);throw err;}
  if(user?.id!==accountId)throw Error('当前账号已切换，请重新打开个人中心');
  user=result.user;paintUser();return result;
 }
 function showForm(note=''){
  const register=mode==='register';
  $('#auth-screen').innerHTML=`<div class="auth-shell"><div class="auth-story"><a class="auth-brand" href="#home"><span class="brandmark">☀</span> 心晴手账</a><div class="auth-weather" aria-hidden="true"><span>☀</span><i></i><b></b></div><p class="auth-eyebrow">A LITTLE SPACE FOR YOURSELF</p><h1>给心情一个家，<br>也给明天一点晴朗。</h1><p>收藏每一种天气，<br>慢慢安排属于自己的日子。</p><small>同一个账号，在不同设备续写你的手账。</small></div><section class="auth-card" aria-labelledby="auth-title"><p class="auth-eyebrow">YOUR PRIVATE WEATHER STATION</p><h2 id="auth-title">${register?'开启你的心晴手账':'欢迎回到心晴'}</h2><p class="auth-intro">${register?'创建账号，留下一片属于自己的天空。':'登录后，接着记录你的日常。'}</p><div class="auth-tabs" role="group" aria-label="账号操作"><button type="button" id="auth-login-tab" aria-pressed="${!register}">登录</button><button type="button" id="auth-register-tab" aria-pressed="${register}">注册账号</button></div><form id="auth-form"><label class="field">用户名<input name="username" id="auth-username" required minlength="2" maxlength="24" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="中文、字母、数字或 _ -"></label><label class="field">密码<input name="password" id="auth-password" type="password" required minlength="10" maxlength="128" autocomplete="${register?'new-password':'current-password'}" placeholder="至少10个字符，可以是一句话"></label>${register?'<label class="field">确认密码<input id="auth-confirm" type="password" required minlength="10" maxlength="128" autocomplete="new-password" placeholder="再输入一次密码"></label>':''}<div class="auth-options"><label class="auth-show"><input id="auth-show-password" type="checkbox"> 显示密码</label><label class="auth-show auth-remember"><input id="auth-remember" type="checkbox"> 下次自动登录（30天）</label></div><p class="auth-remember-hint">仅在自己的设备上勾选，退出登录后会取消。</p><p id="auth-message" class="auth-message" role="status" aria-live="polite">${escape(note)}</p><button class="primary auth-submit" type="submit">${register?'创建账号并进入':'登录我的手账'} <span aria-hidden="true">↗</span></button></form><p class="auth-privacy">每个账号独立保存记录。服务器主人可以管理服务器文件，请使用单独的密码。${register?'请记住密码，目前没有邮箱找回功能。':''}</p></section></div>`;
  $('#auth-login-tab').onclick=()=>{if(!busy){mode='login';showForm();}};
  $('#auth-register-tab').onclick=()=>{if(!busy){mode='register';showForm();}};
  $('#auth-show-password').onchange=e=>{for(const id of ['#auth-password','#auth-confirm'])if($(id))$(id).type=e.target.checked?'text':'password';};
  $('#auth-form').onsubmit=async event=>{
   event.preventDefault();if(busy)return;
   if(register&&$('#auth-password').value!==$('#auth-confirm').value){message('两次输入的密码不一致，请再检查一下');return;}
   const button=$('.auth-submit');busy=true;button.disabled=true;message(register?'正在创建账号…':'正在登录…');
   try{const result=await request(register?'register':'login','POST',{username:$('#auth-username').value,password:$('#auth-password').value,rememberMe:$('#auth-remember').checked});await enter(result);}
   catch(err){message(err.message);}
   finally{busy=false;button.disabled=false;}
  };
 }
 async function enter(result){
  user=result.user;csrf=result.csrf;
  global.TianqingRecords?.reset();
  $('#account-tools').hidden=false;paintUser();
  // Hide credentials and the previous account's DOM before showing any records.
  $('#auth-screen').innerHTML='';$('#auth-screen').hidden=true;
  await callbacks.onReady?.();
  if(user?.id===result.user.id)document.documentElement.classList.remove('auth-locked');
 }
 function lock(note=''){
  user=null;csrf='';global.TianqingRecords?.reset();callbacks.onLock?.();
  $('#account-tools').hidden=true;paintUser();
  document.documentElement.classList.add('auth-locked');$('#auth-screen').hidden=false;mode='login';showForm(note);
 }
 function logout(){
  if(busy)return;
  const dialog=$('#modal');
  $('#modal-content').innerHTML='<h2>暂时离开一下？</h2><p class="subtitle">已保存的记录会留在你的账号中。请先保存正在编辑的内容。</p><p id="logout-message" class="auth-message" role="status"></p><div class="actions"><button type="button" class="secondary" id="cancel-logout">取消</button><button type="button" class="primary" id="confirm-logout">确认退出</button></div>';
  $('#cancel-logout').onclick=()=>dialog.close();if(!dialog.open)dialog.showModal();
  $('#confirm-logout').onclick=async event=>{
   if(busy)return;busy=true;event.target.disabled=true;
   try{await request('logout','POST',{});lock('已退出登录，记录仍保存在你的账号中');}
   catch(err){if(err.status===401)lock(err.message);else $('#logout-message').textContent=err.message;}
   finally{busy=false;event.target.disabled=false;}
  };
 }
 function passwordForm(){
  const dialog=$('#modal');
  $('#modal-content').innerHTML='<h2>修改登录密码</h2><p class="subtitle">修改成功后，其他设备需要重新登录。</p><form id="password-form"><label class="field">原密码<input id="current-password" type="password" required minlength="10" maxlength="128" autocomplete="current-password"></label><label class="field">新密码<input id="new-password" type="password" required minlength="10" maxlength="128" autocomplete="new-password"></label><label class="field">确认新密码<input id="confirm-password" type="password" required minlength="10" maxlength="128" autocomplete="new-password"></label><p id="password-message" class="auth-message" role="status"></p><div class="actions"><button type="button" class="secondary" id="cancel-password">取消</button><button type="submit" class="primary">保存新密码</button></div></form>';
  $('#cancel-password').onclick=()=>dialog.close();if(!dialog.open)dialog.showModal();
  $('#password-form').onsubmit=async event=>{
   event.preventDefault();if(busy)return;
   const output=$('#password-message'),button=event.submitter;
   if($('#new-password').value!==$('#confirm-password').value){output.textContent='两次输入的新密码不一致';return;}
   busy=true;button.disabled=true;output.textContent='正在更新密码…';
   try{
    const result=await request('password','POST',{currentPassword:$('#current-password').value,newPassword:$('#new-password').value});csrf=result.csrf;
    $('#modal-content').innerHTML='<h2>密码已更新</h2><p class="subtitle" role="status">新密码已经生效，其他设备需要重新登录。</p><div class="actions"><button type="button" class="primary" id="password-done">完成</button></div>';
    $('#password-done').onclick=()=>{dialog.close();$('#modal-content').innerHTML='';};
   }
   catch(err){if(err.status===401)lock(err.message);else output.textContent=err.message;}
   finally{busy=false;button.disabled=false;}
  };
 }
 async function start(options){
  callbacks=options;
  $('#account-logout').onclick=logout;$('#account-password').onclick=passwordForm;
  $('#auth-screen').innerHTML='<div class="auth-loading" role="status">☀ 正在打开你的心晴手账…</div>';
  try{const result=await request('session');if(result.user)await enter(result);else lock();}
  catch(err){lock(err.message);}
 }
 global.TianqingAuth={enabled,get user(){return user;},headers,start,getProfile:()=>profileRequest(),saveProfile:input=>profileRequest('PUT',input),changePassword:passwordForm,logout,expire:()=>lock('登录已过期，请重新登录。账号中已保存的记录不受影响。')};
 if(enabled){document.documentElement.classList.add('account-mode','auth-locked');$('#auth-screen').hidden=false;}
})(globalThis);

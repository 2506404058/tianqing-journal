(function(global){
 const $=selector=>document.querySelector(selector);
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const avatars=[['☀️','晴天'],['🌤️','多云'],['🌿','新芽'],['🌷','小花'],['🌙','月亮'],['🌈','彩虹']];
 let generation=0;
 function joined(value){const date=new Date(value);return value&&!Number.isNaN(date.getTime())?date.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'}):'未记录';}
 function render(){
  return '<div class="eyebrow">A SPACE THAT BELONGS TO YOU</div><h1>个人中心</h1><p class="subtitle">认识此刻的自己，也照顾属于你的这一片天空。</p><div id="profile-view"><section class="card profile-loading" role="status">正在读取你的个人资料…</section></div>';
 }
 function content({user,stats}){
  return `<div class="profile-layout"><div class="profile-overview"><section class="card profile-identity" aria-labelledby="profile-display-name"><div class="profile-sky" aria-hidden="true"><i></i><b></b><span>☀</span></div><div class="profile-identity-content"><span class="profile-avatar" id="profile-avatar-preview" aria-hidden="true">${esc(user.avatar)}</span><p class="eyebrow">MY LITTLE WEATHER STATION</p><h2 id="profile-display-name">${esc(user.displayName)}</h2><p class="profile-handle">登录用户名 · ${esc(user.username)}</p><p id="profile-bio-preview" class="profile-bio">${esc(user.bio||'还没有写下简介，给自己留一句话吧。')}</p><div class="profile-joined">🌱 ${esc(joined(user.createdAt))}${user.createdAt?' 加入心晴':''}</div></div></section><section class="card profile-stats" aria-labelledby="profile-stats-title"><div class="row"><h2 id="profile-stats-title">我的记录足迹</h2><span>只属于这个账号</span></div><div class="profile-stat-grid">${[[stats.moods,'条心情','☀'],[stats.recordedDays,'个记录日','▦'],[stats.tasks,'条日程','☷'],[stats.photos,'张心情照片','▧']].map(([value,label,icon])=>'<div><span class="profile-stat-icon" aria-hidden="true">'+icon+'</span><strong>'+value+'</strong><small>'+label+'</small></div>').join('')}</div><p class="profile-stat-note">其中 ${stats.completedTasks} 条日程已完成。统计包含当前账号全部已保存记录。</p></section></div><div class="profile-settings"><section class="card profile-edit" aria-labelledby="profile-edit-title"><div class="row"><h2 id="profile-edit-title">我的资料</h2><span class="profile-private-tag">仅自己可见</span></div><p class="profile-help">换一个喜欢的称呼，留一句此刻想说的话。</p><form id="profile-form"><label class="field">昵称<input name="displayName" id="profile-nickname" maxlength="24" autocomplete="nickname" value="${esc(user.displayName)}" placeholder="想让心晴怎么称呼你？"><small class="hint">最多24个字符，留空时使用登录用户名。</small></label><fieldset class="profile-avatar-field"><legend>天气头像</legend><div class="profile-avatar-options">${avatars.map(([emoji,label])=>'<label class="profile-avatar-choice"><input type="radio" name="avatar" value="'+emoji+'" '+(user.avatar===emoji?'checked':'')+' aria-label="'+label+'头像"><span><b aria-hidden="true">'+emoji+'</b><small>'+label+'</small></span></label>').join('')}</div></fieldset><label class="field">一句话简介<textarea id="profile-bio" name="bio" rows="3" maxlength="140" placeholder="例如：把平凡的小日子，过成喜欢的样子。">${esc(user.bio)}</textarea><small class="profile-bio-count" id="profile-bio-count">${user.bio.length} / 140</small></label><p id="profile-message" class="profile-message" role="status" aria-live="polite"></p><div class="profile-save-row"><span>保存后，其他设备登录也能看到。</span><button type="submit" class="primary" id="profile-save">保存资料 ↗</button></div></form></section><section class="card profile-security" aria-labelledby="profile-security-title"><h2 id="profile-security-title">账号与数据</h2><dl><div><dt>登录用户名</dt><dd>${esc(user.username)}<small>用于登录，不随昵称修改。</small></dd></div><div><dt>注册日期</dt><dd>${esc(joined(user.createdAt))}</dd></div></dl><p>资料和记录保存在当前心晴服务器，其他用户无法通过网页查看。服务器主人可以管理这些文件。</p><div class="profile-account-actions"><button type="button" class="secondary" id="profile-password">修改密码</button><button type="button" class="text-button" id="profile-logout">退出登录 ↗</button></div></section></div></div>`;
 }
 async function mount(){
  const root=$('#profile-view');if(!root)return;
  const current=++generation,alive=()=>generation===current&&$('#profile-view')===root;
  try{
   const result=await global.TianqingAuth.getProfile();if(!alive())return;
   root.innerHTML=content(result);
   $('#profile-password').onclick=()=>global.TianqingAuth.changePassword();
   $('#profile-logout').onclick=()=>global.TianqingAuth.logout();
   $('#profile-bio').oninput=event=>{$('#profile-bio-count').textContent=event.target.value.length+' / 140';};
   let saving=false;
   $('#profile-form').onsubmit=async event=>{
    event.preventDefault();if(saving)return;
    const button=$('#profile-save'),output=$('#profile-message');
    const input={displayName:$('#profile-nickname').value,bio:$('#profile-bio').value,avatar:root.querySelector('[name="avatar"]:checked').value};
    saving=true;button.disabled=true;output.classList.remove('is-success');output.textContent='正在保存资料…';
    try{
     const saved=await global.TianqingAuth.saveProfile(input);if(!alive())return;
     $('#profile-display-name').textContent=saved.user.displayName;
     $('#profile-avatar-preview').textContent=saved.user.avatar;
     $('#profile-bio-preview').textContent=saved.user.bio||'还没有写下简介，给自己留一句话吧。';
     $('#profile-nickname').value=saved.user.displayName;$('#profile-bio').value=saved.user.bio;
     $('#profile-bio-count').textContent=saved.user.bio.length+' / 140';
     output.classList.add('is-success');output.textContent='资料已保存，新的称呼和天气头像已经更新。';
    }catch(err){if(alive())output.textContent=err.message||'暂时无法保存，请稍后重试';}
    finally{saving=false;button.disabled=false;}
   };
  }catch(err){
   if(!alive())return;
   root.innerHTML='<section class="card profile-loading"><h2>暂时无法读取个人资料</h2><p>'+esc(err.message)+'</p><button type="button" class="secondary" id="profile-retry">重新读取</button></section>';
   $('#profile-retry').onclick=mount;
  }
 }
 global.TianqingProfile={render,mount};
})(globalThis);

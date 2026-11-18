
function analysisCard(){
 const a=WeatherAnalysis.analyze(data,{period});
 return '<section class="card analysis-card" id="weather-analysis" aria-labelledby="analysis-title"><div class="row analysis-heading"><h2 id="analysis-title">✧ 气象分析</h2><span class="analysis-local">本地规则分析</span></div><p class="analysis-summary">'+esc(a.summary)+'</p><div class="analysis-coverage"><span>记录覆盖 <b>'+a.recordedDays+' / '+a.period+' 天</b></span><div class="analysis-meter" aria-hidden="true"><i style="width:'+a.coverage+'%"></i></div><small>'+(a.recordedDays<3?'样本较少 · 暂不判断变化':'仅依据已记录的日期')+'</small></div><div class="analysis-grid">'+a.insights.map(item=>'<article class="analysis-insight"><span class="analysis-icon" aria-hidden="true">'+item.icon+'</span><div><h3>'+esc(item.title)+'</h3><p>'+esc(item.text)+'</p></div></article>').join('')+'</div><div class="analysis-suggestions"><h3>给接下来的自己</h3>'+a.suggestions.map(item=>'<div class="analysis-suggestion"><p>'+esc(item.text)+'</p>'+(item.action==='mood'?'<button class="text-button" onclick="moodForm()">'+esc(item.label)+' ↗</button>':'<a class="text-button" href="#'+(item.action==='tasks'?'tasks':'calendar')+'">'+esc(item.label)+' ↗</a>')+'</div>').join('')+'</div><details class="analysis-method"><summary>这些分析是怎么得出的？</summary><ul><li>天气按心情记录次数统计，记录天数按日期去重。</li><li>强度先计算每天的平均值，再对有记录的日期取平均，避免一天多记几次就影响整期结果。</li><li>上一周期为 '+esc(a.previousStart)+' 至 '+esc(a.previousEnd)+'；两期各有至少3个记录日时才比较强度。</li><li>日程按计划日期统计，完成状态以目前保存的记录为准。空白日期保持未知。</li></ul></details><p class="analysis-note">只整理你的记录，不作心理诊断，也不推断情绪与日程之间的因果关系。分析在当前设备完成。</p></section>';
}

const intensityEmotions=['开心','平静','疲惫','难过','生气'];
const intensityDescriptions=['轻轻的','有一点','挺明显','很强烈','特别强'];

function updateIntensityEmotion(weatherType){
 $('#intensity-options').dataset.weather=String(weatherType);
 $('#intensity-legend').textContent='这份「'+intensityEmotions[weatherType]+'」有多强？';
 document.querySelectorAll('[name=intensity]').forEach(input=>input.setAttribute('aria-label',intensityEmotions[weatherType]+'，'+input.value+'级，'+intensityDescriptions[+input.value-1]));
}

function intensityPicker(value,weatherType){
 return '<fieldset class="intensity-picker"><legend id="intensity-legend">这份「'+intensityEmotions[weatherType]+'」有多强？</legend><div class="intensity-summary"><span>跟着感觉选就好</span><output id="intensity-value" aria-live="polite">'+intensityDescriptions[value-1]+' · '+value+' / 5</output></div><div class="intensity-options" id="intensity-options" data-weather="'+weatherType+'">'+intensityDescriptions.map((label,i)=>'<label class="intensity-option"><input type="radio" name="intensity" value="'+(i+1)+'" '+(value===i+1?'checked':'')+' aria-label="'+intensityEmotions[weatherType]+'，'+(i+1)+'级，'+label+'"><span class="intensity-tile"><span class="feeling-face level-'+(i+1)+'" aria-hidden="true"><i class="face-eye eye-left"></i><i class="face-eye eye-right"></i><i class="face-mouth"></i><i class="face-cheek cheek-left"></i><i class="face-cheek cheek-right"></i></span><span class="intensity-caption">'+label+'</span><span class="intensity-dot" aria-hidden="true"></span></span></label>').join('')+'</div><p class="intensity-footnote">强烈不代表开心或难过，只是在说：此刻的感受有多明显。</p></fieldset>';
}
function moodsOn(day){return data.moods.filter(m=>m.date===day).sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)||b.createdAt.localeCompare(a.createdAt));}
function latestMood(day){return moodsOn(day)[0];}
function moodClock(m){return m.timeUnknown?'时间未记录':new Date(m.recordedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});}
function moodCards(records){return records.map(m=>`<article class="mood-card"><div class="row"><h3>${weather[m.weather]} ${names[m.weather]}</h3><small>${esc(m.date)} · ${moodClock(m)}</small></div><p>${esc(m.note||'今天没有写下文字，也没关系。')}</p><div class="mood-photos">${m.images.map((image,i)=>'<button type="button" class="photo-open" data-mood="'+m.id+'" data-index="'+i+'" onclick="viewMoodPhoto(this.dataset.mood,+this.dataset.index)"><img loading="lazy" src="'+image.dataUrl+'" alt="心情图片 '+(i+1)+'"></button>').join('')}</div><div class="row"><span><span class="tag">${esc(m.tag)}</span><small>强度 ${m.intensity} / 5</small></span><span><button class="icon-button" onclick="moodForm('${m.id}')">编辑</button><button class="icon-button" onclick="deleteItem('moods','${m.id}')">删除</button></span></div></article>`).join('');}

const quadrants=[['11','重要且紧急','优先处理'],['10','重要不紧急','安排时间'],['01','紧急不重要','酌情协调'],['00','不重要不紧急','适当减少']];
function quadrantTag(t){const q=TianqingStorage.quadrant(t);return '<span class="tag quadrant-tag q'+q.key+'">'+q.label+'</span>';}
function toggleCategory(){const custom=$('#task-category').value==='__custom__';$('#custom-category-field').hidden=!custom;$('#custom-category').required=false;}
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>ScheduleParser.localDate(new Date()),weather=['☀️','🌤️','☁️','🌧️','⛈️'],names=['晴天','多云','阴天','雨天','雷雨'],labels=['开心 · 充满活力','轻松 · 内心平静','疲惫 · 想歇一歇','低落 · 需要拥抱','烦躁 · 压力有点大'];
const pages=[['home','⌂','今日概览'],['mood','☀','心情记录'],['tasks','☷','日程安排'],['calendar','▦','心晴日历'],['report','▥','气象报告'],...(globalThis.TianqingAuth?.enabled?[['profile','♧','个人中心']]:[])];
let data={moods:[],tasks:[],preferences:{recentCategories:[]}} ,page='home',filter='all',calDate=new Date(),selected=today(),period=7;
function toast(s){$('#toast').textContent=s;$('#toast').style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').style.display='none',3200)}
async function save(next){try{data=await TianqingRecords.save(next);render();return true}catch(err){toast(err.message||'保存失败。请先导出备份。');return false}}
function mutate(fn){let next=structuredClone(data);fn(next);return save(next)}
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);
let breathStop=null,modalCleanup=null;
function cleanupModal(){if(modalCleanup){modalCleanup();modalCleanup=null;}}
function stopBreathing(){if(breathStop){breathStop();breathStop=null;}}
function modal(html){cleanupModal();stopBreathing();$('#modal-content').innerHTML=html;if(!$('#modal').open)$('#modal').showModal()}
function closeModal(discard=true){if(discard)drafts=[];cleanupModal();stopBreathing();$('#modal').close()}
const actions=label=>`<div class="actions"><button type="button" class="secondary" onclick="closeModal()">取消</button><button class="primary" type="submit">${label||'保存'}</button></div>`;
function taskHTML(t){return `<div class="task ${t.done?'done':''} quadrant-row q${TianqingStorage.quadrant(t).key}"><button class="check ${t.done?'done':''}" aria-label="${t.done?'取消完成':'标记完成'}" onclick="toggleTask('${t.id}')">${t.done?'✓':''}</button><div class="task-info"><div class="task-title">${esc(t.title)}</div><div class="task-meta"><span class="tag">${esc(t.category)}</span>${esc(t.date)} · ${esc(t.time||'全天')}${t.duration?' · '+t.duration+'分钟':''} ${quadrantTag(t)}</div></div><button class="icon-button" aria-label="编辑日程" onclick="taskForm('${t.id}')">✎</button><button class="icon-button" aria-label="删除日程" onclick="deleteItem('tasks','${t.id}')">×</button></div>`}
function listTasks(tasks){return tasks.length?tasks.sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))).map(taskHTML).join(''):'<div class="empty">还没有安排，留一点时间给自己吧。<br>点击「新建日程」开始安排。</div>'}
function quick(){return `<section class="card quick"><h2>✧ 一句话生成日程草稿</h2><p class="hint">输入一句话，自动识别日期、时间和事项；检查草稿并确认后才会保存，无需先创建日程。</p><form id="quick-form" novalidate><div class="quick-line"><input id="quick-input" maxlength="500" aria-label="一句话生成日程" placeholder="例如：明天 8:40 高等数学"><button type="submit" class="primary">生成日程草稿 ↗</button></div></form><div class="hint">支持今天 / 明天 / 周几、时间和时长。多件事用分号分隔。</div></section>`}
function streak(){let n=0,d=new Date();if(!data.moods.some(m=>m.date===today()))d.setDate(d.getDate()-1);while(data.moods.some(m=>m.date===ScheduleParser.localDate(d))){n++;d.setDate(d.getDate()-1)}return n}
function home(){const m=latestMood(today()),ts=data.tasks.filter(t=>t.date===today()),done=ts.filter(t=>t.done).length;return `<div class="eyebrow">A LITTLE SUNSHINE, EVERY DAY</div><h1>你好，今天也要好好生活 <span style="font-size:24px">🌿</span></h1><p class="subtitle">整理生活的小事，也听听心里的天气。</p><section class="card hero"><div><span class="eyebrow">TODAY'S INNER WEATHER</span><h2>${m?weather[m.weather]+' 今天的心情，是'+names[m.weather]:'你的心里，今天是什么天气？'}</h2><p>${m?esc(m.note||labels[m.weather]):'晴天或雨天，都有属于它的意义。<br>花一分钟，记录此刻的自己。'}</p><button class="primary" onclick="moodForm()">＋ 记录此刻心情</button><small class="today-mood-count">今天已记录 ${moodsOn(today()).length} 次心情 · 展示最新一条</small></div><div class="hero-art" aria-hidden="true"><div class="sun"></div><div class="cloud"></div><div class="hill"></div><div class="hill two"></div></div></section><div class="stats"><div class="card stat"><span class="stat-icon">☀</span><div><small>连续记录</small><b>${streak()}</b><em>天</em></div></div><div class="card stat"><span class="stat-icon">☷</span><div><small>今日待办</small><b>${ts.length-done}</b><em>件小事</em></div></div><div class="card stat"><span class="stat-icon">✓</span><div><small>今日完成</small><b>${ts.length?Math.round(done/ts.length*100):0}<em>%</em></b></div></div></div><div class="columns"><div>${quick()}<section class="card"><div class="row section-head"><h2>今日的小计划 <small>${done} / ${ts.length} 已完成</small></h2><button class="text-button" onclick="taskForm()">＋ 新建</button></div>${listTasks(ts)}<a class="text-button" style="display:block;text-align:center;font-size:11px" href="#tasks">查看全部日程 →</a></section></div><div><section class="card"><div class="row"><h2>这一周，心情如何？</h2><a class="text-button" href="#calendar">↗</a></div><div class="week">${Array.from({length:7},(_,i)=>{let d=new Date();d.setDate(d.getDate()-6+i);let key=ScheduleParser.localDate(d),m=latestMood(key);return `<div class="${key===today()?'today':''}">${['日','一','二','三','四','五','六'][d.getDay()]}<b>${m?weather[m.weather]:'·'}</b>${d.getDate()}<small>${moodsOn(key).length?moodsOn(key).length+'次':''}</small></div>`}).join('')}</div></section><section class="card quote"><span class="eyebrow">A MOMENT FOR YOURSELF</span><p>“${esc(DailyQuote.forDate())}”</p><div class="row"><small>每日一句 · 给认真生活的你</small><button class="text-button" onclick="breathe()">呼吸一下 ↗</button></div></section></div></div>`}
function moodPage(){
 const days=[...new Set(data.moods.map(m=>m.date))].sort().reverse();
 return `<div class="eyebrow">LET YOUR FEELINGS BE SEEN</div><div class="row"><h1>收藏每一种心情</h1><button class="primary" onclick="moodForm()">＋ 记录心情</button></div><p class="subtitle">一天可以有多种天气，随时记录，不覆盖之前的自己。</p><div class="columns"><section class="card"><h2>我的心情时间线</h2>${days.length?days.map(day=>'<section class="mood-day"><h3 class="timeline-date">'+day+' · '+moodsOn(day).length+' 条</h3>'+moodCards(moodsOn(day))+'</section>').join(''):'<div class="empty">第一篇心情手记，等你来写。</div>'}</section><section class="card" style="align-self:start"><h2>你的情绪天气图鉴</h2>${weather.map((w,i)=>'<div class="task"><span style="font-size:27px">'+w+'</span><div><h3>'+names[i]+'</h3><small>'+labels[i]+'</small></div></div>').join('')}<p class="hint">天气由你定义；心情强度表示感受的强烈程度，不代表好坏。</p></section></div>`;
}
function taskPage(){let ts=data.tasks.filter(t=>filter==='today'?t.date===today():filter==='done'?t.done:filter==='pending'?!t.done:true);return `<div class="eyebrow">MAKE ROOM FOR WHAT MATTERS</div><div class="row"><h1>把生活，安排得从容一点</h1><button class="primary" onclick="taskForm()">＋ 新建日程</button></div><p class="subtitle">从一件小事开始，让每一天都有自己的节奏。</p>${quick()}<section class="card"><div class="toolbar">${[['all','全部日程'],['today','今天'],['pending','待完成'],['done','已完成']].map(([k,v])=>`<button class="secondary ${filter===k?'active':''}" onclick="filter='${k}';render()">${v}</button>`).join('')}</div>${listTasks(ts)}</section>`}
function calendarPage(){
 const y=calDate.getFullYear(),m=calDate.getMonth(),start=(new Date(y,m,1).getDay()+6)%7,count=new Date(y,m+1,0).getDate();
 return `<div class="eyebrow">A SMALL MAP OF YOUR DAYS</div><h1>日子和心情，都在这里</h1><p class="subtitle">天气图标代表当天最新记录，数字显示全部心情条数；彩色圆点代表日程四象限。</p><div class="columns"><section class="card"><div class="row section-head"><button class="secondary" onclick="changeMonth(-1)" aria-label="上个月">←</button><h2 class="calendar-title">${y} 年 ${m+1} 月</h2><button class="secondary" onclick="changeMonth(1)" aria-label="下个月">→</button></div><div class="calendar">${['一','二','三','四','五','六','日'].map(d=>'<div class="day-name">'+d+'</div>').join('')}${'<div></div>'.repeat(start)}${Array.from({length:count},(_,i)=>{
  const date=ScheduleParser.localDate(new Date(y,m,i+1)),all=moodsOn(date),tasks=data.tasks.filter(x=>x.date===date),keys=[...new Set(tasks.map(t=>TianqingStorage.quadrant(t).key))];
  return '<button class="day '+(date===selected?'selected ':'')+(date===today()?'today':'')+'" data-date="'+date+'" onclick="selected=this.dataset.date;render()"><span>'+(i+1)+'</span><span class="day-weather">'+(all[0]?weather[all[0].weather]:'')+'</span>'+(all.length?'<small>'+all.length+' 条心情</small>':'')+(tasks.length?'<small class="calendar-task-count">'+tasks.length+' 项日程</small>':'')+'<span class="quadrant-dots">'+keys.map(k=>'<span class="quadrant-dot q'+k+'" title="'+quadrants.find(q=>q[0]===k)[1]+'"></span>').join('')+'</span></button>';
 }).join('')}</div><div class="quadrant-legend">${quadrants.map(([k,label])=>'<span class="tag quadrant-tag q'+k+'">'+label+'</span>').join('')}</div></section><section class="card" style="align-self:start"><h2>${esc(selected)}</h2><div class="row"><button class="text-button" onclick="moodForm(null,selected)">＋ 心情</button><button class="text-button" onclick="taskForm(null,selected)">＋ 日程</button></div>${moodsOn(selected).length?moodCards(moodsOn(selected)):'<p class="hint">这一天还没有心情记录。</p>'}${listTasks(data.tasks.filter(t=>t.date===selected))}</section></div>`;
}
function changeMonth(delta){calDate=new Date(calDate.getFullYear(),calDate.getMonth()+delta,1);render()}
function report(){let end=today(),begin=new Date();begin.setDate(begin.getDate()-period+1);let start=ScheduleParser.localDate(begin),ms=data.moods.filter(x=>x.date>=start&&x.date<=end),ts=data.tasks.filter(x=>x.date>=start&&x.date<=end),completed=ts.filter(x=>x.done).length;return `<div class="eyebrow">LOOK BACK WITH KINDNESS</div><div class="row"><h1>你的专属气象报告</h1><select style="width:auto" onchange="period=+this.value;render()"><option value="7" ${period===7?'selected':''}>近 7 天</option><option value="30" ${period===30?'selected':''}>近 30 天</option></select></div><p class="subtitle">${start} — ${end} · 看见变化，也看见自己的努力。</p><div class="stats"><div class="card stat"><span class="stat-icon">☀</span><div><small>记录天数</small><b>${new Set(ms.map(m=>m.date)).size}</b><em>天</em></div></div><div class="card stat"><span class="stat-icon">✓</span><div><small>任务完成率</small><b>${ts.length?Math.round(completed/ts.length*100):0}</b><em>%</em></div></div><div class="card stat"><span class="stat-icon">🌱</span><div><small>完成的小事</small><b>${completed}</b><em>件</em></div></div></div>${analysisCard()}<div class="columns"><section class="card"><h2>情绪天气分布（按记录次数）</h2>${weather.map((w,i)=>{let n=ms.filter(x=>x.weather===i).length;return `<div class="bar-row"><span>${w} ${names[i]}</span><div class="bar-track"><div class="bar-fill" style="width:${ms.length?n/ms.length*100:0}%"></div></div><span>${n} 次</span></div>`}).join('')}<p class="hint">${ms.length?'每一种心情，都是生活的一部分。':'还没有记录。完成一次心情打卡后，这里就会出现你的天气。'}</p></section><section class="card"><h2>近七日心情强度</h2><div class="trend">${Array.from({length:7},(_,i)=>{let d=new Date();d.setDate(d.getDate()-6+i);let all=moodsOn(ScheduleParser.localDate(d)),m=all[0],average=all.length?all.reduce((sum,x)=>sum+x.intensity,0)/all.length:0;return `<div class="trend-col"><span>${m?weather[m.weather]:''}</span><div class="trend-bar" style="height:${average?average*22:3}px"></div><span>${d.getMonth()+1}/${d.getDate()}</span></div>`}).join('')}</div><p class="hint">柱高为当天全部记录的平均强度（1～5），不代表心情好坏。天气图标取当天最新记录。</p></section></div><section class="card" style="margin-top:22px"><h2>生活的不同切面</h2>${[...new Set([...ScheduleParser.categories,...ts.map(t=>t.category)])].map(c=>{let total=ts.filter(x=>x.category===c),done=total.filter(x=>x.done).length;return `<div class="bar-row"><span>${c}</span><div class="bar-track"><div class="bar-fill" style="width:${total.length?done/total.length*100:0}%"></div></div><span>${done}/${total.length}</span></div>`}).join('')}<p class="hint">按日程日期统计完成情况。数据只描述记录，不作心理诊断。</p></section>`}
function render(){if(globalThis.TianqingAuth?.enabled&&!TianqingAuth.user)return;page=location.hash.slice(1)||'home';if(!pages.some(x=>x[0]===page))page='home';$('#nav').innerHTML=pages.map(([id,icon,title])=>`<a href="#${id}" class="${page===id?'active':''}"><span class="nav-icon">${icon}</span>${title}</a>`).join('');$('#breadcrumb').textContent=pages.find(x=>x[0]===page)[2];$('#date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});$('#app').innerHTML=({home,mood:moodPage,tasks:taskPage,calendar:calendarPage,report,profile:()=>TianqingProfile.render()})[page]();if($('#quick-form'))$('#quick-form').onsubmit=e=>{e.preventDefault();generate($('#quick-input').value)};if(page==='profile')TianqingProfile.mount();}
function moodForm(id=null,day=today()){
 const existing=data.moods.find(x=>x.id===id),m=existing||{id:uid(),date:day,weather:0,intensity:3,note:'',tag:'日常',images:[]};
 const time=existing?(m.timeUnknown?'':new Date(m.recordedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false})):new Date().toTimeString().slice(0,5);
 let attachments=structuredClone(m.images);
 modal(`<h2>${existing?'编辑这条心情':'记录此刻的天气'}</h2><form id="mood-form"><div class="form-grid"><label class="field">日期<input name="date" type="date" value="${esc(m.date)}" max="${today()}" required></label><label class="field">时间（可留空）<input name="time" type="time" value="${time}"></label></div><input type="hidden" name="weather" value="${m.weather}"><div class="weather-list">${weather.map((w,i)=>'<button type="button" class="weather-btn '+(i===m.weather?'selected':'')+'" data-weather="'+i+'"><span>'+w+'</span>'+names[i]+'</button>').join('')}</div>${intensityPicker(m.intensity,m.weather)}<label class="field">今天与什么有关？<select name="tag">${['日常','学习','朋友','家庭','运动','睡眠',m.tag].filter((v,i,a)=>a.indexOf(v)===i).map(t=>'<option '+(m.tag===t?'selected':'')+'>'+esc(t)+'</option>').join('')}</select></label><label class="field">写给自己的一点话<textarea name="note" maxlength="2000" placeholder="发生了什么？此刻的你感觉如何？">${esc(m.note)}</textarea></label><div id="mood-image-editor"></div><p class="hint">一天可记录多次；编辑和删除只影响这一条。</p>${actions('保存心情')}</form>`);
 document.querySelectorAll('[name=intensity]').forEach(input=>input.onchange=()=>{const value=+input.value;$('#intensity-value').value=intensityDescriptions[value-1]+' · '+value+' / 5';});
 document.querySelectorAll('.weather-btn').forEach(b=>b.onclick=()=>{$('[name=weather]').value=b.dataset.weather;updateIntensityEmotion(+b.dataset.weather);document.querySelectorAll('.weather-btn').forEach(x=>x.classList.toggle('selected',x===b));});
 const imageEditor=JournalImages.mount($('#mood-image-editor'),attachments,next=>{
  const candidate=structuredClone(data),copy={...m,images:next};
  candidate.moods=candidate.moods.filter(x=>x.id!==m.id);candidate.moods.push(copy);
  TianqingStorage.serialize(candidate);attachments=next;
 });
 modalCleanup=()=>imageEditor.dispose();
 $('#mood-form').onsubmit=async e=>{
  e.preventDefault();if(imageEditor.busy){toast('图片正在压缩，请稍候再保存');return;}const button=e.submitter;if(button)button.disabled=true;
  try{
   const v=Object.fromEntries(new FormData(e.target)),now=new Date().toISOString();
   v.id=m.id;v.weather=+v.weather;v.intensity=+v.intensity;v.timeUnknown=!v.time;
   v.recordedAt=v.time?new Date(v.date+'T'+v.time).toISOString():v.date+'T00:00:00.000Z';delete v.time;
   v.createdAt=existing?.createdAt||now;v.updatedAt=now;v.images=attachments;
   if(await mutate(d=>{const index=d.moods.findIndex(x=>x.id===v.id);if(index<0)d.moods.push(v);else d.moods[index]=v;})){closeModal();toast('心情已收藏');}
  }finally{if(button)button.disabled=false;}
 };
}
function taskForm(id,date=today(),draft){
 const t=draft||data.tasks.find(x=>x.id===id)||{title:'',date,time:'',category:'学习',important:true,urgent:false,duration:0,reminder:0,note:'',done:false};
 const q=TianqingStorage.quadrant(t),recent=data.preferences?.recentCategories||[],isCustom=!ScheduleParser.categories.includes(t.category);
 const categories=[...new Set([...ScheduleParser.categories.filter(c=>c!=='其他'),...recent,...(isCustom?[t.category]:[])])];
 modal(`<h2>${draft?'确认识别结果 · 日程草稿':id?'编辑日程':'新建一件小事'}</h2>${draft?'<p class="notice">已识别出标题、日期和时间。请检查下方字段，确认后才会添加。</p>':''}${draft?.warnings?.length?'<p class="notice">'+draft.warnings.map(esc).join('；')+'</p>':''}<form id="task-form"><label class="field">日程标题<input name="title" maxlength="100" required value="${esc(t.title)}" placeholder="准备做些什么？"></label><div class="form-grid"><label class="field">日期<input name="date" type="date" required value="${esc(t.date)}"></label><label class="field">时间（留空为全天）<input name="time" type="time" value="${esc(t.time)}"></label><label class="field full">分类<select id="task-category" name="category" onchange="toggleCategory()">${categories.map(c=>'<option '+(c===t.category?'selected':'')+' value="'+esc(c)+'">'+esc(c)+'</option>').join('')}<option value="__custom__" ${t.category==='其他'?'selected':''}>其他（自定义）</option></select></label><label class="field full" id="custom-category-field" ${t.category==='其他'?'':'hidden'}>自定义分类名（留空为其他）<input id="custom-category" maxlength="30" list="recent-categories" placeholder="例如：社团、毕业设计、宠物" ><datalist id="recent-categories">${recent.map(c=>'<option value="'+esc(c)+'"></option>').join('')}</datalist><small class="hint">最近使用的分类会保留在分类菜单中。</small></label></div><fieldset class="quadrant-field"><legend>四象限 · 是否重要 × 是否紧急</legend><div class="quadrant-grid">${quadrants.map(([key,label,hint])=>'<label class="quadrant-choice q'+key+'"><input type="radio" name="quadrant" value="'+key+'" '+(key===q.key?'checked':'')+'><span><strong>'+label+'</strong><small>'+hint+'</small></span></label>').join('')}</div></fieldset><div class="form-grid"><label class="field">时长（分钟）<input name="duration" type="number" min="0" max="1440" value="${t.duration||0}"></label><label class="field">提前提醒（分钟）<input name="reminder" type="number" min="0" max="10080" value="${t.reminder||0}"></label></div><label class="field">备注<textarea name="note" maxlength="2000">${esc(t.note)}</textarea></label><p class="hint">提醒仅在网页打开时显示，相同时间的安排会提示冲突。</p>${actions(draft?'确认添加':'保存日程')}</form>`);
 $('#task-form').onsubmit=async e=>{
  e.preventDefault();const button=e.submitter;if(button)button.disabled=true;
  try{
   let v=Object.fromEntries(new FormData(e.target));v.title=v.title.trim();if(!v.title){toast('请填写日程标题');return;}
   v.category=v.category==='__custom__'?($('#custom-category').value.trim()||'其他'):v.category;
   if(!v.category){toast('请填写自定义分类名');return;}
   v.important=v.quadrant[0]==='1';v.urgent=v.quadrant[1]==='1';delete v.quadrant;
   v.duration=+v.duration;v.reminder=+v.reminder;v.done=t.done;v.id=id||uid();
   const minutes=s=>+s.slice(0,2)*60 + +s.slice(3);
   const clash=data.tasks.some(x=>x.id!==id&&x.date===v.date&&x.time&&v.time&&!x.done&&minutes(x.time)<minutes(v.time)+Math.max(1,v.duration)&&minutes(v.time)<minutes(x.time)+Math.max(1,x.duration||0));
   if(clash&&!confirm('这个时间已有日程，仍要添加吗？'))return;
   if(await mutate(d=>{
    d.tasks=d.tasks.filter(x=>x.id!==v.id);d.tasks.push(v);
    if(!ScheduleParser.categories.includes(v.category))d.preferences.recentCategories=[v.category,...d.preferences.recentCategories.filter(c=>c!==v.category)].slice(0,8);
   })){closeModal(false);toast('日程已保存');nextDraft();}
  }finally{if(button)button.disabled=false;}
 };
}
let drafts=[];function generate(text){
 try{
  if(!text.trim())return toast('请先输入一句安排，例如：明天 8:40 高等数学');
  drafts=ScheduleParser.parse(text);
  if(!drafts.length)return toast('没有识别出日程，请补充要做的事情。');
  if(drafts.length>10){drafts=[];return toast('每次最多生成 10 条日程');}
  const first=drafts.shift();taskForm(null,null,first);
 }catch(err){drafts=[];toast('解析失败，请换一种表达或手动新建日程。');}
}
function nextDraft(){if(drafts.length){let draft=drafts.shift();setTimeout(()=>taskForm(null,null,draft),100)}}
$('#modal').addEventListener('cancel',()=>{drafts=[];stopBreathing()});
$('#modal').addEventListener('close',()=>{stopBreathing();cleanupModal();});
async function toggleTask(id){await mutate(d=>{let t=d.tasks.find(x=>x.id===id);t.done=!t.done})}
async function deleteItem(type,id){if(!confirm('确认删除这条'+(type==='tasks'?'日程':'心情记录')+'吗？'))return;if(await mutate(d=>d[type]=d[type].filter(x=>x.id!==id)))toast('已删除')}
function breathe(){
 modal(`<h2>给自己一分钟</h2><p class="subtitle">变大时吸气，变小时呼气。表情变化和涟漪提示换气。</p><div class="form-grid"><label class="field">吸气时长<select id="inhale-seconds">${[2,3,4,5,6,7,8].map(n=>'<option '+(n===4?'selected':'')+' value="'+n+'">'+n+' 秒</option>').join('')}</select></label><label class="field">呼气时长<select id="exhale-seconds">${[2,3,4,5,6,7,8].map(n=>'<option '+(n===4?'selected':'')+' value="'+n+'">'+n+' 秒</option>').join('')}</select></label></div><button class="secondary" id="apply-breathing">应用节奏 / 重新开始</button><div class="breath-stage"><div class="breath-ripple"></div><div class="breath-circle"><span class="breath-face">🙂</span><strong class="breath-word" aria-live="polite">吸气</strong><small class="breath-count">4 秒</small></div></div><p class="breath-note">按舒服的节奏呼吸即可。减少动态效果模式下只显示文字与倒计时。</p><div class="actions"><button class="primary" onclick="closeModal()">结束练习</button></div>`);
 const initial=data.preferences.breathing;$('#inhale-seconds').value=String(initial.inhale);$('#exhale-seconds').value=String(initial.exhale);
 const start=()=>{stopBreathing();breathStop=Breathing.start(document.querySelector('.breath-stage'),+document.querySelector('#inhale-seconds').value,+document.querySelector('#exhale-seconds').value);};
 document.querySelector('#apply-breathing').onclick=async()=>{start();await mutate(d=>{d.preferences.breathing={inhale:+$('#inhale-seconds').value,exhale:+$('#exhale-seconds').value}});};start();
}
$('#export').onclick=()=>{const b=new Blob([JSON.stringify(data)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='心晴手账-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);toast('记录已导出')};
const notified=new Set();function reminders(){for(const t of data.tasks){if(t.done||!t.time||notified.has(t.id))continue;const due=new Date(t.date+'T'+t.time).getTime(),now=Date.now();if(now>=due-(t.reminder||0)*60000&&now<due+60000){notified.add(t.id);toast('日程提醒：'+t.title+'（'+t.time+'）')}}}
window.addEventListener('hashchange',render);
let reminderTimer;
async function load(){
 clearInterval(reminderTimer);
 try{
  data=TianqingStorage.validate(await TianqingRecords.load());render();reminders();reminderTimer=setInterval(reminders,15000);
 }catch(err){$('#app').innerHTML='<section class="card"><h1>暂时无法读取记录</h1><p>'+esc(err.message)+'</p><p>原始记录未覆盖，请保留原文件和备份。</p><button class="primary" onclick="location.reload()">重试</button></section>';}
}
if(globalThis.TianqingAuth?.enabled){
 TianqingAuth.start({onReady:load,onLock(){
  clearInterval(reminderTimer);notified.clear();closeModal();$('#modal-content').innerHTML='';
  data=TianqingStorage.validate({moods:[],tasks:[]});$('#app').innerHTML='';$('#nav').innerHTML='';$('#toast').style.display='none';$('#toast').textContent='';filter='all';
 }});
}else load();



$('#import').onclick=()=>$('#import-file').click();
$('#import-file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>5000000)throw Error('文件过大，请选择小于5MB的备份');const next=await JournalImages.checkBackup(TianqingStorage.validate(JSON.parse(await file.text())));TianqingStorage.serialize(next);if(!confirm('将导入 '+next.moods.length+' 条心情和 '+next.tasks.length+' 条日程，并替换当前记录。建议先导出备份，是否继续？'))return;if(await save(next))toast('记录已导入并自动保存')}catch(err){toast('导入失败：'+err.message)}};
$('#raw-export').onclick=()=>{if(globalThis.TianqingAuth?.enabled)return toast('请用导出我的记录备份当前账号；旧浏览器记录请在原来的浏览器版本中导出。');try{const raw=localStorage.getItem(TianqingStorage.KEY);if(raw===null)return toast('没有需要备份的浏览器记录');const u=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='心晴手账-原始备份-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}catch{toast('浏览器禁止访问本地存储')}};

// Refresh only the quote at local midnight; preserve unfinished forms.
let dailyQuoteTimer;
function refreshDailyQuote(){
  clearTimeout(dailyQuoteTimer);
  const quote=document.querySelector('.quote p');
  if(quote)quote.textContent='“'+DailyQuote.forDate()+'”';
  const now=new Date();
  dailyQuoteTimer=setTimeout(refreshDailyQuote,new Date(now.getFullYear(),now.getMonth(),now.getDate()+1)-now+100);
}
refreshDailyQuote();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDailyQuote()});

if(TianqingRecords.accounts){
 document.querySelector('.local-label').textContent='账号独立保存 · 多设备登录读取';
 document.querySelector('.data-tools p').textContent='记录保存在当前服务器的独立账号中。旧浏览器或本机日记不会自动导入；请在原来的版本导出备份，登录自己的账号后导入。建议定期导出个人备份。';
 document.querySelector('#raw-export').hidden=true;
 document.querySelectorAll('.data-tools button').forEach(button=>{if(button.textContent==='导出原始数据'){button.hidden=true;}});
}else if(TianqingRecords.desktop){
 document.querySelector('.local-label').textContent='本机自动保存 · 下次自动恢复';
 document.querySelector('.data-tools p').textContent='已启用本机自动保存，记录单独保存在配置的服务器数据目录；下次启动自动恢复。导入仅用于迁移，建议定期导出备份。';
 document.querySelector('#raw-export').textContent='导出旧浏览器数据';
}

function viewMoodPhoto(id,index){
 const mood=data.moods.find(m=>m.id===id),image=mood?.images[index];if(!image)return;
 modal('<h2>心情照片</h2><img class="photo-full" src="'+image.dataUrl+'" alt="心情照片"><p class="hint">'+esc(mood.date)+' · '+moodClock(mood)+'</p><div class="actions"><button type="button" class="primary" onclick="closeModal()">关闭照片</button></div>');
}

(function(global){
const categories=['学习','工作','生活','运动','娱乐','健康','社交','家庭','其他'];
function classify(title){
 const rules=[
  ['健康',/体检|看病|就医|复诊|挂号|医院|牙医|吃药|服药|心理咨询/],
  ['家庭',/家人|父母|爸爸|妈妈|孩子|亲子|接娃|家长会|探亲|家庭/],
  ['社交',/聚会|聚餐|朋友|同学聚|约会|拜访|社交/],
  ['工作',/工作|上班|开会|会议|客户|汇报|周报|日报|出差|面试|项目评审/],
  ['学习',/学习|复习|作业|英语|数学|语文|物理|化学|考试|图书馆|上课|课程|背单词|阅读|读书/],
  ['运动',/跑步|运动|散步|健身|游泳|瑜伽|骑行|打球|篮球|足球|羽毛球/],
  ['娱乐',/电影|游戏|娱乐|追剧|音乐会|演唱会|看展|旅行/],
  ['生活',/买菜|购物|打扫|洗衣|做饭|缴费|取快递|理发|生活/]
 ];
 return rules.find(([,pattern])=>pattern.test(title))?.[0]||'其他';
}
function localDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function number(s){if(/^\d+$/.test(s))return +s;const n={'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};if(s.includes('十')){let [a,b]=s.split('十');return (a?n[a]:1)*10+(b?n[b]:0);}return n[s];}
function parse(text,now=new Date()){
 if(typeof text!=='string'||!text.trim())return [];
 if(text.length>500)throw Error('输入最多500字');
 return text.split(/[；;\n]|然后|接着/).map(s=>s.trim()).filter(Boolean).map(raw=>{
  let s=raw,d=new Date(now.getFullYear(),now.getMonth(),now.getDate()),matched=false,warnings=[];
  const full=s.match(/(\d{4})[-年/](\d{1,2})[-月/](\d{1,2})日?/),md=s.match(/(\d{1,2})月(\d{1,2})[日号]?/),week=s.match(/(下|本|这)?(?:周|星期)([一二三四五六日天])/);
  if(full){d=new Date(+full[1],+full[2]-1,+full[3]);if(d.getFullYear()!==+full[1]||d.getMonth()!==+full[2]-1||d.getDate()!==+full[3])warnings.push('日期无效，请手动修改');s=s.replace(full[0],'');matched=true;}
  else if(md){d=new Date(now.getFullYear(),+md[1]-1,+md[2]);if(d.getMonth()!==+md[1]-1||d.getDate()!==+md[2])warnings.push('日期无效，请手动修改');s=s.replace(md[0],'');matched=true;}
  else if(/今天|明天|后天/.test(s)){const m=s.match(/今天|明天|后天/)[0];d.setDate(d.getDate()+({'今天':0,'明天':1,'后天':2}[m]));s=s.replace(m,'');matched=true;}
  else if(week){let target='日一二三四五六'.indexOf(week[2]==='天'?'日':week[2]);let delta=target-d.getDay();if(week[1]==='下')delta=((target+6)%7)-((d.getDay()+6)%7)+7;else if(!week[1]&&delta<0)delta+=7;d.setDate(d.getDate()+delta);s=s.replace(week[0],'');matched=true;}
  if(!matched)warnings.push('未指定日期，暂设为今天');
  let reminder=0;const rem=s.match(/(?:提醒我)?提前([\d一二两三四五六七八九十]+)分钟(?:提醒|准备)?/);if(rem){reminder=number(rem[1]);s=s.replace(rem[0],'');}
  let time='';const tm=s.match(/(凌晨|早上|上午|中午|下午|晚上|傍晚)?\s*([\d一二两三四五六七八九十]+)(?:[:：]([0-9]{1,2})|[点时](半|一刻|三刻|[\d一二两三四五六七八九十]+分?)?)/);
  if(tm){let h=number(tm[2]),min=tm[3]?+tm[3]:tm[4]==='半'?30:tm[4]==='一刻'?15:tm[4]==='三刻'?45:tm[4]?number(tm[4].replace('分','')):0;if(/下午|晚上|傍晚/.test(tm[1]||'')&&h<12)h+=12;if(tm[1]==='中午'&&h<11)h+=12;if(tm[1]==='凌晨'&&h===12)h=0;if(h>23||min>59)warnings.push('时间无效，请手动修改');else time=`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;s=s.replace(tm[0],'');}
  else if(/早上|上午|中午|下午|晚上|傍晚/.test(s))warnings.push('时间不明确，请补充具体时间');
  let duration=0;const du=s.match(/(半小时|([\d一二两三四五六七八九十]+)(小时|分钟))/);if(du){duration=du[1]==='半小时'?30:number(du[2])*(du[3]==='小时'?60:1);s=s.replace(du[0],'');}
  const important=/不重要/.test(raw)?false:/重要/.test(raw)?true:true;
  const urgent=/不紧急|不急/.test(raw)?false:/紧急|加急/.test(raw);
  s=s.replace(/重要且紧急|重要不紧急|紧急不重要|不重要不紧急|不重要|不紧急|重要|紧急|加急/g,'');
  let title=s.replace(/提醒我|帮我|安排(?:一下)?|，|。/g,'').trim()||'待命名日程';
  return {title,date:localDate(d),time,category:classify(title),important,urgent,priority:important?(urgent?'高':'中'):'低',duration,reminder,note:raw,done:false,warnings};
 }).filter(t=>t.title!=='待命名日程'&&/[\p{L}\p{N}]/u.test(t.title));
}
if(typeof module!=='undefined')module.exports={parse,localDate,categories,classify};else global.ScheduleParser={parse,localDate,categories,classify};
})(globalThis);

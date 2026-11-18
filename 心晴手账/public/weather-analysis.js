(function(global){
 const weatherNames=['晴天','多云','阴天','雨天','雷雨'];
 function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
 function shift(d,days){const result=new Date(d.getFullYear(),d.getMonth(),d.getDate());result.setDate(result.getDate()+days);return result;}
 function groupDays(moods){
  const days=new Map();for(const mood of moods){if(!days.has(mood.date))days.set(mood.date,[]);days.get(mood.date).push(mood);}
  return days;
 }
 function averageDays(days){
  if(!days.size)return null;
  return [...days.values()].reduce((sum,records)=>sum+records.reduce((total,m)=>total+(Number.isFinite(m.intensity)?Math.max(1,Math.min(5,m.intensity)):3),0)/records.length,0)/days.size;
 }
 function analyze(data,{period=7,now=new Date()}={}){
  period=period===30?30:7;
  const endDate=new Date(now.getFullYear(),now.getMonth(),now.getDate()),startDate=shift(endDate,1-period);
  const start=dateKey(startDate),end=dateKey(endDate),previousEnd=dateKey(shift(startDate,-1)),previousStart=dateKey(shift(startDate,-period));
  const allMoods=Array.isArray(data.moods)?data.moods:[],allTasks=Array.isArray(data.tasks)?data.tasks:[];
  const inRange=(record,from,to)=>record.date>=from&&record.date<=to;
  const validMood=m=>Number.isInteger(m.weather)&&m.weather>=0&&m.weather<5;
  const moods=allMoods.filter(m=>validMood(m)&&inRange(m,start,end)),previous=allMoods.filter(m=>validMood(m)&&inRange(m,previousStart,previousEnd));
  const tasks=allTasks.filter(t=>inRange(t,start,end));
  const days=groupDays(moods),previousDays=groupDays(previous);
  const counts=weatherNames.map((_,i)=>moods.filter(m=>m.weather===i).length),peak=Math.max(...counts);
  const dominant=peak?counts.map((n,i)=>n===peak?i:-1).filter(i=>i>=0):[];
  const dailyAverage=averageDays(days),previousAverage=averageDays(previousDays);
  const mixedDays=[...days.values()].filter(records=>new Set(records.map(m=>m.weather)).size>1).length;
  const completed=tasks.filter(t=>t.done).length;
  const pendingUrgent=tasks.filter(t=>!t.done&&(typeof t.important==='boolean'?t.important:t.priority!=='低')&&(typeof t.urgent==='boolean'?t.urgent:t.priority==='高')).length;
  const insights=[],suggestions=[];
  if(moods.length){
   const common=dominant.map(i=>weatherNames[i]).join('、');
   insights.push({icon:'☁',title:'最常记录的天气',text:dominant.length===1?`${common}出现 ${peak} 次，占本期 ${moods.length} 条心情的 ${Math.round(peak/moods.length*100)}%。`:`${common}并列最多，各 ${peak} 次；这段时间记录了 ${counts.filter(Boolean).length} 种天气。`});
   let strength=`按记录日等权计算，本期平均强度为 ${dailyAverage.toFixed(1)} / 5。`;
   if(days.size>=3&&previousDays.size>=3){
    const difference=dailyAverage-previousAverage;
    strength+=Math.abs(difference)<.3?`与上一周期的 ${previousAverage.toFixed(1)} / 5 相差不大。`:`比上一周期${difference>0?'高':'低'} ${Math.abs(difference).toFixed(1)} 分。`;
    strength+='强度表示感受有多明显，不表示心情变好或变差。';
   }else strength+='当前或上一周期不足 3 个记录日，暂不判断强度变化。';
   insights.push({icon:'◉',title:'感受的强弱',text:strength});
   insights.push({icon:'✎',title:'记录的节奏',text:`${period} 天中有 ${days.size} 天留下记录，共 ${moods.length} 条。`+(mixedDays?`其中 ${mixedDays} 天记录了不止一种天气，一天可以有多种感受。`:'没有记录的日期保持空白，不能据此推断当天心情。')});
  }else{
   insights.push({icon:'☁',title:'天气还在等待记录',text:`近 ${period} 天没有心情记录。你可以先记下一刻的感受，之后再来看自己的天气。`});
   insights.push({icon:'◉',title:'感受的强弱',text:'有记录后会显示平均强度；与上一周期比较时，两边均需至少 3 个不同的记录日。'});
   insights.push({icon:'✎',title:'记录的节奏',text:`本期记录覆盖 0 / ${period} 天。空白不代表晴天，也不代表心情平静。`});
  }
  insights.push({icon:'✓',title:'生活的小计划',text:tasks.length?`本期 ${tasks.length} 项日程已完成 ${completed} 项，完成率 ${Math.round(completed/tasks.length*100)}%。`+(pendingUrgent?`还有 ${pendingUrgent} 项“重要且紧急”的日程待完成。`:'目前没有“重要且紧急”的待办。'):'本期没有日程记录。可以从一件小事开始，也可以给自己留白。'});
  if(days.size<3)suggestions.push({text:'先积累几个不同日期的记录，再比较变化；不必为了填满日历而打卡。',action:'mood',label:'记录此刻心情'});
  if(pendingUrgent)suggestions.push({text:`可以先查看这 ${pendingUrgent} 项重要且紧急的待办，挑一件安排下一步。`,action:'tasks',label:'查看待办'});
  if(days.size>=3){
   const difficult=counts[3]+counts[4];
   suggestions.push({text:difficult>=moods.length/2?'本期雨天和雷雨记录较多。如果愿意，可以写下自己此刻需要什么，或留一小段休息时间。':'可以回看一条印象深的记录，记下当时发生了什么，让下次回顾更有线索。',action:'calendar',label:'回看日历'});
  }else if(!suggestions.some(s=>s.action==='tasks'))suggestions.push({text:'给今天留一点余地：安排一件小事，也给休息留个位置。',action:'tasks',label:'看看日程'});
  return {period,start,end,previousStart,previousEnd,recordCount:moods.length,recordedDays:days.size,previousRecordedDays:previousDays.size,coverage:Math.round(days.size/period*100),dailyAverage,previousAverage,dominant,weatherCounts:counts,mixedDays,taskCount:tasks.length,completed,pendingUrgent,insights,suggestions,
   summary:moods.length?`这 ${period} 天，你在 ${days.size} 个日子里留下了 ${moods.length} 条心情。${days.size<3?'样本还少，先看看已记录的片段。':'每一种天气，都在组成你的生活。'}`:`近 ${period} 天还没有心情记录。先记录，再慢慢发现自己的节奏。`};
 }
 const api={analyze};if(typeof module!=='undefined')module.exports=api;else global.WeatherAnalysis=api;
})(globalThis);

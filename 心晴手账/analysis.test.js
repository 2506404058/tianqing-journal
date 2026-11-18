const {test}=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('./public/weather-analysis');const now=new Date(2026,10,17,23,30);
const mood=(date,weather=0,intensity=3)=>({date,weather,intensity});
test('空数据明确显示不足，不编造平均值或完成率',()=>{
 const result=analyze({moods:[],tasks:[]},{now});assert.equal(result.dailyAverage,null);assert.equal(result.coverage,0);assert.equal(result.taskCount,0);assert.match(result.summary,/没有心情记录/);assert.ok(result.insights.every(x=>!x.text.includes('NaN')));
});
test('严格按本地日期筛选本期和上一周期，排除未来记录',()=>{
 const result=analyze({moods:[mood('2026-11-10'),mood('2026-11-11'),mood('2026-11-17'),mood('2026-11-18')],tasks:[]},{now});
 assert.equal(result.start,'2026-11-11');assert.equal(result.end,'2026-11-17');assert.equal(result.previousStart,'2026-11-04');assert.equal(result.previousEnd,'2026-11-10');assert.equal(result.recordCount,2);assert.equal(result.previousRecordedDays,1);
});
test('同日多条计入次数，覆盖天数去重，强度按日期等权',()=>{
 const records={moods:[mood('2026-11-16',0,1),mood('2026-11-16',3,3),mood('2026-11-16',3,5),mood('2026-11-17',0,5)],tasks:[]};const copy=structuredClone(records);
 const result=analyze(records,{now});assert.equal(result.recordedDays,2);assert.equal(result.recordCount,4);assert.equal(result.mixedDays,1);assert.equal(result.dailyAverage,4);assert.deepEqual(result.dominant,[0,3]);assert.match(result.insights[0].text,/并列/);assert.match(result.insights[1].text,/不足 3/);assert.deepEqual(records,copy);
});
test('两期记录足够时才比较强度，不把强烈等同于变差',()=>{
 const current=['2026-11-15','2026-11-16','2026-11-17'].map(d=>mood(d,0,5));const previous=['2026-11-08','2026-11-09','2026-11-10'].map(d=>mood(d,0,2));
 const result=analyze({moods:[...current,...previous],tasks:[]},{now});assert.equal(result.dailyAverage,5);assert.equal(result.previousAverage,2);assert.match(result.insights[1].text,/高 3.0 分/);assert.match(result.insights[1].text,/不表示心情变好或变差/);
});
test('日程统计兼容旧优先级，新布尔字段优先',()=>{
 const tasks=[{date:'2026-11-17',priority:'高',done:false},{date:'2026-11-17',priority:'高',important:false,urgent:true,done:false},{date:'2026-11-17',priority:'中',done:true},{date:'2026-11-18',priority:'高',done:false}];
 const result=analyze({moods:[],tasks},{now});assert.equal(result.taskCount,3);assert.equal(result.completed,1);assert.equal(result.pendingUrgent,1);assert.match(result.insights[3].text,/33%/);
});
test('30天窗口跨月跨年仍正确，有日程也可独立分析',()=>{
 const result=analyze({moods:[],tasks:[{date:'2026-12-31',done:true}]},{period:30,now:new Date(2027,0,2)});assert.equal(result.start,'2026-12-04');assert.equal(result.previousEnd,'2026-12-03');assert.equal(result.previousStart,'2026-11-04');assert.equal(result.taskCount,1);assert.match(result.insights[3].text,/100%/);
});

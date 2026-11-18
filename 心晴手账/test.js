const {test}=require('node:test'),assert=require('node:assert/strict');const {parse}=require('./public/parser');const now=new Date(2026,10,15,12);
test('中文时间、日期、分类和提前提醒',()=>{const [t]=parse('明天下午三点去图书馆复习英语，提醒我提前十分钟准备',now);assert.equal(t.date,'2026-11-16');assert.equal(t.time,'15:00');assert.equal(t.reminder,10);assert.equal(t.title,'去图书馆复习英语');assert.equal(t.category,'学习')});
test('周五晚间与时长',()=>{const [t]=parse('周五晚上七点跑步半小时',now);assert.equal(t.date,'2026-11-20');assert.equal(t.time,'19:00');assert.equal(t.duration,30)});
test('全天任务与多条日程',()=>{const ts=parse('明天交作业；后天上午九点半考试',now);assert.equal(ts.length,2);assert.equal(ts[0].time,'');assert.equal(ts[1].time,'09:30');assert.equal(ts[1].date,'2026-11-17')});
test('模糊时间与无效日期不悄悄接受',()=>{assert.ok(parse('晚上看书',now)[0].warnings.length);assert.ok(parse('2026-02-30去看展',now)[0].warnings.some(s=>s.includes('日期无效')))});
test('零点、24小时格式、跨年',()=>{assert.equal(parse('明天凌晨十二点休息',now)[0].time,'00:00');assert.equal(parse('明天15:20开会',now)[0].time,'15:20');assert.equal(parse('明天跑步',new Date(2026,11,31))[0].date,'2027-01-01')});

(function(global){
  // Original local collection: no network requests or personal data required.
  const sentences=[
    '不必每天都晴朗，阴天也可以慢慢生长。',
    '今天走得慢一点，也依然是在向前。',
    '给自己留一点空白，让心情透透气。',
    '把今天过成自己的节奏，就已经很好。',
    '休息不是落后，是给明天攒一点力气。',
    '有些答案，可以等一阵风来的时候再想。',
    '小小的完成，也值得一个认真的肯定。',
    '暂时没有方向的时候，先照顾好自己。',
    '生活不必排得太满，也留一格给惊喜。',
    '一杯温水，一次深呼吸，都是温柔的开始。',
    '心里下雨的时候，可以先找个地方歇一歇。',
    '今天的你，不需要交出满分答卷。',
    '那些不起眼的小事，也在悄悄撑住生活。',
    '允许自己重新开始，不用等到下个星期一。',
    '把目光收回此刻，先做好眼前的一件小事。',
    '有空的时候，去看看窗外的天空。',
    '认真吃饭、好好睡觉，也是值得安排的大事。',
    '不急着赶路，也能发现沿途的好风景。',
    '有些日子适合出发，有些日子适合扎根。',
    '心情不用立刻变好，先被好好听见就好。',
    '给今天一个拥抱，再慢慢走向明天。',
    '你可以为努力过的自己，留下一点掌声。',
    '把担心放轻一点，把呼吸放慢一点。',
    '没有特别的事情发生，也可以是安稳的一天。',
    '今天的一点点勇气，会成为明天的底气。',
    '难过的时候，不必勉强自己笑得很用力。',
    '把喜欢的小事，放进今天的日程里。',
    '事情可以一件件做，日子可以一天天过。',
    '不需要和谁同步，你有自己的花期。',
    '向别人温柔之前，也别忘记照顾自己。',
    '如果有点累，就把今天的目标调小一点。',
    '一个平凡的下午，也值得被认真收藏。',
    '不用把每一分钟，都变成有用的事情。',
    '先听一听自己的感受，再决定下一步。',
    '偶尔停下来，才能听见心里的声音。',
    '把今天的烦恼写下来，给心腾一点位置。',
    '和自己相处的时候，也可以多一点耐心。',
    '晴朗可以是大太阳，也可以是一点小欢喜。',
    '走过的每一步，都有它自己的意义。',
    '今天不够顺利，也不妨碍明天重新尝试。'
  ];
  // A fixed seeded shuffle gives a random-looking daily order without repeats
  // until the collection is exhausted, stable across reloads and DST changes.
  const order=sentences.map((_,i)=>i);
  let seed=20261115;
  for(let i=order.length-1;i>0;i--){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const j=seed%(i+1);[order[i],order[j]]=[order[j],order[i]];
  }
  function forDate(date=new Date()){
    if(!(date instanceof Date)||Number.isNaN(date.getTime()))throw new TypeError('Invalid date');
    const day=Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
    return sentences[order[((day%order.length)+order.length)%order.length]];
  }
  const api={forDate,count:sentences.length};
  if(typeof module!=='undefined')module.exports=api;else global.DailyQuote=api;
})(globalThis);

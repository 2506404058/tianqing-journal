(function(global){
 function phaseAt(elapsed,inhale=4,exhale=4){
  const t=((Math.max(0,elapsed)/1000)%(inhale+exhale));
  const breathingIn=t<inhale;
  const progress=breathingIn?t/inhale:(t-inhale)/exhale;
  return {phase:breathingIn?'inhale':'exhale',label:breathingIn?'吸气':'呼气',face:breathingIn?'🙂':'😌',remaining:Math.ceil((breathingIn?inhale:exhale)*(1-progress)),scale:breathingIn?.7+.6*progress:1.3-.6*progress};
 }
 function start(root,inhale=4,exhale=4){
  const start=performance.now(),media=matchMedia('(prefers-reduced-motion: reduce)');
  let frame,phase='',lastSecond=-1;
  const circle=root.querySelector('.breath-circle'),word=root.querySelector('.breath-word'),face=root.querySelector('.breath-face'),count=root.querySelector('.breath-count');
  function tick(now){
   const state=phaseAt(now-start,inhale,exhale);
   if(state.phase!==phase){
    phase=state.phase;word.textContent=state.label;face.textContent=state.face;
    root.classList.remove('phase-pulse');void root.offsetWidth;root.classList.add('phase-pulse');
    root.dataset.phase=phase;
   }
   if(state.remaining!==lastSecond){lastSecond=state.remaining;count.textContent=state.remaining+' 秒';}
   circle.style.transform=media.matches?'none':`scale(${state.scale})`;
   frame=requestAnimationFrame(tick);
  }
  frame=requestAnimationFrame(tick);
  return ()=>cancelAnimationFrame(frame);
 }
 const api={phaseAt,start};if(typeof module!=='undefined')module.exports=api;else global.Breathing=api;
})(globalThis);

const SHOWROOM_URL='/showroom.html';
const VIEWS=[['room','The guitars'],['amps','Listening lounge'],['cabinets','Cabinet wall']];

export function showroomPreviewMarkup(){
 return `<section class="at-section at-showroom" id="at-showroom" aria-labelledby="at-showroom-title">
  <div class="at-section-heading"><div><span class="at-kicker">STEP INSIDE / THE VIRTUAL SHOWROOM</span><h2 id="at-showroom-title">Your first look inside.</h2></div><p>Meet the guitars. Explore the listening lounge. Then step into the full room and make one your own.</p></div>
  <div class="at-showroom-card">
   <div class="at-showroom-stage">
    <div class="at-showroom-poster" aria-hidden="true"><img class="at-showroom-backdrop" src="/assets/room.jpg" alt="" loading="lazy" width="1672" height="941"><div class="at-showroom-guitars">${['sphyx','oryx','matadaur'].map(id=>`<img src="/assets/default-${id}.png?v=21" alt="" loading="lazy" width="300" height="900">`).join('')}</div></div>
    <div class="at-showroom-live" aria-hidden="true"></div>
    <span class="at-showroom-badge" aria-hidden="true">360° / FOSTINIS SHOWROOM</span>
    <a class="at-showroom-open" href="${SHOWROOM_URL}" aria-label="Enter the full interactive Fostinis showroom"><span>Enter the showroom <span aria-hidden="true">↗</span><small>Open the full experience</small></span></a>
   </div>
   <div class="at-showroom-toolbar"><div class="at-showroom-views" role="group" aria-label="Choose a showroom preview angle">${VIEWS.map(([id,label],i)=>`<button type="button" data-room-view="${id}" aria-pressed="${i===0}" disabled>${label}</button>`).join('')}</div><button type="button" class="at-text-link at-showroom-load" hidden>Activate 3D preview ↗</button><p class="at-showroom-status" role="status">A glimpse inside. Click the room to enter.</p></div>
  </div>
  <div class="at-showroom-caption"><span>SPHYX / ORYX / MATADAUR</span><div class="ws-home-entry"><a class="at-text-link" href="/atelier.html?view=workshop-tour">Visit the interactive workshop ↗</a><a class="at-text-link" href="${SHOWROOM_URL}">Explore the full showroom ↗</a></div></div>
 </section>`;
}

// Reuse the page's existing showroom canvas. No iframe, second scene, or separate
// model download: its normal visibility scheduler also pauses it off screen.
export function mountShowroomPreview(section){
 if(!section)return ()=>{};
 const live=section.querySelector('.at-showroom-live');
 const status=section.querySelector('.at-showroom-status');
 const activate=section.querySelector('.at-showroom-load');
 const buttons=[...section.querySelectorAll('[data-room-view]')];
 let observer,timer,frame,started=false,disposed=false;
 function ready(){
  const room=document.getElementById('virtual-room');
  if(disposed||!window.FostinisShowroom?.ready||!room)return false;
  clearTimeout(timer);observer?.disconnect();
  live.append(room);
  room.querySelector('.virtual-canvas')?.removeAttribute('tabindex');
  section.dataset.preview='ready';
  activate.hidden=true;
  buttons.forEach(button=>{button.disabled=false;button.setAttribute('aria-pressed',String(button.dataset.roomView==='room'));});
  status.textContent='Choose a view. Click the room to step inside.';
  // Let the moved canvas resize before fitting all three instruments to it.
  frame=requestAnimationFrame(()=>{if(!disposed)room.querySelector('[data-camera="room"]')?.click();});
  return true;
 }
 function unavailable(){
  if(disposed)return;
  clearTimeout(timer);observer?.disconnect();
  section.dataset.preview='unavailable';
  activate.hidden=true;
  buttons.forEach(button=>{button.disabled=true;});
  status.textContent='Click the room to explore the showroom and your design options.';
 }
 function start(){
  if(disposed||started||ready())return;
  started=true;observer?.disconnect();activate.hidden=true;
  status.textContent='Opening your 3D preview… You can enter the showroom at any time.';
  timer=setTimeout(()=>{if(!disposed&&section.dataset.preview!=='ready')status.textContent='The preview is taking a little longer. Click the room to enter the full showroom.';},45000);
  window.dispatchEvent(new CustomEvent('fostinis:playroom-open'));
 }
 function choose(event){
  const button=event.target.closest('[data-room-view]');
  if(!button||button.disabled||!section.contains(button))return;
  const control=live.querySelector(`[data-camera="${button.dataset.roomView}"]`);
  if(!control)return;
  control.click();
  buttons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  status.textContent=button.textContent+' preview. Click the room to step inside.';
 }
 window.addEventListener('fostinis:room-ready',ready);
 window.addEventListener('fostinis:3d-unavailable',unavailable);
 section.addEventListener('click',choose);
 activate.addEventListener('click',start);
 if(!ready()){
  if(navigator.connection?.saveData||!('IntersectionObserver' in window)){
   activate.hidden=false;
  }else{
   observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))start();},{rootMargin:'100px'});
   observer.observe(section.querySelector('.at-showroom-stage'));
  }
 }
 return ()=>{
  disposed=true;clearTimeout(timer);cancelAnimationFrame(frame);observer?.disconnect();
  window.removeEventListener('fostinis:room-ready',ready);
  window.removeEventListener('fostinis:3d-unavailable',unavailable);
  section.removeEventListener('click',choose);
  activate.removeEventListener('click',start);
 };
}

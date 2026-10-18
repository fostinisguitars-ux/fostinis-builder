import {esc,snapshot,modelName,prepareShowroom,link} from '../atelier/core.mjs';
import {FOSTINIS_VIDEOS} from '../atelier/videos.mjs';
import {BUILD_STAGES,WORKSHOP_STATIONS,TOP_WOODS,INLAYS,FRETBOARDS,applyWorkshopChoices} from './journey.mjs';

export function workshopMarkup(){
 const build=snapshot();
 return `<div class="ws-workshop" id="ws-experience">
  <div class="ws-intro"><div><span class="at-kicker">THE FOSTINIS WORKSHOP / COME CLOSER</span><h1>Before the first note.</h1><p>Good wood. Considered details. A guitar that becomes yours.<br>Pull up to the bench and explore the making of a Fostinis.</p></div><div class="ws-current"><span>ON THE BENCH</span><strong>${esc(build.nickname||modelName(build.model))}</strong><a href="/showroom.html#builder">Return to my design ↗</a></div></div>
  <div class="ws-journey" role="group" aria-label="Guitar construction stages">${BUILD_STAGES.map((stage,i)=>`<button type="button" data-ws-stage="${i}" aria-pressed="${i===0}"><span>0${i+1}</span>${stage.label}</button>`).join('')}</div>
  <div class="ws-main"><div class="ws-visual-column">
   <div class="ws-bench" aria-label="Explore the luthier workbench"><div class="ws-bench-fallback"><img src="/assets/heritage/home-gallery-3-05-1200.webp" alt="A Fostinis headstock on the workshop bench"><span>PREPARING YOUR PLACE AT THE BENCH</span></div><div class="ws-hotspots">${WORKSHOP_STATIONS.map(station=>`<button type="button" data-bench-hotspot="${station.id}" hidden aria-label="Explore ${station.name}"><span aria-hidden="true">＋</span>${station.short}</button>`).join('')}</div><span class="ws-bench-label">FOSTINIS / THE MAKING OF YOURS</span></div>
   <div class="ws-view-tools"><button type="button" data-ws-play disabled>Watch the build ▷</button><button type="button" data-ws-reset disabled>Whole bench</button><button type="button" data-ws-zoom="in" disabled aria-label="Zoom in on the workbench">＋</button><button type="button" data-ws-zoom="out" disabled aria-label="Zoom out from the workbench">−</button><label>Move the light<input type="range" min="-75" max="75" value="-30" data-ws-light disabled></label></div>
   <p class="ws-status" role="status">Preparing your configured guitar and tools…</p>
   <div class="ws-stage-copy"><span data-ws-step>01 / 06</span><div><h2 data-ws-title>${BUILD_STAGES[0].title}</h2><p data-ws-copy>${BUILD_STAGES[0].copy}</p><p class="ws-detail" data-ws-detail>${BUILD_STAGES[0].detail}</p></div><div class="ws-step-buttons"><button type="button" data-ws-prev disabled aria-label="Previous build stage">←</button><button type="button" data-ws-next aria-label="Next build stage">→</button></div></div>
   <p class="ws-process-note">An illustrated journey through your design. Actual workshop footage is below; updates on a commissioned guitar live in its private journal.</p>
  </div><aside class="ws-panel"><nav class="ws-stations" aria-label="Workshop stations">${WORKSHOP_STATIONS.map((station,i)=>`<button type="button" data-ws-station="${station.id}" aria-pressed="${i===0}">${station.short}</button>`).join('')}</nav><div class="ws-station-copy" data-ws-station-copy></div></aside></div>
  <div class="ws-carry"><div><span class="at-kicker">FROM THE BENCH TO YOUR BUILD</span><h2>Keep the details you love.</h2><p data-ws-selection></p><span class="ws-save-status" role="status">Workshop choices are a preview until you add them to your design.</span></div><div><button class="at-button at-primary" type="button" data-ws-apply>Add these choices to my design ↗</button><a class="at-text-link" href="/showroom.html#builder">Review my configuration & price ↗</a></div></div>
  <section class="ws-archive" aria-labelledby="ws-archive-title"><div><span class="at-kicker">FROM THE FOSTINIS WORKSHOP ARCHIVE</span><h2 id="ws-archive-title">The hands behind the instrument.</h2><p>Step from the illustrated bench into real Fostinis build footage.</p></div><div class="ws-films">${FOSTINIS_VIDEOS.filter(v=>v.category==='workshop').map(v=>`<article><button type="button" data-ws-film="${v.id}" aria-label="Watch ${esc(v.title)}"><img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="" loading="lazy"><span aria-hidden="true">▷</span><small>${v.duration}</small></button><h3>${esc(v.title)}</h3><p>${esc(v.note)}</p></article>`).join('')}</div><div class="ws-film-player" hidden></div></section>
 </div>`;
}

export function mountWorkshop(root){
 if(!root)return ()=>{};
 const base=snapshot(),F=window.Fostinis,choices={wood:base.selections.wood,inlays:base.selections.inlays,fretboard:base.selections.fretboard};
 let disposed=false,viewer,stage=0,station='wood',timer=null;
 const status=root.querySelector('.ws-status'),play=root.querySelector('[data-ws-play]'),saveStatus=root.querySelector('.ws-save-status');
 const names=(items,key)=>items.find(item=>item[0]===choices[key])?.[1]||choices[key];
 function summary(){root.querySelector('[data-ws-selection]').textContent=names(TOP_WOODS,'wood')+' · '+names(FRETBOARDS,'fretboard')+' · '+names(INLAYS,'inlays');}
 function choiceButtons(items,key){return `<div class="ws-choices" role="group" aria-label="Choose ${key}">${items.map(([id,name,image])=>`<button type="button" data-ws-choice="${key}" data-value="${id}" aria-pressed="${choices[key]===id}">${image?`<img src="/assets/${image}" alt="" loading="lazy">`:''}<span>${name}</span></button>`).join('')}</div>`;}
 function showStation(id,focus=false){
  const item=WORKSHOP_STATIONS.find(s=>s.id===id);if(!item)return;station=id;
  root.querySelectorAll('[data-ws-station]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wsStation===id)));
  root.querySelectorAll('[data-bench-hotspot]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.benchHotspot===id)));
  let extra='';
  if(id==='wood')extra=choiceButtons(TOP_WOODS,'wood')+'<a class="at-text-link" href="'+link('materials')+'">Explore full wood samples ↗</a>';
  if(id==='inlays')extra='<h3>Inlay appointments</h3>'+choiceButtons(INLAYS,'inlays')+'<h3>Fretboard</h3>'+choiceButtons(FRETBOARDS,'fretboard')+'<a class="at-text-link" href="/showroom.html#builder">Add custom inlay artwork ↗</a><p class="ws-fine">Use the special-request field beside Inlays in Fretboard & Details to attach your design.</p>';
  if(id==='chisel')extra='<button type="button" class="at-button" data-ws-focus="chisel">Examine the chisels ↗</button><button type="button" class="at-text-link" data-ws-goto="2">See the neck-fitting stage →</button>';
  if(id==='router')extra='<button type="button" class="at-button" data-ws-focus="router">Examine the router ↗</button><button type="button" class="at-text-link" data-ws-goto="1">See the shaped body →</button>';
  if(id==='plane')extra='<div class="ws-finish-toggle" role="group" aria-label="Compare raw and finished guitar"><button type="button" data-ws-goto="3">Bare wood</button><button type="button" data-ws-goto="4">Your finish</button></div><button type="button" class="at-text-link" data-ws-focus="plane">Examine the plane & materials ↗</button>';
  if(id==='setup')extra='<button type="button" class="at-button" data-ws-goto="5">See the assembled guitar ↗</button><button type="button" class="at-text-link" data-ws-focus="setup">Examine the measuring tools ↗</button><a class="at-text-link" href="'+link('commission')+'">Discuss my playing setup ↗</a>';
  root.querySelector('[data-ws-station-copy]').innerHTML=`<span class="at-kicker">${item.eyebrow}</span><h2>${item.title}</h2><p>${item.copy}</p>${extra}<p class="ws-fine">${item.note}</p>`;
  if(focus)viewer?.focusStation(id);
 }
 function pause(){if(timer)clearInterval(timer);timer=null;play.textContent='Watch the build ▷';play.setAttribute('aria-pressed','false');}
 function setStage(index,{automatic=false,followStation=true}={}){
  if(!automatic)pause();stage=Math.max(0,Math.min(5,index));const item=BUILD_STAGES[stage];
  viewer?.setStage(stage);root.querySelectorAll('[data-ws-stage]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.wsStage)===stage)));
  root.querySelector('[data-ws-step]').textContent='0'+(stage+1)+' / 06';root.querySelector('[data-ws-title]').textContent=item.title;root.querySelector('[data-ws-copy]').textContent=item.copy;root.querySelector('[data-ws-detail]').textContent=item.detail;
  root.querySelector('[data-ws-prev]').disabled=stage===0;root.querySelector('[data-ws-next]').disabled=stage===5;
  if(followStation)showStation(item.station);
 }
 function choose(button){
  pause();const key=button.dataset.wsChoice,value=button.dataset.value;if(!['wood','inlays','fretboard'].includes(key)||!F.choices[key]?.includes(value))return;
  choices[key]=value;viewer?.setDesign(choices);setStage(key==='wood'?0:3,{followStation:false});viewer?.reset();showStation(station);summary();saveStatus.textContent='Preview updated. Add these choices to your design when they feel right.';root.querySelector('[data-ws-apply]').textContent='Add these choices to my design ↗';
 }
 function handle(event){
  const button=event.target.closest('button');if(!button||!root.contains(button))return;
  if(button.hasAttribute('data-ws-stage')){viewer?.reset();setStage(Number(button.dataset.wsStage));}
  else if(button.hasAttribute('data-ws-prev')){viewer?.reset();setStage(stage-1);}
  else if(button.hasAttribute('data-ws-next')){viewer?.reset();setStage(stage+1);}
  else if(button.hasAttribute('data-ws-station')){pause();const id=button.dataset.wsStation,index=BUILD_STAGES.findIndex(item=>item.station===id);viewer?.reset();setStage(index,{followStation:false});showStation(id);}
  else if(button.hasAttribute('data-bench-hotspot')){pause();showStation(button.dataset.benchHotspot);status.textContent=WORKSHOP_STATIONS.find(item=>item.id===button.dataset.benchHotspot).name+' selected. Explore its details in the station panel.';}
  else if(button.hasAttribute('data-ws-focus')){pause();viewer?.focusStation(button.dataset.wsFocus);}
  else if(button.hasAttribute('data-ws-goto')){viewer?.reset();setStage(Number(button.dataset.wsGoto),{followStation:false});}
  else if(button.hasAttribute('data-ws-choice'))choose(button);
  else if(button.hasAttribute('data-ws-reset'))viewer?.reset();
  else if(button.hasAttribute('data-ws-zoom'))viewer?.zoom(button.dataset.wsZoom==='in'?.8:1.25);
  else if(button.hasAttribute('data-ws-play')){
   if(timer){pause();return;}viewer?.reset();setStage(0);play.textContent='Pause the build Ⅱ';play.setAttribute('aria-pressed','true');
   timer=setInterval(()=>{if(stage===5){pause();return;}setStage(stage+1,{automatic:true});},5000);
  }else if(button.hasAttribute('data-ws-apply')){
   try{if(window.FostinisCustomRequests?.isUploading())throw Error('Wait for your design files to finish uploading.');const current=snapshot();if(current.model!==base.model)throw Error('Your active guitar changed. Reopen the workshop to continue.');window.FostinisStudio.restoreBuild(applyWorkshopChoices(current,choices,F));saveStatus.textContent='Saved to your design. Review the updated configuration and price in the builder.';button.textContent='Choices saved ✓';}catch(error){saveStatus.textContent=error.message;}
  }else if(button.hasAttribute('data-ws-film')){
   pause();const film=FOSTINIS_VIDEOS.find(v=>v.category==='workshop'&&v.id===button.dataset.wsFilm);if(!film)return;const target=root.querySelector('.ws-film-player');target.hidden=false;target.innerHTML=`<button type="button" data-ws-close-film>Close film ×</button><iframe src="https://www.youtube-nocookie.com/embed/${film.id}?autoplay=1&rel=0" title="${esc(film.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
  }else if(button.hasAttribute('data-ws-close-film')){const target=root.querySelector('.ws-film-player');target.innerHTML='';target.hidden=true;}
 }
 const light=event=>{if(event.target.hasAttribute('data-ws-light'))viewer?.setLight(event.target.value);};
 const visibility=()=>{if(document.hidden)pause();};
 const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)pause();}):null;observer?.observe(root.querySelector('.ws-bench'));
 root.addEventListener('click',handle);root.addEventListener('input',light);document.addEventListener('visibilitychange',visibility);showStation('wood');summary();
 (async()=>{
  try{const room=await prepareShowroom();if(disposed)return;if(!room.createWorkshopView)throw Error('Reload this page to open the latest workshop.');const bench=root.querySelector('.ws-bench');viewer=await room.createWorkshopView(bench,{onPick:id=>{pause();showStation(id);status.textContent=WORKSHOP_STATIONS.find(item=>item.id===id).name+' selected. Explore its details in the station panel.';},onError:(message,{fatal=false}={})=>{pause();status.textContent=message;if(fatal){bench.classList.remove('is-ready');root.querySelector('.ws-bench-fallback span').textContent='FROM THE FOSTINIS WORKSHOP';root.querySelectorAll('[data-ws-play],[data-ws-reset],[data-ws-zoom],[data-ws-light]').forEach(control=>control.disabled=true);}}});if(disposed){viewer.dispose();return;}viewer.setDesign(choices);viewer.setStage(stage,false);bench.classList.add('is-ready');root.querySelectorAll('[data-ws-play],[data-ws-reset],[data-ws-zoom],[data-ws-light]').forEach(control=>control.disabled=false);status.textContent='Drag to look around · Pinch or scroll to zoom · Tap a tool or choose a station';}
  catch(error){if(!disposed){root.querySelector('.ws-bench-fallback span').textContent='FROM THE FOSTINIS WORKSHOP';status.textContent=error.message+' You can still explore materials, inlays, and the real workshop films.';}}
 })();
 return ()=>{disposed=true;pause();viewer?.dispose();observer?.disconnect();root.removeEventListener('click',handle);root.removeEventListener('input',light);document.removeEventListener('visibilitychange',visibility);root.querySelectorAll('iframe').forEach(frame=>frame.remove());};
}

let currentDialog;
export function openWorkshop(){
 if(currentDialog?.open){currentDialog.focus();return;}
 const d=document.createElement('dialog');d.className='at-dialog ws-dialog';d.setAttribute('aria-label','The interactive Fostinis workshop');d.innerHTML='<button type="button" class="ws-close" aria-label="Return to the showroom">Back to the showroom ×</button>'+workshopMarkup();document.body.append(d);d.showModal();currentDialog=d;
 const cleanup=mountWorkshop(d.querySelector('.ws-workshop'));
 d.querySelector('.ws-close').onclick=()=>d.close();d.addEventListener('close',()=>{cleanup();d.remove();currentDialog=null;},{once:true});
}

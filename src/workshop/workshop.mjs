import {esc,snapshot,modelName,prepareShowroom,link} from '../atelier/core.mjs';
import {FOSTINIS_VIDEOS} from '../atelier/videos.mjs';
import {BUILD_STAGES,MATERIAL_PANELS,TOP_WOODS,INLAYS,FRETBOARDS,applyWorkshopChoices} from './journey.mjs';
import {TOTAL_SECONDS,processLabel} from './sequence.mjs';

export function workshopMarkup(){
 const build=snapshot();
 return `<div class="ws-workshop" id="ws-experience">
  <div class="ws-intro"><div><span class="at-kicker">THE FOSTINIS WORKSHOP / COME CLOSER</span><h1>Before the first note.</h1><p>From the first cut to the final string.<br>Watch your Fostinis come together, with every detail you choose.</p></div><div class="ws-current"><span>ON THE BENCH</span><strong>${esc(build.nickname||modelName(build.model))}</strong><a href="/showroom.html#builder">Return to my design ↗</a></div></div>
  <div class="ws-journey" role="group" aria-label="Guitar construction stages">${BUILD_STAGES.map((stage,i)=>`<button type="button" data-ws-stage="${i}" aria-pressed="${i===0}"><span>0${i+1}</span>${stage.label}</button>`).join('')}</div>
  <div class="ws-main"><div class="ws-visual-column">
   <div class="ws-bench" aria-label="Watch your guitar being built"><div class="ws-bench-fallback"><img src="/assets/heritage/home-gallery-3-05-1200.webp" alt="A Fostinis headstock on the workshop bench"><span>PREPARING YOUR PLACE AT THE BENCH</span></div><span class="ws-bench-label">FOSTINIS / THE MAKING OF YOURS</span><div class="ws-now" aria-hidden="true"><span data-ws-action>Bookmatching the top</span><span data-ws-stage-percent>0%</span></div></div>
   <div class="ws-view-tools"><button type="button" data-ws-play disabled>Play the build ▷</button><button type="button" data-ws-replay disabled>Replay ↺</button><button type="button" data-ws-reset disabled>Reset view</button><button type="button" data-ws-zoom="in" disabled aria-label="Zoom in on the workbench">＋</button><button type="button" data-ws-zoom="out" disabled aria-label="Zoom out from the workbench">−</button><label>Move the light<input type="range" min="-75" max="75" value="-30" data-ws-light disabled></label></div>
   <div class="ws-timeline"><span>BUILD JOURNEY</span><input type="range" min="0" max="100" step="0.1" value="0" data-ws-progress disabled aria-label="Build animation progress"><output data-ws-time>0:00 / 1:01</output></div>
   <p class="ws-status" role="status">Preparing the making of your guitar…</p>
   <div class="ws-stage-copy"><span data-ws-step>01 / 06</span><div><h2 data-ws-title>${BUILD_STAGES[0].title}</h2><p data-ws-copy>${BUILD_STAGES[0].copy}</p><p class="ws-detail" data-ws-detail>${BUILD_STAGES[0].detail}</p></div><div class="ws-step-buttons"><button type="button" data-ws-prev disabled aria-label="Previous build stage">←</button><button type="button" data-ws-next aria-label="Next build stage">→</button></div></div>
   <p class="ws-process-note">An animated illustration of your design, with a compressed build sequence. Actual workshop footage is below; updates on a commissioned guitar live in its private journal.</p>
  </div><aside class="ws-panel"><div class="ws-panel-heading"><span class="at-kicker">YOUR MATERIALS / YOUR EXPRESSION</span><p>Change a detail. Watch it become yours.</p></div><nav class="ws-stations" aria-label="Design choices">${MATERIAL_PANELS.map((panel,i)=>`<button type="button" data-ws-panel="${panel.id}" aria-pressed="${i===0}">${panel.short}</button>`).join('')}</nav><div class="ws-station-copy" data-ws-station-copy></div></aside></div>
  <div class="ws-carry"><div><span class="at-kicker">FROM THE BENCH TO YOUR BUILD</span><h2>Keep the details you love.</h2><p data-ws-selection></p><span class="ws-save-status" role="status">Workshop choices are a preview until you add them to your design.</span></div><div><button class="at-button at-primary" type="button" data-ws-apply>Add these choices to my design ↗</button><a class="at-text-link" href="/showroom.html#builder">Review my configuration & price ↗</a></div></div>
  <section class="ws-archive" aria-labelledby="ws-archive-title"><div><span class="at-kicker">FROM THE FOSTINIS WORKSHOP ARCHIVE</span><h2 id="ws-archive-title">The hands behind the instrument.</h2><p>Step from the illustrated bench into real Fostinis build footage.</p></div><div class="ws-films">${FOSTINIS_VIDEOS.filter(v=>v.category==='workshop').map(v=>`<article><button type="button" data-ws-film="${v.id}" aria-label="Watch ${esc(v.title)}"><img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="" loading="lazy"><span aria-hidden="true">▷</span><small>${v.duration}</small></button><h3>${esc(v.title)}</h3><p>${esc(v.note)}</p></article>`).join('')}</div><div class="ws-film-player" hidden></div></section>
 </div>`;
}

export function mountWorkshop(root){
 if(!root)return ()=>{};
 const base=snapshot(),F=window.Fostinis,choices={wood:base.selections.wood,inlays:base.selections.inlays,fretboard:base.selections.fretboard};
 let disposed=false,viewer,stage=0,panel='wood',playing=false,complete=false,ready=false,shownStage=-1;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),status=root.querySelector('.ws-status'),play=root.querySelector('[data-ws-play]'),saveStatus=root.querySelector('.ws-save-status'),progress=root.querySelector('[data-ws-progress]');
 const names=(items,key)=>items.find(item=>item[0]===choices[key])?.[1]||choices[key];
 const time=value=>Math.floor(value/60)+':'+String(Math.floor(value%60)).padStart(2,'0');
 function summary(){root.querySelector('[data-ws-selection]').textContent=names(TOP_WOODS,'wood')+' · '+names(FRETBOARDS,'fretboard')+' · '+names(INLAYS,'inlays');}
 function choiceButtons(items,key){return `<div class="ws-choices" role="group" aria-label="Choose ${key}">${items.map(([id,name,image])=>`<button type="button" data-ws-choice="${key}" data-value="${id}" aria-pressed="${choices[key]===id}">${image?`<img src="/assets/${image}" alt="" loading="lazy">`:''}<span>${name}</span></button>`).join('')}</div>`;}
 function showPanel(id){
  const item=MATERIAL_PANELS.find(s=>s.id===id);if(!item)return;panel=id;
  root.querySelectorAll('[data-ws-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wsPanel===id)));
  const extra=id==='wood'?choiceButtons(TOP_WOODS,'wood')+'<a class="at-text-link" href="'+link('materials')+'">Explore full wood samples ↗</a>':'<h3>Inlay appointments</h3>'+choiceButtons(INLAYS,'inlays')+'<h3>Fretboard</h3>'+choiceButtons(FRETBOARDS,'fretboard')+'<a class="at-text-link" href="/showroom.html#builder">Add custom inlay artwork ↗</a><p class="ws-fine">Use the special-request field beside Inlays in Fretboard & Details to attach your design.</p>';
  root.querySelector('[data-ws-station-copy]').innerHTML=`<span class="at-kicker">${item.eyebrow}</span><h2>${item.title}</h2><p>${item.copy}</p>${extra}<p class="ws-fine">${item.note}</p>`;
 }
 function stageCopy(index){
  stage=Math.max(0,Math.min(5,index));if(shownStage===stage)return;shownStage=stage;const item=BUILD_STAGES[stage];
  root.querySelectorAll('[data-ws-stage]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.wsStage)===stage)));
  root.querySelector('[data-ws-step]').textContent='0'+(stage+1)+' / 06';root.querySelector('[data-ws-title]').textContent=item.title;root.querySelector('[data-ws-copy]').textContent=item.copy;root.querySelector('[data-ws-detail]').textContent=item.detail;
  root.querySelector('[data-ws-prev]').disabled=stage===0;root.querySelector('[data-ws-next]').disabled=stage===5;
 }
 function playback(snapshot){
  playing=snapshot.playing;complete=snapshot.complete;stageCopy(snapshot.stage);
  play.textContent=playing?'Pause Ⅱ':complete?'Replay the build ↺':'Play the build ▷';play.setAttribute('aria-pressed',String(playing));
  progress.value=snapshot.overall*100;progress.setAttribute('aria-valuetext',time(snapshot.time)+' of '+time(TOTAL_SECONDS)+' · '+BUILD_STAGES[stage].label);
  root.querySelector('[data-ws-time]').textContent=time(snapshot.time)+' / '+time(TOTAL_SECONDS);
  const action=choices.inlays==='none'&&stage===3&&snapshot.progress>=.25&&snapshot.progress<.64?'A clean fretboard, without face inlays':processLabel(snapshot);
  root.querySelector('[data-ws-action]').textContent=action;root.querySelector('[data-ws-stage-percent]').textContent=Math.round(snapshot.progress*100)+'%';
  if(ready){const message=complete?'Your guitar is assembled. Turn it around, replay the build, or carry your choices into your design.':playing?'The build plays automatically · Drag to pause and look around · Scroll to zoom':reduced.matches?'Motion is paused · Choose a stage for a still view, or press Play to watch the animation.':'Paused · Drag to look around, or press Play to continue.';if(status.textContent!==message)status.textContent=message;}
 }
 function setStage(index){stageCopy(index);viewer?.setStage(stage);}
 function choose(button){
  const key=button.dataset.wsChoice,value=button.dataset.value;if(!['wood','inlays','fretboard'].includes(key)||!F.choices[key]?.includes(value))return;
  choices[key]=value;viewer?.setDesign(choices);setStage(key==='wood'?0:3);viewer?.reset();showPanel(panel);summary();saveStatus.textContent='Preview updated. Add these choices to your design when they feel right.';root.querySelector('[data-ws-apply]').textContent='Add these choices to my design ↗';
 }
 function handle(event){
  const button=event.target.closest('button');if(!button||!root.contains(button))return;
  if(button.hasAttribute('data-ws-stage'))setStage(Number(button.dataset.wsStage));
  else if(button.hasAttribute('data-ws-prev'))setStage(stage-1);
  else if(button.hasAttribute('data-ws-next'))setStage(stage+1);
  else if(button.hasAttribute('data-ws-panel'))showPanel(button.dataset.wsPanel);
  else if(button.hasAttribute('data-ws-choice'))choose(button);
  else if(button.hasAttribute('data-ws-reset'))viewer?.reset();
  else if(button.hasAttribute('data-ws-zoom'))viewer?.zoom(button.dataset.wsZoom==='in'?.8:1.25);
  else if(button.hasAttribute('data-ws-replay'))viewer?.replay();
  else if(button.hasAttribute('data-ws-play')){if(playing)viewer?.pause();else viewer?.play();}
  else if(button.hasAttribute('data-ws-apply')){
   try{if(window.FostinisCustomRequests?.isUploading())throw Error('Wait for your design files to finish uploading.');const current=snapshot();if(current.model!==base.model)throw Error('Your active guitar changed. Reopen the workshop to continue.');window.FostinisStudio.restoreBuild(applyWorkshopChoices(current,choices,F));saveStatus.textContent='Saved to your design. Review the updated configuration and price in the builder.';button.textContent='Choices saved ✓';}catch(error){saveStatus.textContent=error.message;}
  }else if(button.hasAttribute('data-ws-film')){
   viewer?.pause();const film=FOSTINIS_VIDEOS.find(v=>v.category==='workshop'&&v.id===button.dataset.wsFilm);if(!film)return;const target=root.querySelector('.ws-film-player');target.hidden=false;target.innerHTML=`<button type="button" data-ws-close-film>Close film ×</button><iframe src="https://www.youtube-nocookie.com/embed/${film.id}?autoplay=1&rel=0" title="${esc(film.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;target.scrollIntoView({behavior:reduced.matches?'auto':'smooth',block:'center'});
  }else if(button.hasAttribute('data-ws-close-film')){const target=root.querySelector('.ws-film-player');target.innerHTML='';target.hidden=true;}
 }
 const input=event=>{if(event.target.hasAttribute('data-ws-light'))viewer?.setLight(event.target.value);if(event.target.hasAttribute('data-ws-progress'))viewer?.seek(event.target.value/100);};
 root.addEventListener('click',handle);root.addEventListener('input',input);showPanel('wood');summary();stageCopy(0);
 (async()=>{
  try{
   const room=await prepareShowroom();if(disposed)return;if(!room.createWorkshopView)throw Error('Reload this page to open the latest workshop.');const bench=root.querySelector('.ws-bench');
   viewer=await room.createWorkshopView(bench,{onFrame:playback,onError:(message,{fatal=false}={})=>{if(disposed)return;if(fatal){ready=false;bench.classList.remove('is-ready');root.querySelector('.ws-bench-fallback span').textContent='FROM THE FOSTINIS WORKSHOP';root.querySelectorAll('[data-ws-play],[data-ws-replay],[data-ws-progress],[data-ws-reset],[data-ws-zoom],[data-ws-light]').forEach(control=>control.disabled=true);}status.textContent=message;}});
   if(disposed){viewer.dispose();return;}
   viewer.setDesign(choices);bench.classList.add('is-ready');ready=true;
   root.querySelectorAll('[data-ws-play],[data-ws-replay],[data-ws-progress],[data-ws-reset],[data-ws-zoom],[data-ws-light]').forEach(control=>control.disabled=false);
   viewer.setStage(stage,!reduced.matches);
  }catch(error){if(!disposed){ready=false;viewer?.dispose();root.querySelector('.ws-bench-fallback span').textContent='FROM THE FOSTINIS WORKSHOP';status.textContent=error.message+' You can still explore materials, inlays, and the real workshop films.';}}
 })();
 return ()=>{disposed=true;viewer?.dispose();root.removeEventListener('click',handle);root.removeEventListener('input',input);root.querySelectorAll('iframe').forEach(frame=>frame.remove());};
}

let currentDialog;
export function openWorkshop(){
 if(currentDialog?.open){currentDialog.focus();return;}
 const d=document.createElement('dialog');d.className='at-dialog ws-dialog';d.setAttribute('aria-label','The interactive Fostinis workshop');d.innerHTML='<button type="button" class="ws-close" aria-label="Return to the showroom">Back to the showroom ×</button>'+workshopMarkup();document.body.append(d);d.showModal();currentDialog=d;
 const cleanup=mountWorkshop(d.querySelector('.ws-workshop'));
 d.querySelector('.ws-close').onclick=()=>d.close();d.addEventListener('close',()=>{cleanup();d.remove();currentDialog=null;},{once:true});
}

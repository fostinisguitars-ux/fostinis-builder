import {GuitarAudio,OPEN_STRINGS,CHORDS,noteName,DEFAULTS} from './audio.mjs';
import {LAYOUTS,positions,modifications,switchingVoice} from './switching.mjs';
import {REFERENCES,referenceIds} from './references.mjs';
import {createPerformanceView} from './performance.mjs';
import {FOSTINIS_VIDEOS} from '../atelier/videos.mjs';

const F=window.Fostinis,studio=window.FostinisStudio;
if(F&&studio?.ready&&!window.FostinisPlayroom)initialize();
function initialize(){
 const dialog=document.createElement('dialog');dialog.id='fostinis-playroom';dialog.setAttribute('aria-labelledby','playroom-title');
 const knob=(key,label=key)=>`<label class="pr-knob"><span class="pr-dial" aria-hidden="true" style="--turn:${-135+DEFAULTS[key]*27}deg"></span><span>${label}</span><input type="range" min="0" max="10" step=".1" value="${DEFAULTS[key]}" data-amp="${key}" aria-label="Amp ${label}"><output>${DEFAULTS[key]}</output></label>`;
 dialog.innerHTML=`<div class="pr-shell">
 <header class="pr-header"><div><span class="pr-eyebrow">FOSTINIS GUITARS</span><h2 id="playroom-title">Plug in. Find your sound.</h2></div><button type="button" class="pr-close" aria-label="Close playroom">×</button></header>
 <div class="pr-build"><label>Your guitar <select id="pr-model">${Object.entries(F.MODELS).map(([id,m])=>`<option value="${id}">${m.name}</option>`).join('')}</select></label><p id="pr-build-description"></p><span class="pr-badge">Interactive tone study</span></div>
 <p class="pr-intro">Play notes, strum chords, and explore your selected wiring through the Fostinis virtual amp. For the character of specific pickup models, listen to the real recordings below.</p>
 <div class="pr-layout"><section class="pr-instrument" aria-label="Play your virtual guitar">
  <div class="pr-performance"><div class="pr-performance-heading"><span class="pr-eyebrow">YOUR GUITAR · LIVE PLAYING VIEW</span><span id="pr-performance-state">Ready to play</span></div><button type="button" class="pr-guitar-preview" id="pr-preview" data-chord="Em" aria-label="Strum E minor on your configured guitar"><span>Preparing your guitar…</span></button><p>Tap the guitar to strum Em. Watch the pick, strings, and frets as you play.</p></div>
  <h3>Choose a pickup position</h3><div class="pr-positions" id="pr-positions" role="group" aria-label="Pickup selector"></div>
  <div class="pr-mods" id="pr-mods"></div><button type="button" id="pr-killswitch" aria-pressed="false" hidden>Hold to mute · killswitch</button>
  <div class="pr-guitar-controls"><label>Guitar volume <input type="range" id="pr-guitar-volume" min="0" max="10" value="10" step=".1"></label><label>Guitar tone <input type="range" id="pr-guitar-tone" min="0" max="10" value="10" step=".1"></label></div>
  <div class="pr-play-head"><h3>Play it your way</h3><output id="pr-note" aria-label="Last played note">—</output></div>
  <div class="pr-chords" role="group" aria-label="Strum a chord">${Object.keys(CHORDS).map(name=>`<button type="button" data-chord="${name}"><strong>${name}</strong><span>Strum</span></button>`).join('')}</div>
  <label class="pr-upstroke"><input type="checkbox" id="pr-upstroke"> Upstroke</label>
  <div class="pr-riffs" role="group" aria-label="Demo riffs"><button type="button" data-riff="arpeggio">▶ Arpeggio</button><button type="button" data-riff="rhythm">▶ Rhythm</button><button type="button" data-riff="lead">▶ Lead phrase</button><button type="button" id="pr-stop">■ Stop</button></div>
  <p class="pr-status" id="pr-status" role="status" aria-live="polite">Tap Plug in & play to enable audio. Start with a comfortable volume.</p>
 <section class="pr-fret-section" aria-labelledby="pr-fret-title"><div class="pr-fret-head"><div><h3 id="pr-fret-title">The fretboard is yours.</h3><p>Tap any string and fret. On a keyboard, A S D F G H J K play an E-minor scale; 1–6 play the open strings.</p></div><label>Frets <select id="pr-fret-range"><option value="0">0–12</option><option value="12">12–24</option></select></label></div><div class="pr-fret-scroll"><div id="pr-fretboard" role="group" aria-label="Playable guitar fretboard"></div></div></section>
 </section>
 <section class="pr-amplifier" aria-label="Fostinis virtual amplifier">
  <div class="pr-handle" aria-hidden="true"></div><div class="pr-amp-top"><span class="pr-input" aria-hidden="true"></span><button type="button" id="pr-power" aria-pressed="false"><i aria-hidden="true"></i><span>Plug in & play</span></button><span class="pr-amp-label">SIGNATURE / VIRTUAL AMP</span></div>
  <div class="pr-channel" role="group" aria-label="Amp channel"><button type="button" data-channel="clean" aria-pressed="true">Clean</button><button type="button" data-channel="crunch" aria-pressed="false">Crunch</button><button type="button" data-channel="lead" aria-pressed="false">Lead</button></div>
  <div class="pr-knobs">${knob('gain')}${knob('bass')}${knob('mid')}${knob('treble')}${knob('reverb')}${knob('delay')}${knob('volume','master')}</div>
  <div class="pr-eq"><span>GRAPHIC EQ</span><div>${['80','240','750','2.2k','6.6k'].map((label,i)=>`<label><input type="range" min="-8" max="8" step="1" value="0" data-eq="${i}" aria-label="${label} hertz EQ, decibels"><span>${label}</span><output>0 dB</output></label>`).join('')}</div><button type="button" id="pr-eq-reset">Flat EQ</button></div>
  <div class="pr-grille"><img src="/assets/heritage/signature-240.webp" width="240" height="188" alt="Fostinis signature"><span class="pr-live-light" aria-hidden="true"></span></div>
  <p class="pr-amp-caption">Your touch. Your tone.</p>
 </section></div>

 <p class="pr-honesty">The playable sound is synthesized to illustrate pickup positions and wiring. It is not a recording or calibrated model of the chosen pickups, guitar woods, or a commercial amplifier.</p>
 <section class="pr-recordings" aria-labelledby="pr-fostinis-title"><div class="pr-recordings-head"><div><span class="pr-eyebrow">REAL FOSTINIS INSTRUMENTS</span><h3 id="pr-fostinis-title">See the guitar. Hear the player.</h3></div><a href="/atelier.html?view=sound">The listening room ↗</a></div><p>Performances and reviews from our YouTube channel. These archive instruments may have different pickups, hardware, and recording rigs from your design.</p><div class="pr-fostinis-films">${FOSTINIS_VIDEOS.slice(0,3).map(v=>`<article><button type="button" data-fostinis-video="${v.id}" aria-label="Play ${v.title}"><img loading="lazy" src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="${v.title}"><span>▶ ${v.duration}</span></button><h4>${v.title}</h4><p>${v.note}</p><a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a></article>`).join('')}</div><div id="pr-fostinis-player" hidden></div></section>
 <section class="pr-recordings" aria-labelledby="pr-recordings-title"><div class="pr-recordings-head"><div><span class="pr-eyebrow">HEAR THE REAL PICKUPS</span><h3 id="pr-recordings-title">Recordings for your choices.</h3></div><span class="pr-badge">Manufacturer references</span></div><p>Original demonstrations use other guitars and recording rigs. Their sound is independent of the virtual amp controls. Each reference lists what is covered.</p><div id="pr-references"></div><div id="pr-video" hidden></div></section>
 </div>`;
 document.body.append(dialog);dialog.addEventListener('click',event=>{const button=event.target.closest('[data-fostinis-video]');if(!button)return;const id=button.dataset.fostinisVideo;if(!FOSTINIS_VIDEOS.some(v=>v.id===id))return;engine.stop();const host=dialog.querySelector('#pr-fostinis-player');host.hidden=false;host.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0" title="Fostinis guitar performance" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';host.scrollIntoView({block:'nearest',behavior:'smooth'});});dialog.addEventListener('close',()=>{dialog.querySelector('#pr-fostinis-player').replaceChildren();dialog.querySelector('#pr-fostinis-player').hidden=true;});const $=id=>dialog.querySelector('#'+id);
 let snapshot=studio.getSnapshot(),build=snapshot.builds[snapshot.selected],position='bridge',enabled=new Set(),previousFocus,previousOverflow='',previewRevision=0,connecting=false,connectionRevision=0;
 const performanceView=createPerformanceView($('pr-preview'));
 const engine=new GuitarAudio({onNote:highlight,onSequenceEnd:()=>{performanceView.stop();dialog.querySelectorAll('[data-riff]').forEach(b=>b.setAttribute('aria-pressed','false'));}});
 const entry=document.createElement('div');entry.className='playroom-entry';entry.innerHTML='<div><span>THE FOSTINIS PLAYROOM</span><strong>Your build has a voice. Explore it.</strong></div><button type="button" data-open-playroom>Plug in & play <span aria-hidden="true">↗</span></button>';
 function placeEntry(){const room=document.getElementById('virtual-room'),exhibits=document.getElementById('exhibits');if(room)room.after(entry);else if(exhibits)exhibits.before(entry);}
 placeEntry();window.addEventListener('fostinis:room-ready',placeEntry);
 const extra=document.createElement('button');extra.type='button';extra.className='playroom-open-build';extra.textContent='Play this guitar';extra.dataset.openPlayroom='';document.getElementById('share-build')?.before(extra);
 const announce=text=>{$('pr-status').textContent=text;};
 function powerUI(){dialog.dataset.connected=String(engine.connected);$('pr-power').setAttribute('aria-pressed',String(engine.connected));$('pr-power').querySelector('span').textContent=engine.connected?'Unplug':'Plug in & play';window.dispatchEvent(new CustomEvent('fostinis:playroom-state',{detail:{connected:engine.connected}}));}
 async function ensureAudio(){
  if(engine.connected&&engine.context?.state==='running')return true;
  if(connecting)return false;const ticket=connectionRevision;connecting=true;
  try{await engine.connect();if(ticket!==connectionRevision||!dialog.open){await engine.disconnect();return false;}powerUI();announce('Connected · tap a note, strum a chord, or start a phrase.');return true;}
  catch(error){announce(error.message||'Audio could not start. Tap Plug in to retry.');return false;}
  finally{connecting=false;}
 }
 async function unplug(){connectionRevision++;performanceView.stop();$('pr-performance-state').textContent='Ready to play';await engine.disconnect();powerUI();announce('Unplugged. Tap Plug in & play to reconnect.');}
 function updateSwitching(){engine.setSwitching(switchingVoice(build,position,enabled,Number($('pr-guitar-volume').value),Number($('pr-guitar-tone').value)));}
 function updateBuild(){
  const next=studio.getSnapshot(),changed=JSON.stringify(next.builds[next.selected])!==JSON.stringify(build)||next.selected!==snapshot.selected;
  snapshot=next;build=snapshot.builds[snapshot.selected];if(changed){engine.stop();engine.setKilled(false);enabled=new Set();if(!positions(build).some(p=>p.id===position))position='bridge';}
  $('pr-killswitch').hidden=build.killswitch!=='momentary';$('pr-killswitch').setAttribute('aria-pressed','false');
  $('pr-model').value=snapshot.selected;
  const layout=LAYOUTS[build.pickupLayout]||LAYOUTS.hh,ids=referenceIds(build,layout);
  $('pr-build-description').textContent=ids.map(id=>REFERENCES[id].name).join(' + ')+(build.handedness==='left'?' · Left-handed':' · Right-handed');
  $('pr-positions').replaceChildren(...positions(build).map(p=>{const b=document.createElement('button');b.type='button';b.textContent=p.label;b.dataset.position=p.id;b.setAttribute('aria-pressed',String(position===p.id));return b;}));
  $('pr-mods').replaceChildren(...modifications(build).map(m=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.mod=m.key;input.checked=enabled.has(m.key);label.append(input,document.createTextNode((window.FostinisElectronics?.mods[m.kind]||m.kind).replace('Push-pull · ','')+' · on'));return label;}));
  if(!modifications(build).length)$('pr-mods').textContent='Standard wiring. Optional push-pull controls appear here when added to your build.';
  updateSwitching();if(changed||!$('pr-references').children.length)renderReferences(ids);renderFretboard();if(dialog.open)updatePreview();
 }
 function renderReferences(ids){
  $('pr-video').replaceChildren();$('pr-video').hidden=true;
  $('pr-references').replaceChildren(...ids.map(id=>{
   const ref=REFERENCES[id],card=document.createElement('article');card.className='pr-reference';
   const h=document.createElement('h4');h.textContent=ref.name;
   const covered=document.createElement('p');covered.textContent=ref.coverage;
   const missing=document.createElement('p');missing.className='pr-reference-note';missing.textContent=ref.missing;
   const actions=document.createElement('div');
   if(ref.video){const b=document.createElement('button');b.type='button';b.textContent='▶ Play reference';b.dataset.reference=id;actions.append(b);}
   const a=document.createElement('a');a.href=ref.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=ref.video?'Manufacturer & more samples ↗':id==='instrumental-sfty3'||id==='dimarzio-request'||id==='fishman-classic'?'Manufacturer reference ↗':'Open sound samples ↗';actions.append(a);
   if(ref.video){const fallback=document.createElement('a');fallback.href='https://www.youtube.com/watch?v='+ref.video+(ref.start?'&t='+ref.start+'s':'');fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.textContent='Watch on YouTube ↗';actions.append(fallback);}
   card.append(h,covered,missing,actions);return card;
  }));
 }
 function renderFretboard(){
  const start=Number($('pr-fret-range').value),left=build.handedness==='left',frets=Array.from({length:13},(_,i)=>start+i);if(left)frets.reverse();
  const board=$('pr-fretboard');board.replaceChildren();board.classList.toggle('is-left-handed',left);
  const corner=document.createElement('span');corner.className='pr-string-label';corner.textContent='String';board.append(corner);
  frets.forEach(fret=>{const label=document.createElement('span');label.className='pr-fret-label';label.textContent=fret===0?'Open':fret;board.append(label);});
  OPEN_STRINGS.forEach((midi,string)=>{
   const label=document.createElement('span');label.className='pr-string-label';label.textContent=noteName(midi);board.append(label);
   frets.forEach(fret=>{const b=document.createElement('button');b.type='button';b.dataset.string=string;b.dataset.fret=fret;b.className='pr-fret';if([3,5,7,9,12,15,17,19,21,24].includes(fret))b.classList.add('is-marker');b.style.setProperty('--string-weight',(string*.35+.7)+'px');b.setAttribute('aria-label',noteName(midi+fret)+', string '+(string+1)+', fret '+fret);const n=document.createElement('span');n.textContent=noteName(midi+fret).replace(/\d/,'');b.append(n);board.append(b);});
  });
 }
 function highlight(note){
  const {midi,string,fret}=note;performanceView.note(note);$('pr-performance-state').textContent=noteName(midi)+' · '+(fret?'fret '+fret:'open string');
  $('pr-note').textContent=noteName(midi);const b=dialog.querySelector(`.pr-fret[data-string="${string}"][data-fret="${fret}"]`);if(b){b.classList.add('is-playing');setTimeout(()=>b.classList.remove('is-playing'),220);}dialog.classList.remove('pr-plucked');void dialog.offsetWidth;dialog.classList.add('pr-plucked');
 }
 async function updatePreview(){
  const ticket=++previewRevision;performanceView.clear();
  const loading=document.createElement('span');loading.textContent='Preparing your configured guitar…';$('pr-preview').append(loading);
  $('pr-preview').setAttribute('aria-label','Strum E minor on your '+F.MODELS[snapshot.selected].name);
  if(!window.FostinisShowroom?.ready){window.dispatchEvent(new CustomEvent('fostinis:playroom-open'));return;}
  try{const frame=await window.FostinisShowroom.exportPlayingView();if(ticket!==previewRevision||!dialog.open)return;performanceView.setFrame(frame);$('pr-performance-state').textContent='Ready to play';}
  catch{if(ticket===previewRevision&&dialog.open)loading.textContent='The guitar view is unavailable on this device. Reload to retry.';}
 }
 window.addEventListener('fostinis:room-ready',()=>{if(dialog.open)updatePreview();});
 window.addEventListener('fostinis:3d-unavailable',()=>{if(dialog.open){previewRevision++;performanceView.clear();$('pr-preview').textContent='The guitar view was paused by your device. Reload to restore it.';}});

 function open(){if(dialog.open)return;previousFocus=document.activeElement;previousOverflow=document.body.style.overflow;updateBuild();dialog.showModal();document.body.style.overflow='hidden';updatePreview();$('pr-preview').focus({preventScroll:true});dialog.scrollTop=0;}
 function close(){if(dialog.open)dialog.close();}
 dialog.addEventListener('close',()=>{previewRevision++;performanceView.clear();unplug();$('pr-video').replaceChildren();$('pr-video').hidden=true;document.body.style.overflow=previousOverflow;previousFocus?.focus();});
 dialog.addEventListener('click',async event=>{
  const target=event.target.closest('button,a');
  if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();return;}
  if(!target)return;
  if(target.classList.contains('pr-close'))return close();
  if(target.id==='pr-power'){if(engine.connected)await unplug();else await ensureAudio();return;}
  if(target.dataset.channel){engine.update('channel',target.dataset.channel);dialog.querySelectorAll('[data-channel]').forEach(b=>b.setAttribute('aria-pressed',String(b===target)));return;}
  if(target.dataset.position){position=target.dataset.position;dialog.querySelectorAll('[data-position]').forEach(b=>b.setAttribute('aria-pressed',String(b===target)));updateSwitching();return;}
  if(target.id==='pr-stop'){engine.stop();await unplug();return;}
  if(target.id==='pr-eq-reset'){engine.update('eq',[0,0,0,0,0]);dialog.querySelectorAll('[data-eq]').forEach(input=>{input.value=0;input.parentElement.querySelector('output').textContent='0 dB';});return;}
  if(target.dataset.reference){await unplug();const ref=REFERENCES[target.dataset.reference],frame=document.createElement('iframe');frame.src='https://www.youtube-nocookie.com/embed/'+ref.video+'?rel=0&playsinline=1'+(ref.start?'&start='+ref.start:'');frame.title=ref.name+' original recording';frame.allow='accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;const closeVideo=document.createElement('button');closeVideo.type='button';closeVideo.textContent='Close recording';closeVideo.onclick=()=>{$('pr-video').replaceChildren();$('pr-video').hidden=true;};$('pr-video').replaceChildren(frame,closeVideo);$('pr-video').hidden=false;$('pr-video').scrollIntoView({behavior:'smooth',block:'nearest'});return;}
  if(target.tagName==='A'){await unplug();return;}
  if(target.dataset.chord||target.dataset.riff||target.classList.contains('pr-fret')){
   $('pr-video').replaceChildren();$('pr-video').hidden=true;if(!await ensureAudio())return;
   if(target.dataset.chord){engine.stop();engine.strum(target.dataset.chord,$('pr-upstroke').checked);}
   if(target.dataset.riff){engine.playRiff(target.dataset.riff);target.setAttribute('aria-pressed','true');announce('Playing '+target.dataset.riff+' · change the amp or pickup selector as it plays.');}
   if(target.classList.contains('pr-fret')){const string=Number(target.dataset.string),fret=Number(target.dataset.fret);engine.pluck(OPEN_STRINGS[string]+fret,{string,fret});}
  }
 });
 dialog.addEventListener('input',event=>{const input=event.target;if(input.dataset.amp){engine.update(input.dataset.amp,Number(input.value));input.parentElement.querySelector('output').textContent=Number(input.value).toFixed(1);input.parentElement.querySelector('.pr-dial').style.setProperty('--turn',(-135+Number(input.value)*27)+'deg');}if(input.dataset.eq!==undefined){const eq=[...engine.settings.eq];eq[Number(input.dataset.eq)]=Number(input.value);engine.update('eq',eq);input.parentElement.querySelector('output').textContent=input.value+' dB';}if(input.id==='pr-guitar-volume'||input.id==='pr-guitar-tone')updateSwitching();});
 dialog.addEventListener('change',event=>{const input=event.target;if(input.id==='pr-model'){studio.selectModel(input.value);updateBuild();}if(input.id==='pr-fret-range')renderFretboard();if(input.dataset.mod){if(input.checked)enabled.add(input.dataset.mod);else enabled.delete(input.dataset.mod);updateSwitching();}});
 const kill=$('pr-killswitch');
 function mute(killed){engine.setKilled(killed);if(killed)performanceView.stop();kill.setAttribute('aria-pressed',String(killed));}
 kill.addEventListener('pointerdown',e=>{if(build.killswitch!=='momentary')return;e.preventDefault();kill.focus();kill.setPointerCapture(e.pointerId);mute(true);});
 for(const event of ['pointerup','pointercancel','lostpointercapture','blur'])kill.addEventListener(event,()=>mute(false));
 kill.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();mute(true);}});
 kill.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();mute(false);}});
 dialog.addEventListener('keydown',async event=>{
  if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName))return;
  const key=event.key.toLowerCase(),scale={a:[0,0],s:[0,2],d:[0,3],f:[0,5],g:[0,7],h:[0,8],j:[0,10],k:[0,12]},n=scale[key]||(/^[1-6]$/.test(key)?[6-Number(key),0]:null);
  if(!n)return;event.preventDefault();if(await ensureAudio()){const [string,fret]=n;engine.pluck(OPEN_STRINGS[string]+fret,{string,fret});}
 });
 document.addEventListener('click',e=>{if(e.target.closest('[data-open-playroom]'))open();});
 window.addEventListener('fostinis:build',()=>{if(dialog.open)updateBuild();});
 window.addEventListener('fostinis:navigate',()=>{if(dialog.open)close();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){unplug();$('pr-fostinis-player').replaceChildren();$('pr-fostinis-player').hidden=true;$('pr-video').replaceChildren();$('pr-video').hidden=true;}});
 window.addEventListener('pagehide',()=>engine.disconnect());
 window.FostinisPlayroom={open,get connected(){return engine.connected;}};
 updateBuild();
}

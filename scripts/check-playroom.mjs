import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {OPEN_STRINGS,pluckSamples,noteFrequency,chordNotes,CHORDS,GuitarAudio,riffEvents} from '../src/playroom/audio.mjs';
import {positions,modifications,switchingVoice,LAYOUTS} from '../src/playroom/switching.mjs';
import {REFERENCES,referenceIds} from '../src/playroom/references.mjs';
import {createShowroomAmp} from '../src/showroom3d/amplifier.mjs';

const html=fs.readFileSync('public/showroom.html','utf8'),inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)],window={};
vm.runInNewContext(inline[0][1].slice(inline[0][1].indexOf('window.FostinisParts=')),{window});
const F=window.Fostinis,E=window.FostinisElectronics;

test('Every catalog pickup has an honest reference or an explicit recording gap',()=>{
 for(const pickup of window.FostinisParts.pickups){const ref=REFERENCES[pickup.id];assert(ref,pickup.id);assert.match(ref.url,/^https:\/\//);assert(ref.coverage&&ref.missing);if(ref.video)assert.match(ref.video,/^[a-zA-Z0-9_-]{11}$/);}
 assert.match(REFERENCES['instrumental-sfty3'].missing,/has not been verified/);
 assert.match(REFERENCES['dimarzio-request'].missing,/unspecified/);
 assert.match(REFERENCES['fishman-classic'].coverage,/has not been verified/);
 assert(!REFERENCES['fishman-classic'].video);
 assert(REFERENCES.ssl2.video&&REFERENCES.ssl6.video);
});
test('Every offered layout exposes only installed pickup positions and relevant reference models',()=>{
 for(const id of Object.keys(E.layouts)){
  const b=F.normalize('sphyx',{...F.initial('sphyx'),pickupLayout:id}),p=positions(b),layout=LAYOUTS[id];
  assert.equal(p.length,id==='h'?1:layout.middle?5:3);
  for(const pos of p){const voice=switchingVoice(b,pos.id);assert(voice.pickups.length);assert(voice.pickups.every(x=>layout[x.place]));}
  const refs=referenceIds(b,layout);assert.equal(refs.includes(b.singleCoilModel),Object.values(layout).includes('S'));assert.equal(refs.includes(b.pickupSet),Object.values(layout).includes('H'));
 }
});
test('Split and parallel affect only their wired humbucker; center means both for HH',()=>{
 const b={pickupLayout:'hh',pickupSet:'sd-jb-jazz',pot1Mod:'split-neck',pot3Mod:'parallel-bridge'};
 const both=switchingVoice(b,'both',new Set(['pot1Mod','pot3Mod']));assert.equal(both.pickups.length,2);assert.equal(both.pickups[0].type,'S');assert.equal(both.pickups[1].parallel,true);
 const neck=switchingVoice(b,'neck',new Set(['pot3Mod']));assert.equal(neck.pickups[0].type,'H');assert.equal(neck.pickups[0].parallel,false);
 const standard=switchingVoice(b,'both');assert(standard.pickups.every(p=>p.type==='H'&&!p.parallel));
});
test('Standard EMGs cannot split; Fluence controls follow purchased Voice 1/2 switching',()=>{
 for(const pickupSet of ['emg-81-85','emg-57-66']){
  const build=F.normalize('sphyx',{...F.initial('sphyx'),pickupSet,pot1Mod:'split-neck',pot3Mod:'split-both'});
  assert.equal(modifications(build).length,0);
  assert(switchingVoice({...build,pot1Mod:'split-both'},'both',new Set(['pot1Mod'])).pickups.every(p=>p.type==='H'));
 }
 const fish={pickupLayout:'hh',pickupSet:'fishman-modern',pot3Mod:'voice'};
 assert.equal(switchingVoice(fish).voice,1);assert.equal(switchingVoice(fish,'neck',new Set(['pot3Mod'])).voice,2);
});
test('Phase reversal acts only on combined pickups; tone/volume and treble bleed reach the sound engine',()=>{
 const b={pickupLayout:'hh',pickupSet:'sd-jb-jazz',pot3Mod:'phase',pot1Mod:'treble-bleed'};
 assert.equal(switchingVoice(b,'bridge',new Set(['pot3Mod'])).pickups[0].phase,1);
 const both=switchingVoice(b,'both',new Set(['pot3Mod','pot1Mod']),4,6);assert.equal(both.pickups[1].phase,-1);assert.equal(both.trebleBleed,true);assert.equal(both.volume,4);assert.equal(both.tone,6);
});
test('Playable string buffers are finite, bounded, tuned and decay at 44.1/48 kHz',()=>{
 for(const rate of [44100,48000])for(const midi of [40,45,64,76,88]){
  const data=pluckSamples(midi,rate),freq=noteFrequency(midi);assert.equal(data.length,Math.floor(rate*3.4));let peak=0,early=0,late=0;
  for(let i=0;i<data.length;i++){assert(Number.isFinite(data[i]));peak=Math.max(peak,Math.abs(data[i]));if(i<rate*.3)early+=data[i]**2;if(i>data.length-rate*.3)late+=data[i]**2;}
  assert(peak>.05&&peak<=.701);assert(late<early*.1);
  // Compare correlation around the expected period; this catches flattened
  // string tuning and octave mistakes in a delay-line implementation.
  let best=-Infinity,period=0;const ideal=rate/freq;
  for(let lag=Math.floor(ideal*.96);lag<=Math.ceil(ideal*1.04);lag++){let score=0;for(let i=Math.floor(rate*.12);i<Math.floor(rate*.25);i++)score+=data[i]*data[i+lag];if(score>best){best=score;period=lag;}}
  assert(Math.abs(period-ideal)<1.8,`tuning ${midi} / ${rate}: ${period} vs ${ideal}`);
 }
});
test('Chords use real string voicings, upstroke reverses order, and demo riffs stay on the fretboard',()=>{
 assert.deepEqual(chordNotes('Em').map(n=>n.midi),[40,47,52,55,59,64]);
 for(const name of Object.keys(CHORDS))assert.deepEqual(chordNotes(name,true),chordNotes(name).reverse());
 for(const kind of ['arpeggio','rhythm','lead'])for(const n of riffEvents(kind)){assert(n.string>=0&&n.string<6);assert(n.fret>=0&&n.fret<=24);assert.equal(n.midi,OPEN_STRINGS[n.string]+n.fret);assert(n.duration>0&&n.time>=0);}
});

function fakeContext(){
 const nodes=[];const param=value=>({value,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},cancelScheduledValues(){}});
 const node=()=>{const n={links:[],connect(other){assert(other);this.links.push(other);},disconnect(){this.disconnected=true;},gain:param(1),frequency:param(1000),Q:param(1),threshold:param(0),knee:param(0),ratio:param(0),attack:param(0),release:param(0),delayTime:param(0)};nodes.push(n);return n;};
 const c={nodes,sampleRate:48000,currentTime:0,state:'suspended',destination:{},async resume(){this.state='running';},async close(){this.state='closed';},createGain:node,createBiquadFilter:node,createWaveShaper:node,createConvolver:node,createDelay:node,createDynamicsCompressor:node,createBufferSource(){const n=node();n.start=t=>{n.started=t;};n.stop=t=>{n.stopped=t;};return n;},createBuffer(channels,length,rate){const data=Array.from({length:channels},()=>new Float32Array(length));return {duration:length/rate,getChannelData:i=>data[i],copyToChannel:(source,i)=>data[i].set(source)};}};return c;
}
test('Audio is gesture-gated, controls affect the graph, and unplug cancels queued riffs and old delay tails',async()=>{
 const contexts=[];let notes=0;const engine=new GuitarAudio({contextFactory:()=>{const c=fakeContext();contexts.push(c);return c;},onNote:()=>notes++});
 engine.pluck(40);assert.equal(contexts.length,0);await engine.connect();assert.equal(engine.connected,true);assert(engine.master.gain.value>0);
 engine.update('channel','lead');engine.update('gain',9);assert(engine.pre.gain.value>20);
 const audible=engine.master.gain.value;engine.setKilled(true);assert.equal(engine.master.gain.value,0);engine.setKilled(false);assert.equal(engine.master.gain.value,audible);
 engine.setSwitching(switchingVoice({pickupLayout:'hh',pickupSet:'sd-jb-jazz',pot3Mod:'split-both'},'both',new Set(['pot3Mod'])));assert(engine.branches.filter(b=>b.gain.gain.value!==0).length===2);
 engine.update('volume',0);assert.equal(engine.master.gain.value,0);engine.update('eq',[8,-8,2,0,4]);assert.equal(engine.eq[0].gain.value,8);
 engine.playRiff('lead');assert(engine.timers.size>0);await engine.disconnect();assert.equal(engine.timers.size,0);assert.equal(engine.connected,false);assert.equal(contexts[0].state,'closed');assert.equal(engine.context,null);
 await new Promise(r=>setTimeout(r,40));assert.equal(notes,0);
 await engine.connect();assert.equal(contexts.length,2);await engine.destroy();
});
test('The branded amp and cable stay in the room, preserving guitar-only exports',()=>{
 const room=new THREE.Group(),amp=createShowroomAmp(room,new THREE.Texture()),guitar=new THREE.Group();guitar.position.set(-.52,.42,0);guitar.scale.setScalar(.001);
 assert(room.children.includes(amp.group));assert.equal(amp.group.userData.playroom,true);amp.setConnected(true,{group:guitar});assert(room.children.some(c=>c.name==='Connected guitar cable'));
 room.traverse(m=>{if(m.isMesh)for(const v of m.geometry.attributes.position.array)assert(Number.isFinite(v));});amp.setConnected(false);assert(!room.children.some(c=>c.name==='Connected guitar cable'));
});
test('All showroom routes load the playroom without changing commerce scripts',()=>{
 let count=0;for(const name of fs.readdirSync('public').filter(n=>n.endsWith('.html'))){const h=fs.readFileSync('public/'+name,'utf8');if(!h.includes('window.FostinisStudio='))continue;count++;assert(h.includes('/playroom.js?v=59'));assert(h.includes('/playroom.css?v=59'));assert(h.includes('/build-commerce.js?v=54'));}
 assert.equal(count,233);assert(fs.statSync('public/playroom.js').size<60000);
});

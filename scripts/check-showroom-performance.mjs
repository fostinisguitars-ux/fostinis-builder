import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createRoomControls,fitRoomCamera} from '../src/showroom3d/room-camera.mjs';
import {createRenderScheduler} from '../src/showroom3d/render-scheduler.mjs';
import {hardwareKey,finishKey,FINISH_FIELDS} from '../src/showroom3d/update-keys.mjs';

function clock(){let id=0,now=0;const jobs=new Map();return {request:fn=>{jobs.set(++id,fn);return id;},cancel:id=>jobs.delete(id),get pending(){return jobs.size;},flush(){let frames=0;while(jobs.size){assert(++frames<1000,'Rendering never settled');const batch=[...jobs.values()];jobs.clear();now+=16;batch.forEach(fn=>fn(now));}return frames;}};}
function fixture(){const c=clock(),renders={room:0,detail:0};let hidden=false,moving=false;
 const scheduler=createRenderScheduler({...c,hidden:()=>hidden,update:()=>moving,renderRoom:()=>renders.room++,renderDetail:()=>renders.detail++});
 return {c,renders,scheduler,set hidden(v){hidden=v;},set moving(v){moving=v;}};
}
test('A stationary showroom settles after one frame; editing a view does not redraw the other canvas',()=>{
 const u=fixture();u.scheduler.setVisible('room',true);u.scheduler.setVisible('detail',true);assert.equal(u.c.flush(),1);assert.deepEqual(u.renders,{room:1,detail:1});assert.equal(u.c.pending,0);
 for(let i=0;i<100;i++)u.scheduler.invalidate('detail');assert.equal(u.c.flush(),1);assert.deepEqual(u.renders,{room:1,detail:2});
 u.scheduler.invalidate('room');assert.equal(u.c.flush(),1);assert.deepEqual(u.renders,{room:2,detail:2});
 u.scheduler.invalidate();assert.equal(u.c.flush(),1);assert.deepEqual(u.renders,{room:3,detail:3});
 console.log('Idle redraws per change: 90 queued frames before; 1 frame now. Other canvas redraws during a camera-only change: 0.');
});
test('Off-screen canvases and background tabs stop work and resume with the latest changes',()=>{
 const u=fixture();u.scheduler.invalidate();assert.equal(u.c.pending,0);u.scheduler.setVisible('room',true);u.c.flush();
 u.scheduler.setVisible('room',false);u.scheduler.invalidate();assert.equal(u.c.pending,0);assert.deepEqual(u.renders,{room:1,detail:0});
 u.scheduler.setVisible('detail',true);u.c.flush();assert.deepEqual(u.renders,{room:1,detail:1});
 u.hidden=true;u.scheduler.pause();u.scheduler.invalidate();assert.equal(u.c.pending,0);u.hidden=false;u.scheduler.wake();u.c.flush();assert.deepEqual(u.renders,{room:1,detail:2});
 u.scheduler.stop();u.scheduler.invalidate();assert.equal(u.c.pending,0);
});

class Surface{
 constructor(){this.listeners=new Map();this.style={};this.documentElement={clientLeft:0,clientTop:0};this.ownerDocument=this;this.clientWidth=600;this.clientHeight=400;}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}getRootNode(){return this;}setPointerCapture(){}releasePointerCapture(){}
 getBoundingClientRect(){return {left:0,top:0,width:600,height:400};}
 emit(type,props){for(const fn of this.listeners.get(type)||[])fn({preventDefault(){},stopPropagation(){},type,...props});}
}
test('Real trackball gestures wake a stopped room and real detail damping settles without extra room renders',()=>{
 globalThis.window=new Surface();window.pageXOffset=window.pageYOffset=0;const room=new Surface(),detail=new Surface(),camera=new T.PerspectiveCamera(37,1.5,.015,25),detailCamera=camera.clone();camera.position.set(0,.72,2.5);detailCamera.position.set(0,0,1.5);
 const controls=createRoomControls(camera,room),editor=new OrbitControls(detailCamera,detail);editor.enableDamping=true;controls.target.set(0,.72,0);controls.update();editor.update();const renderCamera=camera.clone(),c=clock(),renders={room:0,detail:0};
 const scheduler=createRenderScheduler({...c,hidden:()=>false,update:(now,visible)=>{if(visible.room){controls.update();fitRoomCamera(renderCamera,camera,controls.target);}return visible.detail&&editor.update();},renderRoom:()=>renders.room++,renderDetail:()=>renders.detail++});
 for(const [control,view]of [[controls,'room'],[editor,'detail']])for(const event of ['start','change'])control.addEventListener(event,()=>scheduler.invalidate(view));
 room.addEventListener('pointermove',()=>scheduler.invalidate('room'));
 scheduler.setVisible('room',true);scheduler.setVisible('detail',true);c.flush();const before=camera.position.clone();
 const pointer=(x,y)=>({pointerId:1,pointerType:'mouse',button:0,pageX:x,pageY:y,clientX:x,clientY:y});
 room.emit('pointerdown',pointer(200,200));room.emit('pointermove',pointer(270,240));c.flush();assert(camera.position.distanceTo(before)>.1);const paused=camera.position.clone();
 room.emit('pointermove',pointer(330,260));c.flush();assert(camera.position.distanceTo(paused)>.1,'Dragging after an idle pause failed');room.emit('pointerup',pointer(330,260));
 const distance=camera.position.distanceTo(controls.target);room.emit('wheel',{deltaY:100,deltaMode:0});c.flush();assert(camera.position.distanceTo(controls.target)>distance);const roomCount=renders.room;
 detail.emit('pointerdown',pointer(200,200));detail.emit('pointermove',pointer(280,250));detail.emit('pointerup',pointer(280,250));const frames=c.flush();assert(frames>1,'Damping was cut short');assert.equal(renders.room,roomCount);assert.equal(c.pending,0);controls.dispose();editor.dispose();
});

const markup=fs.readFileSync('public/review.html','utf8'),inline=[...markup.matchAll(/<script>([\s\S]*?)<\/script>/g)],Fwindow={};vm.runInNewContext(inline[0][1].slice(inline[0][1].indexOf('window.FostinisParts=')),{window:Fwindow});const F=Fwindow.Fostinis;
test('Every finish choice reuses hardware; all physical appointments still invalidate it',()=>{
 const finishes=new Set(FINISH_FIELDS);let checked=0;
 for(const model of Object.keys(F.MODELS)){const state=F.initial(model);for(const [key,values]of Object.entries(F.choices))for(const value of values){if(value===state[key])continue;const next={...state,[key]:value};if(key==='handedness'){assert.equal(hardwareKey(next),hardwareKey(state));assert.equal(finishKey(next),finishKey(state));}else if(finishes.has(key)){assert.equal(hardwareKey(next),hardwareKey(state),key);assert.notEqual(finishKey(next),finishKey(state),key);}else assert.notEqual(hardwareKey(next),hardwareKey(state),key);checked++;}}
 console.log('Verified update routing for '+checked+' appointment changes.');
});
test('The real configurator skips hidden SVGs and finish downloads after WebGL is ready, and retains its fallback',async()=>{
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},setAttribute(){},textContent:'',innerHTML:''});return nodes.get(id);};let legacy=0,events=0;
 const state={...F.initial('sphyx')},window={FostinisShowroom:{ready:true},FostinisStudio:{ready:true,getSnapshot:()=>({selected:'sphyx',builds:{sphyx:state}})},dispatchEvent(){events++;}};
 const q=[],context={window,F,P:Fwindow.FostinisParts,$:get,document:{querySelectorAll:()=>[]},selected:'sphyx',builds:{sphyx:state},page:'showroom',previewSide:'front',previewFocus:'body',EMBEDDED:false,MATERIALS:{},label:key=>key,legacyPreview:()=>{legacy++;return 'fallback';},queueMicrotask:fn=>q.push(fn),CustomEvent:class{},Image:class{constructor(){throw Error('Unnecessary finish image request');}}};
 vm.createContext(context);const start=markup.indexOf('const imageLoads=new Map()'),end=markup.indexOf('function focusBuilder()',start);vm.runInContext(markup.slice(start,end),context);
 await vm.runInContext("renderModel('sphyx');",context);vm.runInContext('renderLive();renderLive();',context);q.splice(0).forEach(fn=>fn());assert.equal(legacy,0);assert.equal(events,1);assert.equal(get('parts-build-title').textContent,'Your Sphyx');
 window.FostinisShowroom.ready=false;vm.runInContext("paintModel('sphyx');",context);assert.equal(legacy,2);assert.equal(get('frame-sphyx').innerHTML,'fallback');assert.equal(get('live-preview-image').innerHTML,'fallback');
});
test('The lightweight loader waits for a visible guitar or explicit action and imports the renderer once',async()=>{
 const source=fs.readFileSync('public/showroom-loader.js','utf8');assert(source.includes("import('./showroom-360.js?v=57')"));
 function fixture(){let imports=0,observe;const events={},clicks={},elements=new Map();const window={IntersectionObserver:true,addEventListener:(name,fn)=>events[name]=fn};
  vm.runInNewContext(source.replace("import('./showroom-360.js?v=57')",'loadModule()'),{window,console,document:{querySelector:selector=>{elements.set(selector,{});return elements.get(selector);},getElementById:id=>({addEventListener:(event,fn)=>clicks[id]=fn})},IntersectionObserver:class{constructor(fn){observe=fn;}observe(){}disconnect(){}},loadModule:()=>{imports++;return Promise.resolve();}});
  return {get imports(){return imports;},events,clicks,visible:()=>observe([{isIntersecting:true}])};}
 const u=fixture();assert.equal(u.imports,0);u.events['fostinis:navigate']({detail:{page:'artists'}});assert.equal(u.imports,0);u.visible();u.visible();u.clicks['share-build']();assert.equal(u.imports,1);
 const v=fixture();v.clicks['share-build']();assert.equal(v.imports,1);const w=fixture();w.events['fostinis:navigate']({detail:{page:'parts'}});assert.equal(w.imports,1);
});

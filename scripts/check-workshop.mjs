import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {BUILD_STAGES,MATERIAL_PANELS,applyWorkshopChoices} from '../src/workshop/journey.mjs';
import {makeBenchTools} from '../src/workshop/bench-tools.mjs';
import {copyWorkshopGeometry} from '../src/workshop/workbench.mjs';
import {makeAppointments,makeConstructionEffects} from '../src/workshop/construction.mjs';
import {createBuildClock,frameAt,stageStart,STAGE_SECONDS,TOTAL_SECONDS} from '../src/workshop/sequence.mjs';
import {makeHardware,makePickups} from '../src/showroom3d/geometry.mjs';

const html=fs.readFileSync('public/showroom.html','utf8'),script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1],window={};
vm.runInNewContext(script.slice(script.indexOf('window.FostinisParts=')),{window});
const F=window.Fostinis,base={model:'oryx',nickname:'My <Fostinis>',selections:F.initial('oryx'),customRequests:{inlays:{note:'Original artwork',uploads:[]}}};
const before=JSON.stringify(base),choices={wood:'quilt',inlays:'dots',fretboard:'maple'};
const next=applyWorkshopChoices(base,choices,F);
assert.equal(JSON.stringify(base),before,'Workshop exploration mutated the existing build');
assert.deepEqual(next.customRequests,base.customRequests);assert.equal(next.nickname,base.nickname);
for(const [key,value] of Object.entries(base.selections))assert.equal(next.selections[key],choices[key]??value,'Unrelated build option changed: '+key);
assert.throws(()=>applyWorkshopChoices(base,{...choices,inlays:'unquoted-custom-inlay'},F));
assert.equal(BUILD_STAGES.length,6);assert.equal(MATERIAL_PANELS.length,2);
// Playback has deterministic boundaries, an actual pause, and a terminal frame.
const clock=createBuildClock();assert.equal(clock.read().playing,false);clock.play();
for(let i=0;i<6;i++){
 assert.equal(clock.read().stage,i);clock.advance(STAGE_SECONDS[i]/2);assert.equal(clock.read().progress,.5);
 const held=clock.pause();clock.advance(40);assert.deepEqual(clock.read(),held);clock.play();clock.advance(STAGE_SECONDS[i]/2);
}
assert.equal(clock.read().complete,true);assert.equal(clock.read().playing,false);assert.equal(clock.read().time,TOTAL_SECONDS);
clock.play();assert.equal(clock.read().time,0);clock.jump(4,.5);assert.equal(clock.read().stage,4);assert.equal(clock.read().progress,.5);
clock.seek(-10);assert.equal(clock.read().time,0);clock.seek(1000);assert.equal(clock.read().complete,true);
for(let i=0;i<6;i++)assert.equal(frameAt(stageStart(i)).stage,i);

// Background objects retain local textures and have no inspection hit targets.
const scene=new T.Scene(),geometries=[],materials=[],textures=[];
const tools=makeBenchTools(scene,{texture:url=>{assert(fs.existsSync('public'+url),'Missing asset: '+url);const t=new T.Texture();textures.push(t);return t;},geometry:g=>{geometries.push(g);return g;},material:m=>{materials.push(m);return m;}});
scene.updateMatrixWorld(true);let triangles=0,meshes=0;
scene.traverse(m=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;for(const n of m.geometry.attributes.position.array)assert(Number.isFinite(n));}});
assert(meshes<200,'Tool draw calls exceeded the workbench budget');assert(triangles<180000,'Tool geometry exceeded the workbench budget');
scene.traverse(object=>assert.equal(object.userData.workshopStation,undefined));
const effects=makeConstructionEffects(scene,{geometry:g=>{geometries.push(g);return g;},material:m=>{materials.push(m);return m;}});
effects.update(4,.5,36);assert.equal(effects.booth.visible,true);assert.equal(effects.routing.visible,false);
for(const g of [effects.mistGeometry,effects.chipsGeometry])assert(g.attributes.position.count<=160,'Unbounded particle workload');
for(let i=0;i<=100;i++)effects.update(4,i/100,i/10);
for(const n of effects.mistGeometry.attributes.position.array)assert(Number.isFinite(n));
effects.update(5,1,61);assert.equal(effects.booth.visible,false);assert.equal(effects.routing.visible,false);

// Final component geometry must match the production guitar, for every pickup
// layout, with and without inlays. Mid-build parts must be visibly in flight.
const originalTextureLoad=T.TextureLoader.prototype.load;
T.TextureLoader.prototype.load=function(url,onLoad){assert(fs.existsSync('public'+url));if(onLoad)queueMicrotask(onLoad);return new T.Texture();};
function geometryStats(group){group.updateMatrixWorld(true);const v=new T.Vector3(),s={vertices:0,sum:[0,0,0],bounds:new T.Box3()};group.traverse(m=>{if(!m.isMesh||!m.visible)return;const p=m.geometry.attributes.position,index=m.geometry.index;for(let i=0;i<(index?.count||p.count);i++){v.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(m.matrixWorld);s.bounds.expandByPoint(v);s.vertices++;s.sum[0]+=v.x;s.sum[1]+=v.y;s.sum[2]+=v.z;}});return s;}
for(const model of ['sphyx','oryx','matadaur'])for(const inlays of ['none','dots','motif']){
 const state={...F.initial(model),inlays,fretboard:inlays==='dots'?'maple':'ebony'};
 for(const layout of ['h','hh','hsh','hss','hs','sss','ss']){
  state.pickupLayout=layout;const appointments=makeAppointments(model,state,window.FostinisParts),hardware=makeHardware(model,state,window.FostinisParts);
  appointments.update(1,1);assert.equal(appointments.board.visible,false);assert(appointments.items.every(i=>!i.object.visible));
  appointments.update(3,.2);assert(appointments.board.position.z>0);assert.equal(appointments.frets.filter(f=>f.visible).length,0);
  appointments.update(4,.5);assert.equal(appointments.board.position.z,0);assert.equal(appointments.frets.filter(f=>f.visible).length,24);assert(appointments.items.every(i=>!i.object.visible));
  assert.equal(appointments.inlays.length,inlays==='none'?0:inlays==='dots'?12:10);
  appointments.update(5,.1);assert(appointments.items[0].object.position.z>0);assert.equal(appointments.items.at(-1).object.visible,false);
  appointments.update(5,1);assert(appointments.items.every(i=>i.object.visible));
  const a=geometryStats(appointments.group),b=geometryStats(hardware);assert.equal(a.vertices,b.vertices);for(let i=0;i<3;i++)assert(Math.abs(a.sum[i]-b.sum[i])<.1,'Assembly moved an installed part');assert(a.bounds.min.distanceTo(b.bounds.min)<.001);assert(a.bounds.max.distanceTo(b.bounds.max)<.001);
  appointments.update(5,.2);appointments.update(5,1);assert.deepEqual(geometryStats(appointments.group).sum,a.sum,'Seeking drifted the installed geometry');
  for(const g of [appointments.group,hardware])g.traverse(m=>{if(m.isMesh)m.geometry.dispose();});
 }
}
T.TextureLoader.prototype.load=originalTextureLoad;

// Workshop geometry is independent: closing or changing stages cannot damage
// the already-loaded showroom guitar, including Oryx's corrected neck.
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
for(const name of ['sphyx_standard','oryx_standard','matadaur_standard','oryx_neck','shared_neck']){
 const file=fs.readFileSync('public/assets/cad/'+name+'.glb'),loaded=await loader.parseAsync(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'');
 if(name.endsWith('_standard')){
  const root=new T.Group(),body=loaded.scene.clone(true);root.scale.setScalar(.001);root.position.set(0,-.28,.04);body.scale.setScalar(1000);root.add(body);scene.add(root);
  body.traverse(m=>{if(m.isMesh)m.userData.region=m.material.name;});
  const pickups=makePickups(F.initial(name.split('_')[0]),window.FostinisParts);
  effects.configureRouting(body,root,pickups.children.map(p=>({y:p.position.y,kind:p.userData.pickupKind})));
  assert(effects.routeGeometry.attributes.position.count>=170);for(let p=0;p<=1;p+=.05){effects.update(1,p,p*10);assert(effects.routeGeometry.drawRange.count>0);}
  for(const n of effects.routeGeometry.attributes.position.array)assert(Number.isFinite(n));
  const bounds=new T.Box3().setFromBufferAttribute(effects.routeGeometry.attributes.position);assert(bounds.max.x<.35&&bounds.min.x>-.35);assert(bounds.max.y<.25&&bounds.min.y>-.8);
  root.removeFromParent();pickups.traverse(m=>{if(m.isMesh)m.geometry.dispose();});
 }
 const original=loaded.scene,copy=copyWorkshopGeometry(original),a=[],b=[];original.traverse(m=>{if(m.isMesh)a.push(m);});copy.traverse(m=>{if(m.isMesh)b.push(m);});assert.equal(a.length,b.length);assert(a.length>0);
 for(let i=0;i<a.length;i++){assert.notEqual(a[i].geometry,b[i].geometry);assert.deepEqual(a[i].geometry.attributes.position.array,b[i].geometry.attributes.position.array);const value=a[i].geometry.attributes.position.getX(0);b[i].geometry.attributes.position.setX(0,value+1);assert.equal(a[i].geometry.attributes.position.getX(0),value);let originalDisposed=false;a[i].geometry.addEventListener('dispose',()=>{originalDisposed=true;});b[i].geometry.dispose();assert.equal(originalDisposed,false);}
}
globalThis.window={...window,FostinisStudio:{getSavedBuild:()=>base}};globalThis.location={origin:'https://fostinisguitars.com'};
const {workshopMarkup}=await import('../src/workshop/workshop.mjs'),markup=workshopMarkup();
assert(markup.includes('My &lt;Fostinis&gt;'));assert(!markup.includes('My <Fostinis>'));
assert.equal([...markup.matchAll(/data-ws-stage=/g)].length,6);assert.equal([...markup.matchAll(/data-ws-panel=/g)].length,2);
assert(!/data-bench-hotspot|data-ws-focus|Examine the (router|chisels|plane)/.test(markup));
assert(markup.includes('Spray booth'));assert(markup.includes('data-ws-replay'));assert(markup.includes('data-ws-progress'));
assert(markup.includes('hv0_nwNajn0'));assert(markup.includes('RnpYLB1UWfA'));
assert(markup.includes('private journal'));assert(markup.includes('Workshop choices are a preview'));
for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();
console.log(`PASS: 61-second automatic sequence, pause/replay/seek; routing on all three CAD bodies; spray booth and bounded particles; complete assembly matches production geometry for 63 configurations; isolated CAD; preserved custom requests and selections; no tool-inspection links; retained archive films.`);

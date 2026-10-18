import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {makeHardware,NUT_Y,SADDLE_Y,NECK} from '../src/showroom3d/geometry.mjs';
import {applyHandedness} from '../src/showroom3d/handedness.mjs';
import {completedCamera} from '../src/showroom3d/assembled-preview.mjs';
import {playingStringPoint,playingAnchors,capturePlayingGuitar} from '../src/showroom3d/playing-view.mjs';
import {createShowroomBackline} from '../src/showroom3d/amplifier.mjs';
import {createPerformanceView} from '../src/playroom/performance.mjs';

const html=fs.readFileSync('public/showroom.html','utf8'),inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)],window={};
vm.runInNewContext(inline[0][1].slice(inline[0][1].indexOf('window.FostinisParts=')),{window});
const F=window.Fostinis;

test('Animation follows the real scale, string gauges, and left/right handed CAD guitars without clipping',async()=>{
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 async function asset(name){const b=fs.readFileSync('public/assets/cad/'+name+'.glb'),gltf=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');gltf.scene.scale.setScalar(1000);return gltf.scene;}
 assert.equal(playingStringPoint(0).x,2.5*7.1);assert.equal(playingStringPoint(5).x,-2.5*7.1);
 assert.equal(playingStringPoint(0,12).y,NUT_Y-NECK.scale/2);
 assert(Math.abs(playingStringPoint(0,24).y-(SADDLE_Y+NECK.scale/4))<1e-8);
 for(const id of ['sphyx','oryx','matadaur']){
  const group=new T.Group();group.scale.setScalar(.001);group.position.set(.52,.42,0);const body=await asset(id+'_standard');
  group.add(body,await asset(id==='oryx'?'oryx_neck':'shared_neck'),makeHardware(id,F.initial(id),window.FostinisParts));
  const rec={group,body,state:F.initial(id)};
  for(const handedness of ['right','left']){
   rec.state={...rec.state,handedness};applyHandedness(rec,rec.state);const camera=completedCamera(rec,{aspect:3.2}),anchors=playingAnchors(rec,camera,1600,500);
   for(const string of anchors){for(const p of [string.bridge,string.nut,string.pick,...string.frets,...string.fingers])assert(p.x>0&&p.x<1600&&p.y>0&&p.y<500,id+' anchor outside image');assert.equal(string.frets.length,25);assert(Math.abs(string.frets[12].x-string.nut.x)<Math.abs(string.bridge.x-string.nut.x));}
   assert(anchors[0].nut.y>anchors[5].nut.y,'Low E stays above high E on the actual front-facing instrument');
   assert(handedness==='right'?anchors[0].nut.x>anchors[0].bridge.x:anchors[0].nut.x<anchors[0].bridge.x);
  }
 }
});

test('Couch and wall rigs share Fostinis branding, stay inside the room, and leave the sofa and entry clear',()=>{
 const room=new T.Group(),{group,rigs}=createShowroomBackline(room,new T.Texture());
 assert.equal(rigs.length,4);assert.equal(group.parent,room);let logos=0,meshes=0;
 const sofa=new T.Box3(new T.Vector3(-2.24,.15,4.47),new T.Vector3(1.04,1.0,5.43));
 const entrance=new T.Box3(new T.Vector3(3.01,0,5.20),new T.Vector3(4.45,2.65,5.58));
 for(const rig of rigs){
  const bounds=new T.Box3().setFromObject(rig);assert(bounds.min.y>=-.001);assert(bounds.max.y<2.2);assert(bounds.min.x>-5.4&&bounds.max.x<5.4&&bounds.min.z>-5.6&&bounds.max.z<5.6);
  assert(!bounds.intersectsBox(sofa));assert(!bounds.intersectsBox(entrance));
  const direction=new T.Vector3(0,0,1).applyQuaternion(rig.quaternion);assert(direction.dot(rig.position.clone().setY(0).negate().normalize())>.7,'Cabinets face into the room');
  rig.traverse(m=>{if(m.isMesh){meshes++;if(m.name==='Fostinis signature badge')logos++;for(const v of m.geometry.attributes.position.array)assert(Number.isFinite(v));}});
 }
 assert.equal(logos,10);assert(meshes<55,'Furniture should use batched fittings, not hundreds of draw calls');
});

function canvasFixture(){
 const draws=[];const context=new Proxy({drawImage(...args){draws.push(args);}}, {get:(o,k)=>k in o?o[k]:(...args)=>{},set:(o,k,v)=>{o[k]=v;return true;}});
 globalThis.document={createElement:()=>({setAttribute(){},getContext:()=>context})};return {context,draws};
}
test('Guitar image capture restores the existing renderer and excludes the amps even on failure',()=>{
 const {draws}=canvasFixture(),scene=new T.Scene(),environmentGroup=new T.Group(),key=new T.DirectionalLight();scene.background=new T.Color('#24221f');scene.add(environmentGroup,key);key.castShadow=true;
 const group=new T.Group(),stand=new T.Group(),body=new T.Mesh(new T.BoxGeometry(300,1000,50));group.scale.setScalar(.001);group.add(body);scene.add(group,stand);
 let ratio=1.8,size=new T.Vector2(640,300),restored=0;const renderer={domElement:{},getSize:v=>v.copy(size),getPixelRatio:()=>ratio,setPixelRatio:r=>{ratio=r;},setSize:(w,h)=>size.set(w,h),render(){assert.equal(environmentGroup.visible,false);assert.equal(stand.visible,false);}};
 const context={scene,environmentGroup,key,renderer,models:new Map([['sphyx',{group,stand,body,state:{}}]]),selected:'sphyx',environment:new T.Texture(),afterCapture:()=>restored++};
 const frame=capturePlayingGuitar(context);assert.equal(frame.strings.length,6);assert.equal(draws.length,1);assert.equal(ratio,1.8);assert.deepEqual(size.toArray(),[640,300]);assert(environmentGroup.visible&&stand.visible&&key.castShadow);assert.equal(restored,1);
 renderer.render=()=>{throw Error('Device lost');};assert.throws(()=>capturePlayingGuitar(context),/Device lost/);assert(environmentGroup.visible&&stand.visible&&key.castShadow);assert.equal(ratio,1.8);assert.deepEqual(size.toArray(),[640,300]);assert.equal(restored,2);
});

test('Performance animation starts with notes, settles when they decay, and cancels immediately on stop or a new guitar',()=>{
 canvasFixture();let time=0,id=0;const jobs=new Map(),host={dataset:{},replaceChildren(...children){this.children=children;}};
 const view=createPerformanceView(host,{request:fn=>{jobs.set(++id,fn);return id;},cancel:id=>jobs.delete(id),now:()=>time,reduced:()=>false});
 const point={x:200,y:100},frame={canvas:{},width:1600,height:500,strings:Array.from({length:6},()=>({bridge:{x:1000,y:100},nut:point,pick:{x:900,y:100},frets:Array(25).fill(point),fingers:Array(25).fill(point)}))};
 view.note({string:0,fret:0});assert.equal(jobs.size,0);view.setFrame(frame);assert.equal(jobs.size,0);
 view.note({string:0,fret:12,duration:.25});view.note({string:5,fret:0,duration:.4});assert.equal(jobs.size,1);assert(view.active);
 function tick(ms){time+=ms;const callbacks=[...jobs.values()];jobs.clear();callbacks.forEach(fn=>fn(time));}
 tick(100);assert.equal(host.dataset.playing,'true');tick(500);assert.equal(jobs.size,0);assert.equal(host.dataset.playing,'false');
 view.note({string:1,fret:2});view.stop();assert.equal(jobs.size,0);assert.equal(view.active,false);
 view.note({string:2,fret:5});view.setFrame(frame);assert.equal(jobs.size,0);assert.equal(view.active,false);
 view.note({string:3,fret:9});view.clear();assert.equal(jobs.size,0);assert.equal(host.children.length,0);
});

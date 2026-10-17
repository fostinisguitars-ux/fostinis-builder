import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {makeHardware,SADDLE_Y} from '../src/showroom3d/geometry.mjs';
import {bridgeBodyType,bridgeRoutingKey,configureBridgeBody} from '../src/showroom3d/bridge-routing.mjs';
import {captureCompletedGuitar,completedCamera,completedKey,createCompletedPreview,renderGuitarView} from '../src/showroom3d/assembled-preview.mjs';

const html=fs.readFileSync('public/showroom.html','utf8'),inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)],window={};
vm.runInNewContext(inline[0][1].slice(inline[0][1].indexOf('window.FostinisParts=')),{window});
const F=window.Fostinis;
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=';
class Renderer{
 constructor(){this.ratio=1.8;this.size=new T.Vector2(640,300);this.calls=[];this.domElement={toDataURL:()=>pixel};}
 getSize(v){return v.copy(this.size);}getPixelRatio(){return this.ratio;}setPixelRatio(r){this.ratio=r;}setSize(w,h){this.size.set(w,h);}getContext(){return {isContextLost:()=>false};}
 render(scene,camera){const meshes=[];scene.traverseVisible(o=>{if(o.isMesh)meshes.push([o,o.material]);});this.calls.push({meshes,environment:scene.environment,background:scene.background.getHexString(),fog:scene.fog,camera});}
}
function context(){
 const scene=new T.Scene();scene.background=new T.Color('#24221f');scene.fog=new T.Fog('#24221f',14,28);scene.environment=new T.Texture();
 const environmentGroup=new T.Group(),key=new T.DirectionalLight('#fff3dc',3.1);key.castShadow=true;scene.add(environmentGroup,key);
 const models=new Map();for(const id of ['sphyx','oryx','matadaur']){const group=new T.Group(),stand=new T.Group();const body=new T.Mesh(new T.BoxGeometry(.32,.4,.04),new T.MeshPhysicalMaterial({color:'#ac5a24'}));group.add(body);scene.add(group,stand);models.set(id,{group,stand,body,state:{finish:'amber'}});}
 return {scene,models,selected:'oryx',environmentGroup,key,environment:new T.Texture(),renderer:new Renderer()};
}

test('Completed image uses identical showroom model and material objects, with the detail view lighting',()=>{
 const c=context(),rec=c.models.get(c.selected),material=rec.body.material;
 renderGuitarView(c,()=>c.renderer.render(c.scene,new T.PerspectiveCamera()));
 const detail=c.renderer.calls[0];
 const result=captureCompletedGuitar(c);
 const image=c.renderer.calls[1];
 assert.deepEqual(image.meshes,detail.meshes);assert.strictEqual(image.meshes[0][0],rec.body);assert.strictEqual(image.meshes[0][1],material);
 assert.strictEqual(image.environment,detail.environment);assert.equal(image.background,detail.background);assert.equal(image.fog,null);
 assert.equal(result.url,pixel);assert.equal(result.width,1600);assert.equal(result.height,600);
 assert.equal(c.renderer.getPixelRatio(),1.8);assert.deepEqual(c.renderer.getSize(new T.Vector2()).toArray(),[640,300]);
 assert.equal(material.color.getHexString(),'ac5a24');assert.equal(c.key.castShadow,true);assert.equal(c.environmentGroup.visible,true);
 assert([...c.models.values()].every(r=>r.group.visible&&r.stand.visible));
});

test('A failed capture restores the showroom and detail renderer without hiding guitars',()=>{
 const c=context(),before={background:c.scene.background,environment:c.scene.environment,fog:c.scene.fog};let restored=false;
 c.afterCapture=()=>{restored=true;};c.renderer.domElement.toDataURL=()=>{throw Error('Context interrupted');};
 assert.throws(()=>captureCompletedGuitar(c),/Context interrupted/);
 for(const k of Object.keys(before))assert.strictEqual(c.scene[k],before[k]);
 assert.equal(c.key.castShadow,true);assert.equal(c.environmentGroup.visible,true);assert(restored);
 assert([...c.models.values()].every(r=>r.group.visible&&r.stand.visible));assert.equal(c.renderer.ratio,1.8);assert.deepEqual(c.renderer.size.toArray(),[640,300]);
});

test('Full and body cameras fit actual CAD geometry for all three models, bridge routings and both sides',async()=>{
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),assets=new Map();let views=0;
 async function asset(name){if(!assets.has(name)){const b=fs.readFileSync('public/assets/cad/'+name+'.glb');assets.set(name,await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));}const object=assets.get(name).scene.clone(true);object.traverse(m=>{if(m.isMesh)m.geometry=m.geometry.clone();});object.scale.setScalar(1000);return object;}
 for(const model of ['sphyx','oryx','matadaur'])for(const bridgeModel of F.choices.bridgeModel){
  const group=new T.Group();group.position.set(model==='oryx'?0:model==='sphyx'?-.52:.52,.42,0);group.scale.setScalar(.001);
  const state={...F.initial(model),bridgeModel},body=await asset(model+'_'+bridgeBodyType(state));
  if(bridgeRoutingKey(state)!=='original')configureBridgeBody(body,await asset(model+'_standard'),state,SADDLE_Y);
  group.add(body,await asset(model==='oryx'?'oryx_neck':'shared_neck'),makeHardware(model,state,window.FostinisParts));
  for(const focus of ['full','body'])for(const side of ['front','back']){
   const camera=completedCamera({group,body},{side,focus,aspect:focus==='body'?4/3:8/3});
   const box=new T.Box3().setFromObject(focus==='body'?body:group);
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new T.Vector3(x,y,z).project(camera);assert(Math.abs(p.x)<.88&&Math.abs(p.y)<.88,model+'/'+bridgeModel+'/'+focus+'/'+side+' clipped');assert(p.z>-1&&p.z<1);}
   views++;
  }
 }
 console.log('Verified '+views+' camera / model / hardware combinations against CAD bounds.');
});

class Element{
 constructor(){this.children=[];this.attrs={};}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}replaceChildren(...children){this.children=children;}
}
function uiFixture(){
 const host=new Element();globalThis.document={getElementById:()=>host,createElement:()=>new Element()};globalThis.Image=class extends Element{async decode(){}};
 const c=context();let snapshot={selected:'oryx',builds:Object.fromEntries([...c.models].map(([id,r])=>[id,{...r.state}])),review:{side:'front',focus:'full'}};
 let pending=Promise.resolve(),textures=Promise.resolve();
 const controller=createCompletedPreview({studio:{getSnapshot:()=>structuredClone(snapshot)},F,context:c,waitForBuilds:()=>pending,waitForTextures:()=>textures});
 return {c,host,controller,get snapshot(){return snapshot;},set snapshot(s){snapshot=s;},set textures(p){textures=p;},set pending(p){pending=p;}};
}

test('Review switches sides/models/body detail and restores the completed image after Original shape',async()=>{
 const u=uiFixture();const initial=await u.controller.refresh();assert(u.host.children[0] instanceof Image);
 u.snapshot.review.side='original';u.controller.invalidate();u.host.replaceChildren('original reference');await u.controller.refresh();assert.equal(u.host.children[0],'original reference');
 u.snapshot.review.side='front';u.controller.invalidate();await u.controller.refresh();assert.strictEqual(u.host.children[0],initial.image);
 for(const selected of ['sphyx','oryx','matadaur'])for(const side of ['front','back'])for(const focus of ['full','body']){
  u.snapshot.selected=selected;u.snapshot.review={side,focus};u.controller.invalidate();const image=await u.controller.refresh();
  assert.equal(image.key,completedKey(u.snapshot));assert.match(image.image.alt,new RegExp(F.MODELS[selected].name));assert.match(image.image.alt,new RegExp(side));
  assert.equal(image.height,focus==='body'?1200:600);assert.equal(u.host.attrs['aria-busy'],undefined);
 }
});

test('Pending textures and rapid option changes never publish a stale completed preview',async()=>{
 const u=uiFixture();let release;u.textures=new Promise(resolve=>{release=resolve;});
 const stale=u.controller.refresh();assert.equal(u.host.attrs['aria-busy'],'true');assert(!(u.host.children[0] instanceof Image));
 u.snapshot.builds.oryx.finish='sapphire';u.c.models.get('oryx').state={finish:'sapphire'};u.controller.invalidate();const latest=u.controller.refresh();
 release();assert.equal(await stale,undefined);const result=await latest;assert.equal(result.key,completedKey(u.snapshot));assert.strictEqual(u.host.children[0],result.image);
});

test('Save preview downloads the displayed PNG and rejects a model change while preparing',async()=>{
 const u=uiFixture();const image=await u.controller.refresh();const calls=u.c.renderer.calls.length;
 const saved=await u.controller.exportPNG();assert.equal(saved.type,'image/png');assert.deepEqual(new Uint8Array(await saved.arrayBuffer()),new Uint8Array(await (await fetch(image.url)).arrayBuffer()));assert.equal(u.c.renderer.calls.length,calls);
 let release;u.pending=new Promise(resolve=>{release=resolve;});const pending=u.controller.exportPNG();u.snapshot.selected='sphyx';release();await assert.rejects(pending,/guitar changed/);
});

test('All native routes use showroom previews and PNG exports, retaining Original shape',()=>{
 let routes=0;
 for(const name of fs.readdirSync('public').filter(x=>x.endsWith('.html'))){const h=fs.readFileSync('public/'+name,'utf8');if(!h.includes('window.FostinisStudio='))continue;
  assert(h.includes("review:{side:view,focus:"),name);assert(h.includes('window.FostinisShowroom.exportPreview()'),name);assert(h.includes('/showroom-360.js?v=47'),name);assert(h.includes('/showroom-360.css?v=47'),name);
  const reviewStart=h.indexOf('function renderReview(){'),review=h.slice(reviewStart,h.indexOf('function go(id,',reviewStart));assert(review.includes("if(view==='original')"));assert(!review.includes('surfaceImage:'));assert(!review.includes("side:view==='back'"));
  const save=h.slice(h.indexOf('async function exportPreview(){'),h.indexOf('function exportBuild(){'));assert(!save.includes('F.renderer('));assert(!save.includes('materialURL('));assert(!save.includes('image/svg+xml'));
  for(const script of h.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script[1],{filename:name});routes++;
 }
 assert.equal(routes,233);
});

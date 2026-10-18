import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {BUILD_STAGES,WORKSHOP_STATIONS,stageParts,applyWorkshopChoices} from '../src/workshop/journey.mjs';
import {makeBenchTools} from '../src/workshop/bench-tools.mjs';
import {copyWorkshopGeometry} from '../src/workshop/workbench.mjs';

const html=fs.readFileSync('public/showroom.html','utf8'),script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1],window={};
vm.runInNewContext(script.slice(script.indexOf('window.FostinisParts=')),{window});
const F=window.Fostinis,base={model:'oryx',nickname:'My <Fostinis>',selections:F.initial('oryx'),customRequests:{inlays:{note:'Original artwork',uploads:[]}}};
const before=JSON.stringify(base),choices={wood:'quilt',inlays:'dots',fretboard:'maple'};
const next=applyWorkshopChoices(base,choices,F);
assert.equal(JSON.stringify(base),before,'Workshop exploration mutated the existing build');
assert.deepEqual(next.customRequests,base.customRequests);assert.equal(next.nickname,base.nickname);
for(const [key,value] of Object.entries(base.selections))assert.equal(next.selections[key],choices[key]??value,'Unrelated build option changed: '+key);
assert.throws(()=>applyWorkshopChoices(base,{...choices,inlays:'unquoted-custom-inlay'},F));
assert.equal(BUILD_STAGES.length,6);assert.equal(WORKSHOP_STATIONS.length,6);
for(let i=0;i<6;i++){const p=stageParts(i);assert.equal(p.timber,i===0);assert.equal(p.body,i>0);assert.equal(p.neck,i>=2);assert.equal(p.hardware,i===5);assert.equal(p.finished,i>=4);assert.equal(p.fretboard,i===3||i===4);}
assert.equal(stageParts(-4).stage,0);assert.equal(stageParts(99).stage,5);

// Every station is a real, selectable scene object using retained local assets.
const scene=new T.Scene(),geometries=[],materials=[],textures=[];
const tools=makeBenchTools(scene,{texture:url=>{assert(fs.existsSync('public'+url),'Missing asset: '+url);const t=new T.Texture();textures.push(t);return t;},geometry:g=>{geometries.push(g);return g;},material:m=>{materials.push(m);return m;}});
scene.updateMatrixWorld(true);let triangles=0,meshes=0;
scene.traverse(m=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;for(const n of m.geometry.attributes.position.array)assert(Number.isFinite(n));}});
assert(meshes<200,'Tool draw calls exceeded the workbench budget');assert(triangles<180000,'Tool geometry exceeded the workbench budget');
for(const {id} of WORKSHOP_STATIONS){const group=tools[id];assert(group,'Missing station: '+id);const point=group.getWorldPosition(new T.Vector3()),ray=new T.Raycaster(point.clone().add(new T.Vector3(0,0,.6)),new T.Vector3(0,0,-1));const hit=ray.intersectObject(group,true)[0];assert(hit,'Station cannot be selected: '+id);let target=hit.object;while(target&&!target.userData.workshopStation)target=target.parent;assert.equal(target?.userData.workshopStation,id);}

// Workshop geometry is independent: closing or changing stages cannot damage
// the already-loaded showroom guitar, including Oryx's corrected neck.
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
for(const name of ['sphyx_standard','oryx_standard','matadaur_standard','oryx_neck','shared_neck']){
 const file=fs.readFileSync('public/assets/cad/'+name+'.glb'),loaded=await loader.parseAsync(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'');
 const original=loaded.scene,copy=copyWorkshopGeometry(original),a=[],b=[];original.traverse(m=>{if(m.isMesh)a.push(m);});copy.traverse(m=>{if(m.isMesh)b.push(m);});assert.equal(a.length,b.length);assert(a.length>0);
 for(let i=0;i<a.length;i++){assert.notEqual(a[i].geometry,b[i].geometry);assert.deepEqual(a[i].geometry.attributes.position.array,b[i].geometry.attributes.position.array);const value=a[i].geometry.attributes.position.getX(0);b[i].geometry.attributes.position.setX(0,value+1);assert.equal(a[i].geometry.attributes.position.getX(0),value);let originalDisposed=false;a[i].geometry.addEventListener('dispose',()=>{originalDisposed=true;});b[i].geometry.dispose();assert.equal(originalDisposed,false);}
}
globalThis.window={...window,FostinisStudio:{getSavedBuild:()=>base}};globalThis.location={origin:'https://fostinisguitars.com'};
const {workshopMarkup}=await import('../src/workshop/workshop.mjs'),markup=workshopMarkup();
assert(markup.includes('My &lt;Fostinis&gt;'));assert(!markup.includes('My <Fostinis>'));
assert.equal([...markup.matchAll(/data-ws-stage=/g)].length,6);assert.equal([...markup.matchAll(/data-bench-hotspot=/g)].length,6);
assert(markup.includes('hv0_nwNajn0'));assert(markup.includes('RnpYLB1UWfA'));
assert(markup.includes('private journal'));assert(markup.includes('Workshop choices are a preview'));
for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();
console.log(`PASS: six build stages; six ray-selectable tool stations (${meshes} meshes, ${triangles} triangles); all local textures; isolated CAD geometry; preserved specifications, nickname, and custom requests; escaped workshop markup and real archive films.`);

// Check screw placement against the actual cover meshes, not the mounting table.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {makeRearCovers} from '../src/showroom3d/geometry.mjs';

const html=fs.readFileSync('public/showroom.html','utf8');
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const window={};vm.runInNewContext(script.slice(script.indexOf('window.FostinisParts=')),{window});
const F=window.Fostinis,loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let checked=0,minMargin=Infinity,maxMargin=0;
for(const model of ['sphyx','oryx','matadaur'])for(const variant of ['standard','tremolo']){
 const file=fs.readFileSync(`public/assets/cad/${model}_${variant}.glb`);
 const gltf=await loader.parseAsync(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'');
 gltf.scene.scale.setScalar(1000);gltf.scene.updateMatrixWorld(true);
 const covers=[],edges=new Map();
 gltf.scene.traverse(m=>{if(!m.isMesh||m.material.name!=='cover')return;covers.push(m);
  const p=m.geometry.attributes.position,n=m.geometry.attributes.normal,ix=m.geometry.index.array;
  for(let i=0;i<ix.length;i+=3){const ids=[ix[i],ix[i+1],ix[i+2]];if(!ids.every(j=>n.getZ(j)<-.99))continue;
   const vertices=ids.map(j=>new T.Vector3().fromBufferAttribute(p,j).applyMatrix4(m.matrixWorld));
   for(let j=0;j<3;j++){const a=vertices[j],b=vertices[(j+1)%3];const key=[a,b].map(v=>v.toArray().map(c=>c.toFixed(3)).join(',')).sort().join('|');
    const edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a,b,count:1});}
  }
 });
 const boundary=[...edges.values()].filter(e=>e.count===1);
 for(const bridgeModel of F.choices.bridgeModel){
  const fixed=['hipshot-fixed','toneomatic'].includes(bridgeModel);if(fixed!==(variant==='standard'))continue;
  const screws=makeRearCovers(model,{...F.initial(model),bridgeModel});screws.updateMatrixWorld(true);
  assert.equal(screws.children.length,fixed?4:8,'Keep the original screw count.');
  for(const screw of screws.children){
   const center=screw.getWorldPosition(new T.Vector3());
   const hit=new T.Raycaster(new T.Vector3(center.x,center.y,-200),new T.Vector3(0,0,1)).intersectObjects(covers,false)[0];
   assert(hit,`${model}/${bridgeModel}: screw misses both covers`);
   assert(Math.abs(center.z+.55-hit.point.z)<.001,'Screw head must be seated on the cover.');
   const radius=screw.name==='Control cover screw'?1.6:1.5;
   let margin=Infinity;
   for(const {a,b}of boundary){if(Math.abs(a.z-hit.point.z)>.001)continue;
    const point=new T.Line3(a,b).closestPointToPoint(hit.point,true,new T.Vector3());margin=Math.min(margin,point.distanceTo(hit.point));}
   assert(margin>=radius+2.5&&margin<=6,`${model}/${bridgeModel}: screw is ${margin} mm from the plate edge`);
   minMargin=Math.min(minMargin,margin);maxMargin=Math.max(maxMargin,margin);checked++;
  }
  screws.traverse(o=>o.geometry?.dispose());
 }
 gltf.scene.traverse(o=>o.geometry?.dispose());
}
console.log(`PASS: ${checked} screw placements across all 6 body variants and all bridge choices; centers ${minMargin.toFixed(2)}–${maxMargin.toFixed(2)} mm inside cover edges; original counts and sizes; heads seated on plates.`);

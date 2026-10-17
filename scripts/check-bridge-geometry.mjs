import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {bridgeBodyType,bridgeRoutingKey,bridgeOpening,configureBridgeBody} from '../src/showroom3d/bridge-routing.mjs';
import {makeBridge,makeRearCovers,SADDLE_Y,NUT_Y} from '../src/showroom3d/geometry.mjs';
import {configureUV} from '../src/showroom3d/materials.mjs';
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),cache=new Map();
export async function bodyAsset(name){if(!cache.has(name)){const b=fs.readFileSync('public/assets/cad/'+name+'.glb');cache.set(name,(await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene);}return cache.get(name);}
const region=(object,name)=>{let found;object.traverse(m=>{if(m.isMesh&&m.material.name===name)found=m;});return found;};
function area(geometry){const p=geometry.attributes.position,ix=geometry.index;let total=0;for(let i=0;i<(ix?ix.count:p.count);i+=3){const [a,b,c]=[0,1,2].map(j=>ix?ix.getX(i+j):i+j);total+=Math.abs((p.getX(b)-p.getX(a))*(p.getY(c)-p.getY(a))-(p.getY(b)-p.getY(a))*(p.getX(c)-p.getX(a)))/2;}return total;}
const ray=new T.Raycaster(),hit=(mesh,x,y)=>{ray.set(new T.Vector3(x,y,100),new T.Vector3(0,0,-1));return ray.intersectObject(mesh,false)[0];};

test('Each non-Floyd bridge restores the original carved top on all models; only its own opening remains',async()=>{
 for(const model of ['oryx','sphyx','matadaur']){
  const standard=await bodyAsset(model+'_standard'),original=region(standard,'top');
  for(const bridgeModel of ['gotoh-510','hipshot-contour','evertune']){
   const s={bridgeModel,hardware:'chrome'},base=await bodyAsset(model+'_tremolo'),body=base.clone(true);body.traverse(m=>{if(m.isMesh)m.geometry=m.geometry.clone();});
   const back=region(body,'back').geometry.attributes.position.array.slice(),cover=region(body,'cover').geometry.attributes.position.array.slice();
   configureBridgeBody(body,standard,s,SADDLE_Y);const top=region(body,'top');configureUV(top,'top');body.updateMatrixWorld(true);standard.updateMatrixWorld(true);
   const poly=bridgeOpening(s,SADDLE_Y),cutArea=Math.abs(poly.reduce((sum,a,i)=>{const b=poly[(i+1)%poly.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2);
   assert(Math.abs((area(original.geometry)-area(top.geometry)-cutArea)*1e6)<.015,model+'/'+bridgeModel+' opening area');
   let restored=0;for(let x=-44;x<=48;x+=8)for(let y=-117;y<=-43;y+=8){const point=[x/1000,y/1000];const inside=poly.every((a,i)=>{const b=poly[(i+1)%poly.length];return(b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0])>=-1e-12;});const reference=hit(original,...point),actual=hit(top,...point);if(inside){assert(!actual,'Opening blocked by top');continue;}assert(reference&&actual,'Unfilled inherited Floyd recess: '+model+'/'+bridgeModel+'/'+x+'/'+y);assert(actual.point.distanceTo(reference.point)<1e-7,'Carve changed');restored++;}
   assert(restored>20);
   const p=top.geometry.attributes.position,uv=top.geometry.attributes.uv;for(let i=0;i<p.count;i++){assert(Math.abs(uv.getX(i)-(p.getY(i)+.26)*2.2)<1e-7);assert(Math.abs(uv.getY(i)-(p.getX(i)*2.8+.5))<1e-7);}
   assert.deepEqual(region(body,'back').geometry.attributes.position.array,back);assert.deepEqual(region(body,'cover').geometry.attributes.position.array,cover);
   const wall=body.getObjectByName('Dedicated '+bridgeModel+' block routing');assert(wall?.geometry.attributes.position.count>30);assert.equal(makeRearCovers(model,s).children.length,8);
  }
 }
});

test('Floyd baseplates have side cutaways, a rising narrow rack, and projecting lock screws',()=>{
 for(const bridgeModel of ['floyd-original','floyd-1000','floyd-special','floyd-pro']){
  const bridge=makeBridge({bridgeModel,hardware:'chrome'}),plate=bridge.getObjectByName('Shaped Floyd baseplate and fine-tuner rack');assert(plate);const meta=plate.geometry.userData;
  // Test actual geometry, not only dimensions: the formerly solid rear corners
  // and the area beneath projecting screws must have no plate intersections.
  plate.updateMatrixWorld(true);for(const x of [-40,40])for(const y of [-37,-45])assert(!hit(plate,x,y),'Rectangular rear plate remains');
  assert(!hit(plate,0,bridgeModel==='floyd-pro'?-53:-61));assert(hit(plate,0,-10));assert(hit(plate,0,-40));
  assert(meta.rearWidthMm<68);assert(meta.frontWidthMm>90&&meta.frontWidthMm<92);
  const p=plate.geometry.attributes.position;let high=0;for(let i=0;i<p.count;i++)high=Math.max(high,p.getZ(i));assert(high>8&&high<13);assert.equal(bridge.position.y,SADDLE_Y);
 }
});

test('Bridge selection keys reset correctly in both directions and keep fixed bodies and scale intact',()=>{
 const sequence=['gotoh-510','floyd-original','hipshot-contour','floyd-pro','evertune','hipshot-fixed','toneomatic','gotoh-510'];
 for(const bridgeModel of sequence){const s={bridgeModel};assert.equal(bridgeRoutingKey(s),['gotoh-510','hipshot-contour','evertune'].includes(bridgeModel)?bridgeModel:'original');assert.equal(bridgeBodyType(s),['hipshot-fixed','toneomatic'].includes(bridgeModel)?'standard':'tremolo');}
 assert(Math.abs(NUT_Y-SADDLE_Y-647.7)<1e-8);
});

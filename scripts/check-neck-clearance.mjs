import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from 'three';
import {makePickups,makeFretboard,NECK,NUT_Y,SADDLE_Y} from '../src/showroom3d/geometry.mjs';

const html=fs.readFileSync('public/showroom.html','utf8');
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const window={};vm.runInNewContext(script.slice(script.indexOf('window.FostinisParts=')),{window});
const F=window.Fostinis,layout=JSON.parse(fs.readFileSync('scripts/cad/assembly-layout.json'));
assert.equal(NUT_Y-SADDLE_Y,647.7);
const end=NECK.offsetY-NECK.endX;
assert(Math.abs(end-layout.fretboardEndY)<1e-7);
let checked=0,minGap=Infinity,maxGap=0;
for(const model of ['oryx','sphyx','matadaur']){
 const state=F.initial(model);
 const board=makeFretboard(state).children[0].geometry;
 // Weld coincident face vertices and verify that every edge is shared twice.
 // This catches missing end grain, side gaps and an open underside.
 const pos=board.attributes.position,ids=[],points=new Map(),edges=new Map();
 for(let i=0;i<pos.count;i++){
  const key=[pos.getX(i),pos.getY(i),pos.getZ(i)].map(v=>v.toFixed(4)).join(',');
  if(!points.has(key))points.set(key,points.size);ids.push(points.get(key));
 }
 const ix=board.index.array;
 for(let i=0;i<ix.length;i+=3)for(let e=0;e<3;e++){
  const pair=[ids[ix[i+e]],ids[ix[i+(e+1)%3]]].sort((a,b)=>a-b),key=pair.join(',');
  edges.set(key,(edges.get(key)||0)+1);
 }
 assert([...edges.values()].every(n=>n===2),'Fretboard must be a closed surface');
 board.computeBoundingBox();assert(Math.abs(board.boundingBox.min.y-end)<.001);
 assert(Math.abs(board.boundingBox.max.y-NUT_Y)<.001);
 for(const pickupSet of F.choices.pickupSet)for(const pickups of F.choices.pickups){
  const root=makePickups({...state,pickupSet,pickups},window.FostinisParts);
  root.updateMatrixWorld(true);let pickupTop=-Infinity;
  for(const part of root.children[0].children){
   part.geometry.computeBoundingBox();
   if(part.geometry.boundingBox.max.z-part.geometry.boundingBox.min.z>10){
    pickupTop=Math.max(pickupTop,new T.Box3().setFromObject(part).max.y);
   }
  }
  const gap=end-pickupTop;assert(gap>0&&gap<=3.175+.001,`${model}/${pickupSet}/${pickups}: ${gap} mm`);
  minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);checked++;
  root.traverse(part=>part.geometry?.dispose());
 }
}
console.log(`PASS: ${checked} pickup/model combinations; gap ${minGap.toFixed(3)}–${maxGap.toFixed(3)} mm; closed fretboards; 647.7 mm scale unchanged.`);

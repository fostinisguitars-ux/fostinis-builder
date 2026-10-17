import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {Quaternion,Vector3} from 'three';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}),result={};
function hit(prim,x,y){const p=prim.getAttribute('POSITION').getArray(),norm=prim.getAttribute('NORMAL').getArray(),ix=prim.getIndices().getArray();let best;for(let k=0;k<ix.length;k+=3){const ids=[ix[k],ix[k+1],ix[k+2]],a=ids.map(i=>[...p.slice(i*3,i*3+3)].map(v=>v*1000));const den=(a[1][1]-a[2][1])*(a[0][0]-a[2][0])+(a[2][0]-a[1][0])*(a[0][1]-a[2][1]);if(Math.abs(den)<1e-12)continue;const u=((a[1][1]-a[2][1])*(x-a[2][0])+(a[2][0]-a[1][0])*(y-a[2][1]))/den,v=((a[2][1]-a[0][1])*(x-a[2][0])+(a[0][0]-a[2][0])*(y-a[2][1]))/den,w=1-u-v;if(Math.min(u,v,w)<-1e-7)continue;const z=a[0][2]*u+a[1][2]*v+a[2][2]*w;if(best&&best.positionMm[2]>=z)continue;const n=[0,1,2].map(j=>norm[ids[0]*3+j]*u+norm[ids[1]*3+j]*v+norm[ids[2]*3+j]*w),length=Math.hypot(...n);best={positionMm:[x,y,z],normal:n.map(v=>v/length),triangle:k/3};}return best;}
for(const model of ['sphyx','oryx','matadaur']){
 const doc=await io.read('public/assets/cad/'+model+'_standard.glb'),p=doc.getRoot().listMeshes()[0].listPrimitives(),top=p.find(p=>p.getMaterial().getName()==='top'),cover=p.find(p=>p.getMaterial().getName()==='cover'),point=hit(top,126,-126);let radiusSamples=0,coverSamples=0;
 for(let k=0;k<64;k++){const a=k/64*2*Math.PI,x=126+7.5*Math.cos(a),y=-126+7.5*Math.sin(a);if(hit(top,x,y))radiusSamples++;if(hit(cover,x,y))coverSamples++;}
 result[model]={...point,buttonRadiusMm:7.5,frontCircleSamplesInsideTop:radiusSamples,backCircleSamplesInsideCover:coverSamples,samples:64,backCoverCenter:hit(cover,126,-126)};
 // Every current reduced-control layout leaves pot 1 (bridge volume) vacant.
 // Its cap preserves the exact bore boundary and supplies the missing center surface.
 const fills=await io.read('public/assets/cad/pickup-layouts/'+model+'_standard_pickup_fills.glb'),patch=fills.getRoot().listMeshes().find(m=>m.getName()==='control_1').listPrimitives()[0],pos=patch.getAttribute('POSITION'),lo=pos.getMin([]),hi=pos.getMax([]),x=(lo[0]+hi[0])*500,y=(lo[1]+hi[1])*500;
 const seat=hit(patch,x,y),rotation=new Quaternion().setFromUnitVectors(new Vector3(0,0,1),new Vector3(...seat.normal));let raise=0,footprint=0;
 const rim=[];for(let k=0;k<64;k++){const a=k/64*2*Math.PI,v=new Vector3(7.4*Math.cos(a),7.4*Math.sin(a),1.4).applyQuaternion(rotation).add(new Vector3(...seat.positionMm)),surface=hit(top,v.x,v.y);if(!surface)throw Error(model+' killswitch rim leaves the knob dish');raise=Math.max(raise,surface.positionMm[2]+.15-v.z);rim.push({v,surface});if(hit(cover,v.x,v.y))footprint++;}
 seat.positionMm[2]+=raise;
 const clearances=rim.map(({v,surface})=>v.z+raise-surface.positionMm[2]);
 result[model].vacantPot={...seat,recessIndex:1,boreCenterMm:[x,y],seatingRaiseMm:raise,buttonRadiusMm:7.5,rimSamplesInsideTop:rim.length,backCircleSamplesInsideCover:footprint,samples:64,minRimClearanceMm:Math.min(...clearances),maxRimClearanceMm:Math.max(...clearances)};
}
fs.writeFileSync('scripts/cad/pickup-layouts/killswitch-placement.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

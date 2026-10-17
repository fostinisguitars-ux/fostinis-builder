import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
const root='public/assets/cad',out=root+'/pickup-layouts',io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}),report=JSON.parse(fs.readFileSync('scripts/cad/pickup-layouts/verification.json','utf8'));let meshes=0,triangles=0,maxUvError=0;
for(const [file,r]of Object.entries(report.files)){
 const original=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file+'.glb'))).digest('hex');if(original!==r.sourceSha256)throw Error('Original was modified: '+file);
 const doc=await io.read(path.join(out,r.output));for(const mesh of doc.getRoot().listMeshes()){const p=mesh.listPrimitives()[0],pos=p.getAttribute('POSITION').getArray(),n=p.getAttribute('NORMAL').getArray(),uv=p.getAttribute('TEXCOORD_0').getArray(),ix=p.getIndices().getArray();for(let i=0;i<pos.length/3;i++){if(![pos[i*3],pos[i*3+1],pos[i*3+2],n[i*3],n[i*3+1],n[i*3+2]].every(Number.isFinite))throw Error('Nonfinite');const e=Math.max(Math.abs(uv[i*2]-(pos[i*3+1]+.26)*2.2),Math.abs(uv[i*2+1]-(pos[i*3]*2.8+.5)));maxUvError=Math.max(maxUvError,e);if(Math.abs(Math.hypot(...n.slice(i*3,i*3+3))-1)>1e-6)throw Error('Bad normal');}
  for(let i=0;i<ix.length;i+=3){const[a,b,c]=ix.slice(i,i+3),signed=(pos[b*3]-pos[a*3])*(pos[c*3+1]-pos[a*3+1])-(pos[b*3+1]-pos[a*3+1])*(pos[c*3]-pos[a*3]);if(signed< -1e-14)throw Error('Back-facing patch');}
  meshes++;triangles+=ix.length/3;
 }
}
const checks={originalGlbsUnchanged:true,serializedGlbReadable:true,meshes,triangles,maxUvError,allPositionsAndNormalsFinite:true,allNormalsUnit:true,noReversedTopTriangles:true};report.serializedChecks=checks;fs.writeFileSync('scripts/cad/pickup-layouts/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(checks,null,2));

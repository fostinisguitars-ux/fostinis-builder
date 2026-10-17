// Rebuild only the Oryx neck asset; no other guitar or showroom asset is written.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {reorder} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';

const source=process.argv[2];
assert(source&&fs.existsSync(source),'Pass the original, unscaled neck STEP file.');
await MeshoptEncoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder
});
const target='public/assets/cad/oryx_neck.glb';
const doc=await io.read(target);
assert(!doc.getRoot().getAsset().extras?.oryxContinuousShaft,'This exported asset has already been repaired.');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fostinis-oryx-surface-'));
function decoded(document){
  return document.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).map(p=>({
    material:p.getMaterial().getName(),
    positions:Array.from(p.getAttribute('POSITION').getArray()),
    normals:Array.from(p.getAttribute('NORMAL').getArray()),
    uv:Array.from(p.getAttribute('TEXCOORD_0').getArray()),
    indices:Array.from(p.getIndices().getArray())
  }));
}
function python(args){
  const run=spawnSync('python3',args,{stdio:'inherit'});
  if(run.error)throw run.error;
  assert.equal(run.status,0,'Oryx surface repair/validation failed.');
}
try{
  const before=path.join(temp,'before.json'),after=path.join(temp,'after.json');
  const shapeReport=path.join(temp,'shape-report.json'),validation=path.join(temp,'validation.json');
  fs.writeFileSync(before,JSON.stringify(decoded(doc)));
  python(['scripts/cad/smooth-oryx-neck.py',source,before,after,shapeReport]);
  const repaired=JSON.parse(fs.readFileSync(after));
  const neck=repaired.find(p=>p.material==='neck');
  for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
    if(primitive.getMaterial().getName()!=='neck')continue;
    primitive.getAttribute('POSITION').setArray(new Float32Array(neck.positions));
    primitive.getAttribute('NORMAL').setArray(new Float32Array(neck.normals));
    primitive.getAttribute('TEXCOORD_0').setArray(new Float32Array(neck.uv));
    primitive.getIndices().setArray(new Uint32Array(neck.indices));
  }
  doc.getRoot().getAsset().extras={...doc.getRoot().getAsset().extras,oryxContinuousShaft:true};
  await doc.transform(reorder({encoder:MeshoptEncoder,target:'size'}));
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const staged=path.join(temp,'oryx_neck.glb');
  await io.write(staged,doc);
  const compressed=await io.read(staged);
  fs.writeFileSync(after,JSON.stringify(decoded(compressed)));
  // Validate the actual, decoded delivery file, not just the pre-encode arrays.
  python(['scripts/cad/check-oryx-surface.py',before,after,validation]);
  fs.copyFileSync(staged,target);
  const report={...JSON.parse(fs.readFileSync(shapeReport)),validation:JSON.parse(fs.readFileSync(validation))};
  fs.writeFileSync('scripts/cad/oryx-neck-surface-report.json',JSON.stringify(report,null,2)+'\n');
  const manifestPath='public/assets/cad/manifest.json';
  const manifest=JSON.parse(fs.readFileSync(manifestPath));
  manifest.oryx_neck.vertices=repaired.reduce((sum,p)=>sum+p.positions.length/3,0);
  manifest.oryx_neck.triangles=repaired.reduce((sum,p)=>sum+p.indices.length/3,0);
  manifest.oryx_neck.bytes=fs.statSync(target).size;
  manifest.oryx_neck.surfaceRepair={type:'continuous-shaft',blendRangeYmm:report.blendRangeYmm};
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  console.log('PASS: repaired, losslessly compressed, and validated only oryx_neck.glb.');
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}

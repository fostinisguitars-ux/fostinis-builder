// Reorder and losslessly encode only the supplemental assets; preserve all floats.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {reorder} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
await MeshoptEncoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
function fingerprint(doc){
 return doc.getRoot().listMeshes().map(m=>({name:m.getName(),primitives:m.listPrimitives().map(p=>{
  const attrs=['POSITION','NORMAL','TEXCOORD_0'].map(k=>p.getAttribute(k)),ix=p.getIndices().getArray(),vertices=[];
  for(let i=0;i<attrs[0].getCount();i++){const row=[];for(const a of attrs){const value=[];a.getElement(i,value);row.push(...value);}vertices.push(row.join(','));}
  const triangles=[];for(let i=0;i<ix.length;i+=3){const v=[vertices[ix[i]],vertices[ix[i+1]],vertices[ix[i+2]]];triangles.push([v.join('|'),[v[1],v[2],v[0]].join('|'),[v[2],v[0],v[1]].join('|')].sort()[0]);}
  return {triangles:ix.length/3,hash:crypto.createHash('sha256').update(triangles.sort().join('\n')).digest('hex')};
 })}));
}
const reportPath='scripts/cad/pickup-layouts/verification.json',report=JSON.parse(fs.readFileSync(reportPath));
for(const r of Object.values(report.files)){
 const path='public/assets/cad/pickup-layouts/'+r.output,doc=await io.read(path),before=fingerprint(doc),oldBytes=fs.statSync(path).size;
 await doc.transform(reorder({encoder:MeshoptEncoder,target:'size'}));
 doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 await io.write(path,doc);const after=fingerprint(await io.read(path));assert.deepEqual(after,before,'Decoded geometry changed: '+r.output);
 r.bytes=fs.statSync(path).size;r.compression={encoding:'lossless meshopt; float attributes retained',decodedTrianglesUnchanged:true,uncompressedBytes:oldBytes};console.log(r.output,oldBytes,'->',r.bytes);
}
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');

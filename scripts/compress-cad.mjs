import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS,EXTMeshoptCompression } from '@gltf-transform/extensions';
import { reorder } from '@gltf-transform/functions';
import { MeshoptEncoder,MeshoptDecoder } from 'meshoptimizer';
await MeshoptEncoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
for(const f of fs.readdirSync('public/assets/cad').filter(f=>f.endsWith('.glb'))){const path='public/assets/cad/'+f,doc=await io.read(path),before=fs.statSync(path).size;
 // Keep FLOAT positions and analytical normals at their existing precision.
 // Only reorder + lossless encoding: no quantization, simplification or rescaling.
 await doc.transform(reorder({encoder:MeshoptEncoder,target:'size'}));
 doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 await io.write(path,doc);console.log(f,before,'->',fs.statSync(path).size);
}

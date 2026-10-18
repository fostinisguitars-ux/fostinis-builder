import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';
import './extract-shared-commerce.mjs';
import './sync-playroom.mjs';
import './sync-atelier.mjs';
await copyFile('src/showroom3d/showroom-loader.mjs','public/showroom-loader.js');
await build({entryPoints:['src/showroom3d/showroom.mjs'],outfile:'public/showroom-360.js',bundle:true,minify:true,format:'esm',target:['es2020'],legalComments:'eof'});
await build({entryPoints:['src/sharing/build-sharing.mjs'],outfile:'public/build-sharing.js',bundle:true,minify:true,format:'iife',target:['es2020'],legalComments:'eof'});
await build({entryPoints:['src/playroom/playroom.mjs'],outfile:'public/playroom.js',bundle:true,minify:true,format:'esm',target:['es2020'],legalComments:'eof'});
console.log('Built local 360 showroom module');

await build({entryPoints:['src/atelier/atelier.mjs'],outfile:'public/atelier.js',bundle:true,minify:true,format:'esm',target:['es2020'],legalComments:'eof'});
await build({entryPoints:['src/atelier/materials.mjs'],outfile:'public/atelier-materials.js',bundle:true,minify:true,format:'esm',target:['es2020'],legalComments:'eof'});

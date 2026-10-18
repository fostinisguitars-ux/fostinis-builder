import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';
await copyFile('src/showroom3d/showroom-loader.mjs','public/showroom-loader.js');
await build({entryPoints:['src/showroom3d/showroom.mjs'],outfile:'public/showroom-360.js',bundle:true,minify:true,format:'esm',target:['es2020'],legalComments:'eof'});
await build({entryPoints:['src/sharing/build-sharing.mjs'],outfile:'public/build-sharing.js',bundle:true,minify:true,format:'iife',target:['es2020'],legalComments:'eof'});
console.log('Built local 360 showroom module');

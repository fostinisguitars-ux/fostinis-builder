import {readFile,writeFile,readdir} from 'node:fs/promises';
import {PUBLIC_ORIGINS} from '../lib/commerce/origins.mjs';

// Keep standalone routes in sync with the same engine used for server quotes.
const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('lib/commerce/catalog.json',root),'utf8'));
const catalogScript='/commerce-catalog.js?v='+catalog.version;
await writeFile(new URL('public/commerce-catalog.js',root),'// Shared catalog; generated from lib/commerce/catalog.json.\nwindow.FostinisCommerceCatalog='+JSON.stringify(catalog)+';\n');
const engine=(await readFile(new URL('lib/commerce/pricing-engine.mjs',root),'utf8')).replace("import {createElectronics} from './electronics.mjs';\n",'').replace('export function createPricingEngine','function createPricingEngine');
let count=0;
for(const file of await readdir(new URL('public/',root))){
 if(!file.endsWith('.html'))continue;
 const path=new URL('public/'+file,root),html=await readFile(path,'utf8');
 const start=html.indexOf('// One calculation is shared by the browser and the checkout server.');
 if(start<0)continue;
 const catalogStart=html.indexOf('window.FostinisPricing=createPricingEngine(',start);
 const end=html.indexOf('\n',catalogStart);
 if(catalogStart<0||end<0)throw new Error('Missing pricing embed in '+file);
 let updated=html.slice(0,start)+engine+'window.FostinisPricing=createPricingEngine(window.FostinisCommerceCatalog);'+html.slice(end);
 const configGuard="if("+JSON.stringify(PUBLIC_ORIGINS)+".includes(location.origin))fetch('/api/commerce/config'";
 updated=updated.replace(/if\(location\.origin==='https:\/\/fostinis-design-review\.bouncybow11\.chatgpt\.site'\)fetch\('\/api\/commerce\/config'/,configGuard);
 updated=updated.replace(/if\(\[[^\n]+?\]\.includes\(location\.origin\)\)fetch\('\/api\/commerce\/config'/,configGuard);
 // A classic blocking script loads once before the existing inline application.
 if(updated.includes('src="/commerce-catalog.js'))updated=updated.replace(/src="\/commerce-catalog\.js[^\"]*"/,'src="'+catalogScript+'"');
 else updated=updated.replace('<script>','<script src="'+catalogScript+'"></script>\n<script>');
 if(updated!==html)await writeFile(path,updated);
 count++;
}
console.log('Synchronized pricing on '+count+' standalone routes.');

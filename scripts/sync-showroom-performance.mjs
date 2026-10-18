import fs from 'node:fs';
let count=0;
for(const file of fs.readdirSync('public').filter(name=>name.endsWith('.html'))){
 const path='public/'+file;let html=fs.readFileSync(path,'utf8');if(!html.includes('window.FostinisStudio='))continue;
 function replace(from,to){if(!html.includes(from))throw Error('Missing performance insertion in '+file+': '+from.slice(0,80));html=html.replace(from,to);}
 if(!html.includes('// On-demand showroom updates, revision 53.')){
  replace('async function renderModel(id){\n',"async function renderModel(id){\n if(window.FostinisShowroom?.ready){paintModel(id);return;}\n");
  replace("$('frame-'+id).innerHTML=legacyPreview(id,s,{upright:true,surfaceImage:surface,cutout:true,stand:true});","if(!window.FostinisShowroom?.ready)$('frame-'+id).innerHTML=legacyPreview(id,s,{upright:true,surfaceImage:surface,cutout:true,stand:true});");
  replace("$('live-preview-image').innerHTML=legacyPreview(selected,s,options);$('parts-preview-image').innerHTML=legacyPreview(selected,s,options);","if(!window.FostinisShowroom?.ready){const preview=legacyPreview(selected,s,options);$('live-preview-image').innerHTML=preview;$('parts-preview-image').innerHTML=preview;}");
  replace("function notifyVirtualShowroom(){if(window.FostinisStudio?.ready)window.dispatchEvent(new CustomEvent('fostinis:build'));}",`// On-demand showroom updates, revision 53.
let lastVirtualSnapshot='';
function notifyVirtualShowroom(){if(!window.FostinisStudio?.ready)return;const next=JSON.stringify(window.FostinisStudio.getSnapshot());if(next===lastVirtualSnapshot)return;lastVirtualSnapshot=next;window.dispatchEvent(new CustomEvent('fostinis:build'));}`);
  replace("window.addEventListener('fostinis:navigate',followNavigation);","window.addEventListener('fostinis:navigate',followNavigation);\n window.addEventListener('fostinis:3d-unavailable',()=>{for(const id of Object.keys(F.MODELS))renderModel(id);});");
 }
 html=html.replace(/\/showroom-360\.js\?v=\d+/g,'/showroom-loader.js?v=53');
 html=html.replace(/(\/showroom-(?:loader\.js|360\.css)\?v=)\d+/g,(_,prefix)=>prefix+'53');
 fs.writeFileSync(path,html);count++;
}
console.log('Optimized showroom work on '+count+' routes');

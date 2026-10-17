import fs from 'node:fs';

const shared=fs.readFileSync('src/faded-burst.mjs','utf8').replace('export function createBurstFinishes','function createBurstFinishes');
const palette=" {id:'faded',name:'Faded burst · chosen color',mid:'#000000',edge:'#000000'},";
const query=`// Validated links let a customer open an example without replacing their other appointments.
const finishQuery=new URLSearchParams(window.location.search);
if(Object.prototype.hasOwnProperty.call(F.MODELS,finishQuery.get('model')))selected=finishQuery.get('model');
let linkedFinishChanged=false;
for(const key of ['finish','finishType','burst','burstWidth']){const value=finishQuery.get(key);if(F.choices[key].includes(value)){builds[selected]=F.normalize(selected,{...builds[selected],[key]:value});linkedFinishChanged=true;}}
if(linkedFinishChanged){step='finish';previewFocus='body';previewSide='front';}
`;
const wash=`function fadedWash(palette,key,box,mask){
 if(palette.id!=='faded')return '';
 const [x,y,w,h]=box,gradient=u('faded-center-'+key);
 return \`<defs><radialGradient id="\${gradient}" cx="50%" cy="50%" r="62%"><stop stop-color="#ffffff" stop-opacity=".42"/><stop offset=".28" stop-color="#ffffff" stop-opacity=".34"/><stop offset=".88" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><rect data-component="faded-center" x="\${x}" y="\${y}" width="\${w}" height="\${h}" fill="url(#\${gradient})" \${mask?'mask="'+url(mask)+'"':''}/>\`;
}
`;
let count=0;
for(const file of fs.readdirSync('public').filter(f=>f.endsWith('.html'))){
 const path='public/'+file,original=fs.readFileSync(path,'utf8');
 if(!original.includes('window.FostinisStudio='))continue;
 let html=original;
 const replace=(before,after)=>{if(html.includes(after))return;if(html.includes(before))html=html.replace(before,after);else throw Error('Missing faded-burst anchor in '+file+': '+before);};
 if(!html.includes(palette))replace(" {id:'none',name:'No burst',mid:'#000000',edge:'#000000'},", " {id:'none',name:'No burst',mid:'#000000',edge:'#000000'},\n"+palette);
 if(!html.includes('function createBurstFinishes('))replace('function renderer(assets){',shared+"\nconst {finishColor,resolveBurst}=createBurstFinishes({BURSTS,WOODS,FINISHES,SOLID_COLORS});\nfunction renderer(assets){");
 replace('const API={CONTOURS,','const API={finishColor,resolveBurst,CONTOURS,');
 replace("headBurst=BURSTS.find(b=>b.id===(s.headstockBurst==='match'?s.burst:'none'))", "headBurst=resolveBurst(s,'headstock_front')");
 replace('const burst=BURSTS.find(b=>b.id===s.burst);',"const burst=resolveBurst(s,'top');");
 replace("const rb=BURSTS.find(b=>b.id===s[prefix+'Burst']);",'const rb=resolveBurst(s,prefix);');
 if(!html.includes('function fadedWash('))replace(" const lightAsset=assets[LIGHTING_ASSETS[id]];",wash+" const lightAsset=assets[LIGHTING_ASSETS[id]];");
 replace("${headBurst.id==='none'?'':`<defs><radialGradient", "${fadedWash(headBurst,'headstock',[hx,hy,hw,hh])}${headBurst.id==='none'?'':`<defs><radialGradient");
 replace('  const burst=resolveBurst(s,\'top\');\n  content+=',"  const burst=resolveBurst(s,'top');\n  content+=fadedWash(burst,'top',[bx-60,by-40,bw+120,bh+90],'surface');\n  content+=");
 replace('    <rect x="${rx-8}" y="${ry-8}" width="${rwWidth+16}" height="${rh+16}" fill="${url(burst)}"/>',"    ${fadedWash(rb,prefix,[rx-8,ry-8,rwWidth+16,rh+16])}\n    <rect x=\"${rx-8}\" y=\"${ry-8}\" width=\"${rwWidth+16}\" height=\"${rh+16}\" fill=\"${url(burst)}\"/>");
 replace('finish:F.BURST_CENTERS[linkedBurst],',"finish:linkedBurst==='faded'?builds[selected].finish:F.BURST_CENTERS[linkedBurst],");
 replace('finish:F.BURST_CENTERS[id],',"finish:id==='faded'?s.finish:F.BURST_CENTERS[id],");
 if(!html.includes('const finishQuery='))replace('function label(key,state=builds[selected]){',query+'function label(key,state=builds[selected]){');
 replace('Plus No burst and 10 graduated burst palettes.','Plus No burst, a faded burst in any chosen color, and 10 graduated burst palettes.');
 replace('Choose a center color, then No burst or a graduated edge palette.','Choose any color, then Faded burst for a lighter center and a deeper, richer edge in the same color, No burst for an even finish, or a separate edge palette.');
 replace("wrap.append(lab,sel);return wrap;}","wrap.append(lab,sel);if(['burst','backBurst','neckBurst'].includes(key)){const help=document.createElement('p');help.id='help-'+key;help.className='note';help.textContent='Faded burst follows your chosen color: a lighter center with a deeper, richer perimeter. Works with transparent dye and solid color.';sel.setAttribute('aria-describedby',help.id);wrap.append(help);}return wrap;}");
 // Spread is shared by the regional finishes, so it remains usable for a back-only burst.
 replace("$('option-burstWidth').disabled=state.burst==='none';", "$('option-burstWidth').disabled=['burst','backBurst','neckBurst'].every(key=>state[key]==='none');");
 html=html.replace(/(\/showroom-360\.(js|css)\?v=)\d+/g,(_,base)=>base+'48');
 if(html!==original)fs.writeFileSync(path,html);
 count++;
}
const path='lib/commerce/catalog.json',catalog=JSON.parse(fs.readFileSync(path,'utf8'));
for(const key of ['burst','backBurst','neckBurst']){
 const options=catalog.fields[key].options;
 catalog.fields[key].options={none:options.none,faded:{...options.honey,label:'Faded burst · chosen color'},...Object.fromEntries(Object.entries(options).filter(([id])=>id!=='none'&&id!=='faded'))};
}
catalog.version='2026-10-17-faded-burst';
catalog.fields.headstockBurst.legacyAliases.faded='match';
fs.writeFileSync(path,JSON.stringify(catalog,null,2)+'\n');
console.log('Synchronized faded bursts on '+count+' routes and the existing regional burst pricing.');

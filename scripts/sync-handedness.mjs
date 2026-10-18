import fs from 'node:fs';

// Native routes share the same embedded configurator. Apply this migration to
// every entry point, including finish presets and manufacturer-parts routes.
let count=0;
for(const file of fs.readdirSync('public').filter(name=>name.endsWith('.html'))){
 const path='public/'+file;let html=fs.readFileSync(path,'utf8');
 if(!html.includes('window.FostinisStudio='))continue;
 const replace=(from,to)=>{if(!html.includes(from))throw Error('Missing handedness insertion in '+file+': '+from.slice(0,90));html=html.replace(from,to);};
 if(!html.includes('// Right- and left-handed guitars, revision 55.')){
  replace("const DEFAULTS={finishType:","// Right- and left-handed guitars, revision 55.\nconst DEFAULTS={handedness:'right',finishType:");
  replace('const choices={finishType:',"const choices={handedness:['right','left'],finishType:");
  replace('const SCHEMA={finishType:',"const SCHEMA={handedness:{name:'Handedness',values:[['right','Right-handed'],['left','Left-handed']]},finishType:");
  replace("const fields=$('fields');fields.replaceChildren();","const fields=$('fields');fields.replaceChildren();fields.append(optionField('handedness'));");
  replace("if(key==='headstockBurst'){previewSide='front';previewFocus='headstock';}","if(key==='headstockBurst'){previewSide='front';previewFocus='headstock';}\n if(key==='handedness'){previewSide='front';previewFocus='full';}");
  replace("wrap.append(lab,sel);if(['burst'", "wrap.append(lab,sel);if(key==='handedness'){const help=document.createElement('p');help.id='help-handedness';help.className='note';help.textContent='Available on Sphyx, Oryx and Matadaur. Your choice is saved with this build.';sel.setAttribute('aria-describedby',help.id);wrap.append(help);}if(['burst'");
  replace("function previewCaption(id,s){", "function previewCaption(id,s){return label('handedness',s)+' · '+previewDetailCaption(id,s);}\nfunction previewDetailCaption(id,s){");
  replace("$('hardware-'+id).textContent=label('hardware',s)","$('hardware-'+id).textContent=label('handedness',s)+' · '+label('hardware',s)");
  replace("$('parts-build-summary').textContent=label('pickupSet',s)","$('parts-build-summary').textContent=label('handedness',s)+' · '+label('pickupSet',s)");
  replace("$('live-status').textContent=m.name+' updated · '","$('live-status').textContent=m.name+' updated · '+label('handedness',s)+' · '");
  replace("$('dock-finish').textContent=label('finish')", "$('dock-finish').textContent=label('handedness')+' · '+label('finish')");
  // These SVG atlases show horizontal guitars. Reflect the cropped guitar, not
  // the UI or its stand, and follow reflected detail bounds when zoomed in.
  replace(' const stand=options.stand&&upright?',` const handedTransform=s.handedness==='left'?\`translate(\${upright?h:w} 0) scale(-1 1)\`:'';
 if(s.handedness==='left'){const [vx,vy,vw,vh]=viewport.split(' ').map(Number);viewport=\`\${(upright?h:w)-vx-vw} \${vy} \${vw} \${vh}\`;}
 const stand=options.stand&&upright?`);
  replace('<svg data-preview-mode="${finishOnly?', '<svg data-handedness="${s.handedness}" data-preview-mode="${finishOnly?');
  replace("aria-label=\"${escape(m.name+' — '+", "aria-label=\"${escape(m.name+' — '+(s.handedness==='left'?'Left-handed':'Right-handed')+' — '+");
  replace('${isolatedView}${stand}<g transform="${transform}">','${isolatedView}${stand}<g data-component="guitar-handedness" transform="${handedTransform}"><g transform="${transform}">');
  replace('${content}</g></g></svg>`;','${content}</g></g></g></svg>`;');
  // Keep knob numerals readable.
  replace('<text x="${xx}" y="${yy+1.7}"', '<text transform="${s.handedness===\'left\'?`translate(0 ${2*(yy+1.7)}) scale(1 -1)`: \'\'}" x="${xx}" y="${yy+1.7}"');
 }
 // Revision 57: counter-reflect and turn the logo 180 degrees in its own plane.
 // In native atlas coordinates this is an X reflection; the full guitar's
 // reflection cancels the mirrored letters in the horizontal left-handed view.
 html=html.replace("<svg x=\"${logoX}\" y=\"${logoY}\" width=\"${logoW}\"", "<svg transform=\"${s.handedness==='left'?`translate(${2*logoX+logoW} 0) scale(-1 1)`: ''}\" x=\"${logoX}\" y=\"${logoY}\" width=\"${logoW}\"");
 html=html.replace(/(\/build-sharing\.js\?v=)\d+/g,'$155').replace(/(\/showroom-loader\.js\?v=)\d+/g,'$157').replace(/(\/commerce-catalog\.js\?v=)[^"\s]+/g,'$12026-10-18-handedness');
 fs.writeFileSync(path,html);count++;
}
console.log('Connected handedness on '+count+' routes');

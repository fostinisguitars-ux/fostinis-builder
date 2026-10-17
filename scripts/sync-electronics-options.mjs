import fs from 'node:fs';
const helper=fs.readFileSync('lib/commerce/electronics.mjs','utf8').replace('export function createElectronics','function createElectronics');
const shared='/* FOSTINIS_ELECTRONICS_START */\n'+helper+'\nwindow.FostinisElectronics=createElectronics();\n/* FOSTINIS_ELECTRONICS_END */';
let count=0;
for(const file of fs.readdirSync('public').filter(x=>x.endsWith('.html'))){
 const path='public/'+file;let h=fs.readFileSync(path,'utf8');if(!h.includes('window.FostinisStudio='))continue;
 const replace=(a,b)=>{if(!h.includes(a))throw Error(file+' missing '+a.slice(0,90));h=h.replace(a,b);};
 if(h.includes('/* FOSTINIS_ELECTRONICS_START */'))h=h.replace(/\/\* FOSTINIS_ELECTRONICS_START \*\/[\s\S]*?\/\* FOSTINIS_ELECTRONICS_END \*\//,shared);
 else{
  h=h.replace(/(window.FostinisParts=[^\n]+;)/,'$1\n'+shared);
  replace("choices.wiring.push('voice');",`choices.wiring=['threeway','fiveway','direct'];
Object.assign(DEFAULTS,{pickupLayout:'hh',singleCoilModel:'ssl2',singleCoilCover:'black',pot1Mod:'none',pot2Mod:'none',pot3Mod:'none',pot4Mod:'none',killswitch:'none',caseOption:'gigbag'});
Object.assign(choices,{pickupLayout:Object.keys(root.FostinisElectronics.layouts),singleCoilModel:['ssl2','ssl6'],singleCoilCover:['black','cream','white'],killswitch:['none','momentary'],caseOption:['gigbag','fitted']});for(const field of root.FostinisElectronics.potFields)choices[field]=Object.keys(root.FostinisElectronics.mods);`);
  replace(" const bridge=PARTS.bridges.find(p=>p.id===s.bridgeModel)"," Object.assign(s,root.FostinisElectronics.normalize(s,input||{}));\n const bridge=PARTS.bridges.find(p=>p.id===s.bridgeModel)");
  replace("hardware:['pickupSet','pickups','bridgeModel','hardware','tunerModel','knobs','wiring'],details:['fretboard','inlays']","hardware:['pickupLayout','pickupSet','singleCoilModel','singleCoilCover','pickups','bridgeModel','hardware','tunerModel','knobs','wiring','pot1Mod','pot2Mod','pot3Mod','pot4Mod','killswitch'],details:['fretboard','inlays','caseOption']");
  replace("const STORAGE='fostinis-showroom-v4';",`const E=window.FostinisElectronics;
for(const key of ['pickupLayout','singleCoilModel','singleCoilCover','pot1Mod','pot2Mod','pot3Mod','pot4Mod','killswitch','caseOption','wiring']){const field=window.FostinisPricing.catalog.fields[key];SCHEMA[key]={name:field.label,values:Object.entries(field.options).map(([id,o])=>[id,o.label])};}
function fieldName(key,s=builds[selected]){return E.potFields.includes(key)?E.potName(s,E.potFields.indexOf(key))+' modification':SCHEMA[key].name;}
function legacyPreview(id,state,options){return (state.pickupLayout||'hh')==='hh'&&state.killswitch!=='momentary'&&!E.potFields.some(k=>state[k]&&state[k]!=='none')?R.svg(id,state,options):'<p class="completed-preview-status">Your selected pickup layout and controls appear in the 3D showroom.</p>';}
const STORAGE='fostinis-showroom-v4';`);
  replace("const s=builds[selected],inspectingTuners=previewFocus==='headstock';s[key]=value;",`const s=builds[selected],inspectingTuners=previewFocus==='headstock';s[key]=value;
 if(key==='pickupSet'&&E.count(s,'S')&&E.system(s)!=='passive'){s.pickupLayout='hh';toast('This active pickup set uses the HH layout with matching electronics.');}
 if(key==='pickupLayout'&&E.count(s,'S')&&E.system(s)!=='passive')toast('Mixed layouts use passive pickups. JB / Jazz is selected; choose another passive set below.');`);
  replace("if(['pickupSet','pickups'].includes(key))previewFocus='pickups';","if(['pickupLayout','pickupSet','singleCoilModel','singleCoilCover','pickups'].includes(key)){previewFocus='pickups';previewSide='front';}");
  replace("if(['knobs','wiring'].includes(key))previewFocus='controls';","if(['knobs','wiring','killswitch',...E.potFields].includes(key)){previewFocus='controls';previewSide='front';}");
  replace("const p=window.FostinisPricing.priceOption(key,id,state);","const p=key==='pickupLayout'?window.FostinisPricing.priceOption('pickupSet',state.pickupSet,{...state,pickupLayout:id}):window.FostinisPricing.priceOption(key,id,state);");
  replace("lab.textContent=SCHEMA[key].name;","lab.textContent=fieldName(key);");
  replace("for(const key of keys){if(","for(const key of keys){if(");
  replace("Premium 3-way electronics are included. Pickup spacing follows the Les Paul visual reference. Component illustrations keep your original guitar outlines.","H means humbucker; S means single coil. Layout labels specify the neck, middle and bridge positions. Matching 3-way or 5-way switching and new-build routing are included. Each modified pot adds $50, regardless of whether it splits one or both humbuckers. Splitting a humbucker does not add a physical single-coil pickup. A momentary killswitch adds $75 installed. Mixed layouts use passive pickups; compatible mods appear below.");
  replace("  fields.append(section);","  if(group==='details'){const included=document.createElement('p');included.className='note';included.textContent='Every guitar includes a gig bag. Add a custom fitted case for $500.';section.append(included);}\n  fields.append(section);");
  const start=h.indexOf(" const set=P.pickups.find(p=>p.id===state.pickupSet);for(const o of $('option-wiring').options)"),end=h.indexOf(" for(const o of $('option-pickups').options)",start);
  if(start<0||end<0)throw Error('Missing compatibility controls in '+file);
  h=h.slice(0,start)+` const set=P.pickups.find(p=>p.id===state.pickupSet);
 $('option-wiring').disabled=true;
 for(const key of ['pickupLayout','singleCoilModel','singleCoilCover','killswitch','caseOption',...E.potFields])for(const option of $('option-'+key).options)option.textContent=window.FostinisPricing.catalog.fields[key].options[option.value].label+' · '+(key==='singleCoilModel'?'Priced in pickup package':key==='pickupLayout'?optionPriceLabel(key,option.value,state)+' pickup package':optionPriceLabel(key,option.value,state));
 for(const field of E.potFields){const select=$('option-'+field),index=E.potFields.indexOf(field);select.closest('.field').hidden=!E.layout(state).pots.includes(index);select.previousElementSibling.textContent=fieldName(field,state);for(const option of select.options)option.disabled=!E.allowedMod(state,field,option.value);}
 for(const key of ['singleCoilModel','singleCoilCover'])$('option-'+key).closest('.field').hidden=!E.count(state,'S');
 for(const key of ['pickupSet','pickups'])$('option-'+key).closest('.field').hidden=!E.count(state,'H');
 $('reference-pickupSet').hidden=!E.count(state,'H');
 for(const option of $('option-pickupSet').options)option.disabled=E.count(state,'S')>0&&E.system({...state,pickupSet:option.value})!=='passive';
`+h.slice(end);
  const cStart=h.indexOf('function circuit(){'),cEnd=h.indexOf('function updateInquiry(){',cStart);
  if(cStart<0||cEnd<0)throw Error('Missing electronics summary in '+file);
  h=h.slice(0,cStart)+`function circuit(){const s=builds[selected],l=E.layout(s),root=$('circuit');root.replaceChildren();const title=document.createElement('div');title.className='eyebrow';title.textContent='Electronics · your configuration';root.append(title);const summary=document.createElement('p');summary.textContent=l.label+' · '+label('wiring',s)+' · '+l.pots.length+' controls';root.append(summary);const list=document.createElement('ul');for(const i of l.pots){const row=document.createElement('li');row.textContent=E.potName(s,i)+': '+E.mods[s[E.potFields[i]]]+(s[E.potFields[i]]!=='none'?' (+$50)':'');list.append(row);}root.append(list);if(s.killswitch==='momentary'){const p=document.createElement('p');p.textContent='Momentary killswitch · press to mute, release to play. Installed: $75.';root.append(p);}const note=document.createElement('p');note.textContent=E.system(s)==='passive'?'Push-pull coil split uses one coil of a compatible humbucker. Series / parallel retains both coils. Each chosen modification uses one physical pot.':'Matched active controls and power are included. Fluence voice switching is available through a modified pot.';root.append(note);}
`+h.slice(cEnd);
  replace("SCHEMA[k].name+': '+label(k)","fieldName(k)+': '+label(k)");
  replace("dt.textContent=v.name;","dt.textContent=fieldName(k);");
  replace("const dd=document.createElement('dd');dd.textContent=label(k);","const dd=document.createElement('dd');dd.textContent=label(k);");
  replace("for(const [k,v] of Object.entries(SCHEMA)){const row=","for(const [k,v] of Object.entries(SCHEMA)){if(E.potFields.includes(k)&&!E.layout(s).pots.includes(E.potFields.indexOf(k)))continue;if(['singleCoilModel','singleCoilCover'].includes(k)&&!E.count(s,'S'))continue;if(['pickupSet','pickups'].includes(k)&&!E.count(s,'H'))continue;const row=");
  replace("+' hardware, '+label('pickups').toLowerCase()+'.';", "+' hardware · '+label('pickupLayout')+'.';");
  h=h.replaceAll('R.svg(selected,s,options)','legacyPreview(selected,s,options)').replaceAll("R.svg(id,s,{upright:true,surfaceImage:surface,cutout:true,stand:true})","legacyPreview(id,s,{upright:true,surfaceImage:surface,cutout:true,stand:true})");
  replace("row(box,'Wood & finish upgrades',money(q.materialUpgradeCents));","row(box,'Wood & finish upgrades',money(q.materialUpgradeCents));\n  row(box,'Electronics modifications',money(q.electronicsUpgradeCents));\n  row(box,'Case upgrade',money(q.accessoryUpgradeCents));");
  replace("'All other listed options are included. Shipping and tax are confirmed separately.'","'Gig bag and US shipping included. Applicable tax is calculated at checkout.'");
  replace("q.referenceCount+'/3)'","q.referenceCount+'/'+q.references.length+')'");
 }
 h=h.replace(/if\(key==='pickupSet'&&E.count\(s,'S'\)&&E.system\(s\)!=='passive'\)\{[^\n]+/,`if(key==='pickupSet'&&(!E.count(s,'H')||(E.count(s,'S')&&E.system({...s,pickupLayout:'hh'})!=='passive'))){s.pickupLayout='hh';toast('HH layout selected for this humbucker set. Choose another compatible layout below.');}`);
 h=h.replace(/function optionPriceLabel\(key,id,state=builds\[selected\]\)\{[^\n]+/,`function optionPriceLabel(key,id,state=builds[selected]){let candidate=state;if(key==='pickupLayout')candidate=E.normalize({...state,pickupLayout:id});if(key==='pickupSet'){candidate={...state,pickupSet:id};if(!E.count(candidate,'H')||(E.count(candidate,'S')&&E.system({...candidate,pickupLayout:'hh'})!=='passive'))candidate.pickupLayout='hh';candidate=E.normalize(candidate);}const p=key==='pickupLayout'||key==='pickupSet'?window.FostinisPricing.priceOption('pickupSet',candidate.pickupSet,candidate):window.FostinisPricing.priceOption(key,id,state);return p.cents===null?'Contact us':p.cents===0?'Included':'+'+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(p.cents/100);}`);
 h=h.replace('Manufacturer reference; illustrated on your guitar.','Manufacturer reference. Your selected pickup layout determines which units are fitted.');
 h=h.replace(/function exportBuild\(\)\{[^\n]+/,`function exportBuild(){download(JSON.stringify({schemaVersion:9,created:new Date().toISOString(),selectedModel:selected,builds,notes,labels:Object.fromEntries(Object.keys(F.MODELS).map(id=>[id,Object.fromEntries(Object.keys(SCHEMA).map(k=>[k,label(k,builds[id])]))])),status:'configured-build',geometry:'Revision 43: shared 3D showroom and assembled preview, selected pickup layout and controls, continuous wood fills for unused openings, optional momentary killswitch using a vacant knob recess when available. Original body, neck, headstock and 647.7 mm scale retained.',electronics:Object.fromEntries(Object.keys(F.MODELS).map(id=>[id,{layout:E.layout(builds[id]),selector:E.wiring(builds[id]),potMods:E.potFields.filter((k,i)=>E.layout(builds[id]).pots.includes(i)).map(k=>({pot:fieldName(k,builds[id]),mod:label(k,builds[id])})),killswitch:builds[id].killswitch}])),finish:'Digital preview; natural grain and physical finishes vary',pricing:Object.fromEntries(Object.keys(F.MODELS).map(id=>[id,window.FostinisPricing.quote(id,builds[id],notes[id])]))},null,2),'application/json','Fostinis_Three_Model_Builds.json');toast('Build sheet ready. Use the download link below if it does not open.');}`);
 fs.writeFileSync(path,h);count++;
}
console.log('Synchronized pickup layouts, pot mods, killswitch and case controls on '+count+' routes.');

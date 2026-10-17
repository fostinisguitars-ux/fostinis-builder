// Shared compatibility rules for the configurator, 3D model, and checkout.
export function createElectronics(){
 const layouts={
  h:{label:'H · single bridge humbucker',neck:null,middle:null,bridge:'H',pots:[0,2]},
  hh:{label:'HH · two humbuckers',neck:'H',middle:null,bridge:'H',pots:[0,1,2,3]},
  hsh:{label:'HSH · humbucker / single / humbucker',neck:'H',middle:'S',bridge:'H',pots:[0,2,3]},
  hss:{label:'HSS / SSH · neck single, middle single, bridge humbucker',neck:'S',middle:'S',bridge:'H',pots:[0,2,3]},
  hs:{label:'HS · neck single, bridge humbucker',neck:'S',middle:null,bridge:'H',pots:[0,2]},
  sss:{label:'SSS · three single coils',neck:'S',middle:'S',bridge:'S',pots:[0,2,3]},
  ss:{label:'SS · neck and bridge single coils',neck:'S',middle:null,bridge:'S',pots:[0,2]}
 };
 const potFields=['pot1Mod','pot2Mod','pot3Mod','pot4Mod'];
 const mods={none:'Standard pot', 'split-bridge':'Push-pull · bridge humbucker coil split','split-neck':'Push-pull · neck humbucker coil split','split-both':'Push-pull · split both humbuckers together','parallel-bridge':'Push-pull · bridge humbucker series / parallel','parallel-neck':'Push-pull · neck humbucker series / parallel',phase:'Push-pull · bridge pickup phase reverse','treble-bleed':'Push-pull · treble-bleed bypass',voice:'Push-pull · Fluence Voice 1 / 2'};
 const layout=s=>layouts[s.pickupLayout]||layouts.hh;
 const count=(s,type)=>['neck','middle','bridge'].filter(k=>layout(s)[k]===type).length;
 const system=s=>!count(s,'H')?'passive':s.pickupSet?.startsWith('fishman-')?'fluence':s.pickupSet?.startsWith('emg-')?'active':'passive';
 const wiring=s=>s.pickupLayout==='h'?'direct':layout(s).middle?'fiveway':'threeway';
 const potName=(s,i)=>s.pickupLayout==='hh'?['Neck volume','Bridge volume','Neck tone','Bridge tone'][i]:i===0?'Master volume':i===2?(layout(s).pots.length===2?'Master tone':'Neck / middle tone'):'Bridge tone';
 function targets(mod){return mod==='split-both'?['neck','bridge']:mod.startsWith('split-')||mod.startsWith('parallel-')?[mod.split('-')[1]]:[];}
 function allowedMod(s,field,mod,checkConflicts=true){
  if(mod==='none')return true;
  const i=potFields.indexOf(field),l=layout(s),sys=system(s);
  if(!mods[mod]||!l.pots.includes(i))return false;
  if(mod==='voice'){if(sys!=='fluence')return false;}
  else{
   if(sys!=='passive')return false;
   if(targets(mod).length&&(!targets(mod).every(p=>l[p]==='H')||s.pickupSet==='dimarzio-request'))return false;
   if(mod==='phase'&&count(s,'H')+count(s,'S')<2)return false;
   if(mod==='treble-bleed'&&i!==0&&!(s.pickupLayout==='hh'&&i===1))return false;
  }
  if(checkConflicts)for(const other of potFields){if(other===field)continue;const current=s[other]||'none';if(['voice','phase'].includes(mod)&&current===mod)return false;if(targets(mod).some(p=>targets(current).includes(p)))return false;}
  return true;
 }
 function migrate(input){const s={...input};if(!potFields.some(k=>Object.prototype.hasOwnProperty.call(input,k))){if(input.wiring==='split')s.pot3Mod=(input.pickupLayout||'hh')==='h'?'split-bridge':'split-both';if(input.wiring==='voice')s.pot3Mod='voice';}if(['split','voice'].includes(input.wiring))s.wiring=wiring(s);return s;}
 function normalize(state,input=state){
  const s={...state},legacy=migrate(input);s.pickupLayout=layouts[s.pickupLayout]?s.pickupLayout:'hh';
  if(count(s,'S')&&count(s,'H')&&system(s)!=='passive')s.pickupSet='sd-jb-jazz';
  if(!count(s,'H'))s.pickupSet='sd-jb-jazz';
  for(const field of potFields)s[field]=legacy[field]||s[field]||'none';
  for(const field of potFields){if(!allowedMod(s,field,s[field],false))s[field]='none';}
  const accepted={...s};for(const field of potFields)accepted[field]='none';
  for(const field of potFields)if(allowedMod(accepted,field,s[field]))accepted[field]=s[field];
  accepted.wiring=wiring(accepted);return accepted;
 }
 function issues(s){const out=[];if(count(s,'S')&&count(s,'H')&&system(s)!=='passive')out.push('Mixed single-coil layouts require a passive humbucker set.');if(s.wiring!==wiring(s))out.push('Choose the selector that matches the pickup layout.');for(const field of potFields)if(!allowedMod(s,field,s[field]||'none'))out.push('Choose a compatible modification for '+potName(s,potFields.indexOf(field))+'.');return out;}
 return {layouts,potFields,mods,layout,count,system,wiring,potName,allowedMod,migrate,normalize,issues};
}

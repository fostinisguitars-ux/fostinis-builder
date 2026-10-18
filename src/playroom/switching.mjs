// Mirrors the build's available hardware. Playback choices never alter an order.
export const LAYOUTS = {
 h:{bridge:'H'},hh:{neck:'H',bridge:'H'},hsh:{neck:'H',middle:'S',bridge:'H'},
 hss:{neck:'S',middle:'S',bridge:'H'},hs:{neck:'S',bridge:'H'},sss:{neck:'S',middle:'S',bridge:'S'},ss:{neck:'S',bridge:'S'}
};
export function positions(build){
 const l=LAYOUTS[build.pickupLayout]||LAYOUTS.hh;
 if(!l.neck)return [{id:'bridge',label:'Bridge',pickups:['bridge']}];
 return l.middle?[
  {id:'neck',label:'Neck',pickups:['neck']},{id:'neck-middle',label:'Neck + middle',pickups:['neck','middle']},
  {id:'middle',label:'Middle',pickups:['middle']},{id:'middle-bridge',label:'Middle + bridge',pickups:['middle','bridge']},
  {id:'bridge',label:'Bridge',pickups:['bridge']}
 ]:[{id:'neck',label:'Neck',pickups:['neck']},{id:'both',label:'Center · both',pickups:['neck','bridge']},{id:'bridge',label:'Bridge',pickups:['bridge']}];
}
export function modifications(build){
 return ['pot1Mod','pot2Mod','pot3Mod','pot4Mod'].filter(key=>build[key]&&build[key]!=='none').map(key=>({key,kind:build[key]}));
}
export function switchingVoice(build,position='bridge',enabled=new Set(),guitarVolume=10,guitarTone=10){
 const layout=LAYOUTS[build.pickupLayout]||LAYOUTS.hh,selection=positions(build).find(p=>p.id===position)||positions(build).at(-1);
 const mods=modifications(build).filter(m=>enabled.has(m.key)).map(m=>m.kind);
 const passive=!/^(emg|fishman)-/.test(build.pickupSet||'');
 const pickups=selection.pickups.map(place=>{
  const split=passive&&layout[place]==='H'&&(mods.includes('split-both')||mods.includes('split-'+place));
  const parallel=passive&&layout[place]==='H'&&mods.includes('parallel-'+place);
  const single=layout[place]==='S'||split;
  return {place,type:single?'S':'H',split,parallel,phase:passive&&place==='bridge'&&mods.includes('phase')&&selection.pickups.length>1?-1:1};
 });
 return {pickups,voice:mods.includes('voice')?2:1,trebleBleed:mods.includes('treble-bleed'),volume:guitarVolume,tone:guitarTone};
}

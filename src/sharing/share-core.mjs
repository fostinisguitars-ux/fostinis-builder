// Version 1 keeps a fixed order. Append a new codec version when fields change;
// never encode choice indexes, which can change when the catalog is reordered.
export const SHARE_FIELDS=Object.freeze(['finishType','backFinishType','neckFinishType','burst','headstockBurst','burstWidth','backBurst','neckBurst','finish','wood','sheen','pickups','bridge','hardware','wiring','tuners','fretboard','inlays','backWood','backFinish','backSheen','neckWood','neckFinish','neckSheen','pickupSet','bridgeModel','tunerModel','knobs','pickupLayout','singleCoilModel','singleCoilCover','killswitch','caseOption','pot1Mod','pot2Mod','pot3Mod','pot4Mod']);
export const PLATFORMS=Object.freeze({tiktok:{name:'TikTok',format:'story',url:'https://www.tiktok.com/'},instagram:{name:'Instagram',format:'portrait',url:'https://www.instagram.com/'},x:{name:'X',format:'portrait',url:'https://x.com/compose/post'},facebook:{name:'Facebook',format:'portrait',url:'https://www.facebook.com/'},text:{name:'Text',format:'portrait'},email:{name:'Email',format:'portrait'}});
export const VIEWS=Object.freeze([{side:'front',label:'Front'},{side:'back',label:'Back'},{side:'angle',label:'45° view'}]);
export function cleanNickname(value){return typeof value==='string'?[...value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim()].slice(0,40).join(''):'';}
export function encodeBuild({model,selections,nickname},F){
 if(!Object.hasOwn(F.MODELS,model))throw Error('Choose a guitar to share.');
 const state=F.normalize(model,selections),payload={v:1,m:model,s:SHARE_FIELDS.map(key=>state[key]),n:cleanNickname(nickname)};
 const bytes=new TextEncoder().encode(JSON.stringify(payload));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeBuild(encoded,F){
 if(typeof encoded!=='string'||!encoded||encoded.length>4096||!/^[A-Za-z0-9_-]+$/.test(encoded))throw Error('This shared build link is incomplete. Ask for a new link.');
 try{
  const bytes=Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)),p=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(p.v!==1||!Object.hasOwn(F.MODELS,p.m)||!Array.isArray(p.s)||p.s.length!==SHARE_FIELDS.length||typeof p.n!=='string')throw Error('shape');
  const selections={};SHARE_FIELDS.forEach((key,i)=>{if(typeof p.s[i]!=='string'||!F.choices[key]?.includes(p.s[i]))throw Error('choice');selections[key]=p.s[i];});
  return {model:p.m,selections:F.normalize(p.m,selections),nickname:cleanNickname(p.n)};
 }catch{throw Error('This shared build link is invalid or uses unavailable options. Ask for a new link.');}
}
export function buildURL(data,F,origin){const url=new URL('/review.html',origin);url.searchParams.set('build',encodeBuild(data,F));url.hash='review';return url.href;}
export function shareKey(data){return JSON.stringify([data.model,data.selections,cleanNickname(data.nickname)]);}
export function socialSummary(data){
 const s=data.selections,l=data.labels;
 const finish=prefix=>[l[prefix?prefix+'Finish':'finish'],s[prefix?prefix+'Burst':'burst']!=='none'?l[prefix?prefix+'Burst':'burst']:'',l[prefix?prefix+'Sheen':'sheen']].filter(Boolean).join(' · ');
 const pickups=[l.pickupLayout,s.pickupLayout.includes('h')?l.pickupSet:'',s.pickupLayout.includes('s')?l.singleCoilModel:''].filter(Boolean).join(' · ');
 return [{label:'FINISHES',value:'Top: '+finish('')+'\nBack: '+finish('back')+'\nNeck: '+finish('neck')},{label:'PICKUPS',value:pickups},{label:'HARDWARE',value:[l.hardware,l.bridgeModel,l.tunerModel].filter(Boolean).join(' · ')}];
}
export function messageFor(platform,data,url){
 const name=cleanNickname(data.nickname),intro=(name?'“'+name+'” — ':'')+data.modelName+' by Fostinis Guitars';
 if(platform==='text'||platform==='email')return intro+'\n\n'+(name?name+'\n':'')+'All Appointments\n'+[['Model',data.modelName],...data.appointments].map(([label,value])=>label+': '+value).join('\n')+'\n\nSee the front, back and 45° view:\n'+url;
 return 'Meet '+intro+'.\n'+url;
}
export function messageLink(platform,data,url,userAgent=''){
 const body=encodeURIComponent(messageFor(platform,data,url));
 if(platform==='email')return 'mailto:?subject='+encodeURIComponent((cleanNickname(data.nickname)||'My '+data.modelName)+' — Fostinis Guitars')+'&body='+body;
 if(platform==='text')return 'sms:'+(/iPhone|iPad|iPod/i.test(userAgent)?'&':'?')+'body='+body;
 throw Error('Choose text or email.');
}
export function nativePayload(platform,data,url,files){
 if(platform==='text'||platform==='email')return {title:cleanNickname(data.nickname)||data.modelName+' — Fostinis Guitars',text:messageFor(platform,data,url),files};
 // Some photo apps reject mixed text + files or ignore the caption. The concise
 // specifications and brand are already burned into every exported image.
 return {files};
}
export function canShareFiles(navigator,payload){try{return !!(navigator.share&&navigator.canShare&&payload.files?.length&&navigator.canShare({files:payload.files})&&navigator.canShare(payload));}catch{return false;}}
export function fileStem(data){return ('Fostinis_'+data.modelName+'_'+(cleanNickname(data.nickname)||'My_Build')).normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/_+/g,'_').slice(0,90);}

// Uncompressed ZIPs avoid automatic-multiple-download blocking. The JPEGs are
// already compressed, so a second compression pass would add memory and delay.
export async function photoZIP(files){
 const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 const local=[],central=[];let offset=0,centralSize=0;
 for(const file of files){
  const data=new Uint8Array(await file.arrayBuffer()),name=new TextEncoder().encode(file.name);let crc=0xffffffff;for(const byte of data)crc=crcTable[(crc^byte)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
  const header=new Uint8Array(30+name.length),h=new DataView(header.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(12,0x21,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);header.set(name,30);
  const directory=new Uint8Array(46+name.length),d=new DataView(directory.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x0800,true);d.setUint16(14,0x21,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);directory.set(name,46);
  local.push(header,data);central.push(directory);offset+=header.length+data.length;centralSize+=directory.length;
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
 return new Blob([...local,...central,end],{type:'application/zip'});
}

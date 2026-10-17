import fs from 'node:fs';

// Keep the existing native routes aligned with the October 16 owner changes.
const burl=" burl:{name:'Burl — may require resin filling',species:'Species not specified',grain:'real44-burl',natural:'#d6ae78',source:'Figure and color vary with each piece of wood'},\n";
let count=0;
for(const file of fs.readdirSync('public').filter(f=>f.endsWith('.html'))){
 const path='public/'+file,original=fs.readFileSync(path,'utf8');if(!original.includes('window.FostinisStudio='))continue;
 let html=original;
 const replace=(before,after)=>{if(html.includes(before))html=html.replace(before,after);else if(!html.includes(after))throw Error('Missing wood migration anchor in '+file+': '+before);};
 html=html.replaceAll('Reference-inspired motif','Cherub Wings');
 if(!html.includes(burl))replace('const WOODS={\n','const WOODS={\n'+burl);
 replace('backWood:Object.keys(WOODS),',"backWood:Object.keys(WOODS).filter(k=>k!=='burl'),");
 replace("fretboard:['ebony','rosewood']","fretboard:['ebony','rosewood','maple']");
 replace("fretboard:{name:'Fretboard appearance',values:[['ebony','Ebony'],['rosewood','Rosewood']]}","fretboard:{name:'Fretboard appearance',values:[['ebony','Ebony'],['rosewood','Rosewood'],['maple','Maple']]}");
 replace("function legacyPreview(id,state,options){return (state.pickupLayout||'hh')", "function legacyPreview(id,state,options){return state.wood!=='burl'&&(state.pickupLayout||'hh')");
 html=html.replaceAll('Your selected pickup layout and controls appear in the 3D showroom.','Your selections appear in the 3D showroom.');
 // Burl has a real 3D material, not one of the old pre-rendered finish JPEGs.
 replace('if(EMBEDDED){paintModel(id,undefined);',"if(EMBEDDED||s.wood==='burl'){paintModel(id,undefined);");
 replace('Each selected quilted maple option adds $400; flame maple adds $200. Body top, back and neck bursts each add $150.','Each selected quilted maple option adds $400; flame maple adds $200. Burl tops add $800 and may require resin filling. Body top, back and neck bursts each add $150.');
 if(html!==original)fs.writeFileSync(path,html);count++;
}
console.log('Synchronized Cherub Wings, maple fretboard and burl tops on '+count+' routes.');

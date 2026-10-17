import fs from 'node:fs';

const source=fs.readFileSync('src/builder-navigation.mjs','utf8').replace('export function createBuilderNavigation','function createBuilderNavigation');
fs.writeFileSync('public/builder-navigation.js','// Generated from src/builder-navigation.mjs.\n'+source+'\nwindow.FostinisBuilderNavigation=createBuilderNavigation;\n');
let count=0;
for(const file of fs.readdirSync('public').filter(f=>f.endsWith('.html'))){
 const path='public/'+file,original=fs.readFileSync(path,'utf8');if(!original.includes('window.FostinisStudio='))continue;
 let html=original;
 const replace=(before,after)=>{if(html.includes(after))return;if(html.includes(before))html=html.replace(before,after);else throw Error('Missing builder navigation anchor in '+file);};
 if(!html.includes('src="/builder-navigation.js'))html=html.replace('<script>','<script src="/builder-navigation.js?v=45"></script>\n<script>');
 else html=html.replace(/src="\/builder-navigation\.js[^\"]*"/,'src="/builder-navigation.js?v=45"');
 replace("const P=F.PARTS;", "const P=F.PARTS;\nconst builderNavigation=window.FostinisBuilderNavigation({builder:$('builder'),preview:$('live-preview'),header:document.querySelector('.topbar')});");
 replace("section.addEventListener('toggle',()=>{if(section.open&&step!==group)selectStep(group);});", "summary.addEventListener('click',event=>{if(section.open)return;event.preventDefault();selectStep(group,{scroll:true});});\n  section.addEventListener('toggle',()=>{if(section.open&&step!==group)selectStep(group,{scroll:true});});");
 replace("if(scroll){const section=$('group-'+group);try{section?.scrollIntoView?.({block:'start',behavior:'auto'});}catch(error){}}", "if(scroll)builderNavigation.reveal($('group-'+group));");
 replace('function initialize(){\n', 'function initialize(){\n builderNavigation.observe();\n');
 if(html!==original)fs.writeFileSync(path,html);count++;
}
console.log('Synchronized category navigation on '+count+' routes.');

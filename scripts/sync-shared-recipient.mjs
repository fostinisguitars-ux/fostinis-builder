import fs from 'node:fs';

// Apply the recipient journey consistently to every standalone entry route.
const marker='// Shared recipients keep an independent working copy, revision 54.';
let count=0;
for(const file of fs.readdirSync('public').filter(name=>name.endsWith('.html'))){
 const path='public/'+file;let html=fs.readFileSync(path,'utf8');
 if(!html.includes('window.FostinisStudio=')||html.includes(marker))continue;
 const replace=(from,to)=>{if(!html.includes(from))throw Error('Missing recipient insertion in '+file+': '+from.slice(0,80));html=html.replace(from,to);};
 replace('function label(key,state=builds[selected]){',`${marker}
function continueSharedBuild(action){if(!['customize','order','rename'].includes(action))return;if(sharedBuildActive)saveSharedBuild();updateInquiry();if(action==='customize')go('showroom',{target:'builder'});else if(action==='order')go('review',{target:'build-checkout'});else{go('review',{focus:false});const field=$('guitar-nickname');field.scrollIntoView({block:'center'});field.focus({preventScroll:true});field.select();}}
function label(key,state=builds[selected]){`);
 replace('sharedBuildError,getSnapshot:', 'sharedBuildError,continueSharedBuild,saveSharedBuild,getSnapshot:');
 replace('<p id="shared-build-message">You’re viewing a shared guitar. Your saved builds are unchanged.</p><button type="button" id="save-shared-build">Save as my build</button>', '<p id="shared-build-message">This is the exact shared guitar and nickname. Keep it as shown or customize your own copy. Your changes won’t change your friend’s build.</p><div id="shared-build-actions"><button type="button" class="primary" data-shared-action="customize">Customize my version</button><button type="button" data-shared-action="order">Order this build</button><button type="button" data-shared-action="rename">Change nickname</button><button type="button" id="save-shared-build">Save as my build</button></div>');
 replace('<section class="build-commerce"', '<section id="build-checkout" class="build-commerce"');
 replace('<h3>Your build price.</h3>', '<h3>Your build price.</h3><p class="note" id="checkout-nickname" hidden></p>');
 replace('Up to 40 characters. Appears on your build and shared photos.', 'Up to 40 characters. Appears on your build, shared photos and order.');
 replace("window.FostinisCommerce?.update({model:selected,selections:s,notes:notes[selected]||''});", "window.FostinisCommerce?.update({model:selected,selections:s,notes:notes[selected]||'',nickname:nicknames[selected]||''});");
 replace("$('guitar-name').textContent=nicknames[selected]||'Made personal.';persist();", "$('guitar-name').textContent=nicknames[selected]||'Made personal.';window.FostinisCommerce?.setNickname(nicknames[selected]);persist();");
 replace("$('guitar-nickname').onblur=renderNickname;", "$('guitar-nickname').onblur=()=>{renderNickname();updateInquiry();};");
 replace("'Model: '+name,...Object.keys(SCHEMA)", "...(nicknames[selected]?['Guitar nickname: '+nicknames[selected]]:[]),'Model: '+name,...Object.keys(SCHEMA)");
 replace('function render(){\n if(!current)return;', `function renderNickname(){const node=document.getElementById('checkout-nickname');if(node){node.hidden=!current?.nickname;node.textContent=current?.nickname?'Guitar nickname: '+current.nickname:'';}}
function render(){
 if(!current)return;renderNickname();`);
 replace("'Please confirm delivery, tax and payment arrangements for my build.',...q.lines", "'Please confirm delivery, tax and payment arrangements for my build.',...(current.nickname?['Guitar nickname: '+current.nickname]:[]),...q.lines");
 replace('try{const payload={model:current.model,selections:current.selections,notes:current.notes};', "try{if(window.FostinisStudio?.isSharedBuild?.())window.FostinisStudio.saveSharedBuild();const payload={model:current.model,selections:current.selections,notes:current.notes,nickname:current.nickname||''};");
 replace('window.FostinisCommerce={update(data){current=JSON.parse(JSON.stringify(data));render();},lastQuote:null};', "window.FostinisCommerce={update(data){current=JSON.parse(JSON.stringify(data));current.nickname=window.FostinisSharing?.cleanNickname(current.nickname)||'';render();},setNickname(value){if(current){current.nickname=window.FostinisSharing?.cleanNickname(value)||'';renderNickname();}},lastQuote:null};");
 fs.writeFileSync(path,html);count++;
}
console.log('Connected shared recipient actions and order nicknames on '+count+' routes');

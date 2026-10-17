import fs from 'node:fs';

// These native routes retain the same configurator script. Keep only the review
// bridge in sync; the showroom model, choices, pricing, and layout stay intact.
let count=0;
for(const file of fs.readdirSync('public').filter(name=>name.endsWith('.html'))){
 const path='public/'+file;let html=fs.readFileSync(path,'utf8');
 if(!html.includes('window.FostinisStudio='))continue;
 if(!html.includes('review:{side:view,focus:')){
  html=html.replace("side:previewSide,focus:previewFocus,page}),selectModel:","side:previewSide,focus:previewFocus,page,review:{side:view,focus:$('detail').getAttribute('aria-pressed')==='true'?'body':'full'}}),selectModel:");
  const start=html.indexOf('function renderReview(){'),end=html.indexOf("$('view-note').textContent=",start);
  if(start<0||end<0)throw Error('Review renderer missing in '+file);
  html=html.slice(0,start)+`function renderReview(){const s=builds[selected];if(view==='original'){$('review-image').innerHTML=R.svg(selected,s,{original:true,focus:$('detail').getAttribute('aria-pressed')==='true'?'body':'full'});$('review-image').removeAttribute('aria-busy');}else if(!window.FostinisShowroom?.ready){$('review-image').textContent='Your completed guitar will appear here when the 3D showroom is ready.';}queueMicrotask(notifyVirtualShowroom);`+html.slice(end);
  html=html.replace('Completed rear preview. Back and neck use their own wood, color and sheen; the selected tuner hardware is shown.','Completed rear preview from your showroom guitar, with the same back, neck, finish and hardware.');
  html=html.replace('Assembled front preview. Surface colors, grain and installed appointments reflect this model’s current selections.','Completed front preview from your showroom guitar, with the same colors, wood grain, finish and hardware.');
  const exportStart=html.indexOf('async function exportPreview(){'),exportEnd=html.indexOf('function exportBuild(){',exportStart);
  if(exportStart<0||exportEnd<0)throw Error('Preview export missing in '+file);
  html=html.slice(0,exportStart)+`async function exportPreview(){
 const button=$('export-image'),id=selected,side=view==='back'?'back':'front';button.disabled=true;button.textContent='Preparing preview…';
 try{if(!window.FostinisShowroom?.ready)throw Error('Your showroom guitar is still loading. Please try again in a moment.');
  const png=await window.FostinisShowroom.exportPreview();
  download(png,'image/png','Fostinis_'+F.MODELS[id].name+'_'+(side==='back'?'Back':'Front')+'_Preview.png');
  toast('Preview ready. Use the download link below if it does not open.');
 }catch(error){toast(error.message||'The showroom preview could not be prepared. Please try again.');}
 finally{button.disabled=false;button.textContent='Save preview';}
}
`+html.slice(exportEnd);
 }
 html=html.replace(/<div id="review-image"><img[^>]+><\/div>/,'<div id="review-image"><p class="completed-preview-status" role="status">Your completed guitar will appear here when the 3D showroom is ready.</p></div>');
 if(!html.includes('window.FostinisShowroom.exportPreview()'))throw Error('Missing showroom image export in '+file);
 fs.writeFileSync(path,html);count++;
}
console.log('Connected completed showroom previews on '+count+' routes');

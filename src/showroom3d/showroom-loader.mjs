// Pages share one continuous layout. Download and start WebGL only when a
// visitor approaches a 3D view or explicitly opens the build/sharing controls.
let loading=false,observer;
function load(){
 if(loading)return;loading=true;observer?.disconnect();
 import('./showroom-360.js?v=66').catch(error=>{
  loading=false;console.error('Showroom module unavailable',error);
  const status=document.getElementById('preview-status');
  if(status)status.textContent='The 3D view could not load. Your build options are still available; reopen the showroom to retry.';
 });
}
if('IntersectionObserver' in window){
 observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))load();},{rootMargin:'250px'});
 for(const selector of ['.gallery','#live-preview-image','#parts-preview-image','#review-image']){const element=document.querySelector(selector);if(element)observer.observe(element);}
}else load();
window.addEventListener('fostinis:navigate',event=>{if(['showroom','parts','review'].includes(event.detail.page))load();});
for(const id of ['share-build','export-image'])document.getElementById(id)?.addEventListener('click',load,{capture:true});

window.addEventListener('fostinis:playroom-open',load);

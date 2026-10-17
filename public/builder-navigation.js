// Generated from src/builder-navigation.mjs.
// Keep category headings and their first controls below the actual live preview.
// Desktop scrolls inside the builder; mobile scrolls the whole document.
function createBuilderNavigation({builder,preview,header,win=window}){
 let frame=0,observer;
 const gap=12,controlSpace=180;
 function measure(){
  const nested=/(auto|scroll)/.test(win.getComputedStyle(builder).overflowY);
  const headerStyle=header&&win.getComputedStyle(header);
  const headerHeight=headerStyle&&/^(sticky|fixed)$/.test(headerStyle.position)?header.getBoundingClientRect().height:0;
  const viewportHeight=Math.min(win.innerHeight,win.visualViewport?.height||win.innerHeight);
  const previewHeight=preview.getBoundingClientRect().height;
  const available=nested?Math.min(builder.clientHeight,viewportHeight-headerHeight-gap):viewportHeight-headerHeight-gap;
  // On short screens a pinned preview would leave no room for a dropdown.
  const pinned=previewHeight+controlSpace<=available;
  const top=nested?0:headerHeight+gap;
  preview.style.position=pinned?'sticky':'relative';
  preview.style.top=pinned?top+'px':'auto';
  const offset=(pinned?top+previewHeight:(nested?0:headerHeight))+gap;
  for(const section of builder.querySelectorAll('.option-group'))section.style.scrollMarginTop=offset+'px';
  return {nested,headerHeight,offset};
 }
 function reveal(section){
  if(!section)return;
  if(frame)win.cancelAnimationFrame(frame);
  // Wait until closing the previous accordion has updated the layout.
  frame=win.requestAnimationFrame(()=>{
   frame=0;if(!section.open)return;
   const {nested,headerHeight,offset}=measure();
   if(nested){
    const panelTop=builder.getBoundingClientRect().top;
    win.scrollTo({top:Math.max(0,win.scrollY+panelTop-headerHeight-gap),behavior:'instant'});
    const top=builder.scrollTop+section.getBoundingClientRect().top-builder.getBoundingClientRect().top-builder.clientTop-offset;
    builder.scrollTo({top:Math.max(0,top),behavior:'instant'});
   }else{
    const top=win.scrollY+section.getBoundingClientRect().top-offset;
    win.scrollTo({top:Math.max(0,top),behavior:'instant'});
   }
  });
 }
 function observe(){
  measure();
  win.addEventListener('resize',measure,{passive:true});
  win.visualViewport?.addEventListener('resize',measure,{passive:true});
  if(win.ResizeObserver){observer=new win.ResizeObserver(measure);observer.observe(preview);if(header)observer.observe(header);}
 }
 return {reveal,observe};
}

window.FostinisBuilderNavigation=createBuilderNavigation;

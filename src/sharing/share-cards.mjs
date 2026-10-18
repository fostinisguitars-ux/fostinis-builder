import {socialSummary,VIEWS,fileStem,cleanNickname} from './share-core.mjs';
export const CARD_SIZES={portrait:[1080,1350],story:[1080,1920]};
export function wrapText(ctx,text,maxWidth){
 const lines=[];
 for(const paragraph of String(text).split('\n')){let line='';for(const word of paragraph.split(/\s+/)){if(!word)continue;if(ctx.measureText((line?line+' ':'')+word).width<=maxWidth){line+=(line?' ':'')+word;continue;}if(line){lines.push(line);line='';}for(const char of word){if(ctx.measureText(line+char).width>maxWidth&&line){lines.push(line);line='';}line+=char;}}if(line)lines.push(line);}
 return lines;
}
export function drawShareCard(ctx,image,data,side,format='portrait'){
 const [w,h]=CARD_SIZES[format]||CARD_SIZES.portrait,story=format==='story',top=story?170:64,bodyTop=top+210,bottom=story?h-265:h-92;
 ctx.fillStyle='#1c1e22';ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#c9af78';ctx.fillRect(64,top,56,3);
 ctx.font='600 38px Georgia, serif';ctx.fillText('Fostinis Guitars',64,top+56);
 const title=cleanNickname(data.nickname)||'My '+data.modelName;
 let titleSize=46,titleLines=[];do{ctx.font='500 '+titleSize+'px Georgia, serif';titleLines=wrapText(ctx,title,940);if(titleLines.length<=2)break;titleSize-=2;}while(titleSize>30);
 ctx.fillStyle='#faf6ed';titleLines.forEach((line,i)=>ctx.fillText(line,64,top+116+i*(titleSize+8)));
 ctx.font='500 22px Arial, sans-serif';ctx.fillStyle='#b3b5bc';ctx.fillText(data.modelName.toUpperCase()+'  /  '+VIEWS.find(view=>view.side===side).label.toUpperCase(),64,top+187);
 const imageBox={x:30,y:bodyTop,w:620,h:bottom-bodyTop};
 const scale=Math.min(imageBox.w/image.width,imageBox.h/image.height),iw=image.width*scale,ih=image.height*scale;
 ctx.drawImage(image,imageBox.x+(imageBox.w-iw)/2,imageBox.y+(imageBox.h-ih)/2,iw,ih);
 const sections=socialSummary(data),x=680,width=330,available=bottom-bodyTop-40;
 let fontSize=27,measured;
 do{ctx.font=fontSize+'px Arial, sans-serif';measured=sections.map(section=>({...section,lines:wrapText(ctx,section.value,width)}));const height=measured.reduce((n,section)=>n+38+section.lines.length*(fontSize+9)+30,0);if(height<=available)break;fontSize--;}while(fontSize>19);
 const total=measured.reduce((n,section)=>n+38+section.lines.length*(fontSize+9)+30,0);let y=bodyTop+Math.max(30,(available-total)/2);
 for(const section of measured){ctx.font='600 18px Arial, sans-serif';ctx.fillStyle='#c9af78';ctx.fillText(section.label,x,y);y+=34;ctx.font=fontSize+'px Arial, sans-serif';ctx.fillStyle='#eeeae2';for(const line of section.lines){ctx.fillText(line,x,y);y+=fontSize+9;}y+=34;}
 ctx.strokeStyle='#49463f';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(64,bottom+10);ctx.lineTo(w-64,bottom+10);ctx.stroke();
 ctx.font='21px Arial, sans-serif';ctx.fillStyle='#b3b5bc';ctx.fillText('fostinisguitars.com',64,bottom+46);ctx.textAlign='right';ctx.fillText('YOUR BUILD. YOUR VOICE.',w-64,bottom+46);ctx.textAlign='left';
 return {width:w,height:h,summaryBottom:y,footerTop:bottom+10};
}
async function loadImage(url){const image=new Image();image.src=url;await image.decode();return image;}
export async function makeShareCards(views,data,format){
 const cards=[];
 for(const view of views){
  const image=await loadImage(view.url),canvas=document.createElement('canvas');[canvas.width,canvas.height]=CARD_SIZES[format];const ctx=canvas.getContext('2d');if(!ctx)throw Error('Photo export is unavailable on this device. You can still share the build link.');
  drawShareCard(ctx,image,data,view.side,format);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('The photo could not be saved. Try preparing it again.')),'image/jpeg',.94));
  cards.push({side:view.side,label:VIEWS.find(v=>v.side===view.side).label,file:new File([blob],fileStem(data)+'_'+view.side+'_'+format+'.jpg',{type:'image/jpeg'})});canvas.width=canvas.height=1;
 }
 return cards;
}

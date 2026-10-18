// Only redraw while notes are ringing. The base image is the customer's actual
// configured showroom guitar; the overlay illustrates the audible performance.
export function createPerformanceView(host,{request=requestAnimationFrame,cancel=cancelAnimationFrame,now=()=>performance.now(),reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches}={}){
 let frame,canvas,ctx,raf=null,notes=new Map();
 function draw(time){
  raf=null;if(!frame||!ctx)return;
  ctx.clearRect(0,0,frame.width,frame.height);ctx.drawImage(frame.canvas,0,0);
  let last;
  for(const [string,note]of notes){
   const age=time-note.start;if(age>note.life){notes.delete(string);continue;}
   const anchors=frame.strings[string],start=anchors.bridge,end=anchors.frets[note.fret],finger=anchors.fingers[note.fret];
   const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy)||1;
   const fade=Math.exp(-age/520),amplitude=reduced()?0:4.5*fade;
   ctx.save();ctx.strokeStyle=`rgba(255,217,151,${.18+.8*fade})`;ctx.lineWidth=1.7;ctx.shadowColor='#efbd70';ctx.shadowBlur=6*fade;ctx.beginPath();
   for(let i=0;i<=48;i++){const t=i/48,wave=Math.sin(t*Math.PI)*Math.sin(t*Math.PI*6+age*.065)*amplitude,x=start.x+dx*t-dy/length*wave,y=start.y+dy*t+dx/length*wave;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
   ctx.stroke();ctx.shadowBlur=0;
   ctx.globalAlpha=Math.min(1,fade*2);ctx.fillStyle='#edc98e';ctx.beginPath();ctx.arc(finger.x,finger.y,note.fret?8:6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#372e22';ctx.lineWidth=2;ctx.stroke();
   if(note.fret){ctx.fillStyle='#211d18';ctx.font='600 9px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(note.fret),finger.x,finger.y+.5);}
   ctx.restore();if(!last||note.start>last.start)last={...note,pick:anchors.pick};
  }
  if(last&&time-last.start<210){
   const age=time-last.start,movement=reduced()?0:Math.sin(age/210*Math.PI)*17;
   ctx.save();ctx.translate(last.pick.x,last.pick.y-10+movement);ctx.rotate(-.35);ctx.globalAlpha=1-age/260;
   ctx.fillStyle='#d6b482';ctx.strokeStyle='#f6deb8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-11,-11);ctx.quadraticCurveTo(0,-17,11,-11);ctx.quadraticCurveTo(16,-4,0,17);ctx.quadraticCurveTo(-16,-4,-11,-11);ctx.fill();ctx.stroke();ctx.restore();
  }
  host.dataset.playing=String(notes.size>0);if(notes.size)raf=request(draw);
 }
 function stop(){if(raf!==null)cancel(raf);raf=null;notes.clear();host.dataset.playing='false';if(frame&&ctx)draw(now());}
 return {
  setFrame(next){stop();frame=next;canvas=document.createElement('canvas');canvas.width=next.width;canvas.height=next.height;canvas.setAttribute('aria-hidden','true');ctx=canvas.getContext('2d');host.replaceChildren(canvas);draw(now());},
  note({string,fret,duration=1.6}){if(!frame||!Number.isInteger(string)||string<0||string>5||!Number.isInteger(fret)||fret<0||fret>24)return;notes.set(string,{fret,start:now(),life:Math.min(2200,Math.max(180,duration*1000))});if(raf===null)raf=request(draw);},
  stop,
  clear(){stop();frame=null;ctx=null;canvas=null;host.replaceChildren();},
  get active(){return notes.size>0;}
 };
}

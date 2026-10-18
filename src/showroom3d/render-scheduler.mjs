// Keep each canvas asleep until its own contents change. Camera damping can
// request another frame without redrawing the other, stationary canvas.
export function createRenderScheduler({request,cancel,hidden,update,renderRoom,renderDetail}){
 const visible={room:false,detail:false},dirty={room:true,detail:true};
 let frame=0,drawing=false,stopped=false;
 function wake(){if(!stopped&&!drawing&&!frame&&!hidden()&&(visible.room||visible.detail))frame=request(draw);}
 function invalidate(view='both'){if(view==='both'){dirty.room=true;dirty.detail=true;}else dirty[view]=true;wake();}
 function draw(now){
  frame=0;if(stopped||hidden()||(!visible.room&&!visible.detail))return;
  drawing=true;
  try{
   const moving=update(now,visible);
   if(visible.room&&dirty.room){dirty.room=false;renderRoom();}
   if(visible.detail&&dirty.detail){dirty.detail=false;renderDetail();}
   drawing=false;
   if(moving||(visible.room&&dirty.room)||(visible.detail&&dirty.detail))wake();
  }finally{drawing=false;}
 }
 function pause(){if(frame)cancel(frame);frame=0;}
 function setVisible(view,value){if(visible[view]===value)return;visible[view]=value;if(value)invalidate(view);else if(!visible.room&&!visible.detail)pause();}
 return {invalidate,setVisible,wake,pause,stop(){stopped=true;pause();}};
}

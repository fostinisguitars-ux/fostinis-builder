import * as T from 'three';
import {completedCamera,renderGuitarView} from './assembled-preview.mjs';
import {NECK,NUT_Y,SADDLE_Y} from './geometry.mjs';

// Audio string 0 is high E; CAD string 0 is the thick, low E string.
export function playingStringPoint(string,fret=0,betweenFrets=false){
 const index=5-string;
 const distance=fret===0?0:NECK.scale*(1-2**(-fret/12));
 const previous=fret>0?NECK.scale*(1-2**(-(fret-1)/12)):0;
 const d=betweenFrets?(distance+previous)/2:distance,t=d/NECK.scale;
 return new T.Vector3((index-2.5)*(7.1+3.5*t),NUT_Y-d,10.5+1.5*t);
}

export function playingAnchors(rec,camera,width,height){
 const project=point=>{const p=rec.group.localToWorld(point).project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};};
 return Array.from({length:6},(_,string)=>{
  const bridge=new T.Vector3((2.5-string)*10.6,SADDLE_Y,12);
  return {bridge:project(bridge.clone()),nut:project(playingStringPoint(string)),
   pick:project(bridge.clone().lerp(playingStringPoint(string),.16)),
   frets:Array.from({length:25},(_,fret)=>project(playingStringPoint(string,fret))),
   fingers:Array.from({length:25},(_,fret)=>project(playingStringPoint(string,fret,true)))};
 });
}

// Reuse the detail renderer once per build. Animation runs on a lightweight 2D
// canvas, with anchors projected from this exact camera and guitar geometry.
// No third WebGL context and no changes to the configured guitar's materials.
export function capturePlayingGuitar(context,{width=1600,height=500}={}){
 const {renderer,models,selected,afterCapture}=context,rec=models.get(selected);
 if(!rec?.body)throw Error('Your guitar is still loading.');
 const camera=completedCamera(rec,{side:'front',focus:'full',aspect:width/height});
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const draw=canvas.getContext('2d');if(!draw)throw Error('The playing view is unavailable.');
 const size=renderer.getSize(new T.Vector2()),ratio=renderer.getPixelRatio();
 try{
  renderer.setPixelRatio(1);renderer.setSize(width,height,false);
  renderGuitarView(context,()=>{renderer.render(context.scene,camera);draw.drawImage(renderer.domElement,0,0);});
  return {canvas,width,height,strings:playingAnchors(rec,camera,width,height)};
 }finally{renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);afterCapture?.();}
}

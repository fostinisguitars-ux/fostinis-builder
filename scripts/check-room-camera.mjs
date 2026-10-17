import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createRoomControls,fitRoomCamera,rotateRoomCamera} from '../src/showroom3d/room-camera.mjs';

class Surface{
 constructor(){this.listeners=new Map();this.style={};this.documentElement={clientLeft:0,clientTop:0};this.ownerDocument=this;}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 getRootNode(){return this;}setPointerCapture(){}releasePointerCapture(){}
 getBoundingClientRect(){return {left:0,top:0,width:600,height:400};}
 emit(type,props){for(const fn of this.listeners.get(type)||[])fn({preventDefault(){},type,...props});}
}
function fixture(){const win=new Surface();win.pageXOffset=win.pageYOffset=0;globalThis.window=win;const surface=new Surface(),camera=new T.PerspectiveCamera(37,1.5,.015,25);camera.position.set(0,.72,2.5);const controls=createRoomControls(camera,surface);controls.target.set(0,.72,0);controls.update();return {camera,controls,surface};}
const pointer=(x,y,extra={})=>({pointerId:1,pointerType:'mouse',button:0,pageX:x,pageY:y,...extra});

test('Mouse and touch gestures rotate continuously through both poles, without losing the requested distance',()=>{
 for(const pointerType of ['mouse','touch']){
  const {camera,controls,surface}=fixture(),target=controls.target,renderCamera=camera.clone();let below=false,above=false,inverted=false,angle=0;let last=camera.position.clone().sub(target).normalize();
  surface.emit('pointerdown',pointer(300,200,{pointerType}));
  for(let i=1;i<=90;i++){
   surface.emit('pointermove',pointer(300,200+i*20,{pointerType}));controls.update();const desired=camera.position.clone().sub(target).normalize();angle+=last.angleTo(desired);last=desired;below||=desired.y<-.99;above||=desired.y>.99;inverted||=camera.up.y<-.99;
   fitRoomCamera(renderCamera,camera,target);const actual=renderCamera.position.clone().sub(target).normalize();assert(actual.dot(desired)>1-1e-10,'Room fit changed the angle');assert(Math.abs(camera.position.distanceTo(target)-2.5)<1e-9,'Orbit distance was lost near a surface');assert(renderCamera.position.y>0&&renderCamera.position.y<3.3);
  }
  surface.emit('pointerup',pointer(300,200+90*20,{pointerType}));assert(above&&below&&inverted);assert(angle>Math.PI*2,'A full vertical revolution was blocked');controls.dispose();
 }
});

test('Mouse right-drag and two-finger touch pan the viewpoint; pinch and wheel still zoom',()=>{
 const {camera,controls,surface}=fixture();const before=controls.target.clone();
 surface.emit('pointerdown',pointer(200,200,{button:2}));surface.emit('pointermove',pointer(240,250,{button:2}));controls.update();surface.emit('pointerup',pointer(240,250,{button:2}));assert(controls.target.distanceTo(before)>.1);
 const touch=(id,x,y)=>pointer(x,y,{pointerId:id,pointerType:'touch'}),panStart=controls.target.clone();
 surface.emit('pointerdown',touch(1,200,200));surface.emit('pointerdown',touch(2,300,200));surface.emit('pointermove',touch(1,240,260));surface.emit('pointermove',touch(2,340,260));controls.update();assert(controls.target.distanceTo(panStart)>.1);
 const distance=camera.position.distanceTo(controls.target);surface.emit('pointermove',touch(1,210,260));surface.emit('pointermove',touch(2,370,260));controls.update();assert(camera.position.distanceTo(controls.target)<distance);
 surface.emit('pointerup',touch(1,210,260));surface.emit('pointerup',touch(2,370,260));const zoomed=camera.position.distanceTo(controls.target);surface.emit('wheel',{deltaY:200,deltaMode:0});controls.update();assert(camera.position.distanceTo(controls.target)>zoomed);controls.dispose();
});

test('Keyboard rotation passes above, below and through inverted views and returns after one revolution',()=>{
 const {camera,controls}=fixture(),target=controls.target,start=camera.position.clone();let low=false,high=false;
 for(let i=0;i<63;i++){rotateRoomCamera(camera,target,'ArrowDown');low||=camera.position.y<target.y-2.4;high||=camera.position.y>target.y+2.4;}
 assert(low&&high);assert(camera.position.distanceTo(start)<.05);assert(Math.abs(camera.up.length()-1)<1e-12);controls.dispose();
});

import * as T from 'three';
import {TrackballControls} from 'three/addons/controls/TrackballControls.js';
import {ROOM} from './room.mjs';

export function createRoomControls(camera,element){
 const controls=new TrackballControls(camera,element);
 controls.rotateSpeed=1.6;controls.zoomSpeed=1.1;controls.panSpeed=.65;
 controls.staticMoving=true;controls.multiTouchRoll=true;
 controls.minDistance=camera.near*2;controls.maxDistance=Infinity;
 // Do not intercept letter shortcuts while the customer edits the configurator.
 controls.keys=[];
 return controls;
}

// Keep the requested orbit separate from the rendered camera. Close to a room
// surface, dolly along the same viewing ray instead of limiting its angle. The
// requested distance is recovered automatically when rotating away again.
export function fitRoomCamera(camera,orbitCamera,target){
 const clearance=Math.max(.025,camera.near*1.5),targetClearance=clearance+.035;
 const min=new T.Vector3(-ROOM.width/2+clearance,clearance,-ROOM.depth/2+clearance),max=new T.Vector3(ROOM.width/2-clearance,ROOM.height-clearance,ROOM.depth/2-clearance);
 const innerMin=min.clone().addScalar(targetClearance-clearance),innerMax=max.clone().addScalar(clearance-targetClearance);
 const shift=target.clone().clamp(innerMin,innerMax).sub(target);target.add(shift);orbitCamera.position.add(shift);
 const offset=orbitCamera.position.clone().sub(target);let fraction=1;
 for(const axis of ['x','y','z'])if(Math.abs(offset[axis])>1e-12)fraction=Math.min(fraction,((offset[axis]>0?max:min)[axis]-target[axis])/offset[axis]);
 camera.position.copy(target).addScaledVector(offset,Math.max(0,fraction));camera.up.copy(orbitCamera.up);camera.lookAt(target);camera.updateMatrixWorld();
}

export function rotateRoomCamera(camera,target,key){
 const offset=camera.position.clone().sub(target),vertical=key==='ArrowUp'||key==='ArrowDown';
 const axis=vertical?camera.up.clone().cross(offset).normalize():camera.up.clone().normalize();
 const angle={ArrowLeft:.12,ArrowRight:-.12,ArrowUp:-.1,ArrowDown:.1}[key];if(angle===undefined)return;
 const rotation=new T.Quaternion().setFromAxisAngle(axis,angle);
 camera.position.copy(target).add(offset.applyQuaternion(rotation));camera.up.applyQuaternion(rotation).normalize();camera.lookAt(target);
}

export function roomInspectionView(which,modelX=0,{selected=false,aspect=1.5}={}){
 const distance=Math.max(selected?.55:1.6,(selected?.4:1.55)/(2*Math.tan(37*Math.PI/360)*aspect));
 return which==='ceiling'?{position:new T.Vector3(0,1.2,1.3),target:new T.Vector3(0,3.2,0)}
  :{position:new T.Vector3(modelX,.055,distance),target:new T.Vector3(modelX,selected?.32:.6,0)};
}

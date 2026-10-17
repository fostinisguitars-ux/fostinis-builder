import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {makeRoom,ROOM} from '../src/showroom3d/room.mjs';
import {fitRoomCamera,roomInspectionView} from '../src/showroom3d/room-camera.mjs';

// Validate the real scene graph without a browser/WebGL context.
const originalLoad=T.TextureLoader.prototype.load;
const assets=new Set();
T.TextureLoader.prototype.load=function(url){assert(fs.existsSync('public'+url),'Missing room asset: '+url);assets.add(url);return new T.Texture();};
const room=new T.Group();makeRoom(room);room.updateMatrixWorld(true);
T.TextureLoader.prototype.load=originalLoad;
let meshes=0,triangles=0,shadowLights=0;
room.traverse(object=>{
 if(object.isLight&&object.castShadow)shadowLights++;
 if(!object.isMesh)return;
 meshes++;triangles+=(object.geometry.index?.count||object.geometry.attributes.position.count)/3*(object.isInstancedMesh?object.count:1);
 for(const value of object.geometry.attributes.position.array)assert(Number.isFinite(value));
});
assert(meshes<80,'Room batching regressed');assert(triangles<150000,'Room detail exceeds mobile budget');assert.equal(shadowLights,1);
assert(assets.has('/assets/room.jpg'),'Original workshop must be retained');
const camera=new T.PerspectiveCamera(37,1,.015,25),orbitCamera=camera.clone(),ray=new T.Raycaster();let views=0;
// Every model stays unobstructed from both sides and every intermediate azimuth,
// including low and high views. Furniture remains in its original perimeter.
for(const x of [-.52,0,.52])for(let degrees=0;degrees<360;degrees+=15)for(const y of [-1,.85,1.8,5]){
 const target=new T.Vector3(x,.72,0),a=degrees*Math.PI/180;
 orbitCamera.position.set(x+Math.sin(a)*3.2,y,Math.cos(a)*3.2);fitRoomCamera(camera,orbitCamera,target);
 const direction=target.clone().sub(camera.position);ray.set(camera.position,direction.clone().normalize());ray.near=0;ray.far=direction.length();
 assert.equal(ray.intersectObject(room,true).length,0,'Furniture blocks a guitar or intersects the camera at '+degrees+'°');
 assert(camera.position.y>0&&camera.position.y<ROOM.height,'Camera crossed floor or ceiling');views++;
}
// Dedicated inspection views expose the underside and the real ceiling.
const under=roomInspectionView('under');orbitCamera.position.copy(under.position);fitRoomCamera(camera,orbitCamera,under.target);assert(camera.position.y<.1);assert(camera.getWorldDirection(new T.Vector3()).y>.3);
const ceiling=roomInspectionView('ceiling');orbitCamera.position.copy(ceiling.position);fitRoomCamera(camera,orbitCamera,ceiling.target);ray.set(camera.position,camera.getWorldDirection(new T.Vector3()));ray.far=10;assert(ray.intersectObject(room,true).some(hit=>hit.object.material.name==='Dark plaster ceiling'),'Ceiling view misses the ceiling');
// Actual perimeter objects are present in opposite directions from the display.
const workshop=room.getObjectByName('Luthier workshop'),lounge=room.getObjectByName('Listening lounge'),door=room.getObjectByName('Entrance door');
assert(new T.Box3().setFromObject(workshop).max.z< -4);
assert(new T.Box3().setFromObject(lounge).min.z>3.5);
assert(new T.Box3().setFromObject(door).min.z>5);
console.log(`PASS: ${views} unobstructed views, original workshop, opposite lounge and entrance, ${meshes} room draw calls, ${triangles} triangles, all local assets.`);

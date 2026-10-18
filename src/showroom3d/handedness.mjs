// Reflect the instrument, but rotate its lettering 180 degrees on the headstock
// face instead of mirroring it. In the left-handed horizontal view the signature
// then reads upright, from left to right.
export function applyHandedness(rec,state){
 const direction=state.handedness==='left'?-1:1;
 rec.group.scale.x=Math.abs(rec.group.scale.x)*direction;
 if(rec.signature)rec.signature.scale.x=direction;
 if(rec.logo)rec.logo.rotation.z=Math.PI/2+(direction<0?Math.PI:0);
 rec.group.updateWorldMatrix(true,true);
}

export function horizontalCameraUp(state){return state?.handedness==='left'?1:-1;}

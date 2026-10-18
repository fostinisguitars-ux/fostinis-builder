// Reflect the complete instrument across its string axis. The room and stand
// are separate objects; the signature counter-reflection keeps its lettering.
export function applyHandedness(rec,state){
 const direction=state.handedness==='left'?-1:1;
 rec.group.scale.x=Math.abs(rec.group.scale.x)*direction;
 if(rec.signature)rec.signature.scale.x=direction;
 rec.group.updateWorldMatrix(true,true);
}

export function horizontalCameraUp(state){return state?.handedness==='left'?1:-1;}

// Reflect the complete instrument, including its headstock logo, across the
// string axis. The room and stand remain separate objects.
export function applyHandedness(rec,state){
 const direction=state.handedness==='left'?-1:1;
 rec.group.scale.x=Math.abs(rec.group.scale.x)*direction;
 if(rec.signature)rec.signature.scale.x=1;
 rec.group.updateWorldMatrix(true,true);
}

export function horizontalCameraUp(state){return state?.handedness==='left'?1:-1;}

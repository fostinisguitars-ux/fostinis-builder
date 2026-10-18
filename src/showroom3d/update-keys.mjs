// Finish edits change materials, never the physical hardware. Include every
// remaining choice in the hardware key so future appointments stay safe.
export const FINISH_FIELDS=['wood','finish','finishType','burst','burstWidth','sheen','backWood','backFinish','backFinishType','backBurst','backSheen','neckWood','neckFinish','neckFinishType','neckBurst','neckSheen','headstockBurst'];
const finishFields=new Set(FINISH_FIELDS);
export function hardwareKey(state){return JSON.stringify(Object.keys(state).filter(key=>!finishFields.has(key)).sort().map(key=>[key,state[key]]));}
export function finishKey(state){return JSON.stringify(FINISH_FIELDS.map(key=>state[key]));}

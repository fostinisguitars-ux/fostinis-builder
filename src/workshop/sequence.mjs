// Time is supplied by the visible renderer, never by a background timer.
export const STAGE_SECONDS=[4,10,7,9,12,19];
export const TOTAL_SECONDS=STAGE_SECONDS.reduce((a,b)=>a+b,0);
export const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,Number(n)||0));
export const ease=n=>{const t=clamp(n);return t*t*(3-2*t);};
export const span=(p,start,end)=>ease((p-start)/(end-start));
export function stageStart(stage){return STAGE_SECONDS.slice(0,clamp(Math.trunc(stage),0,5)).reduce((a,b)=>a+b,0);}
export function frameAt(seconds){
 const time=clamp(seconds,0,TOTAL_SECONDS);let start=0;
 for(let stage=0;stage<6;stage++){
  const duration=STAGE_SECONDS[stage];
  if(time<start+duration||stage===5)return {stage,progress:clamp((time-start)/duration),time,overall:time/TOTAL_SECONDS,complete:time===TOTAL_SECONDS};
  start+=duration;
 }
}
export function createBuildClock(){
 let time=0,playing=false;
 return {
  read:()=>({...frameAt(time),playing}),
  play(){if(time===TOTAL_SECONDS)time=0;playing=true;return this.read();},
  pause(){playing=false;return this.read();},
  seek(seconds){time=clamp(seconds,0,TOTAL_SECONDS);if(time===TOTAL_SECONDS)playing=false;return this.read();},
  jump(stage,progress=0){const i=clamp(Math.trunc(stage),0,5);return this.seek(stageStart(i)+STAGE_SECONDS[i]*clamp(progress));},
  advance(delta){if(playing){time=clamp(time+Math.max(0,Number(delta)||0),0,TOTAL_SECONDS);if(time===TOTAL_SECONDS)playing=false;}return this.read();}
 };
}
export function processLabel({stage,progress:p}){
 return [
  'Bookmatching the top',
  p<.65?'Routing the body outline':'Routing the pickup cavities',
  'Fitting the neck to the body',
  p<.25?'Seating the fretboard':p<.64?'Setting the inlay appointments':'Installing the frets',
  p<.9?'Spray booth · applying your finish':'Spray booth · the final sheen',
  p<.16?'Installing the bridge':p<.34?'Installing the pickups':p<.45?'Fitting the controls':p<.64?'Fitting the tuners and nut':p<.72?'Closing the rear covers':p<.94?'Stringing the guitar':'Your Fostinis, assembled'
 ][stage];
}

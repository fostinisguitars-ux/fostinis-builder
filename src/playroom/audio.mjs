// Fostinis virtual playroom. Procedural string model, not instrument recordings.
export const OPEN_STRINGS = [64, 59, 55, 50, 45, 40]; // high E to low E
export const EQ_FREQUENCIES = [80, 240, 750, 2200, 6600];
export const CHORDS = {
  Em: [0, 0, 0, 2, 2, 0], Am: [0, 1, 2, 2, 0, -1],
  C: [0, 1, 0, 2, 3, -1], D: [2, 3, 2, 0, -1, -1],
  G: [3, 0, 0, 0, 2, 3], E5: [-1, -1, -1, 2, 2, 0],
  A5: [-1, -1, 2, 2, 0, -1], D5: [-1, 3, 2, 0, -1, -1]
};
export const DEFAULTS = {channel:'clean', gain:4, bass:5, mid:5, treble:5, reverb:2, delay:0, volume:4, pickup:'bridge', eq:[0,0,0,0,0]};
export function noteFrequency(midi) { return 440 * 2 ** ((midi - 69) / 12); }
export function noteName(midi) { return ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][midi % 12] + (Math.floor(midi / 12) - 1); }
export function chordNotes(name, up=false) {
  const notes = (CHORDS[name] || []).map((fret,string)=>({string,fret,midi:OPEN_STRINGS[string]+fret})).filter(n=>n.fret>=0);
  return up ? notes : notes.reverse();
}

// Fractional-delay Karplus–Strong string. The half-sample compensation keeps
// the averaging filter's phase delay from flattening the pitch.
export function pluckSamples(midi, sampleRate=48000, seconds=3.4) {
  if (!Number.isFinite(midi) || midi<28 || midi>96 || !Number.isFinite(sampleRate) || sampleRate<8000) throw new RangeError('Unsupported virtual guitar note');
  const f=noteFrequency(midi), period=sampleRate/f-.5, size=Math.ceil(period)+2;
  const line=new Float32Array(size), data=new Float32Array(Math.floor(sampleRate*seconds));
  let seed=5171+midi*97, average=0;
  for(let i=0;i<size;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;line[i]=seed/2147483648-1;average+=line[i];}
  average/=size;
  for(let i=0;i<size;i++)line[i]-=average;
  let write=0,previous=0,dc=0,peak=0;
  const damping=Math.exp(-1/(f*2.2));
  for(let i=0;i<data.length;i++){
    let read=write-period;if(read<0)read+=size;
    const a=Math.floor(read),fraction=read-a;
    const delayed=line[a]*(1-fraction)+line[(a+1)%size]*fraction;
    const next=(delayed+previous)*.5*damping;previous=delayed;
    line[write]=next;write=(write+1)%size;
    dc+=.002*(next-dc);
    const attack=Math.min(1,i/(sampleRate*.002));
    const fade=Math.min(1,(data.length-i)/(sampleRate*.045));
    const fundamental=Math.sin(2*Math.PI*f*i/sampleRate)*Math.exp(-i/(sampleRate*1.6))*.06;
    data[i]=((next-dc)+fundamental)*attack*fade;
    peak=Math.max(peak,Math.abs(data[i]));
  }
  if(peak>0)for(let i=0;i<data.length;i++)data[i]*=.7/peak;
  return data;
}

export function riffEvents(kind) {
  const out=[];
  if(kind==='arpeggio'){
    ['Em','C','G','D'].forEach((name,bar)=>{
      const notes=chordNotes(name);
      [0,1,2,3,2,1,3,2].forEach((v,i)=>{const n=notes[v%notes.length];out.push({...n,time:bar*2.4+i*.3,duration:2.2});});
    });
  }else if(kind==='rhythm'){
    ['E5','G','A5','D5'].forEach((name,bar)=>{
      [0,.38,.75,1.12,1.5,1.7].forEach((beat,i)=>chordNotes(name).slice(0,name==='G'?3:6).forEach((n,s)=>out.push({...n,time:bar*2+beat+s*.014,duration:i<4?.26:.18,velocity:.8})));
    });
  }else{
    const phrase=[[2,9],[1,8],[1,10],[0,7],[0,10],[0,12],[0,10],[0,7],[1,10],[1,8],[2,9],[2,7],[3,9],[2,7],[2,9],[0,12]];
    phrase.forEach(([string,fret],i)=>out.push({string,fret,midi:OPEN_STRINGS[string]+fret,time:i*.28,duration:i===15?2.6:.65}));
  }
  return out;
}

export class GuitarAudio {
  constructor({contextFactory,onNote=()=>{},onSequenceEnd=()=>{}}={}) {
    this.contextFactory=contextFactory;this.onNote=onNote;this.onSequenceEnd=onSequenceEnd;
    this.settings={...DEFAULTS,eq:[...DEFAULTS.eq]};this.voices=new Set();this.timers=new Set();this.buffers=new Map();this.connected=false;this.sequence=0;
  }
  async connect() {
    if(!this.context){
      const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
      if(!this.contextFactory&&!Context)throw new Error('This browser cannot play the virtual guitar. Try a current Safari, Chrome, Firefox, or Edge browser.');
      this.context=this.contextFactory?this.contextFactory():new Context({latencyHint:'interactive'});
      this.createGraph();
    }
    if(this.context.state!=='running')await this.context.resume();
    if(this.context.state!=='running')throw new Error('Audio is paused. Tap Plug in again to enable sound.');
    this.connected=true;this.apply();
  }
  createGraph() {
    const c=this.context;
    this.curveChannel=null;
    this.input=c.createGain();this.input.gain.value=.26;
    this.pickup=c.createBiquadFilter();this.pickup.type='lowpass';this.pickup.Q.value=.55;
    this.pickup.frequency.value=10000;
    this.branches=['neck','middle','bridge'].map(place=>{
      const filter=c.createBiquadFilter(),phase=c.createBiquadFilter(),gain=c.createGain();filter.type='lowpass';filter.Q.value=.65;phase.type='allpass';phase.frequency.value=place==='neck'?800:place==='middle'?1600:3200;phase.Q.value=.6;gain.gain.value=place==='bridge'?1:0;
      this.input.connect(filter);filter.connect(phase);phase.connect(gain);gain.connect(this.pickup);return {place,filter,gain};
    });
    this.guitarVolume=c.createGain();this.guitarTone=c.createBiquadFilter();this.guitarTone.type='lowpass';this.guitarTone.frequency.value=10000;this.guitarTone.Q.value=.5;
    this.pre=c.createGain();this.shape=c.createWaveShaper();this.shape.oversample='2x';
    this.bass=c.createBiquadFilter();this.bass.type='lowshelf';this.bass.frequency.value=150;
    this.mid=c.createBiquadFilter();this.mid.type='peaking';this.mid.frequency.value=750;this.mid.Q.value=.8;
    this.treble=c.createBiquadFilter();this.treble.type='highshelf';this.treble.frequency.value=2600;
    this.eq=EQ_FREQUENCIES.map(f=>{const n=c.createBiquadFilter();n.type='peaking';n.frequency.value=f;n.Q.value=1;return n;});
    this.cabLow=c.createBiquadFilter();this.cabLow.type='highpass';this.cabLow.frequency.value=65;
    this.cabHigh=c.createBiquadFilter();this.cabHigh.type='lowpass';this.cabHigh.frequency.value=5700;this.cabHigh.Q.value=.65;
    this.bus=c.createGain();
    const nodes=[this.pickup,this.guitarTone,this.guitarVolume,this.pre,this.shape,this.bass,this.mid,this.treble,...this.eq,this.cabLow,this.cabHigh,this.bus];
    for(let i=1;i<nodes.length;i++)nodes[i-1].connect(nodes[i]);
    this.reverb=c.createConvolver();
    const impulse=c.createBuffer(2,Math.floor(c.sampleRate*.7),c.sampleRate);let seed=98;
    for(let channel=0;channel<2;channel++){const data=impulse.getChannelData(channel);for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/2147483648-1)*Math.exp(-i/(c.sampleRate*.13))*Math.min(1,i/180);}}
    this.reverb.buffer=impulse;this.reverbWet=c.createGain();
    this.echo=c.createDelay(1);this.echo.delayTime.value=.395;this.feedback=c.createGain();this.feedback.gain.value=.27;this.echoWet=c.createGain();
    this.bus.connect(this.reverb);this.reverb.connect(this.reverbWet);
    this.bus.connect(this.echo);this.echo.connect(this.feedback);this.feedback.connect(this.echo);this.echo.connect(this.echoWet);
    this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-14;this.compressor.knee.value=10;this.compressor.ratio.value=8;this.compressor.attack.value=.003;this.compressor.release.value=.12;
    this.bus.connect(this.compressor);this.reverbWet.connect(this.compressor);this.echoWet.connect(this.compressor);
    this.master=c.createGain();this.master.gain.value=0;this.compressor.connect(this.master);this.master.connect(c.destination);
    this.apply();
  }
  update(key,value) {
    if(key==='channel'&&!['clean','crunch','lead'].includes(value))return;
    if(key==='pickup'&&!['neck','bridge'].includes(value))return;
    this.settings[key]=key==='eq'?value.map(v=>Math.max(-8,Math.min(8,Number(v)||0))):typeof value==='number'?Math.max(0,Math.min(10,value)):value;
    if(this.context)this.apply();
  }
  apply() {
    if(!this.master)return;
    const s=this.settings,now=this.context.currentTime;
    const set=(p,v)=>p.setTargetAtTime(v,now,.018);
    const voice=this.switching||{pickups:[{place:s.pickup,type:'H',phase:1}],volume:10,tone:10,voice:1};
    this.branches.forEach(branch=>{const p=voice.pickups.find(p=>p.place===branch.place);set(branch.gain.gain,p?(p.phase||1)*(p.type==='S'?.65:p.parallel?.68:1)/(voice.pickups.length>1?1.55:1):0);set(branch.filter.frequency,({neck:3300,middle:4600,bridge:6500}[branch.place])*(p?.type==='S'||p?.parallel?1.4:1));});
    set(this.guitarVolume.gain,(voice.volume/10)**1.6*(voice.voice===2?1.15:1));
    const volumeLoss=voice.trebleBleed?1:.45+.55*voice.volume/10;
    set(this.guitarTone.frequency,(450+voice.tone**2*100)*volumeLoss);
    set(this.pre.gain,s.channel==='clean'?.8+s.gain*.18:s.channel==='crunch'?2+s.gain*1.2:5+s.gain*3.2);
    if(this.curveChannel!==s.channel){const curve=new Float32Array(2048),amount=s.channel==='clean'?.75:s.channel==='crunch'?1.8:3.2;for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=Math.tanh(x*amount)/Math.tanh(amount);}this.shape.curve=curve;this.curveChannel=s.channel;}
    set(this.bass.gain,(s.bass-5)*1.6);set(this.mid.gain,(s.mid-5)*1.6);set(this.treble.gain,(s.treble-5)*1.6);
    this.eq.forEach((n,i)=>set(n.gain,s.eq[i]||0));
    set(this.reverbWet.gain,s.reverb*.045);set(this.echoWet.gain,s.delay*.045);
    set(this.master.gain,this.connected&&!this.killed?s.volume*.052:0);
  }
  setSwitching(voice){this.switching=voice;if(this.context)this.apply();}
  setKilled(killed){this.killed=!!killed;if(this.context)this.apply();}
  pluck(midi,{time=this.context?.currentTime||0,velocity=1,duration=3.3,string,fret}={}) {
    if(!this.connected||this.context.state!=='running')return;
    const c=this.context,key=midi+':'+c.sampleRate;let buffer=this.buffers.get(key);
    if(!buffer){const data=pluckSamples(midi,c.sampleRate);buffer=c.createBuffer(1,data.length,c.sampleRate);buffer.copyToChannel(data,0);this.buffers.set(key,buffer);if(this.buffers.size>28)this.buffers.delete(this.buffers.keys().next().value);}
    const source=c.createBufferSource(),envelope=c.createGain();source.buffer=buffer;
    const start=Math.max(c.currentTime,time),hold=Math.min(duration,buffer.duration-.03);
    envelope.gain.setValueAtTime(Math.min(1,Math.max(.1,velocity)),start);
    envelope.gain.setTargetAtTime(0,start+Math.max(.035,hold-.06),.02);
    source.connect(envelope);envelope.connect(this.input);
    const voice={source,envelope};this.voices.add(voice);
    source.onended=()=>{source.disconnect();envelope.disconnect();this.voices.delete(voice);};
    source.start(start);source.stop(start+hold+.12);
    this.later(()=>this.onNote({midi,string,fret}),Math.max(0,(start-c.currentTime)*1000));
    // Limit repeated taps to a practical polyphony without leaving old nodes alive.
    if(this.voices.size>32){const old=this.voices.values().next().value;try{old.source.stop();}catch{}this.voices.delete(old);}
  }
  strum(name,up=false) {const now=this.context?.currentTime||0;chordNotes(name,up).forEach((n,i)=>this.pluck(n.midi,{...n,time:now+.025+i*.028,velocity:.86}));}
  later(fn,ms){const id=setTimeout(()=>{this.timers.delete(id);fn();},ms);this.timers.add(id);return id;}
  playRiff(kind) {
    this.stop();if(!this.connected)return;
    const events=riffEvents(kind),start=this.context.currentTime+.05,serial=++this.sequence;
    // Schedule only the next note group, so Stop cancels immediately and caches
    // do not consume the whole mobile main thread before playback begins.
    for(const event of events)this.later(()=>{if(serial===this.sequence)this.pluck(event.midi,{...event,time:start+event.time});},Math.max(0,event.time*1000-80));
    const end=Math.max(...events.map(e=>e.time+e.duration));this.later(()=>{if(serial===this.sequence)this.onSequenceEnd();},(end+.1)*1000);
  }
  stop() {
    this.sequence++;this.timers.forEach(clearTimeout);this.timers.clear();
    if(this.context){for(const v of this.voices){try{v.envelope.gain.cancelScheduledValues(this.context.currentTime);v.envelope.gain.setTargetAtTime(0,this.context.currentTime,.008);v.source.stop(this.context.currentTime+.04);}catch{}}}
    this.onSequenceEnd();
  }
  async disconnect() {
    this.connected=false;this.killed=false;this.stop();this.apply();
    // Recreate on the next explicit gesture so a reconnect cannot replay old
    // notes trapped in delay/convolution buffers while the context was paused.
    const context=this.context;this.context=null;this.master=null;this.buffers.clear();
    if(context&&context.state!=='closed')await context.close();
    this.voices.clear();
  }
  async destroy(){await this.disconnect();if(this.context&&this.context.state!=='closed')await this.context.close();this.buffers.clear();}
}

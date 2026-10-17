// The faded palette follows each region's chosen color, including solid paint
// and natural wood. It never substitutes a preset center or changes the grain.
export function createBurstFinishes({BURSTS,WOODS,FINISHES,SOLID_COLORS}) {
  const mix=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
  function finishColor(state,region='top') {
    if(region==='headstock_front'&&state.headstockBurst==='black')return SOLID_COLORS.black.color;
    const prefix=region==='back'||region==='side'?'back':region==='neck'?'neck':'';
    const get=key=>state[prefix?prefix+key[0].toUpperCase()+key.slice(1):key];
    const finish=FINISHES.find(f=>f.id===get('finish'))||FINISHES[0];
    if(get('finishType')==='solid')return SOLID_COLORS[finish.id].color;
    return finish.type==='clear'?(WOODS[get('wood')]||WOODS.flame).natural:finish.color;
  }
  function resolveBurst(state,region='top') {
    const key=region==='back'||region==='side'?'backBurst':region==='neck'?'neckBurst':'burst';
    const id=region==='binding'||region==='headstock_front'&&state.headstockBurst==='black'?'none':state[key];
    const palette=BURSTS.find(b=>b.id===id)||BURSTS[0];
    if(palette.id!=='faded')return palette;
    const base=finishColor(state,region);
    return {...palette,center:mix(base,'#ffffff',.42),mid:base,edge:mix(base,'#000000',.46)};
  }
  return {finishColor,resolveBurst};
}

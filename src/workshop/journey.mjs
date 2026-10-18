export const BUILD_STAGES=[
 {id:'timber',title:'Choose the grain.',label:'Timber',station:'wood',copy:'Explore the figure, color, and character of the timber that begins your design.',detail:'Bookmatched top pieces, body wood, and a neck blank introduce the materials on the bench.'},
 {id:'shape',title:'Reveal the shape.',label:'Shaping',station:'router',copy:'See the body emerge as the outline, carved top, and component routes take form.',detail:'Templates, routing, and careful shaping turn the blank into a recognizable Fostinis silhouette.'},
 {id:'neck',title:'Bring the neck home.',label:'Neck fit',station:'chisel',copy:'Watch the neck and body come together—the foundation of how the instrument feels.',detail:'Explore the relationship between the neck, the joint, and the sculpted body.'},
 {id:'inlays',title:'Make your mark.',label:'Inlays',station:'inlays',copy:'Choose the fretboard and inlays that make this guitar feel unmistakably yours.',detail:'Compare Cherub Wings, pearl dots, or a clean fretboard without face inlays.'},
 {id:'finish',title:'Bring color to life.',label:'Finish',station:'plane',copy:'Move from bare wood to your chosen color, burst, and sheen.',detail:'Your current finish appears on the same guitar. Turn the light to explore the figure and contours.'},
 {id:'assembly',title:'Find its voice.',label:'Assembly',station:'setup',copy:'Pickups, bridge, controls, and strings complete the instrument before its final setup.',detail:'The appointments in your saved configuration come together in the finished preview.'}
];
export const WORKSHOP_STATIONS=[
 {id:'wood',name:'The timber rack',short:'Woods',eyebrow:'MATERIAL / FIGURE',title:'Follow the grain.',copy:'Lift an idea from the timber rack. Explore six representative top woods and carry the one that moves you into your design.',note:'Representative grain and color. The actual piece of timber is confirmed with your build.'},
 {id:'inlays',name:'The inlay bench',short:'Inlays',eyebrow:'DETAIL / IDENTITY',title:'Make it unmistakable.',copy:'Compare the fretboard and inlay appointments on your guitar. A personal symbol or original artwork can become a special request.',note:'Custom artwork is reviewed and quoted individually.'},
 {id:'chisel',name:'Chisels & carving',short:'Chisels',eyebrow:'TOOL / REFINEMENT',title:'The smallest cut matters.',copy:'A sharp chisel gives the maker control over small details. Look at the polished blade, ferrule, and timber handle on the bench.',note:'Explore the tool in three dimensions. This is an illustrated craft experience.'},
 {id:'router',name:'Routing & templates',short:'Routers',eyebrow:'TOOL / PRECISION',title:'Room for every detail.',copy:'Routing and templates establish space for components and help bring a repeatable shape to the body. Explore the router beside your emerging guitar.',note:'Illustrative tools and construction stages; not a machining guide.'},
 {id:'plane',name:'Surface & finishing',short:'Materials',eyebrow:'SURFACE / LIGHT',title:'Let the figure speak.',copy:'A hand plane, abrasives, and finishing materials belong to the quiet work of preparing a surface. Compare the bare timber with your configured finish.',note:'The preview represents your selected color and sheen. Final appearance varies with the wood and light.'},
 {id:'setup',name:'The setup bench',short:'Setup tools',eyebrow:'FEEL / FINAL APPOINTMENTS',title:'Ready for your hands.',copy:'The straightedge, measuring tools, and final adjustments bring attention back to the player. Explore the completed design from every side.',note:'Tell us your preferred tuning, strings, and setup in your personal design review.'}
];
export const TOP_WOODS=[['flame','Flamed maple','wood-real19-flame.jpg'],['quilt','Quilted Bigleaf maple','wood-real19-quilt.jpg'],['burl','Burl','wood-real44-burl.jpg'],['ash','Ash','wood-real19-ash.jpg'],['walnut','Walnut','wood-real19-walnut.jpg'],['mahogany','Red mahogany','wood-real19-mahogany.jpg']];
export const INLAYS=[['motif','Cherub Wings'],['dots','Pearl dots'],['none','No inlays']];
export const FRETBOARDS=[['ebony','Ebony'],['rosewood','Rosewood'],['maple','Maple']];
export function stageParts(index){
 const stage=Math.max(0,Math.min(5,Math.trunc(Number(index)||0)));
 return {stage,timber:stage===0,body:stage>=1,neck:stage>=2,fretboard:stage===3||stage===4,hardware:stage===5,finished:stage>=4,signature:stage>=4,covers:stage===5};
}
// Only the workshop's three advertised choices can change the customer's build.
// Preserve every other dropdown, nickname, and field-specific custom request.
export function applyWorkshopChoices(build,choices,F){
 const selections={...build.selections};
 for(const key of ['wood','inlays','fretboard']){
  if(!F.choices[key]?.includes(choices[key]))throw Error('Choose an available '+key+' option.');
  selections[key]=choices[key];
 }
 return {...build,selections};
}

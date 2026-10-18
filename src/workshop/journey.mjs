export const BUILD_STAGES=[
 {id:'timber',title:'It begins with the grain.',label:'Timber',copy:'Two bookmatched pieces come together. Your chosen wood gives this instrument its first expression.',detail:'Explore the top woods alongside the build. Each sample represents the grain and color of the species.'},
 {id:'shape',title:'A silhouette takes shape.',label:'Routing',copy:'Follow the routing pass around the body, then into the spaces for your selected pickups.',detail:'The animation follows the shape of your configured Fostinis model.'},
 {id:'neck',title:'Two pieces. One instrument.',label:'Neck fit',copy:'The neck moves into place, bringing the body and headstock together.',detail:'Orbit the workbench to see the instrument taking form from another angle.'},
 {id:'inlays',title:'The details become yours.',label:'Inlays & frets',copy:'The fretboard, inlay appointments, and frets settle into place, one detail at a time.',detail:'Try Cherub Wings, pearl dots, or a clean fretboard without face inlays.'},
 {id:'finish',title:'Into the spray booth.',label:'Spray booth',copy:'Watch the spray passes bring your selected color and sheen across the instrument.',detail:'Your chosen finish is revealed progressively on the same guitar. Natural wood and clear finishes are shown too.'},
 {id:'assembly',title:'Every part finds its place.',label:'Assembly',copy:'The bridge, pickups, controls, tuners, nut, rear covers, and strings complete your guitar.',detail:'The parts and pickup layout follow your current configuration. Pause and turn the finished instrument to take it all in.'}
];
export const MATERIAL_PANELS=[
 {id:'wood',short:'Top woods',eyebrow:'MATERIAL / FIGURE',title:'Follow the grain.',copy:'Explore six representative top woods and carry the one that moves you into your design.',note:'Representative grain and color. The actual piece of timber is confirmed with your build.'},
 {id:'inlays',short:'Inlays & board',eyebrow:'DETAIL / IDENTITY',title:'Make it unmistakable.',copy:'Compare fretboards and inlay appointments on your guitar. A personal symbol or original artwork can become a special request.',note:'Custom artwork is reviewed and quoted individually.'}
];
export const TOP_WOODS=[['flame','Flamed maple','wood-real19-flame.jpg'],['quilt','Quilted Bigleaf maple','wood-real19-quilt.jpg'],['burl','Burl','wood-real44-burl.jpg'],['ash','Ash','wood-real19-ash.jpg'],['walnut','Walnut','wood-real19-walnut.jpg'],['mahogany','Red mahogany','wood-real19-mahogany.jpg']];
export const INLAYS=[['motif','Cherub Wings'],['dots','Pearl dots'],['none','No inlays']];
export const FRETBOARDS=[['ebony','Ebony'],['rosewood','Rosewood'],['maple','Maple']];
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

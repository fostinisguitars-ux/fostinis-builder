// One calculation is shared by the browser and the checkout server.
// Owner-approved component snapshots set upgrade prices; reference research alone never does.
function createPricingEngine(catalog) {
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const electronics=createElectronics();
  function priceOption(key,value,selections={}) {
    const option=catalog.fields[key]?.options?.[value];
    const pending={cents:null,status:'quote required'};
    if(!option||option.approved!==true)return pending;
    if(option.componentPricesCents){
      const rule=catalog.hardwarePricing;
      let cost=option.componentPricesCents[selections.hardware]??option.componentPricesCents.reference;
      if(key==='pickupSet'&&catalog.pickupLayoutPricing){
        const state={...selections,pickupSet:value},h=electronics.count(state,'H'),singles=electronics.count(state,'S');
        const single=catalog.fields.singleCoilModel.options[state.singleCoilModel||'ssl2']?.componentCents;
        if(state.pickupLayout==='h')return {cents:0,status:'confirmed',componentCents:Math.round(cost/2),allowanceCents:rule.allowancesCents.pickupSet,excessCents:0,markupCents:0};
        if(singles&&!Number.isSafeInteger(single))return pending;
        cost=Math.round(cost*h/2)+(singles?single*singles:0);
      }
      const allowance=rule?.allowancesCents?.[key],markup=rule?.markupBasisPoints;
      if(rule?.approved!==true||!rule.categories.includes(key)||![cost,allowance,markup].every(n=>Number.isSafeInteger(n)&&n>=0))return pending;
      const excess=Math.max(0,cost-allowance);
      const cents=Math.round(excess*(10000+markup)/10000);
      if(!Number.isSafeInteger(cents))return pending;
      return {cents,status:'confirmed',componentCents:cost,allowanceCents:allowance,excessCents:excess,markupCents:cents-excess};
    }
    return Number.isSafeInteger(option.cents)&&option.cents>=0?{cents:option.cents,status:'confirmed'}:pending;
  }
  function validate(model,input) {
    if(!own(catalog.models,model))throw new Error('Choose a valid guitar model.');
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Build options are required.');
    const selections={},candidate=electronics.migrate(input);
    for(const [key,field] of Object.entries(catalog.fields)) {
      const raw=own(candidate,key)?candidate[key]:field.default;
      const value=typeof raw==='string'&&own(field.legacyAliases||{},raw)?field.legacyAliases[raw]:raw;
      if(typeof value!=='string'||!own(field.options,value))throw new Error('Choose a valid '+field.label.toLowerCase()+'.');
      selections[key]=value;
    }
    const issues=electronics.issues(selections);if(issues.length)throw new Error(issues[0]);
    return selections;
  }
  function quote(model,input,notes='') {
    const selections=validate(model,input), m=catalog.models[model];
    const lines=[{key:'model',label:m.name+' starting price',value:m.name,cents:m.cents,status:'confirmed'}];
    const unresolved=[];
    for(const [key,value] of Object.entries(selections)) {
      const field=catalog.fields[key],option=field.options[value],price=priceOption(key,value,selections);
      const description=key==='headstockBurst'&&value==='match'?option.label+(selections.burst!=='none'?' with burst':''):key==='pickupSet'?(electronics.count(selections,'H')?option.label+(selections.pickupLayout==='h'||electronics.count(selections,'H')===1?' · bridge humbucker':''):'Single-coil package')+(electronics.count(selections,'S')?' + '+electronics.count(selections,'S')+' × '+catalog.fields.singleCoilModel.options[selections.singleCoilModel].label:''):option.label;
      const label=electronics.potFields.includes(key)?electronics.potName(selections,electronics.potFields.indexOf(key))+' modification':field.label;
      if(electronics.potFields.includes(key)&&!electronics.layout(selections).pots.includes(electronics.potFields.indexOf(key)))continue;
      if(['singleCoilModel','singleCoilCover'].includes(key)&&!electronics.count(selections,'S'))continue;
      lines.push({key,label,value:description,...price});
      if(price.cents===null)unresolved.push(key);
    }
    if(String(notes).trim())unresolved.push('customNotes');
    const confirmedSubtotalCents=lines.reduce((sum,line)=>sum+(line.cents??0),0);
    const hardwareUpgradeCents=lines.filter(line=>catalog.hardwarePricing?.categories.includes(line.key)).reduce((sum,line)=>sum+(line.cents??0),0);
    const materialUpgradeCents=lines.filter(line=>catalog.materialPricing?.categories.includes(line.key)).reduce((sum,line)=>sum+(line.cents??0),0);
    const electronicsUpgradeCents=lines.filter(line=>catalog.electronicsPricing?.categories.includes(line.key)).reduce((sum,line)=>sum+(line.cents??0),0);
    const accessoryUpgradeCents=lines.filter(line=>catalog.accessoryPricing?.categories.includes(line.key)).reduce((sum,line)=>sum+(line.cents??0),0);
    const complete=unresolved.length===0&&catalog.currencyApproved===true;
    const references=[];
    for(const [key,quantity] of [['pickupSet',1],['bridgeModel',1],['tunerModel',6]]) {
      if(key==='pickupSet'&&selections.pickupLayout!=='hh'){
        const h=electronics.count(selections,'H'),singles=electronics.count(selections,'S');
        if(h){const option=catalog.fields.pickupSet.options[selections.pickupSet];references.push({key,name:option.label+(h===1?' · bridge humbucker':''),source:catalog.references[selections.pickupSet]?.source||'',checkedAt:catalog.checkedAt,cents:Math.round((option.componentPricesCents[selections.hardware]??option.componentPricesCents.reference)*h/2),quantity:1,currency:'USD',variant:'Catalog allocation',available:null,note:'Pricing allocation from the existing approved pair snapshot; a single humbucker uses half the pair allocation. H layout has no pickup surcharge.'});}
        if(singles){const option=catalog.fields.singleCoilModel.options[selections.singleCoilModel];references.push({key:'singleCoilModel',name:option.label,source:option.source,checkedAt:catalog.checkedAt,cents:option.componentCents,quantity:singles,currency:'USD',variant:'Black / cream / white covers; matched middle variant',available:null,note:'Single-coil component price is included in the complete pickup-package calculation.'});}
        continue;
      }
      const entry=catalog.references[selections[key]];
      const variant=entry?.variants?.[selections.hardware]||entry?.variants?.reference;
      references.push({key,name:catalog.fields[key].options[selections[key]].label,source:entry?.source||'',checkedAt:entry?.checkedAt||catalog.checkedAt,
        cents:variant?.cents??null,quantity:variant?.quantity??quantity,currency:variant?.currency||'USD',variant:variant?.label||'',available:variant?.available??null,
        note:entry?.note||'Exact variant and supplier price need confirmation.'});
    }
    const pricedReferences=references.filter(r=>r.cents!==null&&r.currency==='USD');
    return {catalogVersion:catalog.version,currency:catalog.currency,model,selections,lines,unresolved,
      baseCents:m.cents,hardwareUpgradeCents,materialUpgradeCents,electronicsUpgradeCents,accessoryUpgradeCents,confirmedSubtotalCents,subtotalCents:complete?confirmedSubtotalCents:null,
      totalCents:null,status:complete?'shipping-and-tax-pending':'quote-required',
      references,referenceSubtotalCents:pricedReferences.reduce((n,r)=>n+r.cents*r.quantity,0),referenceCount:pricedReferences.length,
      message:'Final price includes approved appointments, shipping and applicable tax. Custom requests are quoted separately.'};
  }
  return {quote,validate,priceOption,catalog};
}
window.FostinisPricing=createPricingEngine(window.FostinisCommerceCatalog);
(function(){
'use strict';
let current=null,config=null,busy=false,requestKey=null,requestFingerprint=null;
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
const element=(tag,text,cls)=>{const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;};
function row(parent,label,value){const r=element('div','', 'price-row');r.append(element('span',label),element('strong',value));parent.append(r);}
function renderNickname(){const node=document.getElementById('checkout-nickname');if(node){node.hidden=!current?.nickname;node.textContent=current?.nickname?'Guitar nickname: '+current.nickname:'';}}
function render(){
 if(!current)return;renderNickname();
 const q=window.FostinisPricing.quote(current.model,current.selections,current.notes);
 for(const box of document.querySelectorAll('[data-build-price]')){
  box.replaceChildren(element('div','Your build · USD','eyebrow'));
  row(box,'Model starting price',money(q.baseCents));
  row(box,'Hardware upgrades',money(q.hardwareUpgradeCents));
  row(box,'Wood & finish upgrades',money(q.materialUpgradeCents));
  row(box,'Electronics modifications',money(q.electronicsUpgradeCents));
  row(box,'Case upgrade',money(q.accessoryUpgradeCents));
  row(box,'Build total',money(q.confirmedSubtotalCents));
  box.append(element('p','Gig bag and US shipping included. Applicable tax is calculated at checkout.'+(current.notes.trim()?' Custom work requested in your notes is reviewed separately.':''),'note'));
 }
 const breakdown=document.getElementById('price-breakdown');
 if(breakdown){breakdown.replaceChildren();for(const line of q.lines)row(breakdown,line.label+' · '+line.value,line.cents===null?'Contact us':line.key==='hardware'?'Priced with components':line.cents===0?'Included':money(line.cents));
  if(current.notes.trim())row(breakdown,'Build notes / custom work','Review separately');}
 const refs=document.getElementById('parts-price-reference');
 if(refs){refs.replaceChildren();for(const r of q.references){const item=element('div','','supplier-price');row(item,r.name,r.cents===null?'Confirm exact variant':money(r.cents*r.quantity));
   if(r.cents!==null)item.append(element('p',r.variant+(r.quantity===6?' · Six tuners at '+money(r.cents)+' each':'')+(r.available===false?' · Supplier currently sold out':''),'note'));
   item.append(element('p',r.note,'note'));if(r.source){const a=element('a','Manufacturer details ↗');a.href=r.source;a.target='_blank';a.rel='noopener';item.append(a);}refs.append(item);}
  row(refs,'Component price total ('+q.referenceCount+'/'+q.references.length+')',money(q.referenceSubtotalCents));
 }
 const cta=document.getElementById('checkout-stripe');
 const hosted=["https://fostinis-design-review.bouncybow11.chatgpt.site","https://fostinisguitars.com","https://www.fostinisguitars.com"].includes(location.origin);
 if(cta){cta.disabled=busy||!hosted||!config?.ready||q.subtotalCents===null||Boolean(current.notes.trim());
 cta.textContent=busy?'Opening secure checkout…':config?.mode==='test'?'Test Stripe checkout · no real payment':'Pay securely with Stripe';}
 const message=document.getElementById('checkout-availability');
 if(message)message.textContent=!hosted?'Your selected options are priced. Contact us to confirm shipping, tax and payment.':config?.ready&&q.subtotalCents!==null?(config.mode==='test'?'Test mode only. This will not place a real guitar order.':'Your full order is recalculated securely before payment.'):'Your selected options are priced. Contact us to confirm shipping, tax and payment.';
 document.querySelectorAll('[data-request-quote]').forEach(a=>{a.href='mailto:fostinisguitars@gmail.com?subject='+encodeURIComponent('Build and delivery details — Fostinis '+window.Fostinis.MODELS[current.model].name)+'&body='+encodeURIComponent(['Hi Jimmy,','','Please confirm delivery, tax and payment arrangements for my build.',...(current.nickname?['Guitar nickname: '+current.nickname]:[]),...q.lines.map(l=>l.label+': '+l.value+(l.cents===null?' — review separately':l.cents===0?' — Included':' — '+money(l.cents))), '', 'Model starting price: '+money(q.baseCents),'Hardware upgrades: '+money(q.hardwareUpgradeCents),'Wood & finish upgrades: '+money(q.materialUpgradeCents),'Build total: '+money(q.confirmedSubtotalCents),'All other listed options are included. Shipping and tax are confirmed separately.','', 'Build notes: '+(current.notes||'None.'),'','Shipping country / postal code: '].join('\n'));});
 window.FostinisCommerce.lastQuote=q;
}
async function checkout(){
 if(busy||!current)return;busy=true;render();const status=document.getElementById('checkout-result');status.textContent='Checking your build…';
 try{if(window.FostinisStudio?.isSharedBuild?.())window.FostinisStudio.saveSharedBuild();const payload={model:current.model,selections:current.selections,notes:current.notes,nickname:current.nickname||''};const fingerprint=JSON.stringify(payload);
  if(fingerprint!==requestFingerprint){requestKey=crypto.randomUUID();requestFingerprint=fingerprint;}
  const response=await fetch('/api/commerce/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,requestId:requestKey})});
  const result=await response.json();if(!response.ok)throw new Error(result.message||'Checkout is not available yet. Please request your final quote.');
  const url=new URL(result.url);if(url.origin!=='https://checkout.stripe.com')throw new Error('The checkout link could not be verified.');
  location.assign(url.href);
 }catch(error){status.textContent=error.message;}finally{busy=false;render();}
}
window.FostinisCommerce={update(data){current=JSON.parse(JSON.stringify(data));current.nickname=window.FostinisSharing?.cleanNickname(current.nickname)||'';render();},setNickname(value){if(current){current.nickname=window.FostinisSharing?.cleanNickname(value)||'';renderNickname();}},lastQuote:null};
document.getElementById('checkout-stripe')?.addEventListener('click',checkout);
if(["https://fostinis-design-review.bouncybow11.chatgpt.site","https://fostinisguitars.com","https://www.fostinisguitars.com"].includes(location.origin))fetch('/api/commerce/config',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{config=data;render();}).catch(()=>{});
const query=new URLSearchParams(location.search);
if(query.get('checkout')==='cancelled'){const n=document.getElementById('checkout-result');if(n)n.textContent='Checkout cancelled. Your build is still saved here.';}
if(query.get('checkout')==='success'&&query.get('session_id')){
 const n=document.getElementById('checkout-result');if(n)n.textContent='Verifying your payment…';
 fetch('/api/commerce/status?session_id='+encodeURIComponent(query.get('session_id')),{cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.message);if(n)n.textContent=data.paid?(data.mode==='test'?'Test payment completed. No real guitar order was placed.':'Payment confirmed. Your order reference is '+data.orderId+'. Keep your Stripe receipt.'):'Your payment is not yet confirmed. Please check your Stripe receipt or contact Jimmy before retrying.';}).catch(()=>{if(n)n.textContent='Payment could not be verified here. Check your Stripe receipt or contact Jimmy before retrying.';});
}
})();

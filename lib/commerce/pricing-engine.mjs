// One calculation is shared by the browser and the checkout server.
// Owner-approved component snapshots set upgrade prices; reference research alone never does.
import {createElectronics} from './electronics.mjs';
export function createPricingEngine(catalog) {
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

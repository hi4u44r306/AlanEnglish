// Browser boundary: server owns prices, balances, ownership and final effects.
export const RELIC_ACTIONS = ['relic_purchase','relic_equip','relic_unequip'];
export const RELIC_KINDS = ['speaking_question','listening_session','review'];
export const RELIC_STATS = {attack:'Boss 攻擊',guard:'守護護盾',charge:'技能充能',support:'團隊共鳴'};
const fail=()=>{throw Error('invalid_relic_response');};
const integer=(v,max=2147483647,min=0)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const id=v=>typeof v==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const slot=v=>['treasure1','treasure2'].includes(v);
const stats=(v,max=1000)=>v&&Object.keys(RELIC_STATS).every(k=>integer(v[k],max));
export function validRelicIntent(p){
 const keys={relic_purchase:['action','id','catalog_version','request_id'],relic_equip:['action','id','slot','expected_version','request_id'],relic_unequip:['action','slot','expected_version','request_id']}[p?.action];
 return Boolean(keys&&Object.keys(p).sort().join('|')===keys.sort().join('|')&&uuid(p.request_id)
 &&(p.action==='relic_unequip'||id(p.id))&&(p.action==='relic_purchase'?integer(p.catalog_version,2147483646,1):slot(p.slot)&&integer(p.expected_version,2147483646)));
}
export function validateRelicResult(p,d){
 if(!d||!RELIC_ACTIONS.includes(p.action))return fail();
 if(p.action==='relic_purchase'){
  if(!['relic_purchased','relic_already_owned'].includes(d.status)||d.id!==p.id||!integer(d.balance,1e12)||!integer(d.charged,1e6)||(d.status==='relic_already_owned'&&d.charged!==0))return fail();
 }else if(d.status!==(p.action==='relic_equip'?'relic_equipped':'relic_unequipped')||d.slot!==p.slot||!integer(d.version)||d.version<p.expected_version||d.version>p.expected_version+1||(p.action==='relic_equip'&&d.id!==p.id))return fail();
 return d;
}
export function validateRelicReceipt(p,d){
 if(!d||d.status!=='relic_receipt'||d.request_id!==p.request_id||!['not_found','confirmed'].includes(d.state))return fail();
 if(d.state==='confirmed'){
  const expected={...p};delete expected.request_id;
  if(!d.payload||Object.keys(d.payload).length!==Object.keys(expected).length||Object.keys(expected).some(k=>d.payload[k]!==expected[k])||!Number.isFinite(Date.parse(d.created_at)))return fail();
  validateRelicResult(p,d.result);
 }return d;
}
export function validateRelicSummary(d,kind){
 if(!d||d.status!=='relic_summary'||d.kind!==kind||!RELIC_KINDS.includes(kind)||d.applied_to_battle!==false||!integer(d.balance,1e12)||!integer(d.version)||!integer(d.rules_version,2147483647,1)||!stats(d.caps)||!stats(d.bonus)||!stats(d.raw_bonus,2000))return fail();
 for(const k of ['catalog','inventory','equipped','effects'])if(!Array.isArray(d[k])||d[k].length>(['catalog','inventory'].includes(k)?256:2))return fail();
 for(const k of ['catalog','inventory']){
  if(new Set(d[k].map(i=>i.id)).size!==d[k].length)return fail();
  for(const i of d[k])if(!id(i.id)||!['any',...RELIC_KINDS].includes(i.condition)||!stats(i.bonus)||(k==='catalog'?(!integer(i.price,1e6)||!integer(i.catalog_version,2147483647,1)):typeof i.enabled!=='boolean'))return fail();
 }
 if(new Set(d.equipped.map(i=>i.id)).size!==d.equipped.length||new Set(d.equipped.map(i=>i.slot)).size!==d.equipped.length||new Set(d.effects.map(i=>i.slot)).size!==d.effects.length||d.effects.length!==d.equipped.length)return fail();
 const sum={attack:0,guard:0,charge:0,support:0};
 for(const e of d.equipped){const owned=d.inventory.find(i=>i.id===e.id),effect=d.effects.find(i=>i.id===e.id&&i.slot===e.slot);if(!slot(e.slot)||!owned||!effect)return fail();const active=owned.enabled&&(owned.condition==='any'||owned.condition===kind);if(effect.active!==active)return fail();if(active)for(const k of Object.keys(sum))sum[k]+=owned.bonus[k];}
 for(const k of Object.keys(sum))if(d.raw_bonus[k]!==sum[k]||d.bonus[k]!==Math.min(sum[k],d.caps[k]))return fail();
 return d;
}
// Comparison only. Never sent as damage or authority to a learning endpoint.
export function compareRelic(d,item,target){
 const worn=d.equipped.filter(e=>e.slot!==target&&e.id!==item.id).map(e=>d.inventory.find(i=>i.id===e.id));worn.push(item);
 return Object.fromEntries(Object.keys(RELIC_STATS).map(k=>[k,Math.min(d.caps[k],worn.reduce((n,i)=>n+(i.enabled!==false&&(i.condition==='any'||i.condition===d.kind)?i.bonus[k]:0),0))]));
}

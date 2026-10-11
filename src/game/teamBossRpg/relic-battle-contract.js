// Strict projection of immutable server settlement; never a learning/damage writer.
const object=(v        )                       =>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('invalid relic battle');return v                          ;};
const integer=(v        ,max       ,min=0)       =>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)throw Error('invalid relic battle');return v;};
const boolean=(v        )        =>{if(typeof v!=='boolean')throw Error('invalid relic battle');return v;};
const kind=(v        )       =>{if(v!=='speaking_question'&&v!=='listening_session')throw Error('invalid relic battle');return v;};
export function projectRelicAttack(value        )                       {
 const v=object(value);if(v.profile!=='relic-attack-v1'||!Array.isArray(v.effects)||v.effects.length>2)throw Error('invalid relic battle');
 const effects=v.effects.map(value=>{const e=object(value);if(typeof e.id!=='string'||!/^[a-z][a-z0-9-]{0,79}$/.test(e.id)||(e.slot!=='treasure1'&&e.slot!=='treasure2'))throw Error('invalid relic battle');
 return {id:e.id,slot:e.slot,catalog_version:integer(e.catalog_version,2147483647,1),active:boolean(e.active),attack:integer(e.attack,1000)};});
 const result={profile:'relic-attack-v1',kind:kind(v.kind),rules_version:integer(v.rules_version,2147483647,1),attack_cap:integer(v.attack_cap,1000),raw_attack:integer(v.raw_attack,2000),attack_bonus:integer(v.attack_bonus,1000),damage_added:integer(v.damage_added,1000),effects};
 if(new Set(effects.map(e=>e.slot)).size!==effects.length||new Set(effects.map(e=>e.id)).size!==effects.length
 ||result.raw_attack!==effects.reduce((n,e)=>n+(e.active?e.attack:0),0)||result.attack_bonus!==Math.min(result.raw_attack,result.attack_cap)||result.damage_added>result.attack_bonus)throw Error('invalid relic battle');
 return result;
}
export function projectRelicBattleProfile(value        )                       {
 const v=object(value);if(!['relic-attack-v1','relic-progress-v1'].includes(String(v.profile))||v.guard_enabled!==false||(v.profile==='relic-attack-v1'&&(v.charge_enabled!==false||v.support_enabled!==false)))throw Error('invalid relic battle');
 return {profile:v.profile,attack_enabled:boolean(v.attack_enabled),guard_enabled:false,charge_enabled:boolean(v.charge_enabled),support_enabled:boolean(v.support_enabled)};
}
export function validateRelicAttackEvent(event                       ,expectedKind        )     {
 if(!Object.prototype.hasOwnProperty.call(event,'relic_attack'))return;
 const a=projectRelicAttack(event.relic_attack);
 const skill=event.skills?object(event.skills):null,teamwork=event.teamwork?object(event.teamwork):null;
 const damage=integer(event.damage,2172),other=Number(skill?.bonus_damage||0)+Number(teamwork?.bonus_damage||0);
 if((expectedKind&&a.kind!==expectedKind)||Number(a.damage_added)>damage-other)throw Error('invalid relic battle');
}
export function validateRelicBattleState(data                       )     {
 const events=data.events                            ;
 if(Object.prototype.hasOwnProperty.call(data,'relic_battle'))projectRelicBattleProfile(data.relic_battle);
 else if(events.some(e=>Object.prototype.hasOwnProperty.call(e,'relic_attack')))throw Error('invalid relic battle');
 for(const event of events)validateRelicAttackEvent(event,String(event.kind));
}

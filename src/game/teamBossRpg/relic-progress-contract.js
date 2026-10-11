// Exact immutable progress units; learning/settlement remains server authoritative.
const object=(v        )                       =>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('invalid relic progress');return v                          ;};
const integer=(v        ,max       ,min=0)       =>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)throw Error('invalid relic progress');return v;};
const boolean=(v        )        =>{if(typeof v!=='boolean')throw Error('invalid relic progress');return v;};
const bad=()      =>{throw Error('invalid relic progress');};
const key=(v        )        =>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const thresholds=(v                       )     =>{if(v.profile!=='relic-progress-v1'||v.unit!==100||v.skill_threshold!==300||v.team_threshold!==600)bad();};
export function projectRelicProgressRoot(value        )                       {
 const v=object(value);thresholds(v);
 return {profile:'relic-progress-v1',unit:100,skill_threshold:300,team_threshold:600,charge_enabled:boolean(v.charge_enabled),support_enabled:boolean(v.support_enabled),energy:integer(v.energy,600)};
}
export function projectRelicProgressMember(value        )                       {
 const v=object(value);return {charge:integer(v.charge,299),casts:integer(v.casts,1000000000000)};
}
export function projectRelicProgress(value        )                       {
 const v=object(value);thresholds(v);
 if(!['speaking_question','listening_session'].includes(String(v.kind))||!Array.isArray(v.effects)||v.effects.length>2)bad();
 const effects=(v.effects             ).map(value=>{const e=object(value);if(typeof e.id!=='string'||!/^[a-z][a-z0-9-]{0,79}$/.test(e.id)||!['treasure1','treasure2'].includes(String(e.slot)))bad();return {id:e.id,slot:e.slot,catalog_version:integer(e.catalog_version,2147483647,1),active:boolean(e.active),charge:integer(e.charge,1000),support:integer(e.support,1000)};});
 const r={profile:'relic-progress-v1',kind:v.kind,rules_version:integer(v.rules_version,2147483647,1),progress_version:integer(v.progress_version,2147483647,1),unit:100,skill_threshold:300,team_threshold:600,
 charge_cap:integer(v.charge_cap,100),support_cap:integer(v.support_cap,100),raw_charge:integer(v.raw_charge,2000),raw_support:integer(v.raw_support,2000),charge_bonus:integer(v.charge_bonus,100),support_bonus:integer(v.support_bonus,100),effects,
 charge_before:integer(v.charge_before,299),charge_after:integer(v.charge_after,299),charge_gained:integer(v.charge_gained,200,100),skill_triggered:boolean(v.skill_triggered),
 energy_before:integer(v.energy_before,600),energy_after:integer(v.energy_after,600),energy_requested:integer(v.energy_requested,200,100),energy_gained:integer(v.energy_gained,200),combo_triggered:boolean(v.combo_triggered)};
 if(new Set(effects.map(e=>e.id)).size!==effects.length||new Set(effects.map(e=>e.slot)).size!==effects.length
 ||r.raw_charge!==effects.reduce((sum,e)=>sum+(e.active?e.charge:0),0)||r.raw_support!==effects.reduce((sum,e)=>sum+(e.active?e.support:0),0)
 ||r.charge_bonus!==Math.min(r.raw_charge,r.charge_cap)||r.support_bonus!==Math.min(r.raw_support,r.support_cap)
 ||r.charge_gained!==100+r.charge_bonus||r.energy_requested!==100+r.support_bonus
 ||r.skill_triggered!==(r.charge_before+r.charge_gained>=300)||r.charge_after!==r.charge_before+r.charge_gained-(r.skill_triggered?300:0)
 ||(r.combo_triggered&&r.energy_before+r.energy_requested<600)
 ||r.energy_after!==(r.combo_triggered?r.energy_before+r.energy_requested-600:Math.min(600,r.energy_before+r.energy_requested))
 ||r.energy_gained!==r.energy_after-r.energy_before+(r.combo_triggered?600:0)||r.energy_gained>r.energy_requested)bad();
 return r;
}
export function validateRelicProgressEvent(event                       ,expectedKind        ,options={})     {
 const p=projectRelicProgress(event.relic_progress),s=object(event.skills),t=object(event.teamwork);
 // Class SQL can omit attack evidence while that capability is disabled; progress is independent.
 const attack=options.classRaid===true&&event.relic_attack===undefined?null:object(event.relic_attack),effects=p.effects                            ;
 if(attack&&(attack.kind!==p.kind||attack.rules_version!==p.rules_version||!Array.isArray(attack.effects)||attack.effects.length!==effects.length
 ||effects.some(e=>!(attack.effects             ).some(value=>{const a=object(value);return a.id===e.id&&a.slot===e.slot&&a.catalog_version===e.catalog_version;}))))bad();
 const character=s.character_id,triggered=p.skill_triggered,combo=p.combo_triggered,keys=t.participant_keys;
 const skillBonus=integer(s.bonus_damage,12),teamBonus=integer(t.bonus_damage,60),damage=integer(event.damage,2172,1);
 if((expectedKind&&p.kind!==expectedKind)||!['boy-knight','girl-knight','boy-mage','girl-mage'].includes(String(character))
 ||s.triggered!==triggered||s.charge_before!==Math.floor(Number(p.charge_before)/100)||s.charge_after!==Math.floor(Number(p.charge_after)/100)
 ||s.key!==(triggered?(String(character).endsWith('knight')?'moon-slash':'star-cast'):'none')||(!triggered&&skillBonus!==0)
 ||t.triggered!==combo||t.energy_before!==Math.floor(Number(p.energy_before)/100)||t.energy_after!==Math.floor(Number(p.energy_after)/100)
 ||!Array.isArray(keys)||keys.length>(options.classRaid===true?1000:5)||new Set(keys).size!==keys.length||keys.some(k=>options.classRaid===true?(typeof k!=='string'||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(k)):!key(k))
 ||(combo?(keys.length<2||teamBonus<=0):(keys.length!==0||teamBonus!==0))||skillBonus+teamBonus>damage)bad();
}
export function validateRelicProgressState(data                       )     {
 const events=data.events                            ,members=data.members                            ;
 if(data.relic_progress===undefined){if(events.some(e=>e.relic_progress!==undefined)||members.some(m=>m.relic_progress!==undefined)||(data.relic_battle                          )?.profile==='relic-progress-v1')bad();return;}
 const r=projectRelicProgressRoot(data.relic_progress),b=object(data.relic_battle),skills=object(data.skills),team=object(data.teamwork);
 if(b.profile!=='relic-progress-v1'||b.guard_enabled!==false||typeof b.attack_enabled!=='boolean'||b.charge_enabled!==r.charge_enabled||b.support_enabled!==r.support_enabled
 ||!data.boss_phase||skills.profile!=='book-dragon-skills-v1'||skills.threshold!==3
 ||team.profile!=='book-dragon-teamwork-v1'||team.threshold!==6||team.minimum_members!==2||team.energy!==Math.floor(Number(r.energy)/100))bad();
 integer(team.contributors,5);integer(team.combos,1000000000000);
 const states=new Map                                ();
 for(const m of members){const p=projectRelicProgressMember(m.relic_progress),s=object(m.skills);if(s.charge!==Math.floor(Number(p.charge)/100)||s.casts!==p.casts||Number(p.casts)>integer(m.sources,1000000000000))bad();states.set(m.member_key,p);}
 const lastByActor=new Map                                (),casts=new Map                ();let previous                                 ,combos=0;
 for(const e of events){validateRelicProgressEvent(e,String(e.kind));if(e.relic_attack===undefined)bad();const p=projectRelicProgress(e.relic_progress),before=e.member_key===null?undefined:lastByActor.get(e.member_key);
 if(previous&&previous.energy_after!==p.energy_before)bad();if(before&&before.charge_after!==p.charge_before)bad();
 if(e.member_key!==null){lastByActor.set(e.member_key,p);if(p.skill_triggered)casts.set(e.member_key,(casts.get(e.member_key)||0)+1);}if(p.combo_triggered)combos++;previous=p;
 }
 if(combos>Number(team.combos))bad();for(const [actor,n]of casts)if(n>Number(states.get(actor)?.casts))bad();
 const last=events[events.length-1];if(last&&last.id===data.latest_event_id){if(previous?.energy_after!==r.energy)bad();for(const [actor,p]of lastByActor)if(states.get(actor)?.charge!==p.charge_after)bad();}
}

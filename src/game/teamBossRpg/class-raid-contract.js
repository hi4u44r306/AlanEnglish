/* global BigInt */
// Paired browser/Edge contract: only original server settlements, never client math authority.
import {projectRelicAttack,validateRelicAttackEvent} from './relic-battle-contract.js';
import {projectRelicProgress,validateRelicProgressEvent} from './relic-progress-contract.js';
export const CLASS_RAID_ACTIONS=['class_raid_contribute','sync_class_raid_learning','claim_class_raid','publish_class_raid','set_class_raid_reward_window'];
export const CLASS_RAID_STAFF_ACTIONS=['publish_class_raid','set_class_raid_reward_window'];
const bad=()=>{throw Error('invalid class raid contract');};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:bad();
const exact=(v,keys)=>{const r=object(v);if(Object.keys(r).sort().join('|')!==keys.slice().sort().join('|'))bad();return r;};
const integer=(v,min=0,max=999999999999)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max?v:bad();
const bool=v=>typeof v==='boolean'?v:bad();
const literal=(v,allowed)=>allowed.includes(v)?v:bad();
const uuid=(v,v4=false)=>typeof v==='string'&&(v4?/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i:/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i).test(v)?v:bad();
const sourceUuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)?v:bad();
const time=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))bad();return new Date(v).toISOString();};
const asset=v=>typeof v==='string'&&/^[a-z0-9-]{1,80}$/.test(v)?v:bad();
const equal=(a,b)=>{if(a!==b)bad();};
const array=(v,max)=>Array.isArray(v)&&v.length<=max?v:bad();
function config(v){const r=exact(v,['profile','rules_version','hp_per_student','base_coins','bonus_per_student','bonus_cap','minimum_sources']);equal(r.profile,'class-raid-r2-candidate');equal(r.rules_version,1);integer(r.hp_per_student,1,1000000);integer(r.base_coins,1,500);integer(r.bonus_per_student,0,500);integer(r.bonus_cap,0,500);integer(r.minimum_sources,1,100);if(r.base_coins+r.bonus_cap>500)bad();return {...r};}
export function parseClassRaidRequest(v){
 const a=object(v).action;if(!CLASS_RAID_ACTIONS.includes(a))bad();
 const keys={class_raid_contribute:['action','activity_id','task_id','source','request_id'],sync_class_raid_learning:['action','activity_id','request_id'],claim_class_raid:['action','activity_id','request_id'],publish_class_raid:['action','activity_id','expected_version','team_version','config','grace_seconds','request_id'],set_class_raid_reward_window:['action','activity_id','expected_version','claim_until','request_id']};
 const r=exact(v,keys[a]),p={action:a,activity_id:integer(r.activity_id,1),request_id:uuid(r.request_id,true)};
 if(a==='class_raid_contribute'){p.task_id=integer(r.task_id,1);const s=object(r.source),kind=literal(s.kind,['speaking_question','listening_session']);exact(s,kind==='speaking_question'?['kind','session_id','question_id']:['kind','session_id']);p.source={kind,session_id:sourceUuid(s.session_id)};if(kind==='speaking_question')p.source.question_id=integer(s.question_id,1);}
 if(CLASS_RAID_STAFF_ACTIONS.includes(a))p.expected_version=integer(r.expected_version,1);
 if(a==='publish_class_raid'){p.team_version=integer(r.team_version,1);p.config=config(r.config);p.grace_seconds=integer(r.grace_seconds,0,604800);}
 if(a==='set_class_raid_reward_window'){time(r.claim_until);if(!r.claim_until.endsWith('Z')||new Date(r.claim_until).toISOString().slice(0,19)!==r.claim_until.slice(0,19))bad();p.claim_until=r.claim_until;}
 return p;
}
export function validClassRaidIntent(v){try{parseClassRaidRequest(v);return true;}catch{return false;}}
export function projectClassRaidEffects(v,kind){const r={};
 if(v.boss_phase!==undefined){const p=object(v.boss_phase);r.boss_phase={phase_before:literal(p.phase_before,['forest','guard','ink']),phase_after:literal(p.phase_after,['forest','guard','ink','victory']),move:literal(p.move,['none','page_guard','ink_counter','ink_guard','victory']),shield_absorbed:integer(p.shield_absorbed,0,1100)};}
 if(v.skills!==undefined){const s=object(v.skills);r.skills={character_id:literal(s.character_id,['boy-knight','girl-knight','boy-mage','girl-mage']),key:literal(s.key,['none','moon-slash','star-cast']),charge_before:integer(s.charge_before,0,2),charge_after:integer(s.charge_after,0,2),triggered:bool(s.triggered),bonus_damage:integer(s.bonus_damage,0,12)};equal(s.key,s.triggered?(s.character_id.endsWith('knight')?'moon-slash':'star-cast'):'none');if(!s.triggered&&s.bonus_damage!==0)bad();}
 if(v.teamwork!==undefined){const t=object(v.teamwork),keys=array(t.participant_keys,1000).map(k=>uuid(k));if(new Set(keys).size!==keys.length)bad();r.teamwork={energy_before:integer(t.energy_before,0,6),energy_after:integer(t.energy_after,0,6),triggered:bool(t.triggered),bonus_damage:integer(t.bonus_damage,0,60),participant_keys:keys};if(t.triggered?(keys.length<2||t.bonus_damage===0):(keys.length!==0||t.bonus_damage!==0))bad();}
 if(v.relic_attack!==undefined){r.relic_attack=projectRelicAttack(v.relic_attack);validateRelicAttackEvent({...v,...r},kind);}
 if(v.relic_progress!==undefined){r.relic_progress=projectRelicProgress(v.relic_progress);validateRelicProgressEvent({...v,...r},kind,{classRaid:true});}
 else {if(r.skills){equal(r.skills.charge_after,(r.skills.charge_before+1)%3);equal(r.skills.triggered,r.skills.charge_before===2);}if(r.teamwork){if(r.teamwork.triggered){if(r.teamwork.energy_before<5||r.teamwork.energy_after!==0)bad();}else equal(r.teamwork.energy_after,Math.min(6,r.teamwork.energy_before+1));}}
 if((r.skills?.bonus_damage||0)+(r.teamwork?.bonus_damage||0)>v.damage)bad();
 return r;
}
function contribution(v,activity,task,kind){const s=object(v);equal(s.mode,'class_raid');equal(s.activity_id,activity);if(task!==undefined)equal(s.task_id,task);
 const status=literal(s.status,['contributed','participated']),damage=integer(s.damage,0,1000000),hp=integer(s.hp,0,1000000),won=bool(s.won);if(won&&hp!==0)bad();
 const meta=object(s.class_raid);equal(meta.profile,'class-raid-r2-candidate');equal(meta.rules_version,1);equal(meta.valid_participation,true);equal(meta.damage,damage);equal(meta.participation_only,status==='participated');if(status==='participated'){if(damage!==0||meta.contribution_id!==null||['skills','teamwork','boss_phase','relic_attack','relic_progress'].some(k=>s[k]!==undefined))bad();}else {integer(meta.contribution_id,1);if(damage===0||won!==(hp===0))bad();}
 return {status,mode:'class_raid',activity_id:activity,task_id:integer(s.task_id,1),coins:integer(s.coins),balance:integer(s.balance),damage,hp,won,class_raid:{profile:meta.profile,rules_version:1,completed_at:time(meta.completed_at),valid_participation:true,damage,contribution_id:meta.contribution_id,participation_only:meta.participation_only},...projectClassRaidEffects(s,kind)};
}
function claim(v,activity){const s=object(v);equal(s.status,'claimed');equal(s.mode,'class_raid');equal(s.activity_id,activity);const a=object(s.class_raid_reward);
 equal(a.profile,'class-raid-r2-candidate');equal(a.rules_version,1);equal(a.eligible,true);equal(a.payout_committed,true);
 const r={profile:a.profile,rules_version:1,eligible:true,payout_committed:true,valid_sources:integer(a.valid_sources,1,1000000),damage:integer(a.damage,0,1000000),base_coins:integer(a.base_coins,1,500),bonus_coins:integer(a.bonus_coins,0,500),total_coins:integer(a.total_coins,1,500),participant_count:integer(a.participant_count,1,1000),bonus_pool:integer(a.bonus_pool,0,500000),bonus_cap:integer(a.bonus_cap,0,500),confirmed_damage:integer(a.confirmed_damage,1,1000000),claim_until:time(a.claim_until)};
 equal(r.total_coins,r.base_coins+r.bonus_coins);equal(s.coins,r.total_coins);if(r.damage>r.confirmed_damage)bad();equal(r.bonus_coins,Math.min(r.bonus_cap,Number(BigInt(r.bonus_pool)*BigInt(r.damage)/BigInt(r.confirmed_damage))));
 return {status:'claimed',mode:'class_raid',activity_id:activity,coins:r.total_coins,balance:integer(s.balance),badge_key:asset(s.badge_key),class_raid_reward:r};
}
export function projectClassRaidResult(request,value){const p=parseClassRaidRequest(request),s=object(value);equal(s.activity_id,p.activity_id);
 if(p.action==='class_raid_contribute')return contribution(s,p.activity_id,p.task_id,p.source.kind);
 if(p.action==='claim_class_raid')return claim(s,p.activity_id);
 if(p.action==='sync_class_raid_learning'){equal(s.status,'class_raid_learning_synced');equal(s.mode,'class_raid');const parts=array(s.results,20).map(r=>contribution(r,p.activity_id));const r={status:s.status,mode:'class_raid',activity_id:p.activity_id,settled_count:integer(s.settled_count,0,20),coins:integer(s.coins),damage:integer(s.damage,0,1000000),hp:integer(s.hp,0,1000000),balance:integer(s.balance),won:bool(s.won),blocked_content_count:integer(s.blocked_content_count,0,20),stop_reason:literal(s.stop_reason,['none','batch_limit','daily_source_limit','daily_coin_limit']),more_ready:bool(s.more_ready),results:parts};equal(r.settled_count,parts.length);equal(r.coins,parts.reduce((n,x)=>n+x.coins,0));equal(r.damage,parts.reduce((n,x)=>n+x.damage,0));equal(r.more_ready,r.stop_reason==='batch_limit');if(r.settled_count+r.blocked_content_count>20||(r.won&&r.hp!==0))bad();if(parts.length){const last=parts[parts.length-1];equal(last.hp,r.hp);equal(last.balance,r.balance);equal(last.won,r.won);for(let i=1;i<parts.length;i++){equal(parts[i].hp,parts[i-1].hp-parts[i].damage);equal(parts[i].balance,parts[i-1].balance+parts[i].coins);}}return r;}
 equal(s.version,p.expected_version+1);
 if(p.action==='set_class_raid_reward_window'){equal(s.status,'reward_window_saved');equal(Date.parse(time(s.claim_until)),Date.parse(p.claim_until));return {status:s.status,activity_id:p.activity_id,version:integer(s.version,1),claim_until:time(s.claim_until)};}
 equal(s.status,'active');equal(s.mode,'class_raid');if(s.team_version!==p.team_version&&s.team_version!==p.team_version+1)bad();const raid=object(s.raid),cfg=config(raid.config),roster=array(raid.roster,1000).map(x=>integer(x,1));if(!roster.length||new Set(roster).size!==roster.length||roster.some((x,i)=>i>0&&x<=roster[i-1]))bad();for(const k of Object.keys(cfg))equal(cfg[k],p.config[k]);const n=roster.length,hp=n*cfg.hp_per_student;integer(hp,1,1000000);equal(raid.participant_count,n);equal(raid.max_hp,hp);equal(raid.base_budget,n*cfg.base_coins);equal(raid.bonus_pool,n*cfg.bonus_per_student);equal(raid.maximum_reward_budget,raid.base_budget+raid.bonus_pool);equal(raid.grace_seconds,p.grace_seconds);
 return {status:s.status,mode:'class_raid',activity_id:p.activity_id,version:integer(s.version,1),team_version:integer(s.team_version,1),starts_at:time(s.starts_at),raid:{config:cfg,roster,participant_count:n,max_hp:hp,base_budget:raid.base_budget,bonus_pool:raid.bonus_pool,maximum_reward_budget:raid.maximum_reward_budget,grace_seconds:p.grace_seconds}};
}

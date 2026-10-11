// Encounter identity augments original class rules; never guesses a missing Boss.
import {parseClassRaidReadRequest,projectClassRaidRead} from './class-raid-read-contract.js';
import {parseClassRaidStaffRead,projectClassRaidStaffRead} from './class-raid-staff-read-contract.js';
export const CLASS_RAID_BOSS_IDS=Object.freeze(['moon-book-dragon','moss-stone-guardian','frost-nine-tail-fox','sunfire-lion','storm-griffin','ink-tide-kraken']);
export const CLASS_RAID_ENCOUNTER_ACTION='select_class_raid_boss';
const bad=()=>{throw Error('invalid class raid encounter');};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:bad();
const exact=(v,keys)=>{const r=object(v);if(Object.keys(r).sort().join('|')!==keys.slice().sort().join('|'))bad();return r;};
const int=(v,min=1,max=999999999999)=>Number.isSafeInteger(v)&&v>=min&&v<=max?v:bad();
const bool=v=>typeof v==='boolean'?v:bad();
const eq=(a,b)=>{if(a!==b)bad();};
export function parseClassRaidEncounterRequest(value){const v=exact(value,['action','activity_id','expected_version','boss_id','presentation_version','request_id']);
 eq(v.action,CLASS_RAID_ENCOUNTER_ACTION);eq(v.presentation_version,1);
 if(!CLASS_RAID_BOSS_IDS.includes(v.boss_id)||typeof v.request_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.request_id))bad();
 return {action:CLASS_RAID_ENCOUNTER_ACTION,activity_id:int(v.activity_id),expected_version:int(v.expected_version),boss_id:v.boss_id,presentation_version:1,request_id:v.request_id};
}
export const validClassRaidEncounterIntent=value=>{try{parseClassRaidEncounterRequest(value);return true;}catch{return false;}};
export function projectClassRaidEncounter(value,draft=false){const v=object(value);
 if(!CLASS_RAID_BOSS_IDS.includes(v.boss_id)||v.presentation_version!==1||v.mechanics_profile!=='book-dragon-phases-v1'
 ||!(draft?['draft_selection']:['teacher_selected','legacy_book_dragon']).includes(v.source)
 ||(v.source==='legacy_book_dragon'&&v.boss_id!=='moon-book-dragon'))bad();
 return {boss_id:v.boss_id,presentation_version:1,mechanics_profile:'book-dragon-phases-v1',source:v.source};
}
export function projectClassRaidEncounterResult(request,value){const p=parseClassRaidEncounterRequest(request),s=object(value),encounter=projectClassRaidEncounter(s.encounter,true);
 eq(s.activity_id,p.activity_id);eq(int(s.version,1,1000000000000),p.expected_version+1);eq(encounter.boss_id,p.boss_id);eq(encounter.presentation_version,p.presentation_version);
 return {activity_id:p.activity_id,version:s.version,encounter};
}
export function projectClassRaidEncounterRead(request,value){const p=parseClassRaidReadRequest(request),s=object(value),base=projectClassRaidRead(p,s);
 if(p.action==='class_raid_battle')return {...base,encounter:projectClassRaidEncounter(s.encounter)};
 return {...base,activities:base.activities.map((a,i)=>{eq(a.activity_id,s.activities[i].activity_id);return {...a,encounter:projectClassRaidEncounter(s.activities[i].encounter)};})};
}
export function projectClassRaidEncounterStaffRead(request,value){const p=parseClassRaidStaffRead(request),s=object(value),writes=object(s.writes);
 // The old projection checks original readiness. New readiness is stricter, so
 // validate its original inputs first, then independently require the Boss state.
 const ready=p.action==='class_raid_staff_preview'&&writes.publish===true&&s.team_status!=='archived'
 &&Date.parse(s.ends_at)>Math.max(Date.parse(s.checked_at),Date.parse(s.starts_at))&&s.window_state==='configured';
 const base=projectClassRaidStaffRead(p,{...s,publish_ready:ready}),enabled=bool(s.encounter_selection_enabled);let encounter;
 if(base.status==='draft')encounter=s.encounter===null?null:projectClassRaidEncounter(s.encounter,true);
 else if(base.mode==='class_raid')encounter=projectClassRaidEncounter(s.encounter);
 else {eq(s.encounter,null);encounter=null;}
 const publishReady=base.publish_ready&&(enabled?encounter?.source==='draft_selection':encounter===null);
 eq(bool(s.publish_ready),publishReady);
 return {...base,encounter,encounter_selection_enabled:enabled,publish_ready:publishReady};
}
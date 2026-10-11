import {validateRelicProgressState} from "./relic-progress-contract";
// Consistency checks after allowlisting; SQL remains authoritative.
export function validateTeamwork(data){
 if(data.relic_progress!==undefined){validateRelicProgressState(data);return;}
 const events=data.events,root=data.teamwork;
 const bad=()=>{throw Error("invalid teamwork response");};
 if(!root){if(events.some(e=>e.teamwork!==undefined))bad();return;}
 if(!data.boss_phase||root.profile!=="book-dragon-teamwork-v1"||root.threshold!==6||root.minimum_members!==2
 ||!Number.isSafeInteger(root.energy)||Number(root.energy)<0||Number(root.energy)>6
 ||!Number.isSafeInteger(root.contributors)||Number(root.contributors)<0||Number(root.contributors)>5
 ||!Number.isSafeInteger(root.combos)||Number(root.combos)<0)bad();
 for(const event of events){
  const t=event.teamwork;
  if(!t)bad();const item=t;
  const keys=item.participant_keys;
  if(!Array.isArray(keys)||keys.length>5||new Set(keys).size!==keys.length||keys.some(key=>typeof key!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))
  ||!Number.isInteger(item.energy_before)||Number(item.energy_before)<0||Number(item.energy_before)>6
  ||!Number.isInteger(item.energy_after)||Number(item.energy_after)<0||Number(item.energy_after)>6
  ||!Number.isInteger(item.bonus_damage)||Number(item.bonus_damage)<0||Number(item.bonus_damage)>60||Number(item.bonus_damage)>Number(event.damage)
  ||typeof item.triggered!=="boolean"
  ||(item.triggered?(Number(item.energy_before)<5||item.energy_after!==0||keys.length<2||Number(item.bonus_damage)<=0):(item.energy_after!==Math.min(6,Number(item.energy_before)+1)||keys.length!==0||item.bonus_damage!==0)))bad();
 }
 const last=events[events.length-1];
 if(last&&last.id===data.latest_event_id&&(last.teamwork).energy_after!==root.energy)bad();
 if(events.filter(e=>(e.teamwork).triggered===true).length>Number(root.combos))bad();
}

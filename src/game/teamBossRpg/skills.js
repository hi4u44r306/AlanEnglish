import {validateRelicProgressState} from "./relic-progress-contract";
export const CLASS_SKILLS={"moon-slash":{title:"月光斬",kind:"knight"},"star-cast":{title:"星光術",kind:"mage"}};
export function validateSkills(data){
 if(data.relic_progress!==undefined){validateRelicProgressState(data);return;}
 const events=data.events,members=data.members,root=data.skills;
 const bad=()=>{throw Error("invalid skill response");};
 if(!root){if(events.some(e=>e.skills!==undefined)||members.some(m=>m.skills!==undefined))bad();return;}
 if(!data.boss_phase||!data.teamwork||root.profile!=="book-dragon-skills-v1"||root.threshold!==3)bad();
 for(const member of members){
  const state=member.skills;
  if(!state||state.charge!==Number(member.sources)%3||state.casts!==Math.floor(Number(member.sources)/3))bad();
 }
 for(const event of events){
  const item=event.skills;if(!item)bad();const s=item;
  if(!["boy-knight","girl-knight","boy-mage","girl-mage"].includes(String(s.character_id))
  ||!Number.isInteger(s.charge_before)||Number(s.charge_before)<0||Number(s.charge_before)>2
  ||s.charge_after!==(Number(s.charge_before)+1)%3||s.triggered!==(s.charge_before===2)
  ||s.key!==(s.triggered?(String(s.character_id).endsWith("knight")?"moon-slash":"star-cast"):"none")
  ||!Number.isInteger(s.bonus_damage)||Number(s.bonus_damage)<0||Number(s.bonus_damage)>12
  ||(!s.triggered&&s.bonus_damage!==0)
  ||Number(s.bonus_damage)+Number((event.teamwork)?.bonus_damage||0)>Number(event.damage))bad();
 }
}

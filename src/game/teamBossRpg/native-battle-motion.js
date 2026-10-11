// Presentation only. Events have already been validated and settled by the battle reader.
const attack=[4,5,6,6,7,0],skill=[8,9,9,7],recoil=[10,10,11,7],victory=[12,13,13,14,15,0];
export function battleMotionPlan(event){
 const phases=[{kind:"attack",start:0,end:attack.length,frames:attack}];
 const add=(kind,frames)=>{const start=phases.at(-1).end;phases.push({kind,start,end:start+frames.length,frames});};
 if(event?.skills?.triggered)add("skill",skill);
 if(event?.teamwork?.triggered)add("combo",attack);
 if(event?.boss_phase?.move==="ink_counter")add("recoil",recoil);
 if(event?.won)add("victory",victory);
 return{phases,duration:phases.at(-1).end};
}
export function battleMotionBeat(event,step){
 if(!event||!Number.isInteger(step)||step<0)return null;
 const plan=battleMotionPlan(event),phase=plan.phases.find(p=>step>=p.start&&step<p.end);
 return phase?{kind:phase.kind,index:step-phase.start,frame:phase.frames[step-phase.start]}:null;
}
export function battlePresentedDamage(event,step){
 if(!event)return 0;
 const plan=battleMotionPlan(event),skill=plan.phases.find(p=>p.kind==="skill"),combo=plan.phases.find(p=>p.kind==="combo");
 return event.damage-(skill&&step<skill.start+1?event.skills.bonus_damage:0)-(combo&&step<combo.start+2?event.teamwork.bonus_damage:0);
}

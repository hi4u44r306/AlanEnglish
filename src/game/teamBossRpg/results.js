// Full settled totals supplied by the backend, never reconstructed from the last 50 events.
export function validateResults(data){
 const r=data.results;if(r===undefined)return;
 const n=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000000000,bad=()=>{throw Error("invalid results response");};
 if(!r||!["team_sources","team_damage","personal_sources","personal_damage","learning_coins","victory_coins","minimum_sources","reward_coins"].every(k=>n(r[k]))||!r.minimum_sources
 ||typeof r.claimed!=="boolean"||typeof r.badge_key!=="string"||!/^[a-z0-9-]{1,80}$/.test(r.badge_key))bad();
 const me=data.members.find(m=>m.is_me);
 const status=r.claimed?"claimed":data.status==="closed"?"closed":data.status!=="won"?"not_won":r.personal_sources<r.minimum_sources?"insufficient":"ready";
 if(r.claim_status!==status||(!r.claimed&&r.victory_coins!==0)||r.personal_sources!==me?.sources||r.personal_damage!==me?.damage
 ||r.personal_sources>r.team_sources||r.personal_damage>r.team_damage||r.team_damage!==data.max_hp-data.hp
 ||data.members.reduce((sum,m)=>sum+m.sources,0)>r.team_sources||data.members.reduce((sum,m)=>sum+m.damage,0)>r.team_damage)bad();
}

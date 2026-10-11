// Personal data is read separately from battle events; no receipt, XP or coin writes.
export const CLASS_RAID_PROFILE_ACTIONS=['class_raid_names','class_raid_profile'];
const invalid=()=>{throw Error('invalid class raid profile');};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:invalid();
const exact=(v,keys)=>{const r=object(v);if(Object.keys(r).sort().join('|')!==keys.slice().sort().join('|'))invalid();return r;};
const integer=(v,min=0,max=999999999999)=>Number.isSafeInteger(v)&&v>=min&&v<=max?v:invalid();
const boolean=v=>typeof v==='boolean'?v:invalid();
const key=v=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v)?v:invalid();
const text=(v,min,max)=>typeof v==='string'&&v.trim()===v&&[...v].length>=min&&[...v].length<=max&&![...v].some(c=>c.charCodeAt(0)<32||(c.charCodeAt(0)>=127&&c.charCodeAt(0)<=159))?v:invalid();
const same=(a,b)=>{if(a!==b)invalid();};
const nullable=(v,fn)=>v===null?null:fn(v);
const thresholds=[0,100,250,450,700,1000,1400,1900,2500,3200,4000,5000,6200,7600,9200,11000,13000,15200,17600,20200];
export function classRaidProfileLevel(xp){integer(xp,0,2147483647);return xp>=20200?20+Math.floor((xp-20200)/3000):thresholds.filter(x=>x<=xp).length;}
export function parseClassRaidProfileRequest(value){
 const action=object(value).action;
 if(action==='class_raid_names'){const r=exact(value,['action','activity_id','after_position']);return {action,activity_id:integer(r.activity_id,1),after_position:integer(r.after_position,0,1000)};}
 if(action==='class_raid_profile'){const r=exact(value,['action','activity_id','member_key']);return {action,activity_id:integer(r.activity_id,1),member_key:key(r.member_key)};}
 return invalid();
}
function member(value){
 const v=object(value),r={member_key:key(v.member_key),alias:text(v.alias,1,20),is_me:boolean(v.is_me),available:boolean(v.available),nickname:nullable(v.nickname,x=>text(x,2,20))};
 if(!/^同學 [1-9][0-9]{0,3}$/.test(r.alias)||(!r.available&&r.nickname!==null))invalid();return r;
}
export function projectClassRaidProfileRead(request,value){
 const p=parseClassRaidProfileRequest(request),v=object(value);
 same(v.mode,'class_raid');same(v.action,p.action);same(v.activity_id,p.activity_id);
 if(!['E1','E3','E5','E7'].includes(v.class_code))invalid();
 const root={mode:'class_raid',action:p.action,activity_id:p.activity_id,class_code:v.class_code};
 if(p.action==='class_raid_profile'){
  const r={...root,...member(v),real_name:nullable(v.real_name,x=>text(x,1,100)),stats:null,sources:integer(v.sources,0,1000000),damage:integer(v.damage,0,1000000)};
  same(r.member_key,p.member_key);
  if(v.stats!==null){const s=exact(v.stats,['total_xp','level']);r.stats={total_xp:integer(s.total_xp,0,2147483647),level:integer(s.level,1,1000000)};same(s.level,classRaidProfileLevel(s.total_xp));}
  if((!r.available&&(r.real_name!==null||r.stats!==null))||(r.damage>0&&r.sources===0))invalid();return r;
 }
 if(!Array.isArray(v.members)||v.members.length>50)invalid();
 const r={...root,members:v.members.map(x=>({...member(x),position:integer(x.position,1,1000)})),next_position:integer(v.next_position,0,1000),has_more:boolean(v.has_more),page_limit:integer(v.page_limit,50,50)};
 if(new Set(r.members.map(x=>x.member_key)).size!==r.members.length||r.members.filter(x=>x.is_me).length>1)invalid();
 r.members.forEach((m,i)=>{same(m.position,p.after_position+i+1);same(m.alias,'同學 '+m.position);});
 same(r.next_position,p.after_position+r.members.length);
 if(r.has_more&&r.members.length!==50)invalid();return r;
}

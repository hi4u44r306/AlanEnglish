// Integrated from preserved class-raid limb-math candidate (73c0e65f).
// Continuous presentation geometry; original art and settled events stay unchanged.
import {NATIVE_POSES} from './native-poses.mjs';
import {battleMotionPlan} from '../native-battle-motion.js';
const rad=Math.PI/180,add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mix=(a,b,t)=>a+(b-a)*t,rotate=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)];
const shoulders={'boy-knight':[[242,131],[164,139],[270,178],[139,207]],'boy-mage':[[242,132],[166,139],[264,178],[136,211]],'girl-knight':[[255,132],[176,135],[286,176],[148,202]],'girl-mage':[[256,132],[176,136],[275,174],[139,199]]};
export function armDefinition(id,offhand=false){const data=shoulders[id],mount=NATIVE_POSES[id]?.[0];if(!data||!mount)throw RangeError('UNKNOWN_LIMB_CHARACTER');const shoulder=data[offhand?1:0],elbow=data[offhand?3:2],wrist=mount.slice(offhand?2:0,offhand?4:2),v=sub(wrist,elbow),length=Math.hypot(...v),tip=add(wrist,v.map(n=>n/length*25));return{nodes:[shoulder,elbow,wrist,tip],widths:[21,19,22,24]};}
export function articulate(definition,angles){const[s,e,w,t]=definition.nodes,[upper,fore,hand]=[angles[0],angles[0]+angles[1],angles[0]+angles[1]+angles[2]].map(a=>a*rad),elbow=add(s,rotate(sub(e,s),upper)),wrist=add(elbow,rotate(sub(w,e),fore)),tip=add(wrist,rotate(sub(t,w),hand));return{nodes:[s,elbow,wrist,tip],widths:definition.widths,handRotation:hand,wrist};}
// Shared vertices and normals at elbow/wrist keep neighboring segments connected.
export function stripRows({nodes,widths},subdivisions=3){const directions=nodes.slice(1).map((p,i)=>{const v=sub(p,nodes[i]),l=Math.hypot(...v);return v.map(n=>n/l);}),normals=nodes.map((_,i)=>{const v=i===0?directions[0]:i===nodes.length-1?directions.at(-1):add(directions[i-1],directions[i]),l=Math.hypot(...v);return[-v[1]/l,v[0]/l];}),rows=[];for(let segment=0;segment<nodes.length-1;segment++)for(let step=0;step<subdivisions;step++){const t=step/subdivisions,c=nodes[segment].map((v,i)=>mix(v,nodes[segment+1][i],t)),n=normals[segment].map((v,i)=>mix(v,normals[segment+1][i],t)),width=mix(widths[segment],widths[segment+1],t);rows.push([add(c,n.map(v=>v*width)),sub(c,n.map(v=>v*width))]);}const last=nodes.at(-1),normal=normals.at(-1),width=widths.at(-1);rows.push([add(last,normal.map(v=>v*width)),sub(last,normal.map(v=>v*width))]);return rows;}
export function stripTriangles(rows){return rows.slice(1).flatMap((row,i)=>[[rows[i][0],rows[i][1],row[0]],[rows[i][1],row[1],row[0]]]);}
export function affineTriangle(source,target){const[a,b,c]=source,[u,v,w]=target,x=b[0]-a[0],y=b[1]-a[1],z=c[0]-a[0],q=c[1]-a[1],det=x*q-z*y;if(Math.abs(det)<.001)throw RangeError('DEGENERATE_LIMB_TRIANGLE');const dx=v[0]-u[0],dy=v[1]-u[1],ex=w[0]-u[0],ey=w[1]-u[1],m=[(dx*q-ex*y)/det,(dy*q-ey*y)/det,(ex*x-dx*z)/det,(ey*x-dy*z)/det];return[...m,u[0]-m[0]*a[0]-m[2]*a[1],u[1]-m[1]*a[0]-m[3]*a[1]];}
export function handMatrix(definition,pose){const a=pose.handRotation,c=Math.cos(a),s=Math.sin(a),w=definition.nodes[2],target=pose.wrist;return[c,s,-s,c,target[0]-c*w[0]+s*w[1],target[1]-s*w[0]-c*w[1]];}
const times=[0,.18,.44,.6,.82,1];
function curve(points,t){let i=times.findIndex((n,index)=>index>0&&t<=n)-1;if(i<0)i=times.length-2;const f=Math.max(0,Math.min(1,(t-times[i])/(times[i+1]-times[i]))),e=f*f*(3-2*f);return points[i].map((v,j)=>mix(v,points[i+1][j],e));}
export function limbSample(event,elapsed,id){if(!Number.isFinite(elapsed)||elapsed<0)throw RangeError('INVALID_LIMB_TIME');armDefinition(id);if(!event){const wave=Math.sin(elapsed/750);return{primary:[wave*.8,wave*1.5,wave*.6],secondary:[-wave*.6,wave*.7,0],cape:Math.sin(elapsed/950)*.6,kind:'idle'};}const phase=battleMotionPlan(event).phases.find(p=>elapsed>=p.start*180&&elapsed<p.end*180);if(!phase)return{primary:[0,0,0],secondary:[0,0,0],cape:0,kind:'rest'};const t=(elapsed-phase.start*180)/((phase.end-phase.start)*180),mage=id.endsWith('mage'),sword=[[0,0,0],[-16,-20,12],[-42,-45,52],[14,10,42],[6,4,14],[0,0,0]],cast=[[0,0,0],[-4,-10,14],[-16,-20,35],[-10,-12,22],[-4,-4,8],[0,0,0]],skill=[[0,0,0],[-8,-12,20],[-20,-35,56],[-14,-20,34],[-5,-6,11],[0,0,0]],cheer=[[0,0,0],[-14,-15,0],[-30,-32,60],[-30,-32,60],[-15,-15,0],[0,0,0]],recoil=[[0,0,0],[3,5,0],[8,12,-3],[4,6,0],[1,2,0],[0,0,0]],points=phase.kind==='victory'?cheer:phase.kind==='recoil'?recoil:phase.kind==='skill'?skill:mage?cast:sword,primary=curve(points,t),envelope=Math.sin(Math.PI*t)**2;return{primary,secondary:[envelope*(phase.kind==='skill'?12:5),envelope*(phase.kind==='skill'?18:8),-envelope*6],cape:Math.sin(Math.PI*2*t)*1.5,kind:phase.kind};}

// Select presentation participants only; never create a contribution or a new event.
export function memberLimbEvent(event,memberKey,elapsed){
 if(!event)return null;
 const phase=battleMotionPlan(event).phases.find(p=>elapsed>=p.start*180&&elapsed<p.end*180);
 if(!phase)return null;
 if(phase.kind==='victory')return event;
 if(phase.kind==='combo')return event.teamwork?.participant_keys?.includes(memberKey)?event:null;
 return event.member_key===memberKey?event:null;
}
export function limbRootOffset(event,elapsed,id){
 if(!event)return{ x:0,y:0,rotation:0 };
 const phase=battleMotionPlan(event).phases.find(p=>elapsed>=p.start*180&&elapsed<p.end*180);if(!phase)return{x:0,y:0,rotation:0};
 const t=(elapsed-phase.start*180)/((phase.end-phase.start)*180),ease=Math.sin(Math.PI*t)**2;
 return{ x:phase.kind==='recoil'?-5*ease:['attack','combo'].includes(phase.kind)?(id.endsWith('mage')?5:16)*ease:0,y:phase.kind==='victory'?-3*ease:0,rotation:phase.kind==='recoil'?-2*ease:0 };
}

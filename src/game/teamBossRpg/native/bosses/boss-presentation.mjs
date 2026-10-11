import {battleMotionPlan} from '../../native-battle-motion.js';
export const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function bossMesh(n=24){const vertices=Array.from({length:(n+1)**2},(_,i)=>[i%(n+1)*1280/n,Math.floor(i/(n+1))*1280/n]),triangles=[];for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=y*(n+1)+x,b=a+1,c=a+n+1,d=c+1;triangles.push([a,b,c],[b,d,c]);}return {vertices,triangles};}
const pulse=(t,a,b)=>t<=a||t>=b?0:Math.sin(Math.PI*ease((t-a)/(b-a)));
// Only already-settled events authorize a reaction. Non-counter attacks never invent a Boss attack.
export function bossPose(time,{event=null,motion=true,won=false,profile}){
 const rest=!motion,plan=event?battleMotionPlan(event):null,counter=plan?.phases.find(p=>p.kind==='recoil'),victory=plan?.phases.find(p=>p.kind==='victory');
 const impact=plan?.phases.filter(p=>['attack','skill','combo'].includes(p.kind)).map(p=>(p.start+(p.kind==='combo'?2:p.kind==='skill'?1:3))*180)||[];
 const hit=event&&!rest?Math.max(0,...impact.map(at=>pulse(time,at,at+330))):0;
 const charge=counter&&!rest?pulse(time,counter.start*180,counter.start*180+330):0,cast=counter&&!rest?pulse(time,counter.start*180+270,counter.end*180):0;
 const death=event?(victory?ease((time-victory.start*180)/650):0):(won?1:0);
 return {time:rest?0:time,rest,hit,charge,cast,death,profile,phase:death?'defeated':cast?'counter-cast':charge?'counter-charge':hit?'hit':rest?'rest':'idle'};
}
export function bossVertex(p,pose){
 const x=p[0]/1280,y=p[1]/1280,{profile,time,rest,death,hit,charge,cast}=pose;let dx=0,dy=0;
 for(const r of profile.regions){const weight=1-ease(Math.hypot((x-r.center[0])/r.radius[0],(y-r.center[1])/r.radius[1]));const idle=rest?0:Math.sin(time/(r.speed*1000)+r.phase)*r.amplitude;const angle=(idle-charge*r.amplitude*1.8+cast*r.amplitude*2.6+death*r.amplitude)*Math.PI/180,px=x-r.pivot[0],py=y-r.pivot[1];dx+=(px*Math.cos(angle)-py*Math.sin(angle)-px)*weight;dy+=(px*Math.sin(angle)+py*Math.cos(angle)-py)*weight;}
 const upper=1-ease((y-.76)/.22),planted=1-ease((y-.9)/.075),breath=rest?0:Math.sin(time/900)*.003;
 dx+=(hit*Math.sin(time/35)*.008+charge*.008-cast*.019)*upper;dy+=(breath-charge*.009+cast*.005)*upper+death*(.96-y)*.095;
 return [(x+dx*planted)*1280,(y+dy*planted)*1280];
}

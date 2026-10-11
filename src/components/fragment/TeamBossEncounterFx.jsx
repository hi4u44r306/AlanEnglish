import React,{useEffect,useRef} from 'react';
import {EXPANSION_PROFILES} from '../../game/teamBossRpg/native/bosses/expansion-profiles.mjs';
import {NATIVE_ITEMS} from '../../game/teamBossRpg/native/native-rig.mjs';
import {weaponEffect} from '../../game/teamBossRpg/native/bosses/boss-profiles.mjs';
import {battleMotionPlan} from '../../game/teamBossRpg/native-battle-motion';
import {drawBossAttack} from '../../game/teamBossRpg/native/bosses/encounter-effects.mjs';
const clamp=t=>Math.max(0,Math.min(1,t)),mix=(a,b,t)=>a+(b-a)*t;
function glow(ctx,color,width,draw){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.shadowColor=color;ctx.shadowBlur=width*2;ctx.beginPath();draw();ctx.stroke();ctx.shadowBlur=0;}
function sigil(ctx,p,target,r,time,color,alpha){ctx.save();ctx.globalAlpha=alpha;ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(target.y-p.y,target.x-p.x));ctx.scale(.38,1);ctx.rotate(time/550);for(const scale of [1,.76])glow(ctx,color,1.7,()=>ctx.ellipse(0,0,r*scale,r*scale,0,0,Math.PI*2));glow(ctx,'#fffce9',1,()=>{for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);ctx.lineTo(Math.cos(a+Math.PI*2/3)*r,Math.sin(a+Math.PI*2/3)*r);}});for(let i=0;i<12;i++){const a=i*Math.PI/6;glow(ctx,color,1,()=>{ctx.moveTo(Math.cos(a)*r*1.18,Math.sin(a)*r*1.18);ctx.lineTo(Math.cos(a+.09)*r*1.32,Math.sin(a+.09)*r*1.32);});}ctx.restore();}
function ray(ctx,a,b,progress,power,color){ctx.save();ctx.globalAlpha=power;ctx.globalCompositeOperation='lighter';for(const [w,c] of [[18,color],[7,color],[2.5,'#fffce9']])glow(ctx,c,w,()=>{ctx.moveTo(a.x,a.y);ctx.lineTo(mix(a.x,b.x,progress),mix(a.y,b.y,progress));});ctx.restore();}
function burst(ctx,p,t,color){ctx.save();ctx.globalAlpha=1-clamp(t);ctx.globalCompositeOperation='lighter';for(let i=0;i<18;i++){const a=i*2.399963,dist=12+clamp(t)*((i%5)*10+30),x=p.x+Math.cos(a)*dist,y=p.y+Math.sin(a)*dist;glow(ctx,i%3===0?'#fffde0':color,1.5,()=>{ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*7,y+Math.sin(a)*7);});}ctx.restore();}
// Decoration only: inputs are the same confirmed event/profile consumed by the native rigs.
export default function TeamBossEncounterFx({host,bossId,event,step,motion}){
 const canvas=useRef(null),input=useRef(null),clock=useRef({event:null,step:0,at:0});input.current={event,step,motion};
 useEffect(()=>{
  const arena=host.current,surface=canvas.current,profile=EXPANSION_PROFILES.find(p=>p.id===bossId);if(!arena||!surface||!profile)return undefined;
  const ctx=surface.getContext('2d');if(!ctx){surface.dataset.fxPhase='unavailable';return undefined;}
  arena.dataset.fxReady='true';let frame=null,trailEvent=null;const trails=new Map();const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const clear=()=>{ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,surface.width,surface.height);surface.dataset.fxPhase='none';};
  const tick=now=>{
   const value=input.current;if(trailEvent!==value.event){trails.clear();trailEvent=value.event;}clear();if(!value.motion||document.hidden||media?.matches)return;
   const box=arena.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,1.5);if(surface.width!==Math.round(box.width*ratio)||surface.height!==Math.round(box.height*ratio)){surface.width=Math.round(box.width*ratio);surface.height=Math.round(box.height*ratio);}ctx.setTransform(ratio,0,0,ratio,0,0);
   if(clock.current.event!==value.event||clock.current.step!==value.step)clock.current={event:value.event,step:value.step,at:now};
   const elapsed=value.step*180+Math.min(179.999,Math.max(0,now-clock.current.at)),plan=value.event?battleMotionPlan(value.event):null,beat=plan?.phases.find(p=>elapsed>=p.start*180&&elapsed<p.end*180),boss=arena.querySelector('.tb-encounter-art');
   if(beat&&boss){
    const b=boss.getBoundingClientRect(),point=anchor=>({x:b.x-box.x+b.width*anchor[0],y:b.y-box.y+b.height*anchor[1]}),target=point(profile.hit),mouth=point(profile.mouth),local=elapsed-beat.start*180;
    const fighters=[...arena.querySelectorAll('.tb-native-fighter')],actor=fighters.find(f=>f.dataset.memberKey===value.event.member_key),actors=beat.kind==='combo'?fighters.filter(f=>value.event.teamwork?.participant_keys?.includes(f.dataset.memberKey)):actor?[actor]:[];
    surface.dataset.fxEvent=String(value.event.id);surface.dataset.bossEffect=profile.effect;surface.dataset.fxPhase=beat.kind;
    if(['attack','skill','combo'].includes(beat.kind))for(const fighter of actors){
     const weapon=fighter.querySelector('[data-native-slot="weapon"]'),item=NATIVE_ITEMS.find(i=>i.id===weapon?.dataset.nativeItem),matrix=weapon?.getScreenCTM?.();if(!item||!matrix)continue;
     const tip=new DOMPoint(item.grip[0],item.grip[1]-item.gripToTip).matrixTransform(matrix),a={x:tip.x-box.x,y:tip.y-box.y},magic=weaponEffect(item.id)==='magic',fire=beat.kind==='attack'?360:beat.kind==='skill'?180:360,impact=beat.kind==='attack'?540:fire,color=item.id==='sun-wand'?'#ffc769':magic?'#8ce7ff':'#ffe5a3';
     surface.dataset.weaponTip=a.x.toFixed(3)+' '+a.y.toFixed(3);surface.dataset.fxTarget=target.x.toFixed(3)+' '+target.y.toFixed(3);surface.dataset.fxPhase=magic?(local<fire?'magic-sigil':'magic-ray'):'blade-slash';
     const alpha=local<fire?clamp(local/120):1-clamp((local-impact)/180);
     if(magic&&local<impact+180){sigil(ctx,a,target,Math.min(36,box.width*.065),elapsed,color,alpha);if(local>=fire)ray(ctx,a,target,clamp((local-fire)/90),alpha,color);}
     if(!magic){const key=value.event.id+':'+beat.kind+':'+fighter.dataset.memberKey;const trail=[...(trails.get(key)||[]),{...a,time:elapsed}].filter(p=>elapsed-p.time<180).slice(-14);trails.set(key,trail);if(local>=fire-80&&local<impact+180){ctx.save();ctx.globalAlpha=alpha;ctx.globalCompositeOperation='lighter';for(const [w,c]of[[10,color],[3,'#fffdeb']])glow(ctx,c,w,()=>trail.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)));const t=clamp((local-fire)/Math.max(90,impact-fire)),p={x:mix(a.x,target.x,t),y:mix(a.y,target.y,t)};ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(target.y-a.y,target.x-a.x));glow(ctx,color,4,()=>ctx.arc(-18,0,30,-Math.PI/2,Math.PI/2));glow(ctx,'#fffce4',1.4,()=>ctx.arc(-18,0,24,-Math.PI/2,Math.PI/2));ctx.restore();}}
     if(local>=impact&&local<impact+240)burst(ctx,target,(local-impact)/240,color);
    }
    if(beat.kind==='recoil'&&value.event.boss_phase?.move==='ink_counter'&&actor){const a=actor.querySelector('.tb-native-art')?.getBoundingClientRect();if(a){const victim={x:a.x-box.x+a.width*.48,y:a.y-box.y+a.height*.58};drawBossAttack(ctx,mouth,victim,local,{...profile,attack:{chargeStart:0,fireStart:180,end:(beat.end-beat.start)*180}});surface.dataset.fxPhase=local<180?'boss-charge':'boss-'+profile.effect;surface.dataset.fxTarget=victim.x.toFixed(3)+' '+victim.y.toFixed(3);}}
    if(beat.kind==='victory'&&local<600){burst(ctx,target,local/600,profile.palette.beam);surface.dataset.fxPhase='boss-defeat';}
   }
   frame=requestAnimationFrame(tick);
  };
  const restart=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;clear();if(input.current.motion&&!document.hidden&&!media?.matches)frame=requestAnimationFrame(tick);};
  document.addEventListener('visibilitychange',restart);media?.addEventListener('change',restart);restart();
  return()=>{if(frame!==null)cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',restart);media?.removeEventListener('change',restart);clear();delete arena.dataset.fxReady;};
 },[host,bossId,motion]);
 return <canvas ref={canvas} className='tb-encounter-fx' data-boss-profile={bossId} aria-hidden='true'/>;
}

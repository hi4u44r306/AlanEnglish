import React,{useLayoutEffect,useMemo,useRef,useEffect}from'react';
import{nativeArt}from'../../game/teamBossRpg/native/native-rig.mjs';
import{nativeSkillMarkup}from'../../game/teamBossRpg/native/native-skill-fx.mjs';
import{BODY_POSES}from'../../game/teamBossRpg/native/native-body-poses.mjs';
import{armDefinition,articulate,stripRows,stripTriangles,affineTriangle,handMatrix,limbSample,memberLimbEvent,limbRootOffset}from'../../game/teamBossRpg/native/native-limb-motion.mjs';
const ns='http://www.w3.org/2000/svg',element=(name,attrs={})=>{const node=document.createElementNS(ns,name);for(const[k,v]of Object.entries(attrs))node.setAttribute(k,v);return node;},points=rows=>rows.flat().map(p=>p.join(',')).join(' '),matrix=values=>'matrix('+values.map(v=>v.toFixed(6)).join(' ')+')';
function installRig(markup,character,loadout){
 const template=document.createElement('template');template.innerHTML=markup;const svg=template.content.firstElementChild,defs=svg.querySelector('defs'),prefix=defs.firstElementChild.id+'-limb',source=element('g',{id:prefix+'-source'}),children=[...svg.children].filter(n=>n!==defs),cape=children.find(n=>n.dataset.nativeSlot==='cape'),weapon=children.find(n=>n.dataset.nativeSlot==='weapon'),shield=children.find(n=>n.dataset.nativeSlot==='shield'),fingers=children.find(n=>n.dataset.nativeLayer==='gripping-hand');
 children.forEach(n=>source.append(n));for(const node of[cape,weapon,shield,fingers])node?.remove();defs.append(source);
 const mask=element('mask',{id:prefix+'-core',maskUnits:'userSpaceOnUse',x:-120,y:-210,width:800,height:710});mask.append(element('rect',{x:-120,y:-210,width:800,height:710,fill:'white'}));defs.append(mask);
 if(cape)svg.append(cape);svg.append(element('use',{href:'#'+source.id,mask:'url(#'+mask.id+')'}));
 const hands=[element('g',{'data-limb-hand':'primary'}),element('g',{'data-limb-hand':'secondary'})],arms=[];
 for(const[side,offhand]of[[0,false],[1,true]]){const definition=armDefinition(character,offhand),rows=stripRows(definition),triangles=stripTriangles(rows),outline=[...rows.map(r=>r[0]),...rows.toReversed().map(r=>r[1])];mask.append(element('polygon',{points:outline.map(p=>p.join(',')).join(' '),fill:'black'}));const groups=[];
  for(const[t,triangle]of triangles.entries()){const clip=element('clipPath',{id:prefix+'-'+side+'-'+t}),center=[0,1].map(i=>triangle.reduce((n,p)=>n+p[i],0)/3),expanded=triangle.map(p=>p.map((v,i)=>v+(v-center[i])*.007));clip.append(element('polygon',{points:points([expanded])}));defs.append(clip);const group=element('g',{'data-limb-segment':side+'-'+t}),clipped=element('g',{'clip-path':'url(#'+clip.id+')'});clipped.append(element('use',{href:'#'+source.id}));group.append(clipped);svg.append(group);groups.push(group);}
  const capClip=element('clipPath',{id:prefix+'-shoulder-'+side});capClip.append(element('circle',{cx:definition.nodes[0][0],cy:definition.nodes[0][1],r:21}));defs.append(capClip);svg.append(element('use',{href:'#'+source.id,'clip-path':'url(#'+capClip.id+')'}));arms.push({definition,triangles,groups});
 }
 if(shield)hands[1].append(shield);if(weapon)hands[0].append(weapon);if(fingers)hands[0].append(fingers);const fx=element('g',{'data-limb-fx':'true'});hands[0].append(fx);svg.append(...hands);svg.dataset.limbRig='articulated';svg.dataset.sourcePose='0';let last;
 svg.__limbRig=(event,elapsed,rest=false)=>{const sample=rest?{primary:[0,0,0],secondary:[0,0,0],cape:0,kind:'rest'}:limbSample(event,elapsed,character);for(const[side,arm]of arms.entries()){const angles=side?sample.secondary:sample.primary,pose=articulate(arm.definition,angles),targets=stripTriangles(stripRows(pose));arm.groups.forEach((node,i)=>node.setAttribute('transform',matrix(affineTriangle(arm.triangles[i],targets[i]))));hands[side].setAttribute('transform',matrix(handMatrix(arm.definition,pose)));hands[side].dataset.wrist=pose.wrist.map(v=>v.toFixed(3)).join(' ');hands[side].dataset.angles=angles.map(v=>v.toFixed(3)).join(' ');const item=side?shield:weapon;if(item){item.dataset.mountX=pose.wrist[0].toFixed(3);item.dataset.mountY=pose.wrist[1].toFixed(3);}if(!side)last=pose;}
  if(cape)cape.setAttribute('transform','rotate('+sample.cape.toFixed(3)+' '+BODY_POSES[character][0][0]+' '+BODY_POSES[character][0][1]+')');svg.dataset.limbTime=elapsed.toFixed(1);svg.dataset.limbKind=sample.kind;return last;
 };
 svg.__limbEffect=effect=>{fx.innerHTML=nativeSkillMarkup(character,0,loadout,effect);};svg.__limbRig(null,0,true);return svg;
}
export default function TeamBossContinuousArt({character,loadout={},frame=0,effect,className='',event=null,step=0,memberKey='',motion=false}){
 const clock=useRef({event:null,step:0,at:0}),inputs=useRef(null);
 inputs.current={character,event,step,memberKey,motion};
 const host=useRef(null),bits=JSON.stringify(loadout),effectBits=JSON.stringify(effect||null),markup=useMemo(()=>nativeArt(character,0,JSON.parse(bits),null,{camera:'battle'}),[character,bits]);
 useLayoutEffect(()=>{const svg=installRig(markup,character,JSON.parse(bits));host.current.replaceChildren(svg);return()=>{delete svg.__limbRig;delete svg.__limbEffect;};},[markup,character,bits]);
 useLayoutEffect(()=>{const svg=host.current.querySelector('.native-sprite');if(svg){svg.dataset.frame=frame;svg.__limbEffect?.(JSON.parse(effectBits));}},[markup,frame,effectBits]);
 useEffect(()=>{
  let raf=null;const root=host.current;const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const draw=now=>{const input=inputs.current,svg=root?.querySelector('.native-sprite');if(!svg)return;
   const stopped=!input.motion||document.hidden||media?.matches;
   if(clock.current.event!==input.event||clock.current.step!==input.step){clock.current={event:input.event,step:input.step,at:now};}
   const elapsed=input.event?input.step*180+Math.min(179.999,Math.max(0,now-clock.current.at)):now;
   const action=memberLimbEvent(input.event,input.memberKey,elapsed);
   svg.__limbRig?.(action,elapsed,stopped);const offset=stopped?{x:0,y:0,rotation:0}:limbRootOffset(action,elapsed,input.character);
   root.style.transform='translate('+offset.x.toFixed(3)+'px,'+offset.y.toFixed(3)+'px) rotate('+offset.rotation.toFixed(3)+'deg)';
   if(!stopped)raf=requestAnimationFrame(draw);
  };
  draw(performance.now());return()=>{if(raf!==null)cancelAnimationFrame(raf);root.style.transform='';};
 },[markup,motion]);
 return <div ref={host} className={'tb-native-art tb-continuous-art '+className} aria-hidden="true"/>;
}

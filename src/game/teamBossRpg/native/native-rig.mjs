import {ACTION_ASSETS} from "./native-action-assets.js";
import {ACTION_POSES} from "./native-action-data.mjs";
import {ACTION_EQUIPMENT_CLIPS} from "./native-equipment-clips.mjs";
import {nativeSkillMarkup} from "./native-skill-fx.mjs";
import {NATIVE_ASSETS} from "./native-assets.js";
import {NATIVE_POSES,REAR_SHIELD_POSES} from "./native-poses.mjs";
import {NATIVE_ITEMS} from "./native-catalog.mjs";
import {ITEM_BOUNDS} from "./native-fit-data.mjs";
import {BASE_BOOT_MASKS,HEAD_WEAR_FIT,BOOT_COMPONENT_CLIPS} from "./native-wear-fit.mjs";
import {BODY_POSES,CAPE_NECKS,FRONT_ARMS} from "./native-body-poses.mjs";
import {BOOT_SOURCE_MOUNTS,BOOT_TARGET_MOUNTS} from "./native-boot-mounts.mjs";
export {NATIVE_ITEMS,NATIVE_SLOTS} from "./native-catalog.mjs";
export const NATIVE_CHARACTERS=Object.freeze([
 {id:"boy-knight",name:"月冠劍士",gender:"男生",src:"/boy-knight-base-v5.png"},
 {id:"boy-mage",name:"森語法師",gender:"男生",src:"/boy-mage-base-v5.png"},
 {id:"girl-knight",name:"月光劍士",gender:"女生",src:"/girl-knight-base-v5.png"},
 {id:"girl-mage",name:"森光法師",gender:"女生",src:"/girl-mage-base-v5.png"}
].map(character=>Object.freeze({...character,src:NATIVE_ASSETS[character.src],actionsSrc:ACTION_ASSETS[character.id]})));
let sequence=0;
const rawImage=i=>'<image href="'+i.src+'" width="'+i.width+'" height="'+i.height+'"/>';
export function nativeThumbnail(item){
 const b=item.atlas?ITEM_BOUNDS[item.id][0].box:ITEM_BOUNDS[item.id];
 return '<svg viewBox="'+[b.x-12,b.y-12,b.w+24,b.h+24].join(" ")+'" role="img" aria-label="'+item.name+'">'+rawImage(item)+'</svg>';
}
export function nativeArt(id,frame=0,loadout={},effect,{camera}={}){
 const character=NATIVE_CHARACTERS.find(c=>c.id===id);
 if(!character||!Number.isInteger(frame)||frame<0||frame>15)throw RangeError("Unknown native pose");
 if(camera!==undefined&&!["classic","actions","battle"].includes(camera))throw RangeError("Unknown native camera");
 const action=frame>=8?ACTION_POSES[id][frame-8]:null,localFrame=action?frame-8:frame,equipmentFrame=action?.equipmentFrame??frame;
 const [gx,gy,ox,oy,angle]=action?.mount||NATIVE_POSES[id][frame],prefix="native-"+(++sequence),x=-(localFrame%4)*443.5,y=-Math.floor(localFrame/4)*443.5;
 const [nx,ny,wx,wy,hx,hy]=action?.body||BODY_POSES[id][frame];
 const image=()=>{
  const pixels='<image href="'+(action?character.actionsSrc:character.src)+'" x="'+x+'" y="'+y+'" width="1774" height="887"/>';
  // Every restored arm/finger uses this pose silhouette and cell, never a neighboring pose.
  return action?'<g clip-path="url(#'+prefix+'-cell)"><g clip-path="url(#'+prefix+'-body)">'+pixels+'</g></g>':pixels;
 };
 const items=Object.fromEntries(NATIVE_ITEMS.filter(i=>loadout[i.slot]===i.id).map(i=>[i.slot,i]));
 const slot=(item,contents,extra="")=>'<g data-native-slot="'+item.slot+'" data-native-item="'+item.id+'" '+extra+'>'+contents+'</g>';
 const atlasClips=new Set();
 const atlas=item=>{
  let pixels='<image href="'+item.src+'" x="'+(-(equipmentFrame%4)*443.5)+'" y="'+(-Math.floor(equipmentFrame/4)*443.5)+'" width="1774" height="887"/>';
  if(ACTION_EQUIPMENT_CLIPS[item.id]){
   const clip=prefix+"-atlas-"+item.id;
   if(!atlasClips.has(clip)){defs+='<clipPath id="'+clip+'"><path d="'+ACTION_EQUIPMENT_CLIPS[item.id][equipmentFrame]+'"/></clipPath>';atlasClips.add(clip);}
   pixels='<g clip-path="url(#'+clip+')">'+pixels+'</g>';
  }
  return '<svg aria-hidden="true" width="443.5" height="443.5" viewBox="0 0 443.5 443.5" overflow="hidden">'+pixels+'</svg>';
 };
 const weapon=items.weapon,shield=items.shield;
 const held=weapon?slot(weapon,rawImage(weapon),'data-mount-x="'+gx+'" data-mount-y="'+gy+'" transform="translate('+gx+' '+gy+') rotate('+angle+') scale('+(weapon.length/weapon.gripToTip)+') translate('+(-weapon.grip[0])+' '+(-weapon.grip[1])+')"'):"";
 const offhand=shield?slot(shield,rawImage(shield),'data-mount-x="'+ox+'" data-mount-y="'+oy+'" data-depth="'+(REAR_SHIELD_POSES[id].includes(frame)?"rear":"front")+'" transform="translate('+ox+' '+oy+') rotate(-12) scale('+shield.scale+') translate('+(-shield.grip[0])+' '+(-shield.grip[1])+')"'):"";
 const behind=REAR_SHIELD_POSES[id].includes(frame);
 let cape="",collar="",armor="",boots="",head="",defs="";
 if(items.cape){
  const c=items.cape,[cx,cy]=CAPE_NECKS[c.id][equipmentFrame],scale=.68;
  const cloth='<g transform="translate('+nx+' '+(ny+2)+') scale('+scale+') translate('+(-cx)+' '+(-cy)+')">'+atlas(c)+'</g>';
  cape=slot(c,cloth,'data-depth="rear"');
  // Restore only the actual clasp, not the fabric covering the chest or shoulders.
  defs+='<clipPath id="'+prefix+'-collar"><ellipse cx="'+nx+'" cy="'+(ny+23)+'" rx="31" ry="11"/></clipPath>';
  collar='<g data-native-layer="cape-collar" clip-path="url(#'+prefix+'-collar)">'+cloth+'</g>';
 }
 if(items.armor){
  const a=items.armor,b=ITEM_BOUNDS[a.id][equipmentFrame].box,height=wy-ny+7,scale=height/b.h,center=b.x+b.w*.53;
  const lean=Math.atan2(wx-nx,wy-ny)*180/Math.PI;
  armor=slot(a,atlas(a),'data-mount-x="'+nx+'" data-mount-y="'+ny+'" transform="translate('+nx+' '+ny+') rotate('+(-lean*.3)+') scale('+scale+') translate('+(-center)+' '+(-b.y)+')"');
 }
 if(items.boots){
  const b=items.boots;let content="";
  defs+='<mask id="'+prefix+'-shoes" maskUnits="userSpaceOnUse" x="0" y="0" width="443.5" height="443.5"><rect width="443.5" height="443.5" fill="white"/><path d="'+(action?.shoeMask||BASE_BOOT_MASKS[id][frame])+'" fill="black"/></mask>';
  ITEM_BOUNDS[b.id][equipmentFrame].feet.forEach((_,index)=>{
   const [cuff,sole]=BOOT_SOURCE_MOUNTS[b.id][equipmentFrame][index],targets=action?.bootTargets[index]||BOOT_TARGET_MOUNTS[id][frame][index];
   const sv=[sole[0]-cuff[0],sole[1]-cuff[1]],tv=[targets[1][0]-targets[0][0],targets[1][1]-targets[0][1]],length=sv[0]*sv[0]+sv[1]*sv[1];
   const a=(tv[0]*sv[0]+tv[1]*sv[1])/length,d=(tv[1]*sv[0]-tv[0]*sv[1])/length,tx=targets[0][0]-a*cuff[0]+d*cuff[1],ty=targets[0][1]-d*cuff[0]-a*cuff[1];
   const clip=prefix+"-boot-"+index;
   defs+='<clipPath id="'+clip+'"><path d="'+BOOT_COMPONENT_CLIPS[b.id][equipmentFrame][index]+'"/></clipPath>';
   content+='<g data-native-foot="'+index+'" data-cuff="'+targets[0].join(" ")+'" data-sole="'+targets[1].join(" ")+'" transform="matrix('+[a,d,-d,a,tx,ty].join(" ")+')"><g clip-path="url(#'+clip+')">'+atlas(b)+'</g></g>';
  });boots=slot(b,content);
 }
 if(items.head){
  const h=items.head,fit=HEAD_WEAR_FIT[h.id],headY=hy+fit.drop,transform='transform="translate('+hx+' '+headY+') scale('+(h.scale*fit.scale)+') translate('+(-h.grip[0])+' '+(-h.grip[1])+')"';
  head=slot(h,rawImage(h),'data-mount-x="'+hx+'" data-mount-y="'+headY+'" '+transform);
 }
 const arm=items.armor&&(action?.frontArms||FRONT_ARMS[id][frame]);
 if(arm)defs+='<clipPath id="'+prefix+'-arm">'+(Array.isArray(arm)?arm:[arm]).map(points=>'<polygon points="'+points+'"/>').join("")+'</clipPath>';
 const foregroundArm=arm?'<g data-native-layer="front-arm" clip-path="url(#'+prefix+'-arm)">'+image()+'</g>':"";
 if(action&&shield)defs+='<clipPath id="'+prefix+'-offhand"><ellipse cx="'+ox+'" cy="'+oy+'" rx="18" ry="16"/></clipPath>';
 const shieldFingers=action&&shield?'<g data-native-layer="shield-hand" clip-path="url(#'+prefix+'-offhand)">'+image()+'</g>':"";
 const fingers=weapon?'<g data-native-layer="gripping-hand" clip-path="url(#'+prefix+'-hand)">'+image()+'</g>':"";
 return '<svg class="native-sprite" data-character="'+id+'" data-frame="'+frame+'" viewBox="'+(camera==="battle"?"-90 -210 700 695":camera==="actions"||action?"-110 -210 780 695":"-90 -120 700 605")+'" role="img" aria-label="'+character.name+'十八件換裝候選"><defs><clipPath id="'+prefix+'-body">'+(action?'<path d="'+action.bodyClip+'"/>':'<rect width="443.5" height="443.5"/>')+'</clipPath>'+(action?'<clipPath id="'+prefix+'-cell"><rect width="443.5" height="443.5"/></clipPath>':'')+'<clipPath id="'+prefix+'-hand"><ellipse cx="'+gx+'" cy="'+gy+'" rx="22" ry="19"/></clipPath>'+defs+'</defs>'+cape+(behind?offhand:'')+'<g data-native-layer="base" clip-path="url(#'+prefix+'-body)"'+(items.boots?' mask="url(#'+prefix+'-shoes)"':'')+'>'+image()+'</g>'+boots+armor+collar+foregroundArm+head+(!action&&behind?'':offhand)+shieldFingers+held+fingers+nativeSkillMarkup(id,frame,loadout,effect)+'</svg>';
}

import {ACTION_POSES} from "./native-action-data.mjs";
import {NATIVE_POSES} from "./native-poses.mjs";
import {NATIVE_ITEMS} from "./native-catalog.mjs";
// The exact same vertical item axis and length used by the held weapon transform.
export function skillMount(character,frame,loadout={}){
 const row=frame>=8?ACTION_POSES[character]?.[frame-8]?.mount:NATIVE_POSES[character]?.[frame];if(!row)throw RangeError("Unknown skill mount pose");
 const [x,y,,,angle]=row,weapon=NATIVE_ITEMS.find(item=>item.slot==="weapon"&&item.id===loadout.weapon);
 const radians=angle*Math.PI/180,length=weapon?.length||0;
 return{x:x+Math.sin(radians)*length,y:y-Math.cos(radians)*length,weapon:weapon?.id||null};
}
export function nativeSkillMarkup(character,frame,loadout={},effect){
 if(!effect||!["moon-slash","star-cast"].includes(effect.key))return"";
 if(!Number.isInteger(effect.beat)||effect.beat<1||effect.beat>3)throw RangeError("Unknown skill effect beat");
 const mount=skillMount(character,frame,loadout),beat=effect.beat;
 const contents=effect.key==="moon-slash"?
 '<path d="M-28 -95 Q145 0 -28 95" fill="none" stroke="#d5ad53" stroke-width="'+(beat===1?4:11)+'"/><path d="M-22 -82 Q124 0 -22 82" fill="none" stroke="#fff4c6" stroke-width="4"/>':
 '<circle r="'+(beat===1?15:25)+'" fill="#bce9ff88" stroke="#86bce0" stroke-width="3"/><circle r="'+(beat===1?26:42)+'" fill="none" stroke="#bdb0e4" stroke-width="3"/><path d="M-10 0 H10 M0 -10 V10 M22 0 Q70 -16 108 0" fill="none" stroke="#eff9ff" stroke-width="5"/>';
 return '<g class="native-skill-fx" data-skill="'+effect.key+'" data-skill-beat="'+beat+'" data-skill-origin-x="'+mount.x+'" data-skill-origin-y="'+mount.y+'" transform="translate('+mount.x+' '+mount.y+')" opacity="'+(beat===1?.55:beat===3?.75:1)+'" pointer-events="none">'+contents+'</g>';
}

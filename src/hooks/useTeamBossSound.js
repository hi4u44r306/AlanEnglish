import {useEffect,useRef,useState} from "react";
import {battleCues,createBattleSound} from "../game/teamBossRpg/battle-sound";
import {encounterCues,createEncounterSound} from "../game/teamBossRpg/encounter-sound";
const preference="alanenglish-team-boss-sound-volume-v1";
function savedVolume(){try{const value=window.localStorage.getItem(preference);return value!==null&&/^([0-9]|[1-9][0-9]|100)$/.test(value)?Number(value):35;}catch{return 35;}}
export default function useTeamBossSound(active,step,motion,character,bossId,weapon){
 const engine=useRef(null),last=useRef({event:null,steps:new Set()}),mounted=useRef(true),attempt=useRef(0);
 const [enabled,setEnabled]=useState(false),[volume,setVolume]=useState(savedVolume),[message,setMessage]=useState(""),[pending,setPending]=useState(false);
 const volumeRef=useRef(volume);volumeRef.current=volume;
 const make=()=>bossId===undefined?createBattleSound({volume:volumeRef.current/100}):createEncounterSound({volume:volumeRef.current/100,bossId});
 if(!engine.current)engine.current=make();
 useEffect(()=>{
  mounted.current=true;engine.current?.dispose();engine.current=make();last.current={event:null,steps:new Set()};setEnabled(false);setPending(false);setMessage("");const sequence=attempt,owned=engine.current;const mute=()=>{attempt.current++;engine.current.mute();setEnabled(false);setPending(false);},hidden=()=>{if(document.hidden)mute();};
  window.addEventListener("pagehide",mute);document.addEventListener("visibilitychange",hidden);
  return()=>{mounted.current=false;sequence.current++;window.removeEventListener("pagehide",mute);document.removeEventListener("visibilitychange",hidden);owned.dispose();engine.current=null;};
 },[bossId]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
  if(!active||!motion){engine.current?.stop();last.current={event:null,steps:new Set()};return;}
  if(last.current.event!==active){engine.current.stop();last.current={event:active,steps:new Set()};}
  if(last.current.steps.has(step))return;last.current.steps.add(step);
  const cues=bossId===undefined?battleCues(active,step,character):encounterCues(active,step,character,weapon);
  for(const cue of cues)engine.current.play(cue);
 },[active,step,motion,character,bossId,weapon]);
 const toggle=async()=>{
  const turn=++attempt.current;if(enabled||pending){engine.current.mute();setEnabled(false);setPending(false);setMessage("");return;}
  setPending(true);
  const sound=engine.current,ok=await sound.enable();if(!mounted.current||sound!==engine.current||turn!==attempt.current)return;
  setPending(false);
  setEnabled(ok);setMessage(ok?"":"瀏覽器未能啟用音效，仍可正常查看戰報與學習。");
 };
 const adjust=value=>{setVolume(value);engine.current.volume(value/100);try{window.localStorage.setItem(preference,String(value));}catch{}};
 return{enabled,volume,message,pending,toggle,adjust};
}

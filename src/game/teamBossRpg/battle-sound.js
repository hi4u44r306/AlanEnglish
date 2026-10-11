import {battleMotionPlan} from "./native-battle-motion";
// Original synthesized cues, no samples/network/microphone. Browser context exists only after an explicit click.
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
export const SOUND_SCORE=Object.freeze({
 swing:[[700,160,0,.11,"triangle"]],cast:[[620,1040,0,.22,"sine"],[930,1560,.06,.18,"sine"]],
 hit:[[120,60,0,.12,"triangle"]],shield:[[350,220,0,.18,"sine"]],
 combo:[[392,392,0,.22,"sine"],[523,523,.07,.25,"sine"],[784,784,.14,.28,"sine"]],
 victory:[[523,523,0,.18,"sine"],[659,659,.14,.18,"sine"],[784,784,.28,.18,"sine"],[1046,1046,.42,.3,"sine"]]
});
export function scheduleCue(context,output,key,voices){
 if(!SOUND_SCORE[key])return false;
 for(const [from,to,delay,duration,type]of SOUND_SCORE[key]){
  const oscillator=context.createOscillator(),envelope=context.createGain(),start=context.currentTime+delay;
  oscillator.type=type;oscillator.frequency.setValueAtTime(from,start);oscillator.frequency.exponentialRampToValueAtTime(to,start+duration);
  envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(.12,start+.008);envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
  oscillator.connect(envelope);envelope.connect(output);
  const voice={oscillator,envelope};voices.add(voice);
  oscillator.onended=()=>{voices.delete(voice);oscillator.disconnect();envelope.disconnect();};
  oscillator.start(start);oscillator.stop(start+duration+.01);
 }return true;
}
export function createBattleSound({contextFactory=()=>{const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error("unsupported");return new C();},volume=.35}={}){
 let context,master,enabled=false,disposed=false,generation=0,currentVolume=volume;const voices=new Set();
 const stop=()=>{for(const v of voices){v.oscillator.onended=null;try{v.oscillator.stop();}catch{}v.oscillator.disconnect();v.envelope.disconnect();}voices.clear();};
 const mute=()=>{generation++;enabled=false;stop();};
 return{
  async enable(){const turn=++generation;try{
   if(disposed)return false;if(!context){context=contextFactory();master=context.createGain();master.gain.value=currentVolume;master.connect(context.destination);}
   if(context.state!=="running")await context.resume();
   if(disposed||turn!==generation||context.state!=="running")return false;enabled=true;return true;
  }catch{if(turn===generation)mute();return false;}},
  mute,stop,
  volume(value){if(!Number.isFinite(value)||value<0||value>1)throw RangeError("Invalid sound volume");currentVolume=value;if(master)master.gain.setValueAtTime(value,context.currentTime);if(value===0)stop();},
  play(key){if(!enabled||disposed||!currentVolume||context?.state!=="running")return false;try{return scheduleCue(context,master,key,voices);}catch{mute();return false;}},
  dispose(){disposed=true;mute();if(context){master.disconnect();try{Promise.resolve(context.close()).catch(()=>{});}catch{}}},
  get enabled(){return enabled&&context?.state==="running";},
  get voiceCount(){return voices.size;}
 };
}
export function battleCues(event,step,character){
 if(!event||!Number.isInteger(step)||step<0)return[];
 const phases=battleMotionPlan(event).phases,at=kind=>phases.find(p=>p.kind===kind)?.start;
 const cues=[];
 if(step===0)cues.push((event.skills?.character_id||character)?.endsWith("mage")?"cast":"swing");
 if(step===at("skill"))cues.push(event.skills.key==="star-cast"?"cast":"swing");
 if(step===3)cues.push("hit");
 if(step===at("recoil"))cues.push("shield");
 if(step===at("combo")+2)cues.push("combo");
 if(step===at("victory"))cues.push("victory");
 return cues;
}

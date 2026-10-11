import {EXPANSION_PROFILES} from './native/bosses/expansion-profiles.mjs';
import {battleMotionPlan} from './native-battle-motion';
import {weaponEffect} from './native/bosses/boss-profiles.mjs';
import {SOUND_SCORE} from './battle-sound';
// Original accepted synthesized score; no samples, microphone, network or settlement.
export function scheduleEncounterCue(context,output,key,voices,profile=null){const score=profile&&(key==='combo'?SOUND_SCORE.combo.map(note=>[...note,.05]):profile.sounds?.[key]);if(!score)return false;
 const attach=(source,gain,filter,start,end)=>{source.connect(filter);filter.connect(gain);gain.connect(output);const voice={source,gain,filter};voices.add(voice);source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();filter.disconnect();};source.start(start);source.stop(end+.015);};
 for(const [from,to,delay,duration,type,level] of score){const source=context.createOscillator(),gain=context.createGain(),filter=context.createBiquadFilter(),start=context.currentTime+delay;source.type=type;source.frequency.setValueAtTime(from,start);source.frequency.exponentialRampToValueAtTime(to,start+duration);filter.type='lowpass';filter.frequency.value=2400;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);attach(source,gain,filter,start,start+duration);}
 if(['blade-air','blade-wave','impact','boss-charge','boss-ray','magic-ray'].includes(key)){const duration=key==='boss-ray'?.38:.22,source=context.createBufferSource(),buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);let seed=827;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/4294967296*2-1;}source.buffer=buffer;const gain=context.createGain(),filter=context.createBiquadFilter(),start=context.currentTime;filter.type=key==='blade-air'?'bandpass':'lowpass';filter.frequency.setValueAtTime(key.startsWith('boss')?550:1700,start);filter.frequency.exponentialRampToValueAtTime(key.startsWith('boss')?160:320,start+duration);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(key==='impact'?.12:.065,start+.014);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);attach(source,gain,filter,start,start+duration);}return true;
}
export function createEncounterSound({contextFactory=()=>{const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('unsupported');return new C();},volume=.35,bossId}={}){const profile=EXPANSION_PROFILES.find(p=>p.id===bossId);let context,master,compressor,enabled=false,disposed=false,generation=0,currentVolume=volume;const voices=new Set();const stop=()=>{for(const v of voices){v.source.onended=null;try{v.source.stop();}catch{}v.source.disconnect();v.gain.disconnect();v.filter.disconnect();}voices.clear();};const mute=()=>{generation++;enabled=false;stop();};return {
 async enable(){const turn=++generation;try{if(disposed||!profile)return false;if(!context){context=contextFactory();master=context.createGain();compressor=context.createDynamicsCompressor();master.gain.value=currentVolume;compressor.threshold.value=-10;compressor.knee.value=16;compressor.ratio.value=5;master.connect(compressor);compressor.connect(context.destination);}if(context.state!=='running')await context.resume();if(disposed||turn!==generation||context.state!=='running')return false;enabled=true;return true;}catch{if(turn===generation)mute();return false;}},mute,stop,
 volume(value){if(!Number.isFinite(value)||value<0||value>1)throw RangeError('Invalid sound volume');currentVolume=value;if(master)master.gain.setValueAtTime(value,context.currentTime);if(value===0)stop();},play(key){if(!enabled||disposed||!currentVolume||context?.state!=='running')return false;try{return scheduleEncounterCue(context,master,key,voices,profile);}catch{mute();return false;}},dispose(){disposed=true;mute();master?.disconnect();compressor?.disconnect();if(context)try{Promise.resolve(context.close()).catch(()=>{});}catch{}},get enabled(){return enabled&&context?.state==='running';},get voiceCount(){return voices.size;}};}

export function encounterCues(event,step,character,weapon){
 if(!event||!Number.isInteger(step)||step<0)return[];
 const phases=battleMotionPlan(event).phases,beat=phases.find(p=>step>=p.start&&step<p.end);if(!beat)return[];
 const local=step-beat.start,mage=weapon?weaponEffect(weapon)==='magic':(event.skills?.character_id||character)?.endsWith('mage'),cues=[];
 if(['attack','skill'].includes(beat.kind)){
  if(local===0)cues.push(mage?'magic-charge':'blade-air');
  if(local===(beat.kind==='skill'?1:2))cues.push(mage?'magic-ray':'blade-wave');
  if(local===(beat.kind==='skill'?1:3))cues.push('impact','boss-hit');
 }
 if(beat.kind==='combo'&&local===2)cues.push('combo','impact','boss-hit');
 if(beat.kind==='recoil'&&event.boss_phase?.move==='ink_counter'){if(local===0)cues.push('boss-charge');if(local===1)cues.push('boss-ray');}
 if(beat.kind==='victory'&&local===0)cues.push('boss-defeat','victory');
 return cues;
}

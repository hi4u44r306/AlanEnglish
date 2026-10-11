import TeamBossRelicBattleDetails from "./TeamBossRelicBattleDetails";
import {battleMotionPlan,battleMotionBeat,battlePresentedDamage} from "../../game/teamBossRpg/native-battle-motion";
import useTeamBossSound from "../../hooks/useTeamBossSound";
import TeamBossResults from "./TeamBossResults";
import { CLASS_SKILLS } from "../../game/teamBossRpg/skills";
import React,{useEffect,useRef,useState} from "react";
import useTeamBossBattle from "../../hooks/useTeamBossBattle";
import TeamBossNativeArt from "./TeamBossNativeArt";
import TeamBossContinuousArt from "./TeamBossContinuousArt";
import {NATIVE_ITEMS,NATIVE_CHARACTERS} from "../../game/teamBossRpg/native/native-rig.mjs";
import { BOSS_PHASES } from "../../game/teamBossRpg/boss-phases";
import {projectClassRaidEncounter} from "../../game/teamBossRpg/class-raid-encounter-contract";
import {EXPANSION_PROFILES} from "../../game/teamBossRpg/native/bosses/expansion-profiles.mjs";
import TeamBossEncounterArt from "./TeamBossEncounterArt";
import TeamBossEncounterFx from "./TeamBossEncounterFx";
import "./TeamBossNativeBattle.scss";
import "./TeamBossGroundedBattle.scss";
const loadout=member=>{const gear=Object.fromEntries(member.loadout.filter(item=>NATIVE_ITEMS.some(known=>known.id===item.asset_key&&known.slot===item.slot)).map(item=>[item.slot,item.asset_key]));if(!gear.weapon&&NATIVE_CHARACTERS.some(c=>c.id===member.character_id))gear.weapon="oak-wand";return gear;};
const skillName=member=>member.character_id?CLASS_SKILLS[member.character_id.endsWith("knight")?"moon-slash":"star-cast"].title:"技能蓄力";
const trustedBoss=snapshot=>{try{if(!snapshot)return null;const id=Object.prototype.hasOwnProperty.call(snapshot,"encounter")?projectClassRaidEncounter(snapshot.encounter).boss_id:"moon-book-dragon";return EXPANSION_PROFILES.find(p=>p.id===id)||null;}catch{return null;}};
export function NativeBattle({state,onWardrobe,continuous=true,profiles=null}){
 const name=member=>profiles?.label(member)||(member.is_me?'你':member.alias);
 const Art=continuous?TeamBossContinuousArt:TeamBossNativeArt;
 const {snapshot,history,arrivals,busy,error,refresh}=state;
 const arena=useRef(null),bossProfile=trustedBoss(snapshot);
 const [motion,setMotion]=useState(()=>!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
 const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
 const sources=snapshot?[...new Set([...snapshot.members.flatMap(member=>[...["src","actionsSrc"].map(key=>NATIVE_CHARACTERS.find(c=>c.id===member.character_id)?.[key]),...Object.values(loadout(member)).map(id=>NATIVE_ITEMS.find(known=>known.id===id)?.src)]),...history.concat(arrivals).flatMap(event=>["src","actionsSrc"].map(key=>NATIVE_CHARACTERS.find(c=>c.id===event.skills?.character_id)?.[key]))].filter(Boolean))].join("|"):"";
 useEffect(()=>{
  let cancelled=false;setReady(false);setFailed(false);if(!sources)return undefined;
  Promise.all(sources.split("|").map(src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=reject;image.src=src;}))).then(()=>{if(!cancelled)setReady(true);}).catch(()=>{if(!cancelled)setFailed(true);});
  return()=>{cancelled=true;};
 },[sources]);
 const [queue,setQueue]=useState([]),[active,setActive]=useState(null),[step,setStep]=useState(0),[idle,setIdle]=useState(0),[replay,setReplay]=useState(false);
 const soundActor=snapshot?.members.find(member=>member.member_key===active?.member_key);
 const sound=useTeamBossSound(active,step,motion&&ready&&!!bossProfile,active?.skills?.character_id||soundActor?.character_id,bossProfile?.id||null,soundActor?loadout(soundActor).weapon:null);
 const seen=useRef(new Set()),version=useRef(snapshot?.team_version);
 const stop=()=>{setMotion(false);setQueue([]);setActive(null);setStep(0);setReplay(false);};
 useEffect(()=>{
  const media=window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const preference=event=>{if(event.matches)stop();};
  const hidden=()=>{if(document.hidden)stop();},pagehide=()=>stop();
  media?.addEventListener("change",preference);document.addEventListener("visibilitychange",hidden);window.addEventListener("pagehide",pagehide);
  return()=>{media?.removeEventListener("change",preference);document.removeEventListener("visibilitychange",hidden);window.removeEventListener("pagehide",pagehide);};
 },[]);
 useEffect(()=>{
  if(version.current!==snapshot?.team_version){version.current=snapshot?.team_version;setQueue([]);setActive(null);setReplay(false);}
  const next=arrivals.filter(event=>!seen.current.has(event.id));next.forEach(event=>seen.current.add(event.id));
  if(motion&&next.length)setQueue(previous=>[...previous,...next]);
 },[arrivals,motion,snapshot?.team_version]);
 useEffect(()=>{
  if(!motion||!ready||active||!queue.length)return;
  setActive(queue[0]);setQueue(previous=>previous.slice(1));setStep(0);
 },[motion,ready,active,queue]);
 useEffect(()=>{
  if(!active||!motion||!ready)return;
  const timer=setInterval(()=>setStep(value=>value+1),180);
  return()=>clearInterval(timer);
 },[active,motion,ready]);
 useEffect(()=>{if(active&&step>=battleMotionPlan(active).duration){setActive(null);setStep(0);if(!queue.length)setReplay(false);}},[step,queue.length,active]);
 useEffect(()=>{
  if(!motion||!ready||active){setIdle(0);return;}
  const timer=setInterval(()=>setIdle(value=>1-value),900);return()=>clearInterval(timer);
 },[motion,ready,active]);
 if(!snapshot)return <section className="tb-panel tb-native-battle" aria-label="新版小隊戰場"><h2>小隊戰場</h2><p role="status">{busy?"正在準備小隊角色與戰報…":error||"目前沒有戰場資料。"}</p><button type="button" className="tb-secondary" disabled={busy} onClick={refresh}>重新讀取戰場</button></section>;
 if(!bossProfile)return <section className="tb-panel" role="alert"><h2>Boss身份無法確認</h2><p>請重新讀取戰況，原學習成果與待確認交易會保留。</p><button type="button" disabled={busy} onClick={refresh}>重新讀取戰場</button></section>;
 const classRaid=snapshot.mode==="class_raid";
 const visibleMembers=classRaid?[...snapshot.members.filter(m=>m.is_me),...snapshot.members.filter(m=>!m.is_me).sort((a,b)=>Number(b.member_key===active?.member_key)-Number(a.member_key===active?.member_key))].slice(0,4):snapshot.members;
 const actor=snapshot.members.find(member=>member.member_key===active?.member_key);
 const impact=active&&step>=3,beat=motion?battleMotionBeat(active,step):null;
 const phase=snapshot.boss_phase,stage=phase?(active?.boss_phase?(impact?active.boss_phase.phase_after:active.boss_phase.phase_before):phase.phase):null;
 const stageInfo=BOSS_PHASES[stage],move=active?.boss_phase?.move, countering=beat?.kind==="recoil"&&move==="ink_counter";
 const skill=active?.skills,skillActive=beat?.kind==="skill";
 const progress=snapshot.relic_progress,teamEnergy=progress?progress.energy:snapshot.teamwork?.energy,teamThreshold=progress?progress.team_threshold:snapshot.teamwork?.threshold;
 const teamwork=snapshot.teamwork,comboActive=beat?.kind==="combo",celebrating=beat?.kind==="victory";
 const shield=phase&&(stage==="guard"||(stage==="ink"&&(active?(impact&&["ink_guard","ink_counter"].includes(move)):phase.guard_ready)));
 return <section className="tb-native-battle" data-encounter-id={bossProfile.id} aria-label={classRaid?"班級戰場":"新版小隊戰場"} data-motion={motion} data-active-event={active?.id || ""} data-queued-events={queue.length} data-confirmed-phase={phase?.phase || "legacy"} data-confirmed-energy={teamwork?.energy ?? "legacy"}>
  <div className="tb-native-battle-heading"><div><h2>{snapshot.team_name}</h2><p>{snapshot.status==="won"?classRaid?bossProfile.name+"已被全班擊敗！":bossProfile.name+"已被小隊擊敗！":snapshot.status==="closed"?"這場冒險已結束":"一起練英文，守護知識森林"}</p></div><button type="button" className="tb-secondary" onClick={onWardrobe}>調整我的裝備</button></div>
  {phase&&<div className="tb-boss-phase-status"><div><span>{replay?"戰報階段":"Boss階段"}</span><strong>{stageInfo.title}</strong><p>{stageInfo.hint}</p></div><ol aria-label="書龍三個階段">{["forest","guard","ink"].map((key,index)=><li key={key} aria-current={stage===key?"step":undefined} className={stage===key?"is-current":""}><span>{index+1}</span>{BOSS_PHASES[key].title}</li>)}</ol>{replay&&<p>最新已確認階段：{BOSS_PHASES[phase.phase].title}</p>}</div>}
  {teamwork&&<div className="tb-teamwork-status"><div><strong>合作能量</strong><span>{teamEnergy}／{teamThreshold}{progress?" 能量":""}</span><progress aria-label="合作能量" value={teamEnergy} max={teamThreshold}/></div><p>{snapshot.status!=="active"?"本場冒險已結束，保留最後能量與合擊成果。":teamEnergy===teamThreshold?"能量已滿，邀請隊友接力出擊！":"每筆有效學習蓄力，至少兩名隊員合作發動。"}<span>本輪 {teamwork.contributors} 位參與 · 合擊 {teamwork.combos} 次</span></p></div>}
  <div ref={arena} className="tb-native-arena" data-combo-active={comboActive?"true":"false"} data-action-kind={beat?.kind||"idle"} data-action-index={beat?.index??0} data-party-count={visibleMembers.length} data-battle-mode={replay?"replay":"live"} data-boss-phase={stage || "legacy"} data-boss-move={countering?"ink_counter":"none"}>
   {continuous&&<TeamBossEncounterFx host={arena} bossId={bossProfile.id} event={active} step={step} motion={motion&&ready}/>}
   <div className="tb-native-party" aria-label="左側冒險小隊">{visibleMembers.map(member=>{
    const historicalActor=active?.member_key===member.member_key,renderCharacter=historicalActor&&active.skills?active.skills.character_id:member.character_id;
    const comboFighter=comboActive&&active.teamwork.participant_keys.includes(member.member_key),acting=beat?.kind==="combo"?comboFighter:historicalActor;
    const actorMove=acting&&beat&&["attack","skill","combo"].includes(beat.kind),reacting=historicalActor&&countering;
    const pose=celebrating||comboFighter||(historicalActor&&beat&&beat.kind!=="combo")?beat.frame:motion?idle:0;
    return <article key={member.member_key} className={"tb-native-fighter "+(actorMove?"is-attacking":"")+(comboFighter?" is-combo":"")+(reacting?" is-reacting":"")+(celebrating?" is-celebrating":"")} data-motion-kind={celebrating?"victory":reacting?"recoil":actorMove?beat.kind:"idle"} data-combo-participant={comboFighter?"true":"false"} data-is-me={member.is_me?"true":"false"} data-member-key={member.member_key} data-attack-step={actorMove?beat.index:0}>
     <div className="tb-native-fighter-name">{profiles?.canView(member.member_key)?<button type="button" className="tb-class-name-button" aria-label={'查看 '+name(member)+' 的資料'} onClick={()=>profiles.open(member.member_key)}><strong>{name(member)}</strong></button>:<strong>{name(member)}</strong>}<span>{member.sources} 次貢獻</span></div>
     {profiles?.canView(member.member_key)&&<button type="button" className="tb-class-portrait-button" aria-label={'查看 '+name(member)+' 的角色'} onClick={()=>profiles.open(member.member_key)}/>}
     {ready&&renderCharacter ? <Art event={active} step={step} memberKey={member.member_key} motion={motion&&ready} character={renderCharacter} camera="battle" transition={motion && ready} loadout={loadout(member)} effect={historicalActor&&skillActive?{key:skill.key,beat:beat.index===0?1:beat.index===1?2:3}:null} frame={pose}/> : <div className="tb-native-art tb-native-art-placeholder">{!renderCharacter?"歷史參與隊員":failed?"造型圖片載入失敗":"正在準備冒險者…"}</div>}
     {snapshot.skills&&member.skills&&(progress?<div className="tb-class-skill tb-exact-charge" data-progress-member={member.member_key}><span>{skillName(member)} · {member.relic_progress.charge}／{progress.skill_threshold} 能量</span><progress aria-label={name(member)+"技能能量"} value={member.relic_progress.charge} max={progress.skill_threshold}/><small>已施放 {member.relic_progress.casts} 次</small></div>:<p className="tb-class-skill">{skillName(member)} · 準備 {member.skills.charge}／3 · 已施放 {member.skills.casts}</p>)}
     {actorMove&&renderCharacter&&<span className={"tb-native-strike "+(renderCharacter.endsWith("mage")?"is-magic":"is-sword")} aria-hidden="true"/>}
    </article>;
   })}</div>
   <div className={"tb-native-enemy "+(impact?"is-hit ":"")+((phase?stage==="victory":snapshot.status==="won")?"is-defeated":"")} data-confirmed-hp={snapshot.hp}>
    <div className="tb-native-enemy-label"><h3>{bossProfile.name}</h3><p>已確認生命 {snapshot.hp.toLocaleString("zh-TW")} / {snapshot.max_hp.toLocaleString("zh-TW")}</p><progress id="tb-boss-hp" aria-label="隊伍Boss生命" value={snapshot.hp} max={snapshot.max_hp}/></div>
    <div className="tb-native-dragon-art" data-shield={shield?"ready":"none"}>{shield&&<svg className="tb-boss-page-shield" viewBox="0 0 400 400" aria-hidden="true"><path d="M82 100 Q200 30 318 100 L310 254 Q282 326 200 360 Q118 326 90 254Z" fill="#e9f8ff66" stroke="#7bb0da" strokeWidth="3"/><path d="M115 127 Q154 114 200 138 Q246 114 285 127 L276 247 Q244 232 200 255 Q156 232 124 247Z" fill="#f6fcff99" stroke="#90bddd" strokeWidth="2"/><path d="M200 138 V255 M135 153 L174 153 M135 175 L174 175 M226 153 L265 153 M226 175 L265 175" stroke="#80aed7" strokeWidth="3"/></svg>}<TeamBossEncounterArt bossId={bossProfile.id} event={active} step={step} motion={motion&&ready} won={phase?stage==="victory":snapshot.status==="won"}/>{impact&&<strong className="tb-native-damage" key={active.id+":"+battlePresentedDamage(active,step)} aria-label={"本筆累計傷害 "+battlePresentedDamage(active,step)}>−{battlePresentedDamage(active,step)}</strong>}{impact&&active.boss_phase?.shield_absorbed>0&&<span className="tb-boss-absorbed">護盾擋下 {active.boss_phase.shield_absorbed}</span>}{countering&&<div className="tb-boss-counter" aria-hidden="true"><i/><i/><i/></div>}</div>
    {phase?.phase==="ink"&&!replay&&<p className="tb-boss-counter-charge">護幕準備 {phase.counter_charge}／2 · {phase.guard_ready?"下一筆將遇到墨光護幕":"繼續合作出擊"}</p>}
    {countering&&<p className="tb-boss-counter-label" role="status">{bossProfile.id==="moon-book-dragon"?"書龍展開墨光護幕！冒險者穩住姿勢。":bossProfile.name+"展開護幕！冒險者穩住姿勢。"}</p>}
    {skillActive&&<p className="tb-class-skill-label" role="status">{CLASS_SKILLS[skill.key].title} · 技能加成 {skill.bonus_damage}</p>}
    {celebrating&&<p className="tb-native-victory-label" role="status">{classRaid?"全班勝利！通關成果已保存。":"小隊勝利！通關成果已保存。"}</p>}
    {active&&<p className="tb-native-event-caption">{replay?"重播：":""}{actor?name(actor):"已離隊隊員"}的{active.kind==="listening_session"?"聽力":"口說"}貢獻{impact?"已命中":"正在出擊"}</p>}
   </div>
   {comboActive&&<div className="tb-team-combo" role="status"><svg viewBox="0 0 400 400" aria-hidden="true"><path d="M200 36 L240 150 L364 200 L240 250 L200 364 L160 250 L36 200 L160 150Z" fill="#ffe5a822" stroke="#d3a951" strokeWidth="3"/><circle cx="200" cy="200" r="115" fill="none" stroke="#ffe3a8" strokeWidth="5"/></svg><strong>星光合擊</strong><span>隊友接力 · 合擊加成 {active.teamwork.bonus_damage}</span></div>}
  </div>
  <div className="tb-native-battle-controls"><button type="button" className="tb-secondary" disabled={busy} onClick={refresh}>{classRaid?"更新班級戰報":"更新小隊戰報"}</button><button type="button" disabled={!ready||!history.length||!!active||!!queue.length} onClick={()=>{setReplay(true);setMotion(true);setQueue([...history]);}}>重播最近戰報</button><button type="button" className="tb-secondary" onClick={motion?stop:()=>setMotion(true)}>{motion?"停止動畫":"啟用動畫"}</button></div>
  <div className="tb-battle-sound" aria-label="戰鬥音效控制"><button type="button" className="tb-secondary" aria-pressed={sound.enabled} onClick={sound.toggle}>{sound.enabled||sound.pending?"靜音音效":"啟用音效"}</button><label>音效音量 <input type="range" min="0" max="100" step="1" aria-label="戰鬥音效音量" value={sound.volume} onChange={event=>sound.adjust(Number(event.target.value))}/><span>{sound.volume}%</span></label><p>預設靜音，手動啟用後配合戰報播放；停止動畫或切到背景會停止聲音。</p>{sound.message&&<p role="status">{sound.message}</p>}</div>
  <TeamBossResults snapshot={snapshot}/>
  <TeamBossRelicBattleDetails snapshot={snapshot} events={history}/>
  <p role="status">{failed?"造型圖片無法載入，請重新整理或切換原版戰場。":!ready?"正在準備小隊角色與裝備…":busy?"正在更新小隊戰報…":active?(replay?"重播已結算戰報，金幣與生命不會重新結算。":"正在播放已確認的學習貢獻。"):snapshot.has_more?"還有新戰報，請再按更新。":(classRaid?"角色與裝備來自已保存的班級戰況；有效學習結算後才有傷害。":"角色與裝備來自小隊資料；有效學習結算後才有傷害。")}</p>
  {error&&<p role="alert">{error} 可以重新讀取；原學習任務仍可使用。</p>}
  {phase&&<details className="tb-boss-phase-rules"><summary>{bossProfile.name}招式與試玩規則</summary><p>生命降至三分之二時，守護護盾擋下20%戰鬥傷害；最後三分之一時，每兩筆有效小隊貢獻後展開墨光護幕，下一筆擋下30%。至少造成1傷害、最多剩餘生命，學習金幣照常獲得。比例與輪次仍待試玩定版。</p>{teamwork&&<p>每筆有效學習增加1格合作能量，滿6格且本輪至少兩名有效隊員參與，自動消耗能量發動一次星光合擊；候選基礎加成60傷害，仍受本次Boss護盾影響，學習金幣不加倍。普通攻擊已通關時不浪費能量或補造合擊，重播不蓄力。</p>}{snapshot.skills&&<p>每位隊員每三筆有效貢獻發動一次專屬招式：劍士月光斬、法師星光術，候選基礎加成同為12傷害，受護盾影響，最多剩餘生命。角色切換不增加貢獻或重置準備次數；戰報保存當時角色，重播不重新施放結算。</p>}</details>}
  <details className="tb-native-battle-log"><summary>查看最近 {history.length} 筆戰報</summary>{history.length?<ol>{history.slice().reverse().map(event=><li key={event.id}><strong>{name(snapshot.members.find(member=>member.member_key===event.member_key)||{alias:"已離隊隊員"})}</strong><span>{event.kind==="listening_session"?"聽力":"口說"}貢獻 · {event.damage} 傷害{event.won?" · 最後一擊":""}{event.boss_phase?.shield_absorbed>0?" · 護盾擋下 "+event.boss_phase.shield_absorbed:""}{event.boss_phase?.move==="ink_counter"?" · "+bossProfile.name+"展開護幕":""}{event.teamwork?.triggered?" · 星光合擊加成 "+event.teamwork.bonus_damage:""}{event.skills?.triggered?" · "+CLASS_SKILLS[event.skills.key].title+"加成 "+event.skills.bonus_damage:""}{event.relic_attack?" · 寶物實際增加 "+event.relic_attack.damage_added:""}</span></li>)}</ol>:<p>完成活動中的有效學習任務後，戰報會出現在這裡。</p>}{snapshot.has_older&&<p>這裡顯示最近50筆，較早紀錄仍保留。</p>}</details>
 </section>;
}
export default function TeamBossNativeBattle({client,activity,revision,onWardrobe}){
 const state=useTeamBossBattle(client,activity.id,revision);
 return <NativeBattle state={state} onWardrobe={onWardrobe}/>;
}

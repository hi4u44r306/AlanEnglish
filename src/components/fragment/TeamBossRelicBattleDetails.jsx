import React from 'react';
import {RELIC_LABELS,RELIC_CONDITIONS} from '../../game/teamBossRpg/relic-labels';
import './TeamBossRelicBattleDetails.scss';
export default function TeamBossRelicBattleDetails({snapshot,events}){
 const profile=snapshot.relic_battle;if(!profile)return null;
 const progress=snapshot.relic_progress;
 const rows=events.filter(e=>e.relic_attack).slice(-5).reverse();
 return <section className="tb-relic-battle-details" aria-label="寶物戰鬥效果">
  <header><div><small>寶物共鳴</small><h3>這場冒險的寶物效果</h3></div><span>{profile.attack_enabled?'攻擊效果已開啟':'攻擊效果已停用'}</span></header>
  <ul className="tb-relic-battle-abilities" aria-label="各項能力生效狀態">{[['attack','攻擊',profile.attack_enabled],['guard','守護',false],['charge','充能',profile.charge_enabled],['support','共鳴',profile.support_enabled]].map(([key,label,enabled])=><li key={key} data-relic-ability={key} data-enabled={String(enabled)}><strong>{label}</strong><span>{(key==='attack'||(progress&&key!=='guard'))?(enabled?'本活動可生效':'額外加成已停用'):'尚未生效'}</span></li>)}</ul>
  <p>只有保存穿戴與有效學習會結算。試穿與重播不增加傷害或金幣。</p>{progress&&<p>每筆有效學習基礎累積100能量；技能300、合體600，合體仍需兩位隊員接力。停用額外加成保留已累積餘量。</p>}
  {rows.length?<ol>{rows.map(event=>{const a=event.relic_attack,member=snapshot.members.find(m=>m.member_key===event.member_key);return <li key={event.id} data-relic-event={event.id}>
   <div className="tb-relic-event-heading"><strong>{member?.is_me?'你':member?.alias||'已離隊隊員'} · {RELIC_CONDITIONS[a.kind]}</strong><b>實際增加 <span data-relic-damage={event.id}>+{a.damage_added}</span> 傷害</b></div>
   <div className="tb-relic-event-stats"><span>寶物原始加成 +{a.raw_attack}</span><span>套用上限後 +{a.attack_bonus}</span><span>本擊總傷害 {event.damage}</span></div>
   <ul>{a.effects.length?a.effects.map(e=><li key={e.slot}><span>{e.slot==='treasure1'?'寶物一':'寶物二'} · {RELIC_LABELS[e.id]?.name||'未命名寶物'}</span><b>{e.active?'本次生效 +'+e.attack:'本次條件不符或已停用'}</b></li>):<li>本次沒有保存寶物</li>}</ul>
   {event.relic_progress&&<div className="tb-relic-progress-event" data-progress-event={event.id}><dl><div><dt>個人技能蓄力</dt><dd>{event.relic_progress.charge_before} → {event.relic_progress.charge_after}／300</dd><dd>本次 +{event.relic_progress.charge_gained}（含充能 +{event.relic_progress.charge_bonus}）{event.relic_progress.skill_triggered?" · 技能已發動":""}</dd></div><div><dt>小隊合體蓄力</dt><dd>{event.relic_progress.energy_before} → {event.relic_progress.energy_after}／600</dd><dd>實收 +{event.relic_progress.energy_gained}／本次提供 {event.relic_progress.energy_requested}（含共鳴 +{event.relic_progress.support_bonus}）{event.relic_progress.combo_triggered?" · 合體已發動":""}</dd></div></dl><p>觸發後扣除門檻並保留餘量；單人蓄滿時，需同伴接力才發動合體。</p><p>充能原始 +{event.relic_progress.raw_charge}／本次上限 {event.relic_progress.charge_cap}；共鳴原始 +{event.relic_progress.raw_support}／本次上限 {event.relic_progress.support_cap}</p><ul aria-label="本次能量寶物來源">{event.relic_progress.effects.map(e=><li key={e.slot}><span>{e.slot==='treasure1'?'寶物一':'寶物二'} · {RELIC_LABELS[e.id]?.name||'未命名寶物'}</span><b>{e.active?'充能 +'+e.charge+'／共鳴 +'+e.support:'能量加成未生效'}</b></li>)}</ul></div>}
   <p>依這次結算保存的來源顯示；Boss 減傷與剩餘生命會影響增加量，換裝後不改寫舊戰報。</p>
  </li>;})}</ol>:<p>完成有效學習後，這裡會列出寶物來源與實際增加量。</p>}
 </section>;
}

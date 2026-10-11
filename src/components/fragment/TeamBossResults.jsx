import React from "react";
const states={claimed:"已領取通關獎勵",ready:"已達貢獻門檻，待領取",insufficient:"尚未達到領獎貢獻門檻",not_won:"小隊仍在冒險",closed:"活動已結束，保留成果"};
export default function TeamBossResults({snapshot}){
 const r=snapshot.results;if(!r)return null;
 return <section className="tb-battle-results" aria-label="本場冒險成果">
  <h3>{snapshot.status==="won"?"一起守護了知識森林！":"本場冒險成果"}</h3>
  <div className="tb-result-grid"><article><h4>我的學習</h4><dl><div><dt>有效貢獻</dt><dd>{r.personal_sources} 次</dd></div><div><dt>戰鬥傷害</dt><dd>{r.personal_damage}</dd></div><div><dt>學習金幣已入帳</dt><dd>{r.learning_coins} 枚</dd></div><div><dt>通關金幣已入帳</dt><dd>{r.victory_coins} 枚</dd></div></dl></article>
  <article><h4>小隊合作</h4><dl><div><dt>全場有效貢獻</dt><dd>{r.team_sources} 次</dd></div><div><dt>全場戰鬥傷害</dt><dd>{r.team_damage}</dd></div>{snapshot.teamwork&&<div><dt>星光合擊</dt><dd>{snapshot.teamwork.combos} 次</dd></div>}</dl><p>包含本場先前參與的隊友，隊友貢獻不增加你的金幣。</p></article></div>
  <p className="tb-result-claim"><strong>{states[r.claim_status]}</strong>{r.claimed?" · 徽章已收藏":` · 每人需 ${r.minimum_sources} 次有效貢獻，通關獎勵 ${r.reward_coins} 金幣`}</p>
  {r.claim_status==="ready"&&<p>在冒險任務按「領取通關獎勵」；領取仍依目前資格與每日限額。</p>}
  <p className="tb-result-note">完整成果來自已結算紀錄，不受最近戰報筆數限制。重播不發放金幣。</p>
 </section>;
}

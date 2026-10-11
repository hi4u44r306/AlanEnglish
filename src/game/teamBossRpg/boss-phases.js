export const bossPhaseName = (hp, max, status = "active") => status === "closed" ? "closed" : hp === 0 ? "victory" : hp * 3 > max * 2 ? "forest" : hp * 3 > max ? "guard" : "ink";
export const BOSS_PHASES = {
 forest: { title: "森林守衛", hint: "一起累積學習貢獻，突破書龍防線。" },
 guard: { title: "書頁護盾", hint: "護盾會減少戰鬥傷害，學習金幣照常獲得。" },
 ink: { title: "墨光反擊", hint: "每兩筆小隊貢獻後展開護幕，下一筆攻擊會被抵擋部分傷害。" },
 victory: { title: "知識森林已守護", hint: "小隊通關！回冒險任務確認個人獎勵。" },
 closed: { title: "冒險已結束", hint: "已結算的小隊成果會保留。" }
};
const phases = ["forest", "guard", "ink", "victory", "closed"];
const moves = ["none", "page_guard", "ink_counter", "ink_guard", "victory"];
export function validateBossPhases(data) {
 const bad = () => { throw Error("invalid boss phase response"); }, p = data.boss_phase;
 if (!p) { if (data.events.some(e => e.boss_phase !== undefined)) return bad(); return; }
 if (p.profile !== "book-dragon-phases-v1" || !phases.includes(p.phase)
  || !Number.isInteger(p.counter_charge) || p.counter_charge < 0 || p.counter_charge > 2
  || p.phase !== bossPhaseName(data.hp, data.max_hp, data.status) || (p.phase !== "ink" && p.counter_charge !== 0)
  || p.guard_ready !== (p.phase === "guard" || (p.phase === "ink" && p.counter_charge === 2))) return bad();
 for (const e of data.events) {
  const v = e.boss_phase;
  if (!v || v.phase_before !== bossPhaseName(e.hp_after + e.damage, data.max_hp)
   || v.phase_after !== bossPhaseName(e.hp_after, data.max_hp) || !moves.includes(v.move)
   || !Number.isSafeInteger(v.shield_absorbed) || v.shield_absorbed < 0 || v.shield_absorbed > 1100 || (v.move === "victory") !== e.won
   || (v.phase_before === "forest" && !["none", "victory"].includes(v.move))
   || (v.phase_before === "guard" && !["page_guard", "victory"].includes(v.move))
   || (v.phase_before === "ink" && !["none", "ink_counter", "ink_guard", "victory"].includes(v.move))
   || (["none", "ink_counter", "victory"].includes(v.move) && v.shield_absorbed !== 0)) return bad();
 }
}

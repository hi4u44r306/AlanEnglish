// Preview model for docs/TEAM_BOSS_SPEC_V2.md. Questions mirror the published Workbook 4 P13/P15/P17 sets
// (read-only copy, 2026-10-11). Scoring is simulated; nothing here is a receipt, database action or coin grant.
export const CLASSES = ['E1', 'E3', 'E5', 'E7'];
export const LEARNERS = ['star', 'moon', 'leaf'];
export const RULES = Object.freeze({damage: 100, hpRatio: 2, skillEvery: 3, knightSkill: 2, mageSkill: 1.5, energyPerLearner: 2, comboRatio: 0.05, baseGold: 30, baseGoldPerSentence: 3, bonusGoldPerLearner: 20, hearts: 5, restMs: 10000});
// Prices, tiers and bonuses per docs/TEAM_BOSS_SPEC_V2.md (owner approved 2026-10-11).
export const GEAR_TIERS = Object.freeze({starter: {label: '初始', price: 0, gold: 0, damage: 0}, common: {label: '普通', price: 60, gold: 0.01, damage: 0.02}, rare: {label: '稀有', price: 150, gold: 0.02, damage: 0.04}, epic: {label: '史詩', price: 300, gold: 0.03, damage: 0.06}});
export const GEAR_CAPS = Object.freeze({gold: 0.10, damage: 0.30});
export const ITEM_TIERS = Object.freeze({'oak-wand': 'starter', 'star-wand': 'common', 'moon-sword': 'common', 'sun-wand': 'rare', 'leaf-shield': 'common', 'star-shield': 'rare',
  'traveler-hat': 'common', 'wizard-hat': 'rare', 'gold-crown': 'epic', 'blue-cape': 'common', 'gold-cape': 'rare', 'moon-cape': 'epic',
  'forest-armor': 'common', 'star-armor': 'rare', 'moon-armor': 'epic', 'forest-boots': 'common', 'star-boots': 'rare', 'moon-boots': 'epic'});
// loadout: {slot: itemId}. Unknown items add nothing; totals are capped for the whole outfit.
export function gearBonus(loadout = {}) {
  const tiers = Object.values(loadout).map(id => GEAR_TIERS[ITEM_TIERS[id]]).filter(Boolean), sum = key => tiers.reduce((total, tier) => total + tier[key], 0);
  return {gold: Math.min(GEAR_CAPS.gold, Math.round(sum('gold') * 100) / 100), damage: Math.min(GEAR_CAPS.damage, Math.round(sum('damage') * 100) / 100), cost: sum('price')};
}
const BOOK = 'Workbook 4', UNIT = '日常活動與才能';
const SETS = [
  [13, 169, [
    ['What do you do in your free time?', '看電視和打電動', 'I watch TV and play video games.'],
    ['What do your brothers do in their free time?', '打手球', 'They play handball.'],
    ['What do you do in your free time?', '打籃球', 'I play basketball.'],
    ['What do you usually do after school?', '打棒球', 'I play baseball after school.'],
    ['What does he do in his free time?', '打羽球', 'He plays badminton.'],
    ['What does she do in her free time?', '打網球', 'She plays tennis.'],
    ['What does your father do after work?', '打桌球', 'He plays table tennis.']]],
  [15, 170, [
    ['Who will he go swimming with?', '父母', 'He goes swimming with his parents.'],
    ['What will you do tomorrow morning?', '可能會去慢跑', "I'll probably go jogging."],
    ['What are you going to do tomorrow?', '打算去滑雪', 'I am going to go skiing tomorrow.'],
    ['Where are you going?', '明天將和我爸去打保齡球', 'I will go bowling with my dad tomorrow.'],
    ['What do you like to do in Kenting? Go snorkelling?', '潛水', 'We go scuba diving.'],
    ['What kind of water sports do you like to try?', '衝浪', 'I would like to try surfing.'],
    ['Do you want to go mountain climbing today?', '今天什麼事都不想做', "I don't feel like doing anything."]]],
  [17, 167, [
    ['Can you play any instruments?', '鋼琴', 'Yes, I can play the piano.'],
    ['Would you like to learn to play an instrument?', '小提琴', "Yes, I'd like to learn to play the violin."],
    ['Do you have any special talents?', '吉他', 'Yes, I can play the guitar.'],
    ['What talents do you have?', '直笛', 'I can play the flute.'],
    ['What is your talent?', '鼓', 'I can play the drum.'],
    ['What do you do in your free time?', '喇叭', 'I play the trumpet.'],
    ['What does he do in his free time?', '大提琴', 'He plays the cello.']]]
];
export const CATALOG = Object.freeze(SETS.flatMap(([page, setId, rows]) => rows.map(([prompt, hint, text], i) =>
  Object.freeze({id: 'w4-' + setId + '-' + i, setId, book: BOOK, unit: UNIT, page, prompt, hint, text, type: 'read_aloud', reviewed: true}))));
export function defaultDraft(code = 'E1') {
  return {classCode: code, book: BOOK, unit: UNIT, start: '13', end: '17', boss: 'moon-book-dragon', days: '7', selected: null};
}
export function candidates(draft) {
  const start = Number(draft.start), end = Number(draft.end);
  if (!CLASSES.includes(draft.classCode) || !/^\d+$/.test(draft.start) || !/^\d+$/.test(draft.end) || start < 1 || end < start || end > 999) return [];
  return CATALOG.filter(q => q.book === draft.book && q.unit === draft.unit && q.page >= start && q.page <= end);
}
export function eligible(draft) { return candidates(draft).filter(q => q.reviewed && q.type === 'read_aloud'); }
export function selectedQuestions(draft) {
  const allowed = eligible(draft), ids = draft.selected ?? allowed.map(q => q.id);
  return [...new Set(ids)].map(id => allowed.find(q => q.id === id)).filter(Boolean);
}
// Nobody is in the roster at publish. Each classmate adds sentences x 100 x 2 HP the first time they enter,
// so absent classmates never make the Boss unbeatable.
export function publish(draft, revision) {
  const questions = selectedQuestions(draft);
  if (!Number.isInteger(revision) || revision < 1 || !questions.length) throw new Error('請先選取有精確頁碼、已核准的朗讀句子。');
  return {revision, config: {...draft, selected: questions.map(q => q.id)}, questions: questions.map(q => ({...q})), hp: 0, maxHp: 0, won: false, joined: [], events: [],
    energy: 0, energyThreshold: RULES.energyPerLearner, combos: 0,
    progress: Object.fromEntries(LEARNERS.map(key => [key, {cursor: 0, done: [], skipped: [], damage: 0, casts: 0, hearts: RULES.hearts, restUntil: 0}]))};
}
export const hpShare = questionCount => Math.round(questionCount * RULES.damage * RULES.hpRatio);
// Entering after the Boss has fallen still counts as taking part, but adds no HP.
export function join(round, learner) {
  if (!round.progress[learner] || round.joined.includes(learner)) return round;
  const joined = [...round.joined, learner], share = round.won ? 0 : hpShare(round.questions.length);
  return {...round, joined, hp: round.hp + share, maxHp: round.maxHp + share, energyThreshold: joined.length * RULES.energyPerLearner};
}
export function currentQuestion(round, learner, reviewId = null) {
  const p = round?.progress[learner];
  if (!p) return null;
  return reviewId ? (p.skipped.includes(reviewId) ? round.questions.find(q => q.id === reviewId) : null) : round.questions[p.cursor] ?? null;
}
// Hearts are personal: a skip costs one, a correct sentence restores one, zero means a 10 second rest then full hearts.
export function heartsOf(p, now = Date.now()) { return p.restUntil && p.restUntil <= now ? RULES.hearts : p.hearts; }
// A pass is one sentence at 70+; the score itself never changes damage. Mage characters cast, others slash.
// Once the Boss has fallen, sentences can still be read for base gold: no damage, no counterattack.
export function simulate(round, learner, questionId, outcome, characterId = 'boy-knight', now = Date.now(), damageBonus = 0) {
  const p = round.progress[learner], q = round.questions.find(q => q.id === questionId);
  if (!p || !q || p.done.includes(questionId) || !['pass', 'skip', 'retry', 'technical'].includes(outcome)) return {round, message: '本題沒有再次結算。'};
  if (q.id !== round.questions[p.cursor]?.id && !p.skipped.includes(q.id)) return {round, message: '請依本人的題目順序進行。'};
  if (p.restUntil > now) return {round, message: '角色正在休息，等愛心回滿再繼續。'};
  if (outcome === 'technical') return {round, message: '技術問題：原題保留，可以重試，不算跳過，也不扣愛心。'};
  if (outcome === 'retry') return {round, message: '還沒到 70 分，再聽一次、再試一次。'};
  if (outcome === 'skip' && p.skipped.includes(questionId)) return {round, message: '這句已在待補練清單。'};
  const base = join(round, learner), next = {...base, progress: {...base.progress}, events: [...base.events]}, mine = {...p, done: [...p.done], skipped: [...p.skipped]};
  next.progress[learner] = mine;
  if (mine.restUntil) {mine.hearts = RULES.hearts; mine.restUntil = 0;}
  if (q.id === round.questions[p.cursor]?.id) mine.cursor += 1;
  if (outcome === 'skip') {
    mine.skipped.push(questionId);
    if (next.won) return {round: next, message: '這句先放進待補練，之後再回來念。'};
    mine.hearts -= 1;
    if (mine.hearts === 0) mine.restUntil = now + RULES.restMs;
    return {round: next, counter: true, message: mine.hearts ? 'Boss 反擊，少了 1 顆愛心。這句放進待補練，念對一句就能補回 1 顆。' : '愛心用完了，角色休息 10 秒後愛心全滿。這句放進待補練。'};
  }
  mine.done.push(questionId); mine.skipped = mine.skipped.filter(id => id !== questionId); mine.hearts = Math.min(RULES.hearts, mine.hearts + 1);
  if (next.won) return {round: next, message: '念對了！Boss 已經倒下，這句照樣算進你的保底金幣。'};
  const skill = mine.done.length % RULES.skillEvery === 0 ? (characterId.endsWith('mage') ? 'star-cast' : 'moon-slash') : null;
  const own = Math.min(next.hp, Math.round(RULES.damage * (skill === 'moon-slash' ? RULES.knightSkill : skill === 'star-cast' ? RULES.mageSkill : 1) * (1 + Math.min(GEAR_CAPS.damage, Math.max(0, damageBonus)))));
  if (skill) mine.casts += 1;
  mine.damage += own; next.hp -= own; next.energy += 1 + (skill === 'star-cast' ? 1 : 0);
  let combo = 0;
  if (next.hp > 0 && next.energy >= next.energyThreshold) {
    combo = Math.min(next.hp, Math.round(next.maxHp * RULES.comboRatio));
    next.energy -= next.energyThreshold; next.combos += 1; next.hp -= combo;
  }
  next.won = next.hp === 0;
  const event = {id: round.revision * 1000 + next.events.length + 1, member_key: learner, kind: 'speaking_question', damage: own + combo, hp_after: next.hp, won: next.won, settled_at: new Date().toISOString()};
  if (skill) event.skills = {triggered: true, key: skill, character_id: characterId, bonus_damage: Math.max(0, own - RULES.damage)};
  if (combo) event.teamwork = {triggered: true, bonus_damage: combo, participant_keys: LEARNERS.filter(key => next.progress[key].done.length)};
  next.events.push(event);
  const parts = ['念對了！攻擊 ' + own + (skill ? '（' + (skill === 'star-cast' ? '星光術' : '月光斬') + '）' : '')];
  if (combo) parts.push('全班合體技再扣 ' + combo);
  return {round: next, message: parts.join('，') + '。'};
}
// Base is 3 per correct sentence capped at 30, so one sentence cannot farm the full base; it is earned before or after the Boss falls.
// The bonus pool (20 per classmate who entered) is shared by personal damage, only when the Boss falls.
// gear: {learnerKey: loadout}. The outfit's gold bonus applies to Boss gold only (base + bonus), rounded down.
export function rewards(round, gear = {}) {
  const total = LEARNERS.reduce((sum, key) => sum + round.progress[key].damage, 0), pool = round.won ? round.joined.length * RULES.bonusGoldPerLearner : 0;
  return LEARNERS.map(key => {
    const p = round.progress[key], base = Math.min(RULES.baseGold, p.done.length * RULES.baseGoldPerSentence);
    const bonus = p.done.length > 0 && total ? Math.floor(pool * p.damage / total) : 0;
    const equip = Math.floor((base + bonus) * gearBonus(gear[key]).gold);
    return {key, correct: p.done.length, damage: p.damage, base, bonus, equip, gold: base + bonus + equip};
  });
}

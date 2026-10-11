import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LEARNERS, defaultDraft, candidates, publish, join, simulate, currentQuestion, rewards, heartsOf, gearBonus} from './model.mjs';
const start = () => LEARNERS.reduce(join, publish(defaultDraft(), 1));
const pass = (r, who, n, character) => {for (let i = 0; i < n && currentQuestion(r, who); i += 1) r = simulate(r, who, currentQuestion(r, who).id, 'pass', character).round; return r;};
test('Workbook 4 P13-P17 gives 21 sentences on P13/P15/P17 only; invalid ranges publish nothing', () => {
  const d = defaultDraft(), r = publish(d, 1);
  assert.equal(r.questions.length, 21); assert.deepEqual([...new Set(r.questions.map(q => q.page))], [13, 15, 17]);
  assert.equal(publish({...d, start: '15', end: '15'}, 1).questions.length, 7); assert.equal(candidates({...d, start: '14', end: '14'}).length, 0);
  for (const patch of [{start: '17', end: '13'}, {start: ''}, {start: '2.4'}, {start: '900', end: '901'}, {classCode: 'E2'}]) {assert.equal(candidates({...d, ...patch}).length, 0); assert.throws(() => publish({...d, ...patch}, 1));}
});
test('Boss HP is sentences x 100 x 2 per classmate and only grows when someone enters for the first time', () => {
  let r = publish(defaultDraft(), 1); assert.equal(r.maxHp, 0); assert.equal(r.won, false);
  r = join(r, 'star'); assert.equal(r.maxHp, 4200); assert.equal(r.hp, 4200); assert.equal(r.energyThreshold, 2); assert.strictEqual(join(r, 'star'), r);
  r = pass(r, 'star', 1, 'girl-knight'); r = join(r, 'moon'); assert.equal(r.maxHp, 8400); assert.equal(r.hp, 8300); assert.equal(r.energyThreshold, 4);
  r = simulate(r, 'leaf', currentQuestion(r, 'leaf').id, 'pass', 'girl-knight').round; assert.deepEqual(r.joined, ['star', 'moon', 'leaf']); assert.equal(r.maxHp, 12600);
  assert.strictEqual(join(r, 'nobody'), r);
});
test('Published order immutable from draft; out-of-range selections filtered', () => {
  const draft = {...defaultDraft(), selected: ['w4-170-2', 'missing', 'w4-169-0', 'w4-170-2']}, round = publish(draft, 1);
  assert.deepEqual(round.questions.map(q => q.id), ['w4-170-2', 'w4-169-0']); draft.selected.reverse(); draft.start = '500'; assert.deepEqual(round.config.selected, ['w4-170-2', 'w4-169-0']);
});
test('Same sequence, independent progress, shared HP; 100 damage once per sentence', () => {
  let r = start(); const q = currentQuestion(r, 'star');
  assert.equal(r.maxHp, 12600); assert.equal(currentQuestion(r, 'moon').id, q.id); assert.strictEqual(simulate(r, 'star', r.questions[2].id, 'pass').round, r);
  r = simulate(r, 'star', q.id, 'pass').round; assert.equal(r.hp, 12500); assert.equal(currentQuestion(r, 'moon').id, q.id); assert.equal(r.progress.moon.damage, 0);
  assert.strictEqual(simulate(r, 'star', q.id, 'pass').round, r); assert.equal(r.events.length, 1);
});
test('Every third correct sentence: knight x2, mage x1.5 plus one extra class energy', () => {
  const knight = pass(start(), 'star', 3, 'girl-knight');
  assert.equal(knight.progress.star.damage, 400); assert.equal(knight.energy, 3); assert.equal(knight.events[2].skills.key, 'moon-slash'); assert.equal(knight.events[1].skills, undefined);
  const mage = pass(start(), 'star', 3, 'girl-mage');
  assert.equal(mage.progress.star.damage, 350); assert.equal(mage.energy, 4); assert.equal(mage.events[2].skills.key, 'star-cast');
});
test('Class combo fires at classmates x 2 energy for 5% max HP and is not personal damage', () => {
  let r = pass(start(), 'star', 5, 'girl-knight'); assert.equal(r.combos, 0); assert.equal(r.energy, 5);
  r = pass(r, 'moon', 1, 'boy-knight'); assert.equal(r.combos, 1); assert.equal(r.energy, 0);
  assert.equal(r.events.at(-1).teamwork.bonus_damage, 630); assert.equal(r.progress.moon.damage, 100); assert.equal(r.hp, 12600 - 600 - 100 - 630);
});
test('Skip costs exactly one heart, never damage or gold, others untouched; review later counts once and restores a heart', () => {
  let r = start(); const first = currentQuestion(r, 'star');
  for (let i = 0; i < 4; i += 1) {const q = currentQuestion(r, 'star'), result = simulate(r, 'star', q.id, 'skip'); assert.equal(result.counter, true); r = result.round; assert.strictEqual(simulate(r, 'star', q.id, 'skip').round, r);}
  assert.equal(r.hp, 12600); assert.equal(r.events.length, 0); assert.equal(r.progress.star.skipped.length, 4); assert.equal(r.progress.moon.cursor, 0); assert.equal(r.progress.star.hearts, 1); assert.equal(r.progress.moon.hearts, 5);
  for (const outcome of ['retry', 'technical']) assert.strictEqual(simulate(r, 'star', currentQuestion(r, 'star').id, outcome).round, r);
  r = simulate(r, 'star', first.id, 'pass').round; assert.equal(r.progress.star.skipped.length, 3); assert.equal(r.progress.star.cursor, 4); assert.equal(r.hp, 12500); assert.equal(r.progress.star.hearts, 2);
  assert.strictEqual(simulate(r, 'star', first.id, 'pass').round, r);
});
test('Zero hearts rests 10 seconds, blocks actions meanwhile, then returns to full hearts; technical failures never cost hearts', () => {
  let r = start();
  for (const outcome of ['retry', 'technical']) r = simulate(r, 'star', currentQuestion(r, 'star').id, outcome, 'girl-mage', 1000).round;
  assert.equal(r.progress.star.hearts, 5);
  for (let i = 0; i < 5; i += 1) r = simulate(r, 'star', currentQuestion(r, 'star').id, 'skip', 'girl-mage', 1000).round;
  assert.equal(r.progress.star.hearts, 0); assert.equal(r.progress.star.restUntil, 11000); assert.equal(heartsOf(r.progress.star, 5000), 0); assert.equal(r.hp, 12600);
  for (const outcome of ['pass', 'skip']) assert.strictEqual(simulate(r, 'star', currentQuestion(r, 'star').id, outcome, 'girl-mage', 10999).round, r);
  assert.equal(heartsOf(r.progress.star, 11000), 5); assert.notStrictEqual(simulate(r, 'moon', currentQuestion(r, 'moon').id, 'pass', 'boy-mage', 5000).round, r);
  r = simulate(r, 'star', currentQuestion(r, 'star').id, 'skip', 'girl-mage', 11000).round;
  assert.equal(r.progress.star.hearts, 4); assert.equal(r.progress.star.restUntil, 0); assert.deepEqual(rewards(r).map(x => x.gold), [0, 0, 0]);
});
test('Gear: per-tier bonuses add up and are capped at +10% gold and +30% damage; gold bonus applies to Boss gold only', () => {
  assert.deepEqual(gearBonus({weapon: 'oak-wand'}), {gold: 0, damage: 0, cost: 0});
  assert.deepEqual(gearBonus({weapon: 'star-wand', head: 'wizard-hat', cape: 'moon-cape'}), {gold: 0.06, damage: 0.12, cost: 510});
  const best = {weapon: 'sun-wand', shield: 'star-shield', head: 'gold-crown', cape: 'moon-cape', armor: 'moon-armor', boots: 'moon-boots'};
  assert.deepEqual(gearBonus(best), {gold: 0.10, damage: 0.30, cost: 1500});
  const hit = bonus => simulate(start(), 'star', 'w4-169-0', 'pass', 'girl-knight', 0, bonus).round.progress.star.damage;
  assert.equal(hit(gearBonus(best).damage), 130); assert.equal(hit(9), 130); assert.equal(hit(gearBonus({head: 'traveler-hat'}).damage), 102);
  const r = pass(start(), 'star', 12, 'girl-knight'), mine = rewards(r, {star: best})[0];
  assert.equal(r.won, false); assert.equal(mine.base, 30); assert.equal(mine.equip, 3); assert.equal(mine.gold, 33); assert.equal(rewards(r)[0].equip, 0);
});
test('The last hit is clamped and wins; afterwards sentences still count for base gold but deal no damage and cost no hearts', () => {
  const live = join(publish(defaultDraft(), 1), 'star'), last = {...live, hp: 5}, first = live.questions[0].id;
  let r = simulate(last, 'star', first, 'pass').round;
  assert.equal(r.hp, 0); assert.equal(r.won, true); assert.equal(r.events[0].damage, 5); assert.equal(r.events[0].won, true);
  r = simulate(r, 'moon', first, 'pass').round;
  assert.deepEqual(r.joined, ['star', 'moon']); assert.equal(r.maxHp, live.maxHp); assert.equal(r.hp, 0); assert.equal(r.events.length, 1); assert.equal(r.progress.moon.done.length, 1); assert.equal(r.progress.moon.damage, 0);
  const skipped = simulate(r, 'moon', currentQuestion(r, 'moon').id, 'skip'); assert.equal(skipped.counter, undefined); assert.equal(skipped.round.progress.moon.hearts, 5);
  const paid = rewards(r); assert.equal(paid[1].base, 3); assert.equal(paid[1].bonus, 0); assert.equal(paid[0].bonus, 40);
});
test('Gold: base is 3 per correct sentence capped at 30; 20 per entered classmate is shared by damage only on a win', () => {
  let r = pass(start(), 'star', 6, 'girl-knight'); r = pass(r, 'moon', 2, 'boy-knight');
  assert.deepEqual(rewards(r).map(x => x.gold), [18, 6, 0]); assert.equal(rewards(pass(start(), 'star', 12, 'girl-knight'))[0].base, 30);
  for (let i = 0; i < 21; i += 1) for (const who of LEARNERS) r = pass(r, who, 1, 'boy-knight');
  assert.equal(r.won, true); const paid = rewards(r);
  assert(paid.every(x => x.correct === 21 && x.base === 30)); assert(paid.reduce((sum, x) => sum + x.bonus, 0) <= 60); assert(paid[0].bonus >= paid[2].bonus);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scoreReading} from './scoring.mjs';
test('Full, punctuated or differently cased readings pass at 100', () => {
  for (const heard of ['He plays badminton.', ' he plays BADMINTON', 'Um, he plays badminton!']) assert.deepEqual([scoreReading('He plays badminton.', heard).score, scoreReading('He plays badminton.', heard).pass], [100, true]);
});
test('Contractions are compared in their expanded form', () => {
  assert.equal(scoreReading("I don't feel like doing anything.", 'I do not feel like doing anything').score, 100);
  assert.equal(scoreReading("Yes, I'd like to learn to play the violin.", "yes i'd like to learn to play the violin").score, 100);
});
test('Missing words lower the score; under 70 does not pass and marks the missed words', () => {
  const most = scoreReading('I will go bowling with my dad tomorrow.', 'I will go bowling with my dad'); assert.equal(most.score, 88); assert.equal(most.pass, true);
  const half = scoreReading('I play baseball after school.', 'I play'); assert.equal(half.score, 40); assert.equal(half.pass, false);
  assert.deepEqual(half.words.map(w => w.hit), [true, true, false, false, false]);
});
test('Unrelated or empty speech scores zero', () => {
  for (const heard of ['', '   ', 'the weather is nice', null]) assert.equal(scoreReading('She plays tennis.', heard).pass, false);
  assert.equal(scoreReading('She plays tennis.', 'hello there').score, 0);
});

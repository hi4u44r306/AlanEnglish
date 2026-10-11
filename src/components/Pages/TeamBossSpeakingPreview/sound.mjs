// Battle sound cues, synthesized with Web Audio: bright, short, 8-bit game style. No audio files, nothing to license.
// The owner picked this set by ear on 2026-10-11 after rejecting recorded foley clips.
function tone(ctx, out, t, {type = 'sine', f0, f1 = f0, dur, vol = 0.3, attack = 0.005}) {
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(f0, t); if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(vol, t + attack); gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain); gain.connect(out); osc.start(t); osc.stop(t + dur + 0.02);
}
function noise(ctx, out, t, {dur, vol = 0.3, f0 = 4000, f1 = 800, q = 1}) {
  const length = Math.ceil(ctx.sampleRate * dur), buffer = ctx.createBuffer(1, length, ctx.sampleRate), data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
  source.buffer = buffer; filter.type = 'bandpass'; filter.Q.value = q; filter.frequency.setValueAtTime(f0, t); filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gain.gain.setValueAtTime(vol, t); gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  source.connect(filter); filter.connect(gain); gain.connect(out); source.start(t); source.stop(t + dur + 0.02);
}
export const BATTLE_SOUNDS = {
  // Mage: a quick rising sparkle. Knight: a whoosh.
  cast(c, o, t) {[1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(c, o, t + i * 0.045, {type: 'triangle', f0: f, dur: 0.16, vol: 0.22})); tone(c, o, t, {f0: 600, f1: 1800, dur: 0.22, vol: 0.1});},
  slash(c, o, t) {noise(c, o, t, {dur: 0.16, vol: 0.4, f0: 5000, f1: 900, q: 0.8}); tone(c, o, t, {type: 'triangle', f0: 900, f1: 300, dur: 0.12, vol: 0.08});},
  hit(c, o, t) {tone(c, o, t, {f0: 320, f1: 70, dur: 0.14, vol: 0.5}); noise(c, o, t, {dur: 0.05, vol: 0.25, f0: 2500, f1: 1200});},
  'hit-heavy'(c, o, t) {tone(c, o, t, {f0: 200, f1: 45, dur: 0.3, vol: 0.6}); tone(c, o, t, {type: 'square', f0: 120, f1: 50, dur: 0.18, vol: 0.1}); noise(c, o, t, {dur: 0.09, vol: 0.3, f0: 1800, f1: 500});},
  hurt(c, o, t) {tone(c, o, t, {type: 'square', f0: 420, f1: 140, dur: 0.22, vol: 0.14}); tone(c, o, t + 0.02, {type: 'sawtooth', f0: 300, f1: 100, dur: 0.2, vol: 0.07});},
  'heart-break'(c, o, t) {tone(c, o, t, {type: 'triangle', f0: 659.3, dur: 0.12, vol: 0.25}); tone(c, o, t + 0.11, {type: 'triangle', f0: 523.3, f1: 392, dur: 0.22, vol: 0.25});},
  skill(c, o, t) {[523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => {tone(c, o, t + i * 0.05, {type: 'square', f0: f, dur: 0.1, vol: 0.09}); tone(c, o, t + i * 0.05, {type: 'triangle', f0: f * 2, dur: 0.12, vol: 0.12});});},
  combo(c, o, t) {[392, 523.3, 659.3, 784].forEach(f => tone(c, o, t, {type: 'triangle', f0: f, dur: 0.35, vol: 0.12})); [784, 987.8, 1174.7, 1568].forEach((f, i) => tone(c, o, t + 0.12 + i * 0.06, {type: 'square', f0: f, dur: 0.14, vol: 0.08}));},
  victory(c, o, t) {[[392, 0, 0.14], [523.3, 0.14, 0.14], [659.3, 0.28, 0.14], [784, 0.42, 0.28], [659.3, 0.72, 0.12], [784, 0.86, 0.12], [1046.5, 1.0, 0.6]].forEach(([f, at, d]) => {tone(c, o, t + at, {type: 'square', f0: f, dur: d, vol: 0.09}); tone(c, o, t + at, {type: 'triangle', f0: f / 2, dur: d, vol: 0.14});});},
  coins(c, o, t) {[0, 0.09, 0.2].forEach(at => {tone(c, o, t + at, {type: 'square', f0: 987.8, dur: 0.06, vol: 0.08}); tone(c, o, t + at + 0.06, {type: 'square', f0: 1318.5, dur: 0.2, vol: 0.08});});}
};

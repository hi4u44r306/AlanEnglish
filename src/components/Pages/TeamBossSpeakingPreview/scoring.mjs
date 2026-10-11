// Preview copy of the reading-completeness rule in supabase/functions/_shared/speaking-completeness.ts
// (readingWords / readingCoverage). The server stays the judge in production; this only lets the local
// preview react to a real on-device transcript without calling any backend.
export const PASS_SCORE = 70;
export const readingWords = text => text.toLowerCase().replace(/[’‘]/g, "'")
  .replace(/\bi'm\b/g, 'i am').replace(/\bcan't\b/g, 'cannot').replace(/\bwon't\b/g, 'will not').replace(/n't\b/g, ' not')
  .replace(/\b(you|we|they)'re\b/g, '$1 are').replace(/\b(i|you|we|they)'ve\b/g, '$1 have')
  .replace(/\b(it|he|she|that|what|where|who)'s\b/g, '$1 is')
  .match(/[a-z]+(?:'[a-z]+)?|\d+/g) || [];
export function scoreReading(expectedText, recognizedText) {
  const expected = readingWords(expectedText), heard = readingWords(String(recognizedText || ''));
  const table = Array.from({length: expected.length + 1}, () => new Uint16Array(heard.length + 1));
  for (let i = 1; i <= expected.length; i += 1) for (let j = 1; j <= heard.length; j += 1) {
    table[i][j] = expected[i - 1] === heard[j - 1] ? table[i - 1][j - 1] + 1 : Math.max(table[i - 1][j], table[i][j - 1]);
  }
  const hits = expected.map(() => false);
  let i = expected.length, j = heard.length;
  while (i && j) {
    if (expected[i - 1] === heard[j - 1]) {hits[i - 1] = true; i -= 1; j -= 1;}
    else if (table[i - 1][j] >= table[i][j - 1]) i -= 1; else j -= 1;
  }
  const score = expected.length ? Math.round(table[expected.length][heard.length] / expected.length * 100) : 0;
  return {score, pass: expected.length > 0 && score >= PASS_SCORE, words: expected.map((text, index) => ({text, hit: hits[index]}))};
}

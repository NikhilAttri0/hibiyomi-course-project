import { STARTER, starterWords } from '../starter-vocab';

describe('starter vocabulary', () => {
  it('covers every Genki lesson 1–23 with enough words', () => {
    for (let l = 1; l <= 23; l++) {
      const w = starterWords(l);
      expect(STARTER[l]?.theme).toBeTruthy();
      expect(w.length).toBeGreaterThanOrEqual(15);
      expect(new Set(w.map((x) => x.kana)).size).toBe(w.length);
      w.forEach((x) => {
        expect(x.kana).toMatch(/[぀-ヿ]/);
        expect(x.meaning.trim()).not.toBe('');
      });
    }
  });
  it('verbs end in a verb ending', () => {
    for (let l = 1; l <= 23; l++)
      starterWords(l)
        .filter((w) => w.category.endsWith('verbs'))
        .forEach((w) => expect(w.kana).toMatch(/[うくぐすつぬぶむる]$/));
  });
});

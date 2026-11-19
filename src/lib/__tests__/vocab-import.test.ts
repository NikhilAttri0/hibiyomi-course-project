import { parseVocabText } from '../vocab-import';

describe('parseVocabText', () => {
  it('reads book-style columns with category headings', () => {
    const { words, skipped } = parseVocabText(`Nouns
* おなか          stomach
あし    足   leg; foot
〜だい  〜代   charge; fee
ふつかよい 二日酔い hangover
い-adjectives
せまい 狭い narrow; not spacious`);
    expect(skipped).toEqual([]);
    expect(words).toHaveLength(5);
    expect(words[0]).toEqual({ term: 'おなか', kana: 'おなか', meaning: 'stomach', category: 'Nouns' });
    expect(words[1]).toEqual({ term: '足', kana: 'あし', meaning: 'leg; foot', category: 'Nouns' });
    expect(words[2]).toEqual({ term: '〜代', kana: '〜だい', meaning: 'charge; fee', category: 'Nouns' });
    expect(words[4].category).toBe('い-adjectives');
  });
  it('reads comma and tab separated lines and kanji-first order', () => {
    const { words } = parseVocabText('あし, 足, leg; foot\nのど\tthroat\n足 あし leg');
    expect(words.map((w) => [w.term, w.kana, w.meaning])).toEqual([
      ['足', 'あし', 'leg; foot'],
      ['のど', 'のど', 'throat'],
      ['足', 'あし', 'leg'],
    ]);
  });
  it('skips page furniture', () => {
    const { words, skipped } = parseVocabText('Vocabulary\n単語\n123');
    expect(words).toHaveLength(0);
    expect(skipped.length).toBeGreaterThan(0);
  });
});

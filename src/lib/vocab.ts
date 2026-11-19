import { VOCAB_N5 } from './vocab-n5';
import { VOCAB_N4 } from './vocab-n4';

export interface Word {
  term: string;
  kana: string;
  meaning: string;
}
export interface KanjiVocab {
  words: Word[];
  sentence: { jp: string; en: string } | null;
}
export interface LessonWord extends Word {
  /** Kanji this word was listed under ('' for teacher-added words). */
  kanji: string;
  sentence?: { jp: string; en: string };
  /** Teacher/admin-added word id (deletable). */
  customId?: string;
}

const ALL = { ...VOCAB_N5, ...VOCAB_N4 };

export function kanjiVocab(char: string): KanjiVocab {
  const row = ALL[char];
  if (!row) return { words: [], sentence: null };
  const [words, jp, en] = row;
  return { words: words.map(([term, kana, meaning]) => ({ term, kana, meaning })), sentence: { jp, en } };
}

/** All words for a set of kanji (one Genki lesson), de-duplicated, in kanji order. */
export function wordsForKanji(chars: string[]): LessonWord[] {
  const seen = new Set<string>();
  const out: LessonWord[] = [];
  for (const c of chars) {
    const v = kanjiVocab(c);
    v.words.forEach((w, i) => {
      if (seen.has(w.term)) return;
      seen.add(w.term);
      out.push({ ...w, kanji: c, sentence: i === 0 && v.sentence ? v.sentence : undefined });
    });
  }
  return out;
}

export const VOCAB_KANJI_COUNT = Object.keys(ALL).length;

/**
 * Parses a lesson word list pasted by a teacher — e.g. copied from the textbook PDF,
 * a spreadsheet, or typed by hand — into rows with a part-of-speech category.
 *
 * Accepted line shapes (one word per line):
 *   おなか            stomach
 *   あし   足         leg; foot
 *   〜だい  〜代       charge; fee
 *   あし, 足, leg; foot         (comma or tab separated: reading, kanji, meaning)
 *   あし, leg; foot             (reading, meaning)
 * Category headings such as "Nouns", "い-adjectives", "U-verbs", "Adverbs and Other Expressions"
 * set the category for the lines that follow.
 */

export interface ImportedWord {
  term: string; // written form (kanji if given, otherwise the reading)
  kana: string;
  meaning: string;
  category: string;
}

const CJK = /[一-鿿々]/; // kanji incl. 々
const KANA_ONLY = /^[぀-ヿー〜~ー・()（）\s]+$/;
const JAPANESE = /[぀-ヿ一-鿿々〜]/;

const CATEGORIES: [RegExp, string][] = [
  [/^nouns?\b/i, 'Nouns'],
  [/^(い|i)\s*[-‐–]?\s*adj(ective)?s?\b/i, 'い-adjectives'],
  [/^(な|na)\s*[-‐–]?\s*adj(ective)?s?\b/i, 'な-adjectives'],
  [/^u\s*[-‐–]?\s*verbs?\b/i, 'U-verbs'],
  [/^ru\s*[-‐–]?\s*verbs?\b/i, 'Ru-verbs'],
  [/^irregular\s+verbs?\b/i, 'Irregular verbs'],
  [/^adverbs?\b/i, 'Adverbs and other expressions'],
  [/^(other\s+)?expressions?\b/i, 'Adverbs and other expressions'],
  [/^counters?\b/i, 'Counters'],
  [/^numbers?\b/i, 'Numbers'],
  [/^(question\s+words?|interrogatives?)\b/i, 'Question words'],
  [/^verbs?\b/i, 'Verbs'],
  [/^adjectives?\b/i, 'Adjectives'],
];

export function categoryOf(line: string): string | null {
  const t = line.replace(/[*＊•·:：#]/g, '').trim();
  if (!t || JAPANESE.test(t.replace(/^(い|な)/, '')) || t.length > 40) return null;
  for (const [re, name] of CATEGORIES) if (re.test(t)) return name;
  return null;
}

export const CATEGORY_ORDER = [
  'Nouns',
  'い-adjectives',
  'な-adjectives',
  'U-verbs',
  'Ru-verbs',
  'Irregular verbs',
  'Verbs',
  'Adjectives',
  'Adverbs and other expressions',
  'Question words',
  'Numbers',
  'Counters',
  '',
];

export function parseVocabText(text: string, startCategory = ''): { words: ImportedWord[]; skipped: string[] } {
  let category = startCategory;
  const words: ImportedWord[] = [];
  const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^[\s*＊•·°※]+/, '').replace(/\s+$/, '');
    if (!line) continue;
    const cat = categoryOf(line);
    if (cat) {
      category = cat;
      continue;
    }
    if (!JAPANESE.test(line)) {
      skipped.push(raw.trim());
      continue;
    }

    let parts: string[];
    if (/[\t,，、]/.test(line) && line.split(/\t|\s*[,，]\s*/).length >= 2) {
      parts = line.split(/\t+|\s*[,，]\s*/).map((p) => p.trim()).filter(Boolean);
    } else {
      // Whitespace layout: Japanese tokens first, English meaning after.
      const tokens = line.split(/[\s\u3000]+/).filter(Boolean);
      const jp: string[] = [];
      let i = 0;
      while (i < tokens.length && JAPANESE.test(tokens[i]) && jp.length < 2) jp.push(tokens[i++]);
      parts = [...jp, tokens.slice(i).join(' ')].filter(Boolean);
    }

    let kana = '';
    let kanji = '';
    let meaning = '';
    if (parts.length >= 3 && JAPANESE.test(parts[1])) {
      [kana, kanji] = [parts[0], parts[1]];
      meaning = parts.slice(2).join(', ');
    } else if (parts.length >= 2) {
      kana = parts[0];
      meaning = parts.slice(1).join(', ');
    }
    // "足 あし leg" (kanji first) → swap
    if (kanji && CJK.test(kana) && KANA_ONLY.test(kanji)) [kana, kanji] = [kanji, kana];
    // A lone first token that has kanji is the written form (reading unknown)
    if (!kanji && CJK.test(kana) && !KANA_ONLY.test(kana)) {
      kanji = kana;
      kana = '';
    }
    meaning = meaning.trim();
    if (!(kana || kanji) || !meaning || JAPANESE.test(meaning.replace(/[〜~]/g, '')) && !/[a-z]/i.test(meaning)) {
      skipped.push(raw.trim());
      continue;
    }
    words.push({ term: kanji || kana, kana, meaning, category });
  }
  return { words, skipped };
}

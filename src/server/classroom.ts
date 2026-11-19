import { all, one } from './db';
import { HttpError } from './auth';

export const ITEM_KINDS = ['file', 'link', 'recording', 'homework', 'practice', 'note'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // Vercel limits request bodies to ~4.5 MB

export function cleanUrl(u: unknown): string | null {
  if (typeof u !== 'string' || !u.trim()) return null;
  let url: URL;
  try {
    url = new URL(u.trim());
  } catch {
    throw new HttpError(400, 'Enter a full link starting with https://');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new HttpError(400, 'Only http(s) links are allowed.');
  return url.toString();
}

export async function sectionBatch(sectionId: string): Promise<string> {
  const s = await one<{ batch_id: string }>('select batch_id from class_sections where id = ?', [sectionId]);
  if (!s) throw new HttpError(404, 'Section not found.');
  return s.batch_id;
}

export async function itemRow(itemId: string) {
  const it = await one<Record<string, unknown> & { batch_id: string; kind: ItemKind; accepts_submissions: number; kanji_ids: string | null; file_id: string | null }>(
    'select * from class_items where id = ?',
    [itemId]
  );
  if (!it) throw new HttpError(404, 'Item not found.');
  return it;
}

export async function fileMeta(ids: string[]) {
  const list = ids.filter(Boolean);
  if (!list.length) return {} as Record<string, { id: string; name: string; size: number }>;
  const rows = await all<{ id: string; name: string; size: number }>(
    `select id, name, size from files where id in (${list.map(() => '?').join(',')})`,
    list
  );
  return Object.fromEntries(rows.map((r) => [r.id, { ...r, size: Number(r.size) }]));
}

export function parseKanjiIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string').slice(0, 300);
  if (typeof raw === 'string' && raw) {
    try {
      return parseKanjiIds(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

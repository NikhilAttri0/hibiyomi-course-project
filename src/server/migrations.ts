import type { Client } from '@libsql/client';

/**
 * Versioned database migrations. Each runs once, in order, and is recorded in schema_migrations.
 * NEVER edit a migration that has shipped — add a new one at the end instead.
 */
export interface Migration {
  id: string;
  up: (c: Client) => Promise<void>;
}

const exec = (stmts: string[]) => async (c: Client) => {
  for (const s of stmts) await c.execute(s);
};

async function hasColumn(c: Client, table: string, column: string) {
  const r = await c.execute(`pragma table_info(${table})`);
  return r.rows.some((row) => row.name === column);
}
async function addColumn(c: Client, table: string, column: string, def: string) {
  if (!(await hasColumn(c, table, column))) await c.execute(`alter table ${table} add column ${column} ${def}`);
}

/** 0001 — everything up to the classroom, quizzes and vocabulary (safe on databases made by earlier versions). */
const BASE = [
  `create table if not exists users (
     id text primary key,
     email text not null unique,
     full_name text not null default '',
     role text not null default 'student' check (role in ('student','teacher','admin')),
     password_hash text not null,
     must_change_password integer not null default 0,
     created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   )`,
  `create table if not exists batches (
     id text primary key,
     name text not null,
     level text not null default 'N5',
     term text,
     join_code text not null unique,
     created_by text references users(id) on delete set null,
     created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   )`,
  `create table if not exists batch_teachers (
     batch_id text not null references batches(id) on delete cascade,
     teacher_id text not null references users(id) on delete cascade,
     assigned_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
     primary key (batch_id, teacher_id)
   )`,
  `create table if not exists batch_students (
     batch_id text not null references batches(id) on delete cascade,
     student_id text not null references users(id) on delete cascade,
     joined_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
     primary key (batch_id, student_id)
   )`,
  `create table if not exists student_state (
     student_id text primary key references users(id) on delete cascade,
     state text not null,
     avg_mastery real not null default 0,
     mastered integer not null default 0,
     weak integer not null default 0,
     due_count integer not null default 0,
     reviews_total integer not null default 0,
     reviews_7d integer not null default 0,
     accuracy_7d integer not null default 0,
     streak integer not null default 0,
     last_active text,
     updated_at text not null
   )`,
  `create table if not exists review_events (
     id integer primary key autoincrement,
     student_id text not null references users(id) on delete cascade,
     kanji text not null,
     kind text not null check (kind in ('card','quiz')),
     grade text,
     mode text,
     correct integer not null,
     created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   )`,
  `create index if not exists review_events_student_time on review_events (student_id, created_at)`,
  `create index if not exists batch_students_student on batch_students (student_id)`,
  `create index if not exists batch_teachers_teacher on batch_teachers (teacher_id)`,
  `create table if not exists app_settings (key text primary key, value text not null)`,
  `create table if not exists rate_limits (
     key text primary key,
     count integer not null default 0,
     window_start integer not null,
     locked_until integer not null default 0
   )`,
  // ---------- Classroom (LMS) ----------
  `create table if not exists class_info (
     batch_id text primary key references batches(id) on delete cascade,
     live_url text,
     live_note text,
     updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   )`,
  `create table if not exists class_sections (
     id text primary key,
     batch_id text not null references batches(id) on delete cascade,
     title text not null,
     position integer not null default 0,
     locked integer not null default 0,
     created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   )`,
  `create index if not exists class_sections_batch on class_sections (batch_id, position)`,
  `create table if not exists class_items (
     id text primary key,
     section_id text not null references class_sections(id) on delete cascade,
     batch_id text not null references batches(id) on delete cascade,
     kind text not null check (kind in ('file','link','recording','homework','practice','note')),
     title text not null,
     body text,
     url text,
     file_id text,
     kanji_ids text,
     due_at text,
     locked integer not null default 0,
     position integer not null default 0,
     created_by text references users(id) on delete set null,
     created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   )`,
  `create index if not exists class_items_section on class_items (section_id, position)`,
  `create table if not exists files (
     id text primary key,
     owner_id text references users(id) on delete set null,
     batch_id text references batches(id) on delete cascade,
     name text not null,
     mime text not null,
     size integer not null,
     data blob not null,
     created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   )`,
  `create table if not exists submissions (
     id text primary key,
     item_id text not null references class_items(id) on delete cascade,
     student_id text not null references users(id) on delete cascade,
     file_id text,
     note text,
     submitted_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
     unique (item_id, student_id)
   )`,
  // ---------- Teacher-added vocabulary ----------
  `create table if not exists vocab_custom (
     id text primary key,
     track text not null check (track in ('N5','N4')),
     lesson integer not null,
     term text not null,
     kana text not null default '',
     meaning text not null,
     created_by text references users(id) on delete set null,
     created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   )`,
  `create index if not exists vocab_custom_lesson on vocab_custom (track, lesson)`,
  // ---------- Quiz results (vocabulary, kanji words, kanji, writing) ----------
  `create table if not exists quiz_results (
     id integer primary key autoincrement,
     student_id text not null references users(id) on delete cascade,
     kind text not null check (kind in ('vocab','kanji-words','kanji','writing')),
     track text,
     lesson integer,
     score integer not null,
     total integer not null,
     created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   )`,
  `create index if not exists quiz_results_student on quiz_results (student_id, created_at)`,
];

export const MIGRATIONS: Migration[] = [
  { id: '0001_base', up: exec(BASE) },
  {
    id: '0002_submission_and_vocab_columns',
    up: async (c) => {
      await addColumn(c, 'class_items', 'accepts_submissions', 'integer not null default 0');
      await addColumn(c, 'vocab_custom', 'category', "text not null default ''");
      await addColumn(c, 'vocab_custom', 'position', 'integer not null default 0');
    },
  },
  {
    // Multiple institutions on one site. Existing data moves into a default institution;
    // learners without a batch join the platform's Self-study organization.
    id: '0003_organizations',
    up: async (c) => {
      await c.execute(`create table if not exists organizations (
         id text primary key,
         name text not null,
         slug text not null unique,
         kind text not null default 'institution' check (kind in ('institution','self')),
         created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       )`);
      await c.execute(`create table if not exists org_members (
         org_id text not null references organizations(id) on delete cascade,
         user_id text not null references users(id) on delete cascade,
         role text not null check (role in ('owner','admin','teacher','student')),
         joined_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
         primary key (org_id, user_id)
       )`);
      await c.execute('create index if not exists org_members_user on org_members (user_id)');
      await addColumn(c, 'batches', 'org_id', 'text references organizations(id)');
      await addColumn(c, 'vocab_custom', 'org_id', 'text');
      await c.execute(`insert or ignore into organizations (id, name, slug, kind) values ('org-default', 'My Institute', 'my-institute', 'institution')`);
      await c.execute(`insert or ignore into organizations (id, name, slug, kind) values ('org-self', 'Self-study', 'self-study', 'self')`);
      await c.execute(`update batches set org_id = 'org-default' where org_id is null`);
      await c.execute(`update vocab_custom set org_id = 'org-default' where org_id is null`);
      await c.execute(`insert or ignore into org_members (org_id, user_id, role) select 'org-default', id, 'owner' from users where role = 'admin'`);
      await c.execute(`insert or ignore into org_members (org_id, user_id, role) select 'org-default', id, 'teacher' from users where role = 'teacher'`);
      await c.execute(`insert or ignore into org_members (org_id, user_id, role)
                         select distinct 'org-default', student_id, 'student' from batch_students`);
      await c.execute(`insert or ignore into org_members (org_id, user_id, role)
                         select 'org-self', id, 'student' from users
                          where role = 'student' and id not in (select student_id from batch_students)`);
    },
  },
];

export async function migrate(c: Client) {
  await c.execute(`create table if not exists schema_migrations (
     id text primary key,
     applied_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   )`);
  const done = new Set((await c.execute('select id from schema_migrations')).rows.map((r) => String(r.id)));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await m.up(c);
    await c.execute({ sql: 'insert or ignore into schema_migrations (id) values (?)', args: [m.id] });
  }
}

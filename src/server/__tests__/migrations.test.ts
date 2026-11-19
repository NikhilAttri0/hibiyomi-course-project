/**
 * @jest-environment node
 */
import { createClient } from '@libsql/client';
import { MIGRATIONS, migrate } from '../migrations';

const rows = async (c: ReturnType<typeof createClient>, sql: string) => (await c.execute(sql)).rows.map((r) => ({ ...r }));

describe('database migrations', () => {
  it('builds a fresh database and is safe to run twice', async () => {
    const c = createClient({ url: ':memory:' });
    await migrate(c);
    await migrate(c);
    const applied = await rows(c, 'select id from schema_migrations order by id');
    expect(applied.map((r) => r.id)).toEqual(MIGRATIONS.map((m) => m.id));
    const orgs = await rows(c, 'select id, kind from organizations order by id');
    expect(orgs).toEqual([
      { id: 'org-default', kind: 'institution' },
      { id: 'org-self', kind: 'self' },
    ]);
  });

  it('upgrades an older database: existing people and batches move into organizations', async () => {
    const c = createClient({ url: ':memory:' });
    // Database as an earlier version left it: only the base schema.
    await MIGRATIONS[0].up(c);
    const ins = (sql: string) => c.execute(sql);
    await ins(`insert into users (id, email, role, password_hash) values ('a','a@x','admin','h'), ('t','t@x','teacher','h'), ('s1','s1@x','student','h'), ('s2','s2@x','student','h')`);
    await ins(`insert into batches (id, name, level, join_code) values ('b1','N5 Mon','N5','N5-AAAA')`);
    await ins(`insert into batch_students (batch_id, student_id) values ('b1','s1')`);
    await migrate(c);
    const members = await rows(c, 'select org_id, user_id, role from org_members order by user_id');
    expect(members).toEqual([
      { org_id: 'org-default', user_id: 'a', role: 'owner' },
      { org_id: 'org-default', user_id: 's1', role: 'student' },
      { org_id: 'org-self', user_id: 's2', role: 'student' },
      { org_id: 'org-default', user_id: 't', role: 'teacher' },
    ]);
    expect(await rows(c, 'select org_id from batches')).toEqual([{ org_id: 'org-default' }]);
    const cols = (await rows(c, 'pragma table_info(class_items)')).map((r) => r.name);
    expect(cols).toContain('accepts_submissions');
  });
});

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { one, run } from '@/server/db';
import { HttpError, body, handler, hashPassword, isEmail, newId, requireUser } from '@/server/auth';
import { ensureMember, slugify, syncAccountRole } from '@/server/orgs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Platform admin: add an institution and (optionally) its owner. */
export const POST = handler(async (req: Request) => {
  await requireUser(['admin']);
  const { name, ownerEmail, ownerName } = await body<{ name?: string; ownerEmail?: string; ownerName?: string }>(req);
  if (!name?.trim()) throw new HttpError(400, 'Give the institution a name.');
  let slug = slugify(name);
  for (let i = 2; await one('select 1 from organizations where slug = ?', [slug]); i++) slug = `${slugify(name)}-${i}`;
  const id = newId();
  await run(`insert into organizations (id, name, slug, kind) values (?, ?, ?, 'institution')`, [id, name.trim().slice(0, 80), slug]);

  let owner: { userId: string; tempPassword?: string } | null = null;
  if (ownerEmail?.trim()) {
    if (!isEmail(ownerEmail)) throw new HttpError(400, 'Enter a valid owner email.');
    const mail = ownerEmail.trim().toLowerCase();
    const existing = await one<{ id: string }>('select id from users where email = ?', [mail]);
    if (existing) {
      owner = { userId: existing.id };
    } else {
      const pw = `Yoisho-${randomBytes(4).toString('hex')}`;
      const uid = newId();
      await run(`insert into users (id, email, full_name, role, password_hash, must_change_password) values (?, ?, ?, 'teacher', ?, 1)`, [
        uid, mail, (ownerName ?? '').trim(), hashPassword(pw),
      ]);
      owner = { userId: uid, tempPassword: pw };
    }
    await ensureMember(id, owner.userId, 'owner');
    await syncAccountRole(owner.userId);
  }
  return NextResponse.json({ org: await one('select * from organizations where id = ?', [id]), owner });
});

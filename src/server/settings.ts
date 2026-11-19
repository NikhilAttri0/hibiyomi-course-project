import { all, one, run } from './db';

/** Admin-controlled switches stored in the database. */
export interface AppSettings {
  signupRequiresCode: boolean;
}

export async function getSettings(): Promise<AppSettings> {
  const row = await one<{ value: string }>(`select value from app_settings where key = 'signup_requires_code'`);
  // Off by default: anyone may sign up and learn on their own (self-study); a code puts them in a class.
  return { signupRequiresCode: row ? row.value === '1' : false };
}

export async function setSignupRequiresCode(on: boolean) {
  await run(
    `insert into app_settings (key, value) values ('signup_requires_code', ?) on conflict (key) do update set value = excluded.value`,
    [on ? '1' : '0']
  );
}

export async function hasAnyUser(): Promise<boolean> {
  return (await all('select 1 from users limit 1')).length > 0;
}

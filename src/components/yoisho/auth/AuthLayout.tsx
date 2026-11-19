'use client';

import Link from 'next/link';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Logo } from '../ui';

export default function AuthLayout({ title, jp, sub, children }: { title: string; jp: string; sub: string; children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-brand text-white p-12">
        <div className="absolute inset-0 seigaiha opacity-70" />
        <div className="absolute -right-10 -bottom-24 font-mincho font-extrabold text-[420px] leading-none text-white/10 select-none">学</div>
        <Link href="/" className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-[30%] bg-white text-[#141414] font-mincho text-2xl font-extrabold">よ</div>
          <div>
            <div className="text-lg font-extrabold leading-tight">Yoisho Learn</div>
            <div className="text-xs text-white/75">by Yoisho Academy</div>
          </div>
        </Link>
        <div className="relative max-w-md">
          <p className="font-jp text-white/80">忘れる前に、もう一度。</p>
          <h2 className="mt-2 text-4xl font-extrabold tracking-tight leading-tight">Review each kanji right before you would forget it.</h2>
          <p className="mt-4 text-white/80 leading-relaxed">
            Students practise with spaced repetition. Teachers see exactly which kanji their batch is losing.
          </p>
        </div>
        <div className="relative flex gap-6 text-sm text-white/80">
          <span>漢字 · Kanji</span>
          <span>語彙 · Vocabulary</span>
          <span>JLPT N5 → N1</span>
        </div>
      </aside>

      <main className="flex flex-col px-5 sm:px-10 py-8">
        <Link href="/" className="lg:hidden flex items-center gap-2.5 mb-10">
          <Logo size={36} />
          <span className="font-extrabold">Yoisho Learn</span>
        </Link>
        <div className="flex-1 grid place-items-center">
          <div className="w-full max-w-sm animate-rise">
            <div className="font-jp text-sm text-brand">{jp}</div>
            <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-ink-3">{sub}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function Field({
  id,
  label,
  hint,
  ...rest
}: { id: string; label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-semibold">{label}</span>
      <input id={id} className="input mt-1.5 bg-surface border-line/80" {...rest} />
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-2xl bg-sakura-soft text-sakura text-sm font-medium px-4 py-3">
      {message}
    </div>
  );
}

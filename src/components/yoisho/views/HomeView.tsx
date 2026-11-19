'use client';

import { Bar as RBar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { KANJI_BY_CHAR, KANJI_BY_ID, primaryReading, timeAgo, useLearn } from '@/lib/learn-store';
import { Icon } from '../icons';
import { useNav } from '../nav';
import LiveClassStrip from '../LiveClassStrip';
import { Bar, BandChip, Ring, SectionTitle, StatTile, recallTone } from '../ui';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'おはよう';
  if (h < 18) return 'こんにちは';
  return 'こんばんは';
}

export default function HomeView() {
  const s = useLearn();
  const { go } = useNav();
  const due = s.dueQueue.length;
  const atRiskCount = s.views.filter((v) => v.srs.lastReview !== null && v.recall < 0.7).length;
  const newCount = s.dueQueue.filter((v) => v.srs.lastReview === null).length;
  const reviewCount = due - newCount;
  const firstName = s.student.name.split(' ')[0];

  const pairs = s.deck.filter((k) => k.confusionWith && KANJI_BY_CHAR[k.confusionWith])
    .filter((k) => k.character < (k.confusionWith as string))
    .map((k) => [k, KANJI_BY_CHAR[k.confusionWith as string]] as const);

  const recent = [...s.log].sort((a, b) => b.ts - a.ts).slice(0, 6);

  return (
    <div className="space-y-6">
      <LiveClassStrip />
      {/* Hero */}
      <section className="relative overflow-hidden rounded-4xl bg-brand text-white shadow-brand animate-rise">
        <div className="absolute inset-0 seigaiha opacity-70" />
        <div className="absolute -right-6 -bottom-16 font-mincho font-extrabold text-[220px] leading-none text-white/10 select-none pointer-events-none">
          学
        </div>
        <div className="relative grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <span className="chip bg-white/20 text-white backdrop-blur">
              <Icon name="sparkle" size={13} /> JLPT {s.track} · {s.track === 'N5' ? 'Genki I' : 'Genki II'}
            </span>
            <h2 className="mt-4 font-jp text-3xl sm:text-4xl font-bold tracking-tight">
              {greeting()}、{firstName}さん
            </h2>
            <p className="mt-2 max-w-lg text-white/85 text-[15px] leading-relaxed">
              {due > 0 ? (
                <>
                  {reviewCount > 0 && (
                    <>
                      <b className="text-white">{reviewCount} kanji</b> are due for review
                    </>
                  )}
                  {reviewCount > 0 && newCount > 0 && ' and '}
                  {newCount > 0 && (
                    <>
                      <b className="text-white">{newCount} new kanji</b> are ready to learn
                    </>
                  )}
                  {atRiskCount > 0 && (
                    <>
                      {' '}and <b className="text-white">{atRiskCount}</b> are close to slipping from memory
                    </>
                  )}
                  . A short session now locks them in.
                </>
              ) : (
                <>Nothing is due right now — great work. Take a quiz or explore the library to keep momentum.</>
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => go('study')} className="btn bg-white text-[#141414] hover:bg-white/90 shadow-lift">
                <Icon name="play" size={15} />
                {due > 0 ? `Start review · ${due}` : 'Study ahead'}
              </button>
              <button onClick={() => go('quiz')} className="btn bg-black/15 text-white hover:bg-black/25 border border-white/25">
                <Icon name="bolt" size={15} /> Quick quiz
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 md:flex-col md:gap-2 rounded-3xl bg-black/10 border border-white/20 p-4 md:p-5 backdrop-blur-sm">
            <Ring value={s.today.pct} size={104} stroke={9} tone="white">
              <div className="text-center">
                <div className="text-2xl font-extrabold tabular leading-none">{s.today.reviews}</div>
                <div className="text-[11px] text-white/70 mt-1">of {s.today.goal}</div>
              </div>
            </Ring>
            <div className="md:text-center">
              <div className="text-sm font-bold">Today&apos;s goal</div>
              <div className="text-xs text-white/70">{s.today.pct >= 100 ? 'Complete! 🎉' : `${s.today.goal - s.today.reviews > 0 ? s.today.goal - s.today.reviews : 0} to go`}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile icon="flame" label="Streak" value={s.streak} unit="days" hint="Study every day to grow it" tone="brand" />
        <StatTile icon="target" label="Accuracy" value={s.accuracy} unit="%" hint="Last 7 days" tone="matcha" />
        <StatTile icon="trophy" label="Mastered" value={s.bands.mastered} unit={`/ ${s.views.length}`} hint={`${s.views.length - s.bands.new} started · ${s.bands.weak} need work`} tone="kin" />
        <StatTile icon="layers" label="Avg. mastery" value={s.avgMastery} unit="%" hint="Across 5 skills" tone="ai" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6 min-w-0">
          {/* Likely to forget */}
          <div className="card card-pad">
            <SectionTitle
              jp="忘れそう"
              title="Likely to forget next"
              sub="Predicted recall right now, from your personal forgetting curve"
            />
            {s.atRisk.length === 0 && (
              <p className="text-sm text-ink-3 py-6 text-center">
                Review a few kanji first — your forgetting curve appears here after your first session.
              </p>
            )}
            <ul className="divide-y divide-line/70">
              {s.atRisk.map((v) => (
                <li key={v.kanji.id}>
                  <button
                    onClick={() => go('library', v.kanji.id)}
                    className="w-full flex items-center gap-4 py-3 text-left group"
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-paper border border-line/70 font-mincho text-2xl font-bold group-hover:border-brand transition">
                      {v.kanji.character}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold truncate">{v.kanji.meanings.slice(0, 2).join(', ')}</span>
                        {s.settings.showFurigana && <span className="font-jp text-xs text-ink-3">{primaryReading(v.kanji)}</span>}
                      </span>
                      <Bar value={v.recall * 100} tone={recallTone(v.recall)} className="mt-2 max-w-[260px]" />
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-sm font-bold tabular" style={{ color: `rgb(var(--${recallTone(v.recall)}))` }}>
                        {Math.round(v.recall * 100)}%
                      </span>
                      <span className="block text-[11px] text-ink-3">{v.isDue ? 'due now' : 'recall'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Activity chart */}
          <div className="card card-pad">
            <SectionTitle jp="学習記録" title="Last 14 days" sub={`${s.last14.reduce((a, d) => a + d.reviews, 0)} reviews · goal ${s.today.goal}/day`} />
            <div className="h-44 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.last14} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval={1}
                    tick={{ fontSize: 11, fill: 'rgb(var(--ink-3))' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgb(var(--sunken) / .6)', radius: 8 }}
                    contentStyle={{
                      background: 'rgb(var(--surface))',
                      border: '1px solid rgb(var(--line))',
                      borderRadius: 14,
                      fontSize: 12,
                      color: 'rgb(var(--ink))',
                    }}
                    formatter={(val: number, name: string) => [val, name === 'correct' ? 'Correct' : 'Reviews']}
                  />
                  <RBar dataKey="reviews" fill="rgb(var(--brand))" radius={[8, 8, 8, 8]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-6 min-w-0">
          {/* Confusion pairs */}
          <div className="relative overflow-hidden rounded-3xl bg-sumi text-white p-5 sm:p-6">
            <div className="absolute inset-0 seigaiha opacity-30" />
            <div className="relative">
              <div className="font-jp text-xs text-brand">紛らわしい漢字</div>
              <h2 className="text-lg font-bold">Look-alike traps</h2>
              <p className="text-sm text-white/60 mt-0.5">Pairs you&apos;re most likely to mix up</p>
              <div className="mt-4 space-y-2.5">
                {pairs.slice(0, 3).map(([a, b]) => (
                  <button
                    key={a.id}
                    onClick={() => go('library', a.id)}
                    className="w-full flex items-center gap-3 rounded-2xl bg-white/[.06] hover:bg-white/[.1] border border-white/10 p-3 transition text-left"
                  >
                    <span className="font-mincho text-3xl font-bold">{a.character}</span>
                    <span className="text-white/40 text-sm">vs</span>
                    <span className="font-mincho text-3xl font-bold text-brand">{b.character}</span>
                    <span className="ml-auto text-right text-xs text-white/60 leading-snug">
                      {a.meanings[0]}
                      <br />
                      {b.meanings[0]}
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={() => go('quiz')} className="btn mt-4 w-full bg-brand text-brand-ink hover:bg-brand-strong">
                Practise in a quiz
              </button>
            </div>
          </div>

          {/* Mastery split */}
          <div className="card card-pad">
            <SectionTitle jp="習熟度" title="Mastery split" />
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              {(['mastered', 'learning', 'weak'] as const).map((b) => (
                <div
                  key={b}
                  style={{
                    width: `${(s.bands[b] / Math.max(1, s.views.length)) * 100}%`,
                    background: `rgb(var(--${b === 'mastered' ? 'matcha' : b === 'learning' ? 'kin' : 'sakura'}))`,
                  }}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(['mastered', 'learning', 'weak'] as const).map((b) => (
                <span key={b} className="flex items-center gap-1.5">
                  <BandChip band={b} />
                  <span className="text-sm font-bold tabular">{s.bands[b]}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div className="card card-pad">
            <SectionTitle jp="最近" title="Recent activity" />
            <ul className="space-y-3">
              {recent.map((e) => {
                const k = KANJI_BY_ID[e.kanjiId];
                return (
                  <li key={e.id} className="flex items-center gap-3">
                    <span
                      className="grid h-9 w-9 place-items-center rounded-xl font-mincho text-lg font-bold"
                      style={{ background: `rgb(var(--${e.correct ? 'matcha' : 'sakura'}-soft))`, color: `rgb(var(--${e.correct ? 'matcha' : 'sakura'}))` }}
                    >
                      {k?.character}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate">
                        {e.kind === 'card' ? `Reviewed · ${e.grade}` : `Quiz · ${e.mode ?? 'mixed'}`}
                      </span>
                      <span className="block text-xs text-ink-3">{k?.meanings[0]}</span>
                    </span>
                    <span className="text-xs text-ink-3 whitespace-nowrap">{timeAgo(e.ts, s.now)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { lessonOf, recallProbability, useLearn, type KanjiView } from '@/lib/learn-store';
import { Icon } from '../icons';
import { useNav } from '../nav';
import { BandChip, SectionTitle, StatTile, cx, recallTone } from '../ui';

const tooltipStyle = {
  background: 'rgb(var(--surface))',
  border: '1px solid rgb(var(--line))',
  borderRadius: 14,
  fontSize: 12,
  color: 'rgb(var(--ink))',
};
const tick = { fontSize: 11, fill: 'rgb(var(--ink-3))' };

type SortKey = 'recall' | 'mastery' | 'interval' | 'accuracy';

export default function ProgressView() {
  const s = useLearn();
  const { go } = useNav();
  const [sort, setSort] = useState<SortKey>('recall');

  const studied = useMemo(() => s.views.filter((v) => v.srs.lastReview !== null), [s.views]);

  const forecast = useMemo(() => {
    const out: { day: string; recall: number; withReview: number }[] = [];
    for (let d = 0; d <= 30; d += 2) {
      let none = 0;
      let reviewed = 0;
      studied.forEach((v) => {
        const since = v.srs.lastReview ? (s.now - v.srs.lastReview) / 86_400_000 : 0;
        none += recallProbability(since + d, v.srs.stability);
        // If every due card is reviewed on time, recall stays near the 90% target.
        const daysSinceDue = (s.now + d * 86_400_000 - v.srs.due) / 86_400_000;
        reviewed += daysSinceDue > 0 ? recallProbability(daysSinceDue % Math.max(1, v.srs.interval), Math.max(v.srs.stability, v.srs.interval)) : recallProbability(since + d, v.srs.stability);
      });
      out.push({
        day: d === 0 ? 'Now' : `+${d}d`,
        recall: studied.length ? Math.round((none / studied.length) * 100) : 0,
        withReview: studied.length ? Math.round((reviewed / studied.length) * 100) : 0,
      });
    }
    return out;
  }, [studied, s.now]);

  const accuracySeries = s.last14.map((d) => ({ ...d, accuracy: d.reviews ? Math.round((d.correct / d.reviews) * 100) : null }));

  const rows = useMemo(() => {
    const acc = (v: KanjiView) => (v.progress.total_attempts ? v.progress.correct_attempts / v.progress.total_attempts : 0);
    const sorters: Record<SortKey, (a: KanjiView, b: KanjiView) => number> = {
      recall: (a, b) => a.recall - b.recall,
      mastery: (a, b) => a.progress.overall_mastery - b.progress.overall_mastery,
      interval: (a, b) => b.srs.interval - a.srs.interval,
      accuracy: (a, b) => acc(a) - acc(b),
    };
    return [...studied].sort(sorters[sort]);
  }, [studied, sort]);

  const totalReviews = s.log.length;
  const weakest = [...s.skillAverages].sort((a, b) => a.value - b.value)[0];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile icon="layers" label="Total reviews" value={totalReviews} hint="All time" tone="brand" />
        <StatTile icon="target" label="7-day accuracy" value={s.accuracy} unit="%" tone="matcha" />
        <StatTile icon="brain" label="Avg. recall now" value={studied.length ? Math.round((studied.reduce((a, v) => a + v.recall, 0) / studied.length) * 100) : 0} unit="%" tone="ai" />
        <StatTile icon="alert" label="Weakest skill" value={weakest.skill} hint={`${weakest.value}% average`} tone="sakura" />
      </section>

      <section className="card card-pad">
        <SectionTitle
          jp="げんき"
          title={`${s.track === 'N5' ? 'Genki I' : 'Genki II'} progress · ${s.track}`}
          sub={`${studied.length} of ${s.views.length} kanji started · lessons ${s.lessons[0]?.lesson}–${s.lessons[s.lessons.length - 1]?.lesson}`}
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
          {s.lessons.map((l) => {
            const inLesson = s.views.filter((v) => lessonOf(v.kanji) === l.lesson);
            const started = inLesson.filter((v) => v.srs.lastReview !== null).length;
            const mastered = inLesson.filter((v) => v.band === 'mastered').length;
            return (
              <div key={l.lesson} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold truncate">
                    {`Lesson ${l.lesson}`} <span className="text-ink-3 font-normal">· {l.title}</span>
                  </span>
                  <span className="tabular text-xs font-bold shrink-0">
                    {started}/{inLesson.length}
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-sunken overflow-hidden flex">
                  <div className="h-full bg-matcha" style={{ width: `${(mastered / Math.max(1, inLesson.length)) * 100}%` }} />
                  <div className="h-full bg-brand" style={{ width: `${((started - mastered) / Math.max(1, inLesson.length)) * 100}%` }} />
                </div>
                <div className="mt-1 flex gap-1 flex-wrap">
                  {inLesson.map((v) => (
                    <span
                      key={v.kanji.id}
                      title={`${v.kanji.character} ${v.kanji.meanings[0]}`}
                      className={`font-jp text-xs leading-5 w-5 text-center rounded ${
                        v.band === 'mastered' ? 'bg-matcha-soft text-matcha' : v.srs.lastReview !== null ? 'bg-brand-soft text-brand' : 'text-ink-3/60'
                      }`}
                    >
                      {v.kanji.character}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-4 text-xs font-semibold text-ink-2">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-matcha" /> Mastered</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand" /> Started</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sunken" /> Not yet</span>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="card card-pad">
          <SectionTitle jp="能力" title="Skill profile" sub="Average score per skill across all kanji" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={s.skillAverages} outerRadius="72%">
                <PolarGrid stroke="rgb(var(--line))" />
                <PolarAngleAxis dataKey="skill" tick={{ fontSize: 12, fill: 'rgb(var(--ink-2))', fontWeight: 600 }} />
                <Radar dataKey="value" stroke="rgb(var(--brand))" strokeWidth={2.5} fill="rgb(var(--brand))" fillOpacity={0.22} dot={{ r: 3.5, fill: 'rgb(var(--brand))' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, 'Score']} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card card-pad">
          <SectionTitle
            jp="記憶予測"
            title="Retention forecast"
            sub="Average recall over the next 30 days — with and without reviewing"
          />
          <div className="flex gap-4 text-xs font-semibold mb-2">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-matcha" /> Reviewing on schedule</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sakura" /> If you stop</span>
          </div>
          <div className="h-64 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecast} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gStop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--sakura))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="rgb(var(--sakura))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gKeep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--matcha))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="rgb(var(--matcha))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={tick} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={tick} width={36} unit="%" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${v}%`, n === 'recall' ? 'If you stop' : 'Reviewing']} />
                <Area type="monotone" dataKey="withReview" stroke="rgb(var(--matcha))" strokeWidth={2.5} fill="url(#gKeep)" />
                <Area type="monotone" dataKey="recall" stroke="rgb(var(--sakura))" strokeWidth={2.5} fill="url(#gStop)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="card card-pad">
        <SectionTitle jp="正答率" title="Daily accuracy" sub="Share of correct answers per day, last 14 days" />
        <div className="h-48 -ml-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={accuracySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--brand))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="rgb(var(--brand))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tick} interval={1} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={tick} width={36} unit="%" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, 'Accuracy']} />
              <Area type="monotone" dataKey="accuracy" connectNulls stroke="rgb(var(--brand))" strokeWidth={2.5} fill="url(#gAcc)" dot={{ r: 3, fill: 'rgb(var(--brand))' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 sm:p-6 pb-0">
          <SectionTitle
            jp="一覧"
            title={`Kanji you've studied (${studied.length})`}
            action={
              <div className="flex gap-1 rounded-full bg-sunken/70 p-1">
                {(['recall', 'mastery', 'accuracy', 'interval'] as SortKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSort(k)}
                    className={cx('h-8 px-3 rounded-full text-xs font-semibold capitalize transition', sort === k ? 'bg-surface shadow-card text-ink' : 'text-ink-3')}
                  >
                    {k}
                  </button>
                ))}
              </div>
            }
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-ink-3 text-xs border-b border-line/70">
                <th className="font-semibold px-6 py-3">Kanji</th>
                <th className="font-semibold py-3">Status</th>
                <th className="font-semibold py-3">Recall now</th>
                <th className="font-semibold py-3">Mastery</th>
                <th className="font-semibold py-3">Accuracy</th>
                <th className="font-semibold py-3 pr-6 text-right">Interval</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr
                  key={v.kanji.id}
                  onClick={() => go('library', v.kanji.id)}
                  className="border-b border-line/50 last:border-0 hover:bg-paper cursor-pointer"
                >
                  <td className="px-6 py-3">
                    <span className="flex items-center gap-3">
                      <span className="font-mincho text-2xl font-bold">{v.kanji.character}</span>
                      <span className="text-ink-2">{v.kanji.meanings[0]}</span>
                    </span>
                  </td>
                  <td className="py-3"><BandChip band={v.band} /></td>
                  <td className="py-3 font-bold tabular" style={{ color: `rgb(var(--${recallTone(v.recall)}))` }}>
                    {Math.round(v.recall * 100)}%
                  </td>
                  <td className="py-3 tabular">{Math.round(v.progress.overall_mastery)}%</td>
                  <td className="py-3 tabular text-ink-2">
                    {v.progress.total_attempts ? Math.round((v.progress.correct_attempts / v.progress.total_attempts) * 100) : 0}%
                    <span className="text-ink-3 text-xs"> · {v.progress.total_attempts}</span>
                  </td>
                  <td className="py-3 pr-6 text-right tabular">
                    {v.isDue ? <span className="chip bg-brand-soft text-brand">due</span> : `${v.srs.interval}d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-ink-3 flex items-center gap-1.5">
        <Icon name="alert" size={13} /> Charts update live as you review and quiz. Demo history for earlier days is generated locally.
      </p>
    </div>
  );
}

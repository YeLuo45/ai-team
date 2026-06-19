// Reviews list page

import { useState, useEffect } from 'react';
import { formatDate } from '../lib/format';
import type { Review, Member } from '@ai-team/core';

const SENTIMENT_PERIODS: Record<string, string> = {
  '2026-Q1': 'Q1 2026', '2026-Q2': 'Q2 2026', '2026-Q3': 'Q3 2026', '2026-Q4': 'Q4 2026',
  '2026-H1': '上半年 2026', '2026-H2': '下半年 2026',
  '2026-Annual': '2026 年度', '2025-Annual': '2025 年度',
};

export function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'api' | 'static' | 'none'>('none');
  const [filterMember, setFilterMember] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');

  useEffect(() => {
    (async () => {
      try {
        const healthResp = await fetch('/api/health', { signal: AbortSignal.timeout(1000) });
        if (healthResp.ok) {
          const [reviewsResp, membersResp] = await Promise.all([
            fetch('/api/reviews'),
            fetch('/api/members'),
          ]);
          setReviews(await reviewsResp.json());
          setMembers(await membersResp.json());
          setDataSource('api');
        } else {
          throw new Error('API down');
        }
      } catch {
        // Static fallback
        const teamResp = await fetch(`${import.meta.env.BASE_URL}data/team.json`);
        const team = await teamResp.json();
        setReviews(team.reviews ?? []);
        setMembers(team.members ?? []);
        setDataSource('static');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-slate-500">加载 Reviews...</div>;

  const memberById = new Map(members.map((m) => [m.id, m]));
  const filtered = reviews
    .filter((r) => filterMember === 'all' || r.memberId === filterMember)
    .filter((r) => filterPeriod === 'all' || r.period === filterPeriod)
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));

  const allPeriods = Array.from(new Set(reviews.map((r) => r.period)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">绩效评估</h2>
          <p className="mt-1 text-sm text-slate-500">
            共 {reviews.length} 条 Review · {members.length} 成员
            {dataSource === 'static' && <span className="ml-2 badge-amber">静态数据</span>}
            {dataSource === 'api' && <span className="ml-2 badge-green">● 实时</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-center gap-3">
        <div>
          <label className="text-xs text-slate-500">成员</label>
          <select value={filterMember} onChange={(e) => setFilterMember(e.target.value)}
            className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800">
            <option value="all">全部</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">期间</label>
          <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)}
            className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800">
            <option value="all">全部</option>
            {allPeriods.map((p) => <option key={p} value={p}>{SENTIMENT_PERIODS[p] ?? p}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center text-slate-500">
          暂无 Review
          {dataSource === 'api' && <span> · 去 Members 页点击 "⭐ 新建 Review"</span>}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => {
            const m = memberById.get(r.memberId);
            return (
              <div key={r.id} className="card">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{m?.name ?? r.memberId}</h3>
                    <span className="badge-blue">{SENTIMENT_PERIODS[r.period] ?? r.period}</span>
                    <span className="text-sm text-amber-500">
                      {'★'.repeat(r.rating)}<span className="text-slate-300">{'★'.repeat(5 - r.rating)}</span>
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.reviewer && <span>{r.reviewer} · </span>}
                    {formatDate(r.reviewedAt)}
                  </div>
                </div>

                {r.summary && (
                  <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                    {r.summary}
                  </p>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {r.achievements.length > 0 && (
                    <Section title="🎯 成就" items={r.achievements} color="emerald" />
                  )}
                  {r.growthAreas.length > 0 && (
                    <Section title="🌱 成长" items={r.growthAreas} color="amber" />
                  )}
                  {r.nextGoals.length > 0 && (
                    <Section title="🚀 目标" items={r.nextGoals} color="blue" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Section({ title, items, color }: { title: string; items: string[]; color: 'emerald' | 'amber' | 'blue' }) {
  const bg = { emerald: 'bg-emerald-50 dark:bg-emerald-900/20', amber: 'bg-amber-50 dark:bg-amber-900/20', blue: 'bg-blue-50 dark:bg-blue-900/20' }[color];
  const text = { emerald: 'text-emerald-700 dark:text-emerald-300', amber: 'text-amber-700 dark:text-amber-300', blue: 'text-blue-700 dark:text-blue-300' }[color];
  return (
    <div className={`rounded-lg p-3 ${bg}`}>
      <p className={`text-xs font-semibold ${text}`}>{title}</p>
      <ul className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-200">
        {items.map((it, i) => <li key={i}>· {it}</li>)}
      </ul>
    </div>
  );
}

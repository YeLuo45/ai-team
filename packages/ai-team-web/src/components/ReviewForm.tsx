// Review Form - create/edit performance review with AI draft assist

import { useState } from 'react';
import type { Member, Review } from '@ai-team/core';

interface Props {
  member: Member;
  existing?: Review;
  onClose: () => void;
  onSaved: (review: Review) => void;
}

interface Draft {
  rating: 1 | 2 | 3 | 4 | 5;
  summary: string;
  achievements: string[];
  growthAreas: string[];
  nextGoals: string[];
}

const PERIODS = ['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4', '2026-H1', '2026-H2', '2026-Annual', '2025-Annual'];

export function ReviewForm({ member, existing, onClose, onSaved }: Props) {
  const [period, setPeriod] = useState(existing?.period ?? PERIODS[1]);
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(existing?.rating ?? 3);
  const [summary, setSummary] = useState(existing?.summary ?? '');
  const [achievements, setAchievements] = useState<string[]>(existing?.achievements ?? ['']);
  const [growthAreas, setGrowthAreas] = useState<string[]>(existing?.growthAreas ?? ['']);
  const [nextGoals, setNextGoals] = useState<string[]>(existing?.nextGoals ?? ['']);
  const [reviewer, setReviewer] = useState(existing?.reviewer ?? '');
  const [loading, setLoading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateDraft = async () => {
    setDrafting(true);
    setError(null);
    try {
      const r = await fetch('/api/performance-reviews/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, period, reviewer: reviewer || 'Manager' }),
      });
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
      const draft = (await r.json()) as Draft;
      setRating(draft.rating);
      setSummary(draft.summary);
      setAchievements(draft.achievements.length > 0 ? draft.achievements : ['']);
      setGrowthAreas(draft.growthAreas.length > 0 ? draft.growthAreas : ['']);
      setNextGoals(draft.nextGoals.length > 0 ? draft.nextGoals : ['']);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDrafting(false);
    }
  };

  const handleSubmit = async () => {
    if (!summary.trim()) {
      setError('请填写总结');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = {
        memberId: member.id,
        period,
        rating,
        summary: summary.trim(),
        achievements: achievements.map((s) => s.trim()).filter(Boolean),
        growthAreas: growthAreas.map((s) => s.trim()).filter(Boolean),
        nextGoals: nextGoals.map((s) => s.trim()).filter(Boolean),
        reviewer: reviewer.trim() || 'Manager',
      };
      const url = existing ? `/api/reviews/${existing.id}` : '/api/reviews';
      const method = existing ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
      const saved = await r.json();
      onSaved(saved);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">⭐ {existing ? '编辑' : '新建'} Review - {member.name}</h3>
            <p className="text-xs text-slate-500">{member.role} · {member.team}{member.level ? ` · ${member.level}` : ''}</p>
          </div>
          <button onClick={onClose} className="btn-ghost">×</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {error && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">⚠ {error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-slate-600">期间 *</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">评分 (1-5) *</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n as 1 | 2 | 3 | 4 | 5)}
                    className={`h-9 w-9 rounded-lg text-lg ${rating >= n ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">评估人</label>
            <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="姓名"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
          </div>

          <button onClick={generateDraft} disabled={drafting}
            className="w-full rounded-lg border-2 border-dashed border-brand-300 bg-brand-50 p-3 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:border-brand-700 dark:bg-brand-900/20 dark:text-brand-300">
            {drafting ? '🤖 AI 生成中...' : '✨ 一键 AI 辅助生成草稿 (基于历史 + 技能)'}
          </button>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">📝 总结 *</label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
              placeholder="本季度整体表现..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
          </div>

          <ListField label="🎯 成就" items={achievements} onChange={setAchievements} placeholder="完成的关键事项..." />
          <ListField label="🌱 成长方向" items={growthAreas} onChange={setGrowthAreas} placeholder="需要提升的地方..." />
          <ListField label="🚀 下阶段目标" items={nextGoals} onChange={setNextGoals} placeholder="下季度/年度目标..." />
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button onClick={onClose} className="btn-ghost">取消</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary disabled:opacity-50">
            {loading ? '保存中...' : '💾 保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ListField({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (s: string[]) => void; placeholder: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              placeholder={placeholder}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            {items.length > 1 && (
              <button onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="btn-ghost text-rose-500">×</button>
            )}
          </div>
        ))}
        <button onClick={() => onChange([...items, ''])} className="btn-ghost text-xs">+ 添加</button>
      </div>
    </div>
  );
}

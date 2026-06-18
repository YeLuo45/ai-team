// Training Plan Modal - calls server /api/training-plans/generate

import { useState } from 'react';
import type { Member, Training } from '@ai-team/core';

interface Props {
  member: Member;
  onClose: () => void;
  onSaved: (trainings: Training[]) => void;
}

interface GeneratedPlan {
  goals: string[];
  trainings: Array<{
    title: string;
    type: Training['type'];
    durationWeeks: number;
    resources: string[];
  }>;
  expectedGrowth: string;
}

const TYPE_LABELS: Record<Training['type'], string> = {
  course: '课程',
  mentoring: '辅导',
  project: '实战项目',
  reading: '阅读',
  certification: '认证',
};
const TYPE_COLORS: Record<Training['type'], string> = {
  course: 'badge-blue',
  mentoring: 'badge-green',
  project: 'badge-amber',
  reading: 'badge-slate',
  certification: 'badge-red',
};

export function TrainingPlanModal({ member, onClose, onSaved }: Props) {
  const [targetRole, setTargetRole] = useState('');
  const [weaknessAreas, setWeaknessAreas] = useState('');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/training-plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          targetRole: targetRole || `${member.role} (Senior)`,
          skills: member.skills.map((s) => ({ name: s.skillId, score: s.score })),
          weaknessAreas: weaknessAreas.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`);
      const json = (await resp.json()) as { trainings: Training[] };
      // Convert to plan display
      setPlan({
        goals: ['提升' + (targetRole || member.role) + '所需技能', '补齐薄弱环节', '推动职业成长'],
        trainings: json.trainings.map((t) => ({
          title: t.title,
          type: t.type,
          durationWeeks: Math.round((new Date(t.endDate ?? Date.now()).getTime() - new Date(t.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)),
          resources: [t.description],
        })),
        expectedGrowth: '由 AI 分析的成长路径，保存后可在 Trainings 页查看进度',
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const resp = await fetch('/api/training-plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          targetRole: targetRole || `${member.role} (Senior)`,
          skills: member.skills.map((s) => ({ name: s.skillId, score: s.score })),
          weaknessAreas: weaknessAreas.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      const json = (await resp.json()) as { trainings: Training[] };
      onSaved(json.trainings);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="card flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">🤖 AI 培训计划 - {member.name}</h3>
            <p className="text-xs text-slate-500">{member.role} · {member.team}{member.level ? ` · ${member.level}` : ''}</p>
          </div>
          <button onClick={onClose} className="btn-ghost">×</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {!plan && (
            <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
              <h4 className="text-sm font-semibold">输入分析条件</h4>
              <div>
                <label className="mb-1 block text-xs text-slate-500">目标岗位 (留空用 senior)</label>
                <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)}
                  placeholder={`${member.role} (Senior)`}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">待提升领域 (逗号分隔，可选)</label>
                <input value={weaknessAreas} onChange={(e) => setWeaknessAreas(e.target.value)}
                  placeholder="系统设计, Kubernetes, 团队管理"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <div className="rounded-lg bg-blue-50 p-3 text-xs text-slate-600 dark:bg-blue-900/20 dark:text-slate-300">
                <p className="font-semibold">当前技能 ({member.skills.length} 项):</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {member.skills.map((s) => (
                    <span key={s.skillId} className="badge-slate">
                      {s.skillId.replace('sk_', '').replace('kafka', 'Kafka').slice(0, 14)} {s.score}
                    </span>
                  ))}
                  {member.skills.length === 0 && <span className="text-slate-400">（无数据）</span>}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">⚠ {error}</div>
          )}

          {loading && (
            <div className="py-8 text-center text-slate-500">
              <div className="inline-block animate-spin">⏳</div> AI 分析中...
            </div>
          )}

          {plan && !loading && (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-900/20">
                <h4 className="mb-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">🎯 目标</h4>
                <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                  {plan.goals.map((g, i) => <li key={i}>· {g}</li>)}
                </ul>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">📚 培训项 ({plan.trainings.length})</h4>
                <div className="space-y-2">
                  {plan.trainings.map((t, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{t.title}</div>
                        <div className="flex items-center gap-2">
                          <span className={TYPE_COLORS[t.type]}>{TYPE_LABELS[t.type]}</span>
                          <span className="text-xs text-slate-500">{t.durationWeeks} 周</span>
                        </div>
                      </div>
                      {t.resources.length > 0 && (
                        <p className="mt-1 text-xs text-slate-500">资源: {t.resources.join(' / ').slice(0, 200)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-900/20">
                <p className="text-slate-700 dark:text-slate-300">📈 <span className="font-semibold">预期:</span> {plan.expectedGrowth}</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button onClick={onClose} className="btn-ghost">取消</button>
          {!plan ? (
            <button onClick={handleGenerate} disabled={loading} className="btn-primary disabled:opacity-50">
              {loading ? '生成中...' : '🤖 生成计划'}
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? '保存中...' : '💾 保存到培训计划'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

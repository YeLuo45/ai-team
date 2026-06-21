// V26: Pipeline funnel page — 招聘漏斗看板

import { useEffect, useState } from 'react';
import type { PipelineFunnelReport, PipelineStage } from '@ai-team/core';

const STAGE_LABELS: Record<PipelineStage, string> = {
  sourced: '已投递',
  screening: '筛选中',
  interview: '面试中',
  evaluation: '评估中',
  offer: 'Offer',
  hired: '已入职',
  rejected: '已拒绝',
};

const STAGE_COLORS: Record<PipelineStage, string> = {
  sourced: 'bg-slate-500',
  screening: 'bg-blue-500',
  interview: 'bg-indigo-500',
  evaluation: 'bg-violet-500',
  offer: 'bg-amber-500',
  hired: 'bg-emerald-500',
  rejected: 'bg-rose-500',
};

const STAGES: PipelineStage[] = ['sourced', 'screening', 'interview', 'evaluation', 'offer', 'hired'];

export function PipelineFunnel() {
  const [report, setReport] = useState<PipelineFunnelReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/pipeline/funnel');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setReport(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-slate-500">加载中...</div>;
  if (error) return (
      <div className="rounded border border-rose-300 bg-rose-50 p-4 text-rose-700" data-testid="pipeline-error">
        加载失败：{error}
        <button onClick={load} className="ml-2 underline" data-testid="pipeline-retry">重试</button>
      </div>
    );
  if (!report) return null;

  const maxCount = Math.max(1, ...STAGES.map((s) => report.byStage[s] ?? 0));

  return (
    <div className="space-y-6" data-testid="pipeline-funnel">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-2xl font-bold">招聘漏斗</h2>
          <p className="text-sm text-slate-500">实时跟踪候选人推进 · 共 {report.total} 人</p>
        </div>
        <button onClick={load} className="btn-ghost text-sm" data-testid="pipeline-refresh">刷新</button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((stage) => {
          const count = report.byStage[stage] ?? 0;
          const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={stage} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" data-testid={`stage-${stage}`}>
              <div className="text-xs text-slate-500">{STAGE_LABELS[stage]}</div>
              <div className="text-2xl font-bold">{count}</div>
              <div className="mt-2 h-12 bg-slate-100 dark:bg-slate-800">
                <div className={`h-full ${STAGE_COLORS[stage]}`} style={{ width: `${height}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 font-semibold">阶段转化</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-2">阶段</th>
              <th className="py-2">人数</th>
              <th className="py-2">转化率</th>
              <th className="py-2">流失率</th>
            </tr>
          </thead>
          <tbody>
            {report.steps.map((step) => (
              <tr key={step.stage} className="border-t border-slate-100 dark:border-slate-800" data-testid={`row-${step.stage}`}>
                <td className="py-2">{step.label}</td>
                <td className="py-2">{step.count}</td>
                <td className="py-2">{(step.conversionRate * 100).toFixed(1)}%</td>
                <td className="py-2">{(step.dropoffRate * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 text-sm text-slate-600">
        <span>整体转化：<strong>{(report.overallConversion * 100).toFixed(1)}%</strong></span>
        <span>平均停留：<strong>{report.averageDwellDays}</strong> 天</span>
      </div>
    </div>
  );
}

export default PipelineFunnel;
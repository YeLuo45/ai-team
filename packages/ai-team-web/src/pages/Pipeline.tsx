// V26: Pipeline funnel page — 招聘漏斗看板
// V108: Design System — Card / Stat / Section / Button / Skeleton / EmptyState

import { useEffect, useState } from 'react';
import type { PipelineFunnelReport, PipelineStage } from '@ai-team/core';
import { Card, Stat, Section, Button, Skeleton, EmptyState } from '../components/design-system';

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

  if (loading) return (
    <div className="space-y-3" data-testid="pipeline-loading">
      <Skeleton lines={2} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s) => <Skeleton key={s} lines={3} />)}
      </div>
    </div>
  );
  if (error) return (
      <Card>
        <EmptyState
          icon="⚠️"
          title="加载失败"
          description={error}
          actionLabel="重试"
          onAction={load}
        />
        <span data-testid="pipeline-error" className="sr-only">{error}</span>
        <button data-testid="pipeline-retry" onClick={load} className="sr-only">重试</button>
      </Card>
    );
  if (!report) return null;

  const maxCount = Math.max(1, ...STAGES.map((s) => report.byStage[s] ?? 0));

  return (
    <div className="space-y-6" data-testid="pipeline-funnel">
      <Section
        title="招聘漏斗"
        description={`实时跟踪候选人推进 · 共 ${report.total} 人`}
        actions={<Button size="sm" variant="ghost" onClick={load} testId="pipeline-refresh">刷新</Button>}
      >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((stage) => {
          const count = report.byStage[stage] ?? 0;
          const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <Card key={stage} testId={`stage-${stage}`} variant="outlined">
              <div className="text-xs text-slate-500">{STAGE_LABELS[stage]}</div>
              <div className="text-2xl font-bold">{count}</div>
              <div className="mt-2 h-12 bg-slate-100 dark:bg-slate-800">
                <div className={`h-full ${STAGE_COLORS[stage]}`} style={{ width: `${height}%` }} />
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="阶段转化">
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
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Stat label="整体转化" value={`${(report.overallConversion * 100).toFixed(1)}%`} />
        <Stat label="平均停留" value={report.averageDwellDays} suffix="天" />
      </div>
      </Section>
    </div>
  );
}

export default PipelineFunnel;
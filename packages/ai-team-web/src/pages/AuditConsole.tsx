// V27 + V31: Agent audit console — 实时事件流 + filter + stats 卡片

import { useEffect, useMemo, useState } from 'react';
import type { AgentCallRecord } from '@ai-team/core';

const AGENT_LABEL: Record<string, string> = {
  interview: '面试', training: '培训', 'one-on-one': '1:1', review: 'Review',
  resume: '简历', insights: '洞察', score: '评分', search: '搜索', pipeline: '漏斗',
};

const STATUS_LABEL: Record<string, string> = {
  success: '成功', failed: '失败', cancelled: '取消',
};

const AGENT_OPTIONS = ['', 'interview', 'training', 'one-on-one', 'review', 'resume', 'insights', 'score', 'search', 'pipeline'];
const STATUS_OPTIONS = ['', 'success', 'failed', 'cancelled'];

export function AuditConsole() {
  const [events, setEvents] = useState<AgentCallRecord[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      setError('EventSource 不可用');
      return;
    }
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/agent-audit/stream');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
      return;
    }

    es.addEventListener('connected', () => setConnected(true));
    es.addEventListener('agent.audit.history', (ev: MessageEvent) => {
      try {
        const rec: AgentCallRecord = JSON.parse(ev.data);
        setEvents((prev) => [rec, ...prev].slice(0, 50));
      } catch {
        // ignore malformed payload
      }
    });
    es.addEventListener('agent.audit', (ev: MessageEvent) => {
      try {
        const rec: AgentCallRecord = JSON.parse(ev.data);
        setEvents((prev) => [rec, ...prev].slice(0, 50));
      } catch {
        // ignore malformed payload
      }
    });
    es.onerror = () => {
      setConnected(false);
      setError('连接中断');
    };

    return () => {
      es?.close();
    };
  }, []);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (agentFilter && e.agent !== agentFilter) return false;
      if (statusFilter && e.status !== statusFilter) return false;
      return true;
    });
  }, [events, agentFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const success = filtered.filter((e) => e.status === 'success').length;
    const failed = filtered.filter((e) => e.status === 'failed').length;
    const avg = total > 0 ? Math.round(filtered.reduce((s, e) => s + e.durationMs, 0) / total) : 0;
    return { total, success, failed, avg };
  }, [filtered]);

  if (error) return (
    <div className="rounded border border-rose-300 bg-rose-50 p-4 text-rose-700" data-testid="audit-error">
      {error}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="audit-console">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-2xl font-bold">Agent 审计台</h2>
          <p className="text-sm text-slate-500">实时事件流 · 最近 50 条</p>
        </div>
        <span className={`badge ${connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`} data-testid="audit-status">
          {connected ? '已连接' : '未连接'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4" data-testid="audit-stats">
        <StatCard label="事件数" value={stats.total} testid="audit-stat-total" />
        <StatCard label="成功" value={stats.success} testid="audit-stat-success" tone="emerald" />
        <StatCard label="失败" value={stats.failed} testid="audit-stat-failed" tone="rose" />
        <StatCard label="平均耗时(ms)" value={stats.avg} testid="audit-stat-avg" />
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Agent</label>
          <select
            className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            data-testid="audit-filter-agent"
          >
            {AGENT_OPTIONS.map((a) => (
              <option key={a || 'all'} value={a}>{a ? AGENT_LABEL[a] ?? a : '全部'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">状态</label>
          <select
            className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            data-testid="audit-filter-status"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || 'all'} value={s}>{s ? STATUS_LABEL[s] ?? s : '全部'}</option>
            ))}
          </select>
        </div>
        {(agentFilter || statusFilter) && (
          <button
            onClick={() => { setAgentFilter(''); setStatusFilter(''); }}
            className="ml-auto text-xs text-brand-600 underline"
            data-testid="audit-filter-clear"
          >
            清除筛选
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 p-8 text-center text-slate-500" data-testid="audit-empty">
          {events.length === 0 ? '暂无事件 — 触发任意 agent 调用后会在这里出现。' : '没有匹配筛选条件的事件。'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full text-sm" data-testid="audit-table">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2 text-left">时间</th>
                <th className="px-3 py-2 text-left">Agent</th>
                <th className="px-3 py-2 text-left">操作</th>
                <th className="px-3 py-2 text-left">实体</th>
                <th className="px-3 py-2 text-left">状态</th>
                <th className="px-3 py-2 text-right">耗时(ms)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800" data-testid={`audit-row-${e.id}`}>
                  <td className="px-3 py-1 font-mono text-xs">{new Date(e.startedAt).toLocaleTimeString()}</td>
                  <td className="px-3 py-1">{AGENT_LABEL[e.agent] ?? e.agent}</td>
                  <td className="px-3 py-1 font-mono text-xs">{e.operation}</td>
                  <td className="px-3 py-1 font-mono text-xs">{e.entityId ?? '-'}</td>
                  <td className="px-3 py-1">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-3 py-1 text-right">{e.durationMs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, testid, tone }: { label: string; value: number; testid: string; tone?: 'emerald' | 'rose' }) {
  const toneClass = tone === 'emerald' ? 'border-emerald-200 bg-emerald-50' : tone === 'rose' ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`} data-testid={testid}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'success' ? 'bg-emerald-100 text-emerald-700' :
    status === 'failed' ? 'bg-rose-100 text-rose-700' :
    'bg-amber-100 text-amber-700';
  const label = status === 'success' ? '✓ 成功' : status === 'failed' ? '✗ 失败' : '⚠ 取消';
  return <span className={`rounded px-2 py-0.5 text-xs ${color}`}>{label}</span>;
}

export default AuditConsole;
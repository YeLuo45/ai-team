// V23 + V32: Capability heatmap page — 团队×岗位 × 技能矩阵 + 点击 cell 下钻
// V108: Design System — Card / Stat / Section / Button / Skeleton / Sheet

import { useEffect, useState } from 'react';
import { Card, Stat, Section, Button, EmptyState, Sheet } from '../components/design-system';

interface HeatmapCell {
  team: string;
  role: string;
  skillId: string;
  skillName: string;
  averageScore: number;
  coverageCount: number;
  expectedCount: number;
  coverageRate: number;
  level: 'critical' | 'low' | 'medium' | 'high';
  gap: number;
}

interface HeatmapReport {
  rows: Array<{ team: string; role: string }>;
  cols: Array<{ skillId: string; skillName: string }>;
  cells: HeatmapCell[];
  overallAverage: number;
  criticalGaps: number;
  generatedAt: string;
}

interface CellDetail {
  team: string;
  role: string;
  skillId: string;
  skillName: string;
  averageScore: number;
  coverageCount: number;
  expectedCount: number;
  members: Array<{ memberId: string; name: string; level?: string; score: number | null }>;
}

const LEVEL_COLOR: Record<HeatmapCell['level'], string> = {
  critical: 'bg-rose-500/90 text-white',
  low: 'bg-amber-400/90 text-slate-900',
  medium: 'bg-blue-400/90 text-white',
  high: 'bg-emerald-500/90 text-white',
};

interface SelectedCell {
  team: string;
  role: string;
  skillId: string;
}

export function CapabilityHeatmap() {
  const [report, setReport] = useState<HeatmapReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedCell | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/insights/capability-heatmap');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setReport(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function getCell(rowKey: string, colKey: string): HeatmapCell | undefined {
    if (!report) return undefined;
    return report.cells.find((c) => `${c.team}::${c.role}` === rowKey && c.skillId === colKey);
  }

  return (
    <div className="space-y-6" data-testid="capability-heatmap">
      <Section
        title="组织能力热力图"
        description={`团队 × 岗位 × 技能 · 共 ${report?.rows.length ?? 0} 个分组 / ${report?.cols.length ?? 0} 项技能`}
        actions={<Button size="sm" variant="ghost" onClick={load} testId="heatmap-refresh">刷新</Button>}
      >
      <div className="grid grid-cols-3 gap-4 text-sm">
        <Stat label="全局平均分" value={report?.overallAverage ?? 0} />
        <Stat label="Critical Gaps" value={report?.criticalGaps ?? 0} />
        <Stat label="报告时间" value={report ? new Date(report.generatedAt).toLocaleTimeString() : '—'} />
      </div>

      <Card>
        <table className="w-full text-sm" data-testid="heatmap-table">
          <thead>
            <tr>
              <th className="bg-slate-100 px-3 py-2 text-left dark:bg-slate-800">团队 / 岗位</th>
              {(report?.cols ?? []).map((c) => (
                <th key={c.skillId} className="bg-slate-100 px-3 py-2 text-center text-xs dark:bg-slate-800">
                  {c.skillName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(report?.rows ?? []).map((r) => {
              const rowKey = `${r.team}::${r.role}`;
              return (
                <tr key={rowKey} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2 font-medium">
                    {r.team} <span className="text-xs text-slate-500">/ {r.role}</span>
                  </td>
                  {(report?.cols ?? []).map((c) => {
                    const cell = getCell(rowKey, c.skillId);
                    if (!cell) return <td key={c.skillId} className="px-2 py-2 text-center text-slate-400">-</td>;
                    return (
                      <td key={c.skillId} className="px-2 py-2 text-center" data-testid={`cell-${cell.team}-${cell.role}-${cell.skillId}`}>
                        <button
                          type="button"
                          className={`mx-auto flex h-12 w-16 cursor-pointer items-center justify-center rounded ${LEVEL_COLOR[cell.level]}`}
                          onClick={() => setSelected({ team: cell.team, role: cell.role, skillId: cell.skillId })}
                          aria-label={`${cell.team} ${cell.role} ${cell.skillName}`}
                          data-testid={`cell-button-${cell.team}-${cell.role}-${cell.skillId}`}
                        >
                          <div>
                            <div className="font-bold">{cell.averageScore}</div>
                            <div className="text-xs opacity-90">{cell.coverageCount}/{cell.expectedCount}</div>
                          </div>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {(report?.rows.length ?? 0) === 0 && !loading && !error && (
          <EmptyState
            icon="🗺️"
            title="暂无能力数据"
            description="添加成员和技能后再查看"
          />
        )}
      </Card>

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-emerald-500" /> high (≥71)</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-blue-400" /> medium (51-70)</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-amber-400" /> low (30-50)</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-rose-500" /> critical (&lt;30)</span>
        <span className="flex items-center gap-1 text-xs text-slate-500">点击单元格查看成员</span>
      </div>

      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title="成员覆盖详情"
        testId="heatmap-cell-sheet"
      >
        {selected && (
          <CellDetailModal
            selection={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </Sheet>
      </Section>
    </div>
  );
}

function CellDetailModal({ selection, onClose }: { selection: SelectedCell; onClose: () => void }) {
  const [detail, setDetail] = useState<CellDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    const url = `/api/insights/capability-heatmap/cell?team=${encodeURIComponent(selection.team)}&role=${encodeURIComponent(selection.role)}&skill=${encodeURIComponent(selection.skillId)}`;
    fetch(url)
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'unknown'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selection.team, selection.role, selection.skillId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60" data-testid="cell-modal-backdrop" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900"
        data-testid="cell-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">
            {selection.team} · {selection.role}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900" data-testid="cell-modal-close" aria-label="close">✕</button>
        </div>
        {loading && <div className="text-slate-500" data-testid="cell-modal-loading">加载中…</div>}
        {error && <div className="text-rose-600" data-testid="cell-modal-error">错误：{error}</div>}
        {detail && (
          <div data-testid="cell-modal-body">
            <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded border border-slate-200 p-2 text-center dark:border-slate-700">
                <div className="text-xs text-slate-500">技能</div>
                <div className="font-bold">{detail.skillName}</div>
              </div>
              <div className="rounded border border-slate-200 p-2 text-center dark:border-slate-700">
                <div className="text-xs text-slate-500">平均分</div>
                <div className="font-bold">{detail.averageScore}</div>
              </div>
              <div className="rounded border border-slate-200 p-2 text-center dark:border-slate-700">
                <div className="text-xs text-slate-500">覆盖</div>
                <div className="font-bold">{detail.coverageCount}/{detail.expectedCount}</div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-1">成员</th>
                  <th className="py-1">级别</th>
                  <th className="py-1 text-right">分数</th>
                </tr>
              </thead>
              <tbody>
                {detail.members.map((m) => (
                  <tr key={m.memberId} className="border-t border-slate-100 dark:border-slate-800" data-testid={`cell-modal-member-${m.memberId}`}>
                    <td className="py-1">{m.name}</td>
                    <td className="py-1 text-slate-500">{m.level ?? '-'}</td>
                    <td className="py-1 text-right">
                      {m.score !== null ? (
                        <span className={m.score < 50 ? 'text-rose-600' : m.score < 70 ? 'text-amber-600' : 'text-emerald-600'}>{m.score}</span>
                      ) : (
                        <span className="text-slate-400">未覆盖</span>
                      )}
                    </td>
                  </tr>
                ))}
                {detail.members.length === 0 && (
                  <tr><td colSpan={3} className="py-4 text-center text-slate-500">该 (team, role) 没有成员。</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default CapabilityHeatmap;
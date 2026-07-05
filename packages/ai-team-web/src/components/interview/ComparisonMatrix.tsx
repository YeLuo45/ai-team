// V147/V149: ComparisonMatrix — side-by-side multi-candidate evaluation chart.
// Groups rows by position and renders each candidate's trend in one shared
// SVG per position. Highlights the top scorer for the currently selected
// metric (overall / technical / communication / problem-solving / culture).
// V155: controlled mode — the selected metric is owned by the parent and
// synced to the URL hash so deep-links / refresh preserve the view.
// V160: CSV export — current comparison matrix serializes to CSV and
// triggers a browser download via Blob + createObjectURL.

import { useEffect, useState } from 'react';
import {
  buildSparklinePath,
  buildSparklineX,
  groupComparisonByPosition,
  metricSeries,
  scoreToY,
  type CandidateComparisonRow,
  type ComparisonMetricKey,
  type PositionComparisonGroup,
} from '../../lib/interview-helpers';
import { Card } from '../design-system';

interface Props {
  rows: ReadonlyArray<CandidateComparisonRow>;
  width?: number;
  height?: number;
  onSelectCandidate?: (candidateId: string) => void;
  selectedCandidateId?: string | null;
  /** V155: parent-controlled metric. Falls back to internal state when undefined. */
  metric?: ComparisonMetricKey;
  onMetricChange?: (metric: ComparisonMetricKey) => void;
}

const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 100;
const PALETTE = [
  'stroke-brand-500',
  'stroke-emerald-500',
  'stroke-violet-500',
  'stroke-amber-500',
  'stroke-sky-500',
  'stroke-rose-500',
  'stroke-indigo-500',
  'stroke-teal-500',
];

export const METRIC_OPTIONS: ReadonlyArray<{ key: ComparisonMetricKey; label: string }> = [
  { key: 'overall', label: '总评分' },
  { key: 'technical', label: '技术' },
  { key: 'communication', label: '沟通' },
  { key: 'problemSolving', label: '解决问题' },
  { key: 'culture', label: '文化契合' },
];

/** Short Chinese description for each metric. Used in the ComparisonMatrix tooltips. */
export const METRIC_DESCRIPTIONS: Record<ComparisonMetricKey, string> = {
  overall: '面试官对候选人整体表现的综合评分 (0-100)',
  technical: '技术深度：算法、数据结构、系统设计、编码能力',
  communication: '沟通能力：表达清晰度、倾听反馈、跨团队协作',
  problemSolving: '问题解决：拆解复杂问题、举一反三、独立思考',
  culture: '文化契合：价值观匹配、主动学习、抗压能力',
};

// ---------------- V160: CSV export ----------------

export interface ComparisonCsvOptions {
  /** Metric that was used to compute best/avg values. */
  metric: ComparisonMetricKey;
  /** Override the export timestamp (defaults to new Date()). */
  now?: Date;
}

/**
 * Build a CSV body for the current comparison rows. Columns:
 *   岗位, 候选人姓名, 候选人ID, N 轮评估, 最高分(当前metric), 平均分(当前metric)
 * Rows with no evaluation for the metric get empty scores.
 */
export function buildComparisonCsv(
  rows: ReadonlyArray<CandidateComparisonRow>,
  options: ComparisonCsvOptions,
): string {
  const now = options.now ?? new Date();
  const header = [
    '岗位',
    '候选人',
    '候选人ID',
    '已评估轮次',
    `最高分(${options.metric})`,
    `平均分(${options.metric})`,
  ];
  const lines: string[] = [header.join(',')];
  for (const row of rows) {
    const best = row.bestByMetric[options.metric];
    const avg = row.avgByMetric[options.metric];
    const cells = [
      escapeCsv(row.candidatePosition),
      escapeCsv(row.candidateName),
      escapeCsv(row.candidateId),
      String(row.evaluatedRounds),
      best == null ? '' : String(best),
      avg == null ? '' : String(avg),
    ];
    lines.push(cells.join(','));
  }
  // Comment line at the end records the export timestamp + metric
  lines.push(`# exportedAt=${now.toISOString()},metric=${options.metric}`);
  return lines.join('\n');
}

export function buildComparisonCsvFilename(
  metric: ComparisonMetricKey,
  now: Date = new Date(),
): string {
  return `comparison-${metric}-${now.toISOString().slice(0, 10)}.csv`;
}

/** RFC-4180 CSV cell escape: wrap in quotes when needed, escape quotes. */
function escapeCsv(value: string): string {
  if (value == null) return '';
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function isValidMetricKey(value: string | null | undefined): value is ComparisonMetricKey {
  if (!value) return false;
  return METRIC_OPTIONS.some((o) => o.key === value);
}

export function ComparisonMatrix({
  rows,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  onSelectCandidate,
  selectedCandidateId,
  metric: controlledMetric,
  onMetricChange,
}: Props) {
  const [internalMetric, setInternalMetric] = useState<ComparisonMetricKey>('overall');
  const isControlled = controlledMetric !== undefined;
  const metric = isControlled ? controlledMetric : internalMetric;

  // Mirror internal state into the parent's notifier so they can sync
  // the URL hash without us having to expose the setter.
  useEffect(() => {
    if (isControlled) return;
    onMetricChange?.(internalMetric);
  }, [isControlled, internalMetric, onMetricChange]);

  const setMetric = (next: ComparisonMetricKey) => {
    if (isControlled) {
      onMetricChange?.(next);
    } else {
      setInternalMetric(next);
    }
  };

  // V160: CSV export — build payload and trigger a browser download
  const handleExportCsv = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const csv = buildComparisonCsv(rows, { metric });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildComparisonCsvFilename(metric);
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (rows.length === 0) {
    return (
      <Card className="text-center text-sm text-slate-500" testId="comparison-matrix-empty">
        <p data-testid="comparison-matrix-empty-text">
          暂无候选人评估数据，无法生成对比矩阵
        </p>
      </Card>
    );
  }

  const groups = groupComparisonByPosition(rows);

  return (
    <div className="space-y-5" data-testid="comparison-matrix">
      <div
        className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/40"
        role="radiogroup"
        aria-label="对比维度"
        data-testid="comparison-metric-switcher"
      >
        <span className="mr-1 text-xs font-semibold text-slate-500">对比维度</span>
        {METRIC_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={metric === opt.key}
            title={METRIC_DESCRIPTIONS[opt.key]}
            onClick={() => setMetric(opt.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              metric === opt.key
                ? 'bg-brand-500 text-white shadow'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-700/60'
            }`}
            data-testid={`comparison-metric-${opt.key}`}
          >
            {opt.label}
          </button>
        ))}
        <span
          className="ml-auto text-[11px] text-slate-500"
          data-testid="comparison-metric-description"
        >
          {METRIC_DESCRIPTIONS[metric]}
        </span>
        <button
          type="button"
          onClick={handleExportCsv}
          className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-200"
          data-testid="comparison-export-csv"
          title="下载当前对比表为 CSV"
        >
          📥 导出 CSV
        </button>
      </div>

      {groups.map((group) => (
        <PositionGroup
          key={group.position}
          group={group}
          metric={metric}
          width={width}
          height={height}
          onSelectCandidate={onSelectCandidate}
          selectedCandidateId={selectedCandidateId}
        />
      ))}
    </div>
  );
}

function PositionGroup({
  group,
  metric,
  width,
  height,
  onSelectCandidate,
  selectedCandidateId,
}: {
  group: PositionComparisonGroup;
  metric: ComparisonMetricKey;
  width: number;
  height: number;
  onSelectCandidate?: (candidateId: string) => void;
  selectedCandidateId?: string | null;
}) {
  // Filter to rows that have a non-null value for the current metric
  const eligibleRows = group.rows.filter((r) => r.bestByMetric[metric] != null);
  const maxRounds = Math.max(...eligibleRows.map((r) => metricSeries(r.rounds, metric).filter((v) => v != null).length), 1);
  const xs = buildSparklineX(width, maxRounds);

  // Pick top scorer for THIS metric
  const sorted = [...eligibleRows].sort((a, b) => {
    const av = a.bestByMetric[metric] ?? -Infinity;
    const bv = b.bestByMetric[metric] ?? -Infinity;
    if (bv !== av) return bv - av;
    return a.candidateName.localeCompare(b.candidateName);
  });
  const topScorerId = sorted[0]?.candidateId ?? null;

  return (
    <Card className="space-y-3" testId={`comparison-group-${group.position}`}>
      <header className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {group.position}
          </h4>
          <p className="text-xs text-slate-500" data-testid={`comparison-group-summary-${group.position}`}>
            {group.rows.length} 位候选人 · {group.rows.reduce((acc, r) => acc + r.evaluatedRounds, 0)} 轮评估
          </p>
        </div>
        {topScorerId && (
          <span
            className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            data-testid={`comparison-top-scorer-${group.position}`}
          >
            🏆 Top: {sorted[0].candidateName}
          </span>
        )}
      </header>

      <svg
        viewBox={`0 0 ${width} ${height + 16}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${group.position} 候选人对比矩阵`}
        data-testid={`comparison-svg-${group.position}`}
      >
        {/* baselines */}
        <line
          x1="0"
          y1={height}
          x2={width}
          y2={height}
          className="stroke-slate-200 dark:stroke-slate-700"
          strokeWidth={1}
        />
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          className="stroke-slate-100 dark:stroke-slate-800"
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* round labels along x-axis */}
        {xs.map((x, i) => (
          <text
            key={i}
            x={x}
            y={height + 12}
            textAnchor="middle"
            className="fill-slate-400 text-[10px]"
          >
            {i + 1}
          </text>
        ))}

        {/* one line per candidate for the SELECTED metric */}
        {eligibleRows.map((row, idx) => {
          const tone = PALETTE[idx % PALETTE.length];
          const series = metricSeries(row.rounds, metric);
          const seriesPoints = series.map((score, i) => ({
            x: xs[i] ?? 0,
            y: scoreToY(score, height),
          }));
          const d = buildSparklinePath(seriesPoints);
          return (
            <g key={row.candidateId}>
              {d && (
                <path
                  d={d}
                  className={tone}
                  fill="none"
                  strokeWidth={row.candidateId === selectedCandidateId ? 3 : 1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={row.candidateId === topScorerId ? 1 : 0.75}
                  data-testid={`comparison-path-${row.candidateId}`}
                />
              )}
              {seriesPoints.map((p, i) => {
                const score = series[i];
                if (score == null) return null;
                return (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={row.candidateId === topScorerId ? 3 : 2}
                    className={tone}
                    fill="currentColor"
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      <ul className="space-y-1.5" data-testid={`comparison-rows-${group.position}`}>
        {group.rows.map((row, idx) => {
          const tone = PALETTE[idx % PALETTE.length];
          const isTop = row.candidateId === topScorerId;
          const isSelected = row.candidateId === selectedCandidateId;
          const best = row.bestByMetric[metric];
          const avg = row.avgByMetric[metric];
          return (
            <li
              key={row.candidateId}
              className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-1.5 text-xs transition ${
                isSelected
                  ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/20'
                  : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/30'
              } ${onSelectCandidate ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => onSelectCandidate?.(row.candidateId)}
              data-testid={`comparison-row-${row.candidateId}`}
            >
              <span className="flex items-center gap-2">
                <span className={`inline-block h-2 w-3 rounded-full ${tone.replace('stroke-', 'bg-')}`} />
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {row.candidateName}
                  {isTop && <span className="ml-1 text-emerald-600">🏆</span>}
                </span>
                <span className="text-slate-500">· {row.evaluatedRounds} 轮</span>
              </span>
              <span className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                {best != null && (
                  <span data-testid={`comparison-best-${row.candidateId}`}>
                    最高 <strong className="text-brand-600">{best}</strong>
                  </span>
                )}
                {avg != null && (
                  <span data-testid={`comparison-avg-${row.candidateId}`}>
                    均 <strong>{avg}</strong>
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
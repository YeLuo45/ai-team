// V147: ComparisonMatrix — side-by-side multi-candidate evaluation chart.
// Groups rows by position and renders each candidate's overall score trend
// in one shared SVG per position. Highlights the top scorer.

import {
  buildSparklinePath,
  buildSparklineX,
  groupComparisonByPosition,
  scoreToY,
  type CandidateComparisonRow,
  type PositionComparisonGroup,
} from '../../lib/interview-helpers';
import { Card } from '../design-system';

interface Props {
  rows: ReadonlyArray<CandidateComparisonRow>;
  width?: number;
  height?: number;
  onSelectCandidate?: (candidateId: string) => void;
  selectedCandidateId?: string | null;
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

export function ComparisonMatrix({
  rows,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  onSelectCandidate,
  selectedCandidateId,
}: Props) {
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
      {groups.map((group) => (
        <PositionGroup
          key={group.position}
          group={group}
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
  width,
  height,
  onSelectCandidate,
  selectedCandidateId,
}: {
  group: PositionComparisonGroup;
  width: number;
  height: number;
  onSelectCandidate?: (candidateId: string) => void;
  selectedCandidateId?: string | null;
}) {
  // Maximum round count across all rows in this group determines the x-axis span
  const maxRounds = Math.max(...group.rows.map((r) => r.evaluatedRounds), 1);
  const xs = buildSparklineX(width, maxRounds);

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
        {group.topScorerId && (
          <span
            className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            data-testid={`comparison-top-scorer-${group.position}`}
          >
            🏆 Top: {group.rows.find((r) => r.candidateId === group.topScorerId)?.candidateName}
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

        {/* one line per candidate */}
        {group.rows.map((row, idx) => {
          const tone = PALETTE[idx % PALETTE.length];
          const overalls = row.rounds
            .filter((r) => r.evaluation != null)
            .map((r) => r.evaluation?.overall ?? null);
          const seriesPoints = overalls.map((score, i) => ({
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
                  opacity={row.candidateId === group.topScorerId ? 1 : 0.75}
                  data-testid={`comparison-path-${row.candidateId}`}
                />
              )}
              {seriesPoints.map((p, i) => {
                const score = overalls[i];
                if (score == null) return null;
                return (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={row.candidateId === group.topScorerId ? 3 : 2}
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
          const isTop = row.candidateId === group.topScorerId;
          const isSelected = row.candidateId === selectedCandidateId;
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
                {row.bestOverall != null && (
                  <span data-testid={`comparison-best-${row.candidateId}`}>
                    最高 <strong className="text-brand-600">{row.bestOverall}</strong>
                  </span>
                )}
                {row.avgOverall != null && (
                  <span data-testid={`comparison-avg-${row.candidateId}`}>
                    均 <strong>{row.avgOverall}</strong>
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
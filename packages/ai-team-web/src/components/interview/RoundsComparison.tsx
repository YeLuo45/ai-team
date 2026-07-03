// V144: RoundsComparison — multi-round evaluation sparkline (overall + 4
// breakdown metrics) rendered as a small inline SVG. Helps interviewers see
// whether a candidate is improving across rounds without scrolling.

import type { Interview } from '@ai-team/core';
import {
  SPARKLINE_METRICS,
  buildRoundsSparkline,
  buildSparklinePath,
  buildSparklineX,
  scoreToY,
} from '../../lib/interview-helpers';
import { Card } from '../design-system';

type InterviewRound = Interview & { round: number };

interface Props {
  rounds: ReadonlyArray<InterviewRound>;
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 60;

export function RoundsComparison({ rounds, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT }: Props) {
  const evaluatedRounds = rounds.filter((r) => r.evaluation);
  if (evaluatedRounds.length < 2) {
    return (
      <Card className="text-xs text-slate-500" testId="rounds-comparison-insufficient">
        <p data-testid="rounds-comparison-empty">
          至少需要 2 轮已评估的面试才能进行横向对比
          {evaluatedRounds.length === 1 && '（当前已有 1 轮）'}
        </p>
      </Card>
    );
  }

  const points = buildRoundsSparkline(evaluatedRounds);
  const xs = buildSparklineX(width, points.length);

  // Trend = last - first overall score (null-safe)
  const first = points[0]?.overall ?? null;
  const last = points[points.length - 1]?.overall ?? null;
  const trend = first != null && last != null ? last - first : null;
  const trendLabel =
    trend == null
      ? '—'
      : trend > 5
        ? `↑ +${trend} 持续提升`
        : trend < -5
          ? `↓ ${trend} 出现回落`
          : `→ ${trend >= 0 ? '+' : ''}${trend} 基本持平`;

  return (
    <Card className="space-y-3" testId="rounds-comparison">
      <header className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          横向对比 ({evaluatedRounds.length} 轮评估)
        </h4>
        <span
          className={`text-xs font-medium ${
            trend == null
              ? 'text-slate-500'
              : trend > 5
                ? 'text-emerald-600'
                : trend < -5
                  ? 'text-rose-600'
                  : 'text-slate-500'
          }`}
          data-testid="rounds-comparison-trend"
        >
          {trendLabel}
        </span>
      </header>

      <svg
        viewBox={`0 0 ${width} ${height + 24}`}
        className="h-auto w-full"
        role="img"
        aria-label="多轮面试评估对比折线图"
        data-testid="rounds-comparison-svg"
      >
        {/* baseline + mid grid */}
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

        {SPARKLINE_METRICS.map((metric) => {
          const seriesPoints = points.map((p, i) => ({
            x: xs[i],
            y: scoreToY(p[metric.key], height),
          }));
          const d = buildSparklinePath(seriesPoints);
          return (
            <g key={metric.key}>
              {d && (
                <path
                  d={d}
                  className={metric.tone}
                  fill="none"
                  strokeWidth={metric.key === 'overall' ? 2.5 : 1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={metric.key === 'overall' ? 1 : 0.65}
                  data-testid={`sparkline-path-${metric.key}`}
                />
              )}
              {points.map((p, i) => {
                const score = p[metric.key];
                if (score == null) return null;
                return (
                  <circle
                    key={i}
                    cx={xs[i]}
                    cy={scoreToY(score, height)}
                    r={metric.key === 'overall' ? 3 : 2}
                    className={metric.tone}
                    fill="currentColor"
                  />
                );
              })}
            </g>
          );
        })}

        {/* round labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={xs[i]}
            y={height + 16}
            textAnchor="middle"
            className="fill-slate-500 text-[10px]"
            data-testid={`sparkline-label-${p.round}`}
          >
            {`第 ${p.round} 面`}
          </text>
        ))}
      </svg>

      <ul className="flex flex-wrap gap-3 text-xs" data-testid="rounds-comparison-legend">
        {SPARKLINE_METRICS.map((metric) => (
          <li key={metric.key} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-3 rounded-full ${metric.tone.replace('stroke-', 'bg-')}`} />
            <span className="text-slate-600 dark:text-slate-300">{metric.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// Re-export so consumers can pick up Interview type if needed.
export type { Interview };
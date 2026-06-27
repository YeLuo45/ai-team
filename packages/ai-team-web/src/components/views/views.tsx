// V113: Drawers (Candidate / Member) + Interview Calendar

import { ReactNode } from 'react';
import { Drawer, Badge, Card, EmptyState } from '../design-system/index.js';
import {
  buildCalendarMonth,
  buildHeatmapCalendar,
  calendarMonthLabel,
  calendarPrevMonth,
  calendarNextMonth,
  type CalendarCell,
} from './calendar-utils.js';

// ---------- CandidateDrawer ----------
export interface CandidateDrawerProps {
  candidate: {
    id: string;
    name: string;
    position: string;
    status: string;
    source?: string;
    resumeScore?: number;
    email?: string;
  };
  onClose: () => void;
  pipelineStage?: string;
  interviews?: Array<{ id: string; date: string; status: string }>;
}

const PIPELINE_STAGES = ['sourced', 'screening', 'interview', 'evaluation', 'offer', 'hired'];

export function CandidateDrawer({
  candidate,
  onClose,
  pipelineStage,
  interviews = [],
}: CandidateDrawerProps) {
  const stageIdx = pipelineStage ? PIPELINE_STAGES.indexOf(pipelineStage) : -1;
  return (
    <Drawer open onClose={onClose} title={`候选人 · ${candidate.name}`} testId="candidate-drawer">
      <div className="space-y-4">
        <Card title="基本信息">
          <div className="space-y-1 text-sm">
            <p>姓名：{candidate.name}</p>
            <p>岗位：{candidate.position}</p>
            <p>来源：{candidate.source ?? '—'}</p>
            {candidate.email && <p>邮箱：{candidate.email}</p>}
            <p>
              状态：
              <Badge data-testid="candidate-status" tone="info">{candidate.status}</Badge>
            </p>
            {typeof candidate.resumeScore === 'number' && (
              <p>
                简历评分：
                <Badge tone="success">{candidate.resumeScore} 分</Badge>
              </p>
            )}
          </div>
        </Card>

        {pipelineStage && (
          <Card title="Pipeline 时间轴">
            <div data-testid="candidate-timeline" className="flex items-center gap-2">
              {PIPELINE_STAGES.map((s, i) => (
                <div key={s} className="flex flex-1 items-center">
                  <div
                    data-stage-active={i === stageIdx ? 'true' : undefined}
                    className={`h-8 w-8 rounded-full text-center text-xs leading-8 ${
                      i === stageIdx
                        ? 'bg-brand-500 text-white'
                        : i < stageIdx
                        ? 'bg-green-200 text-green-700'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {i + 1}
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className={`mx-1 h-0.5 flex-1 ${i < stageIdx ? 'bg-green-300' : 'bg-slate-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card title="面试历史">
          {interviews.length === 0 ? (
            <EmptyState icon="🎤" title="暂无面试记录" description="开启第一次面试后会在这里显示" />
          ) : (
            <div data-testid="interview-history" className="space-y-1 text-sm">
              {interviews.map((iv) => (
                <div key={iv.id} className="flex items-center justify-between border-b border-slate-100 py-1">
                  <span>{iv.date}</span>
                  <Badge tone={iv.status === 'completed' ? 'success' : 'warning'}>
                    {iv.status === 'completed' ? '已完成' : '待进行'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Drawer>
  );
}

// ---------- MemberDrawer ----------
export interface MemberDrawerProps {
  member: {
    id: string;
    name: string;
    role: string;
    team: string;
    level?: string;
  };
  onClose: () => void;
  skills?: Array<{ name: string; score: number }>;
  reviews?: Array<{ id: string; date: string; rating: number }>;
}

export function MemberDrawer({ member, onClose, skills = [], reviews = [] }: MemberDrawerProps) {
  return (
    <Drawer open onClose={onClose} title={`成员 · ${member.name}`} testId="member-drawer">
      <div className="space-y-4">
        <Card title="基本信息">
          <div className="space-y-1 text-sm">
            <p>姓名：{member.name}</p>
            <p>角色：{member.role}</p>
            <p>团队：{member.team}</p>
            {member.level && <p>职级：{member.level}</p>}
          </div>
        </Card>

        {skills.length > 0 && (
          <Card title="技能雷达">
            <div data-testid="skill-radar" className="space-y-2">
              {skills.map((sk) => (
                <div key={sk.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{sk.name}</span>
                    <span>{sk.score}</span>
                  </div>
                  <div className="h-2 rounded bg-slate-100">
                    <div
                      className="h-2 rounded bg-brand-500"
                      style={{ width: `${Math.min(100, Math.max(0, sk.score))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {reviews.length > 0 && (
          <Card title="Review 历史">
            <div data-testid="review-history" className="space-y-1 text-sm">
              {reviews.map((r) => (
                <div key={r.id} className="flex justify-between border-b border-slate-100 py-1">
                  <span>{r.date}</span>
                  <Badge tone={r.rating >= 4 ? 'success' : r.rating >= 3 ? 'warning' : 'danger'}>
                    {r.rating.toFixed(1)} / 5
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Drawer>
  );
}

// ---------- InterviewCalendar ----------
export interface InterviewItem {
  id: string;
  candidateName: string;
  date: string;
  time?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface InterviewCalendarProps {
  year: number;
  month: number;
  interviews: InterviewItem[];
  onSelect: (date: string) => void;
  onMonthChange?: (next: { year: number; month: number }) => void;
}

export function InterviewCalendar({
  year,
  month,
  interviews,
  onSelect,
  onMonthChange,
}: InterviewCalendarProps) {
  const cells = buildCalendarMonth(year, month);
  const heatmap = buildHeatmapCalendar(year, month, interviews);
  const label = calendarMonthLabel(year, month);
  const prev = calendarPrevMonth(year, month);
  const next = calendarNextMonth(year, month);

  function navigate(target: { year: number; month: number }) {
    if (onMonthChange) onMonthChange(target);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          data-testid="calendar-prev"
          onClick={() => navigate(prev)}
          className="rounded border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
        >
          ←
        </button>
        <div data-testid="calendar-month-label" className="text-sm font-semibold">
          {label}
        </div>
        <button
          data-testid="calendar-next"
          onClick={() => navigate(next)}
          className="rounded border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
        >
          →
        </button>
      </div>
      <div
        data-testid="calendar-grid"
        className="grid grid-cols-7 gap-1 text-center text-xs"
      >
        {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
          <div key={d} className="py-1 font-medium text-slate-500">{d}</div>
        ))}
        {cells.map((c) => {
          const count = heatmap[c.iso] ?? 0;
          return (
            <button
              key={c.iso}
              data-testid={`calendar-day-${c.iso}`}
              onClick={() => onSelect(c.iso)}
              className={`flex h-14 flex-col items-center justify-start rounded border p-1 ${
                c.inMonth
                  ? 'border-slate-200 bg-white hover:border-brand-400'
                  : 'border-transparent bg-slate-50 text-slate-400'
              }`}
            >
              <span className="text-xs">{c.day}</span>
              {count > 0 && (
                <span className="mt-1 inline-block rounded-full bg-brand-500 px-1.5 text-[10px] text-white">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Re-exports for convenience
export {
  buildCalendarMonth,
  buildHeatmapCalendar,
  groupInterviewsByDate,
  formatInterviewTime,
  calendarMonthLabel,
  calendarPrevMonth,
  calendarNextMonth,
  navigateCalendarMonth,
  type CalendarCell,
};
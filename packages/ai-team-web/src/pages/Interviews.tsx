import { useState, useEffect } from 'react';
import { useTeamData } from '../lib/hooks';
import { formatDate, formatDateTime, recommendationLabel, statusLabel } from '../lib/format';

export function Interviews() {
  const { data, loading, source } = useTeamData();
  const [selected, setSelected] = useState<string | null>(null);

  // Auto-select first interview
  useEffect(() => {
    if (!selected && data.interviews.length > 0) {
      setSelected(data.interviews[0].id);
    }
  }, [data.interviews, selected]);

  if (loading) return <div className="text-slate-500">加载中...</div>;

  const sorted = [...data.interviews].sort((a, b) =>
    (b.completedAt ?? b.startedAt ?? '').localeCompare(a.completedAt ?? a.startedAt ?? '')
  );

  const selectedIv = selected ? sorted.find((i) => i.id === selected) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">面试记录</h2>
        <p className="mt-1 text-sm text-slate-500">
          共 {data.interviews.length} 场面试
          {source === 'static' && <span className="ml-2 badge-amber">静态数据</span>}
          {source === 'api' && <span className="ml-2 badge-green">● 实时</span>}
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="card text-center text-slate-500">
          暂无面试记录
          {source === 'api' && <span> · 去 Candidates 页点击 "🤖 开始面试" 启动</span>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-1">
            {sorted.map((iv) => {
              const st = statusLabel(iv.status);
              const rec = recommendationLabel(iv.evaluation?.recommendation);
              return (
                <button
                  key={iv.id}
                  onClick={() => setSelected(iv.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    selected === iv.id
                      ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{iv.id}</span>
                    <span className={st.cls}>{st.text}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{iv.position}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{formatDate(iv.completedAt ?? iv.startedAt)}</span>
                    {iv.evaluation && (
                      <span className="flex items-center gap-2">
                        <span className="text-lg font-bold text-brand-600">{iv.evaluation.overall}</span>
                        <span className={rec.cls}>{rec.text}</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-2">
            {selectedIv ? <InterviewDetail interview={selectedIv} /> : <div className="card text-center text-slate-500">← 选择一场面试</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function InterviewDetail({ interview }: { interview: any }) {
  const iv = interview;
  const rec = recommendationLabel(iv.evaluation?.recommendation);
  return (
    <div className="card space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{iv.id}</h3>
          <span className="badge-blue">{iv.type}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          候选人 <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">{iv.candidateId}</code> · 岗位 {iv.position}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {iv.startedAt && <>开始: {formatDateTime(iv.startedAt)}</>}
          {iv.completedAt && <> · 完成: {formatDateTime(iv.completedAt)}</>}
        </p>
      </div>

      {iv.evaluation && (
        <div className="rounded-lg bg-gradient-to-br from-brand-50 to-violet-50 p-5 dark:from-brand-900/20 dark:to-violet-900/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">总评分</div>
              <div className="text-4xl font-bold text-brand-600">{iv.evaluation.overall}<span className="text-base text-slate-400">/100</span></div>
            </div>
            <span className={rec.cls + ' text-sm'}>{rec.text}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ScoreBar label="技术" value={iv.evaluation.breakdown.technical} />
            <ScoreBar label="沟通" value={iv.evaluation.breakdown.communication} />
            <ScoreBar label="解决问题" value={iv.evaluation.breakdown.problemSolving} />
            <ScoreBar label="文化契合" value={iv.evaluation.breakdown.culture} />
          </div>
          <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">{iv.evaluation.summary}</p>
          {iv.evaluation.strengths.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-emerald-600">优势</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                {iv.evaluation.strengths.map((s: string, i: number) => <li key={i}>· {s}</li>)}
              </ul>
            </div>
          )}
          {iv.evaluation.concerns.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-rose-600">顾虑</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                {iv.evaluation.concerns.map((s: string, i: number) => <li key={i}>· {s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div>
        <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">对话记录 ({iv.turns.length} 轮)</h4>
        <div className="space-y-2">
          {iv.turns.map((t: any, i: number) => (
            <div key={i} className={`rounded-lg p-3 text-sm ${
              t.role === 'interviewer' ? 'bg-brand-50 dark:bg-brand-900/20' : 'bg-slate-50 dark:bg-slate-800/50'
            }`}>
              <div className="mb-1 text-xs font-medium text-slate-500">
                {t.role === 'interviewer' ? '🤖 面试官' : '👤 候选人'} · {formatDateTime(t.timestamp)}
              </div>
              <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{t.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-brand-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">{pct}</div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

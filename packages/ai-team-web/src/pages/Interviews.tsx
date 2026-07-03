import { useEffect, useMemo, useState } from 'react';
import { useTeamData } from '../lib/hooks';
import { formatDate, statusLabel } from '../lib/format';
import {
  CandidateInterviewPanel,
  groupInterviewsByCandidate,
  buildRoundLabel,
  interviewTypeLabel,
  formatRoundTimeline,
} from '../components/interview';
import { Card } from '../components/design-system';

export function Interviews() {
  const { data, loading, source } = useTeamData();
  const groups = useMemo(
    () => groupInterviewsByCandidate(data.interviews, data.candidates),
    [data.interviews, data.candidates],
  );
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  // Auto-select first candidate on data load
  useEffect(() => {
    if (!selectedCandidateId && groups.length > 0) {
      setSelectedCandidateId(groups[0].candidateId);
    }
    if (selectedCandidateId && !groups.find((g) => g.candidateId === selectedCandidateId)) {
      setSelectedCandidateId(groups[0]?.candidateId ?? null);
    }
  }, [groups, selectedCandidateId]);

  if (loading) return <div className="text-slate-500">加载中...</div>;

  const totalRounds = groups.reduce((acc, g) => acc + g.rounds.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">面试记录</h2>
        <p className="mt-1 text-sm text-slate-500">
          共 {groups.length} 位候选人 · {totalRounds} 场面试
          {source === 'static' && <span className="ml-2 badge-amber">静态数据</span>}
          {source === 'api' && <span className="ml-2 badge-green">● 实时</span>}
        </p>
      </div>

      {groups.length === 0 ? (
        <Card className="text-center text-slate-500">
          暂无面试记录
          {source === 'api' && <span> · 去 Candidates 页点击 &quot;🤖 开始面试&quot; 启动</span>}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-1" data-testid="candidate-list">
            {groups.map((group) => {
              const isActive = group.candidateId === selectedCandidateId;
              const latest = group.rounds[group.rounds.length - 1];
              const st = latest ? statusLabel(latest.status) : null;
              return (
                <button
                  key={group.candidateId}
                  onClick={() => setSelectedCandidateId(group.candidateId)}
                  data-testid={`candidate-card-${group.candidateId}`}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    isActive
                      ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-50">
                      {group.candidateName}
                    </span>
                    {st && <span className={st.cls}>{st.text}</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {group.candidatePosition}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{formatDate(latest?.completedAt ?? latest?.startedAt)}</span>
                    <span data-testid={`candidate-round-count-${group.candidateId}`}>
                      {group.rounds.length} 轮 · 最新 {buildRoundLabel(group.rounds.length)}
                    </span>
                  </div>
                  {latest && (
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {interviewTypeLabel(latest.type)} · {formatRoundTimeline(latest)}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-2" data-testid="candidate-detail">
            {(() => {
              const group = groups.find((g) => g.candidateId === selectedCandidateId) ?? groups[0];
              if (!group) return null;
              return (
                <CandidateInterviewPanel
                  candidate={group.candidate}
                  candidateId={group.candidateId}
                  rounds={group.rounds}
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
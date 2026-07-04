import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTeamData } from '../lib/hooks';
import { formatDate, relativeTime, statusLabel } from '../lib/format';
import {
  CandidateInterviewPanel,
  type CandidateNavContext,
  ComparisonMatrix,
  buildCandidateComparisonRow,
  groupInterviewsByCandidate,
  buildRoundLabel,
  interviewTypeLabel,
  formatRoundTimeline,
  type CandidateComparisonRow,
} from '../components/interview';
import { Card } from '../components/design-system';

export function Interviews() {
  const { data, loading, source } = useTeamData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const groups = useMemo(
    () => groupInterviewsByCandidate(data.interviews, data.candidates),
    [data.interviews, data.candidates],
  );
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  // Compute nav context for the currently selected candidate (fallback to first group when no selection)
  const navContext = useMemo<CandidateNavContext | undefined>(() => {
    if (groups.length === 0) return undefined;
    const effectiveId = selectedCandidateId ?? groups[0].candidateId;
    const idx = groups.findIndex((g) => g.candidateId === effectiveId);
    if (idx < 0) return undefined;
    const prev = idx > 0 ? groups[idx - 1] : null;
    const next = idx < groups.length - 1 ? groups[idx + 1] : null;
    return {
      hasPrev: prev !== null,
      hasNext: next !== null,
      prevCandidateName: prev?.candidateName,
      nextCandidateName: next?.candidateName,
      currentIndex: idx + 1,
      total: groups.length,
    };
  }, [groups, selectedCandidateId]);

  const handleSelectCandidate = (id: string) => {
    setSelectedCandidateId(id);
    // Sync the URL hash so a deep-link can be shared / bookmarked
    setSearchParams({ candidate: id }, { replace: true });
  };

  const handleNavigateBy = (delta: number) => {
    if (!selectedCandidateId || groups.length === 0) return;
    const idx = groups.findIndex((g) => g.candidateId === selectedCandidateId);
    if (idx < 0) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= groups.length) return;
    handleSelectCandidate(groups[targetIdx].candidateId);
  };

  const handleBackToCandidates = () => {
    navigate('/candidates');
  };

  // Keyboard shortcuts: ← / → to navigate candidates when toolbar is shown
  useEffect(() => {
    if (!navContext) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Skip when typing in inputs / textareas / contenteditable
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'ArrowLeft' && navContext.hasPrev) {
        e.preventDefault();
        handleNavigateBy(-1);
      } else if (e.key === 'ArrowRight' && navContext.hasNext) {
        e.preventDefault();
        handleNavigateBy(1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navContext]);

  // Auto-select first candidate on data load
  useEffect(() => {
    if (groups.length === 0) {
      setSelectedCandidateId(null);
      return;
    }
    const requestedId = searchParams.get('candidate');
    if (requestedId && groups.find((g) => g.candidateId === requestedId)) {
      setSelectedCandidateId(requestedId);
    } else if (!selectedCandidateId || !groups.find((g) => g.candidateId === selectedCandidateId)) {
      setSelectedCandidateId(groups[0].candidateId);
    }
  }, [groups, searchParams, selectedCandidateId]);

  if (loading) return <div className="text-slate-500">加载中...</div>;

  const totalRounds = groups.reduce((acc, g) => acc + g.rounds.length, 0);

  // V147: compare-mode state derived from URL ?compare=1
  const compareMode = searchParams.get('compare') === '1';
  const setCompareMode = (next: boolean) => {
    if (next) {
      setSearchParams({ compare: '1' }, { replace: true });
    } else if (selectedCandidateId) {
      setSearchParams({ candidate: selectedCandidateId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  // Build candidate comparison rows for the matrix view
  const comparisonRows = useMemo<CandidateComparisonRow[]>(
    () =>
      groups.map((g) =>
        buildCandidateComparisonRow(
          g.candidateId,
          g.candidateName,
          g.candidatePosition,
          g.rounds,
        ),
      ),
    [groups],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">面试记录</h2>
          <p className="mt-1 text-sm text-slate-500">
            共 {groups.length} 位候选人 · {totalRounds} 场面试
            {source === 'static' && <span className="ml-2 badge-amber">静态数据</span>}
            {source === 'api' && <span className="ml-2 badge-green">● 实时</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCompareMode(!compareMode)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            compareMode
              ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
              : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/40'
          }`}
          data-testid="toggle-compare-mode"
          aria-pressed={compareMode}
        >
          {compareMode ? '📋 单候选人模式' : '🔀 对比模式'}
        </button>
      </div>

      {compareMode && (
        <div data-testid="compare-mode-panel">
          <ComparisonMatrix
            rows={comparisonRows}
            onSelectCandidate={(id) => {
              setCompareMode(false);
              handleSelectCandidate(id);
            }}
            selectedCandidateId={selectedCandidateId}
          />
        </div>
      )}

      {!compareMode && groups.length === 0 ? (
        <Card className="text-center text-slate-500">
          暂无面试记录
          {source === 'api' && <span> · 去 Candidates 页点击 &quot;🤖 开始面试&quot; 启动</span>}
        </Card>
      ) : compareMode ? null : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-1" data-testid="candidate-list">
            {groups.map((group) => {
              const isActive = group.candidateId === selectedCandidateId;
              const latest = group.rounds[group.rounds.length - 1];
              const st = latest ? statusLabel(latest.status) : null;
              return (
                <button
                  key={group.candidateId}
                  onClick={() => handleSelectCandidate(group.candidateId)}
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
                    <span title={formatDate(latest?.completedAt ?? latest?.startedAt)}>
                      {relativeTime(latest?.completedAt ?? latest?.startedAt)}
                    </span>
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
                  nav={navContext}
                  onBack={handleBackToCandidates}
                  onPrev={navContext?.hasPrev ? () => handleNavigateBy(-1) : undefined}
                  onNext={navContext?.hasNext ? () => handleNavigateBy(1) : undefined}
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
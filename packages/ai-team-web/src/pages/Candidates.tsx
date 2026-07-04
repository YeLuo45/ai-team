import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamData } from '../lib/hooks';
import { formatDate, statusLabel } from '../lib/format';
import { api } from '../lib/api';
import {
  buildResumeJsonExport,
  buildResumeExportFilename,
  serializeResumeExport,
} from '../lib/resume-export';
import type { CandidateStatus } from '@ai-team/core';
import { AddCandidateModal } from '../components/AddCandidateModal';
import { InterviewSimulator } from '../components/InterviewSimulator';
import { ResumeUploadModal } from '../components/ResumeUploadModal';
import type { Candidate } from '@ai-team/core';
import { Card, Button, Badge, EmptyState } from '../components/design-system';

const CANDIDATE_STATUSES: CandidateStatus[] = [
  'new',
  'screening',
  'interviewing',
  'offer',
  'hired',
  'rejected',
];

export function Candidates() {
  const { data, source, refresh } = useTeamData();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [interviewTarget, setInterviewTarget] = useState<Candidate | null>(null);
  // V148: multi-select state for batch operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);

  const items = filter === 'all' ? data.candidates : data.candidates.filter((c) => c.status === filter);
  const statuses = ['all', ...new Set(data.candidates.map((c) => c.status))];

  const interviewCountByCandidate = new Map<string, number>();
  for (const iv of data.interviews) {
    interviewCountByCandidate.set(iv.candidateId, (interviewCountByCandidate.get(iv.candidateId) ?? 0) + 1);
  }

  const handleStartInterview = async (c: Candidate) => {
    if (source === 'api') {
      setInterviewTarget(c);
    } else {
      alert('面试功能需要连接 server。请先启动 @ai-team/server (npm run dev:server)');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除？')) return;
    if (source === 'api') {
      await api.deleteCandidate(id);
      await refresh();
    } else {
      alert('删除功能需要连接 server');
    }
  };

  const handleViewInterview = (c: Candidate) => {
    navigate(`/interviews?candidate=${encodeURIComponent(c.id)}`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectAllVisible = () => {
    setSelectedIds(new Set(items.map((c) => c.id)));
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (source !== 'api') {
      alert('批量删除需要连接 server');
      return;
    }
    if (!confirm(`确定删除选中的 ${selectedIds.size} 位候选人？`)) return;
    setBatchBusy(true);
    try {
      await Promise.all([...selectedIds].map((id) => api.deleteCandidate(id)));
      clearSelection();
      await refresh();
    } finally {
      setBatchBusy(false);
    }
  };

  const handleBatchUpdateStatus = async (next: CandidateStatus) => {
    if (selectedIds.size === 0) return;
    if (source !== 'api') {
      alert('批量改状态需要连接 server');
      return;
    }
    if (!confirm(`确定将选中的 ${selectedIds.size} 位候选人状态改为「${statusLabel(next).text}」？`)) return;
    setBatchBusy(true);
    try {
      await Promise.all(
        [...selectedIds].map((id) => api.updateCandidate(id, { status: next })),
      );
      await refresh();
    } finally {
      setBatchBusy(false);
    }
  };

  // Download anchor ref — used by the export action
  const downloadAnchorRef = useRef<HTMLAnchorElement | null>(null);

  const handleBatchExport = () => {
    if (selectedIds.size === 0) return;
    const selectedCandidates = data.candidates.filter((c) => selectedIds.has(c.id));
    const payload = buildResumeJsonExport(selectedCandidates, interviewCountByCandidate);
    const json = serializeResumeExport(payload);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildResumeExportFilename();
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Defer revoke so the browser has time to start the download
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Reset selection when filter changes so out-of-view IDs don't linger.
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const visibleIds = new Set(items.map((c) => c.id));
    const next = new Set<string>();
    for (const id of selectedIds) if (visibleIds.has(id)) next.add(id);
    if (next.size !== selectedIds.size) setSelectedIds(next);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const allVisibleSelected = items.length > 0 && items.every((c) => selectedIds.has(c.id));

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">候选人</h2>
            <p className="mt-1 text-sm text-slate-500">
              共 {data.candidates.length} 位候选人
              {source === 'static' && <span className="ml-2 badge-amber">静态数据</span>}
              {source === 'api' && <span className="ml-2 badge-green">● 实时</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {source === 'api' && items.length > 0 && (
              <button
                type="button"
                onClick={allVisibleSelected ? clearSelection : selectAllVisible}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                data-testid="select-all-toggle"
              >
                {allVisibleSelected ? '取消全选' : '全选当前'}
              </button>
            )}
            {statuses.map((s) => (
              <button key={s} onClick={() => setFilter(s)}
                className={`btn ${filter === s ? 'bg-brand-50 text-brand-700' : 'btn-ghost'}`}>
                {s === 'all' ? '全部' : statusLabel(s).text}
              </button>
            ))}
            {source === 'api' && (
              <>
                <button onClick={() => setShowResume(true)} className="btn-ghost">📄 上传简历</button>
                <button onClick={() => setShowAdd(true)} className="btn-primary">+ 添加</button>
              </>
            )}
          </div>
        </div>

        {selectedIds.size > 0 && source === 'api' && (
          <div
            className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50/80 px-3 py-2 text-sm backdrop-blur dark:border-brand-800/50 dark:bg-brand-900/30"
            data-testid="batch-action-toolbar"
          >
            <div className="flex items-center gap-3">
              <span className="text-brand-700 dark:text-brand-300" data-testid="batch-selected-count">
                已选 <strong>{selectedIds.size}</strong> 位候选人
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs text-slate-600 hover:underline dark:text-slate-300"
                data-testid="batch-clear-selection"
              >
                取消选择
              </button>
              <button
                type="button"
                onClick={handleBatchExport}
                disabled={batchBusy}
                className="rounded-md border border-brand-300 bg-white px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-700/50 dark:bg-brand-900/40 dark:text-brand-200"
                data-testid="batch-export"
              >
                📤 导出简历
              </button>
              <label
                className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300"
                data-testid="batch-status-label"
              >
                改状态为
                <select
                  disabled={batchBusy}
                  defaultValue=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const next = e.target.value as CandidateStatus;
                    void handleBatchUpdateStatus(next);
                    e.target.value = '';
                  }}
                  data-testid="batch-status-select"
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                >
                  <option value="" disabled>选择...</option>
                  {CANDIDATE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s).text}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={batchBusy}
                className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="batch-delete"
              >
                {batchBusy ? '处理中...' : `🗑 批量删除 (${selectedIds.size})`}
              </button>
            </div>
            <a ref={downloadAnchorRef} style={{ display: 'none' }} aria-hidden="true" />
          </div>
        )}

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon="👤"
            title="还没有候选人"
            description={source === 'api' ? '点击 "📄 上传简历" 或 "+ 添加" 录入第一位候选人' : '启动 server 启用添加功能'}
            actionLabel={source === 'api' ? '+ 添加候选人' : undefined}
            onAction={source === 'api' ? () => setShowAdd(true) : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c0) => {
            const st = statusLabel(c0.status);
            const tone = st.cls.includes('badge-green') ? 'success' : st.cls.includes('badge-amber') ? 'warning' : st.cls.includes('badge-red') ? 'danger' : st.cls.includes('badge-blue') ? 'info' : 'neutral';
            return (
              <Card key={c0.id}>
                {source === 'api' && (
                  <label
                    className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-slate-500 hover:text-slate-700"
                    data-testid={`candidate-checkbox-label-${c0.id}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c0.id)}
                      onChange={() => toggleSelect(c0.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      data-testid={`candidate-checkbox-${c0.id}`}
                      aria-label={`选择 ${c0.name}`}
                    />
                    <span>{selectedIds.has(c0.id) ? '已选中' : '选择'}</span>
                  </label>
                )}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{c0.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">{c0.position}</p>
                  </div>
                  <Badge tone={tone}>{st.text}</Badge>
                </div>
                <div className="mt-4 space-y-1 text-xs text-slate-500">
                  <p>ID: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{c0.id}</code></p>
                  <p>来源: {c0.source}</p>
                  {c0.email && <p>邮箱: {c0.email}</p>}
                  <p>录入: {formatDate(c0.createdAt)}</p>
                </div>
                {c0.tags && c0.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c0.tags.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
                  </div>
                )}
                {source === 'api' && (
                  <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <Button size="sm" onClick={() => handleStartInterview(c0)}>🤖 开始面试</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(c0.id)}>🗑 删除</Button>
                  </div>
                )}
                <div className={`mt-3 flex items-center justify-between gap-2 ${source === 'api' ? '' : 'border-t border-slate-100 pt-3 dark:border-slate-800'}`}>
                  <span className="text-xs text-slate-500" data-testid={`candidate-interview-count-${c0.id}`}>
                    {interviewCountByCandidate.get(c0.id) ?? 0} 场面试
                  </span>
                  <button
                    type="button"
                    onClick={() => handleViewInterview(c0)}
                    disabled={(interviewCountByCandidate.get(c0.id) ?? 0) === 0}
                    className="text-xs font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                    data-testid={`candidate-view-interviews-${c0.id}`}
                    title={(interviewCountByCandidate.get(c0.id) ?? 0) === 0 ? '该候选人暂无面试记录' : '查看面试详情'}
                  >
                    📋 查看面试详情
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddCandidateModal
          onClose={() => setShowAdd(false)}
          onAdded={() => refresh()}
        />
      )}

      {showResume && (
        <ResumeUploadModal
          onClose={() => setShowResume(false)}
          onImported={() => refresh()}
        />
      )}

      {interviewTarget && (
        <InterviewSimulator
          candidate={interviewTarget}
          onClose={() => { setInterviewTarget(null); refresh(); }}
          onComplete={() => refresh()}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamData } from '../lib/hooks';
import { formatDate, statusLabel } from '../lib/format';
import { AddCandidateModal } from '../components/AddCandidateModal';
import { InterviewSimulator } from '../components/InterviewSimulator';
import { ResumeUploadModal } from '../components/ResumeUploadModal';
import { api } from '../lib/api';
import type { Candidate } from '@ai-team/core';
import { Card, Button, Badge, EmptyState } from '../components/design-system';

export function Candidates() {
  const { data, source, refresh } = useTeamData();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [interviewTarget, setInterviewTarget] = useState<Candidate | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">候选人</h2>
          <p className="mt-1 text-sm text-slate-500">
            共 {data.candidates.length} 位候选人
            {source === 'static' && <span className="ml-2 badge-amber">静态数据 (启动 server 启用交互)</span>}
            {source === 'api' && <span className="ml-2 badge-green">● 实时</span>}
          </p>
        </div>
        <div className="flex gap-2">
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

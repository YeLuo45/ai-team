// V32: Agent Review Console — 主动调用三个 compliance agent 并展示结果
import { useEffect, useState } from 'react';

type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface AgentReviewConsoleProps {
  /** 默认 agent 标签，仅影响初始 tab；运行时由组件内部管理 */
  initialAgent?: 'legal' | 'tech-policy' | 'media-compliance';
}

interface FetchState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

const initial = <T,>(): FetchState<T> => ({ loading: false, error: null, data: null });

export function AgentReviewConsole({ initialAgent = 'legal' }: AgentReviewConsoleProps) {
  const [tab, setTab] = useState<'legal' | 'tech-policy' | 'media-compliance' | 'sibling-org-conflict'>(initialAgent);
  const [legalText, setLegalText] = useState('');
  const [techText, setTechText] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaChannel, setMediaChannel] = useState<'wechat' | 'douyin' | 'xiaohongshu' | 'bilibili' | 'feishu' | 'other'>('wechat');
  const [mediaExcerpt, setMediaExcerpt] = useState('');
  const [siblingText, setSiblingText] = useState('');
  const [legalState, setLegalState] = useState<FetchState<{ assessment: { level: Severity } }>>(initial());
  const [techState, setTechState] = useState<FetchState<{ assessment: { severity: Severity } }>>(initial());
  const [mediaState, setMediaState] = useState<FetchState<{ check: { assessment: { level: Severity } } }>>(initial());
  const [siblingState, setSiblingState] = useState<FetchState<{ conflict: { severity: Severity } }>>(initial());

  async function callLegal() {
    if (!legalText.trim()) return;
    setLegalState({ loading: true, error: null, data: null });
    try {
      const r = await fetch('/api/compliance/legal/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: legalText }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setLegalState({ loading: false, error: null, data: json });
    } catch (e) {
      setLegalState({ loading: false, error: e instanceof Error ? e.message : 'unknown', data: null });
    }
  }

  async function callTech() {
    if (!techText.trim()) return;
    setTechState({ loading: true, error: null, data: null });
    try {
      const r = await fetch('/api/compliance/tech-policy/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: techText }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setTechState({ loading: false, error: null, data: json });
    } catch (e) {
      setTechState({ loading: false, error: e instanceof Error ? e.message : 'unknown', data: null });
    }
  }

  async function callMedia() {
    if (!mediaTitle.trim()) return;
    setMediaState({ loading: true, error: null, data: null });
    try {
      const r = await fetch('/api/compliance/media/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: `a-${Date.now()}`, title: mediaTitle, channel: mediaChannel, excerpt: mediaExcerpt }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setMediaState({ loading: false, error: null, data: json });
    } catch (e) {
      setMediaState({ loading: false, error: e instanceof Error ? e.message : 'unknown', data: null });
    }
  }

  async function callSibling() {
    if (!siblingText.trim()) return;
    setSiblingState({ loading: true, error: null, data: null });
    try {
      const r = await fetch('/api/compliance/sibling-org-conflict/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: siblingText }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setSiblingState({ loading: false, error: null, data: json });
    } catch (e) {
      setSiblingState({ loading: false, error: e instanceof Error ? e.message : 'unknown', data: null });
    }
  }

  useEffect(() => {
    // 切换 tab 时清空当前结果，避免混淆
    setLegalState(initial());
    setTechState(initial());
    setMediaState(initial());
    setSiblingState(initial());
  }, [tab]);

  const tone = (s: Severity | undefined) =>
    s === 'critical' ? 'border-rose-300 bg-rose-50 text-rose-700'
    : s === 'high' ? 'border-orange-300 bg-orange-50 text-orange-700'
    : s === 'medium' ? 'border-amber-300 bg-amber-50 text-amber-700'
    : s === 'low' ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
    : 'border-slate-200 bg-white text-slate-500';

  return (
    <div className="space-y-6" data-testid="agent-review-console">
      <div>
        <h2 className="text-2xl font-bold">Agent Review Console</h2>
        <p className="text-sm text-slate-500">主动调用 Legal / Tech Policy / Media Compliance 三个 agent，每次调用都会进入 Agent Audit 审计台。</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200" data-testid="agent-tabs">
        {([
          { id: 'legal' as const, label: 'Legal' },
          { id: 'tech-policy' as const, label: 'Tech Policy' },
          { id: 'media-compliance' as const, label: 'Media Compliance' },
          { id: 'sibling-org-conflict' as const, label: 'Sibling Org' },
        ]).map((t) => (
          <button
            key={t.id}
            data-testid={`agent-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm ${tab === t.id
              ? 'border-b-2 border-brand-500 font-semibold text-brand-700'
              : 'text-slate-500 hover:text-slate-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'legal' && (
        <div className="space-y-3" data-testid="agent-panel-legal">
          <label className="block text-sm">
            待审查文本
            <textarea
              data-testid="legal-text"
              className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
              rows={3}
              value={legalText}
              onChange={(e) => setLegalText(e.target.value)}
              placeholder="例：员工投诉歧视并准备劳动仲裁"
            />
          </label>
          <button
            data-testid="legal-submit"
            onClick={callLegal}
            disabled={legalState.loading || !legalText.trim()}
            className="rounded bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {legalState.loading ? '评估中…' : '调用 Legal'}
          </button>
          {legalState.error && (
            <div data-testid="legal-error" className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
              {legalState.error}
            </div>
          )}
          {legalState.data && (
            <div
              data-testid="legal-result"
              className={`rounded border p-3 text-sm ${tone(legalState.data.assessment.level)}`}
            >
              风险等级：{legalState.data.assessment.level}
            </div>
          )}
        </div>
      )}

      {tab === 'tech-policy' && (
        <div className="space-y-3" data-testid="agent-panel-tech-policy">
          <label className="block text-sm">
            事件描述
            <textarea
              data-testid="tech-text"
              className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
              rows={3}
              value={techText}
              onChange={(e) => setTechText(e.target.value)}
              placeholder="例：生产密钥硬编码并已提交到公开仓库"
            />
          </label>
          <button
            data-testid="tech-submit"
            onClick={callTech}
            disabled={techState.loading || !techText.trim()}
            className="rounded bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {techState.loading ? '评估中…' : '调用 Tech Policy'}
          </button>
          {techState.error && (
            <div data-testid="tech-error" className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
              {techState.error}
            </div>
          )}
          {techState.data && (
            <div
              data-testid="tech-result"
              className={`rounded border p-3 text-sm ${tone(techState.data.assessment.severity)}`}
            >
              严重等级：{techState.data.assessment.severity}
            </div>
          )}
        </div>
      )}

      {tab === 'media-compliance' && (
        <div className="space-y-3" data-testid="agent-panel-media-compliance">
          <label className="block text-sm">
            素材标题
            <input
              data-testid="media-title"
              className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
              value={mediaTitle}
              onChange={(e) => setMediaTitle(e.target.value)}
              placeholder="例：品牌代言视频"
            />
          </label>
          <label className="block text-sm">
            渠道
            <select
              data-testid="media-channel"
              className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
              value={mediaChannel}
              onChange={(e) => setMediaChannel(e.target.value as typeof mediaChannel)}
            >
              <option value="wechat">WeChat</option>
              <option value="douyin">Douyin</option>
              <option value="xiaohongshu">Xiaohongshu</option>
              <option value="bilibili">Bilibili</option>
              <option value="feishu">Feishu</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block text-sm">
            摘录（可选）
            <textarea
              data-testid="media-excerpt"
              className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
              rows={2}
              value={mediaExcerpt}
              onChange={(e) => setMediaExcerpt(e.target.value)}
            />
          </label>
          <button
            data-testid="media-submit"
            onClick={callMedia}
            disabled={mediaState.loading || !mediaTitle.trim()}
            className="rounded bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {mediaState.loading ? '检查中…' : '调用 Media Compliance'}
          </button>
          {mediaState.error && (
            <div data-testid="media-error" className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
              {mediaState.error}
            </div>
          )}
          {mediaState.data && (
            <div
              data-testid="media-result"
              className={`rounded border p-3 text-sm ${tone(mediaState.data.check.assessment.level)}`}
            >
              合规等级：{mediaState.data.check.assessment.level}
            </div>
          )}
        </div>
      )}

      {tab === 'sibling-org-conflict' && (
        <div className="space-y-3" data-testid="agent-panel-sibling">
          <label className="block text-sm">
            冲突描述
            <textarea
              data-testid="sibling-text"
              className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
              rows={3}
              value={siblingText}
              onChange={(e) => setSiblingText(e.target.value)}
              placeholder="例：A 团队负责人要求删除 B 团队共享文档"
            />
          </label>
          <button
            data-testid="sibling-submit"
            onClick={callSibling}
            disabled={siblingState.loading || !siblingText.trim()}
            className="rounded bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {siblingState.loading ? '检测中…' : '调用 Sibling Org Conflict'}
          </button>
          {siblingState.error && (
            <div data-testid="sibling-error" className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
              {siblingState.error}
            </div>
          )}
          {siblingState.data && (
            <div
              data-testid="sibling-result"
              className={`rounded border p-3 text-sm ${tone(siblingState.data.conflict.severity)}`}
            >
              冲突等级：{siblingState.data.conflict.severity}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AgentReviewConsole;

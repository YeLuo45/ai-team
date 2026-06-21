// V34: Agent Config console — per-agent independent configuration UI.
// Lets users edit soul/user/memory + LLM override per AgentKind, hit PUT/DELETE/RESET.
import { useEffect, useState } from 'react';
import { agentConfigApi, type AgentConfigItem, type AgentConfigPatch } from '../lib/api';

const AGENT_KINDS: Array<{ kind: string; label: string }> = [
  { kind: 'interview',         label: '🎤 面试官' },
  { kind: 'training',          label: '🧑‍🏫 培训师' },
  { kind: 'one-on-one',        label: '🤝 1:1 成员' },
  { kind: 'review',            label: '⭐ Review 经理' },
  { kind: 'resume',            label: '📄 简历解析' },
  { kind: 'insights',          label: '🧠 智能分析' },
  { kind: 'score',             label: '🎯 简历评分' },
  { kind: 'search',            label: '🔍 全文搜索' },
  { kind: 'legal',             label: '⚖️ 法律风险' },
  { kind: 'tech-policy',       label: '🛡️ 技术合规' },
  { kind: 'media-compliance',  label: '📺 媒体合规' },
  { kind: 'sibling-org-conflict', label: '🤝 兄弟部门冲突' },
];

export function AgentConfig() {
  const [items, setItems] = useState<AgentConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<AgentConfigItem | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await agentConfigApi.list();
      setItems(r.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const openKind = async (kind: string) => {
    setSelected(kind);
    setError(null);
    try {
      const r = await agentConfigApi.get(kind);
      setDraft(r.config);
    } catch {
      // 404 → start with empty defaults
      setDraft({
        agent: kind, soul: '', user: '', memory: '',
        llm: {}, updatedAt: '',
      });
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const patch: AgentConfigPatch = {
        soul: draft.soul, user: draft.user, memory: draft.memory,
        llm: {
          ...(draft.llm.providerId ? { providerId: draft.llm.providerId } : {}),
          ...(draft.llm.model ? { model: draft.llm.model } : {}),
          ...(draft.llm.temperature !== undefined ? { temperature: Number(draft.llm.temperature) } : {}),
          ...(draft.llm.maxTokens !== undefined && draft.llm.maxTokens > 0 ? { maxTokens: Number(draft.llm.maxTokens) } : {}),
        },
      };
      const r = await agentConfigApi.put(draft.agent, patch);
      setDraft(r.config);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await agentConfigApi.delete(draft.agent);
      setSelected(null);
      setDraft(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetLlm = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const r = await agentConfigApi.resetLlm(draft.agent);
      setDraft(r.config);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-500">加载中...</div>;

  const configuredKinds = new Set(items.map((it) => it.agent));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Agent 独立配置</h2>
        <p className="mt-1 text-sm text-slate-500">
          每个 agent 独立设置 soul / user / memory 提示词和 LLM 模型。互不影响, 修改后立即对该 agent 下一次调用生效。
        </p>
      </div>

      {error && (
        <div className="card border-rose-300 bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
          ⚠ {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1" data-testid="agent-config-list">
          {AGENT_KINDS.map((entry) => {
            const configured = configuredKinds.has(entry.kind);
            const isActive = selected === entry.kind;
            return (
              <button
                key={entry.kind}
                type="button"
                onClick={() => void openKind(entry.kind)}
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                  isActive
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                }`}
              >
                <span className="text-sm font-medium">{entry.label}</span>
                <span className={`text-xs ${configured ? 'badge-green' : 'badge-amber'}`}>
                  {configured ? '已配置' : '默认'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-2">
          {!draft ? (
            <div className="card text-center text-slate-500">← 选择一个 agent 配置</div>
          ) : (
            <div className="card space-y-4" data-testid={`agent-config-editor-${draft.agent}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{draft.agent}</h3>
                <span className="text-xs text-slate-500">
                  {draft.updatedAt ? `更新: ${new Date(draft.updatedAt).toLocaleString()}` : '从未保存'}
                </span>
              </div>

              <Field label="SOUL · 人格/价值观" rows={4} value={draft.soul}
                onChange={(v) => setDraft({ ...draft, soul: v })}
                testId={`agent-config-soul-${draft.agent}`} />
              <Field label="USER · 用户偏好" rows={3} value={draft.user}
                onChange={(v) => setDraft({ ...draft, user: v })}
                testId={`agent-config-user-${draft.agent}`} />
              <Field label="MEMORY · 长期记忆" rows={3} value={draft.memory}
                onChange={(v) => setDraft({ ...draft, memory: v })}
                testId={`agent-config-memory-${draft.agent}`} />

              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <p className="mb-2 text-xs font-semibold text-slate-500">LLM 覆盖</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="Provider ID" value={draft.llm.providerId ?? ''}
                    onChange={(v) => setDraft({ ...draft, llm: { ...draft.llm, providerId: v || undefined } })}
                    placeholder="(使用全局默认)"
                    testId={`agent-config-provider-${draft.agent}`} />
                  <Input label="Model" value={draft.llm.model ?? ''}
                    onChange={(v) => setDraft({ ...draft, llm: { ...draft.llm, model: v || undefined } })}
                    placeholder="(使用 provider 默认)"
                    testId={`agent-config-model-${draft.agent}`} />
                  <Input label="Temperature (0-2)" value={String(draft.llm.temperature ?? '')}
                    onChange={(v) => setDraft({ ...draft, llm: { ...draft.llm, temperature: v === '' ? undefined : Number(v) } })}
                    placeholder="(使用默认)"
                    testId={`agent-config-temperature-${draft.agent}`} />
                  <Input label="Max Tokens" value={String(draft.llm.maxTokens ?? '')}
                    onChange={(v) => setDraft({ ...draft, llm: { ...draft.llm, maxTokens: v === '' ? undefined : Number(v) } })}
                    placeholder="(使用默认)"
                    testId={`agent-config-maxtokens-${draft.agent}`} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-primary disabled:opacity-50"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  data-testid={`agent-config-save-${draft.agent}`}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  type="button"
                  className="btn-ghost disabled:opacity-50"
                  disabled={saving || !draft.updatedAt}
                  onClick={() => void handleResetLlm()}
                  data-testid={`agent-config-resetllm-${draft.agent}`}
                >
                  重置 LLM
                </button>
                <button
                  type="button"
                  className="btn-ghost text-rose-600 disabled:opacity-50"
                  disabled={saving || !draft.updatedAt}
                  onClick={() => void handleDelete()}
                  data-testid={`agent-config-delete-${draft.agent}`}
                >
                  删除
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, rows, value, onChange, testId }: {
  label: string; rows: number; value: string;
  onChange: (v: string) => void;
  testId?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        data-testid={testId}
      />
    </div>
  );
}

function Input({ label, value, onChange, placeholder, testId }: {
  label: string; value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        data-testid={testId}
      />
    </div>
  );
}

export default AgentConfig;

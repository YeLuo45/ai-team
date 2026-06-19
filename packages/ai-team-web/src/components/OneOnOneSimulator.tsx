// 1:1 Conversation Simulator - AI plays the member role, manager types

import { useState, useEffect, useRef } from 'react';
import type { Member } from '@ai-team/core';

type Scenario = 'performance' | 'career' | 'project_retro' | 'difficult' | 'general';

const SCENARIO_LABELS: Record<Scenario, string> = {
  performance: '📊 绩效反馈',
  career: '🚀 职业规划',
  project_retro: '🔄 项目复盘',
  difficult: '⚠️ 困难沟通',
  general: '💬 例行交流',
};

interface ChatMsg {
  role: 'manager' | 'member';
  content: string;
  timestamp: string;
}

interface Summary {
  topics: string[];
  commitments: string[];
  actions: string[];
  followUp: string;
  sentiment: 'positive' | 'neutral' | 'concerned';
}

const SENTIMENT_COLORS = {
  positive: 'badge-green',
  neutral: 'badge-slate',
  concerned: 'badge-amber',
};
const SENTIMENT_LABELS = {
  positive: '积极',
  neutral: '中性',
  concerned: '需关注',
};

interface Props {
  member: Member;
  onClose: () => void;
}

export function OneOnOneSimulator({ member, onClose }: Props) {
  const [step, setStep] = useState<'setup' | 'chat' | 'done'>('setup');
  const [scenario, setScenario] = useState<Scenario>('general');
  const [managerName, setManagerName] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startSession = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/one-on-one/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, scenario, managerName: managerName || '经理' }),
      });
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
      const json = await r.json();
      setSessionId(json.session.id);
      setMessages([
        { role: 'member', content: json.openingMessage, timestamp: new Date().toISOString() },
      ]);
      setStep('chat');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendManager = async () => {
    if (!input.trim() || !sessionId || busy) return;
    const text = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'manager', content: text, timestamp: new Date().toISOString() }]);
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/one-on-one/${sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
      const json = await r.json();
      if (json.done) {
        // Auto-finalize
        await finalize();
      } else {
        setMessages((prev) => [...prev, { role: 'member', content: json.memberResponse, timestamp: new Date().toISOString() }]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    if (!sessionId) return;
    try {
      const r = await fetch(`/api/one-on-one/${sessionId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
      const json = await r.json();
      setSummary(json.summary);
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="card flex h-[85vh] w-full max-w-3xl flex-col shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">🎭 1:1 对话模拟 - {member.name}</h3>
            <p className="text-xs text-slate-500">
              {member.role} · {member.team}
              {step === 'chat' && <span className="ml-2 badge-blue">{SCENARIO_LABELS[scenario]}</span>}
              {step === 'done' && summary && <span className={`ml-2 ${SENTIMENT_COLORS[summary.sentiment]}`}>{SENTIMENT_LABELS[summary.sentiment]}</span>}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost">×</button>
        </div>

        {error && <div className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">⚠ {error}</div>}

        {step === 'setup' && (
          <div className="flex-1 space-y-4 overflow-y-auto">
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
              <h4 className="mb-2 text-sm font-semibold">选择情景</h4>
              <div className="space-y-2">
                {Object.entries(SCENARIO_LABELS).map(([k, label]) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                    <input type="radio" name="scenario" checked={scenario === k} onChange={() => setScenario(k as Scenario)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">你的名字 (经理)</label>
              <input value={managerName} onChange={(e) => setManagerName(e.target.value)}
                placeholder="留空使用 '经理'"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-xs dark:bg-blue-900/20">
              <p className="text-slate-600 dark:text-slate-300">💡 AI 将扮演 {member.name}，使用其真实背景 (角色/技能/培训历史)。请用第一人称与员工沟通。</p>
            </div>
          </div>
        )}

        {step === 'chat' && (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'manager' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    m.role === 'manager'
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                  }`}>
                    <div className="mb-0.5 text-xs font-medium opacity-70">
                      {m.role === 'manager' ? '👤 你 (经理)' : `🤖 ${member.name}`}
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-white px-4 py-2.5 text-slate-500 shadow-sm dark:bg-slate-700">思考中...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="mt-4 flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendManager(); } }}
                disabled={busy}
                placeholder={busy ? 'AI 思考中...' : '输入你要对成员说的话，按 Enter 发送'}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              <button onClick={sendManager} disabled={busy || !input.trim()} className="btn-primary disabled:opacity-50">发送</button>
              <button onClick={finalize} disabled={busy || messages.length < 2} className="btn-ghost text-xs">提前结束 → 摘要</button>
            </div>
            <div className="mt-2 text-center text-xs text-slate-400">
              {messages.length} 轮对话 · AI 扮演 {member.name}
            </div>
          </>
        )}

        {step === 'done' && summary && (
          <div className="flex-1 space-y-4 overflow-y-auto">
            <div className="rounded-lg bg-gradient-to-br from-brand-50 to-violet-50 p-4 dark:from-brand-900/20 dark:to-violet-900/20">
              <h4 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-50">📋 1:1 摘要</h4>

              {summary.topics.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">讨论议题</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-slate-700 dark:text-slate-200">
                    {summary.topics.map((t, i) => <li key={i}>· {t}</li>)}
                  </ul>
                </div>
              )}

              {summary.commitments.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-emerald-600">🤝 承诺</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-slate-700 dark:text-slate-200">
                    {summary.commitments.map((c, i) => <li key={i}>· {c}</li>)}
                  </ul>
                </div>
              )}

              {summary.actions.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-blue-600">⚡ 行动项</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-slate-700 dark:text-slate-200">
                    {summary.actions.map((a, i) => <li key={i}>· {a}</li>)}
                  </ul>
                </div>
              )}

              <div className="mt-3 rounded-lg bg-white/60 p-3 text-sm dark:bg-slate-900/40">
                <p className="text-xs font-semibold text-slate-500">后续跟进</p>
                <p className="mt-1 text-slate-700 dark:text-slate-200">{summary.followUp}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {step === 'setup' && (
            <>
              <button onClick={onClose} className="btn-ghost">取消</button>
              <button onClick={startSession} disabled={busy} className="btn-primary disabled:opacity-50">
                {busy ? '启动中...' : '🎬 开始 1:1'}
              </button>
            </>
          )}
          {step === 'chat' && (
            <button onClick={onClose} className="btn-ghost">关闭</button>
          )}
          {step === 'done' && (
            <>
              <button onClick={() => { setStep('setup'); setMessages([]); setSummary(null); setSessionId(null); }} className="btn-ghost">↻ 重新开始</button>
              <button onClick={onClose} className="btn-primary">完成</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// In-browser Interview Simulator — calls the local server (LLM key on server)

import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import type { Interview, Candidate } from '@ai-team/core';

interface Props {
  candidate: Candidate;
  onClose: () => void;
  onComplete: (interview: Interview) => void;
}

interface ChatMessage {
  role: 'interviewer' | 'candidate';
  content: string;
  timestamp: string;
}

export function InterviewSimulator({ candidate, onClose, onComplete }: Props) {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBusy(true);
        const r = await api.startInterview(candidate.id, 'technical');
        if (cancelled) return;
        setInterview(r.interview);
        if (r.nextQuestion) {
          setMessages([{ role: 'interviewer', content: r.nextQuestion, timestamp: new Date().toISOString() }]);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [candidate.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendAnswer = async () => {
    if (!input.trim() || !interview || busy || done) return;
    const answer = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'candidate', content: answer, timestamp: new Date().toISOString() }]);
    setBusy(true);
    setError(null);
    try {
      const r = await api.submitAnswer(interview.id, answer);
      setInterview(r.interview);
      if (r.nextQuestion) {
        setMessages((prev) => [...prev, { role: 'interviewer', content: r.nextQuestion!, timestamp: new Date().toISOString() }]);
      } else {
        // Time to finalize
        const final = await api.finalizeInterview(interview.id);
        setInterview(final);
        setDone(true);
        onComplete(final);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="card flex h-[80vh] w-full max-w-2xl flex-col shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">AI 面试 - {candidate.name}</h3>
            <p className="text-xs text-slate-500">{candidate.position} · {interview?.id ?? '加载中...'}</p>
          </div>
          <button onClick={onClose} className="btn-ghost">×</button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
            ⚠ {error}
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
          {messages.length === 0 && busy && (
            <div className="text-center text-slate-500">AI 面试官准备中...</div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'interviewer' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  m.role === 'interviewer'
                    ? 'bg-brand-100 text-slate-900 dark:bg-brand-900/30 dark:text-slate-100'
                    : 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                }`}
              >
                <div className="mb-0.5 text-xs font-medium opacity-70">
                  {m.role === 'interviewer' ? '🤖 AI 面试官' : '👤 你'}
                </div>
                <div className="whitespace-pre-wrap text-sm">{m.content}</div>
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-brand-100 px-4 py-2.5 text-slate-500 dark:bg-brand-900/30">思考中...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {done && interview?.evaluation ? (
          <div className="mt-4 rounded-lg bg-emerald-50 p-4 dark:bg-emerald-900/30">
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              ✓ 面试完成 · 总分 {interview.evaluation.overall}/100 · {interview.evaluation.recommendation}
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{interview.evaluation.summary}</p>
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            <input
              data-testid="interview-answer-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAnswer(); } }}
              disabled={busy || done || !interview}
              placeholder={busy ? 'AI 思考中...' : '输入你的回答，按 Enter 发送'}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <button data-testid="interview-send-button" onClick={sendAnswer} disabled={busy || done || !input.trim()} className="btn-primary disabled:opacity-50">
              发送
            </button>
          </div>
        )}

        <div className="mt-2 text-center text-xs text-slate-400">
          {messages.length} 轮对话 · 由 server (localhost:3000) 代理 LLM 调用
        </div>
      </div>
    </div>
  );
}

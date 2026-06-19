// Toast notification system

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useEventSource } from '../hooks/useEventSource';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  link?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (t: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const showToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const toast: Toast = { id, duration: 5000, type: 'info', ...t };
    setToasts((prev) => [...prev, toast]);
    // Auto-remove after duration
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => removeToast(id), toast.duration);
    }
  }, [removeToast]);
  const clearToasts = useCallback(() => setToasts([]), []);

  // Subscribe to SSE for real-time notifications (only when explicitly enabled)
  const { connected } = useEventSource<any>('/api/events/stream', (event) => {
    if (event.event === 'interview.completed' && event.data) {
      const iv = event.data;
      showToast({
        type: 'success',
        title: '✅ 面试完成',
        message: `${iv.candidateId} · 评分 ${iv.evaluation?.overall ?? '?'} · ${iv.evaluation?.recommendation ?? ''}`,
        link: '#/interviews',
      });
    } else if (event.event === 'candidate.created' && event.data) {
      const c = event.data;
      showToast({
        type: 'info',
        title: '👤 新候选人',
        message: `${c.name} (${c.position})`,
        link: '#/candidates',
      });
    } else if (event.event === 'review.saved' && event.data) {
      const r = event.data;
      showToast({
        type: 'success',
        title: '⭐ Review 保存',
        message: `${r.memberId} · ${r.period} · ${r.rating}★`,
        link: '#/reviews',
      });
    } else if (event.event === 'training.created' && event.data) {
      const t = event.data;
      showToast({
        type: 'info',
        title: '📚 培训计划',
        message: `${t.title} - ${t.memberId}`,
      });
    }
  }, { enabled: false });  // TODO: re-enable when SSE auth/filtering is sorted out

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, clearToasts }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();
  return (
    <div className="fixed right-4 top-4 z-50 flex max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`card flex animate-pulse-once items-start gap-3 p-3 shadow-lg ${getToastClass(t.type)}`}
          onClick={() => t.link && (window.location.hash = t.link.slice(1))}
          style={{ cursor: t.link ? 'pointer' : 'default' }}
        >
          <div className="flex-1">
            <div className="text-sm font-semibold">{t.title}</div>
            <div className="mt-0.5 text-xs text-slate-500">{t.message}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); removeToast(t.id); }}
            className="text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function getToastClass(type: Toast['type']): string {
  switch (type) {
    case 'success': return 'border-l-4 border-l-emerald-500';
    case 'error': return 'border-l-4 border-l-rose-500';
    case 'warning': return 'border-l-4 border-l-amber-500';
    default: return 'border-l-4 border-l-blue-500';
  }
}

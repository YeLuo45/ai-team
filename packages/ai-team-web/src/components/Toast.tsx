// Toast notification system

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

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
    const toast: Toast = { id, ...t, duration: t.duration ?? 5000 };
    setToasts((prev) => [...prev, toast]);
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => removeToast(id), toast.duration);
    }
  }, [removeToast]);
  const clearToasts = useCallback(() => setToasts([]), []);

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
          className={`card flex items-start gap-3 p-3 shadow-lg ${getToastClass(t.type)}`}
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

// Command palette - global Cmd+K search

import { useEffect, useState, useCallback, useRef } from 'react';
import type { SearchResult } from '../lib/api';

const ICONS: Record<string, string> = {
  candidate: '👤',
  member: '🧑‍💻',
  interview: '🎤',
  skill: '🎯',
  training: '📚',
  review: '⭐',
};

const TYPE_LABELS: Record<string, string> = {
  candidate: '候选人',
  member: '成员',
  interview: '面试',
  skill: '技能',
  training: '培训',
  review: 'Review',
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
        const data = await r.json();
        setResults(data.results ?? []);
        setSelected(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && results[selected]) {
      const r = results[selected];
      if (r.link) window.location.hash = r.link.slice(1);
      setOpen(false);
      setQuery('');
    }
  }, [results, selected]);

  if (!open) return null;

  // Group by type
  const grouped = results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-slate-200 px-4 dark:border-slate-700">
          <span className="text-xl text-slate-400">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索候选人、成员、面试、技能... (Cmd+K)"
            className="flex-1 bg-transparent px-3 py-4 text-base outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {!query && (
            <div className="p-6 text-center text-sm text-slate-500">
              开始输入以搜索 ✨
            </div>
          )}

          {query && loading && (
            <div className="p-6 text-center text-sm text-slate-500">搜索中...</div>
          )}

          {query && !loading && results.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">
              没有匹配 "<span className="font-bold">{query}</span>" 的结果
            </div>
          )}

          {Object.entries(grouped).map(([type, items]) => (
            <div key={type} className="border-b border-slate-100 dark:border-slate-800">
              <div className="bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800/50">
                {TYPE_LABELS[type] ?? type} ({items.length})
              </div>
              {items.map((r) => {
                const idx = results.indexOf(r);
                return (
                  <div
                    key={`${type}-${r.id}`}
                    onClick={() => {
                      if (r.link) window.location.hash = r.link.slice(1);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`flex cursor-pointer items-start gap-3 px-4 py-2.5 ${
                      idx === selected ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <span className="text-lg">{ICONS[type] ?? '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-slate-50">{r.title}</span>
                        {r.subtitle && <span className="text-xs text-slate-500">· {r.subtitle}</span>}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">{r.snippet}</div>
                    </div>
                    <span className="text-[10px] text-slate-400">{r.score}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="flex gap-3">
            <span><kbd className="rounded bg-white px-1 dark:bg-slate-700">↑↓</kbd> 移动</span>
            <span><kbd className="rounded bg-white px-1 dark:bg-slate-700">↵</kbd> 选择</span>
            <span><kbd className="rounded bg-white px-1 dark:bg-slate-700">esc</kbd> 关闭</span>
          </div>
          {results.length > 0 && <span>{results.length} 个结果</span>}
        </div>
      </div>
    </div>
  );
}

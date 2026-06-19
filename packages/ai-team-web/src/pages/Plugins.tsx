// Plugins page - manage installed plugins, toggle, config

import { useEffect, useState } from 'react';
import type { PluginConfig } from '../lib/api';

export function Plugins() {
  const [plugins, setPlugins] = useState<PluginConfig[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [pluginsResp, eventsResp] = await Promise.all([
        fetch('/api/plugins'),
        fetch('/api/plugins/hooks/events'),
      ]);
      setPlugins(await pluginsResp.json());
      setEvents(await eventsResp.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id: string) => {
    try {
      const r = await fetch(`/api/plugins/${id}/toggle`, { method: 'POST' });
      if (!r.ok) throw new Error(`API ${r.status}`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const startEdit = (cfg: PluginConfig) => {
    setEditing(cfg.id);
    setEditConfig(
      Object.fromEntries(
        Object.entries(cfg.config).map(([k, v]) => [k, String(v ?? '')])
      )
    );
  };

  const saveConfig = async (id: string) => {
    try {
      const r = await fetch(`/api/plugins/${id}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: editConfig }),
      });
      if (!r.ok) throw new Error(`API ${r.status}`);
      setEditing(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const CATEGORY_COLORS: Record<string, string> = {
    integration: 'badge-blue',
    analysis: 'badge-amber',
    automation: 'badge-green',
    ui: 'badge-slate',
    other: 'badge-slate',
  };

  if (loading) return <div className="text-slate-500">加载插件...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">🔌 插件系统</h2>
        <p className="mt-1 text-sm text-slate-500">
          {plugins.length} 个已安装插件 · {events.length} 个可订阅事件
        </p>
      </div>

      {error && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">⚠ {error}</div>}

      {/* Available events */}
      <div className="card">
        <h3 className="mb-2 text-base font-semibold">📡 可订阅事件 (Hooks)</h3>
        <div className="flex flex-wrap gap-1.5">
          {events.map((e) => (
            <span key={e} className="badge-blue font-mono text-[11px]">{e}</span>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          插件可以订阅上述事件。当事件触发时，server 会 POST 到插件的 webhook URL (fire-and-forget)。
        </p>
      </div>

      {/* Installed plugins */}
      <div className="space-y-3">
        {plugins.map((cfg) => (
          <div key={cfg.id} className="card">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{cfg.manifest.icon ?? '🔌'}</span>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{cfg.manifest.name}</h3>
                  <span className="text-xs text-slate-400">v{cfg.manifest.version}</span>
                  {cfg.manifest.category && (
                    <span className={CATEGORY_COLORS[cfg.manifest.category] ?? 'badge-slate'}>
                      {cfg.manifest.category}
                    </span>
                  )}
                  {cfg.enabled ? (
                    <span className="badge-green">● 启用</span>
                  ) : (
                    <span className="badge-slate">○ 停用</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{cfg.manifest.description}</p>
                {cfg.manifest.author && <p className="mt-1 text-xs text-slate-400">by {cfg.manifest.author}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <button onClick={() => toggle(cfg.id)}
                  className={cfg.enabled ? 'btn-ghost text-xs' : 'btn-primary text-xs'}>
                  {cfg.enabled ? '⏸ 停用' : '▶ 启用'}
                </button>
                {cfg.manifest.configSchema && Object.keys(cfg.manifest.configSchema).length > 0 && (
                  <button onClick={() => editing === cfg.id ? setEditing(null) : startEdit(cfg)} className="btn-ghost text-xs">
                    {editing === cfg.id ? '× 取消' : '⚙️ 配置'}
                  </button>
                )}
              </div>
            </div>

            {/* Hooks */}
            {cfg.manifest.hooks.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="mb-1 text-xs text-slate-500">订阅事件:</p>
                <div className="flex flex-wrap gap-1">
                  {cfg.manifest.hooks.map((h: any) => (
                    <span key={h.event} className="badge-slate font-mono text-[11px]">
                      {h.event}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Config editor */}
            {editing === cfg.id && cfg.manifest.configSchema && (
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-500">⚙️ 插件配置</p>
                {Object.entries(cfg.manifest.configSchema as Record<string, { type: string; description: string; required?: boolean }>).map(([key, schema]) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs text-slate-600">
                      <span className="font-mono">{key}</span> {schema.required && <span className="text-rose-500">*</span>}
                      <span className="ml-1 text-slate-400">({schema.description})</span>
                    </label>
                    <input
                      value={editConfig[key] ?? ''}
                      onChange={(e) => setEditConfig({ ...editConfig, [key]: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                ))}
                <button onClick={() => saveConfig(cfg.id)} className="btn-primary text-xs">💾 保存配置</button>
              </div>
            )}

            {/* Current config display */}
            {editing !== cfg.id && Object.keys(cfg.config).length > 0 && (
              <details className="mt-3 text-xs text-slate-500">
                <summary className="cursor-pointer">查看当前配置</summary>
                <pre className="mt-2 rounded-lg bg-slate-50 p-2 font-mono text-[11px] dark:bg-slate-800/50">
                  {JSON.stringify(cfg.config, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>

      {plugins.length === 0 && (
        <div className="card text-center text-slate-500">
          暂无插件。在 <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">data/plugins/</code> 添加 manifest JSON 后重启 server。
        </div>
      )}
    </div>
  );
}

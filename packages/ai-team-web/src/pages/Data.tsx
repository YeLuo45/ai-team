// Data page - export/import

import { useState, useRef } from 'react';
import { useTeamData } from '../lib/hooks';

export function Data() {
  const { refresh } = useTeamData();
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = (format: 'json' | 'csv' | 'md') => {
    const url = `/api/export?format=${format}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setMessage(`✅ 已开始下载 ${format.toUpperCase()} 文件`);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleImport = async (mode: 'merge' | 'replace') => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setMessage('⚠ 请先选择文件');
      return;
    }
    setImporting(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const r = await fetch(`/api/import?mode=${mode}`, { method: 'POST', body: formData });
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
      const json = await r.json();
      setMessage(`✅ 导入成功 (${mode}): ` + JSON.stringify(json.imported));
      refresh();
    } catch (err) {
      setMessage(`❌ 导入失败: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">💾 数据管理</h2>
        <p className="mt-1 text-sm text-slate-500">导出 / 导入全部业务数据</p>
      </div>

      {message && (
        <div className="card">{message}</div>
      )}

      {/* Export */}
      <div className="card">
        <h3 className="mb-2 text-base font-semibold">📤 导出数据</h3>
        <p className="mb-4 text-sm text-slate-500">下载全部数据用于备份或迁移</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button onClick={() => handleExport('json')} className="btn-primary">
            📋 JSON (完整)
          </button>
          <button onClick={() => handleExport('csv')} className="btn-ghost">
            📊 CSV (Excel 友好)
          </button>
          <button onClick={() => handleExport('md')} className="btn-ghost">
            📝 Markdown 报告
          </button>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          <p>• <strong>JSON</strong>: 完整数据 (candidates/members/interviews/trainings/skills/reviews) - 适合备份和重新导入</p>
          <p>• <strong>CSV</strong>: 每个实体一个段落 - 适合 Excel/Sheets</p>
          <p>• <strong>Markdown</strong>: 人读报告 - 适合分享或文档化</p>
        </div>
      </div>

      {/* Import */}
      <div className="card">
        <h3 className="mb-2 text-base font-semibold">📥 导入数据</h3>
        <p className="mb-4 text-sm text-slate-500">从之前导出的 JSON 文件恢复</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="mb-3 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        <div className="flex gap-2">
          <button onClick={() => handleImport('merge')} disabled={importing} className="btn-primary disabled:opacity-50">
            {importing ? '导入中...' : '🔀 合并导入'}
          </button>
          <button onClick={() => handleImport('replace')} disabled={importing} className="btn-ghost text-rose-600 disabled:opacity-50">
            ⚠ 替换导入 (清空现有)
          </button>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          <p>• <strong>合并</strong>: 保留现有数据，添加新数据 (同名 ID 会被覆盖)</p>
          <p>• <strong>替换</strong>: 清空所有现有数据后导入 (慎用！)</p>
        </div>
      </div>
    </div>
  );
}

// Resume Upload modal - PDF or text paste → AI extract → preview → confirm import

import { useState, useRef } from 'react';

interface ExtractedResume {
  name: string;
  email?: string;
  phone?: string;
  position: string;
  yearsOfExperience?: number;
  skills: string[];
  experience: Array<{ company: string; role: string; duration: string; highlights: string[] }>;
  education: Array<{ school: string; degree: string; major?: string; graduationYear?: number }>;
  summary?: string;
}

interface Props {
  onClose: () => void;
  onImported: () => void;
}

type Stage = 'input' | 'parsing' | 'preview' | 'importing' | 'error';

export function ResumeUploadModal({ onClose, onImported }: Props) {
  const [stage, setStage] = useState<Stage>('input');
  const [text, setText] = useState('');
  const [position, setPosition] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [extracted, setExtracted] = useState<ExtractedResume | null>(null);
  const [rawPreview, setRawPreview] = useState('');
  const [score, setScore] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('仅支持 PDF 文件');
      return;
    }
    setStage('parsing');
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const r = await fetch('/api/resume/parse', { method: 'POST', body: formData });
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
      const json = await r.json();
      setExtracted(json.extracted);
      setRawPreview(json.rawTextPreview ?? '');
      setStage('preview');
    } catch (err) {
      setError((err as Error).message);
      setStage('error');
    }
  };

  const handleTextParse = async () => {
    if (!text.trim()) {
      setError('请粘贴简历文本');
      return;
    }
    setStage('parsing');
    setError(null);
    try {
      const r = await fetch('/api/resume/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
      const json = await r.json();
      setExtracted(json.extracted);
      setRawPreview(json.rawTextPreview ?? '');
      setStage('preview');
    } catch (err) {
      setError((err as Error).message);
      setStage('error');
    }
  };

  const handleScore = async () => {
    if (!extracted || !position.trim()) return;
    try {
      const r = await fetch('/api/resume/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extracted, position, jobDescription }),
      });
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
      setScore(await r.json());
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleImport = async () => {
    if (!extracted) return;
    setStage('importing');
    try {
      const r = await fetch('/api/resume/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extracted, source: 'pdf' }),
      });
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
      onImported();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setStage('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">📄 简历解析</h3>
          <button onClick={onClose} className="btn-ghost">×</button>
        </div>

        {error && <div className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">⚠ {error}</div>}

        <div className="flex-1 space-y-4 overflow-y-auto">
          {stage === 'input' && (
            <>
              <div className="rounded-lg border-2 border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
                <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">📎 上传 PDF 简历</p>
                <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFile} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="btn-primary">
                  选择 PDF 文件
                </button>
              </div>
              <div className="text-center text-xs text-slate-400">— 或 —</div>
              <div>
                <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">📝 直接粘贴简历文本</label>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
                  placeholder="姓名: 张三&#10;邮箱: zhangsan@example.com&#10;..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
                <button onClick={handleTextParse} disabled={!text.trim()} className="btn-primary mt-2">
                  🤖 AI 提取
                </button>
              </div>
            </>
          )}

          {stage === 'parsing' && (
            <div className="py-12 text-center text-slate-500">
              <div className="inline-block animate-spin">⏳</div> AI 提取中 (1-2 秒)...
            </div>
          )}

          {stage === 'preview' && extracted && (
            <>
              <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-900/20">
                <h4 className="mb-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">✨ AI 提取结果</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500">姓名:</span> <strong>{extracted.name}</strong></div>
                  <div><span className="text-slate-500">岗位:</span> <strong>{extracted.position}</strong></div>
                  {extracted.email && <div><span className="text-slate-500">邮箱:</span> {extracted.email}</div>}
                  {extracted.phone && <div><span className="text-slate-500">电话:</span> {extracted.phone}</div>}
                  {extracted.yearsOfExperience && <div><span className="text-slate-500">经验:</span> {extracted.yearsOfExperience} 年</div>}
                </div>
                {extracted.skills.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs text-slate-500">技能 ({extracted.skills.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {extracted.skills.slice(0, 12).map((s) => (
                        <span key={s} className="badge-blue">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {extracted.experience.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs text-slate-500">最近工作经历</p>
                    <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {extracted.experience.slice(0, 3).map((e, i) => (
                        <li key={i}>· <strong>{e.role}</strong> @ {e.company} ({e.duration})</li>
                      ))}
                    </ul>
                  </div>
                )}
                {extracted.summary && (
                  <p className="mt-3 text-xs italic text-slate-600 dark:text-slate-300">📝 {extracted.summary}</p>
                )}
              </div>

              {/* Optional: score against position */}
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <p className="mb-2 text-sm font-semibold">🎯 可选: 岗位匹配评分</p>
                <input value={position} onChange={(e) => setPosition(e.target.value)}
                  placeholder="目标岗位 (如 高级前端工程师)" className="mb-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="JD (可选)" rows={2} className="mb-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <button onClick={handleScore} disabled={!position.trim()} className="btn-ghost text-xs">🤖 评分</button>
                {score && (
                  <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-900/20">
                    <div className="font-semibold">评分: {score.overallScore}/100 ({score.matchLevel})</div>
                    {score.strengths?.length > 0 && <p className="mt-1 text-xs text-emerald-600">优势: {score.strengths.join('; ')}</p>}
                    {score.concerns?.length > 0 && <p className="mt-1 text-xs text-rose-600">顾虑: {score.concerns.join('; ')}</p>}
                  </div>
                )}
              </div>

              {rawPreview && (
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer">查看原始文本 (前 500 字符)</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">{rawPreview}</pre>
                </details>
              )}
            </>
          )}

          {stage === 'importing' && (
            <div className="py-12 text-center text-slate-500">
              <div className="inline-block animate-spin">⏳</div> 创建候选人中...
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button onClick={onClose} className="btn-ghost">取消</button>
          {stage === 'preview' && extracted && (
            <>
              <button onClick={() => { setStage('input'); setExtracted(null); setScore(null); }} className="btn-ghost">↻ 重新解析</button>
              <button onClick={handleImport} className="btn-primary">💾 确认为候选人</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

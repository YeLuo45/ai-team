// Add Candidate modal

import { useState } from 'react';
import { api } from '../lib/api';
import type { Candidate, CandidateSource } from '@ai-team/core';

interface Props {
  onClose: () => void;
  onAdded: (c: Candidate) => void;
}

export function AddCandidateModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState<CandidateSource>('other');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !position.trim()) {
      setError('姓名和岗位必填');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const c = await api.addCandidate({
        name: name.trim(),
        position: position.trim(),
        source,
        ...(email.trim() && { email: email.trim() }),
        ...(tags.trim() && { tags: tags.split(',').map((t) => t.trim()).filter(Boolean) }),
      });
      onAdded(c);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="card w-full max-w-md shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold">添加候选人</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="姓名 *" value={name} onChange={setName} required />
          <Field label="岗位 *" value={position} onChange={setPosition} required />
          <Field label="邮箱" value={email} onChange={setEmail} type="email" />
          <div>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">来源</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as CandidateSource)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="linkedin">LinkedIn</option>
              <option value="referral">内推</option>
              <option value="website">官网</option>
              <option value="recruiter">猎头</option>
              <option value="job_board">招聘网站</option>
              <option value="other">其他</option>
            </select>
          </div>
          <Field label="标签 (逗号分隔)" value={tags} onChange={setTags} placeholder="React,TypeScript" />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">取消</button>
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
              {submitting ? '提交中...' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
      />
    </div>
  );
}

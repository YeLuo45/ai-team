// Add Member modal

import { useState } from 'react';
import { api } from '../lib/api';
import type { Member, MemberLevel } from '@ai-team/core';

interface Props {
  onClose: () => void;
  onAdded: (m: Member) => void;
}

const TEAMS = ['Web Platform', 'Platform', 'Mobile', 'Data', 'DevOps', 'Design', 'PM'];
const LEVELS: MemberLevel[] = ['intern', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];

export function AddMemberModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [team, setTeam] = useState(TEAMS[0]);
  const [level, setLevel] = useState<MemberLevel>('P5');
  const [manager, setManager] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim()) {
      setError('姓名和角色必填');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const m = await api.addMember({
        name: name.trim(),
        role: role.trim(),
        team,
        level,
        ...(manager.trim() && { manager: manager.trim() }),
      });
      onAdded(m);
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
        <h3 className="mb-4 text-lg font-semibold">添加成员</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="姓名 *" value={name} onChange={setName} required />
          <Field label="角色 *" value={role} onChange={setRole} required placeholder="前端工程师 / Tech Lead / PM" />
          <div>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">团队</label>
            <select value={team} onChange={(e) => setTeam(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
              {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">职级</label>
            <select value={level} onChange={(e) => setLevel(e.target.value as MemberLevel)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <Field label="经理" value={manager} onChange={setManager} placeholder="可选" />
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

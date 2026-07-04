// V153: RejectReasonModal — collect a rejection reason from the recruiter
// before applying the "rejected" status. The reason is appended to the
// candidate's notes and returned to the caller via onSubmit.

import { useEffect, useState } from 'react';
import { Card } from '../design-system';

interface Props {
  open: boolean;
  candidateName: string;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
  busy?: boolean;
}

export const REJECT_REASON_MIN = 4;
export const REJECT_REASON_MAX = 500;

const REJECT_REASON_PLACEHOLDERS = [
  '技术深度不够',
  '薪资期望差距较大',
  '沟通能力需加强',
  '经验与岗位不匹配',
  '文化契合度欠佳',
];

export function RejectReasonModal({ open, candidateName, onCancel, onSubmit, busy }: Props) {
  const [reason, setReason] = useState('');

  // Reset the textarea when the modal is closed or reopened
  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  if (!open) return null;

  const trimmed = reason.trim();
  const isValid = trimmed.length >= REJECT_REASON_MIN && trimmed.length <= REJECT_REASON_MAX;
  const charCount = reason.length;
  const isOverLimit = charCount > REJECT_REASON_MAX;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-reason-title"
      data-testid="reject-reason-modal"
    >
      <Card className="w-full max-w-md space-y-4" testId="reject-reason-card">
        <header>
          <h3 id="reject-reason-title" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            记录被拒原因
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            为 <strong>{candidateName}</strong> 填写拒绝原因，便于后续复盘。
          </p>
        </header>

        <div>
          <label htmlFor="reject-reason-textarea" className="text-xs text-slate-500">
            原因 ({REJECT_REASON_MIN}-{REJECT_REASON_MAX} 字)
          </label>
          <textarea
            id="reject-reason-textarea"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例如：候选人技术深度不够，缺乏系统设计经验..."
            disabled={busy}
            data-testid="reject-reason-textarea"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 disabled:opacity-50"
          />
          <div className="mt-1 flex items-center justify-between text-xs">
            <span
              className={isOverLimit ? 'text-rose-600' : 'text-slate-400'}
              data-testid="reject-reason-counter"
            >
              {charCount} / {REJECT_REASON_MAX}
            </span>
            {!isValid && charCount > 0 && (
              <span className="text-rose-600" data-testid="reject-reason-error">
                原因至少 {REJECT_REASON_MIN} 字
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REJECT_REASON_PLACEHOLDERS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={busy}
                onClick={() => setReason(p)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300"
                data-testid={`reject-reason-suggestion-${p}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
            data-testid="reject-reason-cancel"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => isValid && onSubmit(trimmed)}
            disabled={busy || !isValid}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="reject-reason-submit"
          >
            {busy ? '提交中...' : '标记为已拒绝'}
          </button>
        </div>
      </Card>
    </div>
  );
}
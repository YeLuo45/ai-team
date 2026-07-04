// V153: RejectReasonModal — collect a rejection reason + PipelineProgress "记录被拒原因" button
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  REJECT_REASON_MAX,
  REJECT_REASON_MIN,
  RejectReasonModal,
  PipelineProgress,
} from '../src/components/interview/index.js';

beforeEach(() => vi.restoreAllMocks());
afterEach(() => cleanup());

// ---------------- RejectReasonModal ----------------

describe('RejectReasonModal UI', () => {
  it('does not render anything when open is false', () => {
    const { container } = render(
      <RejectReasonModal open={false} candidateName="李婷" onCancel={() => {}} onSubmit={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the dialog with the candidate name + counter + suggestion chips when open', () => {
    render(
      <RejectReasonModal open candidateName="李婷" onCancel={() => {}} onSubmit={() => {}} />,
    );
    expect(screen.getByTestId('reject-reason-modal')).toBeTruthy();
    expect(screen.getByText(/李婷/)).toBeTruthy();
    expect(screen.getByTestId('reject-reason-textarea')).toBeTruthy();
    expect(screen.getByTestId('reject-reason-counter').textContent).toContain('0 / ' + REJECT_REASON_MAX);
    // 5 suggestion chips
    const chips = screen.getAllByTestId(/^reject-reason-suggestion-/);
    expect(chips).toHaveLength(5);
  });

  it('disables the submit button when reason is too short', () => {
    render(
      <RejectReasonModal open candidateName="李婷" onCancel={() => {}} onSubmit={() => {}} />,
    );
    const submit = screen.getByTestId('reject-reason-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('shows an error message when the user types fewer than the minimum characters', () => {
    render(
      <RejectReasonModal open candidateName="李婷" onCancel={() => {}} onSubmit={() => {}} />,
    );
    const textarea = screen.getByTestId('reject-reason-textarea');
    fireEvent.change(textarea, { target: { value: 'abc' } });
    expect(screen.getByTestId('reject-reason-error').textContent).toContain(REJECT_REASON_MIN);
  });

  it('enables submit + invokes onSubmit with the trimmed reason when valid', () => {
    const onSubmit = vi.fn();
    render(
      <RejectReasonModal open candidateName="李婷" onCancel={() => {}} onSubmit={onSubmit} />,
    );
    const textarea = screen.getByTestId('reject-reason-textarea');
    fireEvent.change(textarea, { target: { value: '  技术深度不够  ' } });
    const submit = screen.getByTestId('reject-reason-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith('技术深度不够');
  });

  it('disables submit when the reason exceeds REJECT_REASON_MAX', () => {
    render(
      <RejectReasonModal open candidateName="李婷" onCancel={() => {}} onSubmit={() => {}} />,
    );
    const textarea = screen.getByTestId('reject-reason-textarea');
    fireEvent.change(textarea, { target: { value: 'a'.repeat(REJECT_REASON_MAX + 1) } });
    const submit = screen.getByTestId('reject-reason-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('invokes onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <RejectReasonModal open candidateName="李婷" onCancel={onCancel} onSubmit={() => {}} />,
    );
    fireEvent.click(screen.getByTestId('reject-reason-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('clicking a suggestion chip fills the textarea', () => {
    render(
      <RejectReasonModal open candidateName="李婷" onCancel={() => {}} onSubmit={() => {}} />,
    );
    fireEvent.click(screen.getByTestId('reject-reason-suggestion-技术深度不够'));
    const textarea = screen.getByTestId('reject-reason-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('技术深度不够');
  });

  it('disables both buttons when busy=true', () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    render(
      <RejectReasonModal open busy candidateName="李婷" onCancel={onCancel} onSubmit={onSubmit} />,
    );
    const cancel = screen.getByTestId('reject-reason-cancel') as HTMLButtonElement;
    const submit = screen.getByTestId('reject-reason-submit') as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    expect(submit.disabled).toBe(true);
  });

  it('resets the textarea after the modal is closed and reopened', () => {
    const { rerender } = render(
      <RejectReasonModal open candidateName="李婷" onCancel={() => {}} onSubmit={() => {}} />,
    );
    const textarea = screen.getByTestId('reject-reason-textarea');
    fireEvent.change(textarea, { target: { value: 'old reason' } });

    rerender(
      <RejectReasonModal open={false} candidateName="李婷" onCancel={() => {}} onSubmit={() => {}} />,
    );
    rerender(
      <RejectReasonModal open candidateName="李婷" onCancel={() => {}} onSubmit={() => {}} />,
    );
    expect((screen.getByTestId('reject-reason-textarea') as HTMLTextAreaElement).value).toBe('');
  });
});

// ---------------- PipelineProgress: "记录被拒原因" ----------------

describe('PipelineProgress — "记录被拒原因" button (V153)', () => {
  it('does not render the button when status is not "rejected"', () => {
    render(<PipelineProgress status="interviewing" onRecordReject={() => {}} />);
    expect(screen.queryByTestId('pipeline-record-reject')).toBeNull();
  });

  it('renders the button when status is "rejected" + onRecordReject is provided', () => {
    render(<PipelineProgress status="rejected" onRecordReject={() => {}} />);
    expect(screen.getByTestId('pipeline-record-reject')).toBeTruthy();
  });

  it('does NOT render the button when status is "rejected" but onRecordReject is missing', () => {
    render(<PipelineProgress status="rejected" />);
    expect(screen.queryByTestId('pipeline-record-reject')).toBeNull();
  });

  it('invokes onRecordReject when the button is clicked', () => {
    const onRecordReject = vi.fn();
    render(<PipelineProgress status="rejected" onRecordReject={onRecordReject} />);
    fireEvent.click(screen.getByTestId('pipeline-record-reject'));
    expect(onRecordReject).toHaveBeenCalledTimes(1);
  });
});
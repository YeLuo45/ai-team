// V157: ResumeCard — expanded state persisted to localStorage per-candidate
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  readExpandedFromStorage,
  ResumeCard,
  writeExpandedToStorage,
} from '../src/components/interview/index.js';

const SAMPLE_RESUME = [
  '## 基本信息',
  'A · 5 年前端',
  '',
  '## 工作经历',
  '- 字节 · 高级前端',
  '- 美团 · 前端工程师',
].join('\n');

beforeEach(() => {
  // Reset between tests
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------- helpers ----------------

describe('readExpandedFromStorage / writeExpandedToStorage', () => {
  it('returns false when nothing has been written', () => {
    expect(readExpandedFromStorage('ct_xyz')).toBe(false);
  });

  it('persists the boolean and reads it back', () => {
    writeExpandedToStorage('ct_a', true);
    expect(readExpandedFromStorage('ct_a')).toBe(true);
    writeExpandedToStorage('ct_a', false);
    expect(readExpandedFromStorage('ct_a')).toBe(false);
  });

  it('isolates state across different candidate ids', () => {
    writeExpandedToStorage('ct_a', true);
    writeExpandedToStorage('ct_b', false);
    expect(readExpandedFromStorage('ct_a')).toBe(true);
    expect(readExpandedFromStorage('ct_b')).toBe(false);
    expect(readExpandedFromStorage('ct_c')).toBe(false);
  });

  it('returns false when localStorage throws (e.g. quota / private mode)', () => {
    const original = window.localStorage.getItem;
    window.localStorage.getItem = vi.fn(() => { throw new Error('SecurityError'); });
    expect(readExpandedFromStorage('ct_a')).toBe(false);
    window.localStorage.getItem = original;
  });

  it('swallows errors when writing to localStorage', () => {
    const original = window.localStorage.setItem;
    window.localStorage.setItem = vi.fn(() => { throw new Error('QuotaExceeded'); });
    expect(() => writeExpandedToStorage('ct_a', true)).not.toThrow();
    window.localStorage.setItem = original;
  });
});

// ---------------- UI: persistence behavior ----------------

describe('ResumeCard UI — persisted expand/collapse', () => {
  it('starts collapsed by default (no localStorage entry)', () => {
    render(
      <ResumeCard
        candidateId="ct_x"
        candidateName="X"
        candidatePosition="P"
        candidateTags={[]}
        candidateSkills={[]}
        resume={SAMPLE_RESUME}
      />,
    );
    expect(screen.queryByTestId('resume-full')).toBeNull();
  });

  it('starts expanded when localStorage already has the entry', () => {
    writeExpandedToStorage('ct_persisted', true);
    render(
      <ResumeCard
        candidateId="ct_persisted"
        candidateName="P"
        candidatePosition="P"
        candidateTags={[]}
        candidateSkills={[]}
        resume={SAMPLE_RESUME}
      />,
    );
    expect(screen.getByTestId('resume-full')).toBeTruthy();
  });

  it('writes the new state to localStorage when the user toggles', () => {
    render(
      <ResumeCard
        candidateId="ct_toggle"
        candidateName="T"
        candidatePosition="P"
        candidateTags={[]}
        candidateSkills={[]}
        resume={SAMPLE_RESUME}
      />,
    );
    expect(readExpandedFromStorage('ct_toggle')).toBe(false);
    fireEvent.click(screen.getByTestId('resume-toggle'));
    expect(readExpandedFromStorage('ct_toggle')).toBe(true);
    fireEvent.click(screen.getByTestId('resume-toggle'));
    expect(readExpandedFromStorage('ct_toggle')).toBe(false);
  });

  it('isolates persisted state per candidate id (switching candidates does not flip another card)', () => {
    writeExpandedToStorage('ct_alpha', true);
    writeExpandedToStorage('ct_beta', false);

    render(
      <div>
        <ResumeCard
          candidateId="ct_alpha"
          candidateName="A"
          candidatePosition="P"
          candidateTags={[]}
          candidateSkills={[]}
          resume={SAMPLE_RESUME}
        />
        <ResumeCard
          candidateId="ct_beta"
          candidateName="B"
          candidatePosition="P"
          candidateTags={[]}
          candidateSkills={[]}
          resume={SAMPLE_RESUME}
        />
      </div>,
    );

    // ct_alpha starts expanded, ct_beta starts collapsed
    const expanded = screen.getAllByTestId('resume-full');
    expect(expanded).toHaveLength(1);
  });
});
// V32: Agent Review Console page tests
// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
// Importing act from RTL pins React to dev mode + registers act globally
import { act, render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { AgentReviewConsole } from '../src/pages/AgentReviewConsole.js';

const originalFetch = globalThis.fetch;

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
    statusText: ok ? 'OK' : 'Error',
  });
}

describe('V32 Agent Review Console', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      if (url.endsWith('/api/compliance/legal/classify')) {
        const level = body.text?.includes('劳动仲裁') ? 'high' : 'low';
        return jsonResponse({ assessment: { level }, summary: 'x', auditId: 'a1' });
      }
      if (url.endsWith('/api/compliance/tech-policy/classify')) {
        return jsonResponse({ assessment: { severity: 'critical' }, matches: [{ ruleId: 'secret-leak' }], summary: 'x', auditId: 'a2' });
      }
      if (url.endsWith('/api/compliance/media/check')) {
        return jsonResponse({ check: { assessment: { level: 'critical' }, requiredActions: [{ kind: 'block_publish' }] }, summary: 'x', auditId: 'a3' });
      }
      if (url.endsWith('/api/compliance/sibling-org-conflict/detect')) {
        return jsonResponse({ conflict: { severity: 'high' }, matches: [{ patternId: 'doc-tampering' }], summary: 'x', auditId: 'a4' });
      }
      return jsonResponse({}, false, 404);
    }) as any;
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renders three tabs and defaults to Legal', () => {
    render(<AgentReviewConsole />);
    expect(screen.getByTestId('agent-review-console')).toBeTruthy();
    expect(screen.getByTestId('agent-tab-legal')).toBeTruthy();
    expect(screen.getByTestId('agent-tab-tech-policy')).toBeTruthy();
    expect(screen.getByTestId('agent-tab-media-compliance')).toBeTruthy();
    expect(screen.getByTestId('agent-panel-legal')).toBeTruthy();
  });

  it('calls /api/compliance/legal/classify and shows level', async () => {
    render(<AgentReviewConsole />);
    fireEvent.input(screen.getByTestId('legal-text'), { target: { value: '员工投诉歧视并准备劳动仲裁' } });
    fireEvent.click(screen.getByTestId('legal-submit'));
    await waitFor(() => screen.getByTestId('legal-result'));
    expect(screen.getByTestId('legal-result').textContent).toContain('high');
  });

  it('switches to Tech Policy tab and calls the matching endpoint', async () => {
    render(<AgentReviewConsole initialAgent="tech-policy" />);
    fireEvent.input(screen.getByTestId('tech-text'), { target: { value: '生产密钥硬编码并已提交到公开仓库' } });
    fireEvent.click(screen.getByTestId('tech-submit'));
    await waitFor(() => screen.getByTestId('tech-result'));
    expect(screen.getByTestId('tech-result').textContent).toContain('critical');
  });

  it('switches to Media Compliance tab and posts to /api/compliance/media/check', async () => {
    render(<AgentReviewConsole initialAgent="media-compliance" />);
    fireEvent.input(screen.getByTestId('media-title'), { target: { value: '品牌代言视频' } });
    fireEvent.change(screen.getByTestId('media-channel'), { target: { value: 'douyin' } });
    fireEvent.input(screen.getByTestId('media-excerpt'), { target: { value: '代言人未获授权即定剪' } });
    fireEvent.click(screen.getByTestId('media-submit'));
    await waitFor(() => screen.getByTestId('media-result'));
    expect(screen.getByTestId('media-result').textContent).toContain('critical');
  });

  it('shows error UI when fetch fails', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('boom'); }) as any;
    render(<AgentReviewConsole />);
    fireEvent.input(screen.getByTestId('legal-text'), { target: { value: 'something' } });
    fireEvent.click(screen.getByTestId('legal-submit'));
    await waitFor(() => screen.getByTestId('legal-error'));
    expect(screen.getByTestId('legal-error').textContent).toContain('boom');
  });

  it('clears stale result when switching tabs', async () => {
    render(<AgentReviewConsole />);
    fireEvent.input(screen.getByTestId('legal-text'), { target: { value: 'a' } });
    fireEvent.click(screen.getByTestId('legal-submit'));
    await waitFor(() => screen.getByTestId('legal-result'));
    fireEvent.click(screen.getByTestId('agent-tab-tech-policy'));
    expect(screen.queryByTestId('legal-result')).toBeNull();
  });

  it('disables submit when textarea is empty', () => {
    render(<AgentReviewConsole />);
    const btn = screen.getByTestId('legal-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('renders Sibling Org tab and calls /api/compliance/sibling-org-conflict/detect', async () => {
    render(<AgentReviewConsole initialAgent="sibling-org-conflict" />);
    expect(screen.getByTestId('agent-tab-sibling-org-conflict')).toBeTruthy();
    expect(screen.getByTestId('agent-panel-sibling')).toBeTruthy();
    fireEvent.input(screen.getByTestId('sibling-text'), { target: { value: 'A 团队负责人要求删除 B 团队共享文档' } });
    fireEvent.click(screen.getByTestId('sibling-submit'));
    await waitFor(() => screen.getByTestId('sibling-result'));
    expect(screen.getByTestId('sibling-result').textContent).toContain('high');
  });
});

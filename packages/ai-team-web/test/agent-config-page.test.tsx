// V34: Agent Config page (web) tests
// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { AgentConfig } from '../src/pages/AgentConfig.js';

const originalFetch = globalThis.fetch;

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
    statusText: ok ? 'OK' : 'Error',
  });
}

describe('V34 AgentConfig page', () => {
  let fetchCalls: Array<{ url: string; method: string; body?: unknown }>;
  let getHandler: (url: string) => Response;
  let putHandler: (url: string, body: unknown) => Response;
  let deleteHandler: (url: string) => Response;
  let resetHandler: (url: string) => Response;

  beforeEach(() => {
    fetchCalls = [];
    getHandler = (url) => url.endsWith('/api/agent-config/interview')
      ? jsonResponse({ config: { agent: 'interview', soul: 'existing-soul', user: '', memory: '', llm: { model: 'gpt-5.5' }, updatedAt: '2026-06-21T00:00:00Z' } })
      : jsonResponse({}, false, 404);
    putHandler = (_url, body) => jsonResponse({ config: { agent: 'interview', soul: body.soul, user: '', memory: '', llm: body.llm ?? {}, updatedAt: '2026-06-21T01:00:00Z' } });
    deleteHandler = (_url) => jsonResponse({ deleted: true });
    resetHandler = (url) => jsonResponse({ config: { agent: 'interview', soul: 'existing-soul', user: '', memory: '', llm: {}, updatedAt: '2026-06-21T02:00:00Z' } });

    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      fetchCalls.push({ url, method, body });
      if (method === 'GET' && url.endsWith('/api/agent-config')) {
        return jsonResponse({ items: [
          { agent: 'interview', soul: 's', user: '', memory: '', llm: { model: 'gpt-5.5' }, updatedAt: '2026-06-21T00:00:00Z' },
        ] });
      }
      if (method === 'GET') return getHandler(url);
      if (method === 'PUT') return putHandler(url, body);
      if (method === 'DELETE') return deleteHandler(url);
      if (method === 'POST') return resetHandler(url);
      return jsonResponse({}, false, 405);
    }) as any;
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('lists agents and marks configured ones', async () => {
    render(<AgentConfig />);
    await waitFor(() => screen.getByTestId('agent-config-list'));
    expect(screen.getByText('已配置')).toBeTruthy();
    expect(screen.getAllByText('默认').length).toBeGreaterThan(0);
  });

  it('opens editor with existing config when clicking configured kind', async () => {
    render(<AgentConfig />);
    await waitFor(() => screen.getByTestId('agent-config-list'));
    const configuredBtn = screen.getByText('🎤 面试官');
    await act(async () => { fireEvent.click(configuredBtn); });
    await waitFor(() => screen.getByTestId('agent-config-editor-interview'));
    const soulArea = screen.getByTestId('agent-config-soul-interview') as HTMLTextAreaElement;
    expect(soulArea.value).toBe('existing-soul');
  });

  it('opens editor with empty defaults when clicking unconfigured kind', async () => {
    render(<AgentConfig />);
    await waitFor(() => screen.getByTestId('agent-config-list'));
    await act(async () => { fireEvent.click(screen.getByText('🧑‍🏫 培训师')); });
    await waitFor(() => screen.getByTestId('agent-config-editor-training'));
    expect((screen.getByTestId('agent-config-soul-training') as HTMLTextAreaElement).value).toBe('');
  });

  it('saves edited values via PUT', async () => {
    render(<AgentConfig />);
    await waitFor(() => screen.getByTestId('agent-config-list'));
    await act(async () => { fireEvent.click(screen.getByText('🎤 面试官')); });
    await waitFor(() => screen.getByTestId('agent-config-soul-interview'));
    fireEvent.change(screen.getByTestId('agent-config-soul-interview'), { target: { value: 'new-soul' } });
    fireEvent.change(screen.getByTestId('agent-config-model-interview'), { target: { value: 'gpt-5.5' } });
    await act(async () => { fireEvent.click(screen.getByTestId('agent-config-save-interview')); });
    await waitFor(() => expect(fetchCalls.some((c) => c.method === 'PUT' && c.url.endsWith('/api/agent-config/interview'))).toBe(true));
    const putCall = fetchCalls.find((c) => c.method === 'PUT');
    expect(putCall?.body).toMatchObject({ soul: 'new-soul' });
    expect((putCall?.body as { llm: { model?: string } }).llm.model).toBe('gpt-5.5');
  });

  it('reset-llm button calls POST reset-llm', async () => {
    render(<AgentConfig />);
    await waitFor(() => screen.getByTestId('agent-config-list'));
    await act(async () => { fireEvent.click(screen.getByText('🎤 面试官')); });
    await waitFor(() => screen.getByTestId('agent-config-resetllm-interview'));
    await act(async () => { fireEvent.click(screen.getByTestId('agent-config-resetllm-interview')); });
    await waitFor(() => expect(fetchCalls.some((c) => c.method === 'POST' && c.url.endsWith('/api/agent-config/interview/reset-llm'))).toBe(true));
  });

  it('delete button calls DELETE', async () => {
    render(<AgentConfig />);
    await waitFor(() => screen.getByTestId('agent-config-list'));
    await act(async () => { fireEvent.click(screen.getByText('🎤 面试官')); });
    await waitFor(() => screen.getByTestId('agent-config-delete-interview'));
    await act(async () => { fireEvent.click(screen.getByTestId('agent-config-delete-interview')); });
    await waitFor(() => expect(fetchCalls.some((c) => c.method === 'DELETE' && c.url.endsWith('/api/agent-config/interview'))).toBe(true));
  });

  it('shows API error when list fails', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ error: 'fail' }, false, 500)) as any;
    render(<AgentConfig />);
    await waitFor(() => screen.getByText(/⚠/));
    expect(screen.getByText(/fail/i)).toBeTruthy();
  });

  it('shows API error when save fails', async () => {
    render(<AgentConfig />);
    await waitFor(() => screen.getByTestId('agent-config-list'));
    await act(async () => { fireEvent.click(screen.getByText('🎤 面试官')); });
    await waitFor(() => screen.getByTestId('agent-config-save-interview'));
    // now make PUT fail
    putHandler = () => jsonResponse({ error: 'save-fail' }, false, 500);
    await act(async () => { fireEvent.click(screen.getByTestId('agent-config-save-interview')); });
    await waitFor(() => screen.getByText(/save-fail/));
  });
});

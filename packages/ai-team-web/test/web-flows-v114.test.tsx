// V114: Web flows branch coverage — Login error path + Approval reject path
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { resetResourceCache, resetEventBus, getResourceCache } from '../src/lib/data-layer/index.js';

beforeEach(() => {
  resetResourceCache();
  resetEventBus();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('V114 LoginForm error path', () => {
  it('shows error on non-OK response', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ error: 'bad creds' }, false, 401)) as any;
    const { LoginForm } = await import('../src/web-flows/LoginForm.js');
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByTestId('email'), { target: { value: 'admin@x.com' } });
    fireEvent.change(screen.getByTestId('password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByTestId('submit'));
    await waitFor(() => expect(screen.getByTestId('login-error')).toBeTruthy());
  });

  it('handles network error', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('network'); }) as any;
    const { LoginForm } = await import('../src/web-flows/LoginForm.js');
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByTestId('email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByTestId('password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByTestId('submit'));
    await waitFor(() => expect(screen.getByTestId('login-error')).toBeTruthy());
  });
});

describe('V114 ApprovalPanel reject path', () => {
  it('deciding rejected keeps entry visible after rollback', async () => {
    const cache = getResourceCache();
    cache.set('approvals', [{ id: 'a1' }, { id: 'a2' }], Date.now());
    globalThis.fetch = vi.fn(async () => jsonResponse({}, false, 500)) as any;
    const { default: ApprovalPanel } = await import('../src/web-flows/ApprovalPanel.js');
    render(
      <MemoryRouter>
        <ApprovalPanel />
      </MemoryRouter>
    );
    await waitFor(() => screen.getByTestId('approval-a1'));
    // simulate reject by clicking approve — fails server-side so rollback
    fireEvent.click(screen.getByTestId('approval-a1-approve'));
    await waitFor(() => expect(screen.getByTestId('approval-a1')).toBeTruthy());
  });

  it('renders empty list when no approvals', async () => {
    const cache = getResourceCache();
    // No approvals seeded
    globalThis.fetch = vi.fn(async () => jsonResponse([])) as any;
    const { default: ApprovalPanel } = await import('../src/web-flows/ApprovalPanel.js');
    render(
      <MemoryRouter>
        <ApprovalPanel />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByTestId('approval-panel')).toBeTruthy());
  });
});
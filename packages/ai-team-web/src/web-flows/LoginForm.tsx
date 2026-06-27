// V112: Web flow components for happy-dom e2e flow tests
// These wrap useResource + useResourceMutation to exercise full flows

import { useState } from 'react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (data?.token) {
        localStorage.setItem('ai-team-token', data.token);
        localStorage.setItem('ai-team-user', JSON.stringify(data.user));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'login failed');
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <input
        data-testid="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        data-testid="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button data-testid="submit" type="submit">登录</button>
      {error && <div data-testid="login-error">{error}</div>}
    </form>
  );
}
// V208: vitest setup for ai-team-web.
//
// The happy-dom fetch implementation is wired to `node:net` and will
// try to reach `http://localhost:3000/data/team.json` (the dev server)
// when App mounts `useTeamData`. Without a dev server running, the
// fetch hangs past the 5s default test timeout and tests like
// `App renders /orchestration route via ConsoleShell`
// (`a11y-app-hooks-v127.test.tsx`) fail.
//
// Stubbing `globalThis.fetch` with a tiny in-memory JSON responder
// makes those tests pass without booting a server. The stub responds
// to:
//   - GET /data/team.json → minimal TeamData shape
//   - GET /api/health → `{ "status": "ok" }`
// All other paths return 404.
//
// The stub lives in the test process only — production builds still
// hit the real `fetch`. Callers that need a different mock can
// override `globalThis.fetch` in their own `beforeEach`.

type JsonValue = unknown;

const STUB_TEAM_DATA: JsonValue = {
  generatedAt: '2026-07-12T00:00:00.000Z',
  candidates: [],
  members: [],
  interviews: [],
  skills: [],
  trainings: [],
  reviews: [],
};

function makeStubFetch(): typeof fetch {
  return async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : (input as Request).url;
    if (url.endsWith('/data/team.json')) {
      return new Response(JSON.stringify(STUB_TEAM_DATA), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.endsWith('/api/health')) {
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('Not Found', { status: 404 });
  };
}

// Install once per test file (vitest re-imports setup per file in
// non-isolate mode). Guard with a flag so `npm test` re-runs don't
// stack multiple stubs.
const g = globalThis as { __AI_TEAM_FETCH_STUB_INSTALLED__?: boolean };
if (!g.__AI_TEAM_FETCH_STUB_INSTALLED__) {
  globalThis.fetch = makeStubFetch() as typeof fetch;
  g.__AI_TEAM_FETCH_STUB_INSTALLED__ = true;
}
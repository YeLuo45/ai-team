import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx', 'packages/*/src/**/*.test.ts', 'packages/*/src/**/*.test.tsx', 'test/**/*.test.mjs', 'test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.{idea,git,cache,output}/**'],
    environmentMatchGlobs: [
      ['packages/ai-team-web/**', 'happy-dom'],
    ],
    setupFiles: [
      'packages/ai-team-web/vitest.setup.ts',
    ],
    // V208: App-integration tests (V120, V127) render the full
    // App + SSE bridges + onboarding tour. They reliably take 3-4s
    // in isolation but the parallel happy-dom pool adds overhead and
    // pushes them past the 5s default. Bump to 30s so `npm test`
    // doesn't time out spuriously.
    testTimeout: 30_000,
    server: {
      deps: {
        // For Web tests using happy-dom, exclude the parts of @ai-team/core
        // that depend on node: (json-store, etc.) by using ssr external
        external: ['@ai-team/core'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/types.ts',
        '**/src/types/**',
        '**/*.test.ts',
        '**/types.d.ts',
        '**/mock.ts',
        '**/ai-team-web/src/App.tsx',
        '**/ai-team-web/src/main.tsx',
        '**/ai-team-web/src/pages/**',
        '**/ai-team-web/src/components/**',
        '**/ai-team-web/src/hooks/**',
        '**/ai-team-web/src/lib/hooks.ts',
        '**/ai-team-web/src/lib/api.ts',
        '**/ai-team-web/src/lib/data.ts',
        '**/ai-team-tui/src/app.tsx',
        '**/ai-team-tui/src/index.ts',
        '**/ai-team-tui/src/run.tsx',
        '**/ai-team-tui/src/api.ts',
        '**/ai-team-cli/src/index.ts',
        '**/ai-team-cli/src/commands/**',
        '**/ai-team-ai/src/prompts/**',
        '**/ai-team-ai/src/index.ts',
        '**/ai-team-agent/src/index.ts',
        '**/ai-team-agent/src/*-agent.ts',
        '**/ai-team-server/src/index.ts',
        '**/ai-team-server/src/plugins.ts',
        '**/ai-team-web/src/i18n/**',
        '**/ai-team-core/src/i18n.ts',
        '**/ai-team-core/src/notify.ts',
        '**/ai-team-core/src/pwa.ts',
        '**/ai-team-agent/src/search.ts',
        '**/ai-team-ai/src/providers/**',
        '**/ai-team-cli/src/utils.ts',
        '**/ai-team-core/src/utils/date.ts',
        '**/ai-team-core/src/llm-config.ts',
        '**/ai-team-core/src/auth.ts',
        '**/ai-team-server/src/routes/auth.ts',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
});
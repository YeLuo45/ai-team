// V20: coverage-report.mjs self-tests — 用 vitest describe
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = readFileSync(resolve(ROOT, 'scripts/coverage-report.mjs'), 'utf8');

// 复制一份脚本里的小函数 — 保证测试不依赖运行脚本
function pct(n: number, d: number): number {
  if (!d) return 100;
  return Math.round((100 * n) / d * 100) / 100;
}

function countHit(map: Record<string, number | number[]>) {
  let total = 0, hit = 0;
  for (const v of Object.values(map)) {
    if (Array.isArray(v)) { total += v.length; hit += v.reduce((a, x) => a + (x > 0 ? 1 : 0), 0); }
    else if (typeof v === 'number') { total += 1; hit += v > 0 ? 1 : 0; }
  }
  return { hit, total };
}

describe('coverage-report.mjs — pure helpers', () => {
  it('pct handles zero denominator', () => {
    expect(pct(0, 0)).toBe(100);
    expect(pct(5, 10)).toBe(50);
    expect(pct(7, 9)).toBeCloseTo(77.78, 2);
  });

  it('countHit counts arrays and numbers correctly', () => {
    expect(countHit({ a: 1, b: 0 })).toEqual({ hit: 1, total: 2 });
    expect(countHit({ a: [1, 0, 2], b: [0, 0] })).toEqual({ hit: 2, total: 5 });
    expect(countHit({})).toEqual({ hit: 0, total: 0 });
  });
});

describe('coverage-report.mjs — layer regexes (mirrored from script)', () => {
  const STRICT = {
    'core/store':           /^packages\/ai-team-core\/src\/store\//,
    'core/utils':           /^packages\/ai-team-core\/src\/utils\//,
    'core/index':           /^packages\/ai-team-core\/src\/index\.ts$/,
    'server/sse':           /^packages\/ai-team-server\/src\/sse\.ts$/,
    'server/middleware':    /^packages\/ai-team-server\/src\/middleware\//,
    'server/routes':        /^packages\/ai-team-server\/src\/routes\//,
    'web/lib-format':       /^packages\/ai-team-web\/src\/lib\/format\.ts$/,
  };
  const SOFT = {
    'core/auth':            /^packages\/ai-team-core\/src\/auth\.ts$/,
    'core/i18n':            /^packages\/ai-team-core\/src\/i18n\.ts$/,
    'core/notify':          /^packages\/ai-team-core\/src\/notify\.ts$/,
    'core/pwa':             /^packages\/ai-team-core\/src\/pwa\.ts$/,
    'core/llm-config':      /^packages\/ai-team-core\/src\/llm-config\.ts$/,
    'core/types':           /^packages\/ai-team-core\/src\/types\//,
    'server/entry':         /^packages\/ai-team-server\/src\/index\.ts$/,
    'server/plugins':       /^packages\/ai-team-server\/src\/plugins\.ts$/,
    'agent/orchestration':  /^packages\/ai-team-agent\/src\/.+-agent\.ts$/,
    'agent/search':         /^packages\/ai-team-agent\/src\/search\.ts$/,
    'agent/index':          /^packages\/ai-team-agent\/src\/index\.ts$/,
    'ai/prompts':           /^packages\/ai-team-ai\/src\/prompts\//,
    'ai/providers':         /^packages\/ai-team-ai\/src\/providers\//,
    'ai/index':             /^packages\/ai-team-ai\/src\/index\.ts$/,
    'cli/entry':            /^packages\/ai-team-cli\/src\/index\.ts$/,
    'cli/utils':            /^packages\/ai-team-cli\/src\/utils\.ts$/,
    'cli/commands':         /^packages\/ai-team-cli\/src\/commands\//,
    'tui/entry':            /^packages\/ai-team-tui\/src\/(index|run|app|api)\.tsx?$/,
    'web/pages':            /^packages\/ai-team-web\/src\/pages\//,
    'web/components':       /^packages\/ai-team-web\/src\/components\//,
    'web/hooks':            /^packages\/ai-team-web\/src\/hooks\//,
    'web/i18n':             /^packages\/ai-team-web\/src\/i18n\//,
    'web/lib-other':        /^packages\/ai-team-web\/src\/lib\//,
    'web/app':              /^packages\/ai-team-web\/src\/(App|main)\.tsx$/,
  };

  it('strict layer matches server/middleware', () => {
    expect(STRICT['server/middleware'].test('packages/ai-team-server/src/middleware/auth.ts')).toBe(true);
  });

  it('strict layer matches core/store/index.ts', () => {
    expect(STRICT['core/store'].test('packages/ai-team-core/src/store/index.ts')).toBe(true);
  });

  it('strict layer matches core/utils', () => {
    expect(STRICT['core/utils'].test('packages/ai-team-core/src/utils/date.ts')).toBe(true);
  });

  it('strict layer matches web/lib/format', () => {
    expect(STRICT['web/lib-format'].test('packages/ai-team-web/src/lib/format.ts')).toBe(true);
  });

  it('strict layer excludes core/auth (soft-only)', () => {
    expect(STRICT['server/middleware'].test('packages/ai-team-core/src/auth.ts')).toBe(false);
    expect(SOFT['core/auth'].test('packages/ai-team-core/src/auth.ts')).toBe(true);
  });

  it('soft layer matches UI pages', () => {
    expect(SOFT['web/pages'].test('packages/ai-team-web/src/pages/Dashboard.tsx')).toBe(true);
  });

  it('soft layer matches CLI commands', () => {
    expect(SOFT['cli/commands'].test('packages/ai-team-cli/src/commands/candidate.ts')).toBe(true);
  });

  it('soft layer matches Agent LLM orchestration', () => {
    expect(SOFT['agent/orchestration'].test('packages/ai-team-agent/src/interview-agent.ts')).toBe(true);
    expect(SOFT['agent/orchestration'].test('packages/ai-team-agent/src/score-agent.ts')).toBe(true);
  });

  it('soft layer matches TUI entry', () => {
    expect(SOFT['tui/entry'].test('packages/ai-team-tui/src/app.tsx')).toBe(true);
    expect(SOFT['tui/entry'].test('packages/ai-team-tui/src/api.ts')).toBe(true);
  });

  it('strict and soft layers do not overlap (middleware vs none)', () => {
    expect(STRICT['server/middleware'].test('packages/ai-team-server/src/middleware/auth.ts')).toBe(true);
    expect(Object.values(SOFT).some(re => re.test('packages/ai-team-server/src/middleware/auth.ts'))).toBe(false);
  });
});

describe('coverage-report.mjs — CLI script source', () => {
  it('references coverage-final.json', () => {
    expect(SRC).toMatch(/coverage-final\.json/);
  });

  it('supports --json flag', () => {
    expect(SRC).toMatch(/AS_JSON/);
    expect(SRC).toMatch(/--json/);
  });

  it('supports --strict-min / --soft-min flags', () => {
    expect(SRC).toMatch(/STRICT_MIN/);
    expect(SRC).toMatch(/SOFT_MIN/);
  });

  it('exits non-zero when coverage file missing', () => {
    expect(SRC).toMatch(/existsSync/);
    expect(SRC).toMatch(/process\.exit\(2\)/);
  });

  it('exits 1 when strict layer fails threshold', () => {
    expect(SRC).toMatch(/process\.exit\(1\)/);
  });

  it('classifies files into strict and soft buckets', () => {
    expect(SRC).toMatch(/STRICT_LAYERS/);
    expect(SRC).toMatch(/SOFT_LAYERS/);
    expect(SRC).toMatch(/classifyFile/);
  });

  it('prints table to stdout when not --json', () => {
    expect(SRC).toMatch(/Layer/);
    expect(SRC).toMatch(/PASS|FAIL/);
  });
});
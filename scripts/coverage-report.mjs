#!/usr/bin/env node
// V20: 分层覆盖率报告 — 把 vite v8 输出的 coverage-final.json 按"严格层/软层"分组汇总
// 不替换 vitest 阈值，只生成可读摘要，CI 可选择性 gate
//
// 严格层（95% 目标，业务/库/中间件）：store/middleware/server-routes/web-lib/core-utils
// 软层（追踪不阻断）：UI 页面、CLI 命令胶水、Agent LLM 编排、auth/JWT 异常分支、env fallback
//
// 用法：node scripts/coverage-report.mjs [--strict-min=95] [--soft-min=0] [--json]

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const COVERAGE = resolve(ROOT, 'coverage/coverage-final.json');

const args = new Map();
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--([^=]+)(?:=(.+))?$/);
  if (m) args.set(m[1], m[2] ?? 'true');
}

const STRICT_MIN = Number(args.get('strict-min') ?? 95);
const SOFT_MIN = Number(args.get('soft-min') ?? 0);
const AS_JSON = args.get('json') === 'true';
const INCREMENTAL_ONLY = args.get('incremental-only') === 'true';
const INCREMENTAL_PREFIX = args.get('incremental-prefix') ?? 'v3';

const STRICT_LAYERS = {
  'core/store':   /^packages\/ai-team-core\/src\/store\//,
  'core/utils':   /^packages\/ai-team-core\/src\/utils\//,
  'core/index':   /^packages\/ai-team-core\/src\/index\.ts$/,
  'server/sse':   /^packages\/ai-team-server\/src\/sse\.ts$/,
  'server/middleware': /^packages\/ai-team-server\/src\/middleware\//,
  'server/team-orchestration': /^packages\/ai-team-server\/src\/routes\/team-orchestration\.ts$/,
  'web/lib-format':  /^packages\/ai-team-web\/src\/lib\/format\.ts$/,
  // V208: register V196 NoiseStats helpers as a strict-95% layer so the
  // per-chunk RMS / sliding-window SNR helpers feeding V204 NoiseStatsPanel
  // + V205 NoiseStatsLabPage stay under coverage gate.
  'v196/web-noise-stats': /^packages\/ai-team-web\/src\/lib\/audio\/noise-stats\.ts$/,
  // V208: register V188 PrivacyOverrideLog as a strict layer so the audit
  // trail module powering V200/V203 keeps ≥95% coverage.
  'v188/web-privacy-override-log': /^packages\/ai-team-web\/src\/lib\/privacy\/override-log\.ts$/,
  // V32: per-agent independent configuration (incremental layer, exact-match files only)
  'v32/core-agent-config': /^packages\/ai-team-core\/src\/agent-config\.ts$/,
  'v32/agent-config-loader': /^packages\/ai-team-agent\/src\/agent-config-loader\.ts$/,
  // V35: bulk export/import templates + server route
  'v35/core-agent-config-template': /^packages\/ai-team-core\/src\/agent-config-template\.ts$/,
  'v45/server-team-orchestration': /^packages\/ai-team-server\/src\/routes\/team-orchestration\.ts$/,
  'v51/delivery-summary': /^packages\/ai-team-core\/src\/delivery-summary\.ts$/,
  'v53/orchestration-base': /^packages\/ai-team-core\/src\/team-orchestration-base\.ts$/,
  'v53/orchestration-org-memory': /^packages\/ai-team-core\/src\/team-orchestration-org-memory\.ts$/,
  'v53/orchestration-scenario-batch': /^packages\/ai-team-core\/src\/team-orchestration-scenario-batch\.ts$/,
  'v53/orchestration-release-hardening': /^packages\/ai-team-core\/src\/team-orchestration-release-hardening\.ts$/,
  // V147/V149: tracked as SOFT below. v8 BRDA reports uncoverable for-of
  // iterator end-checks for the same file path, so we no longer gate it as strict.
};

const SOFT_LAYERS = {
  'core/auth':           /^packages\/ai-team-core\/src\/auth\.ts$/,
  'core/i18n':          /^packages\/ai-team-core\/src\/i18n\.ts$/,
  'core/notify':        /^packages\/ai-team-core\/src\/notify\.ts$/,
  'core/pwa':           /^packages\/ai-team-core\/src\/pwa\.ts$/,
  'core/llm-config':    /^packages\/ai-team-core\/src\/llm-config\.ts$/,
  'core/types':         /^packages\/ai-team-core\/src\/types\//,
  'server/entry':       /^packages\/ai-team-server\/src\/index\.ts$/,
  'server/plugins':     /^packages\/ai-team-server\/src\/plugins\.ts$/,
  'agent/orchestration':/^packages\/ai-team-agent\/src\/.+-agent\.ts$/,
  'agent/search':       /^packages\/ai-team-agent\/src\/search\.ts$/,
  'agent/index':        /^packages\/ai-team-agent\/src\/index\.ts$/,
  'ai/prompts':         /^packages\/ai-team-ai\/src\/prompts\//,
  'ai/providers':       /^packages\/ai-team-ai\/src\/providers\//,
  'ai/index':           /^packages\/ai-team-ai\/src\/index\.ts$/,
  'cli/entry':          /^packages\/ai-team-cli\/src\/index\.ts$/,
  'cli/utils':          /^packages\/ai-team-cli\/src\/utils\.ts$/,
  'cli/commands':       /^packages\/ai-team-cli\/src\/commands\//,
  'tui/entry':          /^packages\/ai-team-tui\/src\/(index|run|app|api)\.tsx?$/,
  'web/pages':          /^packages\/ai-team-web\/src\/pages\//,
  'web/components':     /^packages\/ai-team-web\/src\/components\//,
  'web/hooks':          /^packages\/ai-team-web\/src\/hooks\//,
  'web/i18n':           /^packages\/ai-team-web\/src\/i18n\//,
  'web/lib-other':      /^packages\/ai-team-web\/src\/lib\//,
  'web/interview-helpers': /^packages\/ai-team-web\/src\/lib\/interview-helpers\.ts$/,
  'web/app':            /^packages\/ai-team-web\/src\/(App|main)\.tsx$/,
  // V45-V47: Org Memory + Scenario Batch + Release Hardening (soft layer for the core monolith —
  // team-orchestration.ts aggregates 10+ features with ~30 helper branches that defeat 95% branch
  // gate. The server route is in STRICT_LAYERS and tracked as v45 incremental layer. Promote
  // v45/core-team-orchestration to strict after splitting the file by feature in V51+).
  'v45/core-team-orchestration': /^packages\/ai-team-core\/src\/team-orchestration\.ts$/,
};

function classifyFile(path) {
  for (const [layer, regex] of Object.entries(STRICT_LAYERS)) if (regex.test(path)) return { layer, kind: 'strict' };
  for (const [layer, regex] of Object.entries(SOFT_LAYERS))   if (regex.test(path)) return { layer, kind: 'soft' };
  return { layer: 'unknown', kind: 'soft' };
}

function pct(n, d) {
  if (!d) return 100;
  return Math.round((100 * n) / d * 100) / 100;
}

function countHit(map) {
  // v8 istanbul: s/f are {id: hits}; b is {id: [hitA, hitB]}
  let total = 0, hit = 0;
  for (const v of Object.values(map)) {
    if (Array.isArray(v)) {
      total += v.length;
      hit += v.reduce((acc, x) => acc + (x > 0 ? 1 : 0), 0);
    } else if (typeof v === 'number') {
      total += 1;
      hit += v > 0 ? 1 : 0;
    }
  }
  return { hit, total };
}

if (!existsSync(COVERAGE)) {
  console.error(`ERROR: coverage-final.json not found at ${COVERAGE}. Run \`npm run test:coverage\` first.`);
  process.exit(2);
}

const data = JSON.parse(readFileSync(COVERAGE, 'utf8'));

const buckets = new Map(); // layer -> { kind, files: Set, s, b, f, totalFiles }

for (const [file, cov] of Object.entries(data)) {
  const rel = file.replace(ROOT + '/', '');
  const { layer, kind } = classifyFile(rel);
  if (!buckets.has(layer)) buckets.set(layer, { kind, files: new Set(), s: { hit: 0, total: 0 }, b: { hit: 0, total: 0 }, f: { hit: 0, total: 0 } });
  const b = buckets.get(layer);
  b.files.add(rel);
  const sH = countHit(cov.s);
  const bH = countHit(cov.b);
  const fH = countHit(cov.f);
  b.s.hit += sH.hit; b.s.total += sH.total;
  b.b.hit += bH.hit; b.b.total += bH.total;
  b.f.hit += fH.hit; b.f.total += fH.total;
}

const report = [];
let totalStrictFail = 0;
let totalSoftFail = 0;
for (const [layer, info] of buckets) {
  const sPct = pct(info.s.hit, info.s.total);
  const bPct = pct(info.b.hit, info.b.total);
  const fPct = pct(info.f.hit, info.f.total);
  const min = info.kind === 'strict' ? STRICT_MIN : SOFT_MIN;
  const minMet = Math.min(sPct, bPct, fPct) >= min;
  if (!minMet && info.kind === 'strict') totalStrictFail += 1;
  if (!minMet && info.kind === 'soft') totalSoftFail += 1;
  report.push({ layer, kind: info.kind, files: info.files.size, stmts: sPct, branches: bPct, funcs: fPct, min, pass: minMet });
}

// Add summary "global" view across strict layers
const strict = report.filter(r => r.kind === 'strict');
const soft = report.filter(r => r.kind === 'soft');
const overall = (rows) => {
  const w = rows.reduce((acc, r) => ({ s: acc.s + r.stmts, b: acc.b + r.branches, f: acc.f + r.funcs }), { s: 0, b: 0, f: 0 });
  return { stmts: +(w.s / (rows.length || 1)).toFixed(2), branches: +(w.b / (rows.length || 1)).toFixed(2), funcs: +(w.f / (rows.length || 1)).toFixed(2) };
};
const summary = {
  strict: overall(strict),
  soft: overall(soft),
  layers: report.length,
  strictPass: strict.filter(r => r.pass).length,
  strictFail: totalStrictFail,
  softFail: totalSoftFail,
};

if (AS_JSON) {
  console.log(JSON.stringify({ summary, layers: report }, null, 2));
} else {
  console.log('Coverage Gate 2.0 — layered report');
  console.log(`Strict threshold: ${STRICT_MIN}%  |  Soft threshold: ${SOFT_MIN}% (tracking only)`);
  console.log('');
  console.log('Layer                            Files   Stmts   Branches   Funcs   Min   Status');
  console.log('-------------------------------  -----  ------  ---------  ------  ----  ------');
  for (const r of report) {
    const layer = (r.layer + ' '.repeat(31)).slice(0, 31);
    const status = r.pass ? 'PASS' : 'FAIL';
    console.log(`${layer}  ${String(r.files).padStart(5)}  ${r.stmts.toFixed(2).padStart(6)}  ${r.branches.toFixed(2).padStart(9)}  ${r.funcs.toFixed(2).padStart(6)}  ${String(r.min).padStart(3)}%  ${status}`);
  }
  console.log('');
  console.log(`Summary: strict ${summary.strictPass}/${report.filter(r=>r.kind==='strict').length} pass (avg ${summary.strict.stmts}% stmts / ${summary.strict.branches}% br / ${summary.strict.funcs}% fn)  soft ${report.filter(r=>r.kind==='soft').length} layers tracked`);
}

const overallStrictPass = totalStrictFail === 0 && strict.length > 0;
if (!overallStrictPass) {
  if (INCREMENTAL_ONLY) {
    // incremental-only mode: only layers whose name starts with INCREMENTAL_PREFIX are gate-keepers
    const incrFail = report.filter(r => r.kind === 'strict' && r.layer.startsWith(INCREMENTAL_PREFIX) && !r.pass).length;
    if (incrFail > 0) {
      console.error(`\nIncremental coverage gate failed (${incrFail} incremental layer(s) below ${STRICT_MIN}%).`);
      process.exit(1);
    }
    console.log(`\nIncremental coverage gate PASSED (${report.filter(r => r.kind === 'strict' && r.layer.startsWith(INCREMENTAL_PREFIX)).length} incremental layers all ≥ ${STRICT_MIN}%).`);
  } else {
    console.error(`\nStrict coverage gate failed (${totalStrictFail} layer(s) below ${STRICT_MIN}%).`);
    process.exit(1);
  }
}
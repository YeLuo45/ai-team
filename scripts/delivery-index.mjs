#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  buildDeliveryEvidenceSummary,
  buildDeliveryReportIndex,
  buildReleaseEvidenceDownload,
} from '../packages/ai-team-core/dist/team-orchestration.js';

const ROOT = resolve(import.meta.dirname, '..');
const DELIVERY_DIR = join(ROOT, 'docs', 'delivery');

function parseReport(file) {
  const path = join(DELIVERY_DIR, file);
  const text = readFileSync(path, 'utf-8');
  const version = (text.match(/\b(V\d+)\b/)?.[1] ?? file.replace(/-delivery-report\.md$/, '')).toUpperCase();
  const tests = text.match(/npm test` — (\d+) passed \| (\d+) skipped/);
  const coverage = text.match(/test:coverage:incremental` — (\d+)\/(\d+) strict layers, ([\d.]+)% avg branch/);
  const readme = text.match(/verify:readme` — (\d+)\/(\d+) passed/);
  const summary = buildDeliveryEvidenceSummary({
    version,
    tests: tests ? { passed: Number(tests[1]), skipped: Number(tests[2]), total: Number(tests[1]) + Number(tests[2]) } : { passed: 0, skipped: 0, total: 0 },
    coverage: coverage ? { strictPassed: Number(coverage[1]), strictTotal: Number(coverage[2]), averageBranchPct: Number(coverage[3]), thresholdPct: 95 } : { strictPassed: 0, strictTotal: 0, averageBranchPct: 0, thresholdPct: 95 },
    readme: readme ? { passed: Number(readme[1]), total: Number(readme[2]) } : { passed: 0, total: 0 },
    build: { passed: !/\*\*Ready\*\*: no/.test(text) },
    blockers: [],
  });
  return {
    version,
    path: `docs/delivery/${file}`,
    summary,
    updatedAt: statSync(path).mtime.toISOString(),
    text,
  };
}

mkdirSync(DELIVERY_DIR, { recursive: true });
const reports = existsSync(DELIVERY_DIR)
  ? readdirSync(DELIVERY_DIR).filter((file) => file.endsWith('-delivery-report.md')).map(parseReport)
  : [];
const index = buildDeliveryReportIndex(reports);
const indexPath = join(DELIVERY_DIR, 'index.md');
writeFileSync(indexPath, `${index.markdown}\n`, 'utf-8');

const latest = index.latest;
if (latest) {
  const report = reports.find((item) => item.path === latest.path);
  const download = buildReleaseEvidenceDownload({
    version: latest.version,
    reportMarkdown: report?.text ?? '',
    indexMarkdown: index.markdown,
    summary: latest.summary,
  });
  writeFileSync(join(DELIVERY_DIR, download.filename), `${download.serialized}\n`, 'utf-8');
  console.log(`Delivery index ready: ${index.total} reports, latest ${latest.version}, evidence ${download.filename}`);
} else {
  console.log('Delivery index ready: 0 reports, latest none');
}

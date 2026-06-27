import { describe, expect, it } from 'vitest';
import {
  buildCiArtifactProvenance,
  buildProposalReplayVisualDiff,
  buildReleaseOperationsHistorySnapshot,
  enforceSignedCiArtifactProvenance,
  filterProposalReplayDiffTimeline,
  planReleaseHistoryRetention,
} from '../src/delivery-summary.js';

const validSha = 'a'.repeat(64);

describe('V104 signed provenance enforcement', () => {
  it('marks a trusted signed artifact as enforceable', () => {
    const provenance = buildCiArtifactProvenance({
      version: 'V104',
      artifactName: 'release-check.json',
      artifactSha256: validSha,
      commit: '7407871',
      workflowRunId: '123456789',
      signer: 'github-actions',
      generatedAt: '2026-06-27T00:00:00Z',
    });

    const enforcement = enforceSignedCiArtifactProvenance(provenance, {
      trustedSigners: ['github-actions', 'release-bot'],
      requiredWorkflowRunId: '123456789',
      minGeneratedAt: '2026-06-26T00:00:00Z',
    });

    expect(enforcement.ready).toBe(true);
    expect(enforcement.policy).toBe('trusted-signer+workflow+freshness');
    expect(enforcement.issues).toEqual([]);
    expect(enforcement.markdown).toContain('Signer: github-actions');
  });

  it('blocks unsigned, stale, or untrusted provenance', () => {
    const provenance = buildCiArtifactProvenance({
      version: 'V104',
      artifactName: 'release-check.json',
      artifactSha256: 'bad',
      commit: 'not-a-sha',
      workflowRunId: '',
      signer: 'unknown-bot',
      generatedAt: '2026-06-20T00:00:00Z',
    });

    const enforcement = enforceSignedCiArtifactProvenance(provenance, {
      trustedSigners: ['github-actions'],
      requiredWorkflowRunId: '999',
      minGeneratedAt: '2026-06-26T00:00:00Z',
    });

    expect(enforcement.ready).toBe(false);
    expect(enforcement.issues).toContain('base provenance is not ready');
    expect(enforcement.issues).toContain('signer unknown-bot is not trusted');
    expect(enforcement.issues).toContain('workflowRunId must be 999');
    expect(enforcement.issues).toContain('generatedAt is older than 2026-06-26T00:00:00Z');
  });

  it('allows trusted provenance without optional workflow and freshness constraints', () => {
    const provenance = buildCiArtifactProvenance({
      version: 'V104',
      artifactName: 'release-check.json',
      artifactSha256: validSha,
      commit: '7407871',
      workflowRunId: '123456789',
      signer: 'release-bot',
      generatedAt: '2026-06-20T00:00:00Z',
    });

    const enforcement = enforceSignedCiArtifactProvenance(provenance, { trustedSigners: [' release-bot '] });

    expect(enforcement.ready).toBe(true);
    expect(enforcement.markdown).toContain('V104');
  });

  it('labels missing signer and workflow values in enforcement markdown', () => {
    const provenance = buildCiArtifactProvenance({
      version: '',
      artifactName: '',
      artifactSha256: '',
      commit: '',
      workflowRunId: '',
      signer: '',
      generatedAt: '',
    });

    const enforcement = enforceSignedCiArtifactProvenance(provenance, { trustedSigners: [] });

    expect(enforcement.ready).toBe(false);
    expect(enforcement.markdown).toContain('VNext');
    expect(enforcement.markdown).toContain('Signer: missing');
    expect(enforcement.markdown).toContain('Workflow: missing');
    expect(enforcement.issues).toContain('signer missing is not trusted');
  });
});

describe('V105 replay diff timeline filters', () => {
  it('filters replay diff steps by state and query', () => {
    const diff = buildProposalReplayVisualDiff({
      proposalId: 'P-20260627-001',
      before: ['in_test_acceptance', 'accepted'],
      after: ['in_test_acceptance', 'accepted', 'deployed', 'delivered'],
    });

    const timeline = filterProposalReplayDiffTimeline(diff, { state: 'added', query: 'deploy' });

    expect(timeline.total).toBe(1);
    expect(timeline.steps.map((step) => step.status)).toEqual(['deployed']);
    expect(timeline.markdown).toContain('deployed');
  });

  it('reports an empty filtered timeline with proposal context', () => {
    const diff = buildProposalReplayVisualDiff({
      proposalId: 'P-20260627-001',
      before: ['accepted'],
      after: ['accepted'],
    });

    const timeline = filterProposalReplayDiffTimeline(diff, { state: 'removed', query: 'delivered' });

    expect(timeline.total).toBe(0);
    expect(timeline.steps).toEqual([]);
    expect(timeline.markdown).toContain('No matching replay diff steps for P-20260627-001');
  });

  it('returns all changed steps when no timeline filters are supplied', () => {
    const diff = buildProposalReplayVisualDiff({
      proposalId: 'P-20260627-001',
      before: ['accepted', 'deployed'],
      after: ['accepted', 'delivered'],
    });

    const timeline = filterProposalReplayDiffTimeline(diff, {});

    expect(timeline.total).toBe(3);
    expect(timeline.steps.map((step) => step.state)).toEqual(['unchanged', 'removed', 'added']);
  });

  it('renders explicit no values for steps absent from before or after', () => {
    const diff = buildProposalReplayVisualDiff({
      proposalId: 'P-20260627-001',
      before: ['accepted', 'deployed'],
      after: ['accepted', 'delivered'],
    });

    const timeline = filterProposalReplayDiffTimeline(diff, { query: 'removed' });

    expect(timeline.markdown).toContain('deployed: removed (before=yes, after=no)');
  });
});

describe('V106 release history retention policy', () => {
  it('keeps the newest entries and archives stale history', () => {
    const history = buildReleaseOperationsHistorySnapshot([
      { version: 'V101', proposalId: 'P-1', updatedAt: '2026-06-21T00:00:00Z', ready: true, summary: 'old ready', evidencePath: 'old.json' },
      { version: 'V102', proposalId: 'P-2', updatedAt: '2026-06-22T00:00:00Z', ready: false, summary: 'blocked', evidencePath: 'blocked.json' },
      { version: 'V103', proposalId: 'P-3', updatedAt: '2026-06-27T00:00:00Z', ready: true, summary: 'latest', evidencePath: 'latest.json' },
    ]);

    const retention = planReleaseHistoryRetention(history, {
      keepLatest: 2,
      archiveBefore: '2026-06-23T00:00:00Z',
      now: '2026-06-27T00:00:00Z',
    });

    expect(retention.ready).toBe(true);
    expect(retention.keep.map((entry) => entry.version)).toEqual(['V103', 'V102']);
    expect(retention.archive.map((entry) => entry.version)).toEqual(['V101']);
    expect(retention.commands).toEqual(['mkdir -p docs/delivery/archive && mv old.json docs/delivery/archive/old.json']);
  });

  it('blocks invalid retention policies', () => {
    const history = buildReleaseOperationsHistorySnapshot([]);

    const retention = planReleaseHistoryRetention(history, { keepLatest: 0, archiveBefore: '', now: '' });

    expect(retention.ready).toBe(false);
    expect(retention.issues).toEqual(['keepLatest must be at least 1', 'archiveBefore is required', 'now is required']);
    expect(retention.commands).toEqual([]);
  });

  it('keeps all entries when history is within the retention window', () => {
    const history = buildReleaseOperationsHistorySnapshot([
      { version: 'V105', proposalId: 'P-5', updatedAt: '2026-06-27T01:00:00Z', ready: true, summary: 'fresh', evidencePath: 'fresh.json' },
    ]);

    const retention = planReleaseHistoryRetention(history, {
      keepLatest: 5,
      archiveBefore: '2026-06-01T00:00:00Z',
      now: '2026-06-27T02:00:00Z',
    });

    expect(retention.keep.map((entry) => entry.version)).toEqual(['V105']);
    expect(retention.archive).toEqual([]);
    expect(retention.commands).toEqual([]);
    expect(retention.markdown).toContain('Archive: none');
  });

  it('builds archive commands for bare evidence filenames', () => {
    const history = buildReleaseOperationsHistorySnapshot([
      { version: 'V100', proposalId: 'P-0', updatedAt: '2026-06-01T00:00:00Z', ready: true, summary: 'old', evidencePath: 'old.json' },
      { version: 'V106', proposalId: 'P-6', updatedAt: '2026-06-27T00:00:00Z', ready: true, summary: 'new', evidencePath: 'new.json' },
    ]);

    const retention = planReleaseHistoryRetention(history, {
      keepLatest: 1,
      archiveBefore: '2026-06-10T00:00:00Z',
      now: '2026-06-27T02:00:00Z',
    });

    expect(retention.commands).toEqual(['mkdir -p docs/delivery/archive && mv old.json docs/delivery/archive/old.json']);
  });
});

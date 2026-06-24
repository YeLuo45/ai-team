import { useState } from 'react';
import {
  buildDeliveryEvidenceSummary,
  buildReleaseReadinessDashboard,
  buildBrowserEvidenceDownloadIntent,
  buildCockpitPersistenceSnapshot,
  buildDiffOwnershipAudit,
  buildProposalDeliveryChecklist,
  buildProposalDeliveryWizard,
  buildCockpitWebRestoreModel,
  buildCockpitServerRecord,
  buildReleaseOperationsPanelModel,
  buildReleaseSideEffectGuard,
  buildReleaseSideEffectVisualization,
  buildProposalAutoDeliveryExecution,
  buildCiArtifactEvidenceInput,
  buildProposalExecutionAuditLedger,
  buildReleaseOperationsPersistenceSnapshot,
  filterProposalExecutionAuditTimeline,
  classifyChangedFiles,
  executeProposalDryRun,
  parseVersionedReleaseEvidenceJson,
} from '@ai-team/core/delivery-summary';

type WorkflowResult = {
  candidateName: string;
  recommendation: { decision: string; confidence: number };
  reviewGate: { required: boolean; queue: unknown[] };
  steps: Array<{ agent: string; status: string }>;
};

type ApprovalSnapshot = {
  pending: Array<{ id: string; agent: string; priority: string; reason: string }>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
};

type LlmOpsAlert = { kind: string; severity: string; message: string };
type ScenarioBatch = {
  winners: string[];
  droppedIds: string[];
  results: Array<{ id: string; name: string; recommendation: string; rankingScore: number }>;
};
type OrgMemoryContext = { team: string; summary: string; citations: string[] };
type DeliverySummary = ReturnType<typeof buildDeliveryEvidenceSummary>;
type ReleaseDashboard = ReturnType<typeof buildReleaseReadinessDashboard>;
type DiffClassification = ReturnType<typeof classifyChangedFiles>;
type DiffAudit = ReturnType<typeof buildDiffOwnershipAudit>;
type DeliveryChecklist = ReturnType<typeof buildProposalDeliveryChecklist>;
type CockpitRestore = ReturnType<typeof buildCockpitWebRestoreModel>;
type OperationsPanel = ReturnType<typeof buildReleaseOperationsPanelModel>;
type ProposalAuditLedger = ReturnType<typeof buildProposalExecutionAuditLedger>;
type OperationsSnapshot = ReturnType<typeof buildReleaseOperationsPersistenceSnapshot>;
type AuditTimeline = ReturnType<typeof filterProposalExecutionAuditTimeline>;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export default function TeamOrchestrationConsole() {
  const [workflow, setWorkflow] = useState<WorkflowResult | null>(null);
  const [approvalSnapshot, setApprovalSnapshot] = useState<ApprovalSnapshot | null>(null);
  const [alerts, setAlerts] = useState<LlmOpsAlert[]>([]);
  const [batch, setBatch] = useState<ScenarioBatch | null>(null);
  const [memoryContext, setMemoryContext] = useState<OrgMemoryContext | null>(null);
  const [deliverySummary, setDeliverySummary] = useState<DeliverySummary | null>(null);
  const [releaseDashboard, setReleaseDashboard] = useState<ReleaseDashboard | null>(null);
  const [evidenceJson, setEvidenceJson] = useState('');
  const [importedEvidence, setImportedEvidence] = useState('');
  const [diffLines, setDiffLines] = useState('');
  const [diffClassification, setDiffClassification] = useState<DiffClassification | null>(null);
  const [diffAudit, setDiffAudit] = useState<DiffAudit | null>(null);
  const [deliveryChecklist, setDeliveryChecklist] = useState<DeliveryChecklist | null>(null);
  const [cockpitRestore, setCockpitRestore] = useState<CockpitRestore | null>(null);
  const [operationsPanel, setOperationsPanel] = useState<OperationsPanel | null>(null);
  const [auditLedger, setAuditLedger] = useState<ProposalAuditLedger | null>(null);
  const [operationsSnapshot, setOperationsSnapshot] = useState<OperationsSnapshot | null>(null);
  const [auditTimeline, setAuditTimeline] = useState<AuditTimeline | null>(null);
  const [candidateName, setCandidateName] = useState('Ada Chen');
  const [memoryFeedback, setMemoryFeedback] = useState('ownership matters');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function runWorkflow() {
    try {
      setError('');
      const result = await postJson<{ workflow: WorkflowResult }>('/api/team-orchestration/workflow', {
        candidateId: 'ct-demo',
        candidateName,
        position: 'Senior Frontend Engineer',
        resumeScore: 86,
        interviewScore: 82,
        scoreAgentScore: 88,
        legalRisk: 'low',
        techPolicyRisk: 'medium',
        mediaComplianceRisk: 'low',
        requiredSkills: ['React', 'TypeScript', 'Testing'],
        candidateSkills: ['React', 'TypeScript', 'Testing'],
      });
      setWorkflow(result.workflow);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadApprovals() {
    try {
      setError('');
      const response = await fetch('/api/team-orchestration/approvals');
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const result = await response.json() as { snapshot: ApprovalSnapshot };
      setApprovalSnapshot(result.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function checkAlerts() {
    try {
      setError('');
      const result = await postJson<{ alerts: LlmOpsAlert[] }>('/api/team-orchestration/llmops/alerts', {
        policy: { maxCostUsd: 0.02, maxAverageLatencyMs: 800, maxFallbackRate: 0.2, maxErrorRate: 0.1 },
        calls: [
          { agent: 'resume', provider: 'openai', tokens: 1000, costUsd: 0.03, latencyMs: 900, status: 'ok' },
          { agent: 'legal', provider: 'openai', tokens: 500, costUsd: 0.01, latencyMs: 1200, status: 'error' },
        ],
      });
      setAlerts(result.alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runBatch() {
    try {
      setError('');
      const result = await postJson<{ batch: ScenarioBatch }>('/api/team-orchestration/simulate/batch', {
        teamName: 'Platform',
        currentHeadcount: 6,
        targetHeadcount: 8,
        requiredSkills: ['React', 'Security', 'Testing'],
        currentSkills: ['React'],
        candidates: [
          { id: 'c1', name: 'Ada', candidateSkills: ['Security', 'Testing'], trainingHours: 8 },
          { id: 'c2', name: 'Ben', candidateSkills: ['React'], trainingHours: 16 },
        ],
      });
      setBatch(result.batch);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadMemoryContext() {
    try {
      setError('');
      const result = await postJson<{ context: OrgMemoryContext }>('/api/team-orchestration/org-memory/Growth/context', {
        queryTokens: ['retention', 'frontend', 'risk'],
      });
      setMemoryContext(result.context);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadDeliverySummary() {
    try {
      setError('');
      const result = await postJson<{ summary: DeliverySummary }>('/api/team-orchestration/delivery-summary', {
        version: 'V54',
        tests: { passed: 1105, total: 1112, skipped: 7 },
        coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.6, thresholdPct: 95 },
        readme: { passed: 11, total: 11 },
        build: { passed: true },
        blockers: [],
      });
      setDeliverySummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveMemory() {
    try {
      setError('');
      setStatus('');
      await postJson<{ entry: unknown }>('/api/team-orchestration/org-memory/Growth', {
        roleProfile: 'Experimentation engineer',
        feedback: memoryFeedback.split('\n').map((line) => line.trim()).filter(Boolean),
        preferences: ['async updates'],
        updatedBy: 'web-console',
      });
      setStatus('Org memory saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function saveReport() {
    const report = deliverySummary?.headline ?? 'Delivery report draft';
    window.localStorage?.setItem('ai-team:last-delivery-report', report);
    const snapshot = buildCockpitPersistenceSnapshot({
      selectedVersion: releaseDashboard?.latest?.version,
      filters: { status: 'all' },
      importedEvidence: importedEvidence ? [importedEvidence] : [],
      diffText: diffLines,
    });
    window.localStorage?.setItem(snapshot.storageKey, snapshot.serialized);
    setStatus('Report and cockpit saved locally');
  }

  function applySecurityPreset() {
    setCandidateName('Security Reviewer');
    setMemoryFeedback('security review required\npolicy risk first');
    setStatus('Security preset applied');
  }

  function downloadReleaseEvidence() {
    const download = buildBrowserEvidenceDownloadIntent({
      filename: 'ai-team-v78-release-evidence.json',
      mimeType: 'application/json',
      payload: {
        version: 'V78',
        generatedAt: '1970-01-01T00:00:00.000Z',
        summary: deliverySummary ?? { ready: true, headline: 'V78 ready — web release evidence', blockers: [], testPassRatePct: 100, coverageStatus: 'pass', readmeStatus: 'pass', buildStatus: 'pass' },
        reportMarkdown: window.localStorage?.getItem('ai-team:last-delivery-report') ?? 'Delivery report draft',
        indexMarkdown: releaseDashboard?.latest?.path ?? 'docs/delivery/index.md',
      },
      serialized: JSON.stringify({
        version: 'V78',
        summary: deliverySummary ?? { ready: true, headline: 'V78 ready — web release evidence', blockers: [], testPassRatePct: 100, coverageStatus: 'pass', readmeStatus: 'pass', buildStatus: 'pass' },
        reportMarkdown: window.localStorage?.getItem('ai-team:last-delivery-report') ?? 'Delivery report draft',
        indexMarkdown: releaseDashboard?.latest?.path ?? 'docs/delivery/index.md',
      }, null, 2),
    }, { objectUrl: 'pending' });
    const blob = new Blob([download.serialized], { type: download.mimeType });
    const url = window.URL.createObjectURL(blob);
    if (download.revokeAfterClick) window.URL.revokeObjectURL(url);
    setStatus(`Release evidence downloaded: ${download.filename}`);
  }

  function showReleaseDashboard() {
    const summary = buildDeliveryEvidenceSummary({
      version: 'V72',
      tests: { passed: 1117, total: 1124, skipped: 7 },
      coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.36, thresholdPct: 95 },
      readme: { passed: 13, total: 13 },
      build: { passed: true },
      blockers: [],
    });
    setReleaseDashboard(buildReleaseReadinessDashboard([
      { version: 'V72', path: 'docs/delivery/v72-delivery-report.md', summary, updatedAt: '2026-06-23T00:00:00Z' },
    ]));
  }

  function importEvidenceJson() {
    const parsed = parseVersionedReleaseEvidenceJson(evidenceJson, 'web-import');
    if (parsed.evidence) {
      setImportedEvidence(`Imported ${parsed.evidence.version} schema v${parsed.evidence.schemaVersion}${parsed.migrated ? ' migrated' : ''}`);
      setError('');
    } else {
      setImportedEvidence('');
      setError(parsed.issues.join('; '));
    }
  }

  function classifyDiffLines() {
    const lines = diffLines.split('\n').filter(Boolean);
    setDiffClassification(classifyChangedFiles(lines));
    setDiffAudit(buildDiffOwnershipAudit(lines));
  }

  function buildDeliveryChecklist() {
    const wizard = buildProposalDeliveryWizard({
      proposalId: 'P-20260624-003',
      projectPath: '/home/hermes/projects/ai-team',
      deploymentUrl: 'https://yeluo45.github.io/ai-team/',
      reportPath: 'docs/delivery/v78-delivery-report.md',
      evidenceNote: 'web checklist dry run',
      currentStatus: 'in_test_acceptance',
      targetStatus: 'delivered',
    });
    setDeliveryChecklist(buildProposalDeliveryChecklist({
      proposalId: 'P-20260624-003',
      reportPath: 'docs/delivery/v78-delivery-report.md',
      gates: { tests: true, coverage: true, readme: true, build: true },
      dryRun: executeProposalDryRun(wizard),
    }));
  }

  function restoreCockpit() {
    const snapshot = buildCockpitPersistenceSnapshot({
      selectedVersion: 'V96',
      filters: { status: 'ready', gate: 'coverage', versionText: 'V96' },
      importedEvidence: ['V94', 'V95', 'V96'],
      diffText: diffLines || 'M packages/ai-team-core/src/delivery-summary.ts',
    });
    setCockpitRestore(buildCockpitWebRestoreModel({
      userId: 'operator-1',
      records: [buildCockpitServerRecord({ userId: 'operator-1', snapshot, now: '2026-06-24T12:00:00.000Z' })],
    }));
  }

  function showOperationsPanel() {
    const summary = buildDeliveryEvidenceSummary({
      version: 'V94',
      tests: { passed: 1158, total: 1165, skipped: 7 },
      coverage: { strictPassed: 16, strictTotal: 16, averageBranchPct: 98.44, thresholdPct: 95 },
      readme: { passed: 15, total: 15 },
      build: { passed: true },
      blockers: [],
    });
    setOperationsPanel(buildReleaseOperationsPanelModel({
      entries: [{ version: 'V94', path: 'docs/delivery/v94-delivery-report.md', summary, updatedAt: '2026-06-24T06:00:00Z' }],
      sideEffect: buildReleaseSideEffectVisualization(buildReleaseSideEffectGuard({ command: 'npm run release:check', before: [], after: [' M docs/delivery/index.md'], allowedGlobs: ['docs/delivery/**'] })),
      autoDelivery: buildProposalAutoDeliveryExecution({ proposalId: 'P-20260624-019', currentStatus: 'in_test_acceptance', reportPath: 'docs/delivery/v94-delivery-report.md', gates: { build: true, tests: true, coverage: true, readme: true, release: true }, dryRun: true }),
      ciArtifact: buildCiArtifactEvidenceInput({ version: 'V94', artifactName: 'release-check.json', jsonText: JSON.stringify({ tests: { passed: 1158, total: 1165, skipped: 7 }, coverage: { strictPassed: 16, strictTotal: 16, averageBranchPct: 98.44, thresholdPct: 95 }, readme: { passed: 15, total: 15 }, build: { passed: true } }) }),
    }));
  }

  function showAuditLedger() {
    setAuditLedger(buildProposalExecutionAuditLedger({
      proposalId: 'P-20260624-019',
      actor: '小墨',
      events: [
        { at: '2026-06-24T06:00:00Z', status: 'in_test_acceptance', command: 'npm run release:check', ok: true },
        { at: '2026-06-24T06:01:00Z', status: 'accepted', command: 'mcp_aisp.py update-proposal-status --status accepted', ok: true },
        { at: '2026-06-24T06:02:00Z', status: 'deployed', command: 'mcp_aisp.py update-proposal-status --status deployed', ok: true },
        { at: '2026-06-24T06:03:00Z', status: 'delivered', command: 'mcp_aisp.py update-proposal-status --status delivered', ok: true },
      ],
    }));
  }

  function persistOperationsPanel() {
    const panel = operationsPanel ?? buildReleaseOperationsPanelModel({
      entries: [],
      sideEffect: buildReleaseSideEffectVisualization(buildReleaseSideEffectGuard({ command: 'noop', before: [], after: [], allowedGlobs: [] })),
      autoDelivery: buildProposalAutoDeliveryExecution({ proposalId: 'P-20260624-022', currentStatus: 'delivered', reportPath: 'docs/delivery/v97.md', gates: { build: true, tests: true, coverage: true, readme: true, release: true }, dryRun: true }),
      ciArtifact: buildCiArtifactEvidenceInput({ version: 'V97', artifactName: 'release-check.json', jsonText: '{}' }),
    });
    const snapshot = buildReleaseOperationsPersistenceSnapshot({ userId: 'operator-1', selectedTab: 'audit', panel, auditFilter: { status: 'delivered', ok: true }, now: '2026-06-24T08:00:00Z' });
    window.localStorage?.setItem(snapshot.storageKey, snapshot.serialized);
    setOperationsSnapshot(snapshot);
    setStatus('Release operations panel persisted');
  }

  function filterAuditTimeline() {
    const ledger = auditLedger ?? buildProposalExecutionAuditLedger({
      proposalId: 'P-20260624-022',
      actor: '小墨',
      events: [
        { at: '2026-06-24T08:00:00Z', status: 'accepted', command: 'mcp status accepted', ok: true },
        { at: '2026-06-24T08:01:00Z', status: 'delivered', command: 'mcp status delivered', ok: false, note: 'retry' },
      ],
    });
    setAuditTimeline(filterProposalExecutionAuditTimeline(ledger, { status: 'delivered' }));
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-300">V42-V44</p>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Team Orchestration Console</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Workflow visualization, approval persistence, and LLMOps alert checks in one operator surface.</p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">⚠ {error}</div>}
      {status && <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{status}</div>}

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Candidate name
          <input data-testid="workflow-candidate-name" className="w-full rounded border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={candidateName} onChange={(event) => setCandidateName(event.target.value)} />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Org memory feedback
          <textarea data-testid="org-memory-feedback" className="w-full rounded border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={memoryFeedback} onChange={(event) => setMemoryFeedback(event.target.value)} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <button data-testid="team-orchestration-run" className="btn bg-brand-600 text-white hover:bg-brand-700" onClick={runWorkflow}>Run workflow</button>
        <button data-testid="team-orchestration-load-approvals" className="btn btn-ghost" onClick={loadApprovals}>Load approvals</button>
        <button data-testid="team-orchestration-check-alerts" className="btn btn-ghost" onClick={checkAlerts}>Check LLMOps alerts</button>
        <button data-testid="team-orchestration-run-batch" className="btn btn-ghost" onClick={runBatch}>Run scenario batch</button>
        <button data-testid="team-orchestration-load-memory" className="btn btn-ghost" onClick={loadMemoryContext}>Load org memory</button>
        <button data-testid="team-orchestration-delivery-summary" className="btn btn-ghost" onClick={loadDeliverySummary}>Delivery summary</button>
        <button data-testid="team-orchestration-save-memory" className="btn btn-ghost" onClick={saveMemory}>Save org memory</button>
        <button data-testid="team-orchestration-save-report" className="btn btn-ghost" onClick={saveReport}>Save report</button>
        <button data-testid="team-orchestration-preset-security" className="btn btn-ghost" onClick={applySecurityPreset}>Security preset</button>
        <button data-testid="team-orchestration-download-evidence" className="btn btn-ghost" onClick={downloadReleaseEvidence}>Download release evidence</button>
        <button data-testid="team-orchestration-release-dashboard" className="btn btn-ghost" onClick={showReleaseDashboard}>Show release readiness</button>
        <button data-testid="team-orchestration-import-evidence" className="btn btn-ghost" onClick={importEvidenceJson}>Import evidence</button>
        <button data-testid="team-orchestration-classify-diff" className="btn btn-ghost" onClick={classifyDiffLines}>Classify diff</button>
        <button data-testid="team-orchestration-delivery-checklist" className="btn btn-ghost" onClick={buildDeliveryChecklist}>Delivery checklist</button>
        <button data-testid="team-orchestration-restore-cockpit" className="btn btn-ghost" onClick={restoreCockpit}>Restore cockpit</button>
        <button data-testid="team-orchestration-operations-panel" className="btn btn-ghost" onClick={showOperationsPanel}>Operations panel</button>
        <button data-testid="team-orchestration-audit-ledger" className="btn btn-ghost" onClick={showAuditLedger}>Audit ledger</button>
        <button data-testid="team-orchestration-persist-operations" className="btn btn-ghost" onClick={persistOperationsPanel}>Persist operations</button>
        <button data-testid="team-orchestration-filter-audit" className="btn btn-ghost" onClick={filterAuditTimeline}>Filter audit</button>
      </div>

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Release evidence JSON
          <textarea data-testid="release-evidence-json" className="w-full rounded border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={evidenceJson} onChange={(event) => setEvidenceJson(event.target.value)} />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Diff lines
          <textarea data-testid="diff-lines-input" className="w-full rounded border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={diffLines} onChange={(event) => setDiffLines(event.target.value)} />
        </label>
      </div>

      {workflow && (
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-slate-50">{workflow.candidateName}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">Decision: {workflow.recommendation.decision} · Confidence: {workflow.recommendation.confidence}</p>
          <p className="text-sm text-slate-500">Steps: {workflow.steps.map((step) => `${step.agent}:${step.status}`).join(' → ')}</p>
        </article>
      )}

      {approvalSnapshot && (
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <h3 className="font-semibold text-amber-900 dark:text-amber-100">Pending approvals: {approvalSnapshot.pending.length}</h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-200">
            {approvalSnapshot.pending.map((item) => <li key={item.id}>{item.agent} · {item.priority} · {item.reason}</li>)}
          </ul>
        </article>
      )}

      {alerts.length > 0 && (
        <article className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <h3 className="font-semibold text-red-900 dark:text-red-100">LLMOps alerts</h3>
          <ul className="mt-2 space-y-1 text-sm text-red-800 dark:text-red-200">
            {alerts.map((alert) => <li key={alert.kind}>{alert.severity} · {alert.message}</li>)}
          </ul>
        </article>
      )}

      {batch && (
        <article className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
          <h3 className="font-semibold text-indigo-900 dark:text-indigo-100">Batch winners: {batch.winners.join(', ') || 'none'}</h3>
          <p className="mt-2 text-sm text-indigo-800 dark:text-indigo-200">Dropped: {batch.droppedIds.join(', ') || 'none'}</p>
          <ul className="mt-2 space-y-1 text-sm text-indigo-800 dark:text-indigo-200">
            {batch.results.map((item) => <li key={item.id}>{item.name} · {item.recommendation} · {item.rankingScore}</li>)}
          </ul>
        </article>
      )}

      {memoryContext && (
        <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Org memory: {memoryContext.team}</h3>
          <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">{memoryContext.summary}</p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Citations: {memoryContext.citations.join(', ') || 'none'}</p>
        </article>
      )}

      {deliverySummary && (
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-slate-50">Delivery summary</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{deliverySummary.headline}</p>
          <p className="mt-1 text-xs text-slate-500">Ready: {deliverySummary.ready ? 'yes' : 'no'} · Blockers: {deliverySummary.blockers.join(', ') || 'none'}</p>
        </article>
      )}

      {releaseDashboard && (
        <article className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900 dark:bg-cyan-950/40">
          <h3 className="font-semibold text-cyan-900 dark:text-cyan-100">Release readiness</h3>
          <p className="mt-1 text-sm text-cyan-800 dark:text-cyan-200">Ready reports: {releaseDashboard.readyCount}/{releaseDashboard.total}</p>
          <ul className="mt-2 space-y-1 text-sm text-cyan-800 dark:text-cyan-200">
            {releaseDashboard.cards.map((card) => <li key={card.label}>{`${card.label}: ${card.status}`}</li>)}
          </ul>
        </article>
      )}

      {importedEvidence && <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">{importedEvidence}</div>}

      {diffClassification && (
        <article className="rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950/40">
          <h3 className="font-semibold text-purple-900 dark:text-purple-100">Diff classifier</h3>
          <p className="mt-1 text-sm text-purple-800 dark:text-purple-200">source {diffClassification.source.length} · tests {diffClassification.tests.length} · docs {diffClassification.docs.length}</p>
          {diffAudit && <p className="mt-1 text-xs text-purple-700 dark:text-purple-300">Safe add: {diffAudit.safeAddCommands.join(' | ') || 'none'}</p>}
        </article>
      )}

      {deliveryChecklist && (
        <article className="rounded-xl border border-lime-200 bg-lime-50 p-4 dark:border-lime-900 dark:bg-lime-950/40">
          <h3 className="font-semibold text-lime-900 dark:text-lime-100">Delivery checklist: {deliveryChecklist.ready ? 'ready' : 'blocked'}</h3>
          <ul className="mt-2 space-y-1 text-sm text-lime-800 dark:text-lime-200">
            {deliveryChecklist.items.map((item) => <li key={item.label}>{`${item.label}: ${item.done ? 'done' : 'todo'}`}</li>)}
          </ul>
        </article>
      )}

      {cockpitRestore && (
        <article className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40">
          <h3 className="font-semibold text-sky-900 dark:text-sky-100">{cockpitRestore.restoreButtonLabel}</h3>
          <p className="mt-1 text-sm text-sky-800 dark:text-sky-200">{`${cockpitRestore.filters.gate ?? 'all'} · ${cockpitRestore.filters.status ?? 'all'} · ${cockpitRestore.selectedVersion ?? 'latest'}`}</p>
        </article>
      )}

      {operationsPanel && (
        <article className="rounded-xl border border-teal-200 bg-teal-50 p-4 dark:border-teal-900 dark:bg-teal-950/40">
          <h3 className="font-semibold text-teal-900 dark:text-teal-100">Release operations: {operationsPanel.latestVersion}</h3>
          <p className="mt-1 text-sm text-teal-800 dark:text-teal-200">Ready: {operationsPanel.ready ? 'yes' : 'no'}</p>
          <ul className="mt-2 space-y-1 text-sm text-teal-800 dark:text-teal-200">
            {operationsPanel.cards.map((card) => <li key={card.label}>{`${card.label}: ${card.status} · ${card.detail}`}</li>)}
          </ul>
        </article>
      )}

      {auditLedger && (
        <article className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/40">
          <h3 className="font-semibold text-orange-900 dark:text-orange-100">Proposal audit: {auditLedger.proposalId}</h3>
          <p className="mt-1 text-sm text-orange-800 dark:text-orange-200">{auditLedger.summary}</p>
          <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">Path: {auditLedger.statusPath.join(' → ') || 'none'}</p>
        </article>
      )}

      {operationsSnapshot && (
        <article className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-4 dark:border-fuchsia-900 dark:bg-fuchsia-950/40">
          <h3 className="font-semibold text-fuchsia-900 dark:text-fuchsia-100">Persisted release ops: {operationsSnapshot.payload.userId}</h3>
          <p className="mt-1 text-sm text-fuchsia-800 dark:text-fuchsia-200">{operationsSnapshot.payload.selectedTab} · {operationsSnapshot.payload.updatedAt}</p>
        </article>
      )}

      {auditTimeline && (
        <article className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40">
          <h3 className="font-semibold text-rose-900 dark:text-rose-100">Audit timeline: {auditTimeline.total}</h3>
          <p className="mt-1 text-sm text-rose-800 dark:text-rose-200">{auditTimeline.markdown}</p>
        </article>
      )}
    </section>
  );
}

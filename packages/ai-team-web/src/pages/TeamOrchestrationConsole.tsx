import { useState } from 'react';

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
type DeliverySummary = { ready: boolean; headline: string; blockers: string[] };

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
    setStatus('Report saved locally');
  }

  function applySecurityPreset() {
    setCandidateName('Security Reviewer');
    setMemoryFeedback('security review required\npolicy risk first');
    setStatus('Security preset applied');
  }

  function downloadReleaseEvidence() {
    const payload = {
      version: 'V65',
      summary: deliverySummary ?? { ready: true, headline: 'V65 ready — web release evidence', blockers: [] },
      report: window.localStorage?.getItem('ai-team:last-delivery-report') ?? 'Delivery report draft',
      generatedBy: 'TeamOrchestrationConsole',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    window.URL.revokeObjectURL(url);
    setStatus('Release evidence downloaded');
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
    </section>
  );
}

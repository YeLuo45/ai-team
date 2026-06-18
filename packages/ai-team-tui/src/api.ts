// API client for talking to the @ai-team/server
// Used by TUI to fetch/mutate data

import type { Candidate, Member, Interview, Training } from '@ai-team/core';

const DEFAULT_BASE = 'http://localhost:3000';

export class ApiClient {
  constructor(public baseUrl: string = DEFAULT_BASE) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const resp = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`API ${resp.status}: ${text}`);
    }
    if (resp.status === 204) return undefined as T;
    return (await resp.json()) as T;
  }

  health() {
    return this.request<{ status: string; dataDir: string; llmProvider: string }>('/api/health');
  }

  getTeam() {
    return this.request<{ candidates: Candidate[]; members: Member[]; interviews: Interview[]; trainings: Training[]; generatedAt: string }>('/api/team');
  }

  getStats() {
    return this.request<{
      activeMembers: number;
      totalMembers: number;
      candidates: number;
      totalInterviews: number;
      completedInterviews: number;
      avgScore: number;
      teamCounts: Record<string, number>;
    }>('/api/stats');
  }

  listCandidates() {
    return this.request<Candidate[]>('/api/candidates');
  }
  addCandidate(c: Partial<Candidate>) {
    return this.request<Candidate>('/api/candidates', { method: 'POST', body: JSON.stringify(c) });
  }
  deleteCandidate(id: string) {
    return this.request<void>(`/api/candidates/${id}`, { method: 'DELETE' });
  }

  listMembers() {
    return this.request<Member[]>('/api/members');
  }
  addMember(m: Partial<Member>) {
    return this.request<Member>('/api/members', { method: 'POST', body: JSON.stringify(m) });
  }

  listInterviews() {
    return this.request<Interview[]>('/api/interviews');
  }
  startInterview(candidateId: string, type: Interview['type']) {
    return this.request<{ interview: Interview; nextQuestion: string | null }>('/api/interviews/start', {
      method: 'POST',
      body: JSON.stringify({ candidateId, type }),
    });
  }
  submitAnswer(interviewId: string, content: string) {
    return this.request<{ interview: Interview; nextQuestion: string | null; done: boolean }>(`/api/interviews/${interviewId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }
  finalizeInterview(interviewId: string) {
    return this.request<Interview>(`/api/interviews/${interviewId}/finalize`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }
}

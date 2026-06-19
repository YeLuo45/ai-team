// Web API client — talks to @ai-team/server (with fallback to static data)

import type { Candidate, Member, Interview, Training } from '@ai-team/core';

const API_BASE = '/api';  // Vite proxy → localhost:3000, or same origin in prod

export interface TeamData {
  candidates: Candidate[];
  members: Member[];
  interviews: Interview[];
  trainings: Training[];
  generatedAt: string;
}

export class ApiClient {
  private available: boolean | null = null;

  async isAvailable(): Promise<boolean> {
    if (this.available !== null) return this.available;
    try {
      const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(1000) });
      this.available = r.ok;
    } catch {
      this.available = false;
    }
    return this.available;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const r = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
    if (r.status === 204) return undefined as T;
    return r.json() as Promise<T>;
  }

  getTeam() { return this.request<TeamData>('/team'); }
  getStats() { return this.request<{ activeMembers: number; totalMembers: number; candidates: number; totalInterviews: number; completedInterviews: number; avgScore: number; teamCounts: Record<string, number>; }>('/stats'); }

  listCandidates() { return this.request<Candidate[]>('/candidates'); }
  addCandidate(c: Partial<Candidate>) { return this.request<Candidate>('/candidates', { method: 'POST', body: JSON.stringify(c) }); }
  deleteCandidate(id: string) { return this.request<void>(`/candidates/${id}`, { method: 'DELETE' }); }
  updateCandidate(id: string, patch: Partial<Candidate>) { return this.request<Candidate>(`/candidates/${id}`, { method: 'PUT', body: JSON.stringify(patch) }); }

  listMembers() { return this.request<Member[]>('/members'); }
  addMember(m: Partial<Member>) { return this.request<Member>('/members', { method: 'POST', body: JSON.stringify(m) }); }
  deleteMember(id: string) { return this.request<void>(`/members/${id}`, { method: 'DELETE' }); }

  listInterviews() { return this.request<Interview[]>('/interviews'); }
  startInterview(candidateId: string, type: Interview['type']) {
    return this.request<{ interview: Interview; nextQuestion: string | null }>('/interviews/start', {
      method: 'POST',
      body: JSON.stringify({ candidateId, type }),
    });
  }
  submitAnswer(interviewId: string, content: string) {
    return this.request<{ interview: Interview; nextQuestion: string | null; done: boolean }>(`/interviews/${interviewId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }
  finalizeInterview(interviewId: string) {
    return this.request<Interview>(`/interviews/${interviewId}/finalize`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }
}

// Plugins
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author?: string;
  description: string;
  icon?: string;
  category?: 'integration' | 'analysis' | 'automation' | 'ui' | 'other';
  hooks: Array<{ event: string; webhookUrl?: string }>;
  configSchema?: Record<string, { type: 'string' | 'number' | 'boolean'; description: string; required?: boolean }>;
}

export interface PluginConfig {
  id: string;
  manifest: PluginManifest;
  enabled: boolean;
  config: Record<string, unknown>;
  installedAt: string;
}

export const api = new ApiClient();

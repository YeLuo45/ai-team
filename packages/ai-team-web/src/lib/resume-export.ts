// V151: Resume export helpers — convert a list of candidates into a
// downloadable JSON payload. The output preserves the Candidate fields the
// recruiting team cares about and adds a derived interviewCount for context.

import type { Candidate } from '@ai-team/core';

export interface ResumeExportRecord {
  id: string;
  name: string;
  position: string;
  email?: string;
  phone?: string;
  source: string;
  status: string;
  tags: ReadonlyArray<string>;
  skills: Array<{ skillId: string; score: number }>;
  resume?: string;
  notes?: string;
  interviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeExportPayload {
  exportedAt: string;
  count: number;
  candidates: ResumeExportRecord[];
}

/** Build the export payload for a list of candidates with their interview counts. */
export function buildResumeJsonExport(
  candidates: ReadonlyArray<Candidate>,
  interviewCountById: ReadonlyMap<string, number>,
): ResumeExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    count: candidates.length,
    candidates: candidates.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position,
      email: c.email,
      phone: c.phone,
      source: c.source,
      status: c.status,
      tags: c.tags ?? [],
      skills: (c.skills ?? []).map((s) => ({ skillId: s.skillId, score: s.score })),
      resume: c.resume,
      notes: c.notes,
      interviewCount: interviewCountById.get(c.id) ?? 0,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  };
}

/** Convert a payload to a stable pretty-printed JSON string. */
export function serializeResumeExport(payload: ResumeExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

/** Build a filename like `candidates-export-2026-07-04.json` for the download. */
export function buildResumeExportFilename(now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  return `candidates-export-${date}.json`;
}
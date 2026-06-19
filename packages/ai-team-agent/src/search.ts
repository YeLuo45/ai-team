// Search engine - cross-entity full-text search

import type { Candidate, Member, Interview, Skill } from '@ai-team/core';

export interface SearchResult {
  type: 'candidate' | 'member' | 'interview' | 'skill' | 'training' | 'review';
  id: string;
  title: string;
  subtitle?: string;
  snippet: string;
  score: number;
  link?: string;
}

export interface SearchOptions {
  type?: 'candidate' | 'member' | 'interview' | 'skill' | 'training' | 'review' | 'all';
  limit?: number;
}

export interface SearchDataInput {
  candidates: Candidate[];
  members: Member[];
  interviews: Interview[];
  skills: Skill[];
  trainings: Array<{ id: string; title: string; memberId: string; type: string; status: string; description?: string }>;
  reviews: Array<{ id: string; memberId: string; period: string; rating: number; summary: string; achievements: string[]; growthAreas: string[]; nextGoals: string[] }>;
}

/**
 * Tokenize a string into lowercase words
 */
function tokenize(s: string): string[] {
  if (!s) return [];
  return s.toLowerCase().split(/[\s,，.。!！?？;；:：]+/).filter(Boolean);
}

/**
 * Calculate search score for a text against query
 */
function scoreText(text: string, queryTokens: string[]): { score: number; snippet: string } {
  if (!text || queryTokens.length === 0) return { score: 0, snippet: '' };
  const lowerText = text.toLowerCase();
  let totalScore = 0;
  for (const token of queryTokens) {
    if (lowerText.includes(token)) {
      // Count occurrences
      const matches = (lowerText.match(new RegExp(escapeRegex(token), 'g')) || []).length;
      totalScore += matches * (matches + 1); // diminishing returns
    }
  }
  if (totalScore === 0) return { score: 0, snippet: '' };
  // Extract snippet around first match
  const firstMatch = queryTokens.find((t) => lowerText.includes(t));
  let snippet = '';
  if (firstMatch) {
    const idx = lowerText.indexOf(firstMatch);
    const start = Math.max(0, idx - 30);
    const end = Math.min(text.length, idx + firstMatch.length + 30);
    snippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
  }
  return { score: totalScore, snippet };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Search across all entities
 */
export function searchAll(query: string, data: SearchDataInput, options: SearchOptions = {}): SearchResult[] {
  const q = query.trim();
  if (!q) return [];
  const queryTokens = tokenize(q);
  if (queryTokens.length === 0) return [];

  const results: SearchResult[] = [];
  const type = options.type ?? 'all';
  const limit = options.limit ?? 50;

  if (type === 'all' || type === 'candidate') {
    for (const c of data.candidates) {
      const text = `${c.name} ${c.position} ${c.source} ${c.email ?? ''} ${c.phone ?? ''} ${(c.tags ?? []).join(' ')} ${c.resume ?? ''}`;
      const { score, snippet } = scoreText(text, queryTokens);
      if (score > 0) {
        results.push({
          type: 'candidate',
          id: c.id,
          title: c.name,
          subtitle: c.position,
          snippet: snippet || c.position,
          score,
          link: '#/candidates',
        });
      }
    }
  }

  if (type === 'all' || type === 'member') {
    for (const m of data.members) {
      const skillNames = m.skills.map((s) => s.skillId).join(' ');
      const text = `${m.name} ${m.role} ${m.team} ${m.level ?? ''} ${m.status} ${skillNames} ${m.manager ?? ''}`;
      const { score, snippet } = scoreText(text, queryTokens);
      if (score > 0) {
        results.push({
          type: 'member',
          id: m.id,
          title: m.name,
          subtitle: `${m.role} · ${m.team}`,
          snippet: snippet || m.role,
          score,
          link: '#/members',
        });
      }
    }
  }

  if (type === 'all' || type === 'interview') {
    for (const iv of data.interviews) {
      const turns = iv.turns.map((t) => t.content).join(' ');
      const text = `${iv.candidateId} ${iv.position} ${iv.type} ${iv.status} ${iv.evaluation?.summary ?? ''} ${turns}`;
      const { score, snippet } = scoreText(text, queryTokens);
      if (score > 0) {
        results.push({
          type: 'interview',
          id: iv.id,
          title: `${iv.position} 面试`,
          subtitle: `${iv.candidateId} · ${iv.status}`,
          snippet: snippet || `${iv.type} 面试 - ${iv.status}`,
          score,
          link: '#/interviews',
        });
      }
    }
  }

  if (type === 'all' || type === 'skill') {
    for (const s of data.skills) {
      const text = `${s.id} ${s.name} ${s.category} ${s.description ?? ''}`;
      const { score, snippet } = scoreText(text, queryTokens);
      if (score > 0) {
        results.push({
          type: 'skill',
          id: s.id,
          title: s.name,
          subtitle: s.category,
          snippet: snippet || s.category,
          score,
          link: '#/skills',
        });
      }
    }
  }

  if (type === 'all' || type === 'training') {
    for (const t of data.trainings) {
      const text = `${t.title} ${t.memberId} ${t.type} ${t.status} ${t.description ?? ''}`;
      const { score, snippet } = scoreText(text, queryTokens);
      if (score > 0) {
        results.push({
          type: 'training',
          id: t.id,
          title: t.title,
          subtitle: `${t.type} · ${t.status}`,
          snippet: snippet || t.title,
          score,
        });
      }
    }
  }

  if (type === 'all' || type === 'review') {
    for (const r of data.reviews) {
      const text = `${r.memberId} ${r.period} ${r.summary} ${(r.achievements ?? []).join(' ')} ${(r.growthAreas ?? []).join(' ')} ${(r.nextGoals ?? []).join(' ')}`;
      const { score, snippet } = scoreText(text, queryTokens);
      if (score > 0) {
        results.push({
          type: 'review',
          id: r.id,
          title: `${r.period} Review · ${r.rating}★`,
          subtitle: r.memberId,
          snippet: snippet || r.summary,
          score,
          link: '#/reviews',
        });
      }
    }
  }

  // Sort by score desc and limit
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Highlight matching tokens in a text by wrapping with <mark>
 */
export function highlight(text: string, query: string): string {
  if (!text || !query) return text;
  const tokens = tokenize(query);
  let result = text;
  for (const token of tokens) {
    if (token.length < 2) continue;
    result = result.replace(new RegExp(`(${escapeRegex(token)})`, 'gi'), '<mark>$1</mark>');
  }
  return result;
}

// Data loader — fetches JSON from /data/*.json (built from data/ during build)
// In a real app with a backend, this would call the API.

import type { Candidate, Member, Interview, Training, Review } from '@ai-team/core';

export interface TeamData {
  candidates: Candidate[];
  members: Member[];
  interviews: Interview[];
  trainings: Training[];
  reviews: Review[];
  generatedAt: string;
}

const FALLBACK: TeamData = {
  candidates: [],
  members: [],
  interviews: [],
  trainings: [],
  reviews: [],
  generatedAt: new Date(0).toISOString(),
};
let cache: TeamData | null = null;

export async function loadTeamData(force = false): Promise<TeamData> {
  if (cache && !force) return cache;
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}data/team.json`, {
      cache: 'no-cache',
    });
    if (!resp.ok) {
      console.warn(`team.json fetch failed: ${resp.status}`);
      return FALLBACK;
    }
    const data = (await resp.json()) as TeamData;
    cache = data;
    return data;
  } catch (err) {
    console.warn('Failed to load team data:', err);
    return FALLBACK;
  }
}

export function clearCache(): void {
  cache = null;
}

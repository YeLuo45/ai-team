// Common hook for loading team data with API + static fallback

import { useEffect, useState, useCallback } from 'react';
import { api, type TeamData } from './api';
import { loadTeamData as loadStatic } from './data';

const FALLBACK: TeamData = {
  candidates: [],
  members: [],
  interviews: [],
  trainings: [],
  generatedAt: new Date(0).toISOString(),
};

export function useTeamData() {
  const [data, setData] = useState<TeamData>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'static' | 'none'>('none');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (await api.isAvailable()) {
      try {
        const team = await api.getTeam();
        setData(team);
        setSource('api');
        setLoading(false);
        return;
      } catch (e) {
        setError((e as Error).message);
      }
    }
    // Fallback to static
    const staticData = await loadStatic();
    setData(staticData);
    setSource('static');
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, source, error, refresh };
}

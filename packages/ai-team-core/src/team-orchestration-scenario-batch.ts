// V46: Scenario Batch Runner — compare multiple candidates against one team.

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function skillCoverage(required: string[], actual: string[]): number {
  const requiredSet = unique(required.map((skill) => skill.toLowerCase()));
  if (requiredSet.length === 0) return 1;
  const actualSet = new Set(unique(actual.map((skill) => skill.toLowerCase())));
  const matched = requiredSet.filter((skill) => actualSet.has(skill)).length;
  return +(matched / requiredSet.length).toFixed(4);
}
export interface BatchCandidate {
  id: string;
  name: string;
  candidateSkills: string[];
  trainingHours: number;
}

export interface BatchRankingStrategy {
  ranking?: 'coverage_then_score' | 'training_then_score';
}

export interface BatchRunnerInput extends BatchRankingStrategy {
  teamName: string;
  currentHeadcount: number;
  targetHeadcount: number;
  requiredSkills: string[];
  currentSkills: string[];
  candidates: BatchCandidate[];
}

export interface BatchResultEntry {
  id: string;
  name: string;
  skillCoverageDelta: number;
  rankingScore: number;
  recommendation: string;
}

export interface ScenarioBatchResult {
  results: BatchResultEntry[];
  winners: string[];
  droppedIds: string[];
}

export function buildScenarioBatch(input: BatchRunnerInput): ScenarioBatchResult {
  const currentUnique = unique(input.currentSkills);
  const headcountDelta = input.targetHeadcount - input.currentHeadcount;
  const slots = Math.max(0, headcountDelta);
  const enriched = input.candidates.map((candidate) => {
    const afterSkills = unique([...input.currentSkills, ...candidate.candidateSkills]);
    const coverageBefore = skillCoverage(input.requiredSkills, currentUnique);
    const coverageAfter = skillCoverage(input.requiredSkills, afterSkills);
    const coverageDelta = +(coverageAfter - coverageBefore).toFixed(4);
    const trainingBonus = candidate.trainingHours <= 12 ? Math.max(0, 20 - candidate.trainingHours) : 0;
    const rankingScore = +(coverageDelta * 100 + coverageBefore * 50 + trainingBonus).toFixed(2);
    const recommendation = coverageDelta > 0
      ? slots > 0 ? 'hire_to_close_gap' : 'fit_existing_role'
      : candidate.trainingHours <= 12
        ? 'train_existing_team'
        : 'revisit_scope';
    return {
      id: candidate.id,
      name: candidate.name,
      skillCoverageDelta: coverageDelta,
      rankingScore,
      recommendation,
    };
  });
  enriched.sort((a, b) => {
    if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
    return a.id.localeCompare(b.id);
  });
  if (slots === 0) {
    const fits = enriched.filter((entry) => entry.recommendation === 'train_existing_team' || entry.recommendation === 'fit_existing_role');
    return { results: enriched, winners: fits.map((entry) => entry.id), droppedIds: [] };
  }
  const positive = enriched.filter((entry) => entry.skillCoverageDelta > 0 && entry.recommendation !== 'revisit_scope');
  const winnerCount = Math.min(positive.length, 1);
  const winners = positive.slice(0, winnerCount).map((entry) => entry.id);
  const winnerSet = new Set(winners);
  const dropped = positive.filter((entry) => !winnerSet.has(entry.id)).map((entry) => entry.id);
  return { results: enriched, winners, droppedIds: dropped };
}

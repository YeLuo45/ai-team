// Skill domain type — basic skill definitions

export type SkillCategory = 'technical' | 'soft' | 'domain' | 'tool';

export interface Skill {
  id: string;             // sk_xxx
  name: string;
  category: SkillCategory;
  description?: string;
}

export interface SkillScore {
  skillId: string;
  score: number;          // 0-100
  evidence?: string;
  assessedAt: string;     // ISO timestamp
}

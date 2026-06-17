// Member domain type

import type { SkillScore } from './skill.js';
import type { Training } from './training.js';
import type { Review } from './review.js';

export type MemberStatus = 'active' | 'on_leave' | 'exited';

export type MemberLevel = 'intern' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8' | 'P9';

export interface Member {
  id: string;             // mb_YYYYMMDD-XXX
  candidateId?: string;
  name: string;
  role: string;
  team: string;
  joinedAt: string;
  manager?: string;
  level?: MemberLevel;
  skills: SkillScore[];
  trainings: Training[];
  reviews: Review[];
  status: MemberStatus;
  bio?: string;
  avatar?: string;
}

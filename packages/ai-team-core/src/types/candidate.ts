// Candidate domain type

import type { SkillScore } from './skill.js';

export type CandidateStatus =
  | 'new'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'hired'
  | 'rejected';

export type CandidateSource =
  | 'linkedin'
  | 'referral'
  | 'website'
  | 'recruiter'
  | 'job_board'
  | 'other';

export interface Candidate {
  id: string;             // ct_YYYYMMDD-XXX
  name: string;
  email?: string;
  phone?: string;
  position: string;
  resume?: string;
  source: CandidateSource;
  status: CandidateStatus;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  skills?: SkillScore[];
  notes?: string;
}

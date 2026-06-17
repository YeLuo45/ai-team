// Training domain type

export type TrainingType = 'course' | 'mentoring' | 'project' | 'reading' | 'certification';
export type TrainingStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface Milestone {
  title: string;
  completedAt?: string;
  notes?: string;
}

export interface Training {
  id: string;             // tr_xxx
  memberId: string;
  skillId: string;
  type: TrainingType;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  progress: number;       // 0-100
  status: TrainingStatus;
  milestones: Milestone[];
  aiRecommended?: boolean;
}

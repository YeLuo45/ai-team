// Review domain type

export type ReviewRating = 1 | 2 | 3 | 4 | 5;

export interface Review {
  id: string;             // rv_xxx
  memberId: string;
  period: string;         // "2026-Q2"
  rating: ReviewRating;
  summary: string;
  achievements: string[];
  growthAreas: string[];
  nextGoals: string[];
  reviewer?: string;
  reviewedAt: string;     // ISO timestamp
}

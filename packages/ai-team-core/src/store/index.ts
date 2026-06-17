// Domain-specific stores

import { JsonStore } from './json-store.js';
import type { Candidate } from '../types/candidate.js';
import type { Member } from '../types/member.js';
import type { Interview } from '../types/interview.js';
import type { Training } from '../types/training.js';
import type { Review } from '../types/review.js';

export class CandidateStore extends JsonStore<Candidate> {
  static create(baseDir: string): CandidateStore {
    return new CandidateStore({ baseDir, fileName: 'candidates.json' });
  }
}

export class MemberStore extends JsonStore<Member> {
  static create(baseDir: string): MemberStore {
    return new MemberStore({ baseDir, fileName: 'members.json' });
  }
}

export class InterviewStore extends JsonStore<Interview> {
  static create(baseDir: string): InterviewStore {
    return new InterviewStore({ baseDir, fileName: 'interviews.json' });
  }
}

export class TrainingStore extends JsonStore<Training> {
  static create(baseDir: string): TrainingStore {
    return new TrainingStore({ baseDir, fileName: 'trainings.json' });
  }
}

export class ReviewStore extends JsonStore<Review> {
  static create(baseDir: string): ReviewStore {
    return new ReviewStore({ baseDir, fileName: 'reviews.json' });
  }
}

export interface TeamData {
  candidates: Candidate[];
  members: Member[];
  interviews: Interview[];
  trainings: Training[];
  reviews: Review[];
}

export { JsonStore } from './json-store.js';

// Interview domain type

export type InterviewType =
  | 'phone'         // 电话初筛
  | 'technical'     // 技术面
  | 'behavioral'    // 行为面
  | 'system_design' // 系统设计
  | 'final'         // 终面
  | 'culture';      // 文化面

export type InterviewStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type Recommendation =
  | 'strong_hire'
  | 'hire'
  | 'no_hire'
  | 'strong_no_hire';

export interface InterviewTurn {
  role: 'interviewer' | 'candidate';
  content: string;
  timestamp: string;        // ISO timestamp
  skillAssessed?: string[]; // 评估的技能 ID
}

export interface EvaluationBreakdown {
  technical: number;        // 0-100
  communication: number;
  problemSolving: number;
  culture: number;
}

export interface Evaluation {
  overall: number;          // 0-100
  breakdown: EvaluationBreakdown;
  strengths: string[];
  concerns: string[];
  recommendation: Recommendation;
  summary: string;
  evaluatedAt: string;      // ISO timestamp
  modelUsed?: string;       // LLM model name
}

export interface Interview {
  id: string;               // iv_YYYYMMDD-XXX
  candidateId: string;
  position: string;
  type: InterviewType;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  status: InterviewStatus;
  turns: InterviewTurn[];
  evaluation?: Evaluation;
  aiConducted: boolean;
  interviewerName?: string; // human or 'AI'
}

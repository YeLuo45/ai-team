// Mock client for testing/demo without API key

import type {
  LLMClient,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ChatStreamChunk,
} from '../types.js';

export class MockClient implements LLMClient {
  private turn = 0;
  constructor() {
    // deterministic mock — no random state
  }

  private mockInterviewTurn(messages: ChatMessage[]): string {
    this.turn++;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const userText = lastUser?.content ?? '';

    // If it looks like asking for evaluation (last turn with summary request)
    if (userText.includes('评估') || userText.includes('evaluate') || this.turn >= 6) {
      return JSON.stringify({
        overall: 78,
        breakdown: {
          technical: 75,
          communication: 85,
          problemSolving: 80,
          culture: 72,
        },
        strengths: [
          '项目经验清晰，能用 STAR 法则讲完整',
          '对性能优化有实操经验',
          '团队协作意识强',
        ],
        concerns: [
          '系统设计深度可进一步加强',
          '对前端工程化细节了解有限',
        ],
        recommendation: 'hire',
        summary: '候选人具备扎实的前端基础和良好的沟通能力，建议进入下一轮。',
      });
    }

    // Interviewer questions
    const questions = [
      '请简单介绍一下你最近做的一个项目，你在其中承担什么角色？',
      '你遇到过最有挑战性的技术问题是什么？你是如何解决的？',
      '如果我们有一个日 PV 千万级的页面需要优化首屏性能，你会从哪些方面入手？',
      '请描述一下你对前端工程化的理解，以及你在团队中是怎么实践的？',
      '你希望在下一个岗位上获得什么样的成长？',
    ];
    return questions[Math.min(this.turn - 1, questions.length - 1)];
  }

  private mockTrainingPlan(messages: ChatMessage[]): string {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const text = lastUser?.content ?? '';
    if (text.includes('JSON')) {
      return JSON.stringify({
        goals: ['提升系统设计能力', '补齐 Kubernetes 实战经验', '加强团队管理'],
        trainings: [
          {
            title: '系统设计精进',
            type: 'course',
            durationWeeks: 8,
            resources: ['DDIA 读书会', 'High Scalability 案例分析'],
          },
          {
            title: 'Kubernetes 实战',
            type: 'project',
            durationWeeks: 12,
            resources: ['在生产环境部署一个 K8s 集群'],
          },
          {
            title: '新晋经理训练营',
            type: 'mentoring',
            durationWeeks: 16,
            resources: ['1:1 with senior manager'],
          },
        ],
        expectedGrowth: '6 个月内可独立负责中等规模项目',
      });
    }
    return '已根据该成员当前技能和岗位目标生成 3 项培训计划，请稍后查看 JSON 详情。';
  }

  private isTrainingContext(messages: ChatMessage[]): boolean {
    return messages.some((m) => m.content.includes('培训') || m.content.includes('training'));
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const content = this.isTrainingContext(req.messages)
      ? this.mockTrainingPlan(req.messages)
      : this.mockInterviewTurn(req.messages);

    return {
      content,
      model: 'mock-1.0',
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      finishReason: 'stop',
    };
  }

  async chatStream(req: ChatRequest, onChunk: (c: ChatStreamChunk) => void): Promise<ChatResponse> {
    const resp = await this.chat(req);
    onChunk({ delta: resp.content, done: true });
    return resp;
  }
}

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
    this.turn++;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const text = lastUser?.content ?? '';
    if (!text.includes('培训') && !text.includes('training') && !text.includes('JSON')) {
      return this.mockInterviewTurn(messages);
    }
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

  private isTrainingContext(messages: ChatMessage[]): boolean {
    return messages.some((m) => m.content.includes('培训') || m.content.includes('training'));
  }

  private isReviewContext(messages: ChatMessage[]): boolean {
    return messages.some((m) => m.content.includes('Review') || m.content.includes('绩效') || m.content.includes('评估'));
  }

  private isOneOnOneContext(messages: ChatMessage[]): boolean {
    return messages.some((m) => m.content.includes('1:1') || m.content.includes('扮演') || m.content.includes('近况'));
  }

  private isResumeContext(messages: ChatMessage[]): boolean {
    return messages.some((m) => m.content.includes('简历解析助手') || m.content.includes('候选人简历') || m.content.includes('岗位匹配'));
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    // Check specific contexts first
    const content = this.isReviewContext(req.messages)
      ? JSON.stringify({
          rating: 4,
          summary: '该成员本季度表现稳定，技术能力扎实，项目交付及时。沟通协作良好，能主动帮助团队成员解决问题。建议下季度承担更具挑战性的项目。',
          achievements: [
            '完成核心模块重构，代码质量提升 30%',
            '主导跨团队协作项目，按时交付',
            '主动分享技术经验，辅导 2 名 junior 工程师',
          ],
          growthAreas: [
            '系统设计能力可进一步提升（特别是大规模分布式场景）',
            '建议加强技术影响力建设（如内部分享、博客）',
          ],
          nextGoals: [
            '主导一个中规模系统设计项目（Q3）',
            '完成 Kubernetes 认证培训',
            '每月 1 次内部分享',
          ],
        })
      : this.isResumeContext(req.messages)
        ? this.mockResume(req.messages)
        : this.isOneOnOneContext(req.messages)
          ? this.mockOneOnOne(req.messages)
          : this.isTrainingContext(req.messages)
            ? this.mockTrainingPlan(req.messages)
            : this.mockInterviewTurn(req.messages);

    return {
      content,
      model: 'mock-1.0',
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      finishReason: 'stop',
    };
  }

  private mockResume(messages: ChatMessage[]): string {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const text = lastUser?.content ?? '';
    // Detect score request vs extract request
    if (text.includes('岗位描述') || text.includes('匹配度') || text.includes('overallScore')) {
      return JSON.stringify({
        overallScore: 82,
        matchLevel: 'good',
        strengths: ['技能匹配度高', '有相关项目经验', '团队协作意识强'],
        concerns: ['大规模系统设计经验有限', '需要补充云原生经验'],
        recommendations: ['重点考察系统设计能力', '入职后安排 Kubernetes 培训'],
      });
    }
    // Extract request
    return JSON.stringify({
      name: '张三',
      email: 'zhangsan@example.com',
      phone: '13800138000',
      position: '前端工程师',
      yearsOfExperience: 5,
      skills: ['React', 'TypeScript', 'Node.js', 'JavaScript', 'Webpack', 'CSS', 'HTML', 'Git'],
      experience: [
        {
          company: '某科技公司',
          role: '高级前端工程师',
          duration: '2021-2026',
          highlights: ['主导核心业务前端架构', '性能优化提升 40%', '团队 5 人管理'],
        },
        {
          company: '某创业公司',
          role: '前端工程师',
          duration: '2019-2021',
          highlights: ['从 0 到 1 搭建产品', '独立完成 React 项目'],
        },
      ],
      education: [
        {
          school: '某大学',
          degree: '本科',
          major: '计算机科学',
          graduationYear: 2019,
        },
      ],
      summary: '5 年 React 全栈开发经验，擅长性能优化和团队协作。',
    });
  }

  private mockOneOnOne(messages: ChatMessage[]): string {
    this.turn++;
    const turns = messages.filter((m) => m.role === 'assistant').length;
    const responses = [
      '最近工作挺充实的，主要在做新功能开发。',
      '嗯，最近遇到一些挑战，特别是在系统设计方面，感觉有些吃力。',
      '我希望能在技术深度上更进一步，未来想往架构师方向发展。',
      '关于培训，我觉得可以参加一些系统设计的课程，还有 Kubernetes 实战。',
      '谢谢经理的理解和支持，我会努力的。',
      '我对自己下一个季度挺有信心的，希望能有所突破。',
      '好的，那我们保持沟通，下次再聊。',
    ];
    return responses[Math.min(turns, responses.length - 1)];
  }

  async chatStream(req: ChatRequest, onChunk: (c: ChatStreamChunk) => void): Promise<ChatResponse> {
    const resp = await this.chat(req);
    onChunk({ delta: resp.content, done: true });
    return resp;
  }
}

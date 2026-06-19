// Resume Agent - PDF parse + LLM extraction + scoring

import { LLMClient } from '@ai-team/ai';
import { generateId, nowIso, type Candidate } from '@ai-team/core';

export interface ExtractedResume {
  name: string;
  email?: string;
  phone?: string;
  position: string;
  yearsOfExperience?: number;
  skills: string[];
  experience: Array<{
    company: string;
    role: string;
    duration: string;
    highlights: string[];
  }>;
  education: Array<{
    school: string;
    degree: string;
    major?: string;
    graduationYear?: number;
  }>;
  summary?: string;
  rawTextLength: number;
}

export interface JobMatch {
  overallScore: number;        // 0-100
  matchLevel: 'excellent' | 'good' | 'partial' | 'poor';
  strengths: string[];
  concerns: string[];
  recommendations: string[];
}

export class ResumeAgent {
  constructor(private llm: LLMClient, private opts: { model?: string } = {}) {}

  /**
   * Extract structured data from raw resume text using LLM
   */
  async extract(rawText: string): Promise<ExtractedResume> {
    if (!rawText.trim()) {
      throw new Error('Empty resume text');
    }
    const messages = [
      {
        role: 'system' as const,
        content: `你是一个专业的 HR 简历解析助手。从候选人简历文本中提取结构化信息。只输出严格的 JSON 格式，不要任何解释。`,
      },
      {
        role: 'user' as const,
        content: `简历文本:
${rawText.slice(0, 6000)}

请提取以下 JSON:
{
  "name": "候选人姓名",
  "email": "邮箱 (如有)",
  "phone": "电话 (如有)",
  "position": "当前/期望岗位",
  "yearsOfExperience": 工作年数 (数字, 可选),
  "skills": ["技能1", "技能2", ...],
  "experience": [
    { "company": "公司", "role": "岗位", "duration": "时间段 (如 '2020-2023')", "highlights": ["亮点1", "亮点2"] }
  ],
  "education": [
    { "school": "学校", "degree": "学位", "major": "专业", "graduationYear": 2020 }
  ],
  "summary": "一段话总结候选人背景"
}

要求:
- 找不到的字段设为 null 或省略
- skills 提取 5-15 个关键技术栈
- experience 提取最近 2-3 段工作经历
- 使用中文输出`,
      },
    ];

    const resp = await this.llm.chat({
      messages,
      ...(this.opts.model && { model: this.opts.model }),
      temperature: 0.2,
    });
    return this.parseExtract(resp.content, rawText);
  }

  /**
   * Score a resume against a job description
   */
  async scoreMatch(resume: ExtractedResume, jobDescription: string, position: string): Promise<JobMatch> {
    // Normalize resume fields
    const safeResume: ExtractedResume = {
      ...resume,
      skills: resume.skills ?? [],
      experience: resume.experience ?? [],
      education: resume.education ?? [],
    };
    const messages = [
      {
        role: 'system' as const,
        content: `你是一位资深的招聘 HR 专家。基于候选人简历和岗位描述进行客观打分。只输出严格的 JSON 格式。`,
      },
      {
        role: 'user' as const,
        content: `岗位: ${position}
岗位描述:
${jobDescription.slice(0, 2000)}

候选人简历:
- 姓名: ${safeResume.name}
- 当前岗位: ${safeResume.position}
- 工作年限: ${safeResume.yearsOfExperience ?? '未知'} 年
- 技能: ${safeResume.skills.join(', ') || '（无）'}
- 经验: ${safeResume.experience.map((e) => `${e.role} @ ${e.company} (${e.duration})`).join('; ') || '（无）'}

请输出 JSON:
{
  "overallScore": 0-100 的整数,
  "matchLevel": "excellent | good | partial | poor",
  "strengths": ["匹配的亮点 1", "亮点 2"],
  "concerns": ["不足 1", "不足 2"],
  "recommendations": ["面试重点关注 1", "建议 2"]
}`,
      },
    ];

    const resp = await this.llm.chat({
      messages,
      ...(this.opts.model && { model: this.opts.model }),
      temperature: 0.3,
    });
    return this.parseScore(resp.content);
  }

  /**
   * Convert extracted resume to a Candidate record
   */
  toCandidate(resume: ExtractedResume, _source: 'pdf' | 'pasted' = 'pasted'): Candidate {
    void _source;
    const candidate: Candidate = {
      id: generateId('ct'),
      name: resume.name,
      position: resume.position,
      source: 'referral',  // mark as referral since it came through resume
      status: 'new',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      tags: resume.skills.slice(0, 6),
      resume: resume.summary ?? `${resume.position} - ${resume.yearsOfExperience ?? '?'} 年经验`,
    };
    if (resume.email) candidate.email = resume.email;
    if (resume.phone) candidate.phone = resume.phone;
    return candidate;
  }

  private parseExtract(content: string, rawText: string): ExtractedResume {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback: return minimal extraction
      return {
        name: '未识别',
        position: '未指定',
        skills: [],
        experience: [],
        education: [],
        rawTextLength: rawText.length,
      };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      name: String(parsed.name ?? '未识别'),
      position: String(parsed.position ?? '未指定'),
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experience: Array.isArray(parsed.experience) ? parsed.experience.map((e: Record<string, unknown>) => ({
        company: String(e.company ?? ''),
        role: String(e.role ?? ''),
        duration: String(e.duration ?? ''),
        highlights: Array.isArray(e.highlights) ? e.highlights.map(String) : [],
      })) : [],
      education: Array.isArray(parsed.education) ? parsed.education.map((e: Record<string, unknown>) => {
        const edu: { school: string; degree: string; major?: string; graduationYear?: number } = {
          school: String(e.school ?? ''),
          degree: String(e.degree ?? ''),
        };
        if (e.major) edu.major = String(e.major);
        if (e.graduationYear) edu.graduationYear = Number(e.graduationYear);
        return edu;
      }) : [],
      rawTextLength: rawText.length,
    };
  }

  private parseScore(content: string): JobMatch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        overallScore: 50,
        matchLevel: 'partial',
        strengths: [],
        concerns: [],
        recommendations: ['AI 评估失败，请人工审核'],
      };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.overallScore) || 50)));
    const level = ['excellent', 'good', 'partial', 'poor'].includes(parsed.matchLevel) ? parsed.matchLevel :
      score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'partial' : 'poor';
    return {
      overallScore: score,
      matchLevel: level as JobMatch['matchLevel'],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  }
}

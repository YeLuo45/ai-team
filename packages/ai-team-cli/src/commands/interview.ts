// `ai-team interview ...` subcommands

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { Command } from 'commander';
import { CandidateStore, InterviewStore } from '@ai-team/core';
import { createFromEnv } from '@ai-team/ai';
import { InterviewAgent } from '@ai-team/agent';
import { c, DEFAULT_DATA_DIR } from '../utils.js';

export function registerInterviewCommands(program: Command): void {
  const cmd = program.command('interview').description('面试管理');

  cmd
    .command('start <candidateId>')
    .description('启动 AI 面试（多轮对话）')
    .option('-t, --type <type>', '面试类型 (phone/technical/behavioral/system_design/final/culture)', 'technical')
    .option('--max-turns <n>', '最大轮次', '8')
    .action(async (candidateId: string, opts) => {
      const candStore = CandidateStore.create(DEFAULT_DATA_DIR);
      const ivStore = InterviewStore.create(DEFAULT_DATA_DIR);
      const candidate = await candStore.get(candidateId);
      if (!candidate) {
        console.error(c.err(`候选人 ${candidateId} 不存在`));
        process.exit(1);
      }

      const llm = createFromEnv();
      const agent = new InterviewAgent(llm, { maxTurns: parseInt(opts.maxTurns, 10) });
      const session = agent.start(candidate, { type: opts.type });

      const rl = readline.createInterface({ input, output });

      console.log(c.info(`开始面试：${candidate.name} -> ${candidate.position} (${opts.type})`));
      console.log(c.dim('─'.repeat(60)));

      try {
        // First question
        const q1 = await session.nextQuestion();
        console.log(c.bold('\n面试官: ') + q1);

        while (!session.isComplete()) {
          const answer = await rl.question(c.bold('\n你: '));
          if (!answer.trim()) {
            console.log(c.warn('回答不能为空，请重新输入'));
            continue;
          }
          const nextQ = await session.submitAnswer(answer);
          if (nextQ === null) {
            break;
          }
          console.log(c.bold('\n面试官: ') + nextQ);
        }

        // Finalize
        console.log(c.dim('\n─'.repeat(60)));
        console.log(c.info('生成评估中...'));
        const evaluation = await session.finalize();
        const completedAt = new Date().toISOString();
        const finalInterview = {
          ...session.interview,
          status: 'completed' as const,
          completedAt,
          evaluation,
        };
        await ivStore.add(finalInterview);

        // Update candidate status
        await candStore.update(candidateId, {
          status: 'interviewing',
          updatedAt: completedAt,
        });

        console.log(c.ok(`面试完成：${finalInterview.id}`));
        console.log('');
        console.log(c.bold('评估结果:'));
        console.log(`  总分: ${c.bold(String(evaluation.overall))}/100`);
        console.log(`  技术: ${evaluation.breakdown.technical} | 沟通: ${evaluation.breakdown.communication} | 解决问题: ${evaluation.breakdown.problemSolving} | 文化: ${evaluation.breakdown.culture}`);
        console.log(`  推荐: ${c.bold(formatRecommendation(evaluation.recommendation))}`);
        console.log(`  总结: ${evaluation.summary}`);
        if (evaluation.strengths.length > 0) {
          console.log('  优势:');
          evaluation.strengths.forEach((s) => console.log(`    - ${s}`));
        }
        if (evaluation.concerns.length > 0) {
          console.log('  顾虑:');
          evaluation.concerns.forEach((s) => console.log(`    - ${s}`));
        }
      } finally {
        rl.close();
      }
    });

  cmd
    .command('list')
    .description('列出所有面试')
    .option('--candidate <id>', '按候选人过滤')
    .action(async (opts) => {
      const store = InterviewStore.create(DEFAULT_DATA_DIR);
      const all = await store.list();
      const filtered = opts.candidate ? all.filter((i) => i.candidateId === opts.candidate) : all;
      if (filtered.length === 0) {
        console.log(c.dim('（暂无面试记录）'));
        return;
      }
      for (const iv of filtered) {
        const score = iv.evaluation?.overall ?? '-';
        const rec = iv.evaluation ? formatRecommendation(iv.evaluation.recommendation) : '-';
        console.log(`${c.bold(iv.id)} | 候选人 ${iv.candidateId} | 岗位 ${iv.position} | 状态 ${iv.status} | 评分 ${score} | ${rec}`);
      }
    });

  cmd
    .command('show <id>')
    .description('查看面试详情')
    .action(async (id: string) => {
      const store = InterviewStore.create(DEFAULT_DATA_DIR);
      const iv = await store.get(id);
      if (!iv) {
        console.error(c.err(`面试 ${id} 不存在`));
        process.exit(1);
      }
      console.log(c.bold(`${iv.id}`) + ` - ${iv.type} (${iv.status})`);
      console.log(`  候选人: ${iv.candidateId}`);
      console.log(`  岗位: ${iv.position}`);
      if (iv.startedAt) console.log(`  开始: ${iv.startedAt}`);
      if (iv.completedAt) console.log(`  结束: ${iv.completedAt}`);
      console.log(`  轮次: ${iv.turns.length}`);
      console.log('');
      console.log(c.bold('对话:'));
      iv.turns.forEach((t, i) => {
        const label = t.role === 'interviewer' ? c.bold('面试官') : c.bold('候选人');
        console.log(`  [${i + 1}] ${label}: ${t.content}`);
      });
      if (iv.evaluation) {
        console.log('');
        console.log(c.bold('评估:'));
        console.log(`  总分: ${iv.evaluation.overall}/100`);
        console.log(`  推荐: ${formatRecommendation(iv.evaluation.recommendation)}`);
        console.log(`  总结: ${iv.evaluation.summary}`);
      }
    });
}

function formatRecommendation(r: string): string {
  const map: Record<string, string> = {
    strong_hire: '强烈推荐 (strong_hire)',
    hire: '推荐 (hire)',
    no_hire: '不推荐 (no_hire)',
    strong_no_hire: '强烈不推荐 (strong_no_hire)',
  };
  return map[r] ?? r;
}

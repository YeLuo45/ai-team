// `ai-team team ...` subcommands

import type { Command } from 'commander';
import { CandidateStore, MemberStore, InterviewStore } from '@ai-team/core';
import { c, DEFAULT_DATA_DIR } from '../utils.js';

export function registerTeamCommands(program: Command): void {
  const cmd = program.command('team').description('团队管理');

  cmd
    .command('overview')
    .description('显示团队概览统计')
    .action(async () => {
      const cStore = CandidateStore.create(DEFAULT_DATA_DIR);
      const mStore = MemberStore.create(DEFAULT_DATA_DIR);
      const iStore = InterviewStore.create(DEFAULT_DATA_DIR);

      const [candidates, members, interviews] = await Promise.all([
        cStore.list(),
        mStore.list(),
        iStore.list(),
      ]);

      const now = new Date();
      const thisMonth = now.toISOString().slice(0, 7);
      const interviewsThisMonth = interviews.filter((i) => i.startedAt?.startsWith(thisMonth));
      const completedInterviews = interviews.filter((i) => i.status === 'completed');
      const avgScore =
        completedInterviews.length > 0
          ? Math.round(
              completedInterviews.reduce((sum, i) => sum + (i.evaluation?.overall ?? 0), 0) /
                completedInterviews.length
            )
          : 0;

      const teamCounts = new Map<string, number>();
      for (const m of members) {
        if (m.status === 'active') {
          teamCounts.set(m.team, (teamCounts.get(m.team) ?? 0) + 1);
        }
      }

      console.log(c.bold('━━━ 团队概览 ━━━'));
      console.log(`  成员数: ${c.bold(String(members.filter((m) => m.status === 'active').length))} (总计 ${members.length})`);
      console.log(`  候选人数: ${c.bold(String(candidates.length))}`);
      console.log(`  面试数: ${c.bold(String(interviews.length))} (本月新增 ${interviewsThisMonth.length})`);
      console.log(`  平均面试评分: ${c.bold(String(avgScore))}/100`);

      if (teamCounts.size > 0) {
        console.log('');
        console.log(c.bold('团队分布:'));
        for (const [team, count] of teamCounts) {
          console.log(`  ${team}: ${count} 人`);
        }
      }

      if (completedInterviews.length > 0) {
        console.log('');
        console.log(c.bold('最近面试 (Top 5):'));
        const recent = [...completedInterviews]
          .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
          .slice(0, 5);
        for (const iv of recent) {
          const score = iv.evaluation?.overall ?? 0;
          console.log(`  ${iv.id} | 候选人 ${iv.candidateId} | 评分 ${score}/100 | ${iv.completedAt?.slice(0, 10) ?? '-'}`);
        }
      }
    });

  cmd
    .command('skills')
    .description('展示团队技能分布')
    .action(async () => {
      const mStore = MemberStore.create(DEFAULT_DATA_DIR);
      const members = await mStore.list();
      const skillScores = new Map<string, { total: number; count: number }>();
      for (const m of members) {
        for (const s of m.skills) {
          const cur = skillScores.get(s.skillId) ?? { total: 0, count: 0 };
          cur.total += s.score;
          cur.count += 1;
          skillScores.set(s.skillId, cur);
        }
      }
      if (skillScores.size === 0) {
        console.log(c.dim('（暂无技能数据）'));
        return;
      }
      const sorted = [...skillScores.entries()]
        .map(([k, v]) => ({ skill: k, avg: Math.round(v.total / v.count), count: v.count }))
        .sort((a, b) => b.avg - a.avg);
      console.log(c.bold('团队技能平均分:'));
      for (const s of sorted) {
        console.log(`  ${s.skill}: ${s.avg}/100 (${s.count} 人)`);
      }
    });
}

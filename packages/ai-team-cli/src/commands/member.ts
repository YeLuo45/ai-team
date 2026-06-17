// `ai-team member ...` subcommands

import type { Command } from 'commander';
import { MemberStore, TrainingStore, generateId, nowIso } from '@ai-team/core';
import type { MemberLevel, MemberStatus, TrainingType, TrainingStatus } from '@ai-team/core';
import { c, printTable, DEFAULT_DATA_DIR } from '../utils.js';

export function registerMemberCommands(program: Command): void {
  const cmd = program.command('member').description('成员管理');

  cmd
    .command('add <name>')
    .description('添加团队成员')
    .requiredOption('-r, --role <role>', '职位')
    .requiredOption('-t, --team <team>', '团队')
    .option('-l, --level <level>', '职级 (P3-P9/intern)')
    .option('-m, --manager <name>', '经理')
    .option('--bio <bio>', '简介')
    .action(async (name: string, opts) => {
      const store = MemberStore.create(DEFAULT_DATA_DIR);
      const level = opts.level as MemberLevel | undefined;
      const validLevels: MemberLevel[] = ['intern', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];
      if (level && !validLevels.includes(level)) {
        console.error(c.err(`无效 level: ${level}，可选: ${validLevels.join(', ')}`));
        process.exit(1);
      }
      const member = {
        id: generateId('mb'),
        name,
        role: opts.role,
        team: opts.team,
        joinedAt: nowIso(),
        skills: [],
        trainings: [],
        reviews: [],
        status: 'active' as MemberStatus,
        ...(level && { level }),
        ...(opts.manager && { manager: opts.manager }),
        ...(opts.bio && { bio: opts.bio }),
      };
      await store.add(member);
      console.log(c.ok(`成员 ${name} 已创建：${c.bold(member.id)}`));
    });

  cmd
    .command('list')
    .description('列出所有成员')
    .option('--team <team>', '按团队过滤')
    .option('--status <status>', '按状态过滤 (active/on_leave/exited)')
    .action(async (opts) => {
      const store = MemberStore.create(DEFAULT_DATA_DIR);
      const all = await store.list();
      const filtered = all.filter(
        (m) => (!opts.team || m.team === opts.team) && (!opts.status || m.status === opts.status)
      );
      if (filtered.length === 0) {
        console.log(c.dim('（暂无成员，使用 `ai-team member add` 添加）'));
        return;
      }
      printTable(
        filtered.map((m) => ({
          id: m.id,
          name: m.name,
          team: m.team,
          role: m.role,
          level: m.level ?? '-',
          status: m.status,
        }))
      );
    });

  cmd
    .command('show <id>')
    .description('查看成员详情')
    .action(async (id: string) => {
      const store = MemberStore.create(DEFAULT_DATA_DIR);
      const m = await store.get(id);
      if (!m) {
        console.error(c.err(`成员 ${id} 不存在`));
        process.exit(1);
      }
      console.log(c.bold(m.name) + ` (${m.id})`);
      console.log(`  团队: ${m.team} | 角色: ${m.role}${m.level ? ' | 职级: ' + m.level : ''}`);
      console.log(`  状态: ${m.status} | 入职: ${m.joinedAt}`);
      if (m.manager) console.log(`  经理: ${m.manager}`);
      if (m.bio) console.log(`  简介: ${m.bio}`);
      if (m.skills.length > 0) {
        console.log(`  技能: ${m.skills.map((s) => `${s.skillId}=${s.score}`).join(', ')}`);
      }
    });

  cmd
    .command('train <memberId>')
    .description('为成员添加培训计划')
    .requiredOption('--title <title>', '培训标题')
    .requiredOption('--skill <skillId>', '关联技能 ID')
    .option('--type <type>', '类型 (course/mentoring/project/reading/certification)', 'course')
    .option('--description <desc>', '描述')
    .option('--duration-weeks <n>', '周数', '4')
    .action(async (memberId: string, opts) => {
      const memberStore = MemberStore.create(DEFAULT_DATA_DIR);
      const trainStore = TrainingStore.create(DEFAULT_DATA_DIR);
      const member = await memberStore.get(memberId);
      if (!member) {
        console.error(c.err(`成员 ${memberId} 不存在`));
        process.exit(1);
      }
      const type = opts.type as TrainingType;
      const validTypes: TrainingType[] = ['course', 'mentoring', 'project', 'reading', 'certification'];
      if (!validTypes.includes(type)) {
        console.error(c.err(`无效 type: ${type}，可选: ${validTypes.join(', ')}`));
        process.exit(1);
      }
      const weeks = parseInt(opts.durationWeeks, 10);
      const startDate = nowIso();
      const endDate = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
      const training = {
        id: generateId('tr'),
        memberId,
        skillId: opts.skill,
        type,
        title: opts.title,
        description: opts.description ?? `${opts.title} (${weeks} 周)`,
        startDate,
        endDate,
        progress: 0,
        status: 'planned' as TrainingStatus,
        milestones: [
          { title: '启动' },
          { title: '中期回顾' },
          { title: '完成验收' },
        ],
      };
      await trainStore.add(training);
      console.log(c.ok(`培训计划已创建：${c.bold(training.id)} for ${member.name}`));
    });
}

// `ai-team candidate ...` subcommands

import type { Command } from 'commander';
import { CandidateStore, generateId, nowIso } from '@ai-team/core';
import type { CandidateSource, CandidateStatus } from '@ai-team/core';
import { c, printTable, DEFAULT_DATA_DIR } from '../utils.js';

export function registerCandidateCommands(program: Command): void {
  const cmd = program.command('candidate').description('候选人管理');

  cmd
    .command('add <name>')
    .description('录入新候选人')
    .option('-p, --position <position>', '目标岗位', '未指定')
    .option('-e, --email <email>', '邮箱')
    .option('--phone <phone>', '电话')
    .option('-r, --resume <resume>', '简历文本（短）')
    .option('-s, --source <source>', '来源 (linkedin/referral/website/recruiter/job_board/other)', 'other')
    .option('--tags <tags>', '标签（逗号分隔）')
    .action(async (name: string, opts) => {
      const store = CandidateStore.create(DEFAULT_DATA_DIR);
      const source = (opts.source ?? 'other') as CandidateSource;
      const validSources: CandidateSource[] = ['linkedin', 'referral', 'website', 'recruiter', 'job_board', 'other'];
      if (!validSources.includes(source)) {
        console.error(c.err(`无效的 source: ${source}，可选: ${validSources.join(', ')}`));
        process.exit(1);
      }
      const status: CandidateStatus = 'new';
      const tags = opts.tags ? opts.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined;
      const candidate = {
        id: generateId('ct'),
        name,
        position: opts.position,
        source,
        status,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        ...(opts.email && { email: opts.email }),
        ...(opts.phone && { phone: opts.phone }),
        ...(opts.resume && { resume: opts.resume }),
        ...(tags && { tags }),
      };
      await store.add(candidate);
      console.log(c.ok(`候选人 ${name} 已创建：${c.bold(candidate.id)}`));
      console.log(c.info(`岗位: ${opts.position} | 来源: ${source}`));
    });

  cmd
    .command('list')
    .description('列出所有候选人')
    .option('--status <status>', '按状态过滤')
    .action(async (opts) => {
      const store = CandidateStore.create(DEFAULT_DATA_DIR);
      const items = await store.list();
      const filtered = opts.status
        ? items.filter((c) => c.status === opts.status)
        : items;
      if (filtered.length === 0) {
        console.log(c.dim('（暂无候选人，使用 `ai-team candidate add` 录入）'));
        return;
      }
      printTable(
        filtered.map((c) => ({
          id: c.id,
          name: c.name,
          position: c.position,
          status: c.status,
          source: c.source,
        }))
      );
    });

  cmd
    .command('show <id>')
    .description('查看候选人详情')
    .action(async (id: string) => {
      const store = CandidateStore.create(DEFAULT_DATA_DIR);
      const c0 = await store.get(id);
      if (!c0) {
        console.error(c.err(`候选人 ${id} 不存在`));
        process.exit(1);
      }
      console.log(c.bold(c0.name) + ` (${c0.id})`);
      console.log(`  岗位: ${c0.position}`);
      console.log(`  状态: ${c0.status}`);
      console.log(`  来源: ${c0.source}`);
      if (c0.email) console.log(`  邮箱: ${c0.email}`);
      if (c0.phone) console.log(`  电话: ${c0.phone}`);
      if (c0.tags?.length) console.log(`  标签: ${c0.tags.join(', ')}`);
      if (c0.resume) console.log(`  简历: ${c0.resume.slice(0, 200)}${c0.resume.length > 200 ? '...' : ''}`);
      console.log(`  创建: ${c0.createdAt}`);
    });

  cmd
    .command('update <id>')
    .description('更新候选人状态或字段')
    .option('--status <status>', '新状态')
    .option('--notes <notes>', '备注')
    .action(async (id: string, opts) => {
      const store = CandidateStore.create(DEFAULT_DATA_DIR);
      const patch: Record<string, unknown> = { updatedAt: nowIso() };
      if (opts.status) patch.status = opts.status;
      if (opts.notes) patch.notes = opts.notes;
      const updated = await store.update(id, patch as Partial<{ id: string }>);
      if (!updated) {
        console.error(c.err(`候选人 ${id} 不存在`));
        process.exit(1);
      }
      console.log(c.ok(`候选人 ${updated.name} 已更新`));
    });
}

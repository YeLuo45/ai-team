// V21: `ai-team pipeline ...` subcommands
import type { Command } from 'commander';
import { PipelineStore, PIPELINE_STAGES, type PipelineStage, PIPELINE_STAGE_LABEL } from '@ai-team/core';
import { c, printTable, DEFAULT_DATA_DIR } from '../utils.js';

export function registerPipelineCommands(program: Command): void {
  const cmd = program.command('pipeline').description('招聘漏斗（候选人推进）');

  cmd
    .command('advance <candidateId>')
    .description('推进候选人到下一阶段')
    .option('-s, --stage <stage>', `目标阶段 (${PIPELINE_STAGES.join('/')})`, 'screening')
    .option('-n, --note <note>', '备注')
    .option('-a, --actor <actor>', '操作者 ID', 'cli')
    .action(async (candidateId: string, opts) => {
      const store = PipelineStore.create(DEFAULT_DATA_DIR);
      const stage = opts.stage as PipelineStage;
      if (!(PIPELINE_STAGES as string[]).includes(stage)) {
        console.error(c.err(`无效的 stage: ${stage}，可选: ${PIPELINE_STAGES.join(', ')}`));
        process.exit(1);
      }
      const entry = await store.advance({
        candidateId,
        toStage: stage,
        actorId: opts.actor,
        ...(opts.note ? { note: opts.note } : {}),
      });
      console.log(c.ok(`候选人 ${candidateId} → ${PIPELINE_STAGE_LABEL[entry.stage]}`));
    });

  cmd
    .command('funnel')
    .description('查看漏斗报告')
    .action(async () => {
      const store = PipelineStore.create(DEFAULT_DATA_DIR);
      const all = await store.list();
      const r = store.funnelReport(all);
      console.log(c.bold(`招聘漏斗（共 ${r.total} 人）`));
      const rows = r.steps.map((s) => ({
        stage: s.label,
        count: s.count,
        conversion: s.conversionRate > 0 ? `${(s.conversionRate * 100).toFixed(1)}%` : '-',
        dropoff: s.dropoffRate > 0 ? `${(s.dropoffRate * 100).toFixed(1)}%` : '-',
      }));
      printTable(rows);
      console.log(c.info(`整体转化: ${(r.overallConversion * 100).toFixed(1)}%  |  平均停留: ${r.averageDwellDays} 天`));
    });

  cmd
    .command('show <candidateId>')
    .description('查看候选人漏斗历史')
    .action(async (candidateId: string) => {
      const store = PipelineStore.create(DEFAULT_DATA_DIR);
      const all = await store.list();
      const mine = all
        .filter((e) => e.candidateId === candidateId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      if (mine.length === 0) {
        console.error(c.err(`候选人 ${candidateId} 无漏斗记录`));
        process.exit(1);
      }
      printTable(mine.map((e) => ({
        time: e.createdAt,
        stage: PIPELINE_STAGE_LABEL[e.stage],
        from: e.previousStage ? PIPELINE_STAGE_LABEL[e.previousStage] : '-',
        actor: e.actorId,
        note: e.note ?? '',
      })));
    });
}
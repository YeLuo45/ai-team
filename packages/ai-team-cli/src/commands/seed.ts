// V24: `ai-team seed ...` — 一键填充 demo 数据
import type { Command } from 'commander';
import {
  generateSeed, CandidateStore, MemberStore, JsonStore, InterviewStore,
  TrainingStore, type SeedSize,
} from '@ai-team/core';
import type { Skill } from '@ai-team/core';
import type { Review } from '@ai-team/core';
import { c, DEFAULT_DATA_DIR } from '../utils.js';

const SIZE_OPTS: SeedSize[] = ['small', 'medium', 'large'];

export function registerSeedCommands(program: Command): void {
  const cmd = program.command('seed').description('填充演示数据');

  cmd
    .command('fill')
    .description('用演示数据填充当前数据目录（不会覆盖已有数据）')
    .option('-s, --size <size>', `规模 (${SIZE_OPTS.join('/')})`, 'medium')
    .option('--wipe', '先清空当前数据再填充', false)
    .action(async (opts) => {
      const size = opts.size as SeedSize;
      if (!SIZE_OPTS.includes(size)) {
        console.error(c.err(`无效的 size: ${size}，可选: ${SIZE_OPTS.join(', ')}`));
        process.exit(1);
      }
      const data = generateSeed(size, Date.now() % 100000);

      if (opts.wipe) {
        const candidateStore = CandidateStore.create(DEFAULT_DATA_DIR);
        const memberStore = MemberStore.create(DEFAULT_DATA_DIR);
        const interviewStore = InterviewStore.create(DEFAULT_DATA_DIR);
        const trainingStore = TrainingStore.create(DEFAULT_DATA_DIR);
        const skillStore = new JsonStore<Skill>({ baseDir: DEFAULT_DATA_DIR, fileName: 'skills.json' });
        const reviewStore = new JsonStore<Review>({ baseDir: DEFAULT_DATA_DIR, fileName: 'reviews.json' });
        for (const c of await candidateStore.list()) await candidateStore.remove(c.id);
        for (const m of await memberStore.list()) await memberStore.remove(m.id);
        for (const i of await interviewStore.list()) await interviewStore.remove(i.id);
        for (const t of await trainingStore.list()) await trainingStore.remove(t.id);
        for (const s of await skillStore.list()) await skillStore.remove(s.id);
        for (const r of await reviewStore.list()) await reviewStore.remove(r.id);
      }

      const candidateStore = CandidateStore.create(DEFAULT_DATA_DIR);
      const memberStore = MemberStore.create(DEFAULT_DATA_DIR);
      const interviewStore = InterviewStore.create(DEFAULT_DATA_DIR);
      const trainingStore = TrainingStore.create(DEFAULT_DATA_DIR);
      const skillStore = new JsonStore<Skill>({ baseDir: DEFAULT_DATA_DIR, fileName: 'skills.json' });
      const reviewStore = new JsonStore<Review>({ baseDir: DEFAULT_DATA_DIR, fileName: 'reviews.json' });

      for (const s of data.skills) await skillStore.add(s);
      for (const c of data.candidates) await candidateStore.add(c);
      for (const m of data.members) await memberStore.add(m);
      for (const i of data.interviews) await interviewStore.add(i);
      for (const t of data.trainings) await trainingStore.add(t);
      for (const r of data.reviews) await reviewStore.add(r);

      console.log(c.ok(`已填充 ${size} 演示数据：`));
      console.log(`  ${c.info(`${data.candidates.length} 候选人`)}`);
      console.log(`  ${c.info(`${data.members.length} 成员`)}`);
      console.log(`  ${c.info(`${data.skills.length} 技能`)}`);
      console.log(`  ${c.info(`${data.interviews.length} 面试`)}`);
      console.log(`  ${c.info(`${data.trainings.length} 培训`)}`);
      console.log(`  ${c.info(`${data.reviews.length} Review`)}`);
    });

  cmd
    .command('preview')
    .description('预览演示数据（不写入磁盘）')
    .option('-s, --size <size>', `规模 (${SIZE_OPTS.join('/')})`, 'medium')
    .action((opts) => {
      const size = opts.size as SeedSize;
      if (!SIZE_OPTS.includes(size)) {
        console.error(c.err(`无效的 size: ${size}，可选: ${SIZE_OPTS.join(', ')}`));
        process.exit(1);
      }
      const data = generateSeed(size, 1);
      console.log(c.ok(`${size} 演示数据预览：`));
      console.log(`  候选人: ${data.candidates.length}（示例: ${data.candidates[0]?.name}）`);
      console.log(`  成员:   ${data.members.length}（示例: ${data.members[0]?.name} / ${data.members[0]?.team}）`);
      console.log(`  技能:   ${data.skills.length}（示例: ${data.skills[0]?.name}）`);
      console.log(`  面试:   ${data.interviews.length}`);
      console.log(`  培训:   ${data.trainings.length}`);
      console.log(`  Review: ${data.reviews.length}`);
    });
}
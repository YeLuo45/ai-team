// V28: `ai-team dev` — 一键演示：清空 → seed → 启动 server+web

import type { Command } from 'commander';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { generateSeed, CandidateStore, MemberStore, JsonStore, InterviewStore, TrainingStore, type SeedSize } from '@ai-team/core';
import type { Skill } from '@ai-team/core';
import type { Review } from '@ai-team/core';
import { c, DEFAULT_DATA_DIR } from '../utils.js';

const SIZE_OPTS: SeedSize[] = ['small', 'medium', 'large'];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PKG_ROOT = path.resolve(__dirname, '../../..');
const WEB_DIR = path.resolve(PKG_ROOT, 'packages/ai-team-web');

function killTree(pid: number | undefined) {
  if (!pid) return;
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try { process.kill(pid, 'SIGTERM'); } catch { /* ignore */ }
  }
}

async function wipeData() {
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

async function seedData(size: SeedSize) {
  const data = generateSeed(size, Date.now() % 100000);
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
  return data;
}

export function registerDevCommands(program: Command): void {
  program
    .command('dev')
    .description('一键演示模式：清空 → seed → 启动 server+web')
    .option('-s, --size <size>', `数据规模 (${SIZE_OPTS.join('/')})`, 'medium')
    .option('--no-seed', '跳过 seed，仅启动服务')
    .option('--no-server', '不启动 server')
    .option('--no-web', '不启动 web')
    .option('--port <port>', 'server 端口', '3000')
    .option('--web-port <port>', 'web 端口', '5173')
    .action(async (opts) => {
      const size = opts.size as SeedSize;
      if (!SIZE_OPTS.includes(size)) {
        console.error(c.err(`无效的 size: ${size}，可选: ${SIZE_OPTS.join(', ')}`));
        process.exit(1);
      }

      if (opts.seed) {
        console.log(c.info(`正在清空旧数据 (${DEFAULT_DATA_DIR})...`));
        await wipeData();
        console.log(c.info(`正在填充 ${size} 演示数据...`));
        const data = await seedData(size);
        console.log(c.ok(`✓ 已填充:`));
        console.log(`    ${data.candidates.length} 候选人 / ${data.members.length} 成员 / ${data.interviews.length} 面试`);
      } else {
        console.log(c.info('--no-seed: 保留现有数据'));
      }

      const procs: Array<{ name: string; child: ReturnType<typeof spawn>; kill: () => void }> = [];

      if (opts.server) {
        const port = String(opts.port);
        const child = spawn(process.execPath, [
          path.join(PKG_ROOT, 'node_modules/tsx/dist/cli.mjs'),
          'src/index.ts',
        ], {
          cwd: path.resolve(PKG_ROOT, 'packages/ai-team-server'),
          env: { ...process.env, PORT: port, AI_TEAM_DATA_DIR: DEFAULT_DATA_DIR },
          detached: true,
          stdio: 'inherit',
        });
        procs.push({ name: 'server', child, kill: () => killTree(child.pid) });
        console.log(c.ok(`✓ server 启动中 (port=${port}, pid=${child.pid})`));
      }

      if (opts.web) {
        if (!existsSync(WEB_DIR)) {
          console.error(c.err(`web 包不存在: ${WEB_DIR}`));
        } else {
          const webPort = String(opts.webPort);
          const child = spawn(process.execPath, [
            path.join(WEB_DIR, 'node_modules/.bin/vite'),
            '--host', '0.0.0.0',
            '--port', webPort,
          ], {
            cwd: WEB_DIR,
            env: { ...process.env, BROWSER: 'none' },
            detached: true,
            stdio: 'inherit',
          });
          procs.push({ name: 'web', child, kill: () => killTree(child.pid) });
          console.log(c.ok(`✓ web 启动中 (http://localhost:${webPort}, pid=${child.pid})`));
        }
      }

      if (procs.length === 0) {
        console.log(c.info('已退出（无服务启动）'));
        return;
      }

      // Graceful shutdown (registered once, removed after)
      let shutdownCalled = false;
      const shutdown = () => {
        if (shutdownCalled) return;
        shutdownCalled = true;
        console.log('\n' + c.warn('正在关闭...'));
        for (const p of procs) p.kill();
        process.removeListener('SIGINT', shutdown);
        process.removeListener('SIGTERM', shutdown);
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      // Wait for any child to exit
      await new Promise<void>((resolve) => {
        for (const p of procs) {
          p.child.on('exit', () => {
            console.log(c.warn(`${p.name} 已退出`));
            shutdown();
            resolve();
          });
        }
      });
    });
}
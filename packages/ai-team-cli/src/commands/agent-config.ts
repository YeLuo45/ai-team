// V35: `ai-team agent-config ...` — export/import agent configuration presets
import type { Command } from 'commander';
import {
  AgentConfigStore,
  BUILTIN_TEMPLATES,
  exportAgentConfigs,
  findTemplate,
  importAgentConfigs,
} from '@ai-team/core';
import { c, DEFAULT_DATA_DIR } from '../utils.js';

export function registerAgentConfigCommands(program: Command): void {
  const cmd = program
    .command('agent-config')
    .alias('agcfg')
    .description('Agent 独立配置：导出 / 导入 / 应用预设');

  cmd
    .command('export')
    .description('导出所有 agent 配置到 stdout (JSON envelope)')
    .action(async () => {
      const store = new AgentConfigStore({ baseDir: DEFAULT_DATA_DIR });
      const envelope = await exportAgentConfigs(store);
      console.log(JSON.stringify(envelope, null, 2));
    });

  cmd
    .command('import')
    .description('从 JSON envelope 文件导入 agent 配置')
    .option('-f, --file <path>', 'envelope 文件路径（默认 stdin）')
    .option('--dry-run', '只报告将导入的数量，不写入', false)
    .action(async (opts) => {
      const fs = await import('node:fs/promises');
      const raw = opts.file
        ? await fs.readFile(opts.file, 'utf-8')
        : await readStdin();
      const envelope = JSON.parse(raw);
      const store = new AgentConfigStore({ baseDir: DEFAULT_DATA_DIR });
      const result = await importAgentConfigs(store, envelope, { dryRun: opts.dryRun });
      console.log(c.ok(`已导入 ${result.imported} 个 agent 配置 (dryRun=${result.dryRun})`));
    });

  cmd
    .command('presets')
    .description('列出所有内置预设')
    .action(() => {
      for (const t of BUILTIN_TEMPLATES) {
        console.log(`${c.info(t.id.padEnd(24))} ${t.name} (${t.agents.length} agents) — ${t.description}`);
      }
    });

  cmd
    .command('apply <preset-id>')
    .description('应用一个内置预设到所有 agent')
    .option('--dry-run', '只报告数量，不写入', false)
    .action(async (presetId, opts) => {
      const preset = findTemplate(presetId);
      if (!preset) {
        console.error(c.err(`未找到预设: ${presetId}（用 \`ai-team agent-config presets\` 列出）`));
        process.exit(1);
      }
      const store = new AgentConfigStore({ baseDir: DEFAULT_DATA_DIR });
      const envelope = {
        version: 'v1' as const,
        exportedAt: new Date().toISOString(),
        agents: preset.agents,
      };
      const result = await importAgentConfigs(store, envelope, { dryRun: opts.dryRun });
      console.log(c.ok(`预设 "${preset.name}" 已应用: ${result.imported} agent (dryRun=${result.dryRun})`));
    });
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

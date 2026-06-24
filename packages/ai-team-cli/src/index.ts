// CLI entry point — registers all subcommands

import { Command } from 'commander';
import { registerCandidateCommands } from './commands/candidate.js';
import { registerInterviewCommands } from './commands/interview.js';
import { registerMemberCommands } from './commands/member.js';
import { registerTeamCommands } from './commands/team.js';
import { registerPipelineCommands } from './commands/pipeline.js';
import { registerSeedCommands } from './commands/seed.js';
import { registerDevCommands } from './commands/dev.js';
import { registerAgentConfigCommands } from './commands/agent-config.js';
import { registerDeliveryCommands } from './commands/delivery.js';

const program = new Command();

program
  .name('ai-team')
  .description('AI-powered team management CLI — interviews, member development, skill tracking')
  .version('0.2.0');

registerCandidateCommands(program);
registerInterviewCommands(program);
registerMemberCommands(program);
registerTeamCommands(program);
registerPipelineCommands(program);
registerSeedCommands(program);
registerDevCommands(program);
registerAgentConfigCommands(program);
registerDeliveryCommands(program);

// tui subcommand — delegates to @ai-team/tui
program
  .command('tui')
  .description('启动 TUI 模式 (Ink-based interactive terminal UI)')
  .option('--api-url <url>', 'API server URL', process.env.AI_TEAM_API_URL ?? 'http://localhost:3000')
  .action(async (opts) => {
    process.env.AI_TEAM_API_URL = opts.apiUrl;
    const { run } = await import('@ai-team/tui/run');
    await run();
  });

program.parseAsync(process.argv).catch((err) => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});

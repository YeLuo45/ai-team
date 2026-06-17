// CLI entry point — registers all subcommands

import { Command } from 'commander';
import { registerCandidateCommands } from './commands/candidate.js';
import { registerInterviewCommands } from './commands/interview.js';
import { registerMemberCommands } from './commands/member.js';
import { registerTeamCommands } from './commands/team.js';

const program = new Command();

program
  .name('ai-team')
  .description('AI-powered team management CLI — interviews, member development, skill tracking')
  .version('0.1.0');

registerCandidateCommands(program);
registerInterviewCommands(program);
registerMemberCommands(program);
registerTeamCommands(program);

program.parseAsync(process.argv).catch((err) => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});

# @ai-team/cli

Command-line interface for ai-team. Inspired by pi-mono's `pi-coding-agent` CLI.

## Install

From the monorepo root, run:
```bash
npm install
npm run build
```

Then either invoke via node:
```bash
node packages/ai-team-cli/bin/ai-team --help
```

Or link globally:
```bash
npm link packages/ai-team-cli
ai-team --help
```

## Commands

```
ai-team candidate add <name> [options]      # 录入候选人
ai-team candidate list [--status <s>]        # 列出候选人
ai-team candidate show <id>                  # 查看候选人详情
ai-team candidate update <id> [options]      # 更新候选人

ai-team interview start <candidateId>        # 启动 AI 面试（多轮对话）
ai-team interview list [--candidate <id>]    # 列出面试
ai-team interview show <id>                  # 查看面试详情

ai-team member add <name>                    # 添加团队成员
ai-team member list [--team <t>]             # 列出成员
ai-team member show <id>                     # 查看成员详情
ai-team member train <id>                    # 添加培训计划

ai-team team overview                        # 团队概览
ai-team team skills                          # 技能分布
```

## Data Location

By default, JSON files are read/written to `./data/` relative to CWD. Override via `AI_TEAM_DATA_DIR` env var.

## LLM Provider

Configured via env vars (see [@ai-team/ai README](../ai-team-ai/README.md)):
- `AI_TEAM_LLM_API_KEY` (or `OPENAI_API_KEY`)
- `AI_TEAM_LLM_BASE_URL`
- `AI_TEAM_LLM_MODEL`

If no API key is set, a deterministic mock client is used.

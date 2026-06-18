# @ai-team/server

Express REST API server for ai-team. Central backend that powers both TUI and Web modes.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/team | Bulk fetch all data |
| GET | /api/stats | Team overview stats |
| **Candidates** | | |
| GET | /api/candidates | List |
| GET | /api/candidates/:id | Detail |
| POST | /api/candidates | Create |
| PUT | /api/candidates/:id | Update |
| DELETE | /api/candidates/:id | Delete |
| **Members** | | |
| GET/POST/PUT/DELETE | /api/members[/:id] | Same pattern |
| **Interviews** | | |
| GET | /api/interviews | List |
| POST | /api/interviews/start | Start AI interview (`{candidateId, type}`) |
| POST | /api/interviews/:id/answer | Submit candidate answer (`{content}`) |
| POST | /api/interviews/:id/finalize | Force finalize + produce evaluation |
| DELETE | /api/interviews/:id | Delete |
| **Trainings** | | |
| GET/POST | /api/trainings | List / create |
| PUT | /api/trainings/:id | Update |
| POST | /api/training-plans/generate | AI-generate training plan (`{memberId, targetRole, skills, weaknessAreas}`) |

## Usage

```bash
# Set LLM key (optional — uses Mock if absent)
export AI_TEAM_LLM_API_KEY=*** AI_TEAM_DATA_DIR=/path/to/data

# Start
node packages/ai-team-server/bin/server.js
# or
npx tsx packages/ai-team-server/src/index.ts
```

Server listens on port 3000 by default (`PORT` env to override).

## Architecture

```
TUI (Ink)   ─┐
              ├─→ Express Server ─→ @ai-team/core (JSON store) ─→ data/*.json
Web (React) ─┘   ↑ LLM proxy
                 │
            @ai-team/agent (interview orchestration)
```

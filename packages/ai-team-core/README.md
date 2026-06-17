# @ai-team/core

Domain types and JSON file storage for ai-team.

## Domain Model

- **Candidate** — Job applicant with resume, status, skills
- **Member** — Hired team member with skills, trainings, reviews
- **Interview** — Interview session with turns and evaluation
- **Training** — Skill development activity (course/mentoring/project/reading)
- **Review** — Performance review (quarterly)
- **Skill** + **SkillScore** — Skill definitions and per-person scores

## Storage

JSON file store at `data/<entity>.json` (one file per entity type). Writes are atomic via `.tmp` + `rename` and serialized via promise chain.

## Usage

```ts
import { CandidateStore, generateId, nowIso } from '@ai-team/core';

const store = CandidateStore.create('./data');
const c = await store.add({
  id: generateId('ct'),
  name: '张三',
  position: '前端工程师',
  source: 'linkedin',
  status: 'new',
  createdAt: nowIso(),
  updatedAt: nowIso(),
});
```

// V45: Org Memory Store — JSON file persistence + context builder with citations.
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export interface OrgMemoryUpsertInput {
  team: string;
  roleProfile: string;
  feedback: string[];
  preferences: string[];
  updatedBy: string;
}

export interface OrgMemoryEntry {
  id: string;
  team: string;
  roleProfile: string;
  feedback: string[];
  preferences: string[];
  updatedBy: string;
  updatedAt: string;
  citations: string[];
}

export interface OrgMemoryContextResult {
  team: string;
  context: string;
  citations: string[];
  summary: string;
}

export class OrchestrationOrgMemoryStore {
  constructor(private readonly opts: { baseDir: string }) {}

  private fileFor(team: string): string {
    return path.join(this.opts.baseDir, 'org-memory', `${team}.json`);
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(path.dirname(this.fileFor('x')), { recursive: true });
  }

  async read(team: string): Promise<OrgMemoryEntry | null> {
    const file = this.fileFor(team);
    if (!existsSync(file)) return null;
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<OrgMemoryEntry>;
    if (!parsed.team) return null;
    return this.normalize(parsed);
  }

  async list(team: string): Promise<OrgMemoryEntry[]> {
    const entry = await this.read(team);
    return entry ? [entry] : [];
  }

  async upsert(input: OrgMemoryUpsertInput): Promise<OrgMemoryEntry> {
    await this.ensureDir();
    const existing = await this.read(input.team);
    const feedback = unique([...(existing?.feedback ?? []), ...input.feedback]);
    const preferences = unique([...(existing?.preferences ?? []), ...input.preferences]);
    const entry: OrgMemoryEntry = {
      id: `org_${input.team}_${Date.now().toString(36)}`,
      team: input.team,
      roleProfile: input.roleProfile,
      feedback,
      preferences,
      updatedBy: input.updatedBy,
      updatedAt: new Date().toISOString(),
      citations: [
        ...feedback.map((_, index) => `org:${input.team}:feedback:${index + 1}`),
        ...preferences.map((_, index) => `org:${input.team}:preference:${index + 1}`),
      ],
    };
    await fs.writeFile(this.fileFor(input.team), JSON.stringify(entry, null, 2), 'utf-8');
    return entry;
  }

  async buildContext(team: string, queryTokens: string[]): Promise<OrgMemoryContextResult> {
    const entry = await this.read(team);
    const feedback = entry?.feedback ?? [];
    const preferences = entry?.preferences ?? [];
    const queryCitations = queryTokens.map((_token, index) => `context:${team}:query:${index + 1}` as string);
    if (!entry) {
      const contextLines = [
        `Team: ${team}`,
        'Role: (unconfigured)',
        ...queryTokens.map((token) => `Query: ${token}`),
      ];
      return {
        team,
        context: contextLines.join('\n'),
        citations: queryCitations,
        summary: `${team} context has no persisted memory yet`,
      };
    }
    const citations = [...entry.citations, ...queryCitations];
    const contextLines = [
      `Team: ${team}`,
      `Role: ${entry.roleProfile}`,
      ...feedback.map((item) => `Feedback: ${item}`),
      ...preferences.map((item) => `Preference: ${item}`),
      ...queryTokens.map((token) => `Query: ${token}`),
    ];
    return {
      team,
      context: contextLines.join('\n'),
      citations,
      summary: `${team} context built from ${entry.citations.length} memory signals`,
    };
  }

  private normalize(parsed: Partial<OrgMemoryEntry>): OrgMemoryEntry {
    const team = String(parsed.team);
    const feedback = safeStringArray(parsed.feedback);
    const preferences = safeStringArray(parsed.preferences);
    const citations = [
      ...feedback.map((_, index) => `org:${team}:feedback:${index + 1}`),
      ...preferences.map((_, index) => `org:${team}:preference:${index + 1}`),
    ];
    return {
      id: parsed.id ?? `org_${team}_seed`,
      team,
      roleProfile: parsed.roleProfile ?? '',
      feedback,
      preferences,
      updatedBy: parsed.updatedBy ?? 'system',
      updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
      citations,
    };
  }
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (item == null ? '' : String(item)));
}

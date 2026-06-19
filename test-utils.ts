// Shared test utilities

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export async function createTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'ai-team-test-'));
}

export async function cleanupTempDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

export function mockFetchResponse(data: any, options: { status?: number; ok?: boolean } = {}): Response {
  return new Response(JSON.stringify(data), {
    status: options.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

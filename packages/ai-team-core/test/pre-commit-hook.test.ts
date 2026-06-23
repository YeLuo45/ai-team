// V50: pre-commit hook integrity tests
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const HOOK_SRC = join(ROOT, 'scripts', 'pre-commit');
const INSTALLER = join(ROOT, 'scripts', 'install-hooks.sh');

describe('V50 pre-commit hook integrity', () => {
  it('pre-commit hook script exists and references verify + release', () => {
    expect(existsSync(HOOK_SRC)).toBe(true);
    const src = readFileSync(HOOK_SRC, 'utf-8');
    expect(src).toContain('verify:readme');
    expect(src).toContain('release:check');
    expect(src).toContain('exit 0');
  });

  it('install-hooks.sh script exists and references the hook source', () => {
    expect(existsSync(INSTALLER)).toBe(true);
    const src = readFileSync(INSTALLER, 'utf-8');
    expect(src).toContain('scripts/pre-commit');
    expect(src).toContain('.git/hooks/pre-commit');
  });
});
// V50: pre-commit hook installation + integrity
import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, readFileSync, statSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const HOOK_SRC = join(ROOT, 'scripts', 'pre-commit');
const HOOK_DST = join(ROOT, '.git', 'hooks', 'pre-commit');
const INSTALLER = join(ROOT, 'scripts', 'install-hooks.sh');

describe('V50 pre-commit hook', () => {
  beforeEach(() => {
    // Ensure a stub .git/hooks directory exists for the install to target
    if (!existsSync(join(ROOT, '.git'))) {
      mkdirSync(join(ROOT, '.git', 'hooks'), { recursive: true });
    }
  });

  it('pre-commit script source references verify:readme', () => {
    const src = readFileSync(HOOK_SRC, 'utf-8');
    expect(src).toContain('verify:readme');
    expect(src).toContain('release:check');
    expect(src).toContain('exit 0');
  });

  it('install-hooks.sh script exists and is executable', () => {
    expect(existsSync(INSTALLER)).toBe(true);
  });

  it('installs hook into .git/hooks/pre-commit', () => {
    // Clean any pre-existing
    if (existsSync(HOOK_DST)) {
      unlinkSync(HOOK_DST);
    }
    const result = require('node:child_process').spawnSync('bash', [INSTALLER], { encoding: 'utf-8' });
    expect(result.status).toBe(0);
    expect(existsSync(HOOK_DST)).toBe(true);
    expect(statSync(HOOK_DST).mode & 0o111).not.toBe(0); // executable bit
    const installed = readFileSync(HOOK_DST, 'utf-8');
    expect(installed).toBe(readFileSync(HOOK_SRC, 'utf-8'));
    unlinkSync(HOOK_DST);
  });
});
// Shared utilities for CLI commands

import path from 'node:path';
import chalk from 'chalk';

export const DEFAULT_DATA_DIR =
  process.env.AI_TEAM_DATA_DIR ?? path.resolve(process.cwd(), 'data');

export const c = {
  ok: (msg: string) => chalk.green('✓') + ' ' + msg,
  err: (msg: string) => chalk.red('✗') + ' ' + msg,
  info: (msg: string) => chalk.blue('ℹ') + ' ' + msg,
  warn: (msg: string) => chalk.yellow('⚠') + ' ' + msg,
  dim: (msg: string) => chalk.dim(msg),
  bold: (msg: string) => chalk.bold(msg),
};

export function printTable(rows: Array<Record<string, string | number | undefined>>): void {
  if (rows.length === 0) {
    console.log(c.dim('（无数据）'));
    return;
  }
  const keys = Object.keys(rows[0]);
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length))
  );
  // header
  console.log(keys.map((k, i) => k.padEnd(widths[i])).join('  '));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) {
    console.log(keys.map((k, i) => String(row[k] ?? '').padEnd(widths[i])).join('  '));
  }
}

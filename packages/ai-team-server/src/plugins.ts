// Plugin loader - scans data/plugins/ for plugin manifests

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

export type HookEvent =
  | 'candidate.created'
  | 'candidate.updated'
  | 'candidate.deleted'
  | 'interview.completed'
  | 'review.saved'
  | 'training.created'
  | 'member.created';

export const HOOK_EVENTS: HookEvent[] = [
  'candidate.created',
  'candidate.updated',
  'candidate.deleted',
  'interview.completed',
  'review.saved',
  'training.created',
  'member.created',
];

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author?: string;
  description: string;
  icon?: string;
  category?: 'integration' | 'analysis' | 'automation' | 'ui' | 'other';
  /** Hook subscriptions */
  hooks: Array<{ event: HookEvent; webhookUrl?: string }>;
  /** Plugin-specific config schema (for documentation) */
  configSchema?: Record<string, { type: 'string' | 'number' | 'boolean'; description: string; required?: boolean }>;
}

export interface PluginConfig {
  id: string;
  manifest: PluginManifest;
  enabled: boolean;
  config: Record<string, unknown>;
  installedAt: string;
}

export class PluginManager {
  private plugins: Map<string, PluginConfig> = new Map();
  public events = new EventEmitter();

  constructor(private pluginsDir: string) {}

  async loadAll(): Promise<PluginConfig[]> {
    try {
      await fs.mkdir(this.pluginsDir, { recursive: true });
      const files = await fs.readdir(this.pluginsDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await fs.readFile(path.join(this.pluginsDir, file), 'utf-8');
          const cfg = JSON.parse(content) as PluginConfig;
          this.plugins.set(cfg.id, cfg);
        } catch (err) {
          console.warn(`[PluginManager] Failed to load ${file}:`, (err as Error).message);
        }
      }
    } catch (err) {
      console.warn(`[PluginManager] Failed to read plugins dir:`, (err as Error).message);
    }
    return [...this.plugins.values()];
  }

  list(): PluginConfig[] {
    return [...this.plugins.values()];
  }

  get(id: string): PluginConfig | undefined {
    return this.plugins.get(id);
  }

  async save(cfg: PluginConfig): Promise<void> {
    this.plugins.set(cfg.id, cfg);
    await fs.mkdir(this.pluginsDir, { recursive: true });
    await fs.writeFile(
      path.join(this.pluginsDir, `${cfg.id}.json`),
      JSON.stringify(cfg, null, 2),
      'utf-8'
    );
  }

  async toggle(id: string): Promise<PluginConfig | undefined> {
    const cfg = this.plugins.get(id);
    if (!cfg) return undefined;
    cfg.enabled = !cfg.enabled;
    await this.save(cfg);
    return cfg;
  }

  async updateConfig(id: string, config: Record<string, unknown>): Promise<PluginConfig | undefined> {
    const cfg = this.plugins.get(id);
    if (!cfg) return undefined;
    cfg.config = config;
    await this.save(cfg);
    return cfg;
  }

  async remove(id: string): Promise<boolean> {
    if (!this.plugins.has(id)) return false;
    this.plugins.delete(id);
    try {
      await fs.unlink(path.join(this.pluginsDir, `${id}.json`));
    } catch { /* file may not exist */ }
    return true;
  }

  /**
   * Fire a hook event - all enabled plugins with matching subscriptions get notified
   * via webhook (fire-and-forget).
   */
  async fireHook(event: HookEvent, payload: unknown): Promise<void> {
    for (const cfg of this.plugins.values()) {
      if (!cfg.enabled) continue;
      for (const sub of cfg.manifest.hooks) {
        if (sub.event !== event || !sub.webhookUrl) continue;
        // Fire and forget
        fetch(sub.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, plugin: cfg.id, payload, timestamp: new Date().toISOString() }),
        }).catch((err) => {
          console.warn(`[PluginManager] Hook POST failed for ${cfg.id} → ${sub.webhookUrl}:`, err.message);
        });
      }
    }
  }
}

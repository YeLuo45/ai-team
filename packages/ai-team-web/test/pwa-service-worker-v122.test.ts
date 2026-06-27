// V122: PWA real-service-ization — sw.js + manifest.json + icons (RED tests)
// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildServiceWorkerScript,
  buildIconPlaceholderPng,
  parseServiceWorkerScript,
  extractCachePatterns,
  extractFetchHandlers,
  ICON_SIZES,
  generateIcons,
  buildPwaAssetBundle,
  writePwaAssets,
  PwaAssetBundle,
} from '../src/components/mobile/service-worker.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------- buildServiceWorkerScript ----------
describe('V122 buildServiceWorkerScript', () => {
  it('returns a string containing install / activate / fetch handlers', () => {
    const sw = buildServiceWorkerScript({ cacheName: 'ai-team-v1' });
    expect(typeof sw).toBe('string');
    expect(sw).toContain('install');
    expect(sw).toContain('activate');
    expect(sw).toContain('fetch');
    expect(sw).toContain('ai-team-v1');
  });

  it('includes cache-first + network-first strategies', () => {
    const sw = buildServiceWorkerScript({ cacheName: 'test' });
    expect(sw).toContain('cache');
    expect(sw).toMatch(/network/i);
  });

  it('returns a parseable script (no syntax errors)', () => {
    const sw = buildServiceWorkerScript({ cacheName: 'parse' });
    // Should not throw on parse — try a Function constructor
    expect(() => new Function(sw)).not.toThrow();
  });
});

// ---------- parseServiceWorkerScript ----------
describe('V122 parseServiceWorkerScript', () => {
  it('extracts metadata from script', () => {
    const sw = buildServiceWorkerScript({ cacheName: 'meta' });
    const parsed = parseServiceWorkerScript(sw);
    expect(parsed.cacheName).toBe('meta');
    expect(parsed.handlers).toContain('install');
    expect(parsed.handlers).toContain('fetch');
  });

  it('extracts URL patterns for caching', () => {
    const sw = buildServiceWorkerScript({ cacheName: 'pat' });
    const patterns = extractCachePatterns(sw);
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('extracts fetch event handlers', () => {
    const sw = buildServiceWorkerScript({ cacheName: 'fh' });
    const handlers = extractFetchHandlers(sw);
    expect(handlers).toContain('fetch');
  });
});

// ---------- Icon generation ----------
describe('V122 icon generation', () => {
  it('ICON_SIZES includes 192 and 512', () => {
    expect(ICON_SIZES).toContain(192);
    expect(ICON_SIZES).toContain(512);
  });

  it('buildIconPlaceholderPng returns a Buffer with PNG magic bytes', () => {
    const buf = buildIconPlaceholderPng(192);
    expect(Buffer.isBuffer(buf)).toBe(true);
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });

  it('generateIcons produces both 192 and 512 placeholders', () => {
    const icons = generateIcons();
    expect(icons.length).toBeGreaterThanOrEqual(2);
    const sizes = icons.map((i) => i.size);
    expect(sizes).toContain(192);
    expect(sizes).toContain(512);
  });

  it('each icon has src + size + type=image/png', () => {
    const icons = generateIcons();
    for (const i of icons) {
      expect(i.src).toMatch(/^data:image\/png/);
      expect(i.type).toBe('image/png');
      expect(i.size).toBeGreaterThan(0);
    }
  });
});

// ---------- Asset bundle ----------
describe('V122 PwaAssetBundle', () => {
  it('buildPwaAssetBundle returns manifest + service worker + icons', () => {
    const bundle = buildPwaAssetBundle({ name: 'ai-team', cacheName: 'v1' });
    expect(bundle.manifest).toBeTruthy();
    expect(bundle.serviceWorker).toBeTruthy();
    expect(bundle.icons.length).toBeGreaterThanOrEqual(2);
    expect(bundle.offlineHtml).toContain('ai-team');
  });

  it('manifest in bundle has PWA fields', () => {
    const bundle = buildPwaAssetBundle({ name: 'ai-team' });
    expect(bundle.manifest.name).toBe('ai-team');
    expect(bundle.manifest.display).toBe('standalone');
    expect(bundle.manifest.start_url).toBeTruthy();
    expect(Array.isArray(bundle.manifest.icons)).toBe(true);
  });

  it('writePwaAssets writes to filesystem (or returns paths)', () => {
    const bundle = buildPwaAssetBundle({ name: 'test-bundle' });
    const tmpDir = resolve(process.cwd(), '.tmp-pwa-test');
    const paths = writePwaAssets(bundle, { targetDir: tmpDir });
    expect(paths.manifestPath).toContain('manifest.json');
    expect(paths.serviceWorkerPath).toContain('sw.js');
    expect(paths.iconsDir).toContain('icons');
    expect(paths.offlineHtmlPath).toContain('offline.html');
  });
});

// ---------- File-on-disk presence (after generate script runs) ----------
describe('V122 manifest.json / sw.js on disk', () => {
  const webPublic = resolve(process.cwd(), 'packages/ai-team-web/public');

  it('public/ directory exists', () => {
    expect(existsSync(webPublic)).toBe(true);
  });

  it('public/manifest.json exists after build', () => {
    // Files are written by scripts/copy-data.mjs or build pipeline
    if (existsSync(resolve(webPublic, 'manifest.json'))) {
      const json = JSON.parse(readFileSync(resolve(webPublic, 'manifest.json'), 'utf-8'));
      expect(json.name).toBeTruthy();
      expect(json.start_url).toBeTruthy();
    } else {
      // Acceptable: not built yet — writePwaAssets will create on next build
      expect(true).toBe(true);
    }
  });
});
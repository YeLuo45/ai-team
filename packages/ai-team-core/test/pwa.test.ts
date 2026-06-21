// V23: PWA tests

import { describe, it, expect } from 'vitest';
import {
  buildManifest,
  buildWorkboxConfig,
  validatePWAConfig,
  mergePWAConfig,
  isPWASupported,
  generateSWRegistrationScript,
  DEFAULT_PWA_CONFIG,
} from '../src/pwa.js';

describe('V23: PWA', () => {
  describe('buildManifest', () => {
    it('generates valid manifest', () => {
      const manifest = buildManifest(DEFAULT_PWA_CONFIG);
      expect(manifest.name).toBe('ai-team');
      expect(manifest.short_name).toBe('ai-team');
      expect(manifest.start_url).toBe('/');
      expect(manifest.display).toBe('standalone');
      expect(manifest.icons.length).toBeGreaterThan(0);
      expect(manifest.theme_color).toBeDefined();
      expect(manifest.background_color).toBeDefined();
    });

    it('includes all icons', () => {
      const manifest = buildManifest(DEFAULT_PWA_CONFIG);
      expect(manifest.icons.some((i: any) => i.sizes === '192x192')).toBe(true);
      expect(manifest.icons.some((i: any) => i.sizes === '512x512')).toBe(true);
    });

    it('includes maskable icon', () => {
      const manifest = buildManifest(DEFAULT_PWA_CONFIG);
      expect(manifest.icons.some((i: any) => i.purpose === 'maskable')).toBe(true);
    });
  });

  describe('buildWorkboxConfig', () => {
    it('generates config when workbox enabled', () => {
      const wb = buildWorkboxConfig(DEFAULT_PWA_CONFIG);
      expect(wb).not.toBeNull();
      expect(wb.globPatterns).toBeDefined();
      expect(wb.runtimeCaching.length).toBeGreaterThan(0);
    });

    it('returns null when workbox disabled', () => {
      const wb = buildWorkboxConfig({ ...DEFAULT_PWA_CONFIG, workboxEnabled: false });
      expect(wb).toBeNull();
    });

    it('includes API caching strategy', () => {
      const wb = buildWorkboxConfig(DEFAULT_PWA_CONFIG);
      expect(wb.runtimeCaching.some((c: any) => c.handler === 'NetworkFirst')).toBe(true);
    });

    it('includes image caching strategy', () => {
      const wb = buildWorkboxConfig(DEFAULT_PWA_CONFIG);
      expect(wb.runtimeCaching.some((c: any) => c.handler === 'CacheFirst')).toBe(true);
    });

    it('includes navigateFallback for SPA routing', () => {
      const wb = buildWorkboxConfig(DEFAULT_PWA_CONFIG);
      expect(wb.navigateFallback).toBe('/index.html');
      expect(wb.navigateFallbackDenylist).toContainEqual(/^\/api\//);
    });
  });

  describe('validatePWAConfig', () => {
    it('default config is valid', () => {
      const r = validatePWAConfig(DEFAULT_PWA_CONFIG);
      expect(r.valid).toBe(true);
    });

    it('requires appName', () => {
      const r = validatePWAConfig({ ...DEFAULT_PWA_CONFIG, appName: '' });
      expect(r.valid).toBe(false);
      expect(r.error).toContain('appName');
    });

    it('requires shortName', () => {
      const r = validatePWAConfig({ ...DEFAULT_PWA_CONFIG, shortName: '' });
      expect(r.valid).toBe(false);
    });

    it('shortName must be ≤ 12 chars', () => {
      const r = validatePWAConfig({ ...DEFAULT_PWA_CONFIG, shortName: 'this-is-too-long' });
      expect(r.valid).toBe(false);
      expect(r.error).toContain('12 characters');
    });

    it('requires startUrl', () => {
      const r = validatePWAConfig({ ...DEFAULT_PWA_CONFIG, startUrl: '' });
      expect(r.valid).toBe(false);
    });

    it('requires at least one icon', () => {
      const r = validatePWAConfig({ ...DEFAULT_PWA_CONFIG, icons: [] });
      expect(r.valid).toBe(false);
    });

    it('validates icon structure', () => {
      const r = validatePWAConfig({
        ...DEFAULT_PWA_CONFIG,
        icons: [{ src: '/x.png', sizes: 'invalid', type: 'image/png' }],
      });
      expect(r.valid).toBe(false);
      expect(r.error).toContain('WxH');
    });

    it('validates icon.src', () => {
      const r = validatePWAConfig({
        ...DEFAULT_PWA_CONFIG,
        icons: [{ src: '', sizes: '192x192', type: 'image/png' }],
      });
      expect(r.valid).toBe(false);
    });

    it('validates icon.type', () => {
      const r = validatePWAConfig({
        ...DEFAULT_PWA_CONFIG,
        icons: [{ src: '/x.png', sizes: '192x192', type: '' }],
      });
      expect(r.valid).toBe(false);
    });
  });

  describe('mergePWAConfig', () => {
    it('merges base + override', () => {
      const merged = mergePWAConfig(DEFAULT_PWA_CONFIG, { themeColor: '#ff0000' });
      expect(merged.themeColor).toBe('#ff0000');
      expect(merged.appName).toBe(DEFAULT_PWA_CONFIG.appName);
    });

    it('allows icon override', () => {
      const customIcons = [{ src: '/custom.png', sizes: '256x256', type: 'image/png' }];
      const merged = mergePWAConfig(DEFAULT_PWA_CONFIG, { icons: customIcons });
      expect(merged.icons).toEqual(customIcons);
    });

    it('keeps base icons if not overridden', () => {
      const merged = mergePWAConfig(DEFAULT_PWA_CONFIG, { themeColor: '#000' });
      expect(merged.icons).toEqual(DEFAULT_PWA_CONFIG.icons);
    });
  });

  describe('isPWASupported', () => {
    it('returns true for modern browsers', () => {
      expect(isPWASupported('Mozilla/5.0 Chrome/120')).toBe(true);
      expect(isPWASupported('Mozilla/5.0 Firefox/120')).toBe(true);
      expect(isPWASupported('Mozilla/5.0 Safari/17')).toBe(true);
    });

    it('returns false for IE', () => {
      expect(isPWASupported('Mozilla/5.0 MSIE 10.0')).toBe(false);
      expect(isPWASupported('Mozilla/5.0 Trident/7.0')).toBe(false);
    });

    it('returns true for empty string (assume modern)', () => {
      expect(isPWASupported('')).toBe(true);
    });
  });

  describe('generateSWRegistrationScript', () => {
    it('generates registration script', () => {
      const script = generateSWRegistrationScript(DEFAULT_PWA_CONFIG);
      expect(script).toContain('serviceWorker');
      expect(script).toContain('/sw.js');
      expect(script).toContain('addEventListener');
    });

    it('skips registration when disabled', () => {
      const script = generateSWRegistrationScript({ ...DEFAULT_PWA_CONFIG, enabled: false });
      expect(script).toContain('false');
    });
  });

  describe('DEFAULT_PWA_CONFIG', () => {
    it('has all required fields', () => {
      expect(DEFAULT_PWA_CONFIG.appName).toBe('ai-team');
      expect(DEFAULT_PWA_CONFIG.shortName.length).toBeLessThanOrEqual(12);
      expect(DEFAULT_PWA_CONFIG.startUrl).toBe('/');
      expect(DEFAULT_PWA_CONFIG.icons.length).toBeGreaterThan(0);
    });

    it('is a valid config', () => {
      const r = validatePWAConfig(DEFAULT_PWA_CONFIG);
      expect(r.valid).toBe(true);
    });
  });
});
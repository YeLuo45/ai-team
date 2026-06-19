// V21: Notify tests - templates, channels, senders

import { describe, it, expect, vi } from 'vitest';
import {
  interpolate,
  buildSlackMessage,
  buildEmailMessage,
  buildWebhookPayload,
  validateChannelConfig,
  channelMatchesEvent,
  createSlackSender,
  createWebhookSender,
  createLogSender,
  createEmailSender,
} from '../src/notify.js';

describe('V21: Notifications', () => {
  describe('interpolate', () => {
    it('replaces single var', () => {
      expect(interpolate('Hello {{name}}', { name: 'Alice' })).toBe('Hello Alice');
    });

    it('replaces nested var', () => {
      expect(interpolate('Score: {{user.score}}', { user: { score: 95 } })).toBe('Score: 95');
    });

    it('replaces multiple vars', () => {
      expect(interpolate('{{a}} + {{b}} = {{c}}', { a: 1, b: 2, c: 3 })).toBe('1 + 2 = 3');
    });

    it('handles whitespace in marker', () => {
      expect(interpolate('{{  name  }}', { name: 'X' })).toBe('X');
    });

    it('returns empty for missing var', () => {
      expect(interpolate('Hi {{missing}}', {})).toBe('Hi ');
    });

    it('returns empty for nested missing', () => {
      expect(interpolate('Hi {{user.name}}', { user: {} })).toBe('Hi ');
    });

    it('leaves non-matching markers alone if not {{var}}', () => {
      expect(interpolate('no markers', {})).toBe('no markers');
    });
  });

  describe('buildSlackMessage', () => {
    it('builds with default template', () => {
      const msg = buildSlackMessage({
        event: 'interview.completed',
        data: { candidate: { name: 'Bob' }, score: 95 },
      });
      expect(msg.text).toContain('interview.completed');
      expect(msg.text).toContain('Bob');
      expect(msg.blocks).toBeDefined();
    });

    it('uses custom template body', () => {
      const msg = buildSlackMessage(
        { event: 'test', data: { x: 1 } },
        { event: 'test', body: 'Value: {{x}}' }
      );
      expect(msg.text).toBe('Value: 1');
    });
  });

  describe('buildEmailMessage', () => {
    it('builds with custom template', () => {
      const msg = buildEmailMessage(
        { event: 'review.created', data: { member: { name: 'Alice' }, score: 90 } },
        { event: 'review.created', subject: 'Review: {{member.name}}', body: 'Score: {{score}}\nPass' }
      );
      expect(msg.subject).toBe('Review: Alice');
      expect(msg.text).toBe('Score: 90\nPass');
      expect(msg.html).toContain('<br>');
    });

    it('defaults subject to event name', () => {
      const msg = buildEmailMessage({ event: 'evt', data: {} });
      expect(msg.subject).toBe('[evt]');
    });

    it('falls back to JSON when no template', () => {
      const msg = buildEmailMessage({ event: 'evt', data: { a: 1 } });
      expect(msg.text).toContain('"a": 1');
    });
  });

  describe('buildWebhookPayload', () => {
    it('includes event, data, timestamp', () => {
      const p = buildWebhookPayload({ event: 'foo', data: { x: 1 } });
      expect(p.event).toBe('foo');
      expect(p.data).toEqual({ x: 1 });
      expect(p.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('includes rendered message when template', () => {
      const p = buildWebhookPayload(
        { event: 'foo', data: { x: 'hi' } },
        { event: 'foo', body: 'Hi {{x}}' }
      );
      expect(p.message).toBe('Hi hi');
    });
  });

  describe('validateChannelConfig', () => {
    it('slack requires webhookUrl', () => {
      const r = validateChannelConfig({ type: 'slack', config: {} });
      expect(r.valid).toBe(false);
      expect(r.error).toContain('webhookUrl');
    });

    it('slack URL must be slack domain', () => {
      const r = validateChannelConfig({
        type: 'slack',
        config: { webhookUrl: 'https://evil.com/hook' },
      });
      expect(r.valid).toBe(false);
    });

    it('slack accepts valid webhook', () => {
      const r = validateChannelConfig({
        type: 'slack',
        config: { webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxxx' },
      });
      expect(r.valid).toBe(true);
    });

    it('email requires to and smtp', () => {
      expect(validateChannelConfig({ type: 'email', config: {} }).valid).toBe(false);
      expect(validateChannelConfig({ type: 'email', config: { to: 'a@b.com' } }).valid).toBe(false);
      const r = validateChannelConfig({
        type: 'email',
        config: { to: 'a@b.com', smtp: { host: 'smtp.x.com', port: 587 } },
      });
      expect(r.valid).toBe(true);
    });

    it('webhook requires valid URL', () => {
      expect(validateChannelConfig({ type: 'webhook', config: {} }).valid).toBe(false);
      expect(validateChannelConfig({ type: 'webhook', config: { url: 'not-a-url' } }).valid).toBe(false);
      const r = validateChannelConfig({
        type: 'webhook',
        config: { url: 'https://api.example.com/hook' },
      });
      expect(r.valid).toBe(true);
    });

    it('log channel always valid', () => {
      expect(validateChannelConfig({ type: 'log', config: {} }).valid).toBe(true);
    });

    it('unknown type fails', () => {
      const r = validateChannelConfig({ type: 'telegram' as any, config: {} });
      expect(r.valid).toBe(false);
    });

    it('requires type', () => {
      const r = validateChannelConfig({ config: {} });
      expect(r.valid).toBe(false);
    });
  });

  describe('channelMatchesEvent', () => {
    const baseChannel = {
      id: 'c1', name: 'n', type: 'log' as const,
      enabled: true, config: {}, events: [], createdAt: '', updatedAt: '',
    };

    it('matches all events when events list is empty', () => {
      expect(channelMatchesEvent(baseChannel, 'any.event')).toBe(true);
    });

    it('matches exact event', () => {
      const c = { ...baseChannel, events: ['user.login', 'user.logout'] };
      expect(channelMatchesEvent(c, 'user.login')).toBe(true);
      expect(channelMatchesEvent(c, 'user.logout')).toBe(true);
      expect(channelMatchesEvent(c, 'user.update')).toBe(false);
    });

    it('matches wildcard prefix', () => {
      const c = { ...baseChannel, events: ['interview.*'] };
      expect(channelMatchesEvent(c, 'interview.start')).toBe(true);
      expect(channelMatchesEvent(c, 'interview.complete')).toBe(true);
      expect(channelMatchesEvent(c, 'review.created')).toBe(false);
    });

    it('disabled channel does not match', () => {
      const c = { ...baseChannel, enabled: false, events: ['any'] };
      expect(channelMatchesEvent(c, 'any')).toBe(false);
    });
  });

  describe('Senders', () => {
    it('log sender succeeds and logs', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const sender = createLogSender();
      const channel = {
        id: 'c1', name: 'test', type: 'log' as const,
        enabled: true, config: {}, events: [], createdAt: '', updatedAt: '',
      };
      const result = await sender.send(channel, { event: 'test', data: { x: 1 } });
      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('slack sender handles success', async () => {
      const mockFetch = vi.fn(async () => new Response('ok', { status: 200 }));
      vi.stubGlobal('fetch', mockFetch);
      const sender = createSlackSender();
      const channel = {
        id: 'c1', name: 'slack', type: 'slack' as const,
        enabled: true,
        config: { webhookUrl: 'https://hooks.slack.com/services/T/B/x' },
        events: [], createdAt: '', updatedAt: '',
      };
      const result = await sender.send(channel, { event: 'test', data: { x: 1 } });
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/T/B/x',
        expect.objectContaining({ method: 'POST' })
      );
      vi.unstubAllGlobals();
    });

    it('slack sender handles HTTP error', async () => {
      const mockFetch = vi.fn(async () => new Response('bad', { status: 500 }));
      vi.stubGlobal('fetch', mockFetch);
      const sender = createSlackSender();
      const channel = {
        id: 'c1', name: 'slack', type: 'slack' as const,
        enabled: true,
        config: { webhookUrl: 'https://hooks.slack.com/services/T/B/x' },
        events: [], createdAt: '', updatedAt: '',
      };
      const result = await sender.send(channel, { event: 'test', data: { x: 1 } });
      expect(result.success).toBe(false);
      expect(result.status).toBe(500);
      vi.unstubAllGlobals();
    });

    it('slack sender handles network error', async () => {
      const mockFetch = vi.fn(async () => { throw new Error('network down'); });
      vi.stubGlobal('fetch', mockFetch);
      const sender = createSlackSender();
      const channel = {
        id: 'c1', name: 'slack', type: 'slack' as const,
        enabled: true,
        config: { webhookUrl: 'https://hooks.slack.com/services/T/B/x' },
        events: [], createdAt: '', updatedAt: '',
      };
      const result = await sender.send(channel, { event: 'test', data: { x: 1 } });
      expect(result.success).toBe(false);
      expect(result.error).toContain('network down');
      vi.unstubAllGlobals();
    });

    it('webhook sender includes custom headers', async () => {
      const mockFetch = vi.fn(async () => new Response('ok', { status: 200 }));
      vi.stubGlobal('fetch', mockFetch);
      const sender = createWebhookSender();
      const channel = {
        id: 'c1', name: 'wh', type: 'webhook' as const,
        enabled: true,
        config: { url: 'https://api.example.com/h', headers: { 'X-Auth': 'tok' } },
        events: [], createdAt: '', updatedAt: '',
      };
      await sender.send(channel, { event: 'e', data: {} });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/h',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Auth': 'tok' }),
        })
      );
      vi.unstubAllGlobals();
    });

    it('email sender test mode succeeds', async () => {
      const sender = createEmailSender();
      const channel = {
        id: 'c1', name: 'e', type: 'email' as const,
        enabled: true,
        config: { to: 'a@b.com', smtp: { host: 'x' }, testMode: true },
        events: [], createdAt: '', updatedAt: '',
      };
      const result = await sender.send(channel, { event: 'e', data: {} });
      expect(result.success).toBe(true);
    });

    it('email sender non-test mode fails gracefully', async () => {
      const sender = createEmailSender();
      const channel = {
        id: 'c1', name: 'e', type: 'email' as const,
        enabled: true,
        config: { to: 'a@b.com', smtp: { host: 'x' } },
        events: [], createdAt: '', updatedAt: '',
      };
      const result = await sender.send(channel, { event: 'e', data: {} });
      expect(result.success).toBe(false);
      expect(result.error).toContain('nodemailer');
    });
  });
});
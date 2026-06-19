// V21: 集成通知 (Slack/Email/Webhook)

export type ChannelType = 'slack' | 'email' | 'webhook' | 'log';

export interface NotificationChannel {
  id: string;
  name: string;
  type: ChannelType;
  enabled: boolean;
  config: Record<string, any>;
  events: string[];          // events to listen to (empty = all)
  createdAt: string;
  updatedAt: string;
}

export interface NotificationTemplate {
  event: string;              // e.g. 'interview.completed'
  subject?: string;           // for email
  body: string;               // supports {{var}} interpolation
  channels?: string[];        // specific channel IDs, empty = all
}

export interface NotificationLog {
  id: string;
  channelId: string;
  event: string;
  status: 'sent' | 'failed' | 'skipped';
  message: string;
  error?: string;
  timestamp: string;
  durationMs?: number;
}

// 事件 payload
export interface NotificationPayload {
  event: string;
  data: Record<string, any>;
  userId?: string;
}

// 模板插值
export function interpolate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const parts = path.split('.');
    let value: any = data;
    for (const part of parts) {
      if (value == null) return '';
      value = value[part];
    }
    return value == null ? '' : String(value);
  });
}

// Slack 消息格式
export function buildSlackMessage(payload: NotificationPayload, template?: NotificationTemplate): any {
  let body: string;
  if (template) {
    body = interpolate(template.body, payload.data);
  } else {
    // Default: list key=value pairs
    const fields = Object.entries(payload.data)
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(', ');
    body = `*${payload.event}*\n${fields}`;
  }
  return {
    text: body,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: body },
      },
    ],
  };
}

// Email 消息格式
export function buildEmailMessage(payload: NotificationPayload, template?: NotificationTemplate): any {
  return {
    subject: template?.subject ? interpolate(template.subject, payload.data) : `[${payload.event}]`,
    text: template ? interpolate(template.body, payload.data) : JSON.stringify(payload.data, null, 2),
    html: template ? `<p>${interpolate(template.body, payload.data).replace(/\n/g, '<br>')}</p>` : `<pre>${JSON.stringify(payload.data, null, 2)}</pre>`,
  };
}

// Webhook payload
export function buildWebhookPayload(payload: NotificationPayload, template?: NotificationTemplate): any {
  return {
    event: payload.event,
    timestamp: new Date().toISOString(),
    data: payload.data,
    message: template ? interpolate(template.body, payload.data) : undefined,
  };
}

// Channel configs validation
export function validateChannelConfig(channel: Partial<NotificationChannel>): { valid: boolean; error?: string } {
  if (!channel.type) return { valid: false, error: 'type is required' };
  switch (channel.type) {
    case 'slack':
      if (!channel.config?.webhookUrl) {
        return { valid: false, error: 'slack channel requires config.webhookUrl' };
      }
      if (!channel.config.webhookUrl.startsWith('https://hooks.slack.com/')) {
        return { valid: false, error: 'slack webhookUrl must start with https://hooks.slack.com/' };
      }
      return { valid: true };
    case 'email':
      if (!channel.config?.to) {
        return { valid: false, error: 'email channel requires config.to' };
      }
      if (!channel.config?.smtp) {
        return { valid: false, error: 'email channel requires config.smtp' };
      }
      return { valid: true };
    case 'webhook':
      if (!channel.config?.url) {
        return { valid: false, error: 'webhook channel requires config.url' };
      }
      try {
        new URL(channel.config.url);
      } catch {
        return { valid: false, error: 'webhook channel requires valid URL' };
      }
      return { valid: true };
    case 'log':
      return { valid: true };
    default:
      return { valid: false, error: `unknown channel type: ${channel.type}` };
  }
}

// Channel match check (event filter)
export function channelMatchesEvent(channel: NotificationChannel, event: string): boolean {
  if (!channel.enabled) return false;
  if (channel.events.length === 0) return true; // empty = all events
  return channel.events.some(e => {
    if (e === event) return true;
    if (e.endsWith('.*')) return event.startsWith(e.slice(0, -1));
    return false;
  });
}

// 测试用 webhook sender (用 fetch)
export interface ChannelSender {
  send(channel: NotificationChannel, payload: NotificationPayload, template?: NotificationTemplate): Promise<{ success: boolean; error?: string; status?: number }>;
}

// Slack sender
export function createSlackSender(): ChannelSender {
  return {
    async send(channel, payload, template) {
      const message = buildSlackMessage(payload, template);
      try {
        const resp = await fetch(channel.config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        });
        if (!resp.ok) {
          return { success: false, error: `HTTP ${resp.status}`, status: resp.status };
        }
        return { success: true, status: resp.status };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  };
}

// Webhook sender
export function createWebhookSender(): ChannelSender {
  return {
    async send(channel, payload, template) {
      const body = buildWebhookPayload(payload, template);
      try {
        const resp = await fetch(channel.config.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...channel.config.headers },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          return { success: false, error: `HTTP ${resp.status}`, status: resp.status };
        }
        return { success: true, status: resp.status };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  };
}

// Email sender (uses nodemailer if available)
export function createEmailSender(): ChannelSender {
  return {
    async send(channel, payload, template) {
      buildEmailMessage(payload, template);
      if (channel.config.testMode) {
        return { success: true };
      }
      return { success: false, error: 'Email sender requires nodemailer (testMode=true to skip)' };
    },
  };
}

// Log sender (just logs to console)
export function createLogSender(): ChannelSender {
  return {
    async send(channel, payload, template) {
      const body = template ? interpolate(template.body, payload.data) : JSON.stringify(payload.data);
      console.log(`[notify:${channel.name}] ${payload.event}: ${body}`);
      return { success: true };
    },
  };
}

// Sender factory
export function createSender(type: ChannelType): ChannelSender {
  switch (type) {
    case 'slack': return createSlackSender();
    case 'webhook': return createWebhookSender();
    case 'email': return createEmailSender();
    case 'log': return createLogSender();
  }
}
// V118: PWA manifest generator + service worker registration + install prompt

export interface ManifestInput {
  name?: string;
  shortName?: string;
  startUrl?: string;
  display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  themeColor?: string;
  backgroundColor?: string;
  icons?: Array<{ src: string; sizes: string; type?: string; purpose?: string }>;
}

export interface PwaManifest {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
}

export function generateManifest(input: ManifestInput): PwaManifest {
  return {
    name: input.name ?? 'ai-team',
    short_name: input.shortName ?? 'ai-team',
    start_url: input.startUrl ?? '/',
    display: input.display ?? 'standalone',
    theme_color: input.themeColor ?? '#6366f1',
    background_color: input.backgroundColor ?? '#ffffff',
    icons: input.icons ?? [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}

export function parseManifest(json: string): PwaManifest {
  return JSON.parse(json) as PwaManifest;
}

export function isManifestValid(value: unknown): value is PwaManifest {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<PwaManifest>;
  return typeof m.name === 'string' && m.name.length > 0 && typeof m.start_url === 'string';
}

// ---------- Service Worker ----------
export const SW_READY_EVENT = 'ai-team-sw-ready';
export const SW_OFFLINE_READY_EVENT = 'ai-team-sw-offline-ready';

export type ServiceWorkerStatus = 'unsupported' | 'pending' | 'ready' | 'offline-ready' | 'error';

let _swStatus: ServiceWorkerStatus = 'unsupported';

export function getServiceWorkerStatus(): ServiceWorkerStatus {
  return _swStatus;
}

function setSwStatus(status: ServiceWorkerStatus): void {
  _swStatus = status;
  if (typeof window !== 'undefined') {
    if (status === 'ready') window.dispatchEvent(new CustomEvent(SW_READY_EVENT));
    if (status === 'offline-ready') window.dispatchEvent(new CustomEvent(SW_OFFLINE_READY_EVENT));
  }
}

export function registerServiceWorker(scriptUrl = '/sw.js'): Promise<ServiceWorkerStatus> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    setSwStatus('unsupported');
    return Promise.resolve('unsupported');
  }
  setSwStatus('pending');
  return navigator.serviceWorker
    .register(scriptUrl)
    .then(() => {
      setSwStatus('ready');
      return 'ready' as const;
    })
    .catch(() => {
      setSwStatus('error');
      return 'error' as const;
    });
}

export function unregisterServiceWorker(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(false);
  }
  return navigator.serviceWorker
    .getRegistration()
    .then((reg) => (reg ? reg.unregister() : false))
    .catch(() => false);
}

// ---------- Offline fallback HTML ----------
export function buildOfflineFallbackHtml(appName: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${appName} · 离线</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
    .card { padding: 2rem; max-width: 28rem; text-align: center; }
    h1 { font-size: 1.5rem; }
    button { padding: 0.5rem 1rem; border: 1px solid #cbd5e1; background: white; border-radius: 0.375rem; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${appName} · 离线模式</h1>
    <p>当前网络不可用，部分功能暂时受限。请检查网络后重试。</p>
    <button onclick="location.reload()">重新加载</button>
  </div>
</body>
</html>`;
}

// ---------- Install prompt ----------
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let _deferredPrompt: BeforeInstallPromptEvent | null = null;

export function captureInstallPrompt(ev: BeforeInstallPromptEvent): void {
  _deferredPrompt = ev;
}

export function consumeInstallPrompt(): BeforeInstallPromptEvent | null {
  const p = _deferredPrompt;
  _deferredPrompt = null;
  return p;
}

export function hasInstallPrompt(): boolean {
  return _deferredPrompt !== null;
}
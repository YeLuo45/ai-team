// V23: PWA + 离线缓存

export interface PWAConfig {
  enabled: boolean;
  appName: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  startUrl: string;
  scope: string;
  icons: PWAIcon[];
  cacheStrategy: 'precache' | 'runtime' | 'hybrid';
  workboxEnabled: boolean;
}

export interface PWAIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: 'any' | 'maskable' | 'badge';
}

// 默认配置
export const DEFAULT_PWA_CONFIG: PWAConfig = {
  enabled: true,
  appName: 'ai-team',
  shortName: 'ai-team',
  description: 'AI-powered team management',
  themeColor: '#3b82f6',
  backgroundColor: '#ffffff',
  display: 'standalone',
  startUrl: '/',
  scope: '/',
  icons: [
    {
      src: '/icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
  cacheStrategy: 'hybrid',
  workboxEnabled: true,
};

// 生成 manifest.json 内容
export function buildManifest(config: PWAConfig): any {
  return {
    name: config.appName,
    short_name: config.shortName,
    description: config.description,
    theme_color: config.themeColor,
    background_color: config.backgroundColor,
    display: config.display,
    start_url: config.startUrl,
    scope: config.scope,
    icons: config.icons,
    orientation: 'any',
  };
}

// 生成 Workbox runtime caching 策略
export function buildWorkboxConfig(config: PWAConfig): any {
  if (!config.workboxEnabled) return null;
  return {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/api\./,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24, // 24 hours
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'images-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
        },
      },
    ],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//],
  };
}

// 验证 PWA 配置
export function validatePWAConfig(config: Partial<PWAConfig>): { valid: boolean; error?: string } {
  if (!config.appName) return { valid: false, error: 'appName is required' };
  if (!config.shortName) return { valid: false, error: 'shortName is required' };
  if (config.shortName && config.shortName.length > 12) {
    return { valid: false, error: 'shortName must be 12 characters or less' };
  }
  if (!config.startUrl) return { valid: false, error: 'startUrl is required' };
  if (!config.icons || config.icons.length === 0) {
    return { valid: false, error: 'at least one icon is required' };
  }
  // Check icon sizes
  for (const icon of config.icons) {
    if (!icon.src) return { valid: false, error: 'icon.src is required' };
    if (!icon.sizes) return { valid: false, error: 'icon.sizes is required' };
    if (!icon.type) return { valid: false, error: 'icon.type is required' };
    if (!icon.sizes.match(/^\d+x\d+$/)) {
      return { valid: false, error: `icon.sizes must be WxH (e.g. 192x192): got "${icon.sizes}"` };
    }
  }
  return { valid: true };
}

// 检测浏览器是否支持 PWA
export function isPWASupported(userAgent?: string): boolean {
  const ua = userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  // Service workers are supported in all modern browsers
  return !ua.includes('MSIE ') && !ua.includes('Trident/');
}

// 检测是否在 standalone 模式 (已安装的 PWA)
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    ((window.navigator as any).standalone === true);
}

// 合并 PWA 配置
export function mergePWAConfig(base: PWAConfig, override: Partial<PWAConfig>): PWAConfig {
  return {
    ...base,
    ...override,
    icons: override.icons || base.icons,
  };
}

// 生成 Service Worker 注册代码 (string)
export function generateSWRegistrationScript(config: PWAConfig): string {
  return `
if ('serviceWorker' in navigator && ${config.enabled}) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
      .catch(err => console.warn('[PWA] SW registration failed:', err));
  });
}
`.trim();
}
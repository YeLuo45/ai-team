// V118: PwaInstallPrompt React component

import { useEffect, useState } from 'react';
import { Button } from '../design-system/primitives.js';
import {
  captureInstallPrompt,
  consumeInstallPrompt,
  type BeforeInstallPromptEvent,
} from './pwa.js';

export function PwaInstallPrompt() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    function onBeforeInstall(ev: Event) {
      captureInstallPrompt(ev as BeforeInstallPromptEvent);
      setAvailable(true);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  async function onClick() {
    const ev = consumeInstallPrompt();
    if (!ev) return;
    await ev.prompt();
    const choice = await ev.userChoice;
    if (choice.outcome === 'accepted') setAvailable(false);
  }

  if (!available) return null;

  return (
    <div
      data-testid="pwa-install-prompt"
      className="fixed bottom-16 left-4 right-4 z-40 flex items-center justify-between gap-2 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2 text-sm text-brand-900 lg:left-auto lg:right-4 lg:w-80"
    >
      <span>📲 安装 ai-team 到桌面</span>
      <Button size="sm" onClick={onClick} testId="pwa-install-button">
        安装
      </Button>
    </div>
  );
}
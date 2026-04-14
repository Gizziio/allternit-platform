/**
 * Browser Tabs Management via CDP
 * Ported from OpenClaw dist/browser/routes/tabs.js
 */

import type { BrowserTab } from '../../types/index.js';
import { getTargets, createTarget, closeTarget, activateTarget } from './client.js';

export async function getTabs(cdpUrl: string): Promise<BrowserTab[]> {
  const targets = await getTargets(cdpUrl);
  
  return targets
    .filter((t: any) => t.type === 'page')
    .map((t: any) => ({
      targetId: t.id,
      url: t.url,
      title: t.title,
      type: t.type,
      wsUrl: t.webSocketDebuggerUrl,
    }));
}

export async function openTab(cdpUrl: string, url: string): Promise<BrowserTab> {
  const target = await createTarget(cdpUrl, url);
  
  // Wait for target to be ready and get its info
  await new Promise(r => setTimeout(r, 100));
  const tabs = await getTabs(cdpUrl);
  const tab = tabs.find(t => t.targetId === target.targetId);
  
  if (!tab) {
    throw new Error('Failed to create tab');
  }
  
  return tab;
}

export async function focusTab(cdpUrl: string, targetId: string): Promise<void> {
  await activateTarget(cdpUrl, targetId);
}

export async function closeTab(cdpUrl: string, targetId: string): Promise<void> {
  await closeTarget(cdpUrl, targetId);
}

export async function getTabAction(
  cdpUrl: string, 
  targetId: string, 
  action: 'back' | 'forward' | 'reload'
): Promise<void> {
  const tabs = await getTabs(cdpUrl);
  const tab = tabs.find(t => t.targetId === targetId);
  
  if (!tab?.wsUrl) {
    throw new Error('Tab not found or no WebSocket URL');
  }

  const { CDPClient } = await import('./client.js');
  const client = await CDPClient.connect(tab.wsUrl);

  try {
    const { Page, Runtime } = await client.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });

    if (action === 'back') {
      await client.send('Runtime.evaluate', {
        expression: 'history.back()',
      });
    } else if (action === 'forward') {
      await client.send('Runtime.evaluate', {
        expression: 'history.forward()',
      });
    } else if (action === 'reload') {
      await client.send('Page.reload', {});
    }
  } finally {
    client.close();
  }
}

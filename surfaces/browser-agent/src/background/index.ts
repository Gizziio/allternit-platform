import { apiServer } from './api-server';

let isRecording = false;
let recordedActions: any[] = [];

function initialize(): void {
  console.log('[Gizzi Browser] Initializing...');
  apiServer.start().catch(console.error);
  setupEventListeners();
  console.log('[Gizzi Browser] Ready');
}

function setupEventListeners(): void {
  chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-recording') toggleRecording();
    if (command === 'open-panel') openPanel();
  });

  chrome.action.onClicked.addListener(() => toggleRecording());

  chrome.contextMenus.create({
    id: 'a2r-root',
    title: 'A2R Agent',
    contexts: ['all']
  });
  
  chrome.contextMenus.create({
    id: 'a2r-screenshot',
    title: 'Screenshot',
    parentId: 'a2r-root',
    contexts: ['all']
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'a2r-screenshot' && tab?.id) {
      takeScreenshot(tab.id);
    }
  });
}

function toggleRecording(): void {
  isRecording = !isRecording;
  if (isRecording) {
    recordedActions = [];
    chrome.action.setBadgeText({ text: 'REC' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF1744' });
    notify('Recording', 'Actions being recorded');
  } else {
    chrome.action.setBadgeText({ text: '' });
    notify('Stopped', `${recordedActions.length} actions`);
    chrome.storage.local.set({ recordedActions, recordedAt: Date.now() });
  }
}

function openPanel(): void {
  chrome.tabs.create({ url: chrome.runtime.getURL('panel.html') });
}

async function takeScreenshot(tabId: number): Promise<void> {
  const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
  chrome.downloads.download({
    url: dataUrl,
    filename: `a2r-${Date.now()}.png`
  });
}

function notify(title: string, message: string): void {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message
  });
}

initialize();

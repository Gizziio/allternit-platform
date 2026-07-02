import { useBrowserStore } from '@/capsules/browser/browser.store';

export function openInBrowser(url: string): void {
  window.dispatchEvent(
    new CustomEvent('allternit:open-view', {
      detail: { viewType: 'browser' },
    }),
  );
  useBrowserStore.getState().addTab(url);
}

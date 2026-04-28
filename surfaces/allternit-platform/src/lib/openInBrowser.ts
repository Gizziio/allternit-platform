import { useNav } from '@/nav/useNav';
import { useBrowserStore } from '@/capsules/browser/browser.store';

export function openInBrowser(url: string): void {
  useNav.getState().dispatch({ type: 'OPEN_VIEW', viewType: 'browser' });
  useBrowserStore.getState().addTab(url);
}

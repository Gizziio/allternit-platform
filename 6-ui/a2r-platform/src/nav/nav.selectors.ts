import type { NavState } from './nav.types';

export const selectActiveView = (s: NavState) => {
  const result = s.openViews[s.activeViewId];
  console.log('selectActiveView:', {
    activeViewId: s.activeViewId,
    foundViewType: result?.viewType,
    openViewsKeys: Object.keys(s.openViews),
    timestamp: Date.now()
  });
  return result;
};
export const selectOpenViews = (s: NavState) => Object.values(s.openViews);
export const selectHistory = (s: NavState) => s.history;
export const selectFuture = (s: NavState) => s.future;

export const canGoBack = (s: NavState) => s.history.length > 1;
export const canGoForward = (s: NavState) => s.future.length > 0;

import { describe, expect, it } from 'vitest';
import { createInitialNavState, navReducer } from './nav.store';
import type { ViewType } from './nav.types';

describe('navReducer', () => {
  it('does not throw on an unknown viewType', () => {
    const state = createInitialNavState();
    const next = navReducer(state, {
      type: 'OPEN_VIEW',
      viewType: 'not-a-real-view' as ViewType,
    });
    expect(next).toBe(state);
    expect(next.activeViewId).toBe(state.activeViewId);
  });

  it('opens customize without throwing', () => {
    const state = createInitialNavState();
    const next = navReducer(state, { type: 'OPEN_VIEW', viewType: 'customize' });
    expect(next.activeViewId).toBe('customize');
    expect(next.openViews.customize?.viewType).toBe('customize');
  });

  it('opens the Projects rail alias onto the project view', () => {
    const state = createInitialNavState();
    const next = navReducer(state, { type: 'OPEN_VIEW', viewType: 'projects' as ViewType });
    expect(next.activeViewId).toBe('project');
    expect(next.openViews.project?.viewType).toBe('project');
  });
});

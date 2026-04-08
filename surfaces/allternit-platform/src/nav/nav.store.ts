import { DEFAULT_POLICIES, makeStableViewId } from './nav.policy';
import { goBack, goForward, pushHistory } from './nav.history';
import type { NavEvent, NavState, ViewContext, ViewId, ViewType } from './nav.types';

export function createInitialNavState(): NavState {
  const chatId = makeStableViewId('chat');
  return {
    activeViewId: chatId,
    history: [chatId],
    future: [],
    openViews: {
      [chatId]: { viewId: chatId, viewType: 'chat', title: 'Chat' },
    },
  };
}

function findExistingByType(state: NavState, viewType: ViewType): ViewContext | undefined {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const id = state.history[i];
    const ctx = state.openViews[id];
    if (ctx?.viewType === viewType) return ctx;
  }
  return Object.values(state.openViews).find((v) => v.viewType === viewType);
}

export function navReducer(state: NavState, ev: NavEvent): NavState {
  let newState: NavState;

  switch (ev.type) {
    case 'OPEN_VIEW': {
      const policy = DEFAULT_POLICIES[ev.viewType];
      // In development, fail fast if policy is missing - this should never happen
      // as all ViewTypes must have corresponding policies defined
      if (!policy) {
        throw new Error(
          `[nav.store] No policy defined for viewType: "${ev.viewType}". ` +
          `All ViewType values must have a corresponding entry in DEFAULT_POLICIES. ` +
          `Add the missing policy to nav.policy.ts.`
        );
      }

      const existing = findExistingByType(state, ev.viewType);

      const wantNew = Boolean(ev.allowNew);
      if (!wantNew && existing && (policy.singleton || policy.maxInstances === 1)) {
        return navReducer(state, { type: 'FOCUS_VIEW', viewId: existing.viewId });
      }

      // Stable identity: viewId = capsuleId ?? viewType
      const capsuleId = ev.capsuleId ?? (policy.singleton ? undefined : crypto.randomUUID());
      const viewId: ViewId = makeStableViewId(ev.viewType, capsuleId);

      const ctx: ViewContext = { viewId, viewType: ev.viewType, capsuleId, title: ev.viewType };
      const openViews = { ...state.openViews, [viewId]: ctx };

      const next: NavState = { ...state, openViews, activeViewId: viewId };
      newState = pushHistory(next, viewId);

      return newState;
    }

    case 'FOCUS_VIEW': {
      if (!state.openViews[ev.viewId]) {
        return state;
      }
      if (state.activeViewId === ev.viewId) {
        return state;
      }
      // FOCUS_VIEW activates existing view and pushes to history
      newState = pushHistory({ ...state, activeViewId: ev.viewId }, ev.viewId);
      return newState;
    }

    case 'CLOSE_VIEW': {
      if (!state.openViews[ev.viewId]) return state;
      const openViews = { ...state.openViews };
      delete openViews[ev.viewId];

      let activeViewId = state.activeViewId;
      if (activeViewId === ev.viewId) {
        for (let i = state.history.length - 1; i >= 0; i--) {
          const id = state.history[i];
          if (openViews[id]) { activeViewId = id; break; }
        }
        if (!openViews[activeViewId]) activeViewId = makeStableViewId('chat');
      }
      return { ...state, openViews, activeViewId };
    }

    case 'BACK':
      return goBack(state);

    case 'FORWARD':
      return goForward(state);

    default:
      return state;
  }
}

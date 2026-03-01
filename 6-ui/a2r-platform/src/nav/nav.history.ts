import type { NavState, ViewId } from "./nav.types";

export function pushHistory(state: NavState, next: ViewId): NavState {
  const history = [...state.history, next];
  return { ...state, activeViewId: next, history, future: [] };
}

export function goBack(state: NavState): NavState {
  if (state.history.length <= 1) return state;
  const future = [state.history[state.history.length - 1], ...state.future];
  const history = state.history.slice(0, -1);
  const activeViewId = history[history.length - 1];
  return { ...state, activeViewId, history, future };
}

export function goForward(state: NavState): NavState {
  if (state.future.length === 0) return state;
  const [next, ...rest] = state.future;
  const history = [...state.history, next];
  return { ...state, activeViewId: next, history, future: rest };
}

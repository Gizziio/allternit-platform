import type { DrawerScope } from "../nav/nav.types";
export interface DrawerState { open: boolean; scope: DrawerScope; boundViewId?: string; }
export type DrawerStoreState = Record<'console', DrawerState>;

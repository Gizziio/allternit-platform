export interface ViewLifecycle {
  onActivate?: () => void;
  onDeactivate?: () => void;
  onDispose?: () => void;
}

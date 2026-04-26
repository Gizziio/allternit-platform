import React, { useEffect, useMemo, Component } from "react";
import type { ViewRegistry } from "./registry";
import type { ViewContext } from "../nav/nav.types";
import { assertSinglePrimaryView, assertNoDockingOutsideBrowser } from "../qa/invariants";

// Error boundary to catch render errors in individual views
class ViewRenderBoundary extends Component<
  { viewType: string; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Only log actual errors, not development double-invocation
    if (process.env.NODE_ENV === 'production') {
      console.error(`[ViewHost] Render error in view "${this.props.viewType}":`, error);
    }
  }
  componentDidUpdate(prevProps: { viewType: string }) {
    if (prevProps.viewType !== this.props.viewType && this.state.error) {
      this.setState({ error: null });
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: '#ef4444', background: '#1e1e1e', height: '100%' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            View Error: {this.props.viewType}
          </h2>
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', opacity: 0.8 }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, padding: '8px 16px', background: '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const ViewHost = React.memo(function ViewHost({ active, registry }: { active: ViewContext; registry: ViewRegistry }) {
  const view = useMemo(() => {
    return registry.create(active);
  }, [registry, active.viewId, active.viewType]);

  useEffect(() => {
    assertSinglePrimaryView();
    assertNoDockingOutsideBrowser();
  }, [active.viewId]);

  const Cmp = view.component;

  return (
    <div data-allternit-primary-root data-testid="view-host-wrapper" data-active-view={active.viewType} style={{ height: "100%", width: "100%", position: 'relative', display: 'flex', flex: 1 }}>
      <ViewRenderBoundary key={active.viewId} viewType={active.viewType}>
        <div style={{ width: '100%', height: '100%', flex: 1 }}>
          <Cmp context={active} />
        </div>
      </ViewRenderBoundary>
    </div>
  );
});
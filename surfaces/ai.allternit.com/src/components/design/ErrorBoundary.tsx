"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>
              Something went wrong
            </div>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 16 }}>
              {this.state.error?.message}
            </div>
            <button
              onClick={() => this.setState({ hasError: false })}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-secondary)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

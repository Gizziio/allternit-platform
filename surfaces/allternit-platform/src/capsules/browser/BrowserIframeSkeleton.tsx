"use client";

import { BACKGROUND, BORDER, RADIUS } from "@/design/allternit.tokens";

export function BrowserIframeSkeleton() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BACKGROUND.primary,
        display: "flex",
        flexDirection: "column",
        padding: 24,
        gap: 16,
      }}
    >
      {/* URL bar skeleton */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          className="animate-pulse"
          style={{
            width: 32,
            height: 32,
            borderRadius: RADIUS.full,
            background: BORDER.subtle,
          }}
        />
        <div
          className="animate-pulse"
          style={{
            flex: 1,
            height: 32,
            borderRadius: RADIUS.full,
            background: BORDER.subtle,
          }}
        />
      </div>
      {/* Content skeleton blocks */}
      <div
        className="animate-pulse"
        style={{
          width: "60%",
          height: 24,
          borderRadius: RADIUS.sm,
          background: BORDER.subtle,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          width: "100%",
          height: 160,
          borderRadius: RADIUS.md,
          background: BORDER.subtle,
        }}
      />
      <div style={{ display: "flex", gap: 12 }}>
        <div
          className="animate-pulse"
          style={{
            flex: 1,
            height: 120,
            borderRadius: RADIUS.md,
            background: BORDER.subtle,
          }}
        />
        <div
          className="animate-pulse"
          style={{
            flex: 1,
            height: 120,
            borderRadius: RADIUS.md,
            background: BORDER.subtle,
          }}
        />
      </div>
      <div
        className="animate-pulse"
        style={{
          width: "80%",
          height: 16,
          borderRadius: RADIUS.sm,
          background: BORDER.subtle,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          width: "90%",
          height: 16,
          borderRadius: RADIUS.sm,
          background: BORDER.subtle,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          width: "50%",
          height: 16,
          borderRadius: RADIUS.sm,
          background: BORDER.subtle,
        }}
      />
    </div>
  );
}

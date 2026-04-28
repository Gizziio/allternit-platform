"use client";

import React from "react";
import { motion } from "framer-motion";
import { BACKGROUND, BORDER, RADIUS } from "@/design/allternit.tokens";

function SkeletonLine({ width, height = 12 }: { width: string; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: RADIUS.sm,
        background: BACKGROUND.tertiary,
        animation: "shimmer 1.5s infinite",
        backgroundImage: `linear-gradient(90deg, ${BACKGROUND.tertiary} 0%, ${BACKGROUND.elevated} 50%, ${BACKGROUND.tertiary} 100%)`,
        backgroundSize: "200% 100%",
      }}
    />
  );
}

export function BrowserExtensionSkeleton() {
  return (
    <div className="flex flex-col h-full p-4 space-y-3">
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <SkeletonLine width="32px" height={32} />
          <SkeletonLine width="120px" />
        </div>
        <SkeletonLine width="60px" />
      </div>

      {/* Task banner skeleton */}
      <div
        style={{
          padding: 10,
          borderRadius: RADIUS.md,
          border: `1px solid ${BORDER.subtle}`,
          background: BACKGROUND.secondary,
        }}
      >
        <SkeletonLine width="30px" height={10} />
        <div className="mt-1">
          <SkeletonLine width="100%" />
        </div>
      </div>

      {/* Event cards skeleton */}
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.1 }}
          style={{
            padding: 12,
            borderRadius: RADIUS.md,
            border: `1px solid ${BORDER.subtle}`,
            background: BACKGROUND.secondary,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <SkeletonLine width="60px" height={10} />
          </div>
          <SkeletonLine width="90%" />
          <div className="mt-2">
            <SkeletonLine width="70%" />
          </div>
        </motion.div>
      ))}

      {/* Composer skeleton */}
      <div className="mt-auto pt-2">
        <div
          style={{
            height: 48,
            borderRadius: RADIUS.lg,
            border: `1px solid ${BORDER.subtle}`,
            background: BACKGROUND.secondary,
          }}
        />
      </div>
    </div>
  );
}

import React from "react";
import type { ModelMarkKind } from "@/lib/model-showcase";

/**
 * Hand-drawn-style model marks, in the spirit of the Claude console card art:
 * irregular strokes, round caps, slightly wobbly geometry. One mark per kind.
 */
export function ModelMark({
  kind,
  ink,
  size = 56,
}: {
  kind: ModelMarkKind;
  ink: string;
  size?: number;
}) {
  const stroke = {
    stroke: ink,
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
      {kind === "constellation" && (
        <g {...stroke}>
          <path d="M14.5 35.2c-1.8-4.1-.7-9.1 2.8-11.9 3.6-2.9 9-2.6 12.2.4" />
          <path d="M29.5 23.7c3.8-1.2 8 .5 9.8 4 1.7 3.3.8 7.5-2 9.8" />
          <path d="M37.3 37.5c-2.6 2.3-6.6 2.6-9.5.8-2.6-1.6-4-4.5-3.7-7.4" />
          <circle cx="17" cy="38" r="2.3" />
          <circle cx="39.5" cy="18.5" r="2" />
          <path d="M19 19.5l-3.5-4.2M41 39l3 3.8" />
        </g>
      )}
      {kind === "cursor" && (
        <g {...stroke}>
          <path d="M17 13.5l18.5 11-8.6 3.4 5 9.6-5.4 2.7-4.8-9.8-7.7 5.1z" />
          <path d="M41 35.5c2 1.2 3.2 3 3.5 5.2M14 41c2.6 1.5 5.5 1.8 8.3.8" />
        </g>
      )}
      {kind === "orbit" && (
        <g {...stroke}>
          <circle cx="28" cy="28" r="4.2" />
          <path d="M28 14.5c7.5-.6 13.5 2.6 13.9 7.6.4 4.8-5.2 9.1-12.7 9.7" />
          <path d="M28 41.5c-7.5.6-13.5-2.6-13.9-7.6-.4-4.8 5.2-9.1 12.7-9.7" />
          <circle cx="43" cy="20" r="2" />
          <circle cx="13" cy="36" r="2" />
        </g>
      )}
      {kind === "wing" && (
        <g {...stroke}>
          <path d="M12 34c6-1 10.5-3.8 13.5-8.2 2.5-3.7 3.6-8.2 3.2-12.8 4 2.7 6.2 7 5.9 11.6 3.4-1.4 6.4-1.5 9.3-.2-2 3-5 4.8-8.7 5.3 1.8 1.4 2.7 3.2 2.6 5.4-3-1-5.3-2.8-6.8-5.4-3.5 3-7.7 4.6-12.4 4.9z" />
          <path d="M20 41.5c4.8.8 9.6.2 14-1.9" />
        </g>
      )}
    </svg>
  );
}

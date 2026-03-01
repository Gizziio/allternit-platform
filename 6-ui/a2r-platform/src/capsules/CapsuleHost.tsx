import React from "react";
import type { CapsuleContext } from "./capsule.types";

export function CapsuleHost({ capsule }: { capsule: CapsuleContext }) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 800 }}>Capsule: {capsule.kind}</div>
      <div style={{ opacity: 0.8 }}>Wire real capsule implementations here.</div>
    </div>
  );
}

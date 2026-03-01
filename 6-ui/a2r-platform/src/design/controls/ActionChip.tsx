import React from "react";
export function ActionChip({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 10px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.8)"
    }}>{label}</button>
  );
}

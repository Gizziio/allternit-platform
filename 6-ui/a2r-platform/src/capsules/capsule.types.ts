export type CapsuleKind = "browser" | "chat" | "studio" | "workspace";
export type CapsuleId = string;
export interface CapsuleContext { capsuleId: CapsuleId; kind: CapsuleKind; title?: string; }

import type { CapsuleKind } from "./capsule.types";
import type { ViewType } from "../nav/nav.types";

export function capsuleKindToViewType(kind: CapsuleKind): ViewType {
  switch (kind) {
    case "browser": return "browser";
    case "chat": return "chat";
    case "studio": return "studio";
    case "workspace": return "workspace";
    default: return "workspace";
  }
}

import type { ViewType, ViewContext } from "../nav/nav.types";
import type { ViewLifecycle } from "./ViewLifecycle";
import type React from "react";

export interface ViewInstance {
  id: string;
  type: ViewType;
  title: string;
  context: ViewContext;
  component: React.ComponentType<{ context?: ViewContext }>;
  lifecycle?: ViewLifecycle;
}

export interface ViewRegistry {
  create: (ctx: ViewContext) => ViewInstance;
}

export function createViewRegistry(map: Record<ViewType, React.ComponentType<{ context?: ViewContext }>>): ViewRegistry {
  return {
    create(ctx) {
      const Cmp = map[ctx.viewType];
      if (!Cmp) throw new Error(`No view registered for ${ctx.viewType}`);
      return {
        id: ctx.viewId,
        type: ctx.viewType,
        title: ctx.title ?? ctx.viewType,
        context: ctx,
        component: Cmp,
      };
    },
  };
}

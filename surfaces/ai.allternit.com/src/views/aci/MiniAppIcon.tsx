"use client";

import React, { useState } from "react";
import { Cpu, GearSix, Globe, Lightning } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { getLogosAppsUrl } from "@/lib/design/logos-apps";
import type { InstalledMiniApp } from "./mini-app.types";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  runtime: <Cpu size={18} />,
  connector: <Globe size={18} />,
  data: <Lightning size={18} />,
  tool: <GearSix size={18} />,
  communication: <Globe size={18} />,
  custom: <Globe size={18} />,
};

interface MiniAppIconProps {
  app: InstalledMiniApp;
  size?: number;
  className?: string;
}

export function MiniAppIcon({ app, size = 40, className }: MiniAppIconProps) {
  const [attempt, setAttempt] = useState(0);

  const repoOwner = app.repo ? app.repo.split("/")[0] : undefined;
  const sources = [
    getLogosAppsUrl(app.name),
    repoOwner ? getLogosAppsUrl(repoOwner) : null,
    app.icon,
    repoOwner ? `https://github.com/${repoOwner}.png?size=${size}` : null,
  ].filter(Boolean) as string[];

  if (attempt >= sources.length) {
    return (
      <div
        className={cn(
          "flex size-full items-center justify-center text-[var(--text-tertiary)]",
          className
        )}
      >
        {CATEGORY_ICONS[app.category] ?? <Globe size={size * 0.45} />}
      </div>
    );
  }

  return (
    <img
      src={sources[attempt]}
      alt=""
      width={size}
      height={size}
      className={cn("size-full object-cover", className)}
      onError={() => setAttempt((i) => i + 1)}
    />
  );
}

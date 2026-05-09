"use client";

import React from 'react';
import { ArrowSquareOut, Star } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface AppRecommendation {
  name: string;
  description: string;
  iconUrl?: string;
  category?: string;
  rating?: number;
  installUrl?: string;
  badge?: string;
}

export interface AppRecommendationsProps {
  title?: string;
  apps: AppRecommendation[];
  className?: string;
}

export function AppRecommendations({ title = 'Recommended Apps', apps, className }: AppRecommendationsProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <span className="text-sm font-medium">{title}</span>
      </div>

      {/* App list */}
      <div className="divide-y divide-border/50">
        {apps.map((app, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
            {/* Icon */}
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-muted overflow-hidden">
              {app.iconUrl ? (
                <img src={app.iconUrl} alt={app.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg select-none">{app.name[0]}</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{app.name}</span>
                {app.badge && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                    {app.badge}
                  </span>
                )}
              </div>
              {app.category && (
                <span className="text-[10px] text-muted-foreground">{app.category}</span>
              )}
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{app.description}</p>
              {app.rating != null && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {Array.from({ length: 5 }, (_, idx) => (
                    <Star
                      key={idx}
                      className={cn(
                        "h-3 w-3",
                        idx < Math.floor(app.rating!) ? "text-amber-400" : "text-muted-foreground/30"
                      )}
                      weight={idx < Math.floor(app.rating!) ? "fill" : "regular"}
                    />
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-1">{app.rating.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Install */}
            {app.installUrl && (
              <a
                href={app.installUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors flex-shrink-0"
              >
                <ArrowSquareOut className="h-3 w-3" />
                Install
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

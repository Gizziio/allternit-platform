"use client";

import React from "react";
import { 
  Star, 
  DownloadSimple, 
  Tag,
  Storefront
} from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MarketplaceItem } from "./Marketplace.types";

interface MarketplaceItemCardProps {
  item: MarketplaceItem;
  onInstall: (id: string) => void;
}

export const MarketplaceItemCard: React.FC<MarketplaceItemCardProps> = ({
  item,
  onInstall,
}) => {
  return (
    <Card className="overflow-hidden border-[var(--border-subtle)] bg-[var(--bg-elevated)] transition-all duration-300 hover:border-[var(--border-hover)] hover:bg-[var(--surface-panel)] hover:shadow-lg group h-full flex flex-col">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="size-12 rounded-2xl bg-[var(--bg-primary)] flex items-center justify-center shrink-0 border border-solid border-[var(--border-subtle)] shadow-inner">
              <span className="text-2xl">{item.icon}</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[15px] truncate group-hover:text-[var(--accent-primary)] transition-colors">{item.name}</h3>
              <p className="text-[11px] text-[var(--text-tertiary)] font-medium">by {item.author}</p>
            </div>
          </div>

          <Badge variant={item.price === 'free' ? 'secondary' : 'default'} className="text-[9px] font-bold uppercase tracking-widest h-5">
            {item.price}
          </Badge>
        </div>

        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-6 line-clamp-3">
          {item.description}
        </p>

        <div className="mt-auto flex flex-col gap-4">
          <div className="flex items-center gap-4 text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Star size={14} weight="fill" className="text-yellow-500" />
              {item.rating.toFixed(1)}
            </div>
            <div className="flex items-center gap-1.5">
              <DownloadSimple size={14} weight="bold" />
              {item.installs.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5">
              <Tag size={14} weight="bold" />
              {item.type}
            </div>
          </div>

          <Button
            onClick={() => onInstall(item.id)}
            className="w-full font-bold h-10 bg-[var(--surface-hover)] hover:bg-[var(--accent-primary)] hover:text-[var(--ui-text-inverse)] transition-all duration-300 border-none shadow-sm"
          >
            Add to Workspace
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

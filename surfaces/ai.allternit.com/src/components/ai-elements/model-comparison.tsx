"use client";

import React, { useState } from 'react';
import { Check, X, Minus } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface ModelComparisonFeature {
  name: string;
  description?: string;
  values: Record<string, boolean | string | null>;
}

export interface ModelComparisonModel {
  id: string;
  name: string;
  provider?: string;
  badge?: string;
  highlighted?: boolean;
}

export type ModelComparisonVariant = 'default' | 'compact' | 'hover';

export interface ModelComparisonProps {
  models: ModelComparisonModel[];
  features: ModelComparisonFeature[];
  variant?: ModelComparisonVariant;
  title?: string;
  className?: string;
}

function FeatureValue({ value }: { value: boolean | string | null | undefined }) {
  if (value === true) return <Check className="size-4  text-green-500 mx-auto" />;
  if (value === false) return <X className="size-3.5  text-muted-foreground/50 mx-auto" />;
  if (value == null) return <Minus className="size-3.5  text-muted-foreground/30 mx-auto" />;
  return <span className="text-xs font-medium text-center block">{value}</span>;
}

export function ModelComparison({
  models,
  features,
  variant = 'default',
  title,
  className,
}: ModelComparisonProps) {
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {title && (
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <span className="text-sm font-medium">{title}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-40">
                Feature
              </th>
              {models.map((model) => (
                <th
                  key={model.id}
                  className={cn(
                    "px-3 py-3 text-center min-w-28 transition-colors",
                    model.highlighted && "bg-primary/5",
                    variant === 'hover' && hoveredModel === model.id && "bg-primary/8",
                  )}
                  onMouseEnter={() => variant === 'hover' && setHoveredModel(model.id)}
                  onMouseLeave={() => variant === 'hover' && setHoveredModel(null)}
                >
                  <div className="space-y-0.5">
                    {model.badge && (
                      <div className="inline-flex rounded-full bg-primary px-1.5 py-px text-xs font-bold uppercase tracking-wider text-primary-foreground mb-1">
                        {model.badge}
                      </div>
                    )}
                    <div className="text-xs font-semibold text-foreground">{model.name}</div>
                    {model.provider && variant !== 'compact' && (
                      <div className="text-xs text-muted-foreground">{model.provider}</div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {features.map((feature) => (
              <tr key={feature.name} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="text-xs font-medium text-foreground">{feature.name}</div>
                  {feature.description && variant !== 'compact' && (
                    <div className="text-xs text-muted-foreground mt-0.5">{feature.description}</div>
                  )}
                </td>
                {models.map((model) => (
                  <td
                    key={model.id}
                    className={cn(
                      "px-3 py-2.5 text-center transition-colors",
                      model.highlighted && "bg-primary/5",
                      variant === 'hover' && hoveredModel === model.id && "bg-primary/8",
                    )}
                    onMouseEnter={() => variant === 'hover' && setHoveredModel(model.id)}
                    onMouseLeave={() => variant === 'hover' && setHoveredModel(null)}
                  >
                    <FeatureValue value={feature.values[model.id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from 'react';
import { Clock, Users, ForkKnife, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface RecipeIngredient {
  name: string;
  amount: string;
  unit?: string;
}

export interface RecipeStep {
  description: string;
  durationMinutes?: number;
}

export interface RecipeDraftProps {
  name: string;
  description?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  imageUrl?: string;
  className?: string;
}

export function RecipeDraft({
  name,
  description,
  servings,
  prepTimeMinutes,
  cookTimeMinutes,
  ingredients,
  steps,
  imageUrl,
  className,
}: RecipeDraftProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [servingMultiplier, setServingMultiplier] = useState(1);
  const totalTime = (prepTimeMinutes ?? 0) + (cookTimeMinutes ?? 0);

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {/* Image / Header */}
      {imageUrl ? (
        <div className="relative h-40 overflow-hidden">
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-lg font-semibold text-white">{name}</h3>
            {description && <p className="text-sm text-white/75">{description}</p>}
          </div>
        </div>
      ) : (
        <div className="border-b border-border px-4 py-3 bg-muted/30 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-500/10">
            <ForkKnife className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{name}</h3>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center gap-4 border-b border-border px-4 py-3 bg-muted/10">
        {totalTime > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{totalTime} min</span>
          </div>
        )}
        {servings && (
          <div className="flex items-center gap-2 ml-auto">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              type="button"
              onClick={() => setServingMultiplier(m => Math.max(0.5, m - 0.5))}
              className="rounded px-1.5 py-0.5 text-xs bg-muted hover:bg-muted/80"
            >
              −
            </button>
            <span className="text-xs font-medium tabular-nums">{servings * servingMultiplier}</span>
            <button
              type="button"
              onClick={() => setServingMultiplier(m => m + 0.5)}
              className="rounded px-1.5 py-0.5 text-xs bg-muted hover:bg-muted/80"
            >
              +
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_1.4fr] divide-x divide-border">
        {/* Ingredients */}
        <div className="p-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
            Ingredients
          </h4>
          <ul className="space-y-1.5">
            {ingredients.map((ing, i) => {
              const scaledAmount = Number.parseFloat(ing.amount) * servingMultiplier;
              const display = Number.isNaN(scaledAmount)
                ? ing.amount
                : scaledAmount % 1 === 0
                  ? scaledAmount.toString()
                  : scaledAmount.toFixed(1);
              return (
                <li key={i} className="flex items-baseline gap-1.5 text-xs">
                  <span className="font-medium tabular-nums text-foreground">
                    {display}{ing.unit ? ` ${ing.unit}` : ''}
                  </span>
                  <span className="text-muted-foreground">{ing.name}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Steps */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Steps
            </h4>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {activeStep + 1}/{steps.length}
            </span>
          </div>
          <div className="min-h-[80px]">
            {steps[activeStep] && (
              <p className="text-xs leading-relaxed text-foreground/80">{steps[activeStep].description}</p>
            )}
            {steps[activeStep]?.durationMinutes != null && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                <Clock className="h-3 w-3" />
                {steps[activeStep]!.durationMinutes} min
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              disabled={activeStep === 0}
              onClick={() => setActiveStep(s => s - 1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <CaretLeft className="h-3.5 w-3.5" />
            </button>
            <div className="flex gap-1 flex-1 justify-center">
              {steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveStep(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === activeStep ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              disabled={activeStep === steps.length - 1}
              onClick={() => setActiveStep(s => s + 1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <CaretRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

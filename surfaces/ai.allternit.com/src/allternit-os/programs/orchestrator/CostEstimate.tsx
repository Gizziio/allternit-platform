"use client";

import React from 'react';
import type { OrchestratorState } from '../../types/programs';

interface CostEstimateProps {
  costEstimate?: OrchestratorState['costEstimate'];
  actualCost?: number;
}

export const CostEstimate: React.FC<CostEstimateProps> = ({ costEstimate, actualCost }) => {
  if (!costEstimate) return null;

  const isOverBudget = actualCost && actualCost > costEstimate.estimatedCost;

  return (
    <div className={`p-4 rounded-lg border ${isOverBudget ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'}`}>
      <h4 className={`text-sm font-medium mb-2 ${isOverBudget ? 'text-red-800 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
        {isOverBudget ? '⚠️ Over Budget' : 'Cost Estimate'}
      </h4>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-600 dark:text-zinc-400">Input Tokens:</span>
          <span>{costEstimate.inputTokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600 dark:text-zinc-400">Output Tokens:</span>
          <span>{costEstimate.outputTokens.toLocaleString()}</span>
        </div>
        {actualCost !== undefined && (
          <div className="flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Actual Cost:</span>
            <span className={isOverBudget ? 'text-red-600 font-medium' : ''}>${actualCost.toFixed(4)}</span>
          </div>
        )}
        <div className="flex justify-between font-medium pt-1 border-t border-yellow-200 dark:border-yellow-800">
          <span>Estimated:</span>
          <span>${costEstimate.estimatedCost.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
};

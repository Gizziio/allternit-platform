/**
 * Cost Tracker
 * 
 * Displays budget and cost information:
 * - Per-agent costs
 * - Total budget vs spent
 * - Cost projections
 * - Budget alerts
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  PieChart,
  BarChart3,
} from 'lucide-react';
import type { Agent, BudgetInfo } from '../types';
import { metaSwarmClient } from '../api';

interface CostTrackerProps {
  className?: string;
}

interface CostBreakdownProps {
  agents: Agent[];
}

function CostBreakdown({ agents }: CostBreakdownProps) {
  const sortedAgents = [...agents].sort(
    (a, b) => b.stats.total_cost.estimated_usd - a.stats.total_cost.estimated_usd
  );

  const maxCost = sortedAgents[0]?.stats.total_cost.estimated_usd || 1;

  return (
    <div className="space-y-2">
      {sortedAgents.map((agent) => {
        const percentage = (agent.stats.total_cost.estimated_usd / maxCost) * 100;
        return (
          <div key={agent.id.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate max-w-[150px]">{agent.role.name}</span>
              <span className="font-medium">
                ${agent.stats.total_cost.estimated_usd.toFixed(2)}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CostTracker({ className }: CostTrackerProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [budget, setBudget] = useState<BudgetInfo | null>(null);

  useEffect(() => {
    Promise.all([
      metaSwarmClient.getAgents(),
      metaSwarmClient.getBudgetInfo(),
    ]).then(([agentsData, budgetData]) => {
      setAgents(agentsData);
      setBudget(budgetData);
    });
  }, []);

  const totalSpent = agents.reduce(
    (sum, agent) => sum + agent.stats.total_cost.estimated_usd,
    0
  );

  const totalTokens = agents.reduce(
    (sum, agent) =>
      sum + agent.stats.total_cost.input_tokens + agent.stats.total_cost.output_tokens,
    0
  );

  const budgetUsed = budget ? (budget.spent / budget.allocated) * 100 : 0;
  const isOverBudget = budget ? budget.spent > budget.allocated : false;
  const isNearLimit = budget ? budgetUsed > (budget.alert_threshold * 100) : false;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Tracker
          </div>
          {isOverBudget && (
            <Badge variant="destructive">Over Budget</Badge>
          )}
          {isNearLimit && !isOverBudget && (
            <Badge variant="secondary">Near Limit</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Budget Overview */}
        {budget && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Budget Used</span>
              <span className="font-medium">{budgetUsed.toFixed(1)}%</span>
            </div>
            <Progress 
              value={budgetUsed} 
              className={`h-3 ${isOverBudget ? 'bg-red-200' : isNearLimit ? 'bg-yellow-200' : ''}`}
            />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                ${budget.spent.toFixed(2)} spent
              </span>
              <span className="text-muted-foreground">
                ${budget.allocated.toFixed(2)} allocated
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                ${budget.remaining.toFixed(2)} remaining
              </span>
              <span className="text-muted-foreground">
                ${budget.projected.toFixed(2)} projected
              </span>
            </div>
          </div>
        )}

        {isNearLimit && (
          <Alert className={isOverBudget ? "border-red-500 text-red-500" : "border-yellow-500 text-yellow-600"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {isOverBudget
                ? `Budget exceeded by $${(budget!.spent - budget!.allocated).toFixed(2)}`
                : `Approaching budget limit. ${(100 - budgetUsed).toFixed(0)}% remaining.`}
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              Total Cost
            </div>
            <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              Total Tokens
            </div>
            <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
          </div>
        </div>

        {/* Per-Agent Costs */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <PieChart className="h-4 w-4" />
            Per-Agent Costs
          </div>
          <CostBreakdown agents={agents} />
        </div>
      </CardContent>
    </Card>
  );
}

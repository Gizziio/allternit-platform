/**
 * Auto-Scaling Rules Component
 * 
 * Configure automatic scaling based on metrics:
 * - CPU threshold scaling
 * - Memory threshold scaling
 * - Schedule-based scaling
 * - Custom metric rules
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash,
  PencilSimple,
  Cpu,
  HardDrive,
  Clock,
  TrendUp,
  TrendDown,
  Pulse as Activity,
  Check,
  X,
  Warning,
  Play,
  Pause,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface AutoScalingRule {
  id: string;
  name: string;
  enabled: boolean;
  metric: 'cpu' | 'memory' | 'disk' | 'network' | 'schedule';
  operator: 'gt' | 'lt' | 'eq';
  threshold: number;
  duration: number; // minutes
  action: 'scale_up' | 'scale_down' | 'restart' | 'alert';
  actionValue?: number; // e.g., add/remove N CPUs
  cooldown: number; // minutes
  lastTriggered?: Date;
  triggerCount: number;
}

export interface AutoScalingRulesProps {
  rules: AutoScalingRule[];
  onRulesChange: (rules: AutoScalingRule[]) => void;
  className?: string;
}

const METRIC_LABELS: Record<string, string> = {
  cpu: 'CPU Usage',
  memory: 'Memory Usage',
  disk: 'Disk Usage',
  network: 'Network I/O',
  schedule: 'Schedule',
};

const ACTION_LABELS: Record<string, string> = {
  scale_up: 'Scale Up',
  scale_down: 'Scale Down',
  restart: 'Restart Service',
  alert: 'Send Alert',
};

export function AutoScalingRules({
  rules,
  onRulesChange,
  className,
}: AutoScalingRulesProps) {
  const [editingRule, setEditingRule] = useState<AutoScalingRule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const createNewRule = (): AutoScalingRule => ({
    id: `rule-${Date.now()}`,
    name: 'New Rule',
    enabled: true,
    metric: 'cpu',
    operator: 'gt',
    threshold: 80,
    duration: 5,
    action: 'scale_up',
    actionValue: 1,
    cooldown: 10,
    triggerCount: 0,
  });

  const handleSave = () => {
    if (!editingRule) return;

    const existingIndex = rules.findIndex((r) => r.id === editingRule.id);
    let newRules: AutoScalingRule[];

    if (existingIndex >= 0) {
      newRules = [...rules];
      newRules[existingIndex] = editingRule;
    } else {
      newRules = [...rules, editingRule];
    }

    onRulesChange(newRules);
    setIsDialogOpen(false);
    setEditingRule(null);
  };

  const handleDelete = (ruleId: string) => {
    onRulesChange(rules.filter((r) => r.id !== ruleId));
  };

  const toggleRule = (ruleId: string) => {
    onRulesChange(
      rules.map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      )
    );
  };

  const openNewRule = () => {
    setEditingRule(createNewRule());
    setIsDialogOpen(true);
  };

  const openEditRule = (rule: AutoScalingRule) => {
    setEditingRule({ ...rule });
    setIsDialogOpen(true);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Activity size={16} />
            Auto-Scaling Rules
          </h3>
          <p className="text-xs text-muted-foreground">
            Automatically scale resources based on metrics
          </p>
        </div>
        <Button size="sm" onClick={openNewRule} className="gap-2">
          <Plus size={16} />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card className="bg-muted/50">
          <CardContent className="py-8 text-center">
            <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No auto-scaling rules configured
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Add rules to automatically scale resources
            </p>
            <Button size="sm" variant="outline" onClick={openNewRule} className="mt-3">
              Create your first rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {rules.map((rule) => (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "p-4 rounded-lg border transition-colors",
                  rule.enabled
                    ? "bg-card border-border"
                    : "bg-muted/50 border-muted"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        rule.enabled ? "bg-green-500" : "bg-gray-400"
                      )} />
                      <span className={cn(
                        "font-medium",
                        !rule.enabled && "text-muted-foreground"
                      )}>
                        {rule.name}
                      </span>
                      <Badge variant={rule.enabled ? "default" : "secondary"} className="text-[10px]">
                        {rule.enabled ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mt-1">
                      When{' '}
                      <strong>{METRIC_LABELS[rule.metric]}</strong>
                      {' '}{rule.operator === 'gt' ? '>' : rule.operator === 'lt' ? '<' : '='}{' '}
                      <strong>{rule.threshold}%</strong>
                      {' '}for{' '}
                      <strong>{rule.duration} min</strong>
                      {' '}→{' '}
                      <strong>{ACTION_LABELS[rule.action]}</strong>
                    </p>

                    {rule.triggerCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Triggered {rule.triggerCount} times
                        {rule.lastTriggered && (
                          <> • Last: {new Date(rule.lastTriggered).toLocaleString()}</>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => toggleRule(rule.id)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditRule(rule)}
                      className="h-8 w-8 p-0"
                    >
                      <PencilSimple size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(rule.id)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                    >
                      <Trash size={16} />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Rule Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRule?.id.startsWith('rule-') && rules.find(r => r.id === editingRule.id)
                ? 'Edit Rule'
                : 'New Auto-Scaling Rule'}
            </DialogTitle>
            <DialogDescription>
              Configure when and how to automatically scale resources.
            </DialogDescription>
          </DialogHeader>

          {editingRule && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Rule Name</label>
                <Input
                  value={editingRule.name}
                  onChange={(e) =>
                    setEditingRule({ ...editingRule, name: e.target.value })
                  }
                  placeholder="e.g., High CPU Scale Up"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Metric</label>
                  <Select
                    value={editingRule.metric}
                    onValueChange={(v) =>
                      setEditingRule({ ...editingRule, metric: v as AutoScalingRule['metric'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpu">CPU Usage</SelectItem>
                      <SelectItem value="memory">Memory Usage</SelectItem>
                      <SelectItem value="disk">Disk Usage</SelectItem>
                      <SelectItem value="network">Network I/O</SelectItem>
                      <SelectItem value="schedule">Schedule</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Operator</label>
                  <Select
                    value={editingRule.operator}
                    onValueChange={(v) =>
                      setEditingRule({ ...editingRule, operator: v as AutoScalingRule['operator'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gt">Greater than (&gt;)</SelectItem>
                      <SelectItem value="lt">Less than (&lt;)</SelectItem>
                      <SelectItem value="eq">Equal to (=)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Threshold (%)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={editingRule.threshold}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        threshold: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Duration (min)</label>
                  <Input
                    type="number"
                    min={1}
                    value={editingRule.duration}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        duration: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Action</label>
                <Select
                  value={editingRule.action}
                  onValueChange={(v) =>
                    setEditingRule({ ...editingRule, action: v as AutoScalingRule['action'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scale_up">Scale Up (Add resources)</SelectItem>
                    <SelectItem value="scale_down">Scale Down (Remove resources)</SelectItem>
                    <SelectItem value="restart">Restart Service</SelectItem>
                    <SelectItem value="alert">Send Alert Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(editingRule.action === 'scale_up' || editingRule.action === 'scale_down') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {editingRule.action === 'scale_up' ? 'Add' : 'Remove'} Resources
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={editingRule.actionValue || 1}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        actionValue: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of CPU cores to {editingRule.action === 'scale_up' ? 'add' : 'remove'}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Cooldown (min)</label>
                <Input
                  type="number"
                  min={0}
                  value={editingRule.cooldown}
                  onChange={(e) =>
                    setEditingRule({
                      ...editingRule,
                      cooldown: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Wait time before rule can trigger again
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!editingRule?.name.trim()}>
              <Check className="w-4 h-4 mr-2" />
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

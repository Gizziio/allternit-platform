/**
 * Permission Request Dialog
 * 
 * UI component for trust tier permission requests.
 * Displays when an agent action requires user approval (Tier 3).
 */

import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PermissionRequest } from '@/lib/agents/agent-trust-tiers';

interface PermissionRequestDialogProps {
  request: PermissionRequest | null;
  isOpen: boolean;
  onConfirm: (options: { 
    approved: boolean; 
    rememberChoice?: boolean;
  }) => void;
  onCancel: () => void;
}

/**
 * Get icon based on action type
 */
function getActionIcon(action: string): React.ReactNode {
  const lower = action.toLowerCase();
  
  if (lower.includes('delete') || lower.includes('remove')) {
    return <XCircle className="h-5 w-5 text-red-500" />;
  }
  if (lower.includes('shell') || lower.includes('exec') || lower.includes('run')) {
    return <AlertTriangle className="h-5 w-5 text-orange-500" />;
  }
  if (lower.includes('write') || lower.includes('create')) {
    return <Shield className="h-5 w-5 text-yellow-500" />;
  }
  
  return <Shield className="h-5 w-5 text-blue-500" />;
}

/**
 * Get risk level based on action
 */
function getRiskLevel(action: string): 'low' | 'medium' | 'high' {
  const lower = action.toLowerCase();
  
  if (lower.includes('delete') || lower.includes('remove') || lower.includes('rm ')) {
    return 'high';
  }
  if (lower.includes('shell') || lower.includes('exec') || lower.includes('deploy')) {
    return 'high';
  }
  if (lower.includes('write') || lower.includes('create') || lower.includes('modify')) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Format action for display
 */
function formatAction(action: string): string {
  // Try to parse JSON args
  try {
    const match = action.match(/(\w+)\((.+?)\)$/);
    if (match) {
      const [, toolName, argsJson] = match;
      const args = JSON.parse(argsJson);
      return `${toolName}: ${formatArgs(args)}`;
    }
  } catch {
    // Not JSON, return as-is
  }
  
  return action;
}

/**
 * Format args for display
 */
function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return 'no arguments';
  
  if (entries.length === 1) {
    const [key, value] = entries[0];
    return `${key}=${truncate(String(value), 50)}`;
  }
  
  return entries.map(([k, v]) => `${k}=${truncate(String(v), 20)}`).join(', ');
}

/**
 * Truncate string
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export const PermissionRequestDialog: React.FC<PermissionRequestDialogProps> = ({
  request,
  isOpen,
  onConfirm,
  onCancel,
}) => {
  const [rememberChoice, setRememberChoice] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Auto-cancel countdown for high-risk actions
  useEffect(() => {
    if (!isOpen || !request) {
      setCountdown(null);
      return;
    }

    const risk = getRiskLevel(request.action);
    if (risk === 'high') {
      setCountdown(30); // 30 seconds to decide for high-risk
    }
  }, [isOpen, request]);

  // Countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          // Auto-cancel when countdown reaches 0
          onCancel();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, onCancel]);

  if (!request) return null;

  const riskLevel = getRiskLevel(request.action);
  const icon = getActionIcon(request.action);
  const formattedAction = formatAction(request.action);

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className={cn(
        "max-w-lg",
        riskLevel === 'high' && "border-red-500/50",
        riskLevel === 'medium' && "border-yellow-500/50",
      )}>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            {icon}
            <AlertDialogTitle>
              Permission Required
            </AlertDialogTitle>
          </div>
          
          <AlertDialogDescription className="space-y-4">
            <p>
              The agent wants to perform an action that requires your approval:
            </p>
            
            {/* Action details */}
            <div className={cn(
              "rounded-lg border p-3 text-sm font-mono",
              riskLevel === 'high' && "bg-red-500/10 border-red-500/20",
              riskLevel === 'medium' && "bg-yellow-500/10 border-yellow-500/20",
              riskLevel === 'low' && "bg-blue-500/10 border-blue-500/20",
            )}>
              {formattedAction}
            </div>

            {/* Reason */}
            {request.reason && (
              <p className="text-sm text-muted-foreground">
                <strong>Reason:</strong> {request.reason}
              </p>
            )}

            {/* Risk warning */}
            {riskLevel === 'high' && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span>This is a high-risk action that cannot be undone.</span>
              </div>
            )}

            {/* Countdown */}
            {countdown !== null && (
              <div className="text-sm text-orange-600">
                Auto-canceling in {countdown} seconds...
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          {/* Remember choice checkbox */}
          <div className="flex-1 flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberChoice}
              onCheckedChange={(checked) => setRememberChoice(checked === true)}
            />
            <Label htmlFor="remember" className="text-sm font-normal">
              Remember this choice
            </Label>
          </div>

          <div className="flex gap-2">
            <AlertDialogCancel 
              onClick={onCancel}
              className="border-red-200 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Deny
            </AlertDialogCancel>
            
            <AlertDialogAction
              onClick={() => onConfirm({ approved: true, rememberChoice })}
              className={cn(
                riskLevel === 'high' && "bg-red-600 hover:bg-red-700",
              )}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Allow
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PermissionRequestDialog;

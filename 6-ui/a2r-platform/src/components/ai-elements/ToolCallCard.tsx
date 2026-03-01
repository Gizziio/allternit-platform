import React from 'react';
import { ToolCall } from '../../core/contracts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/button';
import { Shimmer } from './shimmer';
import { CodeBlock } from './code-block';
import { 
  Wrench, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Play,
  Check,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolCallCardProps {
  toolCall: ToolCall;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function ToolCallCard({ toolCall, onApprove, onReject }: ToolCallCardProps) {
  const { status, approval, name, arguments: args, result, error } = toolCall;

  return (
    <Card className="overflow-hidden border-border/50 shadow-sm">
      <CardHeader className="py-3 px-4 bg-muted/30 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{toolCall.displayName || name}</CardTitle>
          <StatusBadge status={status} />
        </div>
        {approval?.riskTier && (
          <div className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
            approval.riskTier === 'safe' && "bg-green-500/10 text-green-600",
            approval.riskTier === 'low' && "bg-blue-500/10 text-blue-600",
            approval.riskTier === 'medium' && "bg-yellow-500/10 text-yellow-600",
            approval.riskTier === 'high' && "bg-orange-500/10 text-orange-600",
            approval.riskTier === 'critical' && "bg-red-500/10 text-red-600",
          )}>
            {approval.riskTier} RISK
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Arguments Section */}
        <div className="p-4 space-y-2">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Arguments</div>
          <div className="rounded-md overflow-hidden border">
            <CodeBlock code={JSON.stringify(args, null, 2)} language="json" />
          </div>
        </div>

        {/* Approval UI */}
        {status === 'pending' && approval?.required && (
          <div className="px-4 py-3 bg-amber-500/5 border-t border-b border-amber-500/10 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-amber-600 text-xs font-medium">
              <AlertTriangle className="w-4 h-4" />
              This action requires your approval
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 h-8 text-xs border-red-200 hover:bg-red-50"
                onClick={() => onReject?.(toolCall.id)}
              >
                <X className="w-3.5 h-3.5 mr-1.5" /> Reject
              </Button>
              <Button 
                size="sm" 
                className="flex-1 h-8 text-xs bg-accent-chat hover:bg-accent-chat/90"
                onClick={() => onApprove?.(toolCall.id)}
              >
                <Check className="w-3.5 h-3.5 mr-1.5" /> Approve & Run
              </Button>
            </div>
          </div>
        )}

        {/* Running State */}
        {status === 'running' && (
          <div className="px-4 py-3 border-t bg-blue-500/5 flex items-center gap-3">
            <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
            <div className="flex-1">
              <div className="text-xs font-medium text-blue-600">Executing...</div>
              <Shimmer className="h-1.5 w-full mt-2" />
            </div>
          </div>
        )}

        {/* Result Section */}
        {status === 'completed' && result && (
          <div className="p-4 border-t bg-green-500/5 space-y-2">
            <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Result</div>
            <div className="rounded-md overflow-hidden border border-green-200/50">
              <CodeBlock code={JSON.stringify(result, null, 2)} language="json" />
            </div>
          </div>
        )}

        {/* Error Section */}
        {status === 'error' && error && (
          <div className="p-4 border-t bg-red-500/5 space-y-2">
            <div className="flex items-center gap-2 text-red-600 text-[10px] font-bold uppercase tracking-wider">
              <XCircle className="w-3 h-3" />
              Execution Failed
            </div>
            <div className="p-3 rounded-md bg-red-50 border border-red-100 text-xs text-red-700 font-mono">
              {error.message}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ToolCall['status'] }) {
  const configs = {
    pending: { icon: Clock, color: "text-muted-foreground", label: "Pending" },
    approved: { icon: Play, color: "text-blue-500", label: "Approved" },
    rejected: { icon: XCircle, color: "text-red-500", label: "Rejected" },
    running: { icon: Clock, color: "text-blue-500 animate-spin", label: "Running" },
    completed: { icon: CheckCircle, color: "text-green-500", label: "Completed" },
    error: { icon: XCircle, color: "text-red-500", label: "Error" },
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted border text-[10px] font-medium", config.color)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </div>
  );
}

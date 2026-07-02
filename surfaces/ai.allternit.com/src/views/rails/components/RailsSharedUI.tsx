import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color = "gray" 
}: { 
  title: string; 
  value: string | number; 
  icon: any; 
  color?: "green" | "blue" | "purple" | "gray" | "red"; 
}) {
  const colorClasses = {
    green: "text-green-500 bg-green-500/10",
    blue: "text-blue-500 bg-blue-500/10",
    purple: "text-purple-500 bg-purple-500/10",
    red: "text-red-500 bg-red-500/10",
    gray: "text-muted-foreground bg-muted",
  };

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", colorClasses[color])}>
          <Icon size={20} weight="duotone" />
        </div>
        <div>
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            {title}
          </div>
          <div className="text-xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ 
  message, 
  description, 
  icon: Icon, 
  action 
}: { 
  message: string; 
  description?: string; 
  icon: any; 
  action?: React.ReactNode; 
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="size-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4 opacity-50">
        <Icon size={32} weight="thin" />
      </div>
      <h3 className="text-sm font-semibold mb-1">{message}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mb-4 max-w-[240px]">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { 
  Shield, 
  ThumbsUp, 
  ThumbsDown,
  Robot,
  Warning,
  CheckCircle
} from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "../components/RailsSharedUI";
import { cn } from "@/lib/utils";

export function GlobalReviewCenter({ agents, reviews, onSelectAgent }: any) {
  if (agents.length === 0) {
    return (
      <EmptyState 
        message="No Agents" 
        description="Create an agent to start reviewing gate decisions."
        icon={Shield}
      />
    );
  }
  
  return (
    <div className="space-y-4">
      {agents.map((agent: any) => {
        const count = (reviews[agent.id] || []).filter((r: any) => r.status === 'pending').length;
        return (
          <Card key={agent.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onSelectAgent(agent.id)}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
                  <Robot size={18} />
                </div>
                <span className="font-semibold">{agent.name}</span>
              </div>
              {count > 0 ? (
                <Badge variant="destructive" className="animate-pulse">{count} pending</Badge>
              ) : (
                <Badge variant="secondary" className="opacity-50">0 pending</Badge>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function AgentReviewCenter({ 
  agent, 
  reviews, 
  onSubmitDecision, 
  onBack 
}: any) {
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [note, setNote] = useState("");
  const pendingReviews = reviews.filter((r: any) => r.status === 'pending');

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
      
      <div className="flex gap-4 h-[600px]">
        <div className="w-80 border-r border-solid pr-4 flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 px-2">
            Pending Reviews ({pendingReviews.length})
          </h3>
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {pendingReviews.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground italic text-xs">
                  All reviews complete
                </div>
              ) : (
                pendingReviews.map((review: any) => (
                  <button type="button" 
                    key={review.id} 
                    className={cn(
                      "w-full text-left p-3 rounded-lg border border-solid transition-all cursor-pointer",
                      selectedReview?.id === review.id 
                        ? "border-primary bg-primary/10 shadow-sm" 
                        : "border-transparent bg-transparent hover:bg-muted"
                    )}
                    onClick={() => setSelectedReview(review)}
                  >
                    <div className="font-bold text-[13px] mb-1">{review.title}</div>
                    <Badge 
                      variant={review.severity === 'critical' ? 'destructive' : 'secondary'} 
                      className="text-[9px] h-3 px-1"
                    >
                      {review.severity.toUpperCase()}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 min-w-0">
          {selectedReview ? (
            <Card className="animate-in fade-in slide-in-from-right-4 duration-300">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Decision Gate</CardTitle>
                  <Badge variant={selectedReview.severity === 'critical' ? 'destructive' : 'secondary'}>
                    {selectedReview.severity}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Description</div>
                  <p className="text-sm leading-relaxed text-zinc-300">{selectedReview.description}</p>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Warning size={12} className="text-yellow-500" /> Proposed Action
                  </div>
                  <div className="p-3 rounded-lg bg-black/40 border border-solid border-white/5 font-mono text-[13px] text-zinc-300 shadow-inner">
                    {selectedReview.proposedAction}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Decision Note</div>
                  <Textarea 
                    value={note} 
                    onChange={e => setNote(e.target.value)} 
                    placeholder="Add rationale for your decision (optional)…" 
                    rows={3} 
                    className="text-sm resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button 
                    onClick={() => { onSubmitDecision(selectedReview.id, true, note); setSelectedReview(null); setNote(""); }} 
                    className="flex-1 font-bold h-11 bg-green-600 hover:bg-green-700"
                  >
                    <ThumbsUp className="size-5  mr-2" weight="fill" /> Approve
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => { onSubmitDecision(selectedReview.id, false, note); setSelectedReview(null); setNote(""); }} 
                    className="flex-1 font-bold h-11"
                  >
                    <ThumbsDown className="size-5  mr-2" weight="fill" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center border border-dashed rounded-xl opacity-50">
              <EmptyState 
                message="Select a review to proceed" 
                icon={Shield} 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

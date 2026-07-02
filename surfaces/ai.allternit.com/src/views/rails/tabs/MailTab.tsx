"use client";

import React, { useState } from "react";
import { 
  EnvelopeSimple, 
  PaperPlaneTilt, 
  Robot,
  Plus,
  Trash
} from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "../components/RailsSharedUI";
import { cn } from "@/lib/utils";

export function GlobalMailCenter({ agents, mail, onSelectAgent }: any) {
  if (agents.length === 0) {
    return (
      <EmptyState 
        message="No Agents" 
        description="Create an agent to start sending and receiving mail."
        icon={EnvelopeSimple}
      />
    );
  }
  
  return (
    <div className="space-y-4">
      {agents.map((agent: any) => {
        const unreadCount = (mail[agent.id] || []).filter((m: any) => m.status === 'unread').length;
        return (
          <Card key={agent.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onSelectAgent(agent.id)}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
                  <Robot size={18} />
                </div>
                <span className="font-semibold">{agent.name}</span>
              </div>
              {unreadCount > 0 && <Badge variant="destructive" className="animate-pulse">{unreadCount} unread</Badge>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function AgentMailCenter({ 
  agent, 
  mail, 
  threads, 
  agents, 
  selectedThreadId, 
  onSelectThread, 
  onSendMail, 
  onAcknowledge, 
  onBack 
}: any) {
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const threadMessages = selectedThreadId ? mail.filter((m: any) => m.threadId === selectedThreadId) : mail;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
        <Button size="sm" variant={showCompose ? "outline" : "default"} onClick={() => setShowCompose(!showCompose)}>
          {showCompose ? "Cancel" : <><PaperPlaneTilt size={16} className="mr-2" /> Compose</>}
        </Button>
      </div>

      <div className="flex gap-4 h-[600px]">
        <div className="w-72 border-r border-solid pr-4 flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 px-2">Threads</h3>
          <ScrollArea className="flex-1">
            <div className="space-y-1">
              {threads.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No active threads</p>
              ) : (
                threads.map((thread: any) => (
                  <button type="button" 
                    key={thread.id} 
                    className={`w-full text-left p-3 rounded-lg border-none cursor-pointer transition-all ${selectedThreadId === thread.id ? 'bg-primary/10 text-primary font-bold shadow-sm' : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'}`} 
                    onClick={() => onSelectThread(thread.id)}
                  >
                    <div className="text-[13px] truncate">{thread.subject}</div>
                    {thread.unreadCount > 0 && <Badge variant="destructive" className="text-[10px] h-4 mt-1">{thread.unreadCount} new</Badge>}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 min-w-0">
          {showCompose ? (
            <Card className="animate-in fade-in slide-in-from-right-4 duration-300">
              <CardHeader><CardTitle className="text-base">Compose Message</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="mail-to" className="text-xs font-semibold">Recipient</label>
                  <Select value={composeTo} onValueChange={setComposeTo}>
                    <SelectTrigger><SelectValue placeholder="Select an agent" /></SelectTrigger>
                    <SelectContent>
                      {agents.filter((a: any) => a.id !== agent.id).map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="mail-subject" className="text-xs font-semibold">Subject</label>
                  <Input id="mail-subject" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Topic of discussion" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="mail-body" className="text-xs font-semibold">Message</label>
                  <Textarea id="mail-body" value={composeBody} onChange={e => setComposeBody(e.target.value)} rows={8} className="text-sm resize-none" />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button 
                    onClick={() => { onSendMail(agent.id, composeTo, composeSubject, composeBody); setShowCompose(false); }} 
                    disabled={!composeTo || !composeSubject || !composeBody.trim()}
                    className="px-6 font-bold"
                  >
                    <PaperPlaneTilt size={16} className="mr-2" /> Send
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-4 pb-20">
                {threadMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground italic text-sm py-20">
                    Select a thread to read messages
                  </div>
                ) : (
                  threadMessages.map((message: any) => (
                    <Card key={message.id} className={cn("transition-all", message.status === 'unread' ? 'border-primary/50 bg-primary/5' : 'bg-muted/30')}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-sm">{message.subject}</span>
                              {message.status === 'unread' && <Badge variant="default" className="text-[9px] h-3 px-1">NEW</Badge>}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                              From: <span className="font-semibold text-primary">{message.fromAgentName || message.fromAgentId}</span>
                            </div>
                            <p className="text-sm mt-3 leading-relaxed text-zinc-300">{message.body}</p>
                          </div>
                          {message.requiresAck && message.status !== 'acknowledged' && (
                            <Button size="sm" variant="outline" className="shrink-0 font-bold border-primary/30 text-primary hover:bg-primary/10" onClick={() => onAcknowledge(agent.id, message.id)}>
                              Acknowledge
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}

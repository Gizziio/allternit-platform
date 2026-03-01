"use client";

import { useState, useEffect, useCallback } from "react";
import { useAgentStore } from "@/lib/agents";
import type { Agent } from "@/lib/agents";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Play, Square, Pause, Activity, CheckCircle, Clock, Loader2, Bot, Circle,
  Zap, Mail, Send, Save, Shield, Eye, Plus, Trash2, Undo2, ThumbsUp, ThumbsDown,
  LayoutList, ListTodo, Key, RefreshCw, AlertTriangle, Download, FileText,
  GitBranch, Workflow
} from "lucide-react";

export function RailsView() {
  const {
    agents, runs, tasks, checkpoints, commits, queue, mail, mailThreads, reviews,
    activeRunId, activeRunOutput, activeRunTrace, isLoadingRuns, isLoadingMail, isLoadingReviews,
    fetchAgents, fetchRuns, fetchTasks, fetchCheckpoints, fetchCommits, fetchQueue,
    fetchMail, fetchMailThreads, fetchReviews, startRun, cancelRun, pauseRun, resumeRun,
    createCheckpoint, restoreCheckpoint, enqueue, dequeue, sendMail, acknowledgeMail,
    submitReviewDecision, selectThread, selectedThreadId
  } = useAgentStore();

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  useEffect(() => { fetchAgents(); fetchQueue(); }, [fetchAgents, fetchQueue]);
  useEffect(() => {
    if (selectedAgentId) {
      fetchRuns(selectedAgentId); fetchTasks(selectedAgentId); fetchCheckpoints(selectedAgentId);
      fetchCommits(selectedAgentId); fetchMail(selectedAgentId); fetchMailThreads(selectedAgentId); fetchReviews(selectedAgentId);
    }
  }, [selectedAgentId, fetchRuns, fetchTasks, fetchCheckpoints, fetchCommits, fetchMail, fetchMailThreads, fetchReviews]);

  const allRuns = Object.values(runs).flat();
  const activeRuns = allRuns.filter((r: any) => r.status === 'running');
  const selectedAgent = agents.find((a: Agent) => a.id === selectedAgentId);

  return (
    <div className="flex h-full">
      <div className="w-72 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b bg-background">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <LayoutList className="w-5 h-5 text-primary" />
            Rails System
          </h2>
          <p className="text-sm text-muted-foreground">Control Center</p>
        </div>
        <div className="p-3 border-b">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 p-2 rounded bg-green-500/10">
              <Activity className="w-4 h-4 text-green-500" />
              <span className="font-medium">{activeRuns.length}</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-blue-500/10">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="font-medium">{queue.length}</span>
            </div>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            <AgentListItem id={null} name="All Agents" count={allRuns.length} isSelected={selectedAgentId === null} onClick={() => setSelectedAgentId(null)} icon={LayoutList} />
            <Separator className="my-2" />
            {agents.map((agent: Agent) => {
              const agentRuns = runs[agent.id] || [];
              const active = agentRuns.filter((r: any) => r.status === 'running').length;
              return <AgentListItem key={agent.id} id={agent.id} name={agent.name} count={agentRuns.length} activeCount={active} isSelected={selectedAgentId === agent.id} onClick={() => setSelectedAgentId(agent.id)} icon={Bot} />;
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="px-4 pt-4 pb-2 border-b">
          <Tabs defaultValue="control" className="w-full">
            <TabsList className="w-full justify-start bg-muted/50 p-1 rounded-lg border h-auto flex-wrap gap-1">
              <TabsTrigger value="control" className="flex items-center gap-1 px-3 py-1.5"><Zap className="w-4 h-4" /> Control</TabsTrigger>
              <TabsTrigger value="mail" className="flex items-center gap-1 px-3 py-1.5"><Mail className="w-4 h-4" /> Mail {Object.values(mail).flat().filter((m: any) => m.status === 'unread').length > 0 && <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">{Object.values(mail).flat().filter((m: any) => m.status === 'unread').length}</Badge>}</TabsTrigger>
              <TabsTrigger value="checkpoints" className="flex items-center gap-1 px-3 py-1.5"><Save className="w-4 h-4" /> Checkpoints</TabsTrigger>
              <TabsTrigger value="reviews" className="flex items-center gap-1 px-3 py-1.5"><Shield className="w-4 h-4" /> Reviews {Object.values(reviews).flat().filter((r: any) => r.status === 'pending').length > 0 && <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">{Object.values(reviews).flat().filter((r: any) => r.status === 'pending').length}</Badge>}</TabsTrigger>
              <TabsTrigger value="observability" className="flex items-center gap-1 px-3 py-1.5"><Eye className="w-4 h-4" /> Observability</TabsTrigger>
              <TabsTrigger value="leases" className="flex items-center gap-1 px-3 py-1.5"><Key className="w-4 h-4" /> Leases</TabsTrigger>
              <TabsTrigger value="dags" className="flex items-center gap-1 px-3 py-1.5"><GitBranch className="w-4 h-4" /> DAGs</TabsTrigger>
            </TabsList>

            <TabsContent value="control" className="flex-1 p-4 m-0 overflow-auto min-h-[500px]">
              {selectedAgentId === null ? (
                <GlobalControlCenter agents={agents} activeRuns={activeRuns} queue={queue} allRuns={allRuns} onSelectAgent={setSelectedAgentId} />
              ) : selectedAgent ? (
                <AgentControlTab agent={selectedAgent} runs={runs[selectedAgent.id] || []} queue={queue} activeRunId={activeRunId} activeRunOutput={activeRunOutput} onBack={() => setSelectedAgentId(null)} onStartRun={startRun} onCancelRun={cancelRun} onPauseRun={pauseRun} onResumeRun={resumeRun} onEnqueue={enqueue} onDequeue={dequeue} />
              ) : null}
            </TabsContent>

            <TabsContent value="mail" className="flex-1 p-4 m-0 overflow-hidden min-h-[500px]">
              {selectedAgentId === null ? (
                <GlobalMailCenter agents={agents} mail={mail} onSelectAgent={setSelectedAgentId} />
              ) : selectedAgent ? (
                <AgentMailCenter agent={selectedAgent} mail={mail[selectedAgent.id] || []} threads={mailThreads[selectedAgent.id] || []} agents={agents} selectedThreadId={selectedThreadId} onSelectThread={selectThread} onSendMail={sendMail} onAcknowledge={acknowledgeMail} onBack={() => setSelectedAgentId(null)} />
              ) : null}
            </TabsContent>

            <TabsContent value="checkpoints" className="flex-1 p-4 m-0 overflow-auto min-h-[500px]">
              {selectedAgentId === null ? (
                <GlobalCheckpointCenter agents={agents} checkpoints={checkpoints} onSelectAgent={setSelectedAgentId} />
              ) : selectedAgent ? (
                <AgentCheckpointCenter agent={selectedAgent} checkpoints={checkpoints[selectedAgent.id] || []} runs={runs[selectedAgent.id] || []} onCreate={createCheckpoint} onRestore={restoreCheckpoint} onBack={() => setSelectedAgentId(null)} />
              ) : null}
            </TabsContent>

            <TabsContent value="reviews" className="flex-1 p-4 m-0 overflow-auto min-h-[500px]">
              {selectedAgentId === null ? (
                <GlobalReviewCenter agents={agents} reviews={reviews} onSelectAgent={setSelectedAgentId} />
              ) : selectedAgent ? (
                <AgentReviewCenter agent={selectedAgent} reviews={reviews[selectedAgent.id] || []} onSubmitDecision={submitReviewDecision} onBack={() => setSelectedAgentId(null)} />
              ) : null}
            </TabsContent>

            <TabsContent value="observability" className="flex-1 p-4 m-0 overflow-hidden min-h-[500px]">
              {selectedAgentId === null ? (
                <GlobalObservabilityCenter agents={agents} runs={runs} onSelectAgent={setSelectedAgentId} />
              ) : selectedAgent ? (
                <AgentObservabilityCenter agent={selectedAgent} runs={runs[selectedAgent.id] || []} traces={activeRunTrace} onBack={() => setSelectedAgentId(null)} />
              ) : null}
            </TabsContent>

            <TabsContent value="leases" className="flex-1 p-4 m-0 overflow-auto min-h-[500px]">
              {selectedAgentId === null ? (
                <GlobalLeaseCenter agents={agents} onSelectAgent={setSelectedAgentId} />
              ) : selectedAgent ? (
                <AgentLeaseCenter agent={selectedAgent} onBack={() => setSelectedAgentId(null)} />
              ) : null}
            </TabsContent>

            <TabsContent value="dags" className="flex-1 p-4 m-0 overflow-auto min-h-[500px]">
              {selectedAgentId === null ? (
                <GlobalDagCenter agents={agents} onSelectAgent={setSelectedAgentId} />
              ) : selectedAgent ? (
                <AgentDagCenter agent={selectedAgent} onBack={() => setSelectedAgentId(null)} />
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function AgentListItem({ id, name, count, activeCount, isSelected, onClick, icon: Icon }: any) {
  return (
    <div className={`p-3 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-primary/10 border border-primary/30 shadow-sm' : 'hover:bg-muted border border-transparent'}`} onClick={onClick}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className="font-medium text-sm truncate flex-1">{name}</span>
        {activeCount > 0 && <Loader2 className="w-3 h-3 animate-spin text-green-500" />}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground">{count} runs</span>
        {activeCount > 0 && <Badge variant="default" className="text-[10px] h-4">{activeCount} active</Badge>}
      </div>
    </div>
  );
}

function AgentControlTab({ agent, runs, queue, activeRunId, activeRunOutput, onBack, onStartRun, onCancelRun, onEnqueue, onDequeue }: any) {
  const [executionInput, setExecutionInput] = useState("");
  const [newQueueItem, setNewQueueItem] = useState("");
  const activeRun = runs.find((r: any) => r.id === activeRunId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={onBack}>← Back to All Agents</Button>
        <Badge variant={agent.status === 'running' ? 'default' : 'secondary'}>{agent.status}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4" /> Execution</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!activeRun || activeRun.status !== 'running' ? (
              <>
                <Textarea value={executionInput} onChange={e => setExecutionInput(e.target.value)} placeholder={`Task for ${agent.name}...`} className="min-h-[100px]" />
                <Button onClick={() => onStartRun(agent.id, executionInput).then(() => setExecutionInput(""))} disabled={!executionInput.trim()} className="w-full"><Play className="w-4 h-4 mr-2" /> Start</Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-lg border bg-muted/50">
                  <div className="text-sm font-medium">Current Task</div>
                  <div className="text-sm text-muted-foreground">{activeRun.input}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={() => onCancelRun(agent.id, activeRun.id)} className="flex-1"><Square className="w-4 h-4 mr-1" /> Stop</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ListTodo className="w-4 h-4" /> Queue ({queue.filter((q: any) => q.agentId === agent.id).length})</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={newQueueItem} onChange={e => setNewQueueItem(e.target.value)} placeholder="Add to queue..." onKeyDown={e => { if (e.key === 'Enter' && newQueueItem.trim()) { onEnqueue(newQueueItem, 0, agent.id); setNewQueueItem(""); } }} />
              <Button size="icon" disabled={!newQueueItem.trim()} onClick={() => { onEnqueue(newQueueItem, 0, agent.id); setNewQueueItem(""); }}><Plus className="w-4 h-4" /></Button>
            </div>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {queue.filter((q: any) => q.agentId === agent.id).length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Queue empty</p> : queue.filter((q: any) => q.agentId === agent.id).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                    <span className="text-sm flex-1 truncate">{item.content || item.task}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onDequeue(item.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Live Output</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] w-full rounded border bg-muted/30 p-4">
            <pre className="text-sm font-mono whitespace-pre-wrap">{activeRunOutput || "(No active execution)"}</pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function GlobalControlCenter({ agents, activeRuns, queue, allRuns, onSelectAgent }: any) {
  const orchestrators = agents.filter((a: Agent) => a.type === 'orchestrator');
  
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center p-8">
        <Bot className="w-16 h-16 text-muted-foreground mb-4 opacity-30" />
        <h3 className="text-xl font-semibold mb-2">No Agents Yet</h3>
        <p className="text-muted-foreground mb-6 max-w-md">
          Create your first agent to start using the Rails System. Agents can execute tasks, send mail, save checkpoints, and more.
        </p>
        <Button onClick={() => window.location.href = '/agent?create=true'}>
          <Plus className="w-4 h-4 mr-2" />
          Create First Agent
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Active Runs" value={activeRuns.length} icon={Activity} color="green" />
        <StatCard title="Queued" value={queue.length} icon={Clock} color="blue" />
        <StatCard title="Total Agents" value={agents.length} icon={Bot} color="purple" />
        <StatCard title="Total Runs" value={allRuns.length} icon={CheckCircle} color="gray" />
      </div>
      {orchestrators.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Orchestrators</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {orchestrators.map((orch: Agent) => <Badge key={orch.id} variant="secondary" className="cursor-pointer px-3 py-1" onClick={() => onSelectAgent(orch.id)}><Bot className="w-3 h-3 mr-1" />{orch.name}</Badge>)}
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">Active Executions</CardTitle></CardHeader>
        <CardContent>
          {activeRuns.length === 0 ? <EmptyState message="No active runs" icon={Circle} /> : (
            <div className="space-y-2">
              {activeRuns.map((run: any) => (
                <div key={run.id} className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => onSelectAgent(run.agentId)}>
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-green-500" />
                    <span className="font-medium text-sm truncate">{run.input}</span>
                    <Badge variant="outline" className="ml-auto">{new Date(run.startedAt).toLocaleTimeString()}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentMailCenter({ agent, mail, threads, agents, selectedThreadId, onSelectThread, onSendMail, onAcknowledge, onBack }: any) {
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const threadMessages = selectedThreadId ? mail.filter((m: any) => m.threadId === selectedThreadId) : mail;

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
      <div className="flex gap-4 h-[500px]">
        <div className="w-64 border-r pr-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Threads</h3>
            <Button size="sm" variant="ghost" onClick={() => setShowCompose(true)}><Send className="w-4 h-4" /></Button>
          </div>
          <ScrollArea className="h-full">
            {threads.map((thread: any) => (
              <div key={thread.id} className={`p-3 rounded-lg cursor-pointer mb-2 ${selectedThreadId === thread.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted border border-transparent'}`} onClick={() => onSelectThread(thread.id)}>
                <div className="font-medium text-sm truncate">{thread.subject}</div>
                {thread.unreadCount > 0 && <Badge variant="destructive" className="text-[10px] mt-1">{thread.unreadCount} unread</Badge>}
              </div>
            ))}
          </ScrollArea>
        </div>
        <div className="flex-1">
          {showCompose ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Compose</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Select value={composeTo} onValueChange={setComposeTo}>
                  <SelectTrigger><SelectValue placeholder="To" /></SelectTrigger>
                  <SelectContent>{agents.filter((a: any) => a.id !== agent.id).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject" />
                <Textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} rows={5} />
                <div className="flex gap-2">
                  <Button onClick={() => { onSendMail(agent.id, composeTo, composeSubject, composeBody); setShowCompose(false); }} disabled={!composeTo || !composeSubject}>Send</Button>
                  <Button variant="outline" onClick={() => setShowCompose(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-4">
                {threadMessages.map((message: any) => (
                  <Card key={message.id} className={message.status === 'unread' ? 'border-primary/50 bg-primary/5' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{message.subject}</div>
                          <div className="text-sm text-muted-foreground">From: {message.fromAgentName || message.fromAgentId}</div>
                          <p className="text-sm mt-2">{message.body}</p>
                        </div>
                        {message.requiresAck && message.status !== 'acknowledged' && (
                          <Button size="sm" variant="outline" onClick={() => onAcknowledge(agent.id, message.id)}>Ack</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}

function GlobalMailCenter({ agents, mail, onSelectAgent }: any) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center p-8">
        <Mail className="w-16 h-16 text-muted-foreground mb-4 opacity-30" />
        <h3 className="text-xl font-semibold mb-2">No Agents</h3>
        <p className="text-muted-foreground">Create an agent to start sending and receiving mail.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {agents.map((agent: any) => {
        const unreadCount = (mail[agent.id] || []).filter((m: any) => m.status === 'unread').length;
        return (
          <Card key={agent.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectAgent(agent.id)}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><Bot className="w-4 h-4" /><span className="font-medium">{agent.name}</span></div>
              {unreadCount > 0 && <Badge variant="destructive">{unreadCount} unread</Badge>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AgentCheckpointCenter({ agent, checkpoints, runs, onCreate, onRestore, onBack }: any) {
  const [newLabel, setNewLabel] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
      <Card>
        <CardHeader><CardTitle className="text-base">Create Checkpoint</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select value={selectedRunId} onValueChange={setSelectedRunId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select run" /></SelectTrigger>
              <SelectContent>{runs.map((run: any) => <SelectItem key={run.id} value={run.id}>{run.input?.substring(0, 30)}...</SelectItem>)}</SelectContent>
            </Select>
            <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label" className="flex-1" />
            <Button onClick={() => { onCreate(agent.id, selectedRunId, newLabel, {}); setNewLabel(""); }} disabled={!newLabel || !selectedRunId}><Save className="w-4 h-4 mr-2" />Save</Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-4">
        {checkpoints.map((cp: any) => (
          <Card key={cp.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2"><Save className="w-4 h-4 text-blue-500" /><span className="font-medium">{cp.label}</span></div>
              <p className="text-xs text-muted-foreground">{new Date(cp.createdAt).toLocaleString()}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => onRestore(agent.id, cp.id)} disabled={cp.restored}><Undo2 className="w-3 h-3 mr-1" />Restore</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function GlobalCheckpointCenter({ agents, checkpoints, onSelectAgent }: any) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center p-8">
        <Save className="w-16 h-16 text-muted-foreground mb-4 opacity-30" />
        <h3 className="text-xl font-semibold mb-2">No Agents</h3>
        <p className="text-muted-foreground">Create an agent to start saving and restoring checkpoints.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {agents.map((agent: any) => (
        <Card key={agent.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectAgent(agent.id)}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2"><Bot className="w-4 h-4" /><span className="font-medium">{agent.name}</span></div>
            <Badge variant="secondary">{(checkpoints[agent.id] || []).length} checkpoints</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AgentReviewCenter({ agent, reviews, onSubmitDecision, onBack }: any) {
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [note, setNote] = useState("");
  const pendingReviews = reviews.filter((r: any) => r.status === 'pending');

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
      <div className="flex gap-4 h-[500px]">
        <div className="w-80 border-r pr-4">
          <h3 className="font-medium mb-4">Pending ({pendingReviews.length})</h3>
          <ScrollArea className="h-full">
            {pendingReviews.map((review: any) => (
              <div key={review.id} className={`p-3 rounded-lg cursor-pointer mb-2 border ${selectedReview?.id === review.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`} onClick={() => setSelectedReview(review)}>
                <div className="font-medium text-sm">{review.title}</div>
                <Badge variant={review.severity === 'critical' ? 'destructive' : 'secondary'} className="text-[10px] mt-1">{review.severity}</Badge>
              </div>
            ))}
          </ScrollArea>
        </div>
        <div className="flex-1">
          {selectedReview ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Review</CardTitle>
                  <Badge variant={selectedReview.severity === 'critical' ? 'destructive' : 'secondary'}>{selectedReview.severity}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{selectedReview.description}</p>
                <div className="p-3 rounded bg-muted font-mono text-sm">{selectedReview.proposedAction}</div>
                <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Decision note..." rows={3} />
                <div className="flex gap-2">
                  <Button onClick={() => { onSubmitDecision(selectedReview.id, true, note); setSelectedReview(null); }} className="flex-1"><ThumbsUp className="w-4 h-4 mr-2" />Approve</Button>
                  <Button variant="destructive" onClick={() => { onSubmitDecision(selectedReview.id, false, note); setSelectedReview(null); }} className="flex-1"><ThumbsDown className="w-4 h-4 mr-2" />Reject</Button>
                </div>
              </CardContent>
            </Card>
          ) : <EmptyState message="Select a review" icon={Shield} />}
        </div>
      </div>
    </div>
  );
}

function GlobalReviewCenter({ agents, reviews, onSelectAgent }: any) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center p-8">
        <Shield className="w-16 h-16 text-muted-foreground mb-4 opacity-30" />
        <h3 className="text-xl font-semibold mb-2">No Agents</h3>
        <p className="text-muted-foreground">Create an agent to start reviewing gate decisions.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {agents.map((agent: any) => {
        const count = (reviews[agent.id] || []).filter((r: any) => r.status === 'pending').length;
        return (
          <Card key={agent.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectAgent(agent.id)}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><Bot className="w-4 h-4" /><span className="font-medium">{agent.name}</span></div>
              {count > 0 ? <Badge variant="destructive">{count} pending</Badge> : <Badge variant="secondary">0 pending</Badge>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AgentObservabilityCenter({ agent, runs, traces, onBack }: any) {
  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
      <div className="grid grid-cols-2 gap-4 h-[500px]">
        <Card>
          <CardHeader><CardTitle className="text-base">Runs ({runs.length})</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-full">
              {runs.map((run: any) => (
                <div key={run.id} className="p-2 rounded border mb-2">
                  <div className="flex items-center gap-2">
                    {run.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {run.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-500" />}
                    {run.status === 'failed' && <div className="w-3 h-3 rounded-full bg-red-500" />}
                    <span className="text-sm truncate">{run.input}</span>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Trace</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-full">
              {traces.length === 0 ? <EmptyState message="No trace data" icon={Eye} /> : traces.map((entry: any, i: number) => (
                <div key={i} className="p-2 rounded border mb-2 text-sm">
                  <Badge variant="outline" className="text-[10px] mr-2">{entry.kind}</Badge>
                  {entry.title}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GlobalObservabilityCenter({ agents, runs, onSelectAgent }: any) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center p-8">
        <Eye className="w-16 h-16 text-muted-foreground mb-4 opacity-30" />
        <h3 className="text-xl font-semibold mb-2">No Agents</h3>
        <p className="text-muted-foreground">Create an agent to start monitoring executions.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {agents.map((agent: any) => (
        <Card key={agent.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectAgent(agent.id)}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2"><Bot className="w-4 h-4" /><span className="font-medium">{agent.name}</span></div>
            <Badge variant="secondary">{(runs[agent.id] || []).length} runs</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: Record<string, string> = { green: 'text-green-500', blue: 'text-blue-500', purple: 'text-purple-500', gray: 'text-gray-500' };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div><p className="text-sm text-muted-foreground">{title}</p><p className="text-2xl font-bold">{value}</p></div>
          <Icon className={`w-8 h-8 ${colors[color]}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message, icon: Icon }: any) {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
      <Icon className="w-8 h-8 mb-2 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ============================================================================
// LEASE MONITORING COMPONENTS
// ============================================================================

interface ManagedLease {
  leaseId: string;
  wihId: string;
  dagId: string;
  nodeId: string;
  acquiredAt: number;
  expiresAt: number;
  keys: string[];
  renewalCount: number;
  status: 'active' | 'expiring' | 'expired' | 'released';
}

function useLeases() {
  const [leases, setLeases] = useState<ManagedLease[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Simulate fetching leases from Rails API
  const fetchLeases = useCallback(async () => {
    setIsLoading(true);
    // In production, this would call railsApi.leases.list() when available
    await new Promise(r => setTimeout(r, 500));
    setIsLoading(false);
  }, []);
  
  const refreshLease = async (leaseId: string) => {
    // Call Rails API to renew lease
    console.log(`Refreshing lease ${leaseId}`);
  };
  
  const releaseLease = async (leaseId: string) => {
    // Call Rails API to release lease
    console.log(`Releasing lease ${leaseId}`);
  };
  
  useEffect(() => {
    fetchLeases();
    const interval = setInterval(fetchLeases, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchLeases]);
  
  return { leases, isLoading, refreshLease, releaseLease };
}

function getLeaseStatus(lease: ManagedLease): { label: string; color: string; icon: any } {
  const now = Date.now();
  const timeRemaining = lease.expiresAt - now;
  
  if (timeRemaining < 0) return { label: 'Expired', color: 'destructive', icon: AlertTriangle };
  if (timeRemaining < 60000) return { label: 'Expiring', color: 'warning', icon: AlertTriangle };
  return { label: 'Active', color: 'default', icon: CheckCircle };
}

function getLeaseProgress(lease: ManagedLease): number {
  const total = lease.expiresAt - lease.acquiredAt;
  const remaining = lease.expiresAt - Date.now();
  return Math.max(0, Math.min(100, (remaining / total) * 100));
}

function formatDuration(ms: number): string {
  if (ms < 0) return 'Expired';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function GlobalLeaseCenter({ agents, onSelectAgent }: any) {
  const { leases, isLoading } = useLeases();
  const activeCount = leases.filter((l: ManagedLease) => l.status === 'active').length;
  const expiringCount = leases.filter((l: ManagedLease) => l.status === 'expiring').length;
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Active Leases" value={activeCount} icon={Key} color="green" />
        <StatCard title="Expiring Soon" value={expiringCount} icon={AlertTriangle} color="yellow" />
        <StatCard title="Total Agents" value={agents.length} icon={Bot} color="purple" />
        <StatCard title="Renewals" value={leases.reduce((sum: number, l: ManagedLease) => sum + l.renewalCount, 0)} icon={RefreshCw} color="blue" />
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lease Monitoring</CardTitle>
          <CardDescription>Active resource reservations across all agents</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : leases.length === 0 ? (
            <EmptyState message="No active leases" icon={Key} />
          ) : (
            <div className="space-y-2">
              {leases.slice(0, 10).map((lease: ManagedLease) => {
                const status = getLeaseStatus(lease);
                return (
                  <div key={lease.leaseId} className="p-3 rounded-lg border hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <status.icon className={`w-4 h-4 ${status.color === 'green' ? 'text-green-500' : status.color === 'yellow' ? 'text-yellow-500' : 'text-red-500'}`} />
                        <span className="font-medium text-sm font-mono">{lease.leaseId.slice(0, 16)}...</span>
                      </div>
                      <Badge variant={status.color === 'default' ? 'default' : status.color === 'warning' ? 'secondary' : 'destructive'}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {lease.dagId} / {lease.nodeId} • {formatDuration(lease.expiresAt - Date.now())} remaining
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agents with Leases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {agents.map((agent: any) => (
              <div 
                key={agent.id} 
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                onClick={() => onSelectAgent(agent.id)}
              >
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  <span className="font-medium">{agent.name}</span>
                </div>
                <Badge variant="secondary">{leases.filter((l: ManagedLease) => l.dagId?.includes(agent.id)).length} leases</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AgentLeaseCenter({ agent, onBack }: any) {
  const { leases, isLoading, refreshLease, releaseLease } = useLeases();
  const agentLeases = leases.filter((l: ManagedLease) => l.dagId?.includes(agent.id));
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
        <span className="font-medium">{agent.name} - Leases</span>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : agentLeases.length === 0 ? (
        <EmptyState message="No active leases for this agent" icon={Key} />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {agentLeases.map((lease: ManagedLease) => {
            const status = getLeaseStatus(lease);
            const progress = getLeaseProgress(lease);
            return (
              <Card key={lease.leaseId}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">{lease.leaseId}</div>
                      <div className="text-xs text-muted-foreground">{lease.dagId} / {lease.nodeId}</div>
                    </div>
                    <Badge variant={status.color === 'default' ? 'default' : status.color === 'warning' ? 'secondary' : 'destructive'}>
                      {status.label}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Time Remaining</span>
                      <span>{formatDuration(lease.expiresAt - Date.now())}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${progress > 50 ? 'bg-green-500' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Renewals: {lease.renewalCount}</span>
                    <span>•</span>
                    <span>Keys: {lease.keys.join(', ')}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => refreshLease(lease.leaseId)}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Renew
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => releaseLease(lease.leaseId)}>
                      <Square className="w-3 h-3 mr-1" /> Release
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DAG MONITORING COMPONENTS
// ============================================================================

interface DagNode {
  id: string;
  type: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  leaseId?: string;
  startedAt?: string;
  completedAt?: string;
  outputs?: string[];
}

interface DagInfo {
  dagId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  nodes: DagNode[];
  runId?: string;
}

function useDags() {
  const [dags, setDags] = useState<DagInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const fetchDags = useCallback(async () => {
    setIsLoading(true);
    // In production, this would fetch from Rails API
    await new Promise(r => setTimeout(r, 500));
    setIsLoading(false);
  }, []);
  
  useEffect(() => {
    fetchDags();
    const interval = setInterval(fetchDags, 30000);
    return () => clearInterval(interval);
  }, [fetchDags]);
  
  return { dags, isLoading };
}

function getNodeStatusIcon(status: string) {
  switch (status) {
    case 'running': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'failed': return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'blocked': return <Circle className="w-4 h-4 text-gray-400" />;
    default: return <Circle className="w-4 h-4 text-muted-foreground" />;
  }
}

function GlobalDagCenter({ agents, onSelectAgent }: any) {
  const { dags, isLoading } = useDags();
  const activeDags = dags.filter((d: DagInfo) => d.status === 'running');
  const completedDags = dags.filter((d: DagInfo) => d.status === 'completed');
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Active DAGs" value={activeDags.length} icon={GitBranch} color="green" />
        <StatCard title="Completed" value={completedDags.length} icon={CheckCircle} color="blue" />
        <StatCard title="Total Nodes" value={dags.reduce((sum: number, d: DagInfo) => sum + d.nodes.length, 0)} icon={Workflow} color="purple" />
        <StatCard title="Failed Nodes" value={dags.reduce((sum: number, d: DagInfo) => sum + d.nodes.filter(n => n.status === 'failed').length, 0)} icon={AlertTriangle} color="red" />
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active DAG Executions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : activeDags.length === 0 ? (
            <EmptyState message="No active DAG executions" icon={GitBranch} />
          ) : (
            <div className="space-y-2">
              {activeDags.map((dag: DagInfo) => {
                const completedCount = dag.nodes.filter((n: DagNode) => n.status === 'completed').length;
                return (
                  <div key={dag.dagId} className="p-3 rounded-lg border hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">{dag.dagId}</span>
                      </div>
                      <Badge variant="default">Running</Badge>
                    </div>
                    <div className="mt-2">
                      <Progress value={(completedCount / dag.nodes.length) * 100} />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground flex justify-between">
                      <span>{completedCount} / {dag.nodes.length} nodes completed</span>
                      <span>Run ID: {dag.runId?.slice(0, 12)}...</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agents with DAGs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {agents.map((agent: any) => (
              <div 
                key={agent.id} 
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                onClick={() => onSelectAgent(agent.id)}
              >
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  <span className="font-medium">{agent.name}</span>
                </div>
                <Badge variant="secondary">{dags.filter((d: DagInfo) => d.dagId?.includes(agent.id)).length} DAGs</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AgentDagCenter({ agent, onBack }: any) {
  const { dags, isLoading } = useDags();
  const agentDags = dags.filter((d: DagInfo) => d.dagId?.includes(agent.id));
  const [selectedDagId, setSelectedDagId] = useState<string | null>(null);
  
  const selectedDag = agentDags.find((d: DagInfo) => d.dagId === selectedDagId);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
        <span className="font-medium">{agent.name} - DAGs</span>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : agentDags.length === 0 ? (
        <EmptyState message="No DAGs for this agent" icon={GitBranch} />
      ) : selectedDag ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{selectedDag.dagId}</h3>
            <Button size="sm" variant="outline" onClick={() => setSelectedDagId(null)}>← Back to List</Button>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Node Execution Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedDag.nodes.map((node: DagNode) => (
                  <div key={node.id} className="flex items-center gap-3 p-2 rounded border">
                    {getNodeStatusIcon(node.status)}
                    <div className="flex-1">
                      <div className="text-sm font-medium">{node.id}</div>
                      <div className="text-xs text-muted-foreground">{node.type}</div>
                    </div>
                    {node.leaseId && (
                      <Badge variant="outline" className="text-xs">
                        <Key className="w-3 h-3 mr-1" /> {node.leaseId.slice(0, 8)}...
                      </Badge>
                    )}
                    <Badge variant={
                      node.status === 'completed' ? 'default' :
                      node.status === 'running' ? 'secondary' :
                      node.status === 'failed' ? 'destructive' : 'outline'
                    } className="text-xs">
                      {node.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-2">
          {agentDags.map((dag: DagInfo) => {
            const completedCount = dag.nodes.filter((n: DagNode) => n.status === 'completed').length;
            return (
              <Card 
                key={dag.dagId} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedDagId(dag.dagId)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-primary" />
                      <span className="font-medium">{dag.dagId}</span>
                    </div>
                    <Badge variant={
                      dag.status === 'running' ? 'default' :
                      dag.status === 'completed' ? 'secondary' : 'outline'
                    }>
                      {dag.status}
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <Progress value={(completedCount / dag.nodes.length) * 100} />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {completedCount} / {dag.nodes.length} nodes • Run ID: {dag.runId?.slice(0, 12)}...
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// UTILS
// ============================================================================

function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={`h-2 rounded-full bg-muted overflow-hidden ${className}`}>
      <div 
        className="h-full rounded-full bg-primary transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

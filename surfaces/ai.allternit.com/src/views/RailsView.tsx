"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAgentStore } from "@/lib/agents";
import type { Agent } from "@/lib/agents";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Modularized RailsView components
import { AgentListItem } from "./rails/components/AgentListItem";
import { GlobalControlCenter, AgentControlTab } from "./rails/tabs/ControlTab";
import { GlobalMailCenter, AgentMailCenter } from "./rails/tabs/MailTab";
import { GlobalCheckpointCenter, AgentCheckpointCenter } from "./rails/tabs/CheckpointTab";
import { GlobalReviewCenter, AgentReviewCenter } from "./rails/tabs/ReviewTab";
import { GlobalObservabilityCenter, AgentObservabilityCenter } from "./rails/tabs/ObservabilityTab";
import { GlobalLeaseCenter, AgentLeaseCenter } from "./rails/tabs/LeaseTab";
import { GlobalDagCenter, AgentDagCenter } from "./rails/tabs/DagTab";

// Icons
import {
  Lightning,
  EnvelopeSimple,
  FloppyDisk,
  Shield,
  Eye,
  Key,
  GitBranch,
  Pulse as Activity,
  Clock,
  ListDashes,
  Robot,
} from '@phosphor-icons/react';

export function RailsView() {
  const {
    agents, runs, checkpoints, queue, mail, mailThreads, reviews,
    activeRunId, activeRunOutput, activeRunTrace,
    fetchAgents, fetchRuns, fetchTasks, fetchCheckpoints, fetchCommits, fetchQueue,
    fetchMail, fetchMailThreads, fetchReviews, startRun, cancelRun, pauseRun, resumeRun,
    createCheckpoint, restoreCheckpoint, enqueue, dequeue, sendMail, acknowledgeMail,
    submitReviewDecision, selectThread, selectedThreadId
  } = useAgentStore();

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [, setIsLoadingAgentData] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => { 
    fetchAgents(); 
    fetchQueue(); 
  }, [fetchAgents, fetchQueue]);

  useEffect(() => {
    if (!selectedAgentId) {
      setIsLoadingAgentData(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsLoadingAgentData(true);

    Promise.all([
      fetchRuns(selectedAgentId),
      fetchTasks(selectedAgentId),
      fetchCheckpoints(selectedAgentId),
      fetchCommits(selectedAgentId),
      fetchMail(selectedAgentId),
      fetchMailThreads(selectedAgentId),
      fetchReviews(selectedAgentId),
    ])
      .then(() => {
        if (!abortController.signal.aborted) {
          setIsLoadingAgentData(false);
        }
      })
      .catch((error) => {
        if (!abortController.signal.aborted) {
          console.error('[RailsView] Failed to fetch agent data:', error);
          setIsLoadingAgentData(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [selectedAgentId, fetchRuns, fetchTasks, fetchCheckpoints, fetchCommits, fetchMail, fetchMailThreads, fetchReviews]);

  const allRuns = useMemo(() => Object.values(runs).flat(), [runs]);
  const activeRuns = useMemo(() => allRuns.filter((r: any) => r.status === 'running'), [allRuns]);
  const selectedAgent = useMemo(() => agents.find((a: Agent) => a.id === selectedAgentId), [agents, selectedAgentId]);

  const unreadMailTotal = useMemo(() => 
    Object.values(mail).flat().filter((m: any) => m.status === 'unread').length,
    [mail]
  );
  
  const pendingReviewsTotal = useMemo(() => 
    Object.values(reviews).flat().filter((r: any) => r.status === 'pending').length,
    [reviews]
  );

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 flex flex-col border-r border-solid border-white/5 bg-black/10 shrink-0">
        <div className="p-4 border-b border-solid border-white/5">
          <h2 className="text-[16px] font-bold flex items-center gap-2.5">
            <div className="size-7  rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
              <ListDashes size={16} weight="bold" />
            </div>
            Rails Engine
          </h2>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Control Surface</p>
        </div>

        <div className="p-3 border-b border-solid border-white/5">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col gap-1 p-2 rounded-lg bg-green-500/5 border border-solid border-green-500/10">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-500/70 uppercase">
                <Activity size={12} weight="bold" /> Active
              </div>
              <span className="text-lg font-bold text-green-500">{activeRuns.length}</span>
            </div>
            <div className="flex flex-col gap-1 p-2 rounded-lg bg-blue-500/5 border border-solid border-blue-500/10">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-500/70 uppercase">
                <Clock size={12} weight="bold" /> Queue
              </div>
              <span className="text-lg font-bold text-blue-500">{queue.length}</span>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            <AgentListItem 
              id={null} 
              name="All Agents" 
              count={allRuns.length} 
              isSelected={selectedAgentId === null} 
              onClick={() => setSelectedAgentId(null)} 
              icon={ListDashes} 
            />
            <Separator className="my-2 opacity-50" />
            {agents.map((agent: Agent) => {
              const agentRuns = runs[agent.id] || [];
              const active = agentRuns.filter((r: any) => r.status === 'running').length;
              return (
                <AgentListItem 
                  key={agent.id} 
                  id={agent.id} 
                  name={agent.name} 
                  count={agentRuns.length} 
                  activeCount={active} 
                  isSelected={selectedAgentId === agent.id} 
                  onClick={() => setSelectedAgentId(agent.id)} 
                  icon={Robot} 
                />
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Tabs defaultValue="control" className="h-full flex flex-col">
          <div className="px-4 pt-3 pb-0 border-b border-solid border-white/5 shrink-0 bg-black/5">
            <TabsList className="w-full justify-start bg-transparent p-0 h-auto flex-wrap gap-1 border-none">
              <NavTab value="control" icon={Lightning} label="Control" />
              <NavTab value="mail" icon={EnvelopeSimple} label="Mail" badge={unreadMailTotal} />
              <NavTab value="checkpoints" icon={FloppyDisk} label="Checkpoints" />
              <NavTab value="reviews" icon={Shield} label="Reviews" badge={pendingReviewsTotal} />
              <NavTab value="observability" icon={Eye} label="Observability" />
              <NavTab value="leases" icon={Key} label="Leases" />
              <NavTab value="dags" icon={GitBranch} label="DAGs" />
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="control" className="h-full m-0 p-0 overflow-auto">
              <div className="p-6">
                {selectedAgentId === null ? (
                  <GlobalControlCenter agents={agents} activeRuns={activeRuns} queue={queue} allRuns={allRuns} onSelectAgent={setSelectedAgentId} />
                ) : selectedAgent ? (
                  <AgentControlTab agent={selectedAgent} runs={runs[selectedAgent.id] || []} queue={queue} activeRunId={activeRunId} activeRunOutput={activeRunOutput} onBack={() => setSelectedAgentId(null)} onStartRun={startRun} onCancelRun={cancelRun} onPauseRun={pauseRun} onResumeRun={resumeRun} onEnqueue={enqueue} onDequeue={dequeue} />
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="mail" className="h-full m-0 p-0 overflow-hidden">
              <div className="p-6 h-full flex flex-col">
                {selectedAgentId === null ? (
                  <GlobalMailCenter agents={agents} mail={mail} onSelectAgent={setSelectedAgentId} />
                ) : selectedAgent ? (
                  <AgentMailCenter agent={selectedAgent} mail={mail[selectedAgent.id] || []} threads={mailThreads[selectedAgent.id] || []} agents={agents} selectedThreadId={selectedThreadId} onSelectThread={selectThread} onSendMail={sendMail} onAcknowledge={acknowledgeMail} onBack={() => setSelectedAgentId(null)} />
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="checkpoints" className="h-full m-0 p-0 overflow-auto">
              <div className="p-6">
                {selectedAgentId === null ? (
                  <GlobalCheckpointCenter agents={agents} checkpoints={checkpoints} onSelectAgent={setSelectedAgentId} />
                ) : selectedAgent ? (
                  <AgentCheckpointCenter agent={selectedAgent} checkpoints={checkpoints[selectedAgent.id] || []} runs={runs[selectedAgent.id] || []} onCreate={createCheckpoint} onRestore={restoreCheckpoint} onBack={() => setSelectedAgentId(null)} />
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="reviews" className="h-full m-0 p-0 overflow-auto">
              <div className="p-6">
                {selectedAgentId === null ? (
                  <GlobalReviewCenter agents={agents} reviews={reviews} onSelectAgent={setSelectedAgentId} />
                ) : selectedAgent ? (
                  <AgentReviewCenter agent={selectedAgent} reviews={reviews[selectedAgent.id] || []} onSubmitDecision={submitReviewDecision} onBack={() => setSelectedAgentId(null)} />
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="observability" className="h-full m-0 p-0 overflow-hidden">
              <div className="p-6 h-full flex flex-col">
                {selectedAgentId === null ? (
                  <GlobalObservabilityCenter agents={agents} runs={runs} onSelectAgent={setSelectedAgentId} />
                ) : selectedAgent ? (
                  <AgentObservabilityCenter agent={selectedAgent} runs={runs[selectedAgent.id] || []} traces={activeRunTrace} onBack={() => setSelectedAgentId(null)} />
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="leases" className="h-full m-0 p-0 overflow-auto">
              <div className="p-6">
                {selectedAgentId === null ? (
                  <GlobalLeaseCenter agents={agents} onSelectAgent={setSelectedAgentId} />
                ) : selectedAgent ? (
                  <AgentLeaseCenter agent={selectedAgent} onBack={() => setSelectedAgentId(null)} />
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="dags" className="h-full m-0 p-0 overflow-auto">
              <div className="p-6">
                {selectedAgentId === null ? (
                  <GlobalDagCenter agents={agents} onSelectAgent={setSelectedAgentId} />
                ) : selectedAgent ? (
                  <AgentDagCenter agent={selectedAgent} onBack={() => setSelectedAgentId(null)} />
                ) : null}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

function NavTab({ value, icon: Icon, label, badge }: { value: string; icon: any; label: string; badge?: number }) {
  return (
    <TabsTrigger 
      value={value} 
      className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold border-b-2 border-solid border-transparent data-[state=active]:border-[var(--accent-primary)] data-[state=active]:bg-transparent data-[state=active]:text-foreground rounded-none shadow-none transition-all"
    >
      <Icon size={16} /> 
      {label}
      {badge !== undefined && badge > 0 && (
        <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1 min-w-[16px] justify-center">{badge}</Badge>
      )}
    </TabsTrigger>
  );
}

export default RailsView;

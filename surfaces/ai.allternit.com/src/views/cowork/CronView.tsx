/**
 * CronView - Schedule and automate tasks
 * Shows scheduled and recurring tasks with form overlays for creation and management
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useIsClient } from '@/lib/hooks/use-is-client';
import {
  CalendarCheck,
  Clock,
  Plus,
  X,
  Play,
  Trash,
  PencilSimple,
  CaretDown,
  FolderOpen,
  Robot,
  CheckSquare,
  Calendar,
  Sparkle,
  Cpu,
  ArrowsClockwise,
  Warning,
  CircleNotch,
} from '@phosphor-icons/react';
import { ModelPicker, type ModelSelection } from '@/components/model-picker';
import { useAgentStore } from '@/lib/agents';
import { HeartbeatScheduler } from '@/components/agent-workspace';
import { 
  createScheduledJob, 
  runScheduledJobNow, 
  deleteScheduledJob,
  listScheduledJobs,
  updateScheduledJob,
} from '@/lib/agents/scheduled-jobs.service';
import { cn } from '@/lib/utils';

// Automation with scheduling info
type Frequency = 'manual' | 'hourly' | 'daily' | 'weekdays' | 'weekly';

interface ScheduledAutomation {
  id: string;
  name: string;
  description: string;
  prompt: string;
  modelOrAgent: string;
  modelSelection?: ModelSelection;
  agentId?: string;
  folder: string;
  frequency: Frequency;
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  mode: 'agent' | 'task';
}

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
];

export function CronView() {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'recurring' | 'agent-heartbeats'>('scheduled');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<ScheduledAutomation | null>(null);
  const [selectedAutomation, setSelectedAutomation] = useState<ScheduledAutomation | null>(null);
  const [selectedHeartbeatAgent, setSelectedHeartbeatAgent] = useState<string | null>(null);

  const [scheduledAutomations, setScheduledAutomations] = useState<ScheduledAutomation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [runningAutomationId, setRunningAutomationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadScheduledJobs();
  }, []);
  
  const loadScheduledJobs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const jobs = await listScheduledJobs();
      const convertedAutomations: ScheduledAutomation[] = jobs.map(job => {
        let frequency: Frequency = 'manual';
        if (job.schedule === '0 * * * *') frequency = 'hourly';
        else if (job.schedule === '0 9 * * *') frequency = 'daily';
        else if (job.schedule === '0 9 * * 1-5') frequency = 'weekdays';
        else if (job.schedule === '0 9 * * 1') frequency = 'weekly';

        return {
          id: job.id || `job-${Date.now()}`,
          name: job.name,
          description: job.description || '',
          prompt: job.prompt || '',
          modelOrAgent: job.taskType || 'default',
          folder: (job.parameters?.folder as string) || '/workspace',
          frequency,
          isActive: job.enabled,
          lastRun: job.lastRunAt,
          nextRun: job.nextRunAt,
          createdAt: job.createdAt || new Date().toISOString(),
          mode: (job.parameters?.mode as 'agent' | 'task') || 'task',
          agentId: job.parameters?.agentId as string,
        };
      });
      setScheduledAutomations(convertedAutomations);
    } catch (e) {
      setError('Failed to load scheduled jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAutomations = useMemo(() => {
    if (activeTab === 'scheduled') {
      return scheduledAutomations.filter(t => t.frequency !== 'manual');
    } else {
      return scheduledAutomations.filter(t => t.frequency === 'manual' || t.frequency === 'hourly');
    }
  }, [scheduledAutomations, activeTab]);
  
  const handleCreateAutomation = async (automationData: Omit<ScheduledAutomation, 'id' | 'createdAt' | 'isActive'>) => {
    setIsLoading(true);
    setError(null);
    try {
      let cronSchedule: string;
      switch (automationData.frequency) {
        case 'hourly': cronSchedule = '0 * * * *'; break;
        case 'daily': cronSchedule = '0 9 * * *'; break;
        case 'weekdays': cronSchedule = '0 9 * * 1-5'; break;
        case 'weekly': cronSchedule = '0 9 * * 1'; break;
        case 'manual':
        default: cronSchedule = '0 0 * * *'; break;
      }

      const jobConfig = await createScheduledJob({
        name: automationData.name,
        description: automationData.description,
        schedule: cronSchedule,
        prompt: automationData.prompt,
        taskType: (automationData.mode === 'agent' ? 'agent-task' : 'custom-task') as 'custom-task',
        parameters: {
          folder: automationData.folder,
          agentId: automationData.agentId,
          mode: automationData.mode,
        },
        enabled: true,
        maxRetries: 3,
        timeout: 300,
        notifyOnSuccess: false,
        notifyOnFailure: true,
      });

      const newAutomation: ScheduledAutomation = {
        ...automationData,
        id: jobConfig.id || `sched-${Date.now()}`,
        createdAt: jobConfig.createdAt || new Date().toISOString(),
        isActive: true,
      };
      setScheduledAutomations([...scheduledAutomations, newAutomation]);
      setShowCreateForm(false);
    } catch (e) {
      setError('Failed to create scheduled job');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAutomation = async (automationId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await deleteScheduledJob(automationId);
      setScheduledAutomations(scheduledAutomations.filter(a => a.id !== automationId));
      if (selectedAutomation?.id === automationId) {
        setSelectedAutomation(null);
      }
    } catch (e) {
      setError('Failed to delete scheduled job');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAutomation = (automationId: string, updates: Partial<ScheduledAutomation>) => {
    setScheduledAutomations(scheduledAutomations.map(a =>
      a.id === automationId ? { ...a, ...updates } : a
    ));
    if (selectedAutomation?.id === automationId) {
      setSelectedAutomation({ ...selectedAutomation, ...updates });
    }
  };

  const handleEditAutomation = async (automationId: string, automationData: Omit<ScheduledAutomation, 'id' | 'createdAt' | 'isActive'>) => {
    setIsLoading(true);
    setError(null);
    try {
      let cronSchedule: string;
      switch (automationData.frequency) {
        case 'hourly': cronSchedule = '0 * * * *'; break;
        case 'daily': cronSchedule = '0 9 * * *'; break;
        case 'weekdays': cronSchedule = '0 9 * * 1-5'; break;
        case 'weekly': cronSchedule = '0 9 * * 1'; break;
        case 'manual':
        default: cronSchedule = '0 0 * * *'; break;
      }

      await updateScheduledJob(automationId, {
        name: automationData.name,
        description: automationData.description,
        schedule: cronSchedule,
        prompt: automationData.prompt,
        taskType: (automationData.mode === 'agent' ? 'agent-task' : 'custom-task') as 'custom-task',
        parameters: {
          folder: automationData.folder,
          agentId: automationData.agentId,
          mode: automationData.mode,
        },
      });

      const updatedAutomation: ScheduledAutomation = {
        ...automationData,
        id: automationId,
        createdAt: editingAutomation?.createdAt || new Date().toISOString(),
        isActive: editingAutomation?.isActive ?? true,
      };

      setScheduledAutomations(scheduledAutomations.map(a =>
        a.id === automationId ? updatedAutomation : a
      ));

      setShowEditForm(false);
      setEditingAutomation(null);
      setSelectedAutomation(null);
      await loadScheduledJobs();
    } catch (e) {
      setError('Failed to update scheduled job');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunNow = async (automation: ScheduledAutomation) => {
    setRunningAutomationId(automation.id);
    setError(null);
    try {
      await runScheduledJobNow(automation.id);
      handleUpdateAutomation(automation.id, { lastRun: new Date().toISOString() });
    } catch (e) {
      setError(`Failed to run automation: ${automation.name}`);
    } finally {
      setRunningAutomationId(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-[24px_24px_16px] border-b border-solid border-[var(--ui-border-muted)]">
        <div className="flex items-start justify-center">
          <div className="text-center">
            <h1 className="m-0 text-2xl font-semibold text-[var(--accent-primary)]">Cron</h1>
            <p className="m-0 mt-1 text-sm text-[var(--ui-text-muted)]">Schedule and automate your automations</p>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex items-center justify-between p-4 px-6 border-b border-solid border-[var(--ui-border-muted)]">
        <div className="flex gap-2">
          <TabButton active={activeTab === 'scheduled'} onClick={() => setActiveTab('scheduled')} icon={Clock} count={scheduledAutomations.filter(a => a.frequency !== 'manual').length}>Scheduled</TabButton>
          <TabButton active={activeTab === 'recurring'} onClick={() => setActiveTab('recurring')} icon={CalendarCheck} count={scheduledAutomations.filter(a => a.frequency === 'manual' || a.frequency === 'hourly').length}>Recurring</TabButton>
          <TabButton active={activeTab === 'agent-heartbeats'} onClick={() => setActiveTab('agent-heartbeats')} icon={Robot} count={0}>Agent Heartbeats</TabButton>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={loadScheduledJobs} disabled={isLoading} className={cn("px-3 h-8 bg-transparent border border-solid border-[var(--ui-border-default)] rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-opacity", isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer text-[var(--ui-text-secondary)] hover:bg-[var(--bg-hover)]")}>
            <ArrowsClockwise size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
          <button type="button" onClick={() => setShowCreateForm(true)} disabled={isLoading} className={cn("px-3 h-8 border-none rounded-lg text-[var(--ui-text-primary)] text-[13px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all", isLoading ? "cursor-not-allowed opacity-50 bg-[var(--ui-border-default)]" : "cursor-pointer bg-[linear-gradient(135deg,rgba(217,119,87,0.9)_0%,rgba(212,176,140,0.8)_100%)] hover:-translate-y-px hover:shadow-[0_4px_12px_color-mix(in_srgb,var(--accent-primary)_30%,transparent)]")}>
            <Plus size={16} /> New Automation
          </button>
        </div>
      </div>
      
      {error && (
        <div className="p-3 px-6 bg-[var(--status-error-bg)] border-b border-solid border-[var(--status-error)]/30 flex items-center gap-2 text-[var(--status-error)] text-[13px]">
          <Warning size={16} /> {error}
          <button type="button" onClick={() => setError(null)} className="ml-auto bg-transparent border-none text-[var(--status-error)] cursor-pointer text-[12px] hover:opacity-80">Dismiss</button>
        </div>
      )}
      
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'agent-heartbeats' ? (
          <AgentHeartbeatsTab selectedAgent={selectedHeartbeatAgent} onSelectAgent={setSelectedHeartbeatAgent} />
        ) : filteredAutomations.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
            {filteredAutomations.map((automation) => (
              <AutomationCard key={automation.id} automation={automation} isRunning={runningAutomationId === automation.id} onClick={() => setSelectedAutomation(automation)} onRunNow={() => handleRunNow(automation)} />
            ))}
          </div>
        ) : (
          <EmptyState icon={activeTab === 'scheduled' ? Clock : CalendarCheck} title={`No ${activeTab} automations`} description={`Create a ${activeTab} automation to automate your workflow.`} />
        )}
      </div>

      {showCreateForm && <CreateAutomationForm onClose={() => setShowCreateForm(false)} onSave={handleCreateAutomation} />}
      {showEditForm && editingAutomation && <EditAutomationForm automation={editingAutomation} onClose={() => { setShowEditForm(false); setEditingAutomation(null); }} onSave={handleEditAutomation} />}
      {selectedAutomation && (
        <AutomationDetailOverlay automation={selectedAutomation} isRunning={runningAutomationId === selectedAutomation.id} onClose={() => setSelectedAutomation(null)} onUpdate={(updates) => handleUpdateAutomation(selectedAutomation.id, updates)} onDelete={() => handleDeleteAutomation(selectedAutomation.id)} onRunNow={() => handleRunNow(selectedAutomation)} onEdit={() => { setEditingAutomation(selectedAutomation); setShowEditForm(true); }} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children, count }: { active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode; count: number }) {
  return (
    <button type="button" onClick={onClick} className={cn("px-4 py-2.5 rounded-lg border-none flex items-center gap-2 text-[13px] font-semibold cursor-pointer transition-all", active ? "bg-[linear-gradient(135deg,rgba(217,119,87,0.18)_0%,color-mix(in_srgb,var(--accent-primary)_12%,transparent)_100%)] text-[var(--accent-primary)]" : "bg-transparent text-[var(--ui-text-muted)] hover:bg-[var(--bg-hover)]")}>
      <Icon size={16} /> {children} <span className="text-[12px] opacity-70 ml-1">{count}</span>
    </button>
  );
}

function AutomationCard({ automation, onClick, onRunNow, isRunning = false }: { automation: ScheduledAutomation; onClick: () => void; onRunNow: () => void; isRunning?: boolean }) {
  const getFrequencyLabel = (freq: Frequency) => FREQUENCY_OPTIONS.find(o => o.value === freq)?.label || freq;
  const getModelOrAgentDisplay = () => automation.mode === 'agent' && automation.agentId ? 'Agent Automation' : (automation.modelSelection?.modelName || automation.modelOrAgent || 'Default Model');

  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }} className="p-5 bg-[var(--surface-hover)] rounded-2xl border border-solid border-[var(--ui-border-muted)] cursor-pointer transition-all hover:bg-[var(--surface-hover)] hover:border-[var(--accent-primary)]/20">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("size-10 rounded-lg flex items-center justify-center", automation.mode === 'agent' ? "bg-[linear-gradient(135deg,rgba(167,139,250,0.2)_0%,rgba(167,139,250,0.1)_100%)]" : "bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent-primary)_20%,transparent)_0%,color-mix(in_srgb,var(--accent-primary)_10%,transparent)_100%)]")}>
          {automation.mode === 'agent' ? <Robot size={20} color="#d4c5f9" /> : <CheckSquare size={20} color="var(--accent-primary)" />}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("px-2.5 py-1 rounded-full text-[12px] font-semibold", automation.isActive ? "bg-[var(--status-success-bg)] text-[var(--status-success)]" : "bg-zinc-500/10 text-[var(--ui-text-muted)]")}>{automation.isActive ? 'Active' : 'Inactive'}</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); if (!isRunning) onRunNow(); }} disabled={isRunning} className={cn("size-8 rounded-lg border-none flex items-center justify-center transition-opacity", isRunning ? "cursor-not-allowed bg-zinc-500/10 text-[var(--ui-text-muted)]" : "cursor-pointer bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20")}>
            {isRunning ? <CircleNotch size={16} className="animate-spin" /> : <Play size={16} />}
          </button>
        </div>
      </div>
      <h3 className="m-0 mb-2 text-base font-semibold text-[var(--accent-primary)]">{automation.name}</h3>
      <p className="m-0 mb-4 text-[13px] text-[var(--ui-text-muted)] leading-relaxed line-clamp-2">{automation.description}</p>
      <div className="flex items-center gap-4 pt-4 border-t border-solid border-[var(--ui-border-muted)]">
        <div className="flex items-center gap-1.5"><Calendar size={14} className="text-[var(--ui-text-muted)]" /><span className="text-[12px] text-[var(--ui-text-muted)]">{getFrequencyLabel(automation.frequency)}</span></div>
        <div className="flex items-center gap-1.5">{automation.mode === 'agent' ? <Robot size={14} className="text-[var(--ui-text-muted)]" /> : <Cpu size={14} className="text-[var(--ui-text-muted)]" />}<span className="text-[12px] text-[var(--ui-text-muted)]">{getModelOrAgentDisplay()}</span></div>
      </div>
    </div>
  );
}

function CreateAutomationForm({ onClose, onSave }: { onClose: () => void; onSave: (automation: Omit<ScheduledAutomation, 'id' | 'createdAt' | 'isActive'>) => void }) {
  return <AutomationForm mode="create" onClose={onClose} onSave={(automationId, automationData) => onSave(automationData)} />;
}

function EditAutomationForm({ automation, onClose, onSave }: { automation: ScheduledAutomation; onClose: () => void; onSave: (automationId: string, automation: Omit<ScheduledAutomation, 'id' | 'createdAt' | 'isActive'>) => void }) {
  return <AutomationForm mode="edit" initialAutomation={automation} onClose={onClose} onSave={onSave} />;
}

function AutomationForm({ mode, initialAutomation, onClose, onSave }: { mode: 'create' | 'edit'; initialAutomation?: ScheduledAutomation; onClose: () => void; onSave: (automationId: string, automation: Omit<ScheduledAutomation, 'id' | 'createdAt' | 'isActive'>) => void }) {
  const [formData, setFormData] = useState({
    name: initialAutomation?.name || '',
    description: initialAutomation?.description || '',
    prompt: initialAutomation?.prompt || '',
    modelOrAgent: initialAutomation?.modelOrAgent || '',
    modelSelection: initialAutomation?.modelSelection || null as ModelSelection | null,
    agentId: initialAutomation?.agentId || '',
    folder: initialAutomation?.folder || '',
    frequency: initialAutomation?.frequency || 'manual' as Frequency,
    mode: initialAutomation?.mode || 'task' as 'agent' | 'task',
  });
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const { agents, fetchAgents } = useAgentStore();
  
  useEffect(() => { fetchAgents(); }, [fetchAgents]);
  
  const isValid = formData.name.trim() && formData.description.trim() && formData.prompt.trim() && (formData.mode === 'task' ? formData.modelSelection : formData.agentId);
  
  const handleModelSelect = (selection: ModelSelection) => {
    setFormData({ ...formData, modelSelection: selection, modelOrAgent: selection.modelName || selection.modelId });
    setShowModelPicker(false);
  };
  
  const handleAgentSelect = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    setFormData({ ...formData, agentId, modelOrAgent: agent?.name || 'Unknown Agent' });
    setShowAgentPicker(false);
  };
  
  return (
    <OverlayContainer onClose={onClose}>
      <div className="bg-[var(--surface-floating)] rounded-[20px] border border-solid border-[var(--accent-primary)]/20 w-full max-w-[560px] max-h-[90vh] overflow-auto shadow-[0_25px_50px_var(--shell-overlay-backdrop)]">
        <div className="p-[24px_24px_16px] border-b border-solid border-[var(--ui-border-muted)] flex items-center justify-between">
          <h2 className="m-0 text-[20px] font-semibold text-[var(--accent-primary)]">{mode === 'create' ? 'Create Scheduled Task' : 'Edit Scheduled Task'}</h2>
          <button type="button" onClick={onClose} className="size-8 rounded-lg border-none bg-transparent text-[var(--ui-text-muted)] cursor-pointer flex items-center justify-center hover:bg-white/5"><X size={20} /></button>
        </div>
        
        <div className="p-6">
          <div className="mb-6">
            <div className="block text-[12px] font-semibold text-[var(--ui-text-secondary)] mb-2 uppercase tracking-wider">Task Type</div>
            <div className="flex gap-2">
              <ModeButton active={formData.mode === 'task'} onClick={() => setFormData({ ...formData, mode: 'task', agentId: '', modelSelection: null })} icon={CheckSquare}>Task</ModeButton>
              <ModeButton active={formData.mode === 'agent'} onClick={() => setFormData({ ...formData, mode: 'agent', agentId: '', modelSelection: null })} icon={Robot}>Agent Task</ModeButton>
            </div>
          </div>
          
          <FormField label="Name *" required>
            <input aria-label="Input" type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter task name" className="w-full p-[12px_16px] bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-default)] rounded-[10px] text-[var(--accent-primary)] text-[14px] outline-none focus:border-[var(--ui-border-active)]" />
          </FormField>
          
          <FormField label="Description *" required>
            <input aria-label="Input" type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description" className="w-full p-[12px_16px] bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-default)] rounded-[10px] text-[var(--accent-primary)] text-[14px] outline-none focus:border-[var(--ui-border-active)]" />
          </FormField>
          
          <FormField label="Prompt *" required>
            <textarea aria-label="Text Area" value={formData.prompt} onChange={(e) => setFormData({ ...formData, prompt: e.target.value })} placeholder="Detailed instructions…" rows={5} className="w-full p-[12px_16px] bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-default)] rounded-[10px] text-[var(--accent-primary)] text-[14px] outline-none resize-vertical min-h-[120px] focus:border-[var(--ui-border-active)]" />
          </FormField>
          
          {formData.mode === 'task' && (
            <FormField label="Model *" required>
              <button type="button" onClick={() => setShowModelPicker(true)} className="w-full p-[12px_16px] bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-default)] rounded-[10px] text-[var(--accent-primary)] text-[14px] cursor-pointer flex items-center justify-between text-left">
                <span className="flex items-center gap-2">
                  {formData.modelSelection ? <><Sparkle size={16} className="text-[var(--accent-primary)]" />{formData.modelSelection.modelName || formData.modelSelection.modelId}<span className="text-[var(--ui-text-muted)] text-[12px]">via {formData.modelSelection.providerId}</span></> : 'Select model…'}
                </span>
                <CaretDown size={16} />
              </button>
            </FormField>
          )}
          
          {formData.mode === 'agent' && (
            <FormField label="Agent *" required>
              <div className="relative">
                <button type="button" onClick={() => setShowAgentPicker(true)} className="w-full p-[12px_16px] bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-default)] rounded-[10px] text-[var(--accent-primary)] text-[14px] cursor-pointer flex items-center justify-between text-left">
                  <span className="flex items-center gap-2">{formData.agentId ? <><Robot size={16} className="text-[#d4c5f9]" />{agents.find(a => a.id === formData.agentId)?.name || 'Unknown Agent'}</> : 'Select agent…'}</span>
                  <CaretDown size={16} />
                </button>
                {showAgentPicker && (
                  <>
                    <div role="button" tabIndex={0} className="fixed inset-0 z-[9998]" onClick={() => setShowAgentPicker(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowAgentPicker(false); }} />
                    <div className="absolute left-0 right-0 mt-1 bg-[var(--surface-floating)] rounded-[10px] border border-solid border-[var(--accent-primary)]/10 shadow-[var(--shadow-lg)] z-[9999] overflow-hidden max-h-[300px] overflow-y-auto">
                      {agents.length === 0 ? <div className="p-4 text-[var(--ui-text-muted)] text-[14px] text-center">No agents registered</div> : agents.map(agent => (
                        <button type="button" key={agent.id} onClick={() => handleAgentSelect(agent.id)} className={cn("w-full p-[12px_16px] border-none text-[14px] cursor-pointer text-left flex items-center gap-2.5 transition-colors", formData.agentId === agent.id ? "bg-[rgba(167,139,250,0.1)] text-[#d4c5f9]" : "bg-transparent text-[var(--ui-text-secondary)] hover:bg-white/5")}>
                          <Robot size={18} className="text-[#d4c5f9]" />
                          <div><div className="font-medium">{agent.name}</div>{agent.description && <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5 line-clamp-1">{agent.description}</div>}</div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </FormField>
          )}
          
          <FormField label="Folder to work in">
            <div className="flex gap-2">
              <input aria-label="Input" type="text" value={formData.folder} onChange={(e) => setFormData({ ...formData, folder: e.target.value })} placeholder="Select folder…" className="flex-1 p-[12px_16px] bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-default)] rounded-[10px] text-[var(--accent-primary)] text-[14px] outline-none" />
              <button type="button" onClick={() => setFormData({ ...formData, folder: '/workspace/tasks' })} className="p-[12px_16px] bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-default)] rounded-[10px] text-[var(--accent-primary)] cursor-pointer flex items-center gap-2 hover:bg-white/5 transition-colors"><FolderOpen size={18} /> Browse</button>
            </div>
          </FormField>
          
          <FormField label="Frequency">
            <div className="relative">
              <button type="button" onClick={() => setShowFrequencyDropdown(!showFrequencyDropdown)} className="w-full p-[12px_16px] bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-default)] rounded-[10px] text-[var(--accent-primary)] text-[14px] cursor-pointer flex items-center justify-between text-left">
                {FREQUENCY_OPTIONS.find(o => o.value === formData.frequency)?.label}
                <CaretDown size={16} />
              </button>
              {showFrequencyDropdown && (
                <>
                  <div role="button" tabIndex={0} className="fixed inset-0 z-[9998]" onClick={() => setShowFrequencyDropdown(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowFrequencyDropdown(false); }} />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface-floating)] rounded-[10px] border border-solid border-[var(--accent-primary)]/10 shadow-[var(--shadow-lg)] z-[9999] overflow-hidden">
                    {FREQUENCY_OPTIONS.map(option => (
                      <button type="button" key={option.value} onClick={() => { setFormData({ ...formData, frequency: option.value }); setShowFrequencyDropdown(false); }} className={cn("w-full p-[12px_16px] border-none text-[14px] cursor-pointer text-left transition-colors", formData.frequency === option.value ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]" : "bg-transparent text-[var(--ui-text-secondary)] hover:bg-white/5")}>{option.label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </FormField>
        </div>
        
        <div className="p-[16px_24px_24px] border-t border-solid border-[var(--ui-border-muted)] flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="p-[12px_20px] rounded-[10px] border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-secondary)] text-[14px] font-semibold cursor-pointer hover:bg-white/5 transition-colors">Cancel</button>
          <button type="button" onClick={() => { onSave(initialAutomation?.id || '', { ...formData, modelOrAgent: formData.mode === 'task' ? (formData.modelSelection?.modelName || 'Default Model') : (agents.find(a => a.id === formData.agentId)?.name || 'Unknown Agent'), modelSelection: formData.modelSelection || undefined, agentId: formData.agentId || undefined }); }} disabled={!isValid} className={cn("p-[12px_24px] rounded-[10px] border-none text-[14px] font-semibold transition-all", isValid ? "bg-[linear-gradient(135deg,rgba(217,119,87,0.9)_0%,rgba(212,176,140,0.8)_100%)] text-white cursor-pointer hover:opacity-90" : "bg-[var(--ui-border-default)] text-[var(--ui-text-muted)] cursor-not-allowed")}>{mode === 'create' ? 'Save Task' : 'Update Task'}</button>
        </div>
      </div>
      {showModelPicker && <ModelPicker open={showModelPicker} onOpenChange={setShowModelPicker} onSelect={handleModelSelect} onCancel={() => setShowModelPicker(false)} />}
    </OverlayContainer>
  );
}

function AutomationDetailOverlay({ automation, onClose, onUpdate, onDelete, onRunNow, onEdit, isRunning = false }: { automation: ScheduledAutomation; onClose: () => void; onUpdate: (updates: Partial<ScheduledAutomation>) => void; onDelete: () => void; onRunNow: () => void; onEdit: () => void; isRunning?: boolean }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { agents } = useAgentStore();
  const getFrequencyLabel = (freq: Frequency) => FREQUENCY_OPTIONS.find(o => o.value === freq)?.label || freq;
  const executorInfo = automation.mode === 'agent' && automation.agentId ? { type: 'Agent', name: agents.find(a => a.id === automation.agentId)?.name || 'Unknown Agent', icon: Robot } : { type: 'Model', name: automation.modelSelection?.modelName || automation.modelOrAgent || 'Default Model', icon: Sparkle };
  
  return (
    <OverlayContainer onClose={onClose}>
      <div className="bg-[var(--surface-floating)] rounded-[20px] border border-solid border-[var(--accent-primary)]/20 w-full max-w-[480px] max-h-[90vh] overflow-auto shadow-[0_25px_50px_var(--shell-overlay-backdrop)]">
        <div className="p-[24px_24px_16px] border-b border-solid border-[var(--ui-border-muted)]">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="m-0 mb-2 text-[22px] font-semibold text-[var(--accent-primary)]">{automation.name}</h2>
              <div className="flex items-center gap-2">
                <span className={cn("px-2.5 py-1 rounded-full text-[12px] font-semibold", automation.isActive ? "bg-[var(--status-success-bg)] text-[var(--status-success)]" : "bg-zinc-500/10 text-[var(--ui-text-muted)]")}>{automation.isActive ? 'Active' : 'Inactive'}</span>
                {automation.isActive && automation.nextRun && <span className="text-[12px] text-[var(--ui-text-muted)]">Next run: {new Date(automation.nextRun).toLocaleString()}</span>}
              </div>
            </div>
            <button type="button" onClick={onClose} className="size-8 rounded-lg border-none bg-transparent text-[var(--ui-text-muted)] cursor-pointer flex items-center justify-center hover:bg-white/5"><X size={20} /></button>
          </div>
          <div className="flex gap-2">
            <ActionButton onClick={onEdit} icon={PencilSimple}>Edit</ActionButton>
            <ActionButton onClick={() => setShowDeleteConfirm(true)} icon={Trash} variant="danger">Delete</ActionButton>
            <ActionButton onClick={onRunNow} icon={isRunning ? CircleNotch : Play} variant="primary" isLoading={isRunning}>{isRunning ? 'Running…' : 'Run Now'}</ActionButton>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between p-4 bg-[var(--surface-hover)] rounded-xl mb-6">
            <span className="text-[14px] font-medium text-[var(--ui-text-secondary)]">{automation.isActive ? 'Active' : 'Inactive'}</span>
            <ToggleSwitch checked={automation.isActive} onChange={(checked) => onUpdate({ isActive: checked })} />
          </div>
          <div className="border-t border-solid border-[var(--ui-border-muted)] pt-6 space-y-4">
            <DetailItem label="Description" value={automation.description} />
            <DetailItem label="Instructions" value={automation.prompt} />
            <DetailItem label={executorInfo.type} value={executorInfo.name} icon={executorInfo.icon} />
            <DetailItem label="Working Folder" value={automation.folder || 'Not set'} />
            <DetailItem label="Frequency" value={getFrequencyLabel(automation.frequency)} />
            {automation.lastRun && <DetailItem label="Last Run" value={new Date(automation.lastRun).toLocaleString()} />}
          </div>
        </div>
      </div>
      {showDeleteConfirm && <DeleteConfirmDialog title="Delete Scheduled Task?" message={`Are you sure you want to delete "${automation.name}"? This action cannot be undone.`} onCancel={() => setShowDeleteConfirm(false)} onConfirm={() => { onDelete(); setShowDeleteConfirm(false); }} />}
    </OverlayContainer>
  );
}

function OverlayContainer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div role="button" tabIndex={0} className="fixed inset-0 bg-[var(--shell-overlay-backdrop)] backdrop-blur-md z-[10000]" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001] w-[90%] max-w-[560px]" role="presentation" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>{children}</div>
    </>
  );
}

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="mb-5">
      <div className={cn("block text-[12px] font-semibold mb-2 uppercase tracking-wider", required ? "text-[var(--accent-primary)]" : "text-[var(--ui-text-secondary)]")}>{label}{required && <span className="text-[var(--status-error)] ml-1">*</span>}</div>
      {children}
    </div>
  );
}

function ModeButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex-1 p-3 px-4 rounded-lg border flex items-center justify-center gap-2 text-[14px] font-semibold cursor-pointer transition-all", active ? "border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]" : "border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-muted)] hover:bg-[var(--bg-hover)]")}>
      <Icon size={18} /> {children}
    </button>
  );
}

function ActionButton({ onClick, icon: Icon, children, variant = 'default', isLoading = false }: { onClick: () => void; icon: React.ElementType; children: React.ReactNode; variant?: 'default' | 'danger' | 'primary'; isLoading?: boolean }) {
  const colors = { default: "bg-[var(--surface-hover)] text-[var(--ui-text-secondary)]", danger: "bg-[var(--status-error-bg)] text-[var(--status-error)]", primary: "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]" };
  return (
    <button type="button" onClick={onClick} disabled={isLoading} className={cn("flex-1 p-2.5 px-4 rounded-lg border-none flex items-center justify-center gap-2 text-[13px] font-semibold transition-opacity", isLoading ? "cursor-not-allowed bg-zinc-500/10 text-[var(--ui-text-muted)]" : cn("cursor-pointer", colors[variant]))}>
      {isLoading ? <CircleNotch size={16} className="animate-spin" /> : <Icon size={16} />} {children}
    </button>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={cn("w-12 h-6.5 rounded-full border-none cursor-pointer relative transition-colors duration-200", checked ? "bg-[var(--status-success)]/30" : "bg-zinc-500/30")}>
      <div className={cn("size-5 rounded-full absolute top-0.75 transition-all duration-200", checked ? "left-6.25 bg-[var(--status-success)]" : "left-0.75 bg-[var(--ui-text-muted)]")} />
    </button>
  );
}

function DetailItem({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div className="mb-4">
      <div className="text-[12px] font-semibold text-[var(--ui-text-muted)] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[14px] text-[var(--ui-text-secondary)] leading-relaxed flex items-center gap-2">{Icon && <Icon size={14} />} {value}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="py-20 px-5 text-center text-[var(--ui-text-muted)]">
      <Icon size={64} className="opacity-30 mx-auto mb-6" />
      <h3 className="text-[18px] font-semibold text-[var(--ui-text-secondary)] m-0 mb-2">{title}</h3>
      <p className="text-[14px] m-0">{description}</p>
    </div>
  );
}

function DeleteConfirmDialog({ title, message, onCancel, onConfirm }: { title: string; message: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <>
      <div role="button" tabIndex={0} className="fixed inset-0 bg-[var(--shell-overlay-backdrop)] z-[10002]" onClick={onCancel} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCancel(); }} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--surface-floating)] rounded-2xl border border-solid border-[var(--accent-primary)]/20 p-6 min-w-[320px] z-[10003] shadow-[var(--shadow-xl)]">
        <h3 className="m-0 mb-3 text-base font-bold text-[var(--accent-primary)]">{title}</h3>
        <p className="m-0 mb-5 text-[13px] text-[var(--ui-text-secondary)] leading-relaxed">{message}</p>
        <div className="flex gap-2.5 justify-end">
          <button type="button" onClick={onCancel} className="p-[8px_16px] rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-secondary)] text-[13px] font-semibold cursor-pointer hover:bg-white/5 transition-colors">Cancel</button>
          <button type="button" onClick={onConfirm} className="p-[8px_16px] rounded-lg border-none bg-[linear-gradient(135deg,rgba(239,68,68,0.8)_0%,rgba(220,38,38,0.8)_100%)] text-white text-[13px] font-semibold cursor-pointer hover:opacity-90 transition-opacity">Delete</button>
        </div>
      </div>
    </>
  );
}

interface AgentHeartbeatsTabProps {
  selectedAgent: string | null;
  onSelectAgent: (agentId: string | null) => void;
}

function AgentHeartbeatsTab({ selectedAgent, onSelectAgent }: AgentHeartbeatsTabProps) {
  const { agents, fetchAgents } = useAgentStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAgents().then(() => setLoading(false)); }, [fetchAgents]);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-[var(--ui-text-muted)]"><ArrowsClockwise size={24} className="animate-spin mr-3" /> Loading agents…</div>;
  }

  if (selectedAgent) {
    const agent = agents.find(a => a.id === selectedAgent);
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4 p-[12px_16px] bg-[var(--surface-hover)] rounded-xl border border-solid border-[var(--ui-border-muted)]">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-[10px] bg-[linear-gradient(135deg,rgba(167,139,250,0.2)_0%,rgba(167,139,250,0.1)_100%)] flex items-center justify-center"><Robot size={18} className="text-[#d4c5f9]" /></div>
            <div><div className="text-[14px] font-semibold text-[var(--accent-primary)]">{agent?.name || 'Unknown Agent'}</div><div className="text-[12px] text-[var(--ui-text-muted)]">Managing heartbeat tasks</div></div>
          </div>
          <button type="button" onClick={() => onSelectAgent(null)} className="p-[8px_16px] rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-secondary)] text-[13px] font-semibold cursor-pointer flex items-center gap-2 hover:bg-white/5 transition-colors"><X size={16} /> Change Agent</button>
        </div>
        <div className="flex-1 overflow-auto">
          <HeartbeatScheduler agentId={selectedAgent} onClose={() => onSelectAgent(null)} theme={{ bg: 'var(--surface-canvas)', bgCard: 'var(--surface-hover)', textPrimary: 'var(--accent-primary)', textSecondary: 'var(--ui-text-secondary)', textMuted: 'var(--ui-text-muted)', accent: 'var(--accent-primary)', borderSubtle: 'var(--ui-border-muted)' }} />
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return <EmptyState icon={Robot} title="No agents available" description="Create an agent first to configure heartbeat tasks." />;
  }

  return (
    <div>
      <div className="mb-5 p-[16px_20px] bg-[linear-gradient(135deg,rgba(167,139,250,0.08)_0%,color-mix(in_srgb,var(--accent-primary)_8%,transparent)_100%)] rounded-xl border border-solid border-[var(--accent-primary)]/10">
        <h3 className="m-0 mb-2 text-base font-semibold text-[var(--accent-primary)] flex items-center gap-2"><Clock size={18} /> Agent Heartbeat Tasks</h3>
        <p className="m-0 text-[13px] text-[var(--ui-text-secondary)] leading-relaxed">Configure periodic tasks that agents execute automatically. Heartbeat tasks are stored in each agent's workspace and synced with the scheduler.</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {agents.map(agent => (
          <div role="button" tabIndex={0} key={agent.id} onClick={() => onSelectAgent(agent.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectAgent(agent.id); }} className="p-5 bg-[var(--surface-hover)] rounded-xl border border-solid border-[var(--ui-border-muted)] cursor-pointer transition-all hover:bg-[var(--surface-hover)] hover:border-[var(--accent-primary)]/20">
            <div className="flex items-start gap-4">
              <div className={cn("size-11 rounded-xl flex items-center justify-center shrink-0", agent.status === 'running' ? "bg-[linear-gradient(135deg,rgba(34,197,94,0.15)_0%,rgba(34,197,94,0.05)_100%)]" : "bg-[linear-gradient(135deg,rgba(167,139,250,0.15)_0%,rgba(167,139,250,0.05)_100%)]")}><Robot size={22} className={agent.status === 'running' ? "text-[var(--status-success)]" : "text-[#d4c5f9]"} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1"><span className="text-[15px] font-semibold text-[var(--accent-primary)] truncate">{agent.name}</span><span className={cn("size-2 rounded-full", agent.status === 'running' ? "bg-[var(--status-success)]" : "bg-[var(--ui-text-muted)]")} /></div>
                <p className="m-0 mb-3 text-[13px] text-[var(--ui-text-muted)] leading-normal line-clamp-2">{agent.description || 'No description'}</p>
                <div className="flex items-center gap-3"><span className="text-[12px] text-[var(--ui-text-secondary)] px-2.5 py-1 bg-[var(--surface-hover)] rounded-md">{agent.type}</span><span className="text-[12px] text-[var(--accent-primary)] flex items-center gap-1"><Clock size={12} /> Configure Heartbeats</span></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

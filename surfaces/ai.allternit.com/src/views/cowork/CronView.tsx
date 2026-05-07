/**
 * CronView - Schedule and automate tasks
 * Shows scheduled and recurring tasks with form overlays for creation and management
 */

import React, { useState, useMemo, useEffect } from 'react';
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

  // Scheduled automations from store
  const [scheduledAutomations, setScheduledAutomations] = useState<ScheduledAutomation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [runningAutomationId, setRunningAutomationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Load scheduled jobs from backend on mount
  useEffect(() => {
    loadScheduledJobs();
  }, []);
  
  const loadScheduledJobs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const jobs = await listScheduledJobs();
      // Convert backend jobs to our ScheduledAutomation format
      const convertedAutomations: ScheduledAutomation[] = jobs.map(job => {
        // Determine frequency from cron schedule
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
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter automations
  const filteredAutomations = useMemo(() => {
    if (activeTab === 'scheduled') {
      return scheduledAutomations.filter(t => t.frequency !== 'manual');
    } else {
      return scheduledAutomations.filter(t => t.frequency === 'manual' || t.frequency === 'hourly');
    }
  }, [scheduledAutomations, activeTab]);
  
  // Create new scheduled automation
  const handleCreateAutomation = async (automationData: Omit<ScheduledAutomation, 'id' | 'createdAt' | 'isActive'>) => {
    setIsLoading(true);
    setError(null);
    try {
      // Convert frequency to cron expression
      let cronSchedule: string;
      switch (automationData.frequency) {
        case 'hourly': cronSchedule = '0 * * * *'; break;
        case 'daily': cronSchedule = '0 9 * * *'; break;
        case 'weekdays': cronSchedule = '0 9 * * 1-5'; break;
        case 'weekly': cronSchedule = '0 9 * * 1'; break;
        case 'manual':
        default: cronSchedule = '0 0 * * *'; break;
      }

      // Create the job on the backend
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
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete automation
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
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Update automation (local state only - for toggle active/inactive)
  const handleUpdateAutomation = (automationId: string, updates: Partial<ScheduledAutomation>) => {
    setScheduledAutomations(scheduledAutomations.map(a =>
      a.id === automationId ? { ...a, ...updates } : a
    ));
    if (selectedAutomation?.id === automationId) {
      setSelectedAutomation({ ...selectedAutomation, ...updates });
    }
  };

  // Edit automation - save changes to backend
  const handleEditAutomation = async (automationId: string, automationData: Omit<ScheduledAutomation, 'id' | 'createdAt' | 'isActive'>) => {
    setIsLoading(true);
    setError(null);
    try {
      // Convert frequency to cron expression
      let cronSchedule: string;
      switch (automationData.frequency) {
        case 'hourly': cronSchedule = '0 * * * *'; break;
        case 'daily': cronSchedule = '0 9 * * *'; break;
        case 'weekdays': cronSchedule = '0 9 * * 1-5'; break;
        case 'weekly': cronSchedule = '0 9 * * 1'; break;
        case 'manual':
        default: cronSchedule = '0 0 * * *'; break;
      }

      // Update the job on the backend
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

      // Update local state
      const updatedAutomation: ScheduledAutomation = {
        ...automationData,
        id: automationId,
        createdAt: editingAutomation?.createdAt || new Date().toISOString(),
        isActive: editingAutomation?.isActive ?? true,
      };

      setScheduledAutomations(scheduledAutomations.map(a =>
        a.id === automationId ? updatedAutomation : a
      ));

      // Close edit form and detail view
      setShowEditForm(false);
      setEditingAutomation(null);
      setSelectedAutomation(null);

      // Refresh the list to get updated data from backend
      await loadScheduledJobs();
    } catch (e) {
      setError('Failed to update scheduled job');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Run automation now
  const handleRunNow = async (automation: ScheduledAutomation) => {
    setRunningAutomationId(automation.id);
    setError(null);
    try {
      await runScheduledJobNow(automation.id);
      // Update the automation with last run time
      handleUpdateAutomation(automation.id, { lastRun: new Date().toISOString() });
    } catch (e) {
      setError(`Failed to run automation: ${automation.name}`);
      console.error(e);
    } finally {
      setRunningAutomationId(null);
    }
  };

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 24px 16px',
        borderBottom: '1px solid var(--ui-border-muted)',
      }}>
        {/* Title row - centered */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 600,
              color: 'var(--accent-primary)',
            }}>
              Cron
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: 14,
              color: 'var(--ui-text-muted)',
            }}>
              Schedule and automate your automations
            </p>
          </div>
        </div>
      </div>
      
      {/* Tabs with button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid var(--ui-border-muted)',
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <TabButton
            active={activeTab === 'scheduled'}
            onClick={() => setActiveTab('scheduled')}
            icon={Clock}
            count={scheduledAutomations.filter(a => a.frequency !== 'manual').length}
          >
            Scheduled
          </TabButton>
          <TabButton
            active={activeTab === 'recurring'}
            onClick={() => setActiveTab('recurring')}
            icon={CalendarCheck}
            count={scheduledAutomations.filter(a => a.frequency === 'manual' || a.frequency === 'hourly').length}
          >
            Recurring
          </TabButton>
          <TabButton
            active={activeTab === 'agent-heartbeats'}
            onClick={() => setActiveTab('agent-heartbeats')}
            icon={Robot}
            count={0}
          >
            Agent Heartbeats
          </TabButton>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={loadScheduledJobs}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              height: 32,
              background: 'transparent',
              border: '1px solid var(--ui-border-default)',
              borderRadius: 8,
              color: 'var(--ui-text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            <ArrowsClockwise size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : undefined }} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              height: 32,
              background: 'linear-gradient(135deg, rgba(217,119,87,0.9) 0%, rgba(212,176,140,0.8) 100%)',
              border: 'none',
              borderRadius: 8,
              color: 'var(--ui-text-primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'var(--transition-fast)',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px color-mix(in srgb, var(--accent-primary) 30%, transparent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <Plus size={16} />
          New Automation
        </button>
      </div>
      </div>
      
      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px 24px',
          background: 'var(--status-error-bg)',
          borderBottom: '1px solid color-mix(in srgb, var(--status-error) 30%, transparent)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--status-error)',
          fontSize: '13px',
        }}>
          <Warning size={16} />
          {error}
          <button 
            onClick={() => setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: 'var(--status-error)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Automation Cards Grid or Agent Heartbeats */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px',
      }}>
        {activeTab === 'agent-heartbeats' ? (
          <AgentHeartbeatsTab
            selectedAgent={selectedHeartbeatAgent}
            onSelectAgent={setSelectedHeartbeatAgent}
          />
        ) : filteredAutomations.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}>
            {filteredAutomations.map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                isRunning={runningAutomationId === automation.id}
                onClick={() => setSelectedAutomation(automation)}
                onRunNow={() => handleRunNow(automation)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={activeTab === 'scheduled' ? Clock : CalendarCheck}
            title={`No ${activeTab} automations`}
            description={`Create a ${activeTab} automation to automate your workflow.`}
          />
        )}
      </div>

      {/* Create Automation Form Overlay */}
      {showCreateForm && (
        <CreateAutomationForm
          onClose={() => setShowCreateForm(false)}
          onSave={handleCreateAutomation}
        />
      )}

      {/* Edit Automation Form Overlay */}
      {showEditForm && editingAutomation && (
        <EditAutomationForm
          automation={editingAutomation}
          onClose={() => {
            setShowEditForm(false);
            setEditingAutomation(null);
          }}
          onSave={handleEditAutomation}
        />
      )}

      {/* Automation Detail Overlay */}
      {selectedAutomation && (
        <AutomationDetailOverlay
          automation={selectedAutomation}
          isRunning={runningAutomationId === selectedAutomation.id}
          onClose={() => setSelectedAutomation(null)}
          onUpdate={(updates) => handleUpdateAutomation(selectedAutomation.id, updates)}
          onDelete={() => handleDeleteAutomation(selectedAutomation.id)}
          onRunNow={() => handleRunNow(selectedAutomation)}
          onEdit={() => {
            setEditingAutomation(selectedAutomation);
            setShowEditForm(true);
          }}
        />
      )}
    </div>
  );
}

// Tab Button Component
function TabButton({ 
  active, 
  onClick, 
  icon: Icon, 
  children,
  count 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ElementType;
  children: React.ReactNode;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 16px',
        borderRadius: 10,
        border: 'none',
        background: active 
          ? 'linear-gradient(135deg, rgba(217,119,87,0.18) 0%, color-mix(in srgb, var(--accent-primary) 12%, transparent) 100%)' 
          : 'transparent',
        color: active ? 'var(--accent-primary)' : 'var(--ui-text-muted)',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'var(--transition-fast)',
      }}
    >
      <Icon size={16} />
      {children}
      <span style={{ 
        fontSize: 11, 
        opacity: 0.7,
        marginLeft: 4,
      }}>
        {count}
      </span>
    </button>
  );
}

// Automation Card Component
function AutomationCard({
  automation,
  onClick,
  onRunNow,
  isRunning = false
}: {
  automation: ScheduledAutomation;
  onClick: () => void;
  onRunNow: () => void;
  isRunning?: boolean;
}) {
  const getFrequencyLabel = (freq: Frequency) => {
    return FREQUENCY_OPTIONS.find(o => o.value === freq)?.label || freq;
  };


  // Get display name for model/agent
  const getModelOrAgentDisplay = () => {
    if (automation.mode === 'agent' && automation.agentId) {
      return 'Agent Automation';
    }
    return automation.modelSelection?.modelName || automation.modelOrAgent || 'Default Model';
  };

  return (
    <div
      onClick={onClick}
      style={{
        padding: 20,
        background: 'var(--surface-hover)',
        borderRadius: 16,
        border: '1px solid var(--ui-border-muted)',
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-hover)';
        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-primary) 20%, transparent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--surface-hover)';
        e.currentTarget.style.borderColor = 'var(--ui-border-muted)';
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: automation.mode === 'agent'
            ? 'linear-gradient(135deg, rgba(167,139,250,0.2) 0%, rgba(167,139,250,0.1) 100%)'
            : 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 20%, transparent) 0%, color-mix(in srgb, var(--accent-primary) 10%, transparent) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {automation.mode === 'agent' ? <Robot size={20} color="#d4c5f9" /> : <CheckSquare size={20} color="var(--accent-primary)" />}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            padding: '4px 10px',
            borderRadius: 20,
            background: automation.isActive ? 'var(--status-success-bg)' : 'rgba(107,107,107,0.1)',
            color: automation.isActive ? 'var(--status-success)' : 'var(--ui-text-muted)',
            fontSize: 11,
            fontWeight: 600,
          }}>
            {automation.isActive ? 'Active' : 'Inactive'}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isRunning) onRunNow();
            }}
            disabled={isRunning}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: isRunning ? 'rgba(107,107,107,0.1)' : 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
              color: isRunning ? 'var(--ui-text-muted)' : 'var(--accent-primary)',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isRunning ? (
              <CircleNotch size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Play size={16} />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <h3 style={{
        margin: '0 0 8px 0',
        fontSize: 16,
        fontWeight: 600,
        color: 'var(--accent-primary)',
      }}>
        {automation.name}
      </h3>

      <p style={{
        margin: '0 0 16px 0',
        fontSize: 13,
        color: 'var(--ui-text-muted)',
        lineHeight: 1.5,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {automation.description}
      </p>

      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        paddingTop: 16,
        borderTop: '1px solid var(--ui-border-muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={14} color="var(--ui-text-muted)" />
          <span style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
            {getFrequencyLabel(automation.frequency)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {automation.mode === 'agent' ? <Robot size={14} color="var(--ui-text-muted)" /> : <Cpu size={14} color="var(--ui-text-muted)" />}
          <span style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
            {getModelOrAgentDisplay()}
          </span>
        </div>
      </div>
    </div>
  );
}

// Create Automation Form Overlay
function CreateAutomationForm({
  onClose,
  onSave
}: {
  onClose: () => void;
  onSave: (automation: Omit<ScheduledAutomation, 'id' | 'createdAt' | 'isActive'>) => void;
}) {
  return (
    <AutomationForm
      mode="create"
      onClose={onClose}
      onSave={(automationId, automationData) => onSave(automationData)}
    />
  );
}

// Edit Automation Form Overlay
function EditAutomationForm({
  automation,
  onClose,
  onSave
}: {
  automation: ScheduledAutomation;
  onClose: () => void;
  onSave: (automationId: string, automation: Omit<ScheduledAutomation, 'id' | 'createdAt' | 'isActive'>) => void;
}) {
  return (
    <AutomationForm
      mode="edit"
      initialAutomation={automation}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

// Shared Automation Form Component (for both Create and Edit)
function AutomationForm({
  mode,
  initialAutomation,
  onClose,
  onSave
}: {
  mode: 'create' | 'edit';
  initialAutomation?: ScheduledAutomation;
  onClose: () => void;
  onSave: (automationId: string, automation: Omit<ScheduledAutomation, 'id' | 'createdAt' | 'isActive'>) => void;
}) {
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
  
  // Get agents from store
  const { agents, fetchAgents } = useAgentStore();
  
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);
  
  const isValid = formData.name.trim() && formData.description.trim() && formData.prompt.trim() &&
    (formData.mode === 'task' ? formData.modelSelection : formData.agentId);
  
  
  const handleModelSelect = (selection: ModelSelection) => {
    setFormData({ 
      ...formData, 
      modelSelection: selection,
      modelOrAgent: selection.modelName || selection.modelId 
    });
    setShowModelPicker(false);
  };
  
  const handleAgentSelect = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    setFormData({ 
      ...formData, 
      agentId,
      modelOrAgent: agent?.name || 'Unknown Agent'
    });
    setShowAgentPicker(false);
  };
  
  return (
    <OverlayContainer onClose={onClose}>
      <div style={{
        background: 'var(--surface-floating)',
        borderRadius: 20,
        border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)',
        width: '100%',
        maxWidth: 560,
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px var(--shell-overlay-backdrop)',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 24px 16px',
          borderBottom: '1px solid var(--ui-border-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--accent-primary)',
          }}>
            {mode === 'create' ? 'Create Scheduled Task' : 'Edit Scheduled Task'}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: 'var(--ui-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Form */}
        <div style={{ padding: '24px' }}>
          {/* Mode Toggle */}
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ui-text-secondary)',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Task Type
            </label>
            <div style={{
              display: 'flex',
              gap: 8,
            }}>
              <ModeButton
                active={formData.mode === 'task'}
                onClick={() => setFormData({ ...formData, mode: 'task', agentId: '', modelSelection: null })}
                icon={CheckSquare}
              >
                Task
              </ModeButton>
              <ModeButton
                active={formData.mode === 'agent'}
                onClick={() => setFormData({ ...formData, mode: 'agent', agentId: '', modelSelection: null })}
                icon={Robot}
              >
                Agent Task
              </ModeButton>
            </div>
          </div>
          
          {/* Name */}
          <FormField label="Name *" required>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter task name"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--surface-hover)',
                border: '1px solid var(--ui-border-default)',
                borderRadius: 10,
                color: 'var(--accent-primary)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </FormField>
          
          {/* Description */}
          <FormField label="Description *" required>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of what this automation does"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--surface-hover)',
                border: '1px solid var(--ui-border-default)',
                borderRadius: 10,
                color: 'var(--accent-primary)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </FormField>
          
          {/* Prompt */}
          <FormField label="Prompt *" required>
            <textarea
              value={formData.prompt}
              onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
              placeholder="Detailed instructions for the automation..."
              rows={5}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--surface-hover)',
                border: '1px solid var(--ui-border-default)',
                borderRadius: 10,
                color: 'var(--accent-primary)',
                fontSize: 14,
                outline: 'none',
                resize: 'vertical',
                minHeight: 120,
              }}
            />
          </FormField>
          
          {/* Model Selection (for Task mode) */}
          {formData.mode === 'task' && (
            <FormField label="Model *" required>
              <button
                onClick={() => setShowModelPicker(true)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--ui-border-default)',
                  borderRadius: 10,
                  color: formData.modelSelection ? 'var(--accent-primary)' : 'var(--ui-text-muted)',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {formData.modelSelection ? (
                    <>
                      <Sparkle size={16} color="var(--accent-primary)" />
                      {formData.modelSelection.modelName || formData.modelSelection.modelId}
                      <span style={{ color: 'var(--ui-text-muted)', fontSize: 12 }}>
                        via {formData.modelSelection.providerId}
                      </span>
                    </>
                  ) : (
                    'Select model...'
                  )}
                </span>
                <CaretDown size={16} />
              </button>
            </FormField>
          )}
          
          {/* Agent Selection (for Agent Task mode) */}
          {formData.mode === 'agent' && (
            <FormField label="Agent *" required>
              <button
                onClick={() => setShowAgentPicker(true)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--ui-border-default)',
                  borderRadius: 10,
                  color: formData.agentId ? 'var(--accent-primary)' : 'var(--ui-text-muted)',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {formData.agentId ? (
                    <>
                      <Robot size={16} color="#d4c5f9" />
                      {agents.find(a => a.id === formData.agentId)?.name || 'Unknown Agent'}
                    </>
                  ) : (
                    'Select agent...'
                  )}
                </span>
                <CaretDown size={16} />
              </button>
              
              {/* Agent Picker Dropdown */}
              {showAgentPicker && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 9998,
                    }}
                    onClick={() => setShowAgentPicker(false)}
                  />
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    background: 'var(--surface-floating)',
                    borderRadius: 10,
                    border: '1px solid color-mix(in srgb, var(--accent-primary) 14%, transparent)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 9999,
                    overflow: 'hidden',
                    maxHeight: 300,
                    overflowY: 'auto',
                  }}>
                    {agents.length === 0 ? (
                      <div style={{
                        padding: '16px',
                        color: 'var(--ui-text-muted)',
                        fontSize: 14,
                        textAlign: 'center',
                      }}>
                        No agents registered
                      </div>
                    ) : (
                      agents.map(agent => (
                        <button
                          key={agent.id}
                          onClick={() => handleAgentSelect(agent.id)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: formData.agentId === agent.id 
                              ? 'rgba(167,139,250,0.1)' 
                              : 'transparent',
                            color: formData.agentId === agent.id ? '#d4c5f9' : 'var(--ui-text-secondary)',
                            fontSize: 14,
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                          }}
                          onMouseEnter={(e) => {
                            if (formData.agentId !== agent.id) {
                              e.currentTarget.style.background = 'var(--surface-hover)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (formData.agentId !== agent.id) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          <Robot size={18} color="#d4c5f9" />
                          <div>
                            <div style={{ fontWeight: 500 }}>{agent.name}</div>
                            {agent.description && (
                              <div style={{ fontSize: 12, color: 'var(--ui-text-muted)', marginTop: 2 }}>
                                {agent.description}
                              </div>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </FormField>
          )}
          
          {/* Folder */}
          <FormField label="Folder to work in">
            <div style={{
              display: 'flex',
              gap: 8,
            }}>
              <input
                type="text"
                value={formData.folder}
                onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
                placeholder="Select folder..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--ui-border-default)',
                  borderRadius: 10,
                  color: 'var(--accent-primary)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => {
                  setFormData({ ...formData, folder: '/workspace/tasks' });
                }}
                style={{
                  padding: '12px 16px',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--ui-border-default)',
                  borderRadius: 10,
                  color: 'var(--accent-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <FolderOpen size={18} />
                Browse
              </button>
            </div>
          </FormField>
          
          {/* Frequency */}
          <FormField label="Frequency">
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowFrequencyDropdown(!showFrequencyDropdown)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--ui-border-default)',
                  borderRadius: 10,
                  color: 'var(--accent-primary)',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                {FREQUENCY_OPTIONS.find(o => o.value === formData.frequency)?.label}
                <CaretDown size={16} />
              </button>
              
              {showFrequencyDropdown && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 9998,
                    }}
                    onClick={() => setShowFrequencyDropdown(false)}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    background: 'var(--surface-floating)',
                    borderRadius: 10,
                    border: '1px solid color-mix(in srgb, var(--accent-primary) 14%, transparent)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 9999,
                    overflow: 'hidden',
                  }}>
                    {FREQUENCY_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFormData({ ...formData, frequency: option.value });
                          setShowFrequencyDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          background: formData.frequency === option.value 
                            ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' 
                            : 'transparent',
                          color: formData.frequency === option.value ? 'var(--accent-primary)' : 'var(--ui-text-secondary)',
                          fontSize: 14,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </FormField>
        </div>
        
        {/* Footer */}
        <div style={{
          padding: '16px 24px 24px',
          borderTop: '1px solid var(--ui-border-muted)',
          display: 'flex',
          gap: 12,
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 20px',
              borderRadius: 10,
              border: '1px solid var(--ui-border-default)',
              background: 'transparent',
              color: 'var(--ui-text-secondary)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (mode === 'edit' && initialAutomation) {
                onSave(initialAutomation.id, {
                  name: formData.name,
                  description: formData.description,
                  prompt: formData.prompt,
                  modelOrAgent: formData.mode === 'task' 
                    ? (formData.modelSelection?.modelName || 'Default Model')
                    : (agents.find(a => a.id === formData.agentId)?.name || 'Unknown Agent'),
                  modelSelection: formData.modelSelection || undefined,
                  agentId: formData.agentId || undefined,
                  folder: formData.folder,
                  frequency: formData.frequency,
                  mode: formData.mode,
                });
              } else {
                onSave('', {
                  name: formData.name,
                  description: formData.description,
                  prompt: formData.prompt,
                  modelOrAgent: formData.mode === 'task' 
                    ? (formData.modelSelection?.modelName || 'Default Model')
                    : (agents.find(a => a.id === formData.agentId)?.name || 'Unknown Agent'),
                  modelSelection: formData.modelSelection || undefined,
                  agentId: formData.agentId || undefined,
                  folder: formData.folder,
                  frequency: formData.frequency,
                  mode: formData.mode,
                });
              }
            }}
            disabled={!isValid}
            style={{
              padding: '12px 24px',
              borderRadius: 10,
              border: 'none',
              background: isValid 
                ? 'linear-gradient(135deg, rgba(217,119,87,0.9) 0%, rgba(212,176,140,0.8) 100%)' 
                : 'var(--ui-border-default)',
              color: isValid ? '#fff' : 'var(--ui-text-muted)',
              fontSize: 14,
              fontWeight: 600,
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            {mode === 'create' ? 'Save Task' : 'Update Task'}
          </button>
        </div>
      </div>
      
      {/* Model Picker Dialog */}
      {showModelPicker && (
        <ModelPicker
          open={showModelPicker}
          onOpenChange={setShowModelPicker}
          onSelect={handleModelSelect}
          onCancel={() => setShowModelPicker(false)}
        />
      )}
    </OverlayContainer>
  );
}

// Automation Detail Overlay
function AutomationDetailOverlay({
  automation,
  onClose,
  onUpdate,
  onDelete,
  onRunNow,
  onEdit,
  isRunning = false
}: {
  automation: ScheduledAutomation;
  onClose: () => void;
  onUpdate: (updates: Partial<ScheduledAutomation>) => void;
  onDelete: () => void;
  onRunNow: () => void;
  onEdit: () => void;
  isRunning?: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { agents } = useAgentStore();

  const getFrequencyLabel = (freq: Frequency) => {
    return FREQUENCY_OPTIONS.find(o => o.value === freq)?.label || freq;
  };

  // Get display info for model/agent
  const getExecutorInfo = () => {
    if (automation.mode === 'agent' && automation.agentId) {
      const agent = agents.find(a => a.id === automation.agentId);
      return { type: 'Agent', name: agent?.name || 'Unknown Agent', icon: Robot };
    }
    return {
      type: 'Model',
      name: automation.modelSelection?.modelName || automation.modelOrAgent || 'Default Model',
      icon: Sparkle
    };
  };

  const executorInfo = getExecutorInfo();
  
  return (
    <OverlayContainer onClose={onClose}>
      <div style={{
        background: 'var(--surface-floating)',
        borderRadius: 20,
        border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)',
        width: '100%',
        maxWidth: 480,
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px var(--shell-overlay-backdrop)',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 24px 16px',
          borderBottom: '1px solid var(--ui-border-muted)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}>
            <div>
              <h2 style={{
                margin: '0 0 8px 0',
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--accent-primary)',
              }}>
                {automation.name}
              </h2>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: automation.isActive ? 'var(--status-success-bg)' : 'rgba(107,107,107,0.1)',
                  color: automation.isActive ? 'var(--status-success)' : 'var(--ui-text-muted)',
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  {automation.isActive ? 'Active' : 'Inactive'}
                </span>
                {automation.isActive && automation.nextRun && (
                  <span style={{
                    fontSize: 12,
                    color: 'var(--ui-text-muted)',
                  }}>
                    Next run: {new Date(automation.nextRun).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: 'var(--ui-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: 8,
          }}>
            <ActionButton onClick={onEdit} icon={PencilSimple}>
              Edit
            </ActionButton>
            <ActionButton onClick={() => setShowDeleteConfirm(true)} icon={Trash} variant="danger">
              Delete
            </ActionButton>
            <ActionButton onClick={onRunNow} icon={isRunning ? CircleNotch : Play} variant="primary" isLoading={isRunning}>
              {isRunning ? 'Running...' : 'Run Now'}
            </ActionButton>
          </div>
        </div>
        
        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Toggle Active */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            background: 'var(--surface-hover)',
            borderRadius: 12,
            marginBottom: 24,
          }}>
            <span style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--ui-text-secondary)',
            }}>
              {automation.isActive ? 'Active' : 'Inactive'}
            </span>
            <ToggleSwitch 
              checked={automation.isActive} 
              onChange={(checked) => onUpdate({ isActive: checked })}
            />
          </div>
          
          {/* Details */}
          <div style={{
            borderTop: '1px solid var(--ui-border-muted)',
            paddingTop: 24,
          }}>
            <DetailItem label="Description" value={automation.description} />
            <DetailItem label="Instructions" value={automation.prompt} />
            <DetailItem 
              label={executorInfo.type} 
              value={executorInfo.name}
              icon={executorInfo.icon}
            />
            <DetailItem label="Working Folder" value={automation.folder || 'Not set'} />
            <DetailItem label="Frequency" value={getFrequencyLabel(automation.frequency)} />
            {automation.lastRun && (
              <DetailItem label="Last Run" value={new Date(automation.lastRun).toLocaleString()} />
            )}
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <DeleteConfirmDialog
          title="Delete Scheduled Task?"
          message={`Are you sure you want to delete "${automation.name}"? This action cannot be undone.`}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            onDelete();
            setShowDeleteConfirm(false);
          }}
        />
      )}
    </OverlayContainer>
  );
}

// Helper Components

function OverlayContainer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--shell-overlay-backdrop)',
          backdropFilter: 'blur(8px)',
          zIndex: 10000,
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10001,
          width: '90%',
          maxWidth: 560,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}

function FormField({ 
  label, 
  children, 
  required 
}: { 
  label: string; 
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        color: required ? 'var(--accent-primary)' : 'var(--ui-text-secondary)',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
        {required && <span style={{ color: 'var(--status-error)', marginLeft: 4 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function ModeButton({ 
  active, 
  onClick, 
  icon: Icon, 
  children 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px 16px',
        borderRadius: 10,
        border: `1px solid ${active ? 'color-mix(in srgb, var(--accent-primary) 30%, transparent)' : 'var(--ui-border-default)'}`,
        background: active ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' : 'transparent',
        color: active ? 'var(--accent-primary)' : 'var(--ui-text-muted)',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <Icon size={18} />
      {children}
    </button>
  );
}

function ActionButton({ 
  onClick, 
  icon: Icon, 
  children, 
  variant = 'default',
  isLoading = false
}: { 
  onClick: () => void; 
  icon: React.ElementType; 
  children: React.ReactNode;
  variant?: 'default' | 'danger' | 'primary';
  isLoading?: boolean;
}) {
  const colors = {
    default: { bg: 'var(--surface-hover)', color: 'var(--ui-text-secondary)' },
    danger: { bg: 'var(--status-error-bg)', color: 'var(--status-error)' },
    primary: { bg: 'color-mix(in srgb, var(--accent-primary) 20%, transparent)', color: 'var(--accent-primary)' },
  };
  
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      style={{
        flex: 1,
        padding: '10px 16px',
        borderRadius: 10,
        border: 'none',
        background: isLoading ? 'rgba(107,107,107,0.1)' : colors[variant].bg,
        color: isLoading ? 'var(--ui-text-muted)' : colors[variant].color,
        fontSize: 13,
        fontWeight: 600,
        cursor: isLoading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {isLoading ? (
        <CircleNotch size={16} style={{ animation: 'spin 1s linear infinite' }} />
      ) : (
        <Icon size={16} />
      )}
      {children}
    </button>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 48,
        height: 26,
        borderRadius: 13,
        border: 'none',
        background: checked ? 'rgba(34,197,94,0.3)' : 'rgba(107,107,107,0.3)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'var(--transition-fast)',
      }}
    >
      <div style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: checked ? 'var(--status-success)' : 'var(--ui-text-muted)',
        position: 'absolute',
        top: 3,
        left: checked ? 25 : 3,
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

function DetailItem({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--ui-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 14,
        color: 'var(--ui-text-secondary)',
        lineHeight: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        {Icon && <Icon size={14} />}
        {value}
      </div>
    </div>
  );
}

function EmptyState({ 
  icon: Icon, 
  title, 
  description
}: { 
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div style={{
      padding: '80px 20px',
      textAlign: 'center',
      color: 'var(--ui-text-muted)',
    }}>
      <Icon size={64} style={{ opacity: 0.3, marginBottom: 24 }} />
      <h3 style={{ 
        fontSize: 18, 
        fontWeight: 600, 
        color: 'var(--ui-text-secondary)',
        margin: '0 0 8px 0' 
      }}>
        {title}
      </h3>
      <p style={{ fontSize: 14, margin: 0 }}>{description}</p>
    </div>
  );
}

function DeleteConfirmDialog({ 
  title, 
  message, 
  onCancel, 
  onConfirm 
}: { 
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--shell-overlay-backdrop)',
          zIndex: 10002,
        }}
        onClick={onCancel}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--surface-floating)',
          borderRadius: 16,
          border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)',
          padding: '24px',
          minWidth: 320,
          zIndex: 10003,
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <h3 style={{ 
          margin: '0 0 12px 0', 
          fontSize: 16, 
          fontWeight: 700, 
          color: 'var(--accent-primary)' 
        }}>
          {title}
        </h3>
        <p style={{ 
          margin: '0 0 20px 0', 
          fontSize: 13, 
          color: 'var(--ui-text-secondary)',
          lineHeight: 1.5 
        }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--ui-border-default)',
              background: 'transparent',
              color: 'var(--ui-text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.8) 0%, rgba(220,38,38,0.8) 100%)',
              color: 'var(--ui-text-primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </>
  );
}


// Agent Heartbeats Tab Component
interface AgentHeartbeatsTabProps {
  selectedAgent: string | null;
  onSelectAgent: (agentId: string | null) => void;
}

function AgentHeartbeatsTab({ selectedAgent, onSelectAgent }: AgentHeartbeatsTabProps) {
  const { agents, fetchAgents } = useAgentStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents().then(() => setLoading(false));
  }, [fetchAgents]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--ui-text-muted)',
      }}>
        <ArrowsClockwise size={24} style={{ animation: 'spin 1s linear infinite', marginRight: 12 }} />
        Loading agents...
      </div>
    );
  }

  // If an agent is selected, show the HeartbeatScheduler
  if (selectedAgent) {
    const agent = agents.find(a => a.id === selectedAgent);
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Agent header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          padding: '12px 16px',
          background: 'var(--surface-hover)',
          borderRadius: 12,
          border: '1px solid var(--ui-border-muted)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(167,139,250,0.2) 0%, rgba(167,139,250,0.1) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Robot size={18} color="#d4c5f9" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-primary)' }}>
                {agent?.name || 'Unknown Agent'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
                Managing heartbeat tasks
              </div>
            </div>
          </div>
          <button
            onClick={() => onSelectAgent(null)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--ui-border-default)',
              background: 'transparent',
              color: 'var(--ui-text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <X size={16} />
            Change Agent
          </button>
        </div>

        {/* Heartbeat Scheduler */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <HeartbeatScheduler 
            agentId={selectedAgent} 
            onClose={() => onSelectAgent(null)}
            theme={{
              bg: 'var(--surface-canvas)',
              bgCard: 'var(--surface-hover)',
              textPrimary: 'var(--accent-primary)',
              textSecondary: 'var(--ui-text-secondary)',
              textMuted: 'var(--ui-text-muted)',
              accent: 'var(--accent-primary)',
              borderSubtle: 'var(--ui-border-muted)',
            }}
          />
        </div>
      </div>
    );
  }

  // No agent selected - show agent list
  if (agents.length === 0) {
    return (
      <EmptyState 
        icon={Robot}
        title="No agents available"
        description="Create an agent first to configure heartbeat tasks."
      />
    );
  }

  return (
    <div>
      <div style={{
        marginBottom: 20,
        padding: '16px 20px',
        background: 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, color-mix(in srgb, var(--accent-primary) 8%, transparent) 100%)',
        borderRadius: 12,
        border: '1px solid color-mix(in srgb, var(--accent-primary) 10%, transparent)',
      }}>
        <h3 style={{
          margin: '0 0 8px 0',
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Clock size={18} />
          Agent Heartbeat Tasks
        </h3>
        <p style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--ui-text-secondary)',
          lineHeight: 1.5,
        }}>
          Configure periodic tasks that agents execute automatically. Heartbeat tasks are stored in each agent's workspace and synced with the scheduler.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 16,
      }}>
        {agents.map(agent => (
          <div
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            style={{
              padding: 20,
              background: 'var(--surface-hover)',
              borderRadius: 12,
              border: '1px solid var(--ui-border-muted)',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-hover)';
              e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-primary) 20%, transparent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface-hover)';
              e.currentTarget.style.borderColor = 'var(--ui-border-muted)';
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: agent.status === 'running' 
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(167,139,250,0.15) 0%, rgba(167,139,250,0.05) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Robot size={22} color={agent.status === 'running' ? 'var(--status-success)' : '#d4c5f9'} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 4,
                }}>
                  <span style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--accent-primary)',
                  }}>
                    {agent.name}
                  </span>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: agent.status === 'running' ? 'var(--status-success)' : 'var(--ui-text-muted)',
                  }} />
                </div>
                <p style={{
                  margin: '0 0 12px 0',
                  fontSize: 13,
                  color: 'var(--ui-text-muted)',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {agent.description || 'No description'}
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <span style={{
                    fontSize: 11,
                    color: 'var(--ui-text-secondary)',
                    padding: '4px 10px',
                    background: 'var(--surface-hover)',
                    borderRadius: 6,
                  }}>
                    {agent.type}
                  </span>
                  <span style={{
                    fontSize: 11,
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <Clock size={12} />
                    Configure Heartbeats
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

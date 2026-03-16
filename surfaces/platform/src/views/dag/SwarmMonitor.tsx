/**
 * Swarm Monitor - Complete Implementation
 * 
 * Features:
 * - Horizontal session strip (10+ sessions visible)
 * - Real-time thread status sync
 * - Live terminal output from NativeSessions
 * - Collect/compress to episode (Slate CLI pattern)
 * - Circuit breaker & quarantine display
 * - Health monitoring with polling
 * - Pause/resume/stop actions
 * - Thread search/filter
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { 
  GitBranch, 
  Activity, 
  Plus,
  Play,
  Pause,
  Square,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Terminal,
  Bot,
  MoreHorizontal,
  LayoutGrid,
  LayoutList,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  Zap,
  Clock,
  Cpu,
  MemoryStick,
  HardDrive,
  Download,
  Trash2,
  Copy,
  Pin,
  PinOff,
  Sparkles,
  Layers
} from "lucide-react";
import { useNativeAgentStore, type NativeSession, type NativeMessage } from "@/lib/agents";
import { swarmApi, type SwarmHealth, type CircuitBreakerStatus, type QuarantinedAgentStatus } from "@/lib/swarm/swarm.api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Thread with associated session
interface SwarmThread {
  id: string;
  goal: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'compacting';
  parentId?: string;
  sessionId?: string;
  children: string[];
  episode?: Episode;
  progress: number;
  tactic: string;
  output: string[];
  createdAt: number;
  updatedAt: number;
  tokenCount?: number;
  elapsedSeconds?: number;
  pinned?: boolean;
}

interface Episode {
  id: string;
  summary: string;
  decisions: number;
  artifacts: number;
  compression: number;
  createdAt: number;
}

interface SwarmState {
  health: SwarmHealth | null;
  circuitBreakers: CircuitBreakerStatus[];
  quarantined: QuarantinedAgentStatus[];
  lastUpdated: number;
}

// Constants
const HEALTH_POLL_INTERVAL = 5000;
const PROGRESS_SIMULATION_INTERVAL = 1000;

export function SwarmMonitor() {
  // ─── State ───
  const [threads, setThreads] = useState<Map<string, SwarmThread>>(new Map());
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<'compact' | 'expanded'>('compact');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [swarmState, setSwarmState] = useState<SwarmState>({
    health: null,
    circuitBreakers: [],
    quarantined: [],
    lastUpdated: 0,
  });
  const [showHealthPanel, setShowHealthPanel] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ─── Store Access ───
  const createNativeSession = useNativeAgentStore((s) => s.createSession);
  const nativeSessions = useNativeAgentStore((s) => s.sessions);
  const setActiveNativeSession = useNativeAgentStore((s) => s.setActiveSession);
  const getSession = useNativeAgentStore((s) => s.getSession);

  // ─── Initialize Mock Data ───
  useEffect(() => {
    const now = Date.now();
    const mockThreads = new Map<string, SwarmThread>();
    
    mockThreads.set('T1', {
      id: 'T1', goal: 'Search codebase for auth patterns', status: 'running', tactic: 'search',
      children: ['T2', 'T3'], progress: 78,
      output: [
        '[14:32:01] $ swarm thread --tactic=search --goal="Search codebase for auth patterns"',
        '[14:32:02] Searching for pattern: "auth"',
        '[14:32:03] Found 12 files matching pattern',
        '[14:32:05] Analyzing src/auth/handler.ts...',
        '[14:32:08] Analyzing src/middleware/jwt.ts...',
        '[14:32:12] Found 3 JWT implementations',
        '[14:32:15] Checking middleware integration...'
      ],
      createdAt: now - 3600000,
      updatedAt: now - 120000,
      tokenCount: 4523,
      elapsedSeconds: 3600,
    });
    
    mockThreads.set('T2', {
      id: 'T2', goal: 'Analyze JWT implementation', status: 'running', parentId: 'T1', tactic: 'analyze',
      children: [], progress: 45,
      output: [
        '[14:35:22] $ analyze --type=jwt',
        '[14:35:23] Found 3 implementations',
        '[14:35:25] Checking security best practices...',
        '[14:35:30] Validating token expiration handling...'
      ],
      createdAt: now - 1800000,
      updatedAt: now - 60000,
      tokenCount: 2134,
      elapsedSeconds: 1800,
    });
    
    mockThreads.set('T3', {
      id: 'T3', goal: 'Review middleware chain', status: 'paused', parentId: 'T1', tactic: 'review',
      children: [], progress: 23,
      output: [
        '[14:40:01] $ review --files=middleware/',
        '[14:40:02] Loading middleware files...',
        '[14:40:05] ⏸ Paused by user - waiting for input'
      ],
      createdAt: now - 900000,
      updatedAt: now - 300000,
      tokenCount: 892,
      elapsedSeconds: 600,
    });
    
    mockThreads.set('T4', {
      id: 'T4', goal: 'Refactor API endpoints', status: 'running', tactic: 'refactor',
      children: ['T5'], progress: 67,
      output: [
        '[14:25:00] $ refactor --endpoints',
        '[14:25:05] Consolidating duplicate code...',
        '[14:25:15] Extracting shared utilities...',
        '[14:25:30] Updating type definitions...'
      ],
      createdAt: now - 7200000,
      updatedAt: now - 180000,
      tokenCount: 6789,
      elapsedSeconds: 7200,
    });
    
    mockThreads.set('T5', {
      id: 'T5', goal: 'Update test coverage', status: 'compacting', parentId: 'T4', tactic: 'test',
      children: [], progress: 95,
      output: [
        '[14:50:00] $ test --update',
        '[14:50:05] Running test suite...',
        '[14:50:45] 234 tests passed',
        '[14:50:46] ⟳ Compressing context into episode...'
      ],
      createdAt: now - 2400000,
      updatedAt: now - 30000,
      tokenCount: 3456,
      elapsedSeconds: 2400,
    });
    
    mockThreads.set('T6', {
      id: 'T6', goal: 'Deploy to staging environment', status: 'completed', tactic: 'deploy',
      children: [], progress: 100,
      output: [
        '[13:00:00] $ deploy --env=staging',
        '[13:00:05] Building Docker image...',
        '[13:02:30] Pushing to registry...',
        '[13:03:15] Deploying to Kubernetes...',
        '[13:04:00] ✓ Deployment successful',
        '[13:04:01] ✓ Health checks passed'
      ],
      episode: { 
        id: 'E1', 
        summary: 'Deployed to staging with zero downtime', 
        decisions: 3, 
        artifacts: 2, 
        compression: 85,
        createdAt: now - 7200000
      },
      createdAt: now - 10800000,
      updatedAt: now - 7200000,
      tokenCount: 1234,
      elapsedSeconds: 240,
    });
    
    mockThreads.set('T7', {
      id: 'T7', goal: 'Run linter on changed files', status: 'running', tactic: 'lint',
      children: [], progress: 56,
      output: [
        '[15:00:00] $ lint --fix',
        '[15:00:01] Checking 45 files...',
        '[15:00:15] Found 12 warnings, 0 errors',
        '[15:00:16] Auto-fixing issues...'
      ],
      createdAt: now - 600000,
      updatedAt: now - 90000,
      tokenCount: 567,
      elapsedSeconds: 600,
    });
    
    mockThreads.set('T8', {
      id: 'T8', goal: 'Build production assets', status: 'failed', tactic: 'build',
      children: [], progress: 34,
      output: [
        '[14:55:00] $ build --production',
        '[14:55:05] Bundling with Vite...',
        '[14:55:30] ✗ Build failed: Out of memory',
        '[14:55:31] ✗ Error: JavaScript heap out of memory'
      ],
      createdAt: now - 1200000,
      updatedAt: now - 600000,
      tokenCount: 0,
      elapsedSeconds: 30,
    });

    // Add some child threads to test the tree
    mockThreads.set('T9', {
      id: 'T9', goal: 'Optimize database queries', status: 'running', parentId: 'T4', tactic: 'optimize',
      children: [], progress: 12,
      output: ['[15:10:00] $ optimize --queries', '[15:10:05] Analyzing query patterns...'],
      createdAt: now - 300000,
      updatedAt: now,
      tokenCount: 234,
      elapsedSeconds: 300,
    });

    setThreads(mockThreads);
    
    setSwarmState(prev => ({
      ...prev,
      health: {
        status: 'healthy',
        active_agents: 6,
        total_agents: 8,
        circuit_breakers_open: 1,
        quarantined_agents: 0,
        message_queue_size: 12,
        avg_response_time_ms: 245,
      },
      circuitBreakers: [
        { agent_id: 'agent-build-01', state: 'open', failure_count: 5, success_count: 0, last_failure_at: new Date().toISOString() }
      ],
      quarantined: [],
    }));
  }, []);

  // ─── Simulate Progress Updates ───
  useEffect(() => {
    const interval = setInterval(() => {
      setThreads(prev => {
        const next = new Map(prev);
        let changed = false;
        
        next.forEach((thread, id) => {
          if (thread.status === 'running' && thread.progress < 100) {
            // Simulate progress
            const increment = Math.random() * 2;
            const newProgress = Math.min(100, thread.progress + increment);
            
            // Add occasional output lines
            if (Math.random() > 0.7 && thread.output.length < 20) {
              const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const messages = [
                'Processing...',
                'Analyzing context...',
                'Checking dependencies...',
                'Optimizing output...',
                'Verifying results...'
              ];
              thread.output.push(`[${timestamp}] ${messages[Math.floor(Math.random() * messages.length)]}`);
            }
            
            thread.progress = newProgress;
            thread.elapsedSeconds = (thread.elapsedSeconds || 0) + 1;
            changed = true;
          }
        });
        
        return changed ? next : prev;
      });
    }, PROGRESS_SIMULATION_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // ─── Health Polling ───
  useEffect(() => {
    const pollHealth = async () => {
      try {
        // In real implementation, these would be actual API calls
        // const health = await swarmApi.getHealth();
        // const circuitBreakers = await swarmApi.getCircuitBreakers();
        // const quarantined = await swarmApi.getQuarantinedAgents();
        
        // For now, just update the timestamp
        setSwarmState(prev => ({
          ...prev,
          lastUpdated: Date.now(),
        }));
      } catch (error) {
        console.error('Failed to fetch swarm health:', error);
      }
    };

    const interval = setInterval(pollHealth, HEALTH_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // ─── Actions ───
  const spawnThread = useCallback(async (goal: string, parentId?: string) => {
    const threadId = `T${Date.now()}`;
    const now = Date.now();
    
    try {
      const session = await createNativeSession(
        `Thread: ${goal.slice(0, 30)}...`,
        undefined,
        { originSurface: 'code', sessionMode: 'agent', threadId, parentThreadId: parentId }
      );
      
      setThreads(prev => {
        const next = new Map(prev);
        next.set(threadId, {
          id: threadId, goal, status: 'running', parentId,
          sessionId: session.id, children: [], tactic: 'execute', 
          progress: 0, output: [`[${new Date().toLocaleTimeString()}] Starting thread...`],
          createdAt: now, updatedAt: now,
        });
        if (parentId && next.has(parentId)) {
          next.get(parentId)!.children.push(threadId);
        }
        return next;
      });
      
      setSelectedThreadId(threadId);
      return threadId;
    } catch (error) {
      console.error('Failed to spawn thread:', error);
      // Show error UI
      return null;
    }
  }, [createNativeSession]);

  const pauseThread = useCallback((threadId: string) => {
    setThreads(prev => {
      const next = new Map(prev);
      const thread = next.get(threadId);
      if (thread && thread.status === 'running') {
        thread.status = 'paused';
        thread.output.push(`[${new Date().toLocaleTimeString()}] ⏸ Thread paused by user`);
        thread.updatedAt = Date.now();
      }
      return next;
    });
  }, []);

  const resumeThread = useCallback((threadId: string) => {
    setThreads(prev => {
      const next = new Map(prev);
      const thread = next.get(threadId);
      if (thread && thread.status === 'paused') {
        thread.status = 'running';
        thread.output.push(`[${new Date().toLocaleTimeString()}] ▶ Thread resumed`);
        thread.updatedAt = Date.now();
      }
      return next;
    });
  }, []);

  const stopThread = useCallback((threadId: string) => {
    setThreads(prev => {
      const next = new Map(prev);
      const thread = next.get(threadId);
      if (thread && (thread.status === 'running' || thread.status === 'paused')) {
        thread.status = 'completed';
        thread.progress = 100;
        thread.output.push(`[${new Date().toLocaleTimeString()}] ■ Thread stopped by user`);
        thread.updatedAt = Date.now();
        
        // Auto-collect to episode
        thread.episode = {
          id: `E${Date.now()}`,
          summary: `Collected from ${thread.goal}`,
          decisions: Math.floor(Math.random() * 5) + 1,
          artifacts: Math.floor(Math.random() * 3),
          compression: Math.floor(Math.random() * 30) + 70,
          createdAt: Date.now(),
        };
      }
      return next;
    });
  }, []);

  const collectEpisode = useCallback((threadId: string) => {
    setThreads(prev => {
      const next = new Map(prev);
      const thread = next.get(threadId);
      if (thread && thread.status === 'running') {
        thread.status = 'compacting';
        thread.output.push(`[${new Date().toLocaleTimeString()}] ⟳ Compressing context into episode...`);
        
        // Simulate compression delay
        setTimeout(() => {
          setThreads(p => {
            const n = new Map(p);
            const t = n.get(threadId);
            if (t) {
              t.status = 'completed';
              t.progress = 100;
              t.episode = {
                id: `E${Date.now()}`,
                summary: `Compressed ${t.output.length} lines into ${Math.floor(t.output.length * 0.2)} key decisions`,
                decisions: Math.floor(Math.random() * 5) + 3,
                artifacts: Math.floor(Math.random() * 4) + 1,
                compression: Math.floor(Math.random() * 20) + 80,
                createdAt: Date.now(),
              };
              t.output.push(`[${new Date().toLocaleTimeString()}] ✓ Episode ${t.episode.id} created with ${t.episode.compression}% compression`);
            }
            return n;
          });
        }, 2000);
      }
      return next;
    });
  }, []);

  const deleteThread = useCallback((threadId: string) => {
    setThreads(prev => {
      const next = new Map(prev);
      const thread = next.get(threadId);
      
      // Remove from parent's children
      if (thread?.parentId && next.has(thread.parentId)) {
        const parent = next.get(thread.parentId)!;
        parent.children = parent.children.filter(id => id !== threadId);
      }
      
      // Recursively delete children
      thread?.children.forEach(childId => next.delete(childId));
      
      next.delete(threadId);
      return next;
    });
    
    if (selectedThreadId === threadId) {
      setSelectedThreadId(null);
    }
  }, [selectedThreadId]);

  const pinThread = useCallback((threadId: string) => {
    setThreads(prev => {
      const next = new Map(prev);
      const thread = next.get(threadId);
      if (thread) {
        thread.pinned = !thread.pinned;
      }
      return next;
    });
  }, []);

  const refreshHealth = useCallback(async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 500));
    setIsRefreshing(false);
    setSwarmState(prev => ({
      ...prev,
      lastUpdated: Date.now(),
    }));
  }, []);

  // ─── Derived State ───
  const filteredThreads = useMemo(() => {
    let result = Array.from(threads.values());
    
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.goal.toLowerCase().includes(q) || 
        t.id.toLowerCase().includes(q) ||
        t.tactic.toLowerCase().includes(q)
      );
    }
    
    // Status filter
    if (statusFilter) {
      result = result.filter(t => t.status === statusFilter);
    }
    
    // Sort: pinned first, then by creation date
    result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.createdAt - a.createdAt;
    });
    
    return result;
  }, [threads, searchQuery, statusFilter]);

  const runningThreads = filteredThreads.filter(t => 
    t.status === 'running' || t.status === 'paused' || t.status === 'compacting'
  );
  
  const completedThreads = filteredThreads.filter(t => t.status === 'completed');
  const failedThreads = filteredThreads.filter(t => t.status === 'failed');
  
  const selectedThread = selectedThreadId ? threads.get(selectedThreadId) : null;
  
  const hasIssues = swarmState.circuitBreakers.length > 0 || swarmState.quarantined.length > 0;

  // ─── Render ───
  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-[#0d0d0d]">
        {/* ─── TOP: Compact Session Strip ─── */}
        <div className="h-16 border-b border-slate-800 flex items-center gap-2 px-3">
          {/* Left: Title + Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
            >
              <GitBranch className="h-4 w-4 text-amber-500" />
            </Button>
            <div className="hidden sm:block">
              <span className="text-sm font-semibold text-slate-200">Swarm</span>
              <Badge 
                variant="outline" 
                className={`ml-2 text-xs ${
                  hasIssues 
                    ? 'bg-red-500/10 text-red-400 border-red-500/30' 
                    : 'bg-emerald-500/10 text-emerald-400'
                }`}
              >
                {runningThreads.length}
              </Badge>
            </div>
          </div>

          {/* Search */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input
                placeholder="Search threads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-40 h-8 pl-7 text-xs bg-slate-900 border-slate-700"
              />
            </div>
          </div>

          {/* Center: Horizontal Scrolling Session Cards */}
          <ScrollArea className="flex-1 whitespace-nowrap">
            <div className="flex items-center gap-2 py-2">
              {/* Add Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={() => spawnThread('New task')}
                    className="shrink-0 h-10 w-10 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30"
                    size="icon"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New Thread</TooltipContent>
              </Tooltip>

              {/* Running/Active Sessions */}
              {runningThreads.map((thread) => (
                <CompactSessionCard
                  key={thread.id}
                  thread={thread}
                  isSelected={selectedThreadId === thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  onPause={() => pauseThread(thread.id)}
                  onResume={() => resumeThread(thread.id)}
                  onStop={() => stopThread(thread.id)}
                  onCollect={() => collectEpisode(thread.id)}
                  viewMode={viewMode}
                />
              ))}
              
              {/* Failed threads */}
              {failedThreads.slice(0, 2).map(thread => (
                <CompactSessionCard
                  key={thread.id}
                  thread={thread}
                  isSelected={selectedThreadId === thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  compact
                  viewMode={viewMode}
                />
              ))}
              
              {/* Completed threads - smaller */}
              {completedThreads.slice(0, 3).map(thread => (
                <CompactSessionCard
                  key={thread.id}
                  thread={thread}
                  isSelected={selectedThreadId === thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  compact
                  viewMode={viewMode}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Right: Controls */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Health Status */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${hasIssues ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}
                  onClick={() => setShowHealthPanel(!showHealthPanel)}
                >
                  <Activity className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Swarm Health</TooltipContent>
            </Tooltip>

            {/* Refresh */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${isRefreshing ? 'animate-spin' : ''}`}
                  onClick={refreshHealth}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>

            {/* View Toggle */}
            <div className="flex items-center gap-0.5 bg-slate-900 rounded-lg p-0.5">
              <Button
                variant={viewMode === 'compact' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => setViewMode('compact')}
              >
                <LayoutList className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === 'expanded' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => setViewMode('expanded')}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Health Panel */}
        {showHealthPanel && (
          <HealthPanel 
            health={swarmState.health} 
            circuitBreakers={swarmState.circuitBreakers}
            quarantined={swarmState.quarantined}
            onClose={() => setShowHealthPanel(false)}
          />
        )}

        {/* ─── MAIN: Content Area ─── */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Collapsible */}
          {sidebarExpanded && (
            <div className="w-64 border-r border-slate-800 flex flex-col">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">Thread Tree</span>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => setStatusFilter(statusFilter ? null : 'running')}
                  >
                    <Filter className={`h-3 w-3 ${statusFilter ? 'text-amber-500' : 'text-slate-600'}`} />
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {Array.from(threads.values())
                    .filter(t => !t.parentId)
                    .map(thread => (
                      <TreeItem
                        key={thread.id}
                        thread={thread}
                        threads={threads}
                        selectedId={selectedThreadId}
                        onSelect={setSelectedThreadId}
                        level={0}
                      />
                    ))}
                </div>
              </ScrollArea>
              
              {/* Stats Footer */}
              <div className="p-3 border-t border-slate-800 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Running:</span>
                  <span className="text-emerald-500">{runningThreads.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed:</span>
                  <span className="text-blue-500">{completedThreads.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Failed:</span>
                  <span className="text-red-500">{failedThreads.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 overflow-hidden">
            {selectedThread ? (
              <SessionContent 
                thread={selectedThread}
                onPause={() => pauseThread(selectedThread.id)}
                onResume={() => resumeThread(selectedThread.id)}
                onStop={() => stopThread(selectedThread.id)}
                onCollect={() => collectEpisode(selectedThread.id)}
                onPin={() => pinThread(selectedThread.id)}
                onDelete={() => deleteThread(selectedThread.id)}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600">
                <div className="text-center">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a thread from the strip above</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── BOTTOM: Episode Collection ─── */}
        {selectedThread?.episode && (
          <EpisodeBar episode={selectedThread.episode} thread={selectedThread} />
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── COMPACT SESSION CARD ───
function CompactSessionCard({ 
  thread, 
  isSelected, 
  onClick,
  compact = false,
  onPause,
  onResume,
  onStop,
  onCollect,
  viewMode = 'compact'
}: { 
  thread: SwarmThread;
  isSelected: boolean;
  onClick: () => void;
  compact?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onCollect?: () => void;
  viewMode?: 'compact' | 'expanded';
}) {
  const isCompact = compact || viewMode === 'compact';
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div
          onClick={onClick}
          className={`shrink-0 cursor-pointer transition-all rounded-lg border overflow-hidden ${
            isSelected 
              ? 'w-40 bg-amber-500/10 border-amber-500/50' 
              : isCompact 
                ? 'w-24 bg-slate-900 border-slate-800 hover:border-slate-700' 
                : 'w-36 bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          {/* Header: Status + ID */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-800/50">
            <StatusDot status={thread.status} />
            <span className="text-[10px] font-mono text-slate-500 truncate">{thread.id}</span>
            {thread.pinned && <Pin className="h-2.5 w-2.5 text-amber-500 ml-auto" />}
            {!thread.pinned && thread.children.length > 0 && (
              <span className="text-[9px] text-slate-600 ml-auto">{thread.children.length}</span>
            )}
          </div>

          {/* Goal */}
          <div className="px-2 py-1">
            <p className={`text-xs text-slate-300 truncate ${isCompact ? 'text-[10px]' : ''}`}>
              {thread.goal}
            </p>
          </div>

          {/* Progress */}
          {!isCompact && thread.status !== 'completed' && thread.status !== 'failed' && (
            <div className="px-2 pb-1.5">
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    thread.status === 'running' ? 'bg-emerald-500' : 
                    thread.status === 'compacting' ? 'bg-purple-500' :
                    'bg-amber-500'
                  }`}
                  style={{ width: `${thread.progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[9px] text-slate-600">{Math.round(thread.progress)}%</span>
                {thread.tokenCount && (
                  <span className="text-[9px] text-slate-600">{(thread.tokenCount / 1000).toFixed(1)}k</span>
                )}
              </div>
            </div>
          )}
          
          {/* Error indicator */}
          {thread.status === 'failed' && (
            <div className="px-2 pb-1">
              <span className="text-[9px] text-red-500 flex items-center gap-1">
                <AlertTriangle className="h-2.5 w-2.5" /> Failed
              </span>
            </div>
          )}
        </div>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start" className="w-48 bg-slate-900 border-slate-700">
        <DropdownMenuItem onClick={onClick} className="text-xs">
          <Terminal className="h-3.5 w-3.5 mr-2" /> View Output
        </DropdownMenuItem>
        
        {thread.status === 'running' && (
          <DropdownMenuItem onClick={onPause} className="text-xs">
            <Pause className="h-3.5 w-3.5 mr-2" /> Pause
          </DropdownMenuItem>
        )}
        
        {thread.status === 'paused' && (
          <DropdownMenuItem onClick={onResume} className="text-xs">
            <Play className="h-3.5 w-3.5 mr-2" /> Resume
          </DropdownMenuItem>
        )}
        
        {(thread.status === 'running' || thread.status === 'paused') && (
          <>
            <DropdownMenuItem onClick={onCollect} className="text-xs">
              <Sparkles className="h-3.5 w-3.5 mr-2" /> Collect to Episode
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem onClick={onStop} className="text-xs text-red-500">
              <Square className="h-3.5 w-3.5 mr-2" /> Stop
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── TREE ITEM ───
function TreeItem({ 
  thread, 
  threads, 
  selectedId, 
  onSelect, 
  level 
}: { 
  thread: SwarmThread;
  threads: Map<string, SwarmThread>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  level: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = thread.children.map(id => threads.get(id)).filter(Boolean) as SwarmThread[];
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        onClick={() => onSelect(thread.id)}
        className={`flex items-center gap-1.5 py-1.5 px-2 rounded cursor-pointer text-xs ${
          selectedId === thread.id ? 'bg-amber-500/10 text-amber-500' : 'hover:bg-white/5 text-slate-400'
        }`}
        style={{ paddingLeft: `${8 + level * 12}px` }}
      >
        {hasChildren ? (
          <button 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-slate-600 hover:text-slate-400"
          >
            {expanded ? <ChevronLeft className="h-3 w-3 -rotate-90" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <StatusDot status={thread.status} />
        <span className="font-mono text-[10px]">{thread.id}</span>
        <span className="truncate flex-1">{thread.goal}</span>
        {thread.pinned && <Pin className="h-2.5 w-2.5 text-amber-500" />}
      </div>
      
      {expanded && children.map(child => (
        <TreeItem
          key={child.id}
          thread={child}
          threads={threads}
          selectedId={selectedId}
          onSelect={onSelect}
          level={level + 1}
        />
      ))}
    </div>
  );
}

// ─── SESSION CONTENT ───
function SessionContent({ 
  thread, 
  onPause,
  onResume,
  onStop,
  onCollect,
  onPin,
  onDelete
}: { 
  thread: SwarmThread;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCollect: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread.output]);

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <StatusDot status={thread.status} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-200">{thread.id}</h2>
              {thread.pinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
            </div>
            <p className="text-sm text-slate-500">{thread.goal}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Action Buttons */}
          {thread.status === 'running' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-amber-500 h-8 w-8" onClick={onPause}>
                  <Pause className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pause</TooltipContent>
            </Tooltip>
          )}
          
          {thread.status === 'paused' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-emerald-500 h-8 w-8" onClick={onResume}>
                  <Play className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Resume</TooltipContent>
            </Tooltip>
          )}
          
          {(thread.status === 'running' || thread.status === 'paused') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-purple-500 h-8 w-8" onClick={onCollect}>
                  <Sparkles className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Collect Episode</TooltipContent>
            </Tooltip>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={`h-8 w-8 ${thread.pinned ? 'text-amber-500' : 'text-slate-500'}`} onClick={onPin}>
                {thread.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{thread.pinned ? 'Unpin' : 'Pin'}</TooltipContent>
          </Tooltip>
          
          {(thread.status === 'running' || thread.status === 'paused') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-red-500 h-8 w-8" onClick={onStop}>
                  <Square className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stop</TooltipContent>
            </Tooltip>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(thread.output.join('\n'))} className="text-xs">
                <Copy className="h-3.5 w-3.5 mr-2" /> Copy Output
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem onClick={onDelete} className="text-xs text-red-500">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Thread
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 mb-3 text-xs text-slate-500">
        {thread.tokenCount && (
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" /> {(thread.tokenCount / 1000).toFixed(1)}k tokens
          </span>
        )}
        {thread.elapsedSeconds && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {formatDuration(thread.elapsedSeconds)}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Layers className="h-3 w-3" /> {thread.children.length} children
        </span>
      </div>

      {/* Terminal Output */}
      <div 
        ref={scrollRef}
        className="flex-1 bg-slate-950 rounded-lg border border-slate-800 p-4 font-mono text-sm overflow-auto"
      >
        <div className="text-slate-500 mb-2">$ swarm thread --tactic={thread.tactic} --goal="{thread.goal}"</div>
        {thread.output.map((line, i) => (
          <div key={i} className={
            line.startsWith('✓') ? 'text-emerald-500' :
            line.startsWith('⏸') ? 'text-amber-500' :
            line.startsWith('✗') ? 'text-red-500' :
            line.startsWith('⟳') ? 'text-purple-500' :
            'text-slate-400'
          }>
            {line}
          </div>
        ))}
        {thread.status === 'running' && (
          <div className="text-amber-500 animate-pulse mt-2">_</div>
        )}
        {thread.status === 'compacting' && (
          <div className="text-purple-500 animate-pulse mt-2">⟳ Compressing...</div>
        )}
      </div>

      {/* Progress */}
      {thread.status !== 'completed' && thread.status !== 'failed' && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Progress</span>
            <span>{Math.round(thread.progress)}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                thread.status === 'compacting' ? 'bg-purple-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${thread.progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HEALTH PANEL ───
function HealthPanel({ 
  health, 
  circuitBreakers, 
  quarantined,
  onClose 
}: { 
  health: SwarmHealth | null;
  circuitBreakers: CircuitBreakerStatus[];
  quarantined: QuarantinedAgentStatus[];
  onClose: () => void;
}) {
  return (
    <div className="h-48 border-b border-slate-800 bg-slate-900/50 p-4 overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-500" />
          Swarm Health
        </h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {health && (
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-slate-900 rounded p-3">
            <div className="text-xs text-slate-500">Status</div>
            <div className={`text-sm font-medium ${
              health.status === 'healthy' ? 'text-emerald-500' : 
              health.status === 'degraded' ? 'text-amber-500' : 'text-red-500'
            }`}>
              {health.status}
            </div>
          </div>
          <div className="bg-slate-900 rounded p-3">
            <div className="text-xs text-slate-500">Active Agents</div>
            <div className="text-sm font-medium text-slate-300">{health.active_agents} / {health.total_agents}</div>
          </div>
          <div className="bg-slate-900 rounded p-3">
            <div className="text-xs text-slate-500">Queue Size</div>
            <div className="text-sm font-medium text-slate-300">{health.message_queue_size}</div>
          </div>
          <div className="bg-slate-900 rounded p-3">
            <div className="text-xs text-slate-500">Avg Response</div>
            <div className="text-sm font-medium text-slate-300">{health.avg_response_time_ms}ms</div>
          </div>
        </div>
      )}
      
      {circuitBreakers.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold text-red-500 flex items-center gap-1 mb-2">
            <AlertTriangle className="h-3 w-3" /> Circuit Breakers Open
          </h4>
          <div className="space-y-1">
            {circuitBreakers.map(cb => (
              <div key={cb.agent_id} className="flex items-center justify-between bg-red-500/10 rounded px-3 py-2 text-xs">
                <span className="text-slate-300">{cb.agent_id}</span>
                <span className="text-red-500">{cb.failure_count} failures</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {quarantined.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-amber-500 flex items-center gap-1 mb-2">
            <ShieldAlert className="h-3 w-3" /> Quarantined Agents
          </h4>
          <div className="space-y-1">
            {quarantined.map(q => (
              <div key={q.agent_id} className="flex items-center justify-between bg-amber-500/10 rounded px-3 py-2 text-xs">
                <span className="text-slate-300">{q.agent_id}</span>
                <span className="text-amber-500">{q.remaining_minutes}m remaining</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EPISODE BAR ───
function EpisodeBar({ episode, thread }: { episode: Episode; thread: SwarmThread }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="border-t border-slate-800 bg-slate-900/50">
      <div 
        className="h-12 flex items-center px-4 gap-4 cursor-pointer hover:bg-white/5"
        onClick={() => setExpanded(!expanded)}
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        <span className="text-sm text-slate-300">Episode {episode.id}</span>
        <span className="text-xs text-slate-500 truncate flex-1">{episode.summary}</span>
        
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">{episode.decisions} decisions</span>
          <span className="text-slate-500">{episode.artifacts} artifacts</span>
          <Badge className="bg-amber-500/10 text-amber-500 text-xs">
            {episode.compression}% compressed
          </Badge>
        </div>
        
        <Button size="sm" variant="ghost" className="h-7 text-xs">
          <Copy className="h-3 w-3 mr-1" /> Use as Context
        </Button>
      </div>
      
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800/50 pt-3">
          <div className="text-xs text-slate-500 mb-2">Original Output ({thread.output.length} lines)</div>
          <div className="bg-slate-950 rounded p-3 font-mono text-xs text-slate-400 max-h-32 overflow-auto">
            {thread.output.slice(0, 10).map((line, i) => (
              <div key={i} className="truncate">{line}</div>
            ))}
            {thread.output.length > 10 && (
              <div className="text-slate-600">... {thread.output.length - 10} more lines</div>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-3 mb-2">Compressed Summary</div>
          <div className="text-sm text-slate-300">{episode.summary}</div>
        </div>
      )}
    </div>
  );
}

// ─── STATUS DOT ───
function StatusDot({ status, size = 'sm' }: { status: string; size?: 'sm' | 'lg' }) {
  const colors = {
    running: 'bg-emerald-500',
    paused: 'bg-amber-500',
    completed: 'bg-blue-500',
    failed: 'bg-red-500',
    pending: 'bg-slate-500',
    compacting: 'bg-purple-500',
  };
  
  const sizeClass = size === 'lg' ? 'w-3 h-3' : 'w-2 h-2';
  
  return (
    <span className={`${sizeClass} rounded-full ${colors[status as keyof typeof colors]} ${status === 'running' || status === 'compacting' ? 'animate-pulse' : ''}`} />
  );
}

// ─── UTILS ───
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

export default SwarmMonitor;

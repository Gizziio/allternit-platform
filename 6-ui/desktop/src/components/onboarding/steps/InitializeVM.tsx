/**
 * @fileoverview Initialize VM Step Component
 * 
 * Handles VM initialization with real-time log streaming,
 * status updates, and error handling with retry functionality.
 * 
 * @module components/onboarding/steps/InitializeVM
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Terminal, 
  RotateCcw,
  Activity,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Step } from '../components/Step';
import { Button } from '../components/Button';
import { useWizard } from '../context';
import { useVMInitializer } from '../hooks';
import type { VMStatus } from '../context';

/**
 * Props for the InitializeVMStep component
 */
export interface InitializeVMStepProps {
  /** Callback to advance to the next step */
  onNext: () => void;
  /** Callback to go back to the previous step */
  onBack: () => void;
}

/**
 * Status configuration for each VM state
 */
const STATUS_CONFIG: Record<VMStatus, { label: string; color: string; icon: React.ReactNode }> = {
  idle: {
    label: 'Waiting to start',
    color: 'text-gray-400',
    icon: <Play className="w-5 h-5" />,
  },
  checking: {
    label: 'Checking prerequisites',
    color: 'text-yellow-400',
    icon: <Loader2 className="w-5 h-5 animate-spin" />,
  },
  downloading: {
    label: 'Downloading components',
    color: 'text-blue-400',
    icon: <Loader2 className="w-5 h-5 animate-spin" />,
  },
  initializing: {
    label: 'Initializing VM',
    color: 'text-blue-400',
    icon: <Loader2 className="w-5 h-5 animate-spin" />,
  },
  running: {
    label: 'VM is running',
    color: 'text-green-400',
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
  error: {
    label: 'Initialization failed',
    color: 'text-red-400',
    icon: <AlertCircle className="w-5 h-5" />,
  },
  complete: {
    label: 'Setup complete',
    color: 'text-green-400',
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
};

/**
 * Status indicator component
 */
function StatusIndicator({ status }: { status: VMStatus }): JSX.Element {
  const config = STATUS_CONFIG[status];

  return (
    <motion.div
      className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700/50"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className={`p-2 rounded-lg bg-gray-700/50 ${config.color}`}>
        {config.icon}
      </div>
      <div className="flex-1">
        <span className={`font-medium ${config.color}`}>{config.label}</span>
        {status === 'initializing' && (
          <motion.div
            className="h-1 bg-blue-500/30 rounded-full mt-2 overflow-hidden"
          >
            <motion.div
              className="h-full bg-blue-500"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>
        )}
      </div>
      <Activity className={`w-5 h-5 ${status === 'running' ? 'text-green-400' : 'text-gray-600'}`} />
    </motion.div>
  );
}

/**
 * Terminal component for displaying VM logs
 */
function TerminalWindow({ logs }: { logs: string[] }): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [showTimestamp, setShowTimestamp] = useState(false);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isAutoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isAutoScroll]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAutoScroll(isAtBottom);
    }
  };

  const formatLogLine = (log: string, index: number): JSX.Element => {
    // Color-code different types of log messages
    let colorClass = 'text-gray-300';
    if (log.includes('[ERROR]') || log.includes('error') || log.includes('failed')) {
      colorClass = 'text-red-400';
    } else if (log.includes('[WARN]') || log.includes('warning')) {
      colorClass = 'text-yellow-400';
    } else if (log.includes('[SUCCESS]') || log.includes('complete') || log.includes('ready')) {
      colorClass = 'text-green-400';
    } else if (log.includes('[INFO]')) {
      colorClass = 'text-blue-400';
    }

    return (
      <div key={index} className="font-mono text-sm leading-relaxed">
        {showTimestamp && (
          <span className="text-gray-600 mr-2">
            {new Date().toLocaleTimeString()}
          </span>
        )}
        <span className={colorClass}>{log}</span>
      </div>
    );
  };

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700/50 bg-gray-900">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-400">VM Initialization Logs</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTimestamp(!showTimestamp)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showTimestamp ? 'Hide time' : 'Show time'}
          </button>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
          </div>
        </div>
      </div>

      {/* Terminal content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="p-4 h-48 overflow-y-auto font-mono text-sm space-y-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
      >
        <AnimatePresence initial={false}>
          {logs.length === 0 ? (
            <motion.div
              className="text-gray-600 italic"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Waiting for VM initialization to start...
            </motion.div>
          ) : (
            logs.map((log, index) => formatLogLine(log, index))
          )}
        </AnimatePresence>
        
        {/* Cursor */}
        {logs.length > 0 && (
          <motion.span
            className="inline-block w-2 h-4 bg-gray-400 ml-1"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        )}
      </div>

      {/* Scroll indicator */}
      {!isAutoScroll && logs.length > 0 && (
        <motion.button
          className="absolute bottom-4 right-4 p-2 rounded-lg bg-gray-700/80 text-gray-300 text-xs hover:bg-gray-600 transition-colors"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => {
            setIsAutoScroll(true);
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
          }}
        >
          Scroll to bottom
        </motion.button>
      )}
    </div>
  );
}

/**
 * Error display component with retry options
 */
function ErrorDisplay({ onRetry, logs }: { onRetry: () => void; logs: string[] }): JSX.Element {
  const [showFullLogs, setShowFullLogs] = useState(false);

  const downloadLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `a2r-vm-init-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      className="p-6 rounded-xl bg-red-500/10 border border-red-500/30"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-red-500/20">
          <AlertCircle className="w-6 h-6 text-red-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-red-400">VM Initialization Failed</h4>
          <p className="text-sm text-gray-400 mt-1">
            The virtual machine could not be started. This may be due to missing 
            dependencies or insufficient system resources.
          </p>
          
          <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="primary" onClick={onRetry}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button variant="outline" onClick={() => setShowFullLogs(!showFullLogs)}>
              <Terminal className="w-4 h-4 mr-2" />
              {showFullLogs ? 'Hide' : 'View'} Full Logs
            </Button>
            <Button variant="ghost" onClick={downloadLogs}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Export Logs
            </Button>
          </div>

          {showFullLogs && (
            <motion.div
              className="mt-4 p-4 rounded-lg bg-gray-900/50 overflow-auto max-h-48"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <pre className="text-xs text-gray-400 font-mono">
                {logs.join('\n') || 'No logs available'}
              </pre>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Initialize VM step component
 * 
 * Manages VM initialization with real-time log streaming and status updates.
 * Provides error handling with retry functionality and log export.
 * 
 * @param props - Component props
 * @returns {JSX.Element} Initialize VM step component
 */
export function InitializeVMStep({ onNext, onBack }: InitializeVMStepProps): JSX.Element {
  const { state } = useWizard();
  const [hasStarted, setHasStarted] = useState(false);
  const { status, logs, isInitializing, initialize, retry } = useVMInitializer({
    onComplete: onNext,
  });

  // Auto-start initialization on mount
  useEffect(() => {
    if (!hasStarted) {
      setHasStarted(true);
      initialize();
    }
  }, [hasStarted, initialize]);

  const isComplete = status === 'running' || status === 'complete';
  const hasError = status === 'error';

  return (
    <Step
      title="Initializing Virtual Machine"
      description="Starting your isolated execution environment"
      onBack={onBack}
      onNext={isComplete ? onNext : undefined}
      nextLabel={isComplete ? 'Continue' : undefined}
      isNextDisabled={!isComplete}
      showNext={isComplete}
    >
      <div className="space-y-6">
        {/* Status indicator */}
        <StatusIndicator status={status} />

        {/* Terminal with logs */}
        <TerminalWindow logs={logs} />

        {/* Error display */}
        <AnimatePresence>
          {hasError && (
            <ErrorDisplay onRetry={retry} logs={logs} />
          )}
        </AnimatePresence>

        {/* Success message */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              className="p-4 rounded-lg bg-green-500/10 border border-green-500/30"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-green-400">
                  Virtual machine is running and ready for commands
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Help text */}
        {!isComplete && !hasError && (
          <motion.p
            className="text-center text-xs text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            This may take a few moments. The VM is being configured with your downloaded images.
          </motion.p>
        )}
      </div>
    </Step>
  );
}

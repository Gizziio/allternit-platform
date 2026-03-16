/**
 * ActiveTasksBar - Real-time Task Status Bar
 * 
 * Shows active WIHs (Work In Progress) from the unified store.
 * Displays above the chat input.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle2, AlertCircle, Play, Clock } from 'lucide-react';
import { useUnifiedStore } from '@/lib/agents/unified.store';

interface ActiveTasksBarProps {
  onCloseTask?: (taskId: string) => void;
  maxTasks?: number;
}

export const ActiveTasksBar: React.FC<ActiveTasksBarProps> = ({
  onCloseTask,
  maxTasks = 5,
}) => {
  // Get real WIHs from unified store
  const { wihs, closeWih } = useUnifiedStore();

  // Filter to active WIHs only
  const activeWihs = wihs.filter(w => 
    w.status === 'in_progress' || 
    w.status === 'ready' || 
    w.status === 'open' ||
    w.status === 'blocked'
  ).slice(0, maxTasks);

  if (activeWihs.length === 0) {
    return null;
  }

  const handleClose = (wihId: string) => {
    if (onCloseTask) {
      onCloseTask(wihId);
    } else {
      closeWih(wihId, 'cancelled');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />;
      case 'ready':
      case 'open':
        return <Play className="w-3 h-3 text-blue-400" />;
      case 'blocked':
        return <Clock className="w-3 h-3 text-orange-400" />;
      case 'completed':
        return <CheckCircle2 className="w-3 h-3 text-green-400" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-400" />;
      default:
        return <Loader2 className="w-3 h-3 text-white/40" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'border-amber-500/30 bg-amber-500/10';
      case 'ready':
      case 'open':
        return 'border-blue-500/30 bg-blue-500/10';
      case 'blocked':
        return 'border-orange-500/30 bg-orange-500/10';
      default:
        return 'border-white/10 bg-white/5';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="border-b border-white/5"
      >
        <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider shrink-0">
            Running
          </span>

          {activeWihs.map((wih) => (
            <motion.div
              key={wih.wih_id}
              layout
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs
                border ${getStatusColor(wih.status)}
                hover:bg-white/10 transition-colors cursor-pointer shrink-0
              `}
            >
              {getStatusIcon(wih.status)}

              <span className="text-white/80 truncate max-w-[120px]">
                {wih.title || `Task ${wih.wih_id.slice(0, 6)}`}
              </span>

              {/* Progress indicator if available */}
              {wih.status === 'in_progress' && (
                <div className="w-8 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: '60%' }} // Placeholder - real progress would come from execution
                  />
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose(wih.wih_id);
                }}
                className="ml-1 p-0.5 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-3 h-3 text-white/40 hover:text-white/60" />
              </button>
            </motion.div>
          ))}

          {wihs.filter(w => 
            w.status === 'in_progress' || w.status === 'ready' || w.status === 'open'
          ).length > maxTasks && (
            <span className="text-xs text-white/30 shrink-0">
              +{wihs.filter(w => 
                w.status === 'in_progress' || w.status === 'ready' || w.status === 'open'
              ).length - maxTasks} more
            </span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ActiveTasksBar;

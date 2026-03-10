/**
 * A2rchitect Super-Agent OS - A2rCanvas (Program Router)
 * 
 * The main container for the Utility Pane. Acts as a "Program Router"
 * that dynamically renders different program types based on the active program.
 */

import * as React from 'react';
const { useCallback, useEffect, useRef, useState } = React;
import { useSidecarStore, useActiveProgram } from '../stores/useSidecarStore';
import type { A2rProgram, A2rProgramType } from '../types/programs';

// Program renderers
import { ResearchDocProgram } from '../programs/ResearchDocProgram';
import { DataGridProgram } from '../programs/DataGridProgram';
import { PresentationProgram } from '../programs/PresentationProgram';
import { CodePreviewProgram } from '../programs/CodePreviewProgram';
import { AssetManagerProgram } from '../programs/AssetManagerProgram';
import { OrchestratorProgram } from '../programs/OrchestratorProgram';
import { WorkflowBuilderProgram } from '../programs/WorkflowBuilderProgram';
import { ImageStudioProgram, AudioStudioProgram, TelephonyProgram, BrowserProgram } from '../programs/OtherPrograms';

// ============================================================================
// Program Registry
// ============================================================================

type ProgramComponent = React.ComponentType<{ program: A2rProgram }>;

const PROGRAM_REGISTRY: Record<A2rProgramType, ProgramComponent> = {
  'research-doc': ResearchDocProgram,
  'data-grid': DataGridProgram,
  'presentation': PresentationProgram,
  'code-preview': CodePreviewProgram,
  'asset-manager': AssetManagerProgram,
  'image-studio': ImageStudioProgram,
  'audio-studio': AudioStudioProgram,
  'telephony': TelephonyProgram,
  'orchestrator': OrchestratorProgram,
  'workflow-builder': WorkflowBuilderProgram,
  'browser': BrowserProgram,
  'custom': BrowserProgram,
};

// ============================================================================
// A2rCanvas Props
// ============================================================================

interface A2rCanvasProps {
  className?: string;
  onResize?: (width: number) => void;
  showTabs?: boolean;
  resizable?: boolean;
}

// ============================================================================
// Program Tab Component
// ============================================================================

interface ProgramTabProps {
  program: A2rProgram;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
}

const ProgramTab: React.FC<ProgramTabProps> = ({ program, isActive, onClick, onClose }) => {
  return (
    <div
      className={`
        group flex items-center gap-2 px-3 py-2 min-w-0 flex-1 max-w-[160px]
        cursor-pointer select-none transition-all duration-150
        border-r border-gray-200 dark:border-gray-700
        ${isActive 
          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-b-2 border-b-blue-500' 
          : 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
        }
      `}
      onClick={onClick}
    >
      <span className="text-sm flex-shrink-0">{program.icon}</span>
      <span className="text-xs truncate flex-1">{program.title}</span>
      <button
        className="
          opacity-0 group-hover:opacity-100 
          p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700
          transition-opacity duration-150
          text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
        "
        onClick={onClose}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

// ============================================================================
// Empty State Component
// ============================================================================

const EmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8">
      <div className="text-6xl mb-4">🎯</div>
      <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">
        Utility Pane Ready
      </h3>
      <p className="text-sm text-center max-w-xs">
        Agents can launch programs here to display rich content like research reports, 
        spreadsheets, slides, and more.
      </p>
      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        {['📄 Research Doc', '📊 Data Grid', '🎬 Presentation', '🎨 Image Studio', '🌊 Workflow Builder'].map((item) => (
          <span 
            key={item}
            className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-500 dark:text-gray-400"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Main A2rCanvas Component
// ============================================================================

export const A2rCanvas: React.FC<A2rCanvasProps> = ({
  className = '',
  onResize,
  showTabs = true,
  resizable = true,
}) => {
  const {
    programs,
    programOrder,
    activeProgramId,
    activateProgram,
    closeProgram,
    setWidth,
  } = useSidecarStore();

  const activeProgram = useActiveProgram();
  const canvasRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  const ActiveProgramComponent = activeProgram 
    ? PROGRAM_REGISTRY[activeProgram.type] 
    : null;

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const newWidth = e.clientX - rect.left;
        setWidth(newWidth);
        onResize?.(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setWidth, onResize]);

  if (!useSidecarStore.getState().isExpanded) {
    return (
      <div 
        className={`
          flex items-center justify-center
          w-8 bg-gray-50 dark:bg-gray-900 
          border-l border-gray-200 dark:border-gray-700
          cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800
          transition-colors duration-150
          ${className}
        `}
        onClick={() => useSidecarStore.getState().setExpanded(true)}
        title="Expand Utility Pane"
      >
        <svg 
          className="w-4 h-4 text-gray-400" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      className={`
        flex flex-col
        bg-white dark:bg-gray-900
        border-l border-gray-200 dark:border-gray-700
        transition-all duration-200 ease-out
        ${isResizing ? 'select-none' : ''}
        ${className}
      `}
      style={{ width: `${useSidecarStore.getState().width}px`, minWidth: `${useSidecarStore.getState().width}px` }}
    >
      {/* Header with tabs */}
      {showTabs && (
        <div className="flex flex-col border-b border-gray-200 dark:border-gray-700">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Utility Pane
            </span>
            <div className="flex items-center gap-1">
              <button
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={() => useSidecarStore.getState().setExpanded(false)}
                title="Collapse"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Program tabs */}
          {programOrder.length > 0 && (
            <div className="flex overflow-x-auto scrollbar-hide">
              {programOrder.map((programId) => {
                const program = programs[programId];
                if (!program) return null;
                
                return (
                  <ProgramTab
                    key={programId}
                    program={program}
                    isActive={programId === activeProgramId}
                    onClick={() => activateProgram(programId)}
                    onClose={(e) => {
                      e.stopPropagation();
                      closeProgram(programId);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Program content area */}
      <div className="flex-1 overflow-hidden relative">
        {activeProgram && ActiveProgramComponent ? (
          <div className="h-full overflow-auto">
            <ActiveProgramComponent program={activeProgram} />
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Resize handle */}
      {resizable && (
        <div
          ref={resizeRef}
          className={`
            absolute left-0 top-0 bottom-0 w-1 cursor-col-resize
            hover:bg-blue-500/50 transition-colors duration-150
            ${isResizing ? 'bg-blue-500' : 'bg-transparent'}
          `}
          onMouseDown={handleResizeStart}
        />
      )}
    </div>
  );
};

export default A2rCanvas;

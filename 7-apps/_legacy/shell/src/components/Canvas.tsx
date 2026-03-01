import React from 'react';
import { TabBar } from '../ui/tabbar';
import { SynthesisScaffold } from './SynthesisScaffold';
import { CapsuleView } from './CapsuleView';
import { TerminalTab } from './TerminalTab';
import { OperatorConsole } from './OperatorConsole';
import type { CapsuleInstance } from '../../../shared/contracts';

interface CanvasProps {
  capsules: CapsuleInstance[];
  activeCapsuleId: string | null;
  activeTabType: 'capsule' | 'terminal' | 'console';
  terminalTabOpen: boolean;
  consoleTabOpen: boolean;
  canvasTransition: 'idle' | 'left' | 'right';
  hoveredProposal: any;
  isSynthesizing: boolean;
  goal: string;
  onActivate: (id: string) => void;
  onActivateTerminal: () => void;
  onActivateConsole: () => void;
  onClose: (id: string) => void;
  onCloseTerminal: () => void;
  onCloseConsole: () => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  capsules,
  activeCapsuleId,
  activeTabType,
  terminalTabOpen,
  consoleTabOpen,
  canvasTransition,
  hoveredProposal,
  isSynthesizing,
  goal,
  onActivate,
  onActivateTerminal,
  onActivateConsole,
  onClose,
  onCloseTerminal,
  onCloseConsole,
}) => {
  const hasTabs = capsules.length > 0 || terminalTabOpen || consoleTabOpen;

  return (
    <div className="canvas-container">
      <TabBar
        capsules={capsules}
        activeCapsuleId={activeCapsuleId}
        activeTabType={activeTabType}
        activeTerminalId={terminalTabOpen ? 'terminal-main' : null}
        activeConsoleId={consoleTabOpen ? 'console-main' : null}
        onActivate={onActivate}
        onActivateTerminal={onActivateTerminal}
        onActivateConsole={onActivateConsole}
        onClose={onClose}
        onCloseTerminal={onCloseTerminal}
        onCloseConsole={onCloseConsole}
      />
      
      <div className="canvas-content">
        {!hasTabs ? (
          <SynthesisScaffold 
            goal={goal} 
            isSynthesizing={isSynthesizing} 
          />
        ) : (
          <div className="tab-content-area">
            {activeTabType === 'capsule' && activeCapsuleId && (
              <div className={`canvas-switch canvas-switch-${canvasTransition}`} style={{ position: 'relative', height: '100%' }}>
                <CapsuleView
                  capsuleId={activeCapsuleId}
                  title={capsules.find(c => c.capsuleId === activeCapsuleId)?.title || 'Unknown'}
                  canvasId={capsules.find(c => c.capsuleId === activeCapsuleId)?.activeCanvasId || undefined}
                  isActive={true}
                />
                {hoveredProposal && hoveredProposal.params.x !== undefined && (
                  <div 
                    className="proposal-marker"
                    style={{
                      position: 'absolute',
                      left: `${hoveredProposal.params.x}px`,
                      top: `${hoveredProposal.params.y}px`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <div className="marker-ring"></div>
                    <div className="marker-label">{hoveredProposal.description}</div>
                  </div>
                )}
              </div>
            )}
            {activeTabType === 'terminal' && (
              <div className="terminal-container">
                <TerminalTab isActive={true} />
              </div>
            )}
            {activeTabType === 'console' && (
              <div className="terminal-container">
                <OperatorConsole />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

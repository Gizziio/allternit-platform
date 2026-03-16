import { motion } from 'framer-motion';
import { ChatTeardropText, UsersThree, TerminalWindow, GitBranch, Envelope, PuzzlePiece, Shield } from '@phosphor-icons/react';
import type { AppMode } from '@/context/ModeContext';

interface ModeSwitcherProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

interface ModeOption {
  id: AppMode;
  label: string;
  icon: typeof ChatTeardropText;
}

const modes: ModeOption[] = [
  { id: 'chat', label: 'Chat', icon: ChatTeardropText },
  { id: 'cowork', label: 'Cowork', icon: UsersThree },
  { id: 'code', label: 'Code', icon: TerminalWindow },
  { id: 'workflows', label: 'Workflows', icon: GitBranch },
  { id: 'agent-mail', label: 'Mail', icon: Envelope },
  { id: 'skills', label: 'Skills', icon: PuzzlePiece },
  { id: 'admin', label: 'Admin', icon: Shield },
];

export function ModeSwitcher({ currentMode, onModeChange }: ModeSwitcherProps) {
  const activeIndex = modes.findIndex((m) => m.id === currentMode);

  return (
    <div
      className="inline-flex items-center p-1 rounded-xl"
      style={{
        background: 'rgba(30, 30, 40, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="relative flex items-center">
        {modes.map((mode) => {
          const isActive = mode.id === currentMode;
          const Icon = mode.icon;

          return (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              className={`
                relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg
                font-medium text-sm transition-colors duration-200
                ${isActive ? 'text-white' : 'text-white/60 hover:text-white/80'}
              `}
            >
              <Icon weight={isActive ? 'bold' : 'regular'} size={18} />
              <span>{mode.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full"
                  style={{ background: '#6366f1' }}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 35,
                  }}
                />
              )}
            </button>
          );
        })}

        <motion.div
          className="absolute inset-y-1 rounded-lg"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
          initial={false}
          animate={{
            x: activeIndex * 100 + '%',
            width: `${100 / modes.length}%`,
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 35,
          }}
        />
      </div>
    </div>
  );
}

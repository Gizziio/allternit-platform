import { Hexagon, Wrench } from '@phosphor-icons/react';
import { ModeSwitcher } from './ModeSwitcher';
import { WIHBadge } from './WIHBadge';
import { useMode } from '@/context/ModeContext';

interface HeaderProps {
  onToggleDrawer?: () => void;
}

export function Header({ onToggleDrawer }: HeaderProps) {
  const { currentMode, setMode } = useMode();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-16"
      style={{
        background: 'rgba(20, 20, 28, 0.8)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="h-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            }}
          >
            <Hexagon weight="fill" size={22} className="text-white" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">Allternit</span>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2">
          <ModeSwitcher currentMode={currentMode} onModeChange={setMode} />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleDrawer}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white/70 transition-all duration-200 hover:text-white hover:bg-white/10"
          >
            <Wrench weight="regular" size={18} />
            <span className="hidden sm:inline">Tools</span>
          </button>
          <WIHBadge />
        </div>
      </div>
    </header>
  );
}

export default Header;

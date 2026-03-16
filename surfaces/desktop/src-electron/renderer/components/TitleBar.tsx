import { useState, useEffect, useCallback } from 'react';
import { useWindowControls } from '../hooks/useWindowControls';

interface TitleBarProps {
  title?: string;
  showIcon?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function AppIcon({ size = 16 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-white/90"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  );
}

function MinusIcon({ size = 14 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SquareIcon({ size = 14 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="1" />
    </svg>
  );
}

function RestoreIcon({ size = 14 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M8 21h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
      <path d="M4 17V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function XIcon({ size = 14 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function TitleBar({
  title = 'A2R Shell',
  showIcon = true,
  className = '',
  children,
}: TitleBarProps): JSX.Element {
  const { minimize, maximize, close, isMaximized } = useWindowControls();
  const [isFocused, setIsFocused] = useState(true);

  useEffect(() => {
    const handleFocus = (): void => setIsFocused(true);
    const handleBlur = (): void => setIsFocused(false);

    window.electronAPI?.onWindowFocus?.(handleFocus);
    window.electronAPI?.onWindowBlur?.(handleBlur);

    return (): void => {
      window.electronAPI?.removeWindowFocusListener?.(handleFocus);
      window.electronAPI?.removeWindowBlurListener?.(handleBlur);
    };
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent): void => {
      if ((e.target as HTMLElement).closest('.no-drag')) {
        return;
      }
      maximize();
    },
    [maximize]
  );

  const opacityClass = isFocused ? 'opacity-100' : 'opacity-70';

  return (
    <div
      className={`
        h-10 flex items-center justify-between
        bg-[rgba(20,20,30,0.85)]
        backdrop-blur-[20px]
        border-b border-white/[0.08]
        transition-opacity duration-200
        draggable
        ${opacityClass}
        ${className}
      `}
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex items-center gap-3 px-4">
        {showIcon && <AppIcon size={16} />}
        <span className="text-sm font-medium text-white/90 select-none">
          {title}
        </span>
        {children && (
          <div className="flex items-center gap-2 ml-4">{children}</div>
        )}
      </div>

      <div className="flex items-center no-drag">
        <button
          onClick={minimize}
          className="
            p-3 flex items-center justify-center
            text-white/70
            hover:text-white
            hover:bg-white/10
            active:bg-white/15
            transition-colors duration-150
            focus:outline-none
          "
          aria-label="Minimize"
        >
          <MinusIcon size={14} />
        </button>

        <button
          onClick={maximize}
          className="
            p-3 flex items-center justify-center
            text-white/70
            hover:text-white
            hover:bg-white/10
            active:bg-white/15
            transition-colors duration-150
            focus:outline-none
          "
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <RestoreIcon size={14} /> : <SquareIcon size={14} />}
        </button>

        <button
          onClick={close}
          className="
            p-3 flex items-center justify-center
            text-white/70
            hover:text-white
            hover:bg-red-500/80
            active:bg-red-600/80
            transition-colors duration-150
            focus:outline-none
          "
          aria-label="Close"
        >
          <XIcon size={14} />
        </button>
      </div>

      <style>{`
        .draggable {
          -webkit-app-region: drag;
        }
        
        .no-drag {
          -webkit-app-region: no-drag;
        }
      `}</style>
    </div>
  );
}

export function MacOSTitleBar({
  title = 'A2R Shell',
  showIcon = true,
  className = '',
  children,
}: TitleBarProps): JSX.Element {
  const { minimize, maximize, close, isMaximized } = useWindowControls();
  const [isFocused, setIsFocused] = useState(true);

  useEffect(() => {
    const handleFocus = (): void => setIsFocused(true);
    const handleBlur = (): void => setIsFocused(false);

    window.electronAPI?.onWindowFocus?.(handleFocus);
    window.electronAPI?.onWindowBlur?.(handleBlur);

    return (): void => {
      window.electronAPI?.removeWindowFocusListener?.(handleFocus);
      window.electronAPI?.removeWindowBlurListener?.(handleBlur);
    };
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent): void => {
      if ((e.target as HTMLElement).closest('.no-drag')) {
        return;
      }
      maximize();
    },
    [maximize]
  );

  const buttonOpacity = isFocused ? 'opacity-100' : 'opacity-40';

  return (
    <div
      className={`
        h-10 flex items-center justify-between
        bg-[rgba(20,20,30,0.85)]
        backdrop-blur-[20px]
        border-b border-white/[0.08]
        transition-opacity duration-200
        draggable
        ${isFocused ? 'opacity-100' : 'opacity-70'}
        ${className}
      `}
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex items-center gap-3 px-4">
        <div className={`flex items-center gap-2 no-drag ${buttonOpacity}`}>
          <button
            onClick={close}
            className="
              w-3 h-3 rounded-full
              bg-[#ff5f57] hover:bg-[#ff5f57]/80
              border border-black/10
              transition-colors duration-150
              focus:outline-none
              flex items-center justify-center
              group
            "
            aria-label="Close"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] text-black/70 leading-none">
              ×
            </span>
          </button>

          <button
            onClick={minimize}
            className="
              w-3 h-3 rounded-full
              bg-[#febc2e] hover:bg-[#febc2e]/80
              border border-black/10
              transition-colors duration-150
              focus:outline-none
              flex items-center justify-center
              group
            "
            aria-label="Minimize"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] text-black/70 leading-none">
              −
            </span>
          </button>

          <button
            onClick={maximize}
            className="
              w-3 h-3 rounded-full
              bg-[#28c840] hover:bg-[#28c840]/80
              border border-black/10
              transition-colors duration-150
              focus:outline-none
              flex items-center justify-center
              group
            "
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] text-black/70 leading-none">
              {isMaximized ? '⧉' : '+'}
            </span>
          </button>
        </div>

        {showIcon && (
          <div className="ml-2">
            <AppIcon size={16} />
          </div>
        )}

        <span className="text-sm font-medium text-white/90 select-none">
          {title}
        </span>

        {children && (
          <div className="flex items-center gap-2 ml-4">{children}</div>
        )}
      </div>

      <div className="w-20" />

      <style>{`
        .draggable {
          -webkit-app-region: drag;
        }
        
        .no-drag {
          -webkit-app-region: no-drag;
        }
      `}</style>
    </div>
  );
}

export default TitleBar;

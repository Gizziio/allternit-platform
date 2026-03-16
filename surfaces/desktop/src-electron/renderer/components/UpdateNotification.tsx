/**
 * Update Notification Component
 *
 * Toast notification for available updates with progress tracking,
 * changelog display, and install controls.
 */

import { useState, useCallback } from 'react';
import { useUpdater } from '../hooks/useElectron';

interface UpdateNotificationProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

function DownloadIcon({ className = 'w-5 h-5' }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function SparklesIcon({ className = 'w-5 h-5' }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}

function AlertIcon({ className = 'w-5 h-5' }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function ChevronDownIcon({ className = 'w-4 h-4' }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronUpIcon({ className = 'w-4 h-4' }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

function CloseIcon({ className = 'w-4 h-4' }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSecond: number): string {
  return formatBytes(bytesPerSecond) + '/s';
}

export function UpdateNotification({
  position = 'bottom-right',
}: UpdateNotificationProps): JSX.Element | null {
  const {
    updateAvailable,
    updateInfo,
    updateStrategy,
    downloadProgress,
    isDownloading,
    updateDownloaded,
    downloadUpdate,
    installUpdate,
    dismissUpdate,
  } = useUpdater();

  const [showChangelog, setShowChangelog] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = useCallback(() => {
    setIsInstalling(true);
    installUpdate();
  }, [installUpdate]);

  const handleDownload = useCallback(() => {
    downloadUpdate().catch(() => {
      // Error is handled in the hook
    });
  }, [downloadUpdate]);

  const handleDismiss = useCallback(() => {
    if (updateStrategy === 'force') {
      return;
    }
    dismissUpdate();
  }, [dismissUpdate, updateStrategy]);

  if (!updateAvailable && !updateDownloaded) {
    return null;
  }

  const positionClasses = {
    'bottom-right': 'fixed bottom-4 right-4',
    'bottom-left': 'fixed bottom-4 left-4',
    'top-right': 'fixed top-4 right-4',
    'top-left': 'fixed top-4 left-4',
  };

  const isForceUpdate = updateStrategy === 'force';
  const showProgress = isDownloading && downloadProgress;
  const canDismiss = !isForceUpdate && !isInstalling;

  return (
    <div
      className={`
        ${positionClasses[position]}
        z-50
        animate-in slide-in-from-bottom-2 fade-in duration-200
      `}
    >
      <div
        className={`
          w-80 max-w-sm
          bg-[rgba(30,30,40,0.95)]
          backdrop-blur-xl
          border border-white/10
          rounded-xl
          shadow-2xl
          overflow-hidden
          ${isForceUpdate ? 'ring-2 ring-amber-500/50' : ''}
        `}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4 pb-3">
          <div
            className={`
              flex-shrink-0 w-10 h-10 rounded-lg
              flex items-center justify-center
              ${updateDownloaded ? 'bg-emerald-500/20' : ''}
              ${isDownloading ? 'bg-blue-500/20' : ''}
              ${!isDownloading && !updateDownloaded ? 'bg-amber-500/20' : ''}
            `}
          >
            {updateDownloaded ? (
              <SparklesIcon className="w-5 h-5 text-emerald-400" />
            ) : isDownloading ? (
              <DownloadIcon className="w-5 h-5 text-blue-400 animate-pulse" />
            ) : isForceUpdate ? (
              <AlertIcon className="w-5 h-5 text-amber-400" />
            ) : (
              <DownloadIcon className="w-5 h-5 text-amber-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white text-sm">
              {updateDownloaded
                ? 'Update Ready'
                : isForceUpdate
                  ? 'Critical Update Required'
                  : 'Update Available'}
            </h4>
            <p className="text-xs text-white/60 mt-0.5">
              {updateInfo
                ? `Version ${updateInfo.version} is ready to install`
                : 'A new version is available'}
            </p>
          </div>

          {canDismiss && (
            <button
              onClick={handleDismiss}
              className="
                flex-shrink-0 p-1 rounded
                text-white/40 hover:text-white/70
                hover:bg-white/10
                transition-colors
              "
              aria-label="Dismiss"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {showProgress && (
          <div className="px-4 pb-3">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="
                  h-full bg-blue-500 rounded-full
                  transition-all duration-200 ease-out
                "
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-white/50">
                {downloadProgress.percent.toFixed(0)}%
              </span>
              <span className="text-[10px] text-white/50">
                {formatSpeed(downloadProgress.bytesPerSecond)}
              </span>
            </div>
          </div>
        )}

        {/* Changelog */}
        {updateInfo?.releaseNotes && (
          <div className="border-t border-white/10">
            <button
              onClick={() => setShowChangelog(!showChangelog)}
              className="
                w-full flex items-center justify-between
                px-4 py-2
                text-xs text-white/60
                hover:text-white/80
                hover:bg-white/5
                transition-colors
              "
            >
              <span>What&apos;s new</span>
              {showChangelog ? (
                <ChevronUpIcon className="w-3.5 h-3.5" />
              ) : (
                <ChevronDownIcon className="w-3.5 h-3.5" />
              )}
            </button>

            {showChangelog && (
              <div className="px-4 pb-3 max-h-40 overflow-y-auto">
                <div
                  className="
                    text-xs text-white/70
                    prose prose-invert prose-xs max-w-none
                  "
                  style={{
                    fontSize: '11px',
                    lineHeight: '1.5',
                  }}
                >
                  {typeof updateInfo.releaseNotes === 'string' ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: updateInfo.releaseNotes
                          .replace(/\n/g, '<br />')
                          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                          .replace(/`(.+?)`/g, '<code>$1</code>'),
                      }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-mono">
                      {JSON.stringify(updateInfo.releaseNotes, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-3 border-t border-white/10">
          {!updateDownloaded && !isDownloading && (
            <>
              {canDismiss && (
                <button
                  onClick={handleDismiss}
                  className="
                    px-3 py-1.5
                    text-xs font-medium
                    text-white/60
                    hover:text-white/80
                    rounded-lg
                    transition-colors
                  "
                >
                  Later
                </button>
              )}
              <button
                onClick={handleDownload}
                className="
                  px-3 py-1.5
                  text-xs font-medium
                  bg-white/10 hover:bg-white/20
                  text-white
                  rounded-lg
                  transition-colors
                "
              >
                Download
              </button>
            </>
          )}

          {isDownloading && (
            <span className="text-xs text-white/50 px-2">Downloading...</span>
          )}

          {updateDownloaded && (
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="
                px-3 py-1.5
                text-xs font-medium
                bg-emerald-500/20 hover:bg-emerald-500/30
                text-emerald-400
                rounded-lg
                transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center gap-1.5
              "
            >
              {isInstalling ? (
                <>
                  <span className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                  Installing...
                </>
              ) : (
                'Restart to Update'
              )}
            </button>
          )}
        </div>

        {/* Force update warning */}
        {isForceUpdate && !updateDownloaded && (
          <div className="px-3 py-2 bg-amber-500/10 border-t border-amber-500/20">
            <p className="text-[10px] text-amber-400/80 text-center">
              This update is required for continued use. The app will restart automatically after download.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default UpdateNotification;

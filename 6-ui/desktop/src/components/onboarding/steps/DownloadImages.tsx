/**
 * @fileoverview Download Images Step Component
 * 
 * Handles downloading VM images (kernel, initrd, rootfs) with progress
 * tracking, speed indicators, and error handling.
 * 
 * @module components/onboarding/steps/DownloadImages
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Archive, 
  HardDrive,
  Wifi,
  RotateCcw,
  FileCode,
} from 'lucide-react';
import { Step } from '../components/Step';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { useWizard } from '../context';
import { useDownloadManager } from '../hooks';
import type { DownloadFileStatus } from '../context';

/**
 * Props for the DownloadImagesStep component
 */
export interface DownloadImagesStepProps {
  /** Callback to advance to the next step */
  onNext: () => void;
  /** Callback to go back to the previous step */
  onBack: () => void;
}

/**
 * File information for display
 */
interface FileInfo {
  /** File identifier */
  key: 'kernel' | 'initrd' | 'rootfs';
  /** Display name */
  name: string;
  /** File size for display */
  size: string;
  /** Lucide icon */
  icon: React.ReactNode;
  /** Description of the file */
  description: string;
}

const FILES: FileInfo[] = [
  {
    key: 'kernel',
    name: 'Linux Kernel',
    size: '15 MB',
    icon: <FileCode className="w-5 h-5" />,
    description: 'VM kernel image (vmlinuz)',
  },
  {
    key: 'initrd',
    name: 'Initial RAM Disk',
    size: '25 MB',
    icon: <Archive className="w-5 h-5" />,
    description: 'Boot-time initialization',
  },
  {
    key: 'rootfs',
    name: 'Ubuntu Root Filesystem',
    size: '450 MB',
    icon: <HardDrive className="w-5 h-5" />,
    description: 'Base operating system',
  },
];

/**
 * Formats bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Calculates download speed
 */
function useDownloadSpeed(downloaded: number): string {
  const [speed, setSpeed] = useState('0 MB/s');
  const lastDownloaded = React.useRef(0);
  const lastTime = React.useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeDiff = (now - lastTime.current) / 1000;
    
    if (timeDiff >= 1) {
      const bytesDiff = downloaded - lastDownloaded.current;
      const speedBytes = bytesDiff / timeDiff;
      setSpeed(`${formatBytes(speedBytes)}/s`);
      lastDownloaded.current = downloaded;
      lastTime.current = now;
    }
  }, [downloaded]);

  return speed;
}

/**
 * Individual download item component
 */
interface DownloadItemProps {
  file: FileInfo;
  status: DownloadFileStatus;
  isLast: boolean;
}

function DownloadItem({ file, status, isLast }: DownloadItemProps): JSX.Element {
  const isComplete = status.status === 'complete';
  const isError = status.status === 'error';
  const isDownloading = status.status === 'downloading';
  const totalDownloaded = useMemo(() => 
    Object.values(status).reduce((sum, s) => sum + (s.downloaded || 0), 0),
    [status]
  );
  const speed = useDownloadSpeed(totalDownloaded);

  return (
    <motion.div
      className={`relative ${!isLast ? 'pb-6' : ''}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-700">
          <motion.div
            className="w-full bg-blue-500"
            initial={{ height: '0%' }}
            animate={{ height: isComplete ? '100%' : '0%' }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Status icon */}
        <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          isComplete ? 'bg-green-500/20' :
          isError ? 'bg-red-500/20' :
          isDownloading ? 'bg-blue-500/20' :
          'bg-gray-700/50'
        }`}>
          {isComplete && <CheckCircle2 className="w-5 h-5 text-green-400" />}
          {isError && <AlertCircle className="w-5 h-5 text-red-400" />}
          {isDownloading && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Download className="w-5 h-5 text-blue-400" />
            </motion.div>
          )}
          {!isComplete && !isError && !isDownloading && file.icon}
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className={`font-medium truncate ${isComplete ? 'text-green-400' : 'text-white'}`}>
              {file.name}
            </h4>
            <span className="text-sm text-gray-500 flex-shrink-0 ml-2">{file.size}</span>
          </div>
          <p className="text-xs text-gray-500 mb-2">{file.description}</p>

          {/* Progress bar for downloading files */}
          {isDownloading && (
            <div className="space-y-1">
              <ProgressBar 
                value={status.progress} 
                max={100}
                size="sm"
                color="blue"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">
                  {formatBytes(status.downloaded || 0)} / {formatBytes(status.total || 0)}
                </span>
                <span className="text-blue-400">{Math.round(status.progress)}%</span>
              </div>
            </div>
          )}

          {isComplete && (
            <motion.span
              className="text-xs text-green-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Download complete
            </motion.span>
          )}

          {isError && (
            <span className="text-xs text-red-400">{status.error || 'Download failed'}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Speed indicator component
 */
function SpeedIndicator({ speed }: { speed: string }): JSX.Element {
  return (
    <motion.div
      className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-gray-800/30"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Wifi className="w-4 h-4 text-blue-400" />
      <span className="text-sm text-gray-400">Download speed:</span>
      <span className="text-sm font-medium text-white">{speed}</span>
    </motion.div>
  );
}

/**
 * Download images step component
 * 
 * Manages downloading VM images with real-time progress tracking,
 * speed indicators, and error handling with retry functionality.
 * 
 * @param props - Component props
 * @returns {JSX.Element} Download images step component
 */
export function DownloadImagesStep({ onNext, onBack }: DownloadImagesStepProps): JSX.Element {
  const { state } = useWizard();
  const [hasStarted, setHasStarted] = useState(false);
  const { 
    isDownloading, 
    totalProgress, 
    startDownload, 
    cancelDownload, 
    retry 
  } = useDownloadManager({
    onComplete: onNext,
  });

  // Auto-start download on mount
  useEffect(() => {
    if (!hasStarted) {
      setHasStarted(true);
      startDownload();
    }

    return () => {
      cancelDownload();
    };
  }, [hasStarted, startDownload, cancelDownload]);

  const allComplete = Object.values(state.downloads).every(d => d.status === 'complete');
  const hasErrors = Object.values(state.downloads).some(d => d.status === 'error');
  const totalDownloaded = Object.values(state.downloads).reduce(
    (sum, d) => sum + (d.downloaded || 0), 
    0
  );

  // Calculate estimated time remaining
  const estimatedTime = useMemo(() => {
    if (totalProgress === 0 || allComplete) return '';
    const remainingPercent = 100 - totalProgress;
    // Rough estimate: if we're at X%, assume linear progress
    const estimatedSeconds = (remainingPercent / totalProgress) * (Date.now() / 1000);
    if (estimatedSeconds < 60) {
      return `~${Math.ceil(estimatedSeconds)}s remaining`;
    }
    return `~${Math.ceil(estimatedSeconds / 60)}min remaining`;
  }, [totalProgress, allComplete]);

  return (
    <Step
      title="Downloading VM Images"
      description="Downloading required files for your virtual machine"
      onBack={onBack}
      onNext={allComplete ? onNext : undefined}
      nextLabel={allComplete ? 'Continue' : 'Downloading...'}
      isNextDisabled={!allComplete}
      showNext={allComplete}
    >
      <div className="space-y-6">
        {/* Overall progress */}
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Overall Progress</span>
            <span className="text-white font-medium">{Math.round(totalProgress)}%</span>
          </div>
          <ProgressBar value={totalProgress} max={100} size="lg" />
          {!allComplete && estimatedTime && (
            <p className="text-xs text-gray-500 text-center">{estimatedTime}</p>
          )}
        </motion.div>

        {/* Download items */}
        <div className="space-y-2">
          {FILES.map((file, index) => (
            <DownloadItem
              key={file.key}
              file={file}
              status={state.downloads[file.key]}
              isLast={index === FILES.length - 1}
            />
          ))}
        </div>

        {/* Speed indicator (only while downloading) */}
        <AnimatePresence>
          {isDownloading && !allComplete && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <SpeedIndicator speed={formatBytes(totalDownloaded)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error display */}
        <AnimatePresence>
          {hasErrors && !allComplete && (
            <motion.div
              className="p-4 rounded-lg bg-red-500/10 border border-red-500/30"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-red-400">Download Failed</h4>
                  <p className="text-sm text-gray-400 mt-1">
                    Some files failed to download. Check your connection and try again.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={retry}
                    className="mt-3"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retry Download
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Storage info */}
        <motion.div
          className="flex items-center justify-center gap-2 text-xs text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <HardDrive className="w-3 h-3" />
          <span>Total download size: ~490 MB</span>
        </motion.div>
      </div>
    </Step>
  );
}

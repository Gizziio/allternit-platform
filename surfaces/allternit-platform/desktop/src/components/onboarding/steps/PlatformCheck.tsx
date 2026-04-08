/**
 * @fileoverview Platform Check Step Component
 * 
 * Detects the user's operating system, CPU architecture, and hardware
 * capabilities. Presents platform-specific setup options.
 * 
 * @module components/onboarding/steps/PlatformCheck
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  CheckCircle2, 
  Apple, 
  Monitor, 
  Cpu, 
  AlertCircle,
  Download,
  Hammer,
  ChevronRight
} from 'lucide-react';
import { Step } from '../components/Step';
import { Button } from '../components/Button';
import { useWizard } from '../context';
import { usePlatformDetection } from '../hooks';
import type { PlatformType, SetupMode } from '../context';

/**
 * Props for the PlatformCheckStep component
 */
export interface PlatformCheckStepProps {
  /** Callback to advance to the next step */
  onNext: () => void;
  /** Callback to go back to the previous step */
  onBack: () => void;
}

/**
 * Check item status
 */
type CheckStatus = 'pending' | 'checking' | 'complete' | 'error';

/**
 * Individual check item data
 */
interface CheckItem {
  /** Unique identifier */
  id: string;
  /** Display text */
  text: string;
  /** Current status */
  status: CheckStatus;
}

/**
 * Platform display information
 */
const PLATFORM_INFO: Record<PlatformType, { name: string; icon: React.ReactNode; color: string }> = {
  macos: {
    name: 'macOS',
    icon: <Apple className="w-6 h-6" />,
    color: 'text-blue-400',
  },
  linux: {
    name: 'Linux',
    icon: <Monitor className="w-6 h-6" />,
    color: 'text-yellow-400',
  },
  windows: {
    name: 'Windows',
    icon: <Monitor className="w-6 h-6" />,
    color: 'text-cyan-400',
  },
};

/**
 * Check item component for showing detection progress
 */
function CheckItemComponent({ item }: { item: CheckItem }): JSX.Element {
  return (
    <motion.div
      className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className="flex-shrink-0">
        {item.status === 'checking' && (
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        )}
        {item.status === 'complete' && (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        )}
        {item.status === 'error' && (
          <AlertCircle className="w-5 h-5 text-red-400" />
        )}
        {item.status === 'pending' && (
          <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
        )}
      </div>
      <span className={`text-sm ${
        item.status === 'complete' ? 'text-gray-300' : 
        item.status === 'checking' ? 'text-white' : 'text-gray-500'
      }`}>
        {item.text}
      </span>
    </motion.div>
  );
}

/**
 * Platform card component showing detected platform
 */
function PlatformCard({ platform }: { platform: { type: PlatformType; arch: string; version: string } }): JSX.Element {
  const info = PLATFORM_INFO[platform.type];

  return (
    <motion.div
      className="p-6 rounded-xl bg-gray-800/50 border border-gray-700/50"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl bg-gray-700/50 ${info.color}`}>
          {info.icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">{info.name}</h3>
          <p className="text-sm text-gray-400">
            {platform.arch === 'arm64' ? 'Apple Silicon' : 'Intel/AMD'} • {platform.version}
          </p>
        </div>
        <CheckCircle2 className="w-6 h-6 text-green-400" />
      </div>
    </motion.div>
  );
}

/**
 * Setup mode option component
 */
interface SetupModeOptionProps {
  /** Option title */
  title: string;
  /** Option description */
  description: string;
  /** Lucide icon */
  icon: React.ReactNode;
  /** Whether this option is selected */
  selected: boolean;
  /** Click handler */
  onClick: () => void;
  /** Time estimate */
  timeEstimate: string;
}

function SetupModeOption({ title, description, icon, selected, onClick, timeEstimate }: SetupModeOptionProps): JSX.Element {
  return (
    <motion.button
      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
        selected 
          ? 'border-blue-500 bg-blue-500/10' 
          : 'border-gray-700 bg-gray-800/30 hover:border-gray-600 hover:bg-gray-800/50'
      }`}
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-start gap-4">
        <div className={`p-2 rounded-lg ${selected ? 'bg-blue-500/20' : 'bg-gray-700/50'}`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className={`font-semibold ${selected ? 'text-blue-400' : 'text-white'}`}>
              {title}
            </h4>
            <span className="text-xs text-gray-500">{timeEstimate}</span>
          </div>
          <p className="text-sm text-gray-400 mt-1">{description}</p>
        </div>
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            <CheckCircle2 className="w-5 h-5 text-blue-400" />
          </motion.div>
        )}
      </div>
    </motion.button>
  );
}

/**
 * Platform check step component
 * 
 * Detects the user's platform and presents appropriate setup options.
 * For Linux users, allows choosing between downloading pre-built images
 * or building from source.
 * 
 * @param props - Component props
 * @returns {JSX.Element} Platform check step component
 */
export function PlatformCheckStep({ onNext, onBack }: PlatformCheckStepProps): JSX.Element {
  const { state, setState } = useWizard();
  const { isChecking, platform, error } = usePlatformDetection({ autoStart: true });
  const [selectedMode, setSelectedMode] = useState<SetupMode>(null);
  const [checkItems, setCheckItems] = useState<CheckItem[]>([
    { id: 'os', text: 'Detecting operating system...', status: 'checking' },
    { id: 'arch', text: 'Checking CPU architecture...', status: 'pending' },
    { id: 'hw', text: 'Verifying hardware support...', status: 'pending' },
  ]);

  // Update check items as detection progresses
  useEffect(() => {
    if (isChecking) {
      const timer1 = setTimeout(() => {
        setCheckItems(prev => prev.map(item => 
          item.id === 'os' ? { ...item, status: 'complete' } :
          item.id === 'arch' ? { ...item, status: 'checking' } :
          item
        ));
      }, 800);

      const timer2 = setTimeout(() => {
        setCheckItems(prev => prev.map(item => 
          item.id === 'arch' ? { ...item, status: 'complete' } :
          item.id === 'hw' ? { ...item, status: 'checking' } :
          item
        ));
      }, 1600);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else if (platform) {
      setCheckItems(prev => prev.map(item => ({ ...item, status: 'complete' })));
      // Auto-select download mode for macOS
      if (platform.type === 'macos') {
        setSelectedMode('download');
        setState(prev => ({ ...prev, setupMode: 'download' }));
      }
    }
  }, [isChecking, platform, setState]);

  const handleModeSelect = (mode: SetupMode) => {
    setSelectedMode(mode);
    setState(prev => ({ ...prev, setupMode: mode }));
  };

  const canProceed = !isChecking && platform && (platform.type !== 'linux' || selectedMode);

  return (
    <Step
      title="Checking Your System"
      description="We'll check your platform to ensure compatibility"
      onBack={onBack}
      onNext={canProceed ? onNext : undefined}
      nextLabel={selectedMode === 'build' ? 'Build Images' : 'Continue'}
      isNextDisabled={!canProceed}
    >
      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {isChecking ? (
            <motion.div
              key="checking"
              className="space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {checkItems.map(item => (
                <CheckItemComponent key={item.id} item={item} />
              ))}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              className="p-6 rounded-xl bg-red-500/10 border border-red-500/30 text-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Detection Failed</h3>
              <p className="text-sm text-gray-400 mb-4">{error.message}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </motion.div>
          ) : platform ? (
            <motion.div
              key="results"
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <PlatformCard platform={platform} />

              {/* Platform-specific info boxes */}
              {platform.type === 'macos' && (
                <motion.div
                  className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-start gap-3">
                    <Apple className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-400">macOS Detected</h4>
                      <p className="text-sm text-gray-400 mt-1">
                        You'll download pre-built VM images optimized for {platform.arch === 'arm64' ? 'Apple Silicon' : 'Intel'}.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {platform.type === 'linux' && (
                <motion.div
                  className="space-y-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h4 className="text-sm font-medium text-gray-300">Choose Setup Method</h4>
                  <SetupModeOption
                    title="Download (Recommended)"
                    description="Faster setup with pre-built images. Best for most users."
                    icon={<Download className="w-5 h-5 text-green-400" />}
                    selected={selectedMode === 'download'}
                    onClick={() => handleModeSelect('download')}
                    timeEstimate="5-10 min"
                  />
                  <SetupModeOption
                    title="Build from Source"
                    description="Full transparency and customization. Requires dependencies."
                    icon={<Hammer className="w-5 h-5 text-orange-400" />}
                    selected={selectedMode === 'build'}
                    onClick={() => handleModeSelect('build')}
                    timeEstimate="15-30 min"
                  />
                </motion.div>
              )}

              {platform.type === 'windows' && (
                <motion.div
                  className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-400">Windows Detected</h4>
                      <p className="text-sm text-gray-400 mt-1">
                        Windows requires WSL2 to run A2R. Make sure WSL2 is installed and configured.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </Step>
  );
}

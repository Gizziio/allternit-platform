/**
 * A2R Desktop Onboarding Wizard
 * 
 * Guides users through initial setup:
 * 1. Welcome screen
 * 2. Internet connectivity check
 * 3. Download VM images
 * 4. VM initialization
 * 5. Ready screen
 * 
 * Platform Notes:
 * - macOS: Download mode only (build mode requires Linux)
 * - Linux: Download or build mode
 */

import React, { useState, useEffect, useCallback } from 'react';

// Wizard steps
type WizardStep = 
  | 'welcome'
  | 'connectivity'
  | 'download'
  | 'initialize'
  | 'ready'
  | 'error';

// Connectivity status
interface ConnectivityStatus {
  internet: boolean;
  github: boolean;
  a2rServices: boolean;
  checking: boolean;
}

// Download progress
interface DownloadProgress {
  stage: 'downloading' | 'verifying' | 'extracting' | 'complete';
  fileName: string;
  bytesDownloaded: number;
  totalBytes: number;
  speed: number;
  eta: number;
}

// VM initialization progress
interface VmInitProgress {
  stage: 'verifying' | 'booting' | 'connecting' | 'ready';
  message: string;
  progress: number;
}

interface WizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

// Detect platform
const isMacOS = () => navigator.platform.toLowerCase().includes('mac');
const isLinux = () => navigator.platform.toLowerCase().includes('linux');

export const OnboardingWizard: React.FC<WizardProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [connectivity, setConnectivity] = useState<ConnectivityStatus>({
    internet: false,
    github: false,
    a2rServices: false,
    checking: false,
  });
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [vmInitProgress, setVmInitProgress] = useState<VmInitProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check connectivity
  const checkConnectivity = useCallback(async () => {
    setConnectivity(prev => ({ ...prev, checking: true }));
    setError(null);

    try {
      // @ts-ignore - Electron API
      const result = await window.a2rVmSetup.checkConnectivity();
      setConnectivity({
        internet: result.internet,
        github: result.github,
        a2rServices: result.a2rServices,
        checking: false,
      });

      if (result.internet) {
        setCurrentStep('download');
      }
    } catch (err) {
      setConnectivity(prev => ({ ...prev, checking: false }));
      setError(err instanceof Error ? err.message : 'Connectivity check failed');
    }
  }, []);

  // Start download
  const startDownload = useCallback(async () => {
    setError(null);
    
    try {
      // @ts-ignore - Electron API
      await window.a2rVmSetup.downloadVmImages((progress: DownloadProgress) => {
        setDownloadProgress(progress);
      });

      setCurrentStep('initialize');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }, []);

  // Start VM initialization
  const startVmInit = useCallback(async () => {
    setError(null);
    
    try {
      // @ts-ignore - Electron API
      await window.a2rVmSetup.initializeVm((progress: VmInitProgress) => {
        setVmInitProgress(progress);
      });

      setCurrentStep('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'VM initialization failed');
    }
  }, []);

  // Handle local mode
  const handleLocalMode = useCallback(() => {
    onSkip();
  }, [onSkip]);

  // Render steps
  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <WelcomeStep 
            onGetStarted={() => setCurrentStep('connectivity')}
            onSkip={handleLocalMode}
          />
        );

      case 'connectivity':
        return (
          <ConnectivityStep
            status={connectivity}
            onCheck={checkConnectivity}
            onContinue={() => setCurrentStep('download')}
            onLocalMode={handleLocalMode}
            hasError={!!error}
          />
        );

      case 'download':
        return (
          <DownloadStep
            progress={downloadProgress}
            onStart={startDownload}
            hasError={!!error}
          />
        );

      case 'initialize':
        return (
          <InitializeStep
            progress={vmInitProgress}
            onStart={startVmInit}
          />
        );

      case 'ready':
        return (
          <ReadyStep
            onComplete={onComplete}
          />
        );

      case 'error':
        return (
          <ErrorStep
            message={error || 'Unknown error'}
            onRetry={() => setCurrentStep('welcome')}
            onLocalMode={handleLocalMode}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {['Welcome', 'Connect', 'Download', 'Ready'].map((step, index) => {
              const stepOrder = ['welcome', 'connectivity', 'download', 'ready'];
              const currentIndex = stepOrder.indexOf(currentStep);
              const isActive = index <= currentIndex;
              
              return (
                <div key={step} className="flex items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${isActive ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}
                  `}>
                    {index + 1}
                  </div>
                  <span className={`ml-2 text-sm ${isActive ? 'text-white' : 'text-slate-400'}`}>
                    {step}
                  </span>
                  {index < 3 && (
                    <div className={`w-16 h-0.5 mx-4 ${index < currentIndex ? 'bg-blue-500' : 'bg-slate-700'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main content card */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl">
          {renderStep()}
        </div>

        {/* Error display */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// === Step Components ===

const WelcomeStep: React.FC<{ onGetStarted: () => void; onSkip: () => void }> = ({ 
  onGetStarted, 
  onSkip 
}) => (
  <div className="p-8 text-center">
    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
      <span className="text-4xl">🚀</span>
    </div>
    
    <h1 className="text-3xl font-bold text-white mb-4">
      Welcome to A2R
    </h1>
    
    <p className="text-slate-400 text-lg mb-8 max-w-md mx-auto">
      Your AI-powered development environment with sandboxed execution.
      Let's get you set up in just a few steps.
    </p>

    <div className="space-y-4">
      <button
        onClick={onGetStarted}
        className="w-full max-w-sm mx-auto px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-all"
      >
        Get Started
      </button>
      
      <button
        onClick={onSkip}
        className="text-slate-500 hover:text-slate-400 text-sm transition-colors"
      >
        Skip for now (use local mode)
      </button>
    </div>

    <div className="mt-8 pt-8 border-t border-slate-700">
      <p className="text-slate-500 text-sm">
        By continuing, you agree to download VM images (~500MB) for sandboxed execution.
      </p>
    </div>
  </div>
);

const ConnectivityStep: React.FC<{
  status: ConnectivityStatus;
  onCheck: () => void;
  onContinue: () => void;
  onLocalMode: () => void;
  hasError: boolean;
}> = ({ status, onCheck, onContinue, onLocalMode, hasError }) => {
  useEffect(() => {
    if (!status.checking && !status.internet && !hasError) {
      onCheck();
    }
  }, []);

  const allConnected = status.internet && status.github && status.a2rServices;

  return (
    <div className="p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl">
          📡
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Check Connectivity</h2>
        <p className="text-slate-400">We need an internet connection to download VM images.</p>
      </div>

      <div className="space-y-3 mb-8">
        <CheckItem label="Internet connection" status={status.internet} checking={status.checking} />
        <CheckItem label="GitHub access" status={status.github} checking={status.checking} />
        <CheckItem label="A2R services" status={status.a2rServices} checking={status.checking} />
      </div>

      {status.internet ? (
        <button
          onClick={onContinue}
          disabled={!allConnected}
          className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 text-white font-medium rounded-lg transition-all"
        >
          Continue
        </button>
      ) : (
        <div className="space-y-3">
          {!status.checking && (
            <>
              <button
                onClick={onCheck}
                className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-all"
              >
                Check Again
              </button>
              
              <button
                onClick={onLocalMode}
                className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-all text-sm"
              >
                Use Local Mode
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const CheckItem: React.FC<{ label: string; status: boolean; checking: boolean }> = ({ 
  label, 
  status, 
  checking 
}) => (
  <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
    {checking ? (
      <span className="text-blue-400">⏳</span>
    ) : status ? (
      <span className="text-green-400">✓</span>
    ) : (
      <span className="text-red-400">✗</span>
    )}
    <span className={`${status ? 'text-green-400' : 'text-slate-400'}`}>{label}</span>
  </div>
);

const DownloadStep: React.FC<{
  progress: DownloadProgress | null;
  onStart: () => void;
  hasError: boolean;
}> = ({ progress, onStart, hasError }) => {
  useEffect(() => {
    if (!progress && !hasError) {
      onStart();
    }
  }, []);

  const percent = progress ? (progress.bytesDownloaded / progress.totalBytes) * 100 : 0;
  const downloadedMB = progress ? (progress.bytesDownloaded / 1024 / 1024).toFixed(1) : '0';
  const totalMB = progress ? (progress.totalBytes / 1024 / 1024).toFixed(0) : '500';

  const platform = isMacOS() ? 'macOS' : isLinux() ? 'Linux' : 'your platform';

  return (
    <div className="p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-purple-500/20 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl">
          ⬇️
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Download VM Images</h2>
        <p className="text-slate-400">
          Ubuntu 22.04 LTS with Node.js, Python, Rust, and Docker pre-installed.
        </p>
      </div>

      <div className="mb-8">
        <div className="flex justify-between text-sm text-slate-400 mb-2">
          <span>{progress?.fileName || 'Starting download...'}</span>
          <span>{percent.toFixed(0)}%</span>
        </div>
        
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-slate-500 mt-2">
          <span>{downloadedMB} MB / {totalMB} MB</span>
          <span>{progress?.speed ? `${(progress.speed / 1024 / 1024).toFixed(1)} MB/s` : ''}</span>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
        <h3 className="text-white font-medium mb-3">What's included?</h3>
        <ul className="text-sm text-slate-400 space-y-1">
          <li>• Linux kernel 6.5.0 optimized for VMs</li>
          <li>• Ubuntu 22.04 LTS base system</li>
          <li>• Node.js 20.x, Python 3.10, Rust</li>
          <li>• Docker for containerized builds</li>
          <li>• a2r-vm-executor for command execution</li>
        </ul>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-sm text-blue-300">
          <strong>💡 Platform Note:</strong> On {platform}, images are downloaded from GitHub Releases.
          {isLinux() && (
            <span> Linux users can also <a href="#" className="underline">build images locally</a> for full transparency.</span>
          )}
        </p>
      </div>
    </div>
  );
};

const InitializeStep: React.FC<{
  progress: VmInitProgress | null;
  onStart: () => void;
}> = ({ progress, onStart }) => {
  useEffect(() => {
    if (!progress) {
      onStart();
    }
  }, []);

  const stages = ['verifying', 'booting', 'connecting', 'ready'];
  const currentStageIndex = progress ? stages.indexOf(progress.stage) : 0;

  return (
    <div className="p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-500/20 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl">
          🖥️
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Starting VM</h2>
        <p className="text-slate-400">
          {progress?.message || 'Initializing virtual machine...'}
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {stages.map((stage, index) => (
          <div key={stage} className="flex items-center gap-3">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm
              ${index < currentStageIndex ? 'bg-green-500 text-white' : ''}
              ${index === currentStageIndex ? 'bg-blue-500 text-white' : ''}
              ${index > currentStageIndex ? 'bg-slate-700 text-slate-500' : ''}
            `}>
              {index < currentStageIndex ? '✓' : index + 1}
            </div>
            <span className={`${index <= currentStageIndex ? 'text-white' : 'text-slate-500'} capitalize`}>
              {stage === 'verifying' && 'Verifying images'}
              {stage === 'booting' && 'Booting VM'}
              {stage === 'connecting' && 'Connecting to executor'}
              {stage === 'ready' && 'Ready'}
            </span>
          </div>
        ))}
      </div>

      {progress && (
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
            style={{ width: `${progress.progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

const ReadyStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => (
  <div className="p-8 text-center">
    <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl">
      🎉
    </div>
    
    <h2 className="text-3xl font-bold text-white mb-4">
      A2R is Ready!
    </h2>
    
    <p className="text-slate-400 text-lg mb-8 max-w-md mx-auto">
      Your sandboxed development environment is set up and ready to use.
    </p>

    <div className="bg-slate-900/50 rounded-lg p-6 mb-8 text-left">
      <h3 className="text-white font-medium mb-4">You can now:</h3>
      <ul className="space-y-3 text-slate-400">
        <li className="flex items-center gap-3">
          <span>💻</span>
          Run commands in isolated VMs from the terminal
        </li>
        <li className="flex items-center gap-3">
          <span>🚀</span>
          Use the A2R CLI: <code className="bg-slate-800 px-2 py-1 rounded">a2r run &quot;npm test&quot;</code>
        </li>
        <li className="flex items-center gap-3">
          <span>⚙️</span>
          Configure settings in Preferences
        </li>
      </ul>
    </div>

    <button
      onClick={onComplete}
      className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-all"
    >
      Open A2R
    </button>
  </div>
);

const ErrorStep: React.FC<{ 
  message: string; 
  onRetry: () => void;
  onLocalMode: () => void;
}> = ({ message, onRetry, onLocalMode }) => (
  <div className="p-8 text-center">
    <div className="w-24 h-24 bg-red-500/20 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl">
      ⚠️
    </div>
    
    <h2 className="text-2xl font-bold text-white mb-4">
      Setup Failed
    </h2>
    
    <p className="text-red-400 mb-8 max-w-md mx-auto">
      {message}
    </p>

    <div className="space-y-3">
      <button
        onClick={onRetry}
        className="w-full max-w-sm mx-auto px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-all"
      >
        Try Again
      </button>
      
      <button
        onClick={onLocalMode}
        className="w-full max-w-sm mx-auto px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-all"
      >
        Use Local Mode
      </button>
    </div>
  </div>
);

export default OnboardingWizard;

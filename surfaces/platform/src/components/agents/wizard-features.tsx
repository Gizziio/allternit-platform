/**
 * Agent Creation Wizard - Enhanced Features Integration
 *
 * This file provides enhanced components and utilities that integrate:
 * - Internationalization (i18n)
 * - Analytics/Telemetry
 * - Keyboard Shortcuts
 * - Export/Import Configuration
 * - API Verification with Fallbacks
 *
 * Import and use these components to enhance the main wizard.
 *
 * @module agents/wizard-features
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef, type ChangeEvent, type DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  DownloadSimple,
  UploadSimple,
  FileCode,
  Copy,
  Check,
  X,
  Keyboard,
  Question as HelpCircle,
  Warning,
  CheckCircle,
  WifiHigh,
  WifiSlash,
  ArrowsClockwise,
  ShareNetwork,
  Lightning,
  Clock,
  ChartBar,
} from '@phosphor-icons/react';

import { TEXT, MODE_COLORS } from '@/design/a2r.tokens';
import { useTranslation, getAvailableLanguages, getLanguageInfo, type LanguageCode } from '@/lib/i18n';
import { useWizardShortcuts, formatShortcutForDisplay, WIZARD_SHORTCUTS } from '@/hooks/use-wizard-shortcuts';
import {
  prepareForExport,
  downloadConfigFile,
  copyToClipboard,
  importFromFile,
  generateShareCode,
  validateImportedConfig,
  type ExportedAgentConfig,
} from '@/lib/agents/config-import-export';
import { apiWithFallback, useApiWithFallback, type ApiVerificationResult } from '@/lib/agents/api-verification';
import { wizardAnalytics, useWizardAnalytics, type WizardEventType } from '@/lib/analytics/wizard-analytics';

import type {
  CharacterLayerConfig,
  AvatarConfig,
  AgentType,
  ModelProvider,
} from '@/lib/agents/agent.types';

// ============================================================================
// Types
// ============================================================================

export interface WizardFeaturesProps {
  /** Current wizard step index */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Current step ID */
  stepId: string;
  /** Agent basic info */
  basicInfo: {
    name: string;
    description: string;
    type: AgentType;
    model: string;
    provider: ModelProvider;
  };
  /** Character configuration */
  character: CharacterLayerConfig;
  /** Avatar configuration */
  avatar: AvatarConfig;
  /** Enabled tools */
  tools: string[];
  /** System prompt */
  systemPrompt: string;
  /** Temperature */
  temperature: number;
  /** Max iterations */
  maxIterations: number;
  /** Capabilities */
  capabilities: string[];
  /** Plugins */
  plugins?: Array<{ id: string; name: string; version?: string }>;
  /** Save draft handler */
  onSaveDraft: () => void;
  /** Go to next step handler */
  onNextStep: () => void;
  /** Go to previous step handler */
  onPreviousStep: () => void;
  /** Close modal handler */
  onCloseModal: () => void;
  /** Toggle help panel handler */
  onToggleHelp: () => void;
  /** Mode colors */
  modeColors: typeof MODE_COLORS.chat;
}

export interface LanguageSelectorProps {
  currentLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  modeColors: typeof MODE_COLORS.chat;
}

export interface ExportImportPanelProps {
  basicInfo: WizardFeaturesProps['basicInfo'];
  character: CharacterLayerConfig;
  avatar: AvatarConfig;
  tools: {
    enabled: string[];
    systemPrompt: string;
    temperature: number;
    maxIterations: number;
  };
  capabilities: string[];
  plugins?: Array<{ id: string; name: string; version?: string }>;
  onImport: (config: ExportedAgentConfig) => void;
  modeColors: typeof MODE_COLORS.chat;
}

export interface KeyboardShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  modeColors: typeof MODE_COLORS.chat;
}

export interface ApiHealthIndicatorProps {
  modeColors: typeof MODE_COLORS.chat;
  onClick?: () => void;
}

export interface AnalyticsConsentBannerProps {
  onAccept: () => void;
  onDecline: () => void;
  modeColors: typeof MODE_COLORS.chat;
}

// ============================================================================
// Language Selector Component
// ============================================================================

export function LanguageSelector({ currentLanguage, onLanguageChange, modeColors }: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const availableLanguages = getAvailableLanguages();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLangInfo = getLanguageInfo(currentLanguage);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{
          background: 'rgba(255,255,255,0.05)',
          color: TEXT.secondary,
          border: `1px solid ${modeColors.border}`,
        }}
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        <Globe size={16} />
        <span>{currentLangInfo.flag}</span>
        <span className="hidden sm:inline">{currentLangInfo.nativeName}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 w-48 rounded-xl border shadow-xl z-50 overflow-hidden"
            style={{
              background: '#1A1612',
              borderColor: modeColors.border,
            }}
          >
            {availableLanguages.map((lang) => {
              const langInfo = getLanguageInfo(lang);
              const isSelected = lang === currentLanguage;

              return (
                <button
                  key={lang}
                  onClick={() => {
                    onLanguageChange(lang);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors focus:outline-none focus:bg-white/5"
                  style={{
                    background: isSelected ? modeColors.soft : 'transparent',
                    color: isSelected ? modeColors.accent : TEXT.secondary,
                  }}
                >
                  <span className="text-lg">{langInfo.flag}</span>
                  <span>{langInfo.nativeName}</span>
                  {isSelected && <Check size={14} className="ml-auto" />}
                </button>
              );
            })}

            {availableLanguages.length === 1 && (
              <div className="px-4 py-3 text-xs" style={{ color: TEXT.tertiary }}>
                More languages coming soon
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Export/Import Panel Component
// ============================================================================

export function ExportImportPanel({
  basicInfo,
  character,
  avatar,
  tools,
  capabilities,
  plugins,
  onImport,
  modeColors,
}: ExportImportPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback((format: 'json' | 'yaml') => {
    const config = prepareForExport(
      basicInfo,
      character,
      avatar,
      tools,
      capabilities,
      plugins
    );
    downloadConfigFile(config, format, basicInfo.name);
    wizardAnalytics.track('config_exported', { format, agentName: basicInfo.name });
  }, [basicInfo, character, avatar, tools, capabilities, plugins]);

  const handleCopyToClipboard = useCallback(async () => {
    const config = prepareForExport(
      basicInfo,
      character,
      avatar,
      tools,
      capabilities,
      plugins
    );
    await copyToClipboard(config, 'json');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
    wizardAnalytics.track('config_exported', { method: 'clipboard' });
  }, [basicInfo, character, avatar, tools, capabilities, plugins]);

  const handleShare = useCallback(() => {
    const config = prepareForExport(
      basicInfo,
      character,
      avatar,
      tools,
      capabilities,
      plugins
    );
    const shareCode = generateShareCode(config);
    navigator.clipboard.writeText(shareCode);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
    wizardAnalytics.track('config_exported', { method: 'share' });
  }, [basicInfo, character, avatar, tools, capabilities, plugins]);

  const handleImportFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const { config, warnings } = await importFromFile(file);

      // Validate
      const validation = validateImportedConfig(config);
      if (!validation.valid) {
        setImportError(`Invalid configuration: ${validation.errors.join(', ')}`);
        wizardAnalytics.trackError('import', new Error(validation.errors.join(', ')));
        return;
      }

      // Warn about any issues
      if (warnings.length > 0) {
        console.warn('Import warnings:', warnings);
      }

      onImport(config);
      setIsOpen(false);
      setImportError(null);
      wizardAnalytics.track('config_imported', { fileName: file.name });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import configuration';
      setImportError(message);
      wizardAnalytics.trackError('import', error);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onImport]);

  const handleDrop = useCallback(async (event: DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    try {
      const { config, warnings } = await importFromFile(file);
      const validation = validateImportedConfig(config);
      if (!validation.valid) {
        setImportError(`Invalid configuration: ${validation.errors.join(', ')}`);
        return;
      }
      onImport(config);
      setIsOpen(false);
      wizardAnalytics.track('config_imported', { fileName: file.name, method: 'drag-drop' });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to import');
    }
  }, [onImport]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{
          background: 'rgba(255,255,255,0.05)',
          color: TEXT.secondary,
          border: `1px solid ${modeColors.border}`,
        }}
        aria-label="Export or import configuration"
      >
        <DownloadSimple size={16} />
        <span className="hidden sm:inline">Import/Export</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div
                className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
                style={{
                  background: '#1A1612',
                  borderColor: modeColors.border,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div
                  className="px-6 py-4 border-b flex items-center justify-between"
                  style={{ borderColor: modeColors.border }}
                >
                  <h2 className="text-lg font-semibold" style={{ color: TEXT.primary }}>
                    Import / Export Configuration
                  </h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <X size={20} style={{ color: TEXT.tertiary }} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Export Section */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: TEXT.primary }}>
                      <DownloadSimple size={16} />
                      Export Configuration
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleExport('json')}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: `1px solid rgba(59, 130, 246, 0.3)`,
                          color: '#60A5FA',
                        }}
                      >
                        <FileCode size={18} />
                        Export JSON
                      </button>
                      <button
                        onClick={() => handleExport('yaml')}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{
                          background: 'rgba(139, 92, 246, 0.1)',
                          border: `1px solid rgba(139, 92, 246, 0.3)`,
                          color: '#A78BFA',
                        }}
                      >
                        <FileCode size={18} />
                        Export YAML
                      </button>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleCopyToClipboard}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: `1px solid ${modeColors.border}`,
                          color: TEXT.secondary,
                        }}
                      >
                        {showSuccess ? <Check size={16} /> : <Copy size={16} />}
                        {showSuccess ? 'Copied!' : 'Copy to Clipboard'}
                      </button>
                      <button
                        onClick={handleShare}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: `1px solid ${modeColors.border}`,
                          color: TEXT.secondary,
                        }}
                      >
                        <ShareNetwork size={16} />
                        Share
                      </button>
                    </div>
                  </div>

                  {/* Import Section */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: TEXT.primary }}>
                      <UploadSimple size={16} />
                      Import Configuration
                    </h3>
                    <div
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRef.current?.click()}
                      className="p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:bg-white/5"
                      style={{
                        borderColor: modeColors.border,
                      }}
                    >
                      <div className="text-center">
                        <UploadSimple size={32} className="mx-auto mb-3" style={{ color: TEXT.tertiary }} />
                        <p className="text-sm font-medium" style={{ color: TEXT.secondary }}>
                          Drag and drop a file here
                        </p>
                        <p className="text-xs mt-1" style={{ color: TEXT.tertiary }}>
                          or click to browse (JSON or YAML)
                        </p>
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.yaml,.yml"
                      onChange={handleImportFile}
                      className="hidden"
                    />

                    {importError && (
                      <div
                        className="mt-3 p-3 rounded-lg flex items-start gap-2"
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: `1px solid rgba(239, 68, 68, 0.3)`,
                        }}
                      >
                        <Warning size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
                        <p className="text-sm" style={{ color: '#EF4444' }}>
                          {importError}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================================
// Keyboard Shortcuts Panel Component
// ============================================================================

export function KeyboardShortcutsPanel({ isOpen, onClose, modeColors }: KeyboardShortcutsPanelProps) {
  const shortcuts = useWizardShortcuts();
  const availableShortcuts = shortcuts.getAvailableShortcuts();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40"
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
          style={{
            background: '#1A1612',
            borderColor: modeColors.border,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-6 py-4 border-b flex items-center justify-between"
            style={{ borderColor: modeColors.border }}
          >
            <div className="flex items-center gap-3">
              <Keyboard size={20} style={{ color: modeColors.accent }} />
              <h2 className="text-lg font-semibold" style={{ color: TEXT.primary }}>
                Keyboard Shortcuts
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X size={20} style={{ color: TEXT.tertiary }} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            <div className="space-y-3">
              {availableShortcuts.map((shortcut) => (
                <div
                  key={shortcut.name}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <span className="text-sm font-medium" style={{ color: TEXT.secondary }}>
                    {shortcut.description}
                  </span>
                  <kbd
                    className="px-2 py-1 rounded text-xs font-mono"
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      color: TEXT.primary,
                    }}
                  >
                    {formatShortcutForDisplay(shortcut.keys)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div
            className="px-6 py-4 border-t flex items-center justify-between"
            style={{ borderColor: modeColors.border }}
          >
            <p className="text-xs" style={{ color: TEXT.tertiary }}>
              Shortcuts work globally when the wizard is open
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: modeColors.accent,
                color: '#1A1612',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ============================================================================
// API Health Indicator Component
// ============================================================================

export function ApiHealthIndicator({ modeColors, onClick }: ApiHealthIndicatorProps) {
  const [status, setStatus] = useState<ApiVerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiWithFallback.getHealthStatus().then((result) => {
      setStatus(result);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <ArrowsClockwise size={14} className="animate-spin" style={{ color: TEXT.tertiary }} />
        <span className="text-xs" style={{ color: TEXT.tertiary }}>Checking API...</span>
      </div>
    );
  }

  const isHealthy = status?.healthy;
  const isFallback = status?.fallbackMode;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      style={{
        background: isHealthy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
        border: `1px solid ${isHealthy ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
        color: isHealthy ? '#10B981' : '#F59E0B',
      }}
      aria-label={isHealthy ? 'API is healthy' : 'API has issues'}
    >
      {isHealthy ? <WifiHigh size={14} /> : <WifiSlash size={14} />}
      <span className="hidden sm:inline">
        {isHealthy ? 'API Connected' : isFallback ? 'Fallback Mode' : 'API Issues'}
      </span>
    </button>
  );
}

// ============================================================================
// Analytics Consent Banner Component
// ============================================================================

export function AnalyticsConsentBanner({ onAccept, onDecline, modeColors }: AnalyticsConsentBannerProps) {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('a2r_analytics_consent');
  });

  if (!isVisible) return null;

  const handleAccept = () => {
    localStorage.setItem('a2r_analytics_consent', 'accepted');
    wizardAnalytics.setEnabled(true);
    setIsVisible(false);
    onAccept();
  };

  const handleDecline = () => {
    localStorage.setItem('a2r_analytics_consent', 'declined');
    wizardAnalytics.setEnabled(false);
    setIsVisible(false);
    onDecline();
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 p-4"
    >
      <div
        className="max-w-2xl mx-auto p-4 rounded-xl border shadow-xl"
        style={{
          background: '#1A1612',
          borderColor: modeColors.border,
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(59, 130, 246, 0.1)' }}
          >
            <ChartBar size={20} style={{ color: '#3B82F6' }} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold mb-1" style={{ color: TEXT.primary }}>
              Analytics Consent
            </h3>
            <p className="text-sm mb-3" style={{ color: TEXT.secondary }}>
              We use analytics to improve the wizard experience. Your usage data helps us understand how to make the tool better.
              No personal information is collected.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleAccept}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: '#3B82F6',
                  color: 'white',
                }}
              >
                Accept
              </button>
              <button
                onClick={handleDecline}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: TEXT.secondary,
                }}
              >
                Decline
              </button>
            </div>
          </div>
          <button
            onClick={handleDecline}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={16} style={{ color: TEXT.tertiary }} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Wizard Features Hook
// ============================================================================

export function useWizardFeatures(props: WizardFeaturesProps) {
  const { t, language, setLanguage } = useTranslation();
  const analytics = useWizardAnalytics();
  const api = useApiWithFallback();
  const shortcuts = useWizardShortcuts({
    onSaveDraft: props.onSaveDraft,
    onNextStep: props.onNextStep,
    onPreviousStep: props.onPreviousStep,
    onCloseModal: props.onCloseModal,
    onToggleHelp: props.onToggleHelp,
  });

  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false);
  const [showApiHealth, setShowApiHealth] = useState(false);

  // Track step view when step changes
  useEffect(() => {
    analytics.trackStepView(props.stepId, props.currentStep, props.totalSteps);
  }, [props.stepId, props.currentStep, props.totalSteps]);

  // Initialize analytics on mount
  useEffect(() => {
    const consent = typeof window !== 'undefined' ? localStorage.getItem('a2r_analytics_consent') : null;
    if (consent === 'accepted') {
      wizardAnalytics.initialize({ enabled: true });
    } else if (consent === 'declined') {
      wizardAnalytics.initialize({ enabled: false });
    } else {
      // Show consent banner
      wizardAnalytics.initialize({ enabled: false, debug: true });
    }
  }, []);

  return {
    // i18n
    t,
    language,
    setLanguage,

    // Analytics
    analytics,

    // API
    api,

    // Shortcuts
    shortcuts,
    showShortcutsPanel,
    setShowShortcutsPanel,

    // API Health
    showApiHealth,
    setShowApiHealth,
  };
}

// ============================================================================
// Enhanced Wizard Header Component
// ============================================================================

export function WizardHeader({
  currentStep,
  totalSteps,
  stepId,
  modeColors,
  onSaveDraft,
  onNextStep,
  onPreviousStep,
  onCloseModal,
  onToggleHelp,
}: Pick<WizardFeaturesProps, 'currentStep' | 'totalSteps' | 'stepId' | 'modeColors' | 'onSaveDraft' | 'onNextStep' | 'onPreviousStep' | 'onCloseModal' | 'onToggleHelp'>) {
  const features = useWizardFeatures({
    currentStep,
    totalSteps,
    stepId,
    basicInfo: { name: '', description: '', type: 'worker', model: '', provider: 'openai' },
    character: {} as CharacterLayerConfig,
    avatar: {} as AvatarConfig,
    tools: [],
    systemPrompt: '',
    temperature: 0.7,
    maxIterations: 10,
    capabilities: [],
    onSaveDraft,
    onNextStep,
    onPreviousStep,
    onCloseModal,
    onToggleHelp,
    modeColors,
  });

  return (
    <div className="flex items-center justify-between mb-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium" style={{ color: TEXT.tertiary }}>
          Step {currentStep + 1} of {totalSteps}
        </span>
        <div className="w-32 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: modeColors.accent }}
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => features.setShowShortcutsPanel(true)}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          style={{ color: TEXT.tertiary }}
          aria-label="Show keyboard shortcuts"
        >
          <Keyboard size={18} />
        </button>

        <ApiHealthIndicator modeColors={modeColors} />

        <LanguageSelector
          currentLanguage={features.language}
          onLanguageChange={features.setLanguage}
          modeColors={modeColors}
        />

        <ExportImportPanel
          basicInfo={{ name: '', description: '', type: 'worker', model: '', provider: 'openai' }}
          character={{
            identity: { setup: 'generalist', className: '', specialtySkills: [], temperament: 'balanced', personalityTraits: [], backstory: '' },
            roleCard: { domain: '', inputs: [], outputs: [], definitionOfDone: [], hardBans: [], escalation: [], metrics: [] },
            voice: { style: '', rules: [], microBans: [], tone: { formality: 0.5, enthusiasm: 0.5, empathy: 0.5, directness: 0.5 } },
            progression: { class: '', relevantStats: [], level: { maxLevel: 10, xpFormula: 'linear' } },
            avatar: { type: 'color', style: { primaryColor: '#D4956A', accentColor: '#E0A070' } }
          }}
          avatar={{ type: 'color', fallbackColor: '#D4956A', colors: { primary: '#D4956A', secondary: '#1a1a1a', glow: 'rgba(212,149,106,0.3)' } }}
          tools={{ enabled: [], systemPrompt: '', temperature: 0.7, maxIterations: 10 }}
          capabilities={[]}
          onImport={() => {}}
          modeColors={modeColors}
        />
      </div>

      {/* Keyboard shortcuts panel */}
      <KeyboardShortcutsPanel
        isOpen={features.showShortcutsPanel}
        onClose={() => features.setShowShortcutsPanel(false)}
        modeColors={modeColors}
      />
    </div>
  );
}

export default useWizardFeatures;

/**
 * Runtime Settings Panel
 * 
 * Provides UI for configuring DAG N3-N16 runtime environment settings:
 * - Driver selection (N3, N4)
 * - Resource limits (N11)
 * - Replay configuration (N12)
 * - Prewarm pools (N16)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Cpu, 
  Gauge, 
  History, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  X,
  Save,
  RotateCcw,
  Boxes,
  GitBranch,
  Box,
} from 'lucide-react';
import * as runtimeService from '../services/runtimeService';
import { EnvironmentSelector } from './EnvironmentSelector';

interface RuntimeSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RuntimeSettingsPanel({ isOpen, onClose }: RuntimeSettingsPanelProps) {
  const [settings, setSettings] = useState<runtimeService.RuntimeSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<runtimeService.RuntimeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load settings on open
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await runtimeService.getRuntimeSettings();
      setSettings(data);
      setOriginalSettings(JSON.parse(JSON.stringify(data)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const updated = await runtimeService.updateRuntimeSettings(settings);
      setSettings(updated);
      setOriginalSettings(JSON.parse(JSON.stringify(updated)));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all settings to defaults?')) return;
    setLoading(true);
    try {
      const data = await runtimeService.resetRuntimeSettings();
      setSettings(data);
      setOriginalSettings(JSON.parse(JSON.stringify(data)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
    } finally {
      setLoading(false);
    }
  };

  const updateDriver = (updates: Partial<runtimeService.DriverConfig>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      driver: { ...settings.driver, ...updates },
    });
  };

  const updateResources = (updates: Partial<runtimeService.ResourceLimits>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      resources: { ...settings.resources, ...updates },
    });
  };

  const updateReplay = (updates: Partial<runtimeService.ReplayConfig>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      replay: { ...settings.replay, ...updates },
    });
  };

  const updatePrewarm = (updates: Partial<runtimeService.PrewarmConfig>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      prewarm: { ...settings.prewarm, ...updates },
    });
  };

  const updateVersioning = (updates: Partial<runtimeService.VersioningConfig>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      versioning: { ...settings.versioning, ...updates },
    });
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              {<Boxes className="w-5 h-5 text-blue-600 dark:text-blue-400" /> as any}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Runtime Environment
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configure execution drivers and resource limits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {<X className="w-5 h-5 text-gray-500" /> as any}
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-2">
                {<AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" /> as any}
                <div>
                  <p className="font-medium text-red-900 dark:text-red-300">Error</p>
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              </div>
            </div>
          )}

          {!loading && settings && (
            <>
              {/* Driver Selection (N3, N4) */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  {<Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" /> as any}
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Execution Driver
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    N3/N4
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'process', label: 'Process', desc: 'OS processes', level: 'limited' },
                    { id: 'container', label: 'Container', desc: 'gVisor', level: 'standard' },
                    { id: 'microvm', label: 'MicroVM', desc: 'Firecracker', level: 'maximum' },
                  ].map((driver) => (
                    <button
                      key={driver.id}
                      onClick={() => {
                        updateDriver({
                          driver_type: driver.id as any,
                          isolation_level: driver.level as any,
                        });
                      }}
                      disabled={driver.id !== 'process'}
                      className={`
                        p-3 rounded-lg border text-left transition-all
                        ${settings.driver.driver_type === driver.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                        }
                        ${driver.id !== 'process' ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {driver.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {driver.desc}
                      </p>
                      <span className={`
                        inline-block mt-2 text-xs px-2 py-0.5 rounded
                        ${driver.level === 'limited' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' : ''}
                        ${driver.level === 'standard' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''}
                        ${driver.level === 'maximum' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : ''}
                      `}>
                        {driver.level}
                      </span>
                    </button>
                  ))}
                </div>

                {settings.driver.driver_type === 'process' && (
                  <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-start gap-2">
                      {<AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" /> as any}
                      <div className="text-sm">
                        <p className="font-medium text-yellow-900 dark:text-yellow-300">
                          Process Driver Warning
                        </p>
                        <p className="text-yellow-700 dark:text-yellow-400">
                          Process driver provides LIMITED isolation and should only be used in development.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Environment Configuration (N5) */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  {<Box className="w-4 h-4 text-blue-600 dark:text-blue-400" /> as any}
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Environment
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    N5
                  </span>
                </div>

                <EnvironmentSelector disabled={loading || saving} />
              </section>

              {/* Resource Limits (N11) */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  {<Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" /> as any}
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Resource Limits
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    N11
                  </span>
                </div>

                <div className="space-y-4">
                  {/* CPU */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm text-gray-700 dark:text-gray-300">
                        CPU (millicores)
                      </label>
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {settings.resources.cpu_millicores}m
                      </span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="8000"
                      step="100"
                      value={settings.resources.cpu_millicores}
                      onChange={(e) => updateResources({ cpu_millicores: parseInt(e.target.value) })}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>100m</span>
                      <span>8000m</span>
                    </div>
                  </div>

                  {/* Memory */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm text-gray-700 dark:text-gray-300">
                        Memory (MiB)
                      </label>
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {settings.resources.memory_mib} MiB
                      </span>
                    </div>
                    <input
                      type="range"
                      min="64"
                      max="32768"
                      step="64"
                      value={settings.resources.memory_mib}
                      onChange={(e) => updateResources({ memory_mib: parseInt(e.target.value) })}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>64 MiB</span>
                      <span>32 GiB</span>
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateResources({ cpu_millicores: 100, memory_mib: 64 })}
                      className="px-3 py-1.5 text-xs rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      Minimal
                    </button>
                    <button
                      onClick={() => updateResources({ cpu_millicores: 1000, memory_mib: 2048 })}
                      className="px-3 py-1.5 text-xs rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      Standard
                    </button>
                    <button
                      onClick={() => updateResources({ cpu_millicores: 4000, memory_mib: 8192 })}
                      className="px-3 py-1.5 text-xs rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      High Perf
                    </button>
                  </div>
                </div>
              </section>

              {/* Replay & Determinism (N12) */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  {<History className="w-4 h-4 text-blue-600 dark:text-blue-400" /> as any}
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Replay & Determinism
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    N12
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Capture Level
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Record non-deterministic outputs for replay
                    </p>
                  </div>
                  <select
                    value={settings.replay.capture_level}
                    onChange={(e) => updateReplay({ capture_level: e.target.value as any })}
                    className="px-3 py-1.5 text-sm rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="none">None</option>
                    <option value="minimal">Minimal</option>
                    <option value="full">Full</option>
                  </select>
                </div>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={settings.replay.deterministic_mode}
                    onChange={(e) => updateReplay({ deterministic_mode: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Deterministic Mode
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Ensure reproducible execution across runs
                    </p>
                  </div>
                </label>

                {settings.replay.capture_level !== 'none' && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      {<CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" /> as any}
                      <div className="text-sm">
                        <p className="font-medium text-blue-900 dark:text-blue-300">
                          Replay Enabled
                        </p>
                        <p className="text-blue-700 dark:text-blue-400">
                          Executions will be captured for deterministic replay.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Prewarm Pools (N16) */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  {<RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" /> as any}
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Prewarm Pools
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    N16
                  </span>
                </div>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={settings.prewarm.enabled}
                    onChange={(e) => updatePrewarm({ enabled: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Enable Prewarm
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Keep execution environments warm for faster startup
                    </p>
                  </div>
                </label>

                {settings.prewarm.enabled && (
                  <div className="pl-7 space-y-3">
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm text-gray-700 dark:text-gray-300">
                          Pool Size
                        </label>
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {settings.prewarm.pool_size} instances
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={settings.prewarm.pool_size}
                        onChange={(e) => updatePrewarm({ pool_size: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* Versioning (N14) */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  {<GitBranch className="w-4 h-4 text-blue-600 dark:text-blue-400" /> as any}
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Versioning
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    N14
                  </span>
                </div>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={settings.versioning.auto_commit}
                    onChange={(e) => updateVersioning({ auto_commit: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Auto-Commit
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Automatically commit changes after each session
                    </p>
                  </div>
                </label>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleReset}
            disabled={loading || saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {<RotateCcw className="w-4 h-4" /> as any}
            Reset to Defaults
          </button>

          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="text-sm text-green-600 dark:text-green-400">
                Saved successfully!
              </span>
            )}
            {hasChanges && !saveSuccess && (
              <span className="text-sm text-amber-600 dark:text-amber-400">
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={loading || saving || !hasChanges}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Saving...
                </>
              ) : (
                <>
                  {<Save className="w-4 h-4" /> as any}
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

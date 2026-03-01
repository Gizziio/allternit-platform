/**
 * Avatar Settings Panel
 * 
 * Configure avatar appearance and behavior.
 */

import React, { useState, useCallback } from 'react';
import styles from './AvatarSettings.module.css';
import { 
  getAdapterRegistry, 
  loadAdapterSettings, 
  saveAdapterSettings,
  getCurrentAdapter,
} from '@a2r/avatar-adapters';
import type { AdapterSettings, AvatarAdapter } from '@a2r/avatar-adapters/types';
import { Mood, VisualState } from '@a2r/visual-state/types';

export interface AvatarSettingsProps {
  /** On settings change */
  onChange?: (settings: AdapterSettings) => void;
}

const demoState: VisualState = {
  mood: Mood.Thinking,
  intensity: 7,
  confidence: 0.8,
  reliability: 0.9,
  timestamp: new Date(),
  source: 'demo',
};

export const AvatarSettings: React.FC<AvatarSettingsProps> = ({ onChange }) => {
  const registry = getAdapterRegistry();
  const adapters = registry.getAll();
  
  const [settings, setSettings] = useState<AdapterSettings>(loadAdapterSettings());
  const [previewMood, setPreviewMood] = useState<Mood>(Mood.Thinking);

  const currentAdapter = getCurrentAdapter(settings);

  const updateSetting = useCallback(<K extends keyof AdapterSettings>(
    key: K,
    value: AdapterSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveAdapterSettings(newSettings);
    onChange?.(newSettings);
  }, [settings, onChange]);

  const previewState: VisualState = {
    ...demoState,
    mood: previewMood,
  };

  return (
    <div className={styles.settings}>
      <h2>Avatar Settings</h2>

      {/* Adapter Selection */}
      <section className={styles.section}>
        <h3>Avatar Style</h3>
        <div className={styles.adapterGrid}>
          {adapters.map((adapter) => (
            <button
              key={adapter.name}
              className={`${styles.adapterCard} ${
                settings.adapter === adapter.name ? styles.selected : ''
              }`}
              onClick={() => updateSetting('adapter', adapter.name)}
            >
              <div className={styles.adapterPreview}>
                {/* Render preview */}
                <AdapterPreview adapter={adapter} state={previewState} />
              </div>
              <div className={styles.adapterInfo}>
                <strong>{adapter.displayName}</strong>
                <p>{adapter.description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Mood Preview */}
      <section className={styles.section}>
        <h3>Preview Mood</h3>
        <div className={styles.moodSelector}>
          {Object.values(Mood).map((mood) => (
            <button
              key={mood}
              className={`${styles.moodBtn} ${previewMood === mood ? styles.active : ''}`}
              onClick={() => setPreviewMood(mood)}
            >
              {mood}
            </button>
          ))}
        </div>
      </section>

      {/* Display Options */}
      <section className={styles.section}>
        <h3>Display Options</h3>
        
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={settings.animate}
            onChange={(e) => updateSetting('animate', e.target.checked)}
          />
          <span>Enable animations</span>
        </label>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={settings.showConfidence}
            onChange={(e) => updateSetting('showConfidence', e.target.checked)}
          />
          <span>Show confidence indicator</span>
        </label>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={settings.showReliability}
            onChange={(e) => updateSetting('showReliability', e.target.checked)}
          />
          <span>Show reliability indicator</span>
        </label>
      </section>

      {/* Animation Speed */}
      <section className={styles.section}>
        <h3>Animation Speed</h3>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={settings.animationSpeed}
          onChange={(e) => updateSetting('animationSpeed', parseFloat(e.target.value))}
          className={styles.slider}
        />
        <div className={styles.sliderLabels}>
          <span>Slow</span>
          <span>{settings.animationSpeed}x</span>
          <span>Fast</span>
        </div>
      </section>

      {/* Current Preview */}
      <section className={styles.section}>
        <h3>Live Preview</h3>
        <div className={styles.livePreview}>
          <div className={styles.previewAvatar}>
            {currentAdapter.render(previewState, 'xl')}
          </div>
          <div className={styles.previewInfo}>
            <p><strong>Mood:</strong> {previewState.mood}</p>
            <p><strong>Intensity:</strong> {previewState.intensity}/10</p>
            <p><strong>Confidence:</strong> {Math.round(previewState.confidence * 100)}%</p>
            <p><strong>Reliability:</strong> {Math.round(previewState.reliability * 100)}%</p>
          </div>
        </div>
      </section>
    </div>
  );
};

// Helper component for adapter preview
const AdapterPreview: React.FC<{ adapter: AvatarAdapter; state: VisualState }> = ({
  adapter,
  state,
}) => {
  return (
    <div style={{ width: 48, height: 48 }}>
      {adapter.render(state, 'md')}
    </div>
  );
};

export default AvatarSettings;

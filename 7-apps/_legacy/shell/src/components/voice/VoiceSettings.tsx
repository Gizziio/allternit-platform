/**
 * Voice Settings Component - Manage TTS voices, cloning, and preferences
 */

import React, { useState, useEffect, useCallback } from 'react';
import { voiceService } from '../../runtime/VoiceService';
import { speechToText } from '../../runtime/SpeechToText';
import './VoiceSettings.css';

interface VoiceSettingsProps {
  onClose: () => void;
  currentVoice?: string;
  onVoiceChange?: (voice: string) => void;
}

interface VoicePreset {
  id: string;
  name: string;
  type: 'browser' | 'chatterbox' | 'cloned';
  voice?: string;
  referenceAudioUrl?: string;
  language?: string;
}

const DEFAULT_VOICES: VoicePreset[] = [
  { id: 'default', name: 'Default Voice', type: 'chatterbox', voice: 'default' },
  { id: 'clone', name: 'My Voice (Clone)', type: 'cloned' },
];

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  onClose,
  currentVoice = 'default',
  onVoiceChange,
}) => {
  const [presets, setPresets] = useState<VoicePreset[]>([]);
  const [selectedVoice, setSelectedVoice] = useState(currentVoice);
  const [sttLanguage, setSttLanguage] = useState('en-US');
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState('');
  const [showCloning, setShowCloning] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Load voice presets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('voice_presets');
    if (saved) {
      try {
        setPresets([...DEFAULT_VOICES, ...JSON.parse(saved)]);
      } catch {
        setPresets(DEFAULT_VOICES);
      }
    } else {
      setPresets(DEFAULT_VOICES);
    }

    // Load STT language preference
    const savedLang = localStorage.getItem('stt_language');
    if (savedLang) {
      setSttLanguage(savedLang);
    }

    // Get available STT languages
    setAvailableLanguages(speechToText.getAvailableLanguages());
  }, []);

  // Save voice presets
  const savePresets = useCallback((newPresets: VoicePreset[]) => {
    const custom = newPresets.filter(p => !DEFAULT_VOICES.find(d => d.id === p.id));
    localStorage.setItem('voice_presets', JSON.stringify(custom));
    setPresets(newPresets);
  }, []);

  // Handle voice selection
  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoice(voiceId);
    const preset = presets.find(p => p.id === voiceId);
    if (preset?.voice && onVoiceChange) {
      onVoiceChange(preset.voice);
    }
  };

  // Handle STT language change
  const handleLanguageChange = (lang: string) => {
    setSttLanguage(lang);
    localStorage.setItem('stt_language', lang);
    speechToText.setLanguage(lang);
  };

  // Handle voice cloning upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setShowCloning(true);
    setIsCloning(true);
    setCloneProgress('Uploading reference audio...');

    try {
      const result = await voiceService.uploadReferenceAudio(file);
      
      if (result.success && result.audioUrl) {
        setCloneProgress('Voice cloned successfully!');
        
        // Create new preset
        const newPreset: VoicePreset = {
          id: `cloned_${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          type: 'cloned',
          referenceAudioUrl: result.audioUrl,
        };
        
        const newPresets = [...presets, newPreset];
        savePresets(newPresets);
        
        setTimeout(() => {
          setShowCloning(false);
          setIsCloning(false);
          setUploadedFile(null);
        }, 2000);
      } else {
        setCloneProgress(`Error: ${result.error || 'Upload failed'}`);
        setIsCloning(false);
      }
    } catch (err) {
      setCloneProgress(`Error: ${err}`);
      setIsCloning(false);
    }
  };

  // Delete custom preset
  const handleDeletePreset = (presetId: string) => {
    const newPresets = presets.filter(p => p.id !== presetId && DEFAULT_VOICES.find(d => d.id === presetId));
    savePresets(newPresets);
    if (selectedVoice === presetId) {
      setSelectedVoice('default');
    }
  };

  // Test voice
  const handleTestVoice = async (preset: VoicePreset) => {
    const testText = "Hello! This is a test of the selected voice.";
    
    if (preset.type === 'cloned' && preset.referenceAudioUrl) {
      await voiceService.speakWithVoice(testText, preset.referenceAudioUrl);
    } else {
      await voiceService.speak(testText, { voice: preset.voice || 'default' });
    }
  };

  return (
    <div className="voice-settings-overlay" onClick={onClose}>
      <div className="voice-settings" onClick={e => e.stopPropagation()}>
        <div className="voice-settings__header">
          <h2>Voice Settings</h2>
          <button className="voice-settings__close" onClick={onClose}>×</button>
        </div>

        {/* Voice Selection */}
        <div className="voice-settings__section">
          <h3>Voice</h3>
          <div className="voice-settings__presets">
            {presets.map(preset => (
              <div 
                key={preset.id}
                className={`voice-preset ${selectedVoice === preset.id ? 'selected' : ''}`}
                onClick={() => handleVoiceSelect(preset.id)}
              >
                <div className="voice-preset__info">
                  <span className="voice-preset__name">{preset.name}</span>
                  <span className="voice-preset__type">
                    {preset.type === 'browser' && '🌐 Browser'}
                    {preset.type === 'chatterbox' && '🎙️ Chatterbox'}
                    {preset.type === 'cloned' && '🎭 Cloned Voice'}
                  </span>
                </div>
                <div className="voice-preset__actions">
                  <button 
                    className="voice-preset__test"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTestVoice(preset);
                    }}
                    title="Test voice"
                  >
                    ▶
                  </button>
                  {!DEFAULT_VOICES.find(d => d.id === preset.id) && (
                    <button 
                      className="voice-preset__delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePreset(preset.id);
                      }}
                      title="Delete preset"
                    >
                      ×
                    </button>
                  )}
                </div>
                {selectedVoice === preset.id && (
                  <div className="voice-preset__check">✓</div>
                )}
              </div>
            ))}
          </div>

          {/* Voice Cloning */}
          <div className="voice-settings__cloning">
            <h4>Create Cloned Voice</h4>
            <p>Upload a reference audio file (10-30 seconds of clear speech) to create a custom voice.</p>
            
            {!showCloning ? (
              <label className="voice-clone__upload">
                <input 
                  type="file" 
                  accept="audio/*" 
                  onChange={handleFileUpload}
                  hidden
                />
                <span>📁 Upload Reference Audio</span>
              </label>
            ) : (
              <div className="voice-clone__status">
                <div className="voice-clone__spinner" />
                <span>{cloneProgress}</span>
                {uploadedFile && (
                  <span className="voice-clone__filename">{uploadedFile.name}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Speech Recognition Settings */}
        <div className="voice-settings__section">
          <h3>Speech Recognition</h3>
          <div className="voice-settings__language">
            <label>Language</label>
            <select 
              value={sttLanguage} 
              onChange={(e) => handleLanguageChange(e.target.value)}
            >
              {availableLanguages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="voice-settings__section">
          <h3>Keyboard Shortcuts</h3>
          <div className="voice-settings__shortcuts">
            <div className="voice-shortcut">
              <kbd>Ctrl</kbd> + <kbd>Space</kbd>
              <span>Toggle voice input</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceSettings;

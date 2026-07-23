import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SuperconductorExecutor } from '@executor-superconductor';
import { ParallelRun, Variant, ParallelRunResult } from '@parallel-run';

const KERNEL_URL = 'http://localhost:3004';

const extractJson = (text: string) => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

const normalizeList = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => String(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map(line => line.replace(/^[\-\*\d\.\s]+/, '').trim())
      .filter(Boolean);
  }
  return [];
};

const formatList = (items: string[]) => {
  if (!items.length) return '- TBD';
  return items.map(item => `- ${item}`).join('\n');
};

// --- Types ---
interface SuperconductorIntegrationProps {
  apiKey?: string;
  onRunStart?: (runId: string) => void;
  onRunComplete?: (result: any) => void;
  onRunUpdate?: (update: any) => void;
  onError?: (error: Error) => void;
}

interface ParallelRunConfig {
  goal: string;
  models: string[];
  agentType?: string;
  verificationEnabled?: boolean;
}

interface BeadsIssue {
  id?: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  issue_type: string;
}

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  type: string;
  icon: string;
}

interface GuidedMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

type ViewState = 'TICKET' | 'STRATEGY' | 'DEPLOYMENT' | 'LAUNCHING' | 'RUNNING' | 'REVIEW';

const GUIDED_SCRIPT = [
  { key: 'summary', prompt: 'Hey — what is your Beads issue?' },
  { key: 'details', prompt: 'Give me the details: what do you want to do, the outcome, and any constraints.' },
  { key: 'files', prompt: 'Which files/components/areas will be touched? Mention any verification needs.' },
];

// --- Styles & Animations ---
const styles = `
  * { box-sizing: border-box; }
  
  /* Cyber/Holo Theme Variables */
  :root {
    --sc-bg-gradient: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
    --sc-card-bg: rgba(20, 20, 30, 0.6); /* Slightly darker/more neutral card background */
    --sc-border: rgba(100, 200, 255, 0.2);
    --sc-primary: #00f3ff;
    --sc-secondary: #bd00ff;
    --sc-text-main: #ffffff;
    --sc-text-dim: #b8c6db;
  }

  .sc-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    color: var(--sc-text-main);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    position: relative;
    overflow: hidden;
    background: transparent; /* Transparent to show parent widget bg */
  }

  .sc-toast {
    position: absolute;
    top: 16px;
    right: 20px;
    z-index: 80;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid var(--sc-border);
    background: rgba(0, 0, 0, 0.55);
    color: var(--sc-text-main);
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(10px);
  }

  .sc-toast.info {
    border-color: rgba(0, 243, 255, 0.4);
    color: var(--sc-primary);
  }

  .sc-toast.success {
    border-color: rgba(52, 211, 153, 0.5);
    color: #8ef5c5;
  }

  .sc-toast.error {
    border-color: rgba(255, 154, 162, 0.6);
    color: #ff9aa2;
  }

  .sc-draft-banner {
    margin: 12px 16px 0;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid rgba(0, 243, 255, 0.35);
    background: rgba(0, 243, 255, 0.08);
    color: var(--sc-primary);
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .sc-scroll-area {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    width: 100%;
    /* Custom Scrollbar */
    scrollbar-width: thin;
    scrollbar-color: var(--sc-border) transparent;
  }
  .sc-scroll-area::-webkit-scrollbar { width: 6px; }
  .sc-scroll-area::-webkit-scrollbar-track { background: transparent; }
  .sc-scroll-area::-webkit-scrollbar-thumb { background-color: var(--sc-border); border-radius: 10px; }
  
  .sc-fade-enter { animation: fadeIn 0.4s ease-out forwards; }
  .sc-slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  /* Brain / Core Animation */
  .sc-core-loader {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    border: 2px solid transparent;
    border-top-color: var(--sc-primary);
    border-bottom-color: var(--sc-secondary);
    animation: spin 2s linear infinite;
    position: relative;
    margin: 0 auto;
    box-shadow: 0 0 30px rgba(0, 243, 255, 0.15);
  }
  .sc-core-loader::before {
    content: '';
    position: absolute;
    top: 5px; left: 5px; right: 5px; bottom: 5px;
    border-radius: 50%;
    border: 2px solid transparent;
    border-left-color: #ff0055;
    border-right-color: #00ff9d;
    animation: spin-reverse 1.5s linear infinite;
  }
  .sc-core-loader::after {
    content: '';
    position: absolute;
    top: 20px; left: 20px; right: 20px; bottom: 20px;
    background: radial-gradient(circle, var(--sc-primary) 0%, transparent 70%);
    border-radius: 50%;
    opacity: 0.5;
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  @keyframes spin-reverse { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
  @keyframes pulse { 0% { transform: scale(0.8); opacity: 0.3; } 50% { transform: scale(1.1); opacity: 0.6; } 100% { transform: scale(0.8); opacity: 0.3; } }

  .sc-sequence-item {
    font-size: 1.1rem;
    margin-bottom: 12px;
    opacity: 0;
    animation: slideUpFade 0.5s ease forwards;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--sc-text-dim);
  }
  .sc-sequence-item.active { color: var(--sc-primary); text-shadow: 0 0 10px rgba(0,243,255,0.4); }
  @keyframes slideUpFade { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  /* Cards & Inputs */
  .sc-card {
    background: var(--sc-card-bg);
    border: 1px solid var(--sc-border);
    border-radius: 16px;
    padding: 24px;
    backdrop-filter: blur(15px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    min-height: 300px;
    margin-bottom: 20px;
    width: 100%;
    position: relative;
  }

  .sc-input {
    width: 100%;
    background: rgba(0,0,0,0.4);
    border: 1px solid var(--sc-border);
    color: white;
    padding: 14px;
    border-radius: 8px;
    outline: none;
    transition: all 0.3s;
    font-size: 0.95rem;
  }
  .sc-input:focus { border-color: var(--sc-primary); box-shadow: 0 0 10px rgba(0, 243, 255, 0.2); background: rgba(0,0,0,0.5); }

  /* Buttons */
  .sc-btn {
    background: linear-gradient(90deg, var(--sc-primary), var(--sc-secondary));
    color: white;
    border: none;
    padding: 8px 16px; /* Reduced padding */
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-shadow: 0 2px 8px rgba(189, 0, 255, 0.3);
    text-transform: uppercase;
    font-size: 0.75rem; /* Smaller font */
    letter-spacing: 0.5px;
  }
  .sc-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 243, 255, 0.5); filter: brightness(1.2); }
  .sc-btn:disabled { background: #4b5563; cursor: not-allowed; transform: none; box-shadow: none; filter: grayscale(1); opacity: 0.6; }
  
  .sc-btn-secondary { 
    background: rgba(255,255,255,0.1); 
    box-shadow: none; 
    border: 1px solid rgba(255,255,255,0.1);
  }
  .sc-btn-secondary:hover { 
    background: rgba(255,255,255,0.2); 
    border-color: white;
    box-shadow: 0 0 10px rgba(255,255,255,0.1);
  }

  /* Dropdown & Selection */
  .sc-dropdown-container { position: relative; width: 100%; margin-bottom: 12px; }
  
  .sc-select-trigger {
    background: rgba(0,0,0,0.3);
    border: 1px solid var(--sc-border);
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.2s;
    font-size: 0.9rem;
  }
  .sc-select-trigger:hover { border-color: var(--sc-primary); background: rgba(255,255,255,0.05); }

  .sc-dropdown-list {
    position: absolute;
    top: 100%; left: 0; right: 0;
    background: #12121a;
    border: 1px solid var(--sc-border);
    border-radius: 8px;
    margin-top: 8px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 100;
    box-shadow: 0 10px 40px rgba(0,0,0,0.6);
    animation: slideDown 0.2s ease-out;
    padding: 8px;
  }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
  
  .sc-group-header {
    padding: 8px 12px;
    font-size: 0.75rem;
    color: var(--sc-primary);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    margin-top: 4px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .sc-dropdown-item {
    padding: 10px 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    border-radius: 6px;
    margin-bottom: 4px;
    transition: background 0.2s;
  }
  .sc-dropdown-item:hover { background: rgba(255,255,255,0.1); }
  .sc-dropdown-item.selected { background: rgba(0, 243, 255, 0.1); border: 1px solid rgba(0, 243, 255, 0.2); }

  /* Tags */
  .sc-tags-area {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
    min-height: 40px;
  }
  .sc-tag {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(189, 0, 255, 0.15);
    border: 1px solid var(--sc-secondary);
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.85rem;
    color: white;
    box-shadow: 0 0 10px rgba(189, 0, 255, 0.1);
    animation: fadeIn 0.3s ease;
  }
  .sc-tag-remove {
    cursor: pointer;
    opacity: 0.7;
    font-weight: bold;
    transition: opacity 0.2s;
  }
  .sc-tag-remove:hover { opacity: 1; color: #ff0055; }

  /* Tabs */
  .sc-tabs {
    display: flex;
    background: rgba(0,0,0,0.3);
    border-radius: 8px;
    padding: 4px;
    margin-bottom: 20px;
  }
  .sc-tab {
    flex: 1;
    text-align: center;
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--sc-text-dim);
    transition: all 0.3s;
    font-size: 0.85rem;
  }
  .sc-tab.active {
    background: var(--sc-primary);
    color: #000;
    font-weight: 700;
    box-shadow: 0 0 15px rgba(0, 243, 255, 0.4);
  }

  .sc-ticket-mode {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .sc-subtabs {
    display: flex;
    gap: 8px;
    padding: 4px;
    background: rgba(0,0,0,0.25);
    border: 1px solid var(--sc-border);
    border-radius: 10px;
  }

  .sc-subtab {
    flex: 1;
    text-align: center;
    padding: 8px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--sc-text-dim);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.8rem;
    letter-spacing: 0.3px;
  }

  .sc-subtab.active {
    background: rgba(0, 243, 255, 0.15);
    color: var(--sc-primary);
    font-weight: 600;
    box-shadow: 0 0 12px rgba(0, 243, 255, 0.2);
  }

  .sc-entry-card {
    gap: 16px;
  }

  .sc-entry-chat {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sc-entry-message {
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(0, 243, 255, 0.08);
    border: 1px solid rgba(0, 243, 255, 0.25);
    font-size: 0.95rem;
  }

  .sc-entry-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sc-entry-input {
    display: flex;
    gap: 8px;
    align-items: center;
    background: rgba(0,0,0,0.3);
    border: 1px solid var(--sc-border);
    border-radius: 12px;
    padding: 8px 10px;
  }

  .sc-entry-field {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--sc-text-main);
    font-size: 0.9rem;
    outline: none;
  }

  .sc-entry-submit {
    border: 1px solid var(--sc-border);
    background: rgba(255,255,255,0.08);
    color: var(--sc-text-main);
    border-radius: 10px;
    padding: 6px 12px;
    cursor: pointer;
  }

  .sc-entry-btn {
    text-align: left;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid var(--sc-border);
    background: rgba(255,255,255,0.06);
    color: var(--sc-text-main);
    cursor: pointer;
    transition: transform 0.2s ease, border-color 0.2s ease;
  }

  .sc-entry-btn:hover {
    transform: translateY(-1px);
    border-color: var(--sc-primary);
  }

  .sc-entry-btn.secondary {
    color: var(--sc-text-dim);
    background: rgba(255,255,255,0.03);
  }

  .sc-issue-card {
    gap: 16px;
  }

  .sc-issue-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .sc-issue-title {
    margin: 0;
    color: var(--sc-primary);
    letter-spacing: 0.5px;
  }

  .sc-issue-subtitle {
    color: var(--sc-text-dim);
    font-size: 0.85rem;
    margin-top: 4px;
  }

  .sc-issue-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .sc-issue-pill {
    border: 1px solid var(--sc-border);
    background: rgba(255,255,255,0.08);
    color: var(--sc-text-main);
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: border-color 0.2s ease, transform 0.2s ease;
  }

  .sc-issue-pill:hover {
    border-color: var(--sc-primary);
    transform: translateY(-1px);
  }

  .sc-issue-pill.ghost {
    color: var(--sc-text-dim);
    background: rgba(255,255,255,0.02);
  }

  .sc-issue-meta {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .sc-issue-label {
    font-size: 0.75rem;
    color: var(--sc-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  .sc-directory-row,
  .sc-attachment-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sc-directory-select {
    position: relative;
    display: flex;
    gap: 8px;
    align-items: center;
    background: rgba(0,0,0,0.3);
    border: 1px solid var(--sc-border);
    border-radius: 12px;
    padding: 8px 10px;
  }

  .sc-directory-input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--sc-text-main);
    font-size: 0.9rem;
    outline: none;
  }

  .sc-directory-row.granted .sc-directory-select {
    border-color: rgba(52, 211, 153, 0.5);
    box-shadow: 0 0 0 1px rgba(52, 211, 153, 0.25), 0 0 14px rgba(52, 211, 153, 0.2);
  }

  .sc-directory-toggle,
  .sc-directory-browse {
    border: 1px solid var(--sc-border);
    background: rgba(255,255,255,0.06);
    color: var(--sc-text-main);
    border-radius: 10px;
    padding: 6px 10px;
    cursor: pointer;
  }

  .sc-directory-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    background: #101018;
    border: 1px solid var(--sc-border);
    border-radius: 10px;
    padding: 6px;
    max-height: 220px;
    overflow-y: auto;
    z-index: 40;
  }

  .sc-directory-item {
    padding: 8px 10px;
    border-radius: 8px;
    cursor: pointer;
    color: var(--sc-text-main);
  }

  .sc-directory-item:hover {
    background: rgba(255,255,255,0.08);
  }

  .sc-directory-empty {
    padding: 8px 10px;
    color: var(--sc-text-dim);
    font-style: italic;
  }

  .sc-directory-selected {
    color: var(--sc-text-dim);
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sc-directory-status {
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 0.65rem;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    background: rgba(52, 211, 153, 0.18);
    color: #8ef5c5;
    border: 1px solid rgba(52, 211, 153, 0.4);
  }

  .sc-attachment-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .sc-attach-btn {
    border: 1px solid var(--sc-border);
    background: rgba(255,255,255,0.06);
    color: var(--sc-text-main);
    border-radius: 10px;
    padding: 6px 10px;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .sc-attachment-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .sc-attachment-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    font-size: 0.75rem;
    color: var(--sc-text-main);
  }

  .sc-attachment-chip.image {
    background: rgba(189, 0, 255, 0.15);
    border-color: rgba(189, 0, 255, 0.4);
  }

  .sc-attachment-remove {
    background: transparent;
    border: none;
    color: var(--sc-text-dim);
    cursor: pointer;
  }

  .sc-issue-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: auto;
  }

  .sc-issue-preview {
    margin-top: 16px;
    padding: 16px;
    border-radius: 14px;
    border: 1px solid rgba(0, 243, 255, 0.25);
    background: linear-gradient(135deg, rgba(0, 243, 255, 0.08), rgba(189, 0, 255, 0.1));
    box-shadow: 0 0 18px rgba(0, 243, 255, 0.12);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sc-issue-preview.loading {
    border-style: dashed;
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.35);
    color: var(--sc-text-dim);
  }

  .sc-issue-preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .sc-issue-preview-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: #ffffff;
  }

  .sc-issue-preview-tag {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid rgba(0, 243, 255, 0.45);
    color: var(--sc-primary);
    background: rgba(0, 243, 255, 0.12);
  }

  .sc-issue-preview-body {
    white-space: pre-wrap;
    font-family: "SFMono-Regular", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.82);
    line-height: 1.6;
    background: rgba(0, 0, 0, 0.35);
    border-radius: 12px;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    max-height: 200px;
    overflow-y: auto;
  }

  .sc-issue-preview-actions {
    display: flex;
    justify-content: flex-end;
  }

  .sc-guided {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sc-guided-chat {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sc-guided-messages {
    flex: 1;
    min-height: 240px;
    max-height: 320px;
    overflow-y: auto;
    background: rgba(0,0,0,0.25);
    border: 1px solid var(--sc-border);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sc-guided-message {
    display: flex;
  }

  .sc-guided-message.user {
    justify-content: flex-end;
  }

  .sc-guided-bubble {
    max-width: 80%;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    color: var(--sc-text-main);
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .sc-guided-message.user .sc-guided-bubble {
    background: rgba(0, 243, 255, 0.12);
    border-color: rgba(0, 243, 255, 0.3);
  }

  .sc-guided-input-bar {
    display: flex;
    gap: 10px;
    align-items: center;
    background: rgba(0,0,0,0.3);
    border: 1px solid var(--sc-border);
    border-radius: 999px;
    padding: 8px 10px;
  }

  .sc-guided-input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--sc-text-main);
    font-size: 0.9rem;
    outline: none;
  }

  .sc-guided-input::placeholder {
    color: var(--sc-text-dim);
  }

  .sc-guided-send {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: linear-gradient(90deg, var(--sc-primary), var(--sc-secondary));
    color: #000;
    cursor: pointer;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sc-guided-send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sc-typing-dots {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .sc-typing-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255,255,255,0.6);
    animation: scDotPulse 1.1s ease-in-out infinite;
  }

  .sc-typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .sc-typing-dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes scDotPulse {
    0%, 100% { transform: translateY(0); opacity: 0.4; }
    50% { transform: translateY(-4px); opacity: 1; }
  }

  .sc-manual-shell {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    border-radius: 12px;
    background: rgba(0,0,0,0.25);
    border: 1px solid var(--sc-border);
    color: var(--sc-text-dim);
    font-size: 0.85rem;
  }

  .sc-manual-overlay {
    position: absolute;
    inset: 0;
    background: rgba(6, 8, 12, 0.7);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
  }

  .sc-manual-card {
    width: min(540px, 100%);
    background: rgba(12, 12, 18, 0.95);
    border: 1px solid var(--sc-border);
    border-radius: 16px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
  }

  .sc-manual-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--sc-primary);
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .sc-manual-close {
    background: transparent;
    border: 1px solid var(--sc-border);
    color: var(--sc-text-main);
    border-radius: 999px;
    width: 28px;
    height: 28px;
    cursor: pointer;
  }

  .sc-manual-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 8px;
  }

  .sc-error {
    color: #ff9aa2;
    font-size: 0.85rem;
  }

  /* Kanban Cards */
  .sc-kanban-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    padding-bottom: 40px;
  }
  .sc-kanban-layout {
    display: grid;
    grid-template-columns: minmax(260px, 320px) 1fr;
    gap: 20px;
    height: 100%;
    align-items: start;
  }
  .sc-kanban-issue-column {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sc-kanban-card {
    background: rgba(20, 20, 30, 0.4);
    border: 1px solid var(--sc-border);
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sc-kanban-card.issue {
    border-color: rgba(0, 243, 255, 0.45);
    background: linear-gradient(135deg, rgba(0, 243, 255, 0.08), rgba(189, 0, 255, 0.08));
    box-shadow: inset 0 0 0 1px rgba(0, 243, 255, 0.2);
    cursor: default;
  }
  .sc-kanban-empty {
    padding: 14px;
    border-radius: 12px;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    color: var(--sc-text-dim);
    font-size: 0.85rem;
    background: rgba(0, 0, 0, 0.25);
  }
  @media (max-width: 860px) {
    .sc-kanban-layout {
      grid-template-columns: 1fr;
    }
  }
  .sc-kanban-card:hover {
    transform: translateY(-5px);
    border-color: var(--sc-primary);
    box-shadow: 0 10px 20px rgba(0,0,0,0.3);
  }
  .sc-log-window {
    background: rgba(0,0,0,0.6);
    border-radius: 6px;
    padding: 10px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: var(--sc-text-dim);
    min-height: 80px;
    max-height: 80px;
    overflow-y: auto;
    margin-top: 12px;
    border: 1px solid rgba(255,255,255,0.05);
  }
`;

// --- Data Hooks ---
const useBeadsRegistry = (baseUrl: string) => {
  const [issues, setIssues] = useState<BeadsIssue[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const fetchWithTimeout = (url: string) => 
        Promise.race([
          fetch(url),
          new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);

      const [iRes, mRes] = await Promise.allSettled([
        fetchWithTimeout(`${baseUrl}/beads/issues`),
        fetchWithTimeout(`${baseUrl}/registry/models`)
      ]);
      
      if (iRes.status === 'fulfilled' && iRes.value.ok) {
        const data = await iRes.value.json();
        setIssues(data);
      } else {
        console.warn("Failed to fetch issues", iRes);
      }

      if (mRes.status === 'fulfilled' && mRes.value.ok) {
        setModels(await mRes.value.json());
      } else {
        setModels(getFallbackModels());
        console.warn("Failed to fetch models, using fallback.");
      }
    } catch (e) {
      console.error("Registry fetch failed", e);
      setModels(getFallbackModels());
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  const getFallbackModels = () => [
     {id: "ui-tars-7b-qwen", name: "UI-TARS Vision", provider: "Local", type: "Specialist", icon: "👁️"},
     {id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", type: "Generalist", icon: "🧠"},
     {id: "claude-3-5-sonnet", name: "Claude 3.5", provider: "Anthropic", type: "Generalist", icon: "🎭"},
     {id: "deepseek-coder", name: "DeepSeek Coder", provider: "Local", type: "Coding", icon: "💻"},
     {id: "gemini-pro", name: "Gemini Pro", provider: "Google", type: "Generalist", icon: "✨"}
  ];

  useEffect(() => { refresh(); }, [refresh]);

  const createIssue = async (issue: Partial<BeadsIssue>) => {
    try {
        const res = await fetch(`${baseUrl}/beads/issues`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(issue)
        });
        if (res.ok) {
            const newIssue = await res.json();
            setIssues(p => [...p, newIssue]);
            return newIssue;
        }
        throw new Error("Failed to create issue");
    } catch (e) {
        console.error(e);
        return { ...issue, id: `mock-${Date.now()}`, created_at: new Date().toISOString() };
    }
  };

  return { issues, models, loading, createIssue, refresh };
};

// --- Helper Components ---

const TransitionScreen: React.FC<{ title: string; steps: React.ReactNode[]; onComplete: () => void }> = ({ title, steps, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  
  useEffect(() => {
    if (currentStep < steps.length) {
      const timer = setTimeout(() => setCurrentStep(c => c + 1), 800);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(onComplete, 1200);
      return () => clearTimeout(timer);
    }
  }, [currentStep, steps.length, onComplete]);

  return (
    <div className="sc-fade-enter" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '20px', textAlign: 'center' }}>
       <div className="sc-core-loader" />
       <h2 style={{ marginTop: 40, marginBottom: 30, color: '#fff', fontWeight: 300, letterSpacing: '2px', textTransform: 'uppercase' }}>{title}</h2>
       <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '150px' }}>
         {steps.slice(0, currentStep + 1).map((step, i) => (
            <div key={i} className={`sc-sequence-item ${i === currentStep ? 'active' : ''}`} style={{ animationDelay: `${i * 0.1}s` }}>
               {i < currentStep ? '✓ ' : '➤ '} {step}
            </div>
         ))}
       </div>
    </div>
  );
};

// --- Main Logic Hook ---
export const useSuperconductorLogic = ({
  apiKey = 'sc-prod-key-7f2a1b',
  onRunStart,
  onRunComplete,
  onRunUpdate,
  onError
}: SuperconductorIntegrationProps) => {
  const [view, setView] = useState<ViewState>('TICKET');
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [currentIssueTitle, setCurrentIssueTitle] = useState<string>('');
  const [currentGoal, setCurrentGoal] = useState<string>('');
  
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  
  const [ticketMode, setTicketMode] = useState<'existing' | 'new'>('new');
  const [selectedIssueId, setSelectedIssueId] = useState<string>('');
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueDesc, setNewIssueDesc] = useState('');
  const [ticketCreateMode, setTicketCreateMode] = useState<'guided' | 'manual'>('guided');
  const [guidedMessages, setGuidedMessages] = useState<GuidedMessage[]>([]);
  const [guidedInput, setGuidedInput] = useState('');
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedComplete, setGuidedComplete] = useState(false);
  const [issuePrompt, setIssuePrompt] = useState('');
  const [issueDetails, setIssueDetails] = useState('');
  const [issueFiles, setIssueFiles] = useState('');
  const [selectedDirectory, setSelectedDirectory] = useState('');
  const [directoryOptions, setDirectoryOptions] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [createdIssue, setCreatedIssue] = useState<BeadsIssue | null>(null);
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  
  const superconductorUrl = (window as any).__ALLTERNIT_SUPERCONDUCTOR_URL__ || 'http://localhost:3310';
  const registry = useBeadsRegistry(superconductorUrl);

  const executor = useMemo(() => new SuperconductorExecutor({
    apiKey: apiKey,
    endpoint: superconductorUrl
  }), [apiKey, superconductorUrl]);

  const addLog = useCallback((variantId: string, message: string) => {
    setLogs(prev => ({
      ...prev,
      [variantId]: [...(prev[variantId] || []), `[${new Date().toLocaleTimeString()}] ${message}`]
    }));
  }, []);

  const proceedToStrategy = () => {
    if (ticketMode === 'new' && (!newIssueTitle || !newIssueDesc)) {
        alert("Please provide a title and description.");
        return;
    }
    if (ticketMode === 'existing' && !selectedIssueId) {
        alert("Please select an existing issue.");
        return;
    }
    setView('STRATEGY');
  };

  const finalizeStrategy = () => {
    setView('DEPLOYMENT');
  };

  const getIssueTitle = () => {
    if (ticketMode === 'new') return newIssueTitle;
    return registry.issues.find(i => i.id === selectedIssueId)?.title || 'Selected Issue';
  };

  const generateIssueDraft = useCallback(async (summary: string, details: string, files: string) => {
    if (!summary.trim() || !details.trim()) {
      setDraftError('Add an issue summary and details before drafting.');
      return null;
    }

    setIsDrafting(true);
    setDraftError(null);

    const prompt = [
      'Use the Beads issue framework to produce a complete, production-ready issue.',
      'If a Beads issue skill is available, use it. Otherwise follow the framework below.',
      'Framework:',
      '- Title',
      '- Description (context + intent)',
      '- Scope / Files',
      '- Acceptance Criteria',
      '- Risks / Notes',
      '- Verification',
      'Return ONLY JSON with keys: title, description, acceptance_criteria, affected_files, risks, verification.',
      `Issue summary: ${summary}`,
      `Details: ${details}`,
      `Files or areas: ${files || 'Unspecified'}`,
    ].join('\n');

    try {
      const res = await fetch(`${KERNEL_URL}/v1/intent/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent_text: prompt, execution_mode: 'auto' }),
      });

      let parsed: any = null;
      if (res.ok) {
        const data = await res.json();
        const rawText = typeof data === 'string'
          ? data
          : data.response || data.capsule?.description || data.capsule?.title || JSON.stringify(data);
        parsed = extractJson(rawText) || extractJson(JSON.stringify(data));
      }

      const title = (parsed?.title || summary).toString().trim() || 'New Issue';
      const acceptance = normalizeList(parsed?.acceptance_criteria || parsed?.acceptanceCriteria);
      const affectedFiles = normalizeList(parsed?.affected_files || parsed?.affectedFiles || files);
      const risks = normalizeList(parsed?.risks);
      const verification = normalizeList(parsed?.verification || parsed?.tests);

      const descriptionParts = [
        (parsed?.description || details).toString().trim(),
        '',
        'Scope / Files:',
        formatList(affectedFiles),
        '',
        'Acceptance Criteria:',
        formatList(acceptance),
        '',
        'Risks / Notes:',
        formatList(risks),
        '',
        'Verification:',
        formatList(verification),
      ];

      const description = descriptionParts.join('\n').trim();
      setNewIssueTitle(title);
      setNewIssueDesc(description);
      return { title, description };
    } catch (err) {
      console.error('Draft generation failed', err);
      const fallbackParts = [
        details || 'Details TBD.',
        '',
        'Scope / Files:',
        formatList(normalizeList(files)),
      ];
      const description = fallbackParts.join('\n').trim();
      setNewIssueTitle(summary);
      setNewIssueDesc(description);
      setDraftError('AI draft unavailable. Filled from your inputs.');
      return { title: summary, description };
    } finally {
      setIsDrafting(false);
    }
  }, [setNewIssueTitle, setNewIssueDesc, setDraftError, setIsDrafting]);

  const resetGuidedFlow = useCallback(() => {
    setGuidedMessages([{
      id: `guided-${Date.now()}`,
      role: 'assistant',
      content: GUIDED_SCRIPT[0].prompt,
    }]);
    setGuidedInput('');
    setGuidedStep(0);
    setGuidedComplete(false);
    setIssuePrompt('');
    setIssueDetails('');
    setIssueFiles('');
    setNewIssueTitle('');
    setNewIssueDesc('');
    setSelectedDirectory('');
    setDirectoryOptions([]);
    setAttachedFiles([]);
    setAttachedImages([]);
    setDraftError(null);
    setCreatedIssue(null);
    setIsCreatingIssue(false);
  }, [setGuidedMessages, setGuidedInput, setGuidedStep, setGuidedComplete, setIssuePrompt, setIssueDetails, setIssueFiles, setNewIssueTitle, setNewIssueDesc, setSelectedDirectory, setDirectoryOptions, setAttachedFiles, setAttachedImages, setDraftError, setCreatedIssue, setIsCreatingIssue]);

  const submitGuidedInput = useCallback(async () => {
    const trimmed = guidedInput.trim();
    if (!trimmed || isDrafting) return;

    const step = guidedStep;
    const nextSummary = step === 0 ? trimmed : issuePrompt;
    const nextDetails = step === 1 ? trimmed : issueDetails;
    const nextFiles = step === 2 ? trimmed : issueFiles;
    const scopeLines: string[] = [];
    if (nextFiles.trim()) scopeLines.push(nextFiles.trim());
    if (selectedDirectory) scopeLines.push(`Directory: ${selectedDirectory}`);
    if (attachedFiles.length) {
      scopeLines.push('Files:');
      attachedFiles.forEach((file) => scopeLines.push(`- ${file}`));
    }
    if (attachedImages.length) {
      scopeLines.push('Images:');
      attachedImages.forEach((file) => scopeLines.push(`- ${file}`));
    }
    const scopeText = scopeLines.join('\n');

    setGuidedMessages(prev => [...prev, {
      id: `guided-${Date.now()}-user`,
      role: 'user',
      content: trimmed,
    }]);
    setGuidedInput('');

    if (step === 0) setIssuePrompt(trimmed);
    if (step === 1) setIssueDetails(trimmed);
    if (step === 2) setIssueFiles(trimmed);

    if (step < GUIDED_SCRIPT.length - 1) {
      const nextStep = step + 1;
      setGuidedStep(nextStep);
      setGuidedMessages(prev => [...prev, {
        id: `guided-${Date.now()}-assistant`,
        role: 'assistant',
        content: GUIDED_SCRIPT[nextStep].prompt,
      }]);
      return;
    }

    setGuidedStep(GUIDED_SCRIPT.length);
    setGuidedMessages(prev => [...prev, {
      id: `guided-${Date.now()}-assistant`,
      role: 'assistant',
      content: 'Got it. Drafting the Beads issue now...',
    }]);

    setView('STRATEGY');

    generateIssueDraft(nextSummary, nextDetails, scopeText).then(async (draft) => {
      if (!draft) return;
      setGuidedComplete(true);
      setGuidedMessages(prev => [...prev, {
        id: `guided-${Date.now()}-assistant-final`,
        role: 'assistant',
        content: `Draft ready: "${draft.title}". You can continue the flow.`,
      }]);
      setIsCreatingIssue(true);
      try {
        const created = await registry.createIssue({
          title: draft.title,
          description: draft.description,
          status: 'open',
          priority: 1,
          issue_type: 'feature',
        });
        setCreatedIssue(created as BeadsIssue);
        if (created?.id) {
          setSelectedIssueId(created.id);
        }
      } finally {
        setIsCreatingIssue(false);
      }
    });
  }, [guidedInput, guidedStep, issuePrompt, issueDetails, issueFiles, selectedDirectory, attachedFiles, attachedImages, isDrafting, generateIssueDraft, registry, setGuidedMessages, setGuidedInput, setGuidedStep, setGuidedComplete, setIssuePrompt, setIssueDetails, setIssueFiles, setSelectedIssueId, setCreatedIssue, setIsCreatingIssue, setView]);

  useEffect(() => {
    if (ticketMode === 'new' && guidedMessages.length === 0) {
      setGuidedMessages([{
        id: `guided-${Date.now()}`,
        role: 'assistant',
        content: GUIDED_SCRIPT[0].prompt,
      }]);
    }
  }, [ticketMode, guidedMessages.length, setGuidedMessages]);

  const launch = async () => {
    setView('LAUNCHING');
    
    try {
      let issueId = selectedIssueId;
      let goal = "";
      let issue: BeadsIssue | undefined;

      if (ticketMode === 'new') {
        if (createdIssue?.id) {
          issue = createdIssue;
          issueId = createdIssue.id!;
          goal = createdIssue.description;
        } else {
          issue = await registry.createIssue({
              title: newIssueTitle,
              description: newIssueDesc,
              status: 'open',
              priority: 1,
              issue_type: 'feature'
          });
          issueId = issue.id!;
          goal = issue.description;
        }
        setNewIssueTitle('');
        setNewIssueDesc('');
      } else {
        issue = registry.issues.find(i => i.id === issueId);
        goal = issue?.description || "";
      }
      
      setCurrentIssueTitle(issue?.title || newIssueTitle || "New Issue");
      setCurrentGoal(goal);

      const runId = `sc-${Date.now()}`;
      const runPayload: any = {
        runId: runId,
        goal: goal,
        beadsIssueId: issueId,
        variants: selectedModels.map((model, index) => ({
          variantId: `variant-${index + 1}`,
          model,
          priority: index + 1
        })),
        createdAt: new Date().toISOString()
      };

      setCurrentRunId(runId);
      onRunStart?.(runId);
      setResults(runPayload.variants.map((v: any) => ({ ...v, status: 'pending' })));
      setLogs({});

      executor.execute(runPayload).then(result => {
          setResults(result.results);
          setProgress(100);
          onRunComplete?.(result);
      }).catch(e => {
          console.error(e);
          onError?.(e);
          setResults(prev => prev.map(item => ({ ...item, status: 'failed', error: 'Backend unavailable' })));
          runPayload.variants.forEach((variant: any) => {
            addLog(variant.variantId, 'Backend unavailable. Showing placeholder run state.');
          });
          setProgress(100);
      });

      const streamUpdates = async () => {
        try {
          const updates = executor.streamUpdates(runId);
          for await (const update of updates) {
            onRunUpdate?.(update);
            if (update.eventType === 'status.variant' && update.payload?.message) {
               addLog(update.variantId, update.payload.message);
            } else if (update.eventType === 'variant.shipped') {
              addLog(update.variantId || 'unknown', `Variant shipped to ${update.payload?.path}`);
            }
          }
        } catch (e) { console.error(e); }
      };
      streamUpdates();

    } catch (e) {
      console.error(e);
      onError?.(e as Error);
      setView('TICKET');
    }
  };

  const finalizeLaunch = () => {
    setView('RUNNING');
  };

  const shipVariant = useCallback(async (variantId: string) => {
    if (!currentRunId) return;
    try {
        const res = await fetch(`${superconductorUrl}/runs/${currentRunId}/ship/${variantId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ targetPath: 'src/shipped.tsx' })
        });
        if (!res.ok) throw new Error(`Failed to ship: ${res.status}`);
        const data = await res.json();
        alert(`🚀 Shipped to: ${data.path}`);
        addLog(variantId, `Shipped successfully to ${data.path}`);
    } catch (e) {
        alert(`Ship failed: ${e}`);
        addLog(variantId, `Ship failed: ${String(e)}`);
    }
  }, [currentRunId, apiKey, addLog]);

  return {
    view, setView,
    ticketMode, setTicketMode,
    ticketCreateMode, setTicketCreateMode,
    guidedMessages,
    guidedInput, setGuidedInput,
    guidedStep, setGuidedStep,
    guidedComplete,
    selectedIssueId, setSelectedIssueId,
    newIssueTitle, setNewIssueTitle,
    newIssueDesc, setNewIssueDesc,
    issuePrompt, setIssuePrompt,
    issueDetails, setIssueDetails,
    issueFiles, setIssueFiles,
    selectedDirectory, setSelectedDirectory,
    directoryOptions, setDirectoryOptions,
    attachedFiles, setAttachedFiles,
    attachedImages, setAttachedImages,
    isDrafting,
    draftError,
    currentIssueTitle,
    currentGoal,
    selectedModels, setSelectedModels,
    createdIssue,
    isCreatingIssue,
    registry,
    proceedToStrategy,
    finalizeStrategy,
    resetGuidedFlow,
    submitGuidedInput,
    launch,
    finalizeLaunch,
    getIssueTitle,
    results, logs,
    drillDown: (vid: string) => { setSelectedVariantId(vid); setView('REVIEW'); },
    backToBoard: () => { setSelectedVariantId(null); setView('RUNNING'); },
    selectedVariantId,
    shipVariant,
    reset: () => { setCurrentRunId(null); setResults([]); setView('TICKET'); }
  };
};

// --- Component ---
export const SuperconductorUI: React.FC<SuperconductorIntegrationProps> = (props) => {
  const logic = useSuperconductorLogic(props);
  const selectedVariant = logic.results.find(r => r.variantId === logic.selectedVariantId);
  
  const [ticketDropdownOpen, setTicketDropdownOpen] = useState(false);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const guidedEndRef = useRef<HTMLDivElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);
  const [entryChoice, setEntryChoice] = useState<'beads' | 'deploy' | 'review' | null>(null);
  const [entryInput, setEntryInput] = useState('');
  const [entryError, setEntryError] = useState('');
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');
  const [draftToast, setDraftToast] = useState<null | { tone: 'info' | 'success' | 'error'; message: string }>(null);

  useEffect(() => {
    guidedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logic.guidedMessages.length, logic.isDrafting]);

  useEffect(() => {
    if (logic.ticketMode !== 'new' || logic.ticketCreateMode !== 'manual') {
      setManualOpen(false);
    }
  }, [logic.ticketMode, logic.ticketCreateMode]);

  useEffect(() => {
    if (logic.isDrafting) {
      setDraftToast({ tone: 'info', message: 'Drafting Beads issue in the background...' });
      return;
    }
    if (logic.isCreatingIssue) {
      setDraftToast({ tone: 'info', message: 'Creating Beads issue...' });
      return;
    }
    if (draftToast?.tone === 'info') {
      setDraftToast(null);
    }
  }, [logic.isDrafting, logic.isCreatingIssue, draftToast]);

  useEffect(() => {
    if (logic.createdIssue?.id) {
      setDraftToast({ tone: 'success', message: `Beads issue created (${logic.createdIssue.id}).` });
    }
  }, [logic.createdIssue?.id]);

  useEffect(() => {
    if (logic.draftError) {
      setDraftToast({ tone: 'error', message: logic.draftError });
    }
  }, [logic.draftError]);

  useEffect(() => {
    if (!draftToast || draftToast.tone === 'info') return;
    const timer = setTimeout(() => setDraftToast(null), 6000);
    return () => clearTimeout(timer);
  }, [draftToast]);

  useEffect(() => {
    if (directoryInputRef.current) {
      directoryInputRef.current.setAttribute('webkitdirectory', '');
      directoryInputRef.current.setAttribute('directory', '');
    }
  }, []);

  // Group models for dropdown
  const modelsByType = useMemo(() => {
    const groups: Record<string, ModelInfo[]> = {};
    logic.registry.models.forEach(m => {
        const type = m.type || 'Other';
        if (!groups[type]) groups[type] = [];
        groups[type].push(m);
    });
    return groups;
  }, [logic.registry.models]);
  const canProceed = logic.ticketMode === 'existing'
    ? !!logic.selectedIssueId
    : !!logic.newIssueTitle && !!logic.newIssueDesc;
  const canLaunch = logic.ticketMode === 'existing'
    ? true
    : !!logic.newIssueTitle && !!logic.newIssueDesc;
  const filteredDirectories = logic.directoryOptions
    .filter((dir) => dir.toLowerCase().includes(directorySearch.toLowerCase()))
    .slice(0, 20);
  const selectedIssue = logic.registry.issues.find(i => i.id === logic.selectedIssueId) || null;
  const fallbackIssueTitle = logic.ticketMode === 'existing'
    ? selectedIssue?.title || 'Selected Issue'
    : logic.newIssueTitle || 'New Issue';
  const issueTitle = typeof logic.getIssueTitle === 'function'
    ? logic.getIssueTitle()
    : fallbackIssueTitle;
  const boardIssue = logic.ticketMode === 'existing'
    ? selectedIssue
    : (logic.createdIssue || (logic.newIssueTitle || logic.newIssueDesc ? {
        title: logic.newIssueTitle || 'Beads Issue Draft',
        description: logic.newIssueDesc || '',
      } : null));
  const boardIssueTitle = boardIssue?.title || (logic.ticketMode === 'existing' ? 'No issue selected' : 'Beads Issue');
  const boardIssueId = boardIssue?.id || null;
  const boardIssueDescription = boardIssue?.description || '';
  const issuePreview = boardIssueDescription
    ? boardIssueDescription.split('\n').filter(Boolean).slice(0, 6).join('\n')
    : '';
  const boardIssueStatus = logic.isDrafting
    ? 'Drafting in background...'
    : logic.isCreatingIssue
      ? 'Creating issue...'
      : logic.createdIssue?.id
        ? 'Draft ready · Created'
        : boardIssueDescription
          ? 'Draft ready'
          : 'Awaiting issue input';
  const draftBannerMessage = logic.isDrafting
    ? 'Drafting Beads issue in background...'
    : logic.isCreatingIssue
      ? 'Creating Beads issue...'
      : '';

  const resetEntryState = () => {
    setEntryInput('');
    setEntryError('');
    setDirectorySearch('');
    setDirectoryOpen(false);
    setTicketDropdownOpen(false);
    setAgentDropdownOpen(false);
  };

  const handleEntrySelect = (choice: 'beads' | 'deploy' | 'review') => {
    setEntryChoice(choice);
    resetEntryState();
    if (choice === 'beads') {
      logic.setTicketMode('new');
      logic.setTicketCreateMode('guided');
      logic.resetGuidedFlow();
    } else if (choice === 'deploy') {
      logic.setTicketMode('existing');
      logic.setTicketCreateMode('guided');
    } else {
      logic.setTicketCreateMode('guided');
    }
  };

  const handleEntrySubmit = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return;
    if (trimmed.startsWith('1') || trimmed.includes('beads') || trimmed.includes('issue')) {
      handleEntrySelect('beads');
    } else if (trimmed.startsWith('2') || trimmed.includes('deploy') || trimmed.includes('agent')) {
      handleEntrySelect('deploy');
    } else if (trimmed.startsWith('3') || trimmed.includes('review') || trimmed.includes('run')) {
      handleEntrySelect('review');
    } else {
      setEntryError('Reply with 1, 2, or 3 to continue.');
    }
  };

  const mergeUnique = (items: string[], additions: string[]) => {
    return Array.from(new Set([...items, ...additions])).filter(Boolean);
  };

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(event.target.files || []);
    const names = list.map((file) => (file as any).webkitRelativePath || file.name).filter(Boolean);
    if (names.length) {
      logic.setAttachedFiles(prev => mergeUnique(prev, names));
    }
    event.target.value = '';
  };

  const handleImagesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(event.target.files || []);
    const names = list.map((file) => (file as any).webkitRelativePath || file.name).filter(Boolean);
    if (names.length) {
      logic.setAttachedImages(prev => mergeUnique(prev, names));
    }
    event.target.value = '';
  };

  const handleDirectoryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(event.target.files || []);
    const dirs = new Set<string>();
    list.forEach((file) => {
      const rel = (file as any).webkitRelativePath || file.name;
      if (!rel) return;
      const root = rel.split('/')[0];
      if (root) dirs.add(root);
    });
    const nextDirs = Array.from(dirs);
    if (nextDirs.length) {
      logic.setDirectoryOptions(prev => mergeUnique(prev, nextDirs));
      setDirectorySearch('');
      setDirectoryOpen(true);
    }
    event.target.value = '';
  };

  const handleDirectorySelect = (dir: string) => {
    logic.setSelectedDirectory(dir);
    setDirectorySearch('');
    setDirectoryOpen(false);
  };

  const requestDirectoryAccess = () => {
    directoryInputRef.current?.click();
  };

  return (
    <div className="sc-container">
      <style>{styles}</style>
      {draftBannerMessage && (
        <div className="sc-draft-banner">{draftBannerMessage}</div>
      )}
      {draftToast && (
        <div className={`sc-toast ${draftToast.tone}`}>{draftToast.message}</div>
      )}

      {/* VIEW: TICKET */}
      {logic.view === 'TICKET' && (
        <div className="sc-scroll-area sc-fade-enter">
          {!entryChoice && (
            <div className="sc-card sc-entry-card sc-slide-up">
              <h2 style={{ marginTop: 0, color: 'var(--sc-primary)', display: 'flex', alignItems: 'center', gap: '10px', textShadow: '0 0 10px rgba(0,243,255,0.3)' }}>
                🧭 Conductor
              </h2>
              <div className="sc-entry-chat">
                <div className="sc-entry-message">What do you want to do?</div>
                <div className="sc-entry-actions">
                  <button className="sc-entry-btn" type="button" onClick={() => handleEntrySelect('beads')}>
                    1. Create Beads Issue
                  </button>
                  <button className="sc-entry-btn" type="button" onClick={() => handleEntrySelect('deploy')}>
                    2. Deploy Agents
                  </button>
                  <button className="sc-entry-btn secondary" type="button" onClick={() => handleEntrySelect('review')}>
                    3. Review Runs
                  </button>
                </div>
                <div className="sc-entry-input">
                  <input
                    className="sc-entry-field"
                    placeholder="Reply with 1, 2, or 3..."
                    value={entryInput}
                    onChange={(e) => setEntryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleEntrySubmit(entryInput);
                      }
                    }}
                  />
                  <button
                    className="sc-entry-submit"
                    type="button"
                    onClick={() => handleEntrySubmit(entryInput)}
                  >
                    Go
                  </button>
                </div>
                {entryError && <div className="sc-error">{entryError}</div>}
              </div>
            </div>
          )}

          {entryChoice === 'beads' && (
            <div className="sc-card sc-issue-card sc-slide-up">
              <input ref={filesInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFilesChange} />
              <input ref={imagesInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handleImagesChange} />
              <input ref={directoryInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleDirectoryChange} />

              <div className="sc-issue-header">
                <div>
                  <h2 className="sc-issue-title">Beads Issue</h2>
                  <div className="sc-issue-subtitle">Guided intake → AI draft → strategy</div>
                </div>
                <div className="sc-issue-actions">
                  <button className="sc-issue-pill" type="button" onClick={() => handleEntrySelect('deploy')}>
                    Use Existing
                  </button>
                  <button className="sc-issue-pill" type="button" onClick={() => { logic.setTicketCreateMode('manual'); setManualOpen(true); }}>
                    Manual Edit
                  </button>
                  <button
                    className="sc-issue-pill ghost"
                    type="button"
                    onClick={() => {
                      setEntryChoice(null);
                      resetEntryState();
                    }}
                  >
                    Back
                  </button>
                </div>
              </div>

              <div className="sc-issue-meta">
                <div className={`sc-directory-row ${logic.selectedDirectory ? 'granted' : ''}`}>
                  <div className="sc-issue-label">Directory</div>
                  <div className="sc-directory-select">
                    <input
                      className="sc-directory-input"
                      placeholder="Select a directory (requires permission)"
                      value={directorySearch}
                      onChange={(e) => {
                        setDirectorySearch(e.target.value);
                        setDirectoryOpen(true);
                      }}
                      onFocus={() => {
                        if (logic.directoryOptions.length) {
                          setDirectoryOpen(true);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && directorySearch.trim()) {
                          e.preventDefault();
                          if (logic.directoryOptions.includes(directorySearch.trim())) {
                            handleDirectorySelect(directorySearch.trim());
                          } else {
                            requestDirectoryAccess();
                          }
                        }
                      }}
                    />
                    <button
                      className="sc-directory-toggle"
                      type="button"
                      onClick={() => {
                        if (logic.directoryOptions.length) {
                          setDirectoryOpen(!directoryOpen);
                        } else {
                          requestDirectoryAccess();
                        }
                      }}
                    >
                      ▼
                    </button>
                    <button className="sc-directory-browse" type="button" onClick={requestDirectoryAccess}>
                      Request Access
                    </button>
                    {directoryOpen && logic.directoryOptions.length > 0 && (
                      <div className="sc-directory-dropdown">
                        {filteredDirectories.length === 0 && (
                          <div className="sc-directory-empty">No directories yet. Use Request Access to add.</div>
                        )}
                        {filteredDirectories.map((dir) => (
                          <div
                            key={dir}
                            className="sc-directory-item"
                            onClick={() => handleDirectorySelect(dir)}
                          >
                            {dir}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {logic.selectedDirectory && (
                    <div className="sc-directory-selected">
                      <span>Selected: {logic.selectedDirectory}</span>
                      <span className="sc-directory-status">Access granted</span>
                    </div>
                  )}
                </div>

                <div className="sc-attachment-row">
                  <div className="sc-issue-label">Attachments</div>
                  <div className="sc-attachment-actions">
                    <button className="sc-attach-btn" type="button" onClick={() => filesInputRef.current?.click()}>
                      + Files
                    </button>
                    <button className="sc-attach-btn" type="button" onClick={() => imagesInputRef.current?.click()}>
                      + Images
                    </button>
                  </div>
                  <div className="sc-attachment-chips">
                    {logic.attachedFiles.map((file) => (
                      <div key={`file-${file}`} className="sc-attachment-chip">
                        {file}
                        <button
                          className="sc-attachment-remove"
                          type="button"
                          onClick={() => logic.setAttachedFiles(prev => prev.filter(item => item !== file))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {logic.attachedImages.map((file) => (
                      <div key={`img-${file}`} className="sc-attachment-chip image">
                        {file}
                        <button
                          className="sc-attachment-remove"
                          type="button"
                          onClick={() => logic.setAttachedImages(prev => prev.filter(item => item !== file))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="sc-guided">
                <div className="sc-guided-chat">
                  <div className="sc-guided-messages">
                    {logic.guidedMessages.map((msg) => (
                      <div key={msg.id} className={`sc-guided-message ${msg.role}`}>
                        <div className="sc-guided-bubble">{msg.content}</div>
                      </div>
                    ))}
                    {logic.isDrafting && (
                      <div className="sc-guided-message assistant">
                        <div className="sc-guided-bubble">
                          <div className="sc-typing-dots">
                            <div className="sc-typing-dot"></div>
                            <div className="sc-typing-dot"></div>
                            <div className="sc-typing-dot"></div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={guidedEndRef} />
                  </div>

                  {logic.draftError && <div className="sc-error">{logic.draftError}</div>}

                  <div className="sc-guided-input-bar">
                    <input
                      className="sc-guided-input"
                      placeholder={logic.isDrafting ? 'Drafting issue...' : 'Type your answer...'}
                      value={logic.guidedInput}
                      onChange={(e) => logic.setGuidedInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          logic.submitGuidedInput();
                        }
                      }}
                      disabled={logic.isDrafting || logic.guidedComplete}
                    />
                    <button
                      className="sc-guided-send"
                      type="button"
                      onClick={logic.submitGuidedInput}
                      disabled={!logic.guidedInput.trim() || logic.isDrafting || logic.guidedComplete}
                    >
                      ➤
                    </button>
                  </div>
                </div>
              </div>

              {manualOpen && (
                <div className="sc-manual-overlay">
                  <div className="sc-manual-card">
                    <div className="sc-manual-header">
                      <span>Manual Beads Issue</span>
                      <button
                        className="sc-manual-close"
                        type="button"
                        onClick={() => {
                          logic.setTicketCreateMode('guided');
                          setManualOpen(false);
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <input
                      className="sc-input"
                      placeholder="Issue Title (e.g., Implement Login Page)"
                      value={logic.newIssueTitle}
                      onChange={e => logic.setNewIssueTitle(e.target.value)}
                    />
                    <textarea
                      className="sc-input"
                      placeholder="Detailed requirements, acceptance criteria, and context..."
                      style={{ minHeight: '160px', resize: 'vertical' }}
                      value={logic.newIssueDesc}
                      onChange={e => logic.setNewIssueDesc(e.target.value)}
                    />
                    <div className="sc-manual-actions">
                      <button
                        className="sc-btn-secondary"
                        type="button"
                        onClick={() => {
                          logic.setTicketCreateMode('guided');
                          setManualOpen(false);
                        }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="sc-issue-footer">
                <button className="sc-btn" onClick={logic.proceedToStrategy} disabled={!canProceed}>
                  {logic.guidedComplete ? 'Continue to Strategy →' : 'Next: Strategy →'}
                </button>
              </div>
            </div>
          )}

          {entryChoice === 'deploy' && (
            <div className="sc-card sc-issue-card sc-slide-up">
              <div className="sc-issue-header">
                <div>
                  <h2 className="sc-issue-title">Deploy Agents</h2>
                  <div className="sc-issue-subtitle">Select a Beads issue to deploy against</div>
                </div>
                <div className="sc-issue-actions">
                  <button className="sc-issue-pill" type="button" onClick={() => handleEntrySelect('beads')}>
                    Create New
                  </button>
                  <button
                    className="sc-issue-pill ghost"
                    type="button"
                    onClick={() => {
                      setEntryChoice(null);
                      resetEntryState();
                    }}
                  >
                    Back
                  </button>
                </div>
              </div>

              <div className="sc-dropdown-container">
                <div className="sc-select-trigger" onClick={() => setTicketDropdownOpen(!ticketDropdownOpen)}>
                  <span>{logic.registry.issues.find(i => i.id === logic.selectedIssueId)?.title || "Select an open issue..."}</span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>▼</span>
                </div>
                {ticketDropdownOpen && (
                  <div className="sc-dropdown-list">
                    {logic.registry.issues.length === 0 && <div className="sc-dropdown-item" style={{ fontStyle: 'italic', color: '#9ca3af' }}>No open issues found.</div>}
                    {logic.registry.issues.map(issue => (
                      <div
                        key={issue.id}
                        className="sc-dropdown-item"
                        onClick={() => {
                          logic.setSelectedIssueId(issue.id!);
                          setTicketDropdownOpen(false);
                        }}
                      >
                        <span style={{ color: 'var(--sc-secondary)', fontFamily: 'monospace' }}>#{issue.id?.split('-')[1]}</span>
                        <span>{issue.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="sc-issue-footer">
                <button className="sc-btn" onClick={logic.proceedToStrategy} disabled={!canProceed}>
                  Next: Strategy →
                </button>
              </div>
            </div>
          )}

          {entryChoice === 'review' && (
            <div className="sc-card sc-slide-up">
              <h2 style={{ marginTop: 0, color: 'var(--sc-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                📡 Review Runs
              </h2>
              <p style={{ color: 'var(--sc-text-dim)' }}>View active runs and audit results from the run board.</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button className="sc-btn" type="button" onClick={() => logic.setView('RUNNING')}>
                  Open Run Board →
                </button>
                <button
                  className="sc-btn-secondary"
                  type="button"
                  onClick={() => {
                    setEntryChoice(null);
                    resetEntryState();
                  }}
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: STRATEGY */}
      {logic.view === 'STRATEGY' && (
        <TransitionScreen 
            title="Analyzing Strategy"
            steps={[
                "Reading Beads Issue...",
                "Analyzing requirements context...",
                "Mapping capabilities to agent roles...",
                "Strategy defined."
            ]}
            onComplete={logic.finalizeStrategy}
        />
      )}

      {/* VIEW: DEPLOYMENT */}
      {logic.view === 'DEPLOYMENT' && (
        <div className="sc-slide-up" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
                <button onClick={() => logic.setView('TICKET')} style={{ background: 'none', border: 'none', color: 'var(--sc-text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
                <h2 style={{ margin: 0, color: 'var(--sc-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Agent Deployment</h2>
            </div>
            
            <div className="sc-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
                <p style={{ color: 'var(--sc-text-dim)', fontSize: '0.95rem', marginBottom: '20px' }}>Assemble your neural fleet.</p>

                {/* Dropdown Selector */}
                <div className="sc-dropdown-container">
                    <div className="sc-select-trigger" onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}>
                        <span style={{color: 'var(--sc-primary)'}}>+ Add Agent Model</span>
                        <span>▼</span>
                    </div>
                    {agentDropdownOpen && (
                        <div className="sc-dropdown-list">
                            {Object.entries(modelsByType).map(([type, models]) => (
                                <React.Fragment key={type}>
                                    <div className="sc-group-header">{type}</div>
                                    {models.map(model => (
                                        <div 
                                            key={model.id} 
                                            className={`sc-dropdown-item ${logic.selectedModels.includes(model.id) ? 'selected' : ''}`}
                                            onClick={() => {
                                                if (!logic.selectedModels.includes(model.id)) {
                                                    logic.setSelectedModels([...logic.selectedModels, model.id]);
                                                }
                                                setAgentDropdownOpen(false);
                                            }}
                                        >
                                            <span style={{ fontSize: '1.4rem' }}>{model.icon}</span>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 600 }}>{model.name}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--sc-text-dim)' }}>{model.provider}</span>
                                            </div>
                                            {logic.selectedModels.includes(model.id) && <span style={{ marginLeft: 'auto', color: 'var(--sc-primary)' }}>✓</span>}
                                        </div>
                                    ))}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>

                {/* Selected Agents Area */}
                <div className="sc-tags-area">
                    {logic.selectedModels.length === 0 && <div style={{ color: 'var(--sc-text-dim)', fontStyle: 'italic', padding: '10px' }}>No agents selected. Select at least one to launch.</div>}
                    {logic.selectedModels.map(modelId => {
                        const model = logic.registry.models.find(m => m.id === modelId);
                        return (
                            <div key={modelId} className="sc-tag">
                                <span>{model?.icon}</span>
                                <span>{model?.name}</span>
                                <span className="sc-tag-remove" onClick={() => logic.setSelectedModels(logic.selectedModels.filter(m => m !== modelId))}>✕</span>
                            </div>
                        );
                    })}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>{logic.selectedModels.length} Agents Ready</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--sc-text-dim)' }}>Target: {issueTitle}</div>
                        {!canLaunch && logic.ticketMode === 'new' && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--sc-text-dim)' }}>Waiting for issue draft...</div>
                        )}
                    </div>
                    <button 
                        className="sc-btn"
                        disabled={logic.selectedModels.length === 0 || !canLaunch}
                        onClick={logic.launch}
                    >
                        INITIALIZE FLEET ⚡
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* VIEW: LAUNCHING */}
      {logic.view === 'LAUNCHING' && (
        <TransitionScreen 
            title="Initializing Fleet"
            steps={[
                `Issue: ${issueTitle}`,
                "Provisioning workspace...",
                `Allocating ${logic.selectedModels.length} neural workers...`,
                <div style={{display:'flex', gap: '8px', flexWrap: 'wrap', justifyContent:'center', margin: '12px 0'}}>
                    {logic.selectedModels.map(m => {
                        const info = logic.registry.models.find(x => x.id === m);
                        return <span key={m} style={{ fontSize: '1.2rem' }}>{info?.icon}</span>
                    })}
                </div>,
                "Orchestration Active."
            ]}
            onComplete={logic.finalizeLaunch}
        />
      )}

      {/* VIEW: RUNNING (Board) */}
      {logic.view === 'RUNNING' && (
        <div className="sc-slide-up" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 style={{ margin: 0, color: 'white' }}>Fleet Operations</h2>
                    <span className="sc-badge" style={{ background: 'var(--sc-primary)', color: 'black' }}>ACTIVE</span>
                </div>
                <button className="sc-btn sc-btn-secondary" onClick={logic.reset}>+ New Ticket</button>
            </div>
            <div className="sc-kanban-layout">
                <div className="sc-kanban-issue-column">
                    <div className="sc-kanban-card issue sc-slide-up">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '1.05rem' }}>{boardIssueTitle}</strong>
                            <span className="sc-issue-preview-tag">Pinned Issue</span>
                        </div>
                        {boardIssueId && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--sc-text-dim)' }}>
                                ID: {boardIssueId}
                            </div>
                        )}
                        <div style={{ fontSize: '0.85rem', color: 'var(--sc-text-dim)' }}>
                            {boardIssueStatus}
                        </div>
                        {issuePreview ? (
                            <div className="sc-log-window">{issuePreview}</div>
                        ) : (
                            <div className="sc-kanban-empty">No details yet.</div>
                        )}
                    </div>
                </div>
                <div className="sc-kanban-grid sc-scroll-area">
                    {logic.results.length === 0 && (
                        <div className="sc-kanban-empty">No runs yet. Launch agents to populate the board.</div>
                    )}
                    {logic.results.map((result, i) => (
                        <div 
                            key={result.variantId} 
                            className="sc-kanban-card sc-slide-up"
                            style={{ animationDelay: `${i * 0.1}s` }}
                            onClick={() => logic.drillDown(result.variantId)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <strong style={{fontSize: '1.1rem'}}>{result.model}</strong>
                                <span className="sc-badge" style={{ 
                                    background: result.status === 'completed' ? '#059669' : result.status === 'failed' ? '#dc2626' : '#d97706',
                                    color: 'white'
                                }}>
                                    {result.status}
                                </span>
                            </div>
                            
                            <div className="sc-log-window">
                                 {logic.logs[result.variantId]?.slice(-3).map((l,k) => <div key={k} style={{ marginBottom: '4px' }}>{l}</div>) || <div>Initializing...</div>}
                                 {result.status === 'running' && <span style={{ color: 'var(--sc-primary)' }}>_</span>}
                            </div>
                            
                            <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--sc-primary)', fontWeight: 600, marginTop: '12px' }}>
                                View Output →
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* VIEW: REVIEW */}
      {logic.view === 'REVIEW' && selectedVariant && (
        <div className="sc-slide-up" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(0,0,0,0.3)' }}>
                <button onClick={logic.backToBoard} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.2rem', padding: '8px' }}>←</button>
                <div>
                    <h3 style={{ margin: 0 }}>Review: {selectedVariant.model}</h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--sc-text-dim)' }}>Variant ID: {selectedVariant.variantId}</div>
                </div>
                <div style={{ flex: 1 }} />
                <button className="sc-btn" onClick={() => logic.shipVariant(selectedVariant.variantId)}>Ship This Variant 🚢</button>
            </div>
            <div style={{ flex: 1, background: '#111', position: 'relative' }}>
                <iframe src={selectedVariant.previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="preview" />
            </div>
        </div>
      )}
    </div>
  );
};

export const withSuperconductorMode = (BaseComponent: React.ComponentType<any>) => {
  return (props: any) => {
    const [isSuperconductorMode, setIsSuperconductorMode] = useState(false);
    
    if (isSuperconductorMode) {
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
           <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.3)' }}>
             <button onClick={() => setIsSuperconductorMode(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>CLOSE SUPERCONDUCTOR ✕</button>
           </div>
           <div style={{ flex: 1, overflow: 'hidden' }}>
             <SuperconductorUI {...props} />
           </div>
        </div>
      );
    }
    
    return (
      <div style={{ height: '100%', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
          <button onClick={() => setIsSuperconductorMode(true)} title="Open Superconductor" style={{ background: 'linear-gradient(135deg, #00f3ff, #bd00ff)', color: 'white', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.2rem', boxShadow: '0 0 15px rgba(0, 243, 255, 0.6)' }}>⚡</button>
        </div>
        <BaseComponent {...props} />
      </div>
    );
  };
};

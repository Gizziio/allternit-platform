"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Plus, ArrowUp, ChevronDown, Check, Bot, Folder, 
  ImageIcon, Github, Globe, PenTool, Zap, FileText, 
  Sparkles, Plug, X, ChevronRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GizziMascot } from './GizziMascot';
import './InputArea.css';

// ============================================================================
// Types
// ============================================================================
interface Model {
  id: string;
  name: string;
  providerId?: string;
  providerName?: string;
}

interface Provider {
  id: string;
  name: string;
  color: string;
  description: string;
  requiresKey: boolean;
}

interface PlusMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  hasSubmenu?: boolean;
  submenuItems?: { id: string; label: string; icon?: React.ReactNode }[];
  isActive?: boolean;
}

// ============================================================================
// Theme - EXACT match to ChatComposer
// ============================================================================
const THEME = {
  bg: '#2B2520',
  inputBg: '#352F29',
  inputBorder: 'rgba(255,255,255,0.08)',
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  hoverBg: 'rgba(255,255,255,0.05)',
  menuBg: '#332D27',
  menuBorder: 'rgba(255,255,255,0.08)',
  agentGlow: 'rgba(212,149,106,0.6)',
  agentSoft: 'rgba(212,149,106,0.15)',
};

// ============================================================================
// Connector Types - With REAL App Icons
// ============================================================================
interface Connector {
  id: string;
  name: string;
  Icon: React.FC<{ size?: number }>;
  category: 'ide' | 'browser' | 'terminal' | 'productivity';
  connected: boolean;
  discovered?: boolean; // Last active surface
}

// Real SVG Icons for each app
const VSCodeIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M17.583 1.524L12.316 6.79l-4.41-3.33L4 6.79v10.42l3.906 2.33 4.41-3.33 5.267 5.266V1.524z" fill="#007ACC"/>
    <path d="M12.316 6.79l4.41 3.33v3.76l-4.41-3.33V6.79z" fill="#007ACC"/>
  </svg>
);

const CursorIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#1E1E1E"/>
    <path d="M7 17l4-10 4 10M9 14h6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChromeIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#4285F4"/>
    <circle cx="12" cy="12" r="4" fill="white"/>
    <path d="M12 8a4 4 0 013.86 3H20c-.5-4.2-4-8-8-8v4.9z" fill="#EA4335"/>
    <path d="M8.6 14.6a4 4 0 010-5.2L5.6 7C3 10 3 14 5.6 17l3-2.4z" fill="#34A853"/>
  </svg>
);

const SafariIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#00D8FF"/>
    <path d="M12 7l1.5 4.5L18 12l-4.5 1.5L12 18l-1.5-4.5L6 12l4.5-1.5L12 7z" fill="white"/>
  </svg>
);

const TerminalIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#1E1E1E"/>
    <path d="M5 7l5 5-5 5M10 17h9" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const WarpIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#1A1A2E"/>
    <circle cx="12" cy="12" r="6" fill="#7C3AED"/>
    <path d="M12 8v8M8 12h8" stroke="white" strokeWidth="2"/>
  </svg>
);

const NotionIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="black"/>
    <path d="M7 5.5l6 1.5v11l-6-1.5V5.5zM14 7l3 .5v9.5l-3-.5V7z" stroke="white" strokeWidth="1.5"/>
  </svg>
);

const GitHubIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

const FigmaIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="6" cy="6" r="4" fill="#F24E1E"/>
    <circle cx="18" cy="6" r="4" fill="#FF7262"/>
    <circle cx="6" cy="18" r="4" fill="#A259FF"/>
    <circle cx="18" cy="12" r="4" fill="#1ABCFE"/>
  </svg>
);

const SlackIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
    <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
    <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
    <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#ECB22E"/>
  </svg>
);

// Initial connectors - none are "discovered" initially
// Discovery happens via backend AppleScript/System Events detection
const AVAILABLE_CONNECTORS: Connector[] = [
  // IDEs
  { id: 'vscode', name: 'VS Code', Icon: VSCodeIcon, category: 'ide', connected: false },
  { id: 'cursor', name: 'Cursor', Icon: CursorIcon, category: 'ide', connected: false },
  // Browsers  
  { id: 'chrome', name: 'Chrome', Icon: ChromeIcon, category: 'browser', connected: false },
  { id: 'safari', name: 'Safari', Icon: SafariIcon, category: 'browser', connected: false },
  // Terminals
  { id: 'terminal', name: 'Terminal', Icon: TerminalIcon, category: 'terminal', connected: false },
  { id: 'warp', name: 'Warp', Icon: WarpIcon, category: 'terminal', connected: false },
  // Productivity
  { id: 'notion', name: 'Notion', Icon: NotionIcon, category: 'productivity', connected: false },
  { id: 'github-app', name: 'GitHub', Icon: GitHubIcon, category: 'productivity', connected: false },
  { id: 'figma', name: 'Figma', Icon: FigmaIcon, category: 'productivity', connected: false },
  { id: 'slack', name: 'Slack', Icon: SlackIcon, category: 'productivity', connected: false },
];

// ============================================================================
// Backend Integration Note:
// 
// Discovery should happen via AppleScript/System Events like ChatGPT macOS app:
// 
// tell application "System Events"
//   set frontApp to name of first application process whose frontmost is true
//   set frontWindow to name of first window of first application process whose frontmost is true
// end tell
//
// Then map frontApp to connector IDs:
// - "Terminal" -> terminal connector
// - "Code" | "Visual Studio Code" -> vscode connector  
// - "Cursor" -> cursor connector
// - etc.
//
// When a detected app matches a connector, set discovered: true
// ============================================================================

// ============================================================================
// Rotating placeholders
// ============================================================================
const PLACEHOLDER_HINTS = [
  "Connect to VS Code to edit code directly...",
  "Link your browser to capture screenshots...",
  "Use @github to reference repositories...",
  "Ask me to refactor this code...",
  "Connect to Terminal to run commands...",
  "Use Agent mode for autonomous tasks...",
];

// ============================================================================
// Plus Menu Items - EXACT from ChatComposer
// ============================================================================
const PLUS_MENU_ITEMS: PlusMenuItem[] = [
  { id: 'files', label: 'Add files or photos', icon: <ImageIcon size={16} /> },
  {
    id: 'project',
    label: 'Add to project',
    icon: <Folder size={16} />,
    hasSubmenu: true,
    submenuItems: [
      { id: 'new-project', label: 'Start a new project', icon: <Plus size={14} /> },
      { id: 'existing-project', label: 'How to use A2R', icon: <FileText size={14} /> },
    ]
  },
  { id: 'github', label: 'Add from GitHub', icon: <Github size={16} /> },
  { id: 'web', label: 'Web search', icon: <Globe size={16} />, isActive: true },
  {
    id: 'style',
    label: 'Use style',
    icon: <PenTool size={16} />,
    hasSubmenu: true,
    submenuItems: [
      { id: 'formal', label: 'Formal' },
      { id: 'creative', label: 'Creative' },
      { id: 'technical', label: 'Technical' },
    ]
  },
  { id: 'connectors', label: 'Add connectors', icon: <Zap size={16} /> },
];

// ============================================================================
// ALL Providers - EXACT from ChatComposer
// ============================================================================
const AVAILABLE_PROVIDERS: Provider[] = [
  { id: 'openai', name: 'OpenAI', color: '#10a37f', description: 'GPT 5.4, 5.3, 5.2', requiresKey: true },
  { id: 'anthropic', name: 'Anthropic', color: '#d97757', description: 'Claude 4.6, 4.5 Opus', requiresKey: true },
  { id: 'gemini', name: 'Google Gemini', color: '#4285f4', description: 'Gemini 3.1, 3.0 Pro', requiresKey: true },
  { id: 'xai', name: 'xAI', color: '#000000', description: 'Grok 3, Grok 2', requiresKey: true },
  { id: 'azure', name: 'Azure OpenAI', color: '#0078d4', description: 'Microsoft Azure AI models', requiresKey: true },
  { id: 'aws', name: 'AWS Bedrock', color: '#ff9900', description: 'Amazon Bedrock models', requiresKey: true },
  { id: 'github', name: 'GitHub Copilot', color: '#6e40c9', description: 'GitHub AI models', requiresKey: false },
  { id: 'mistral', name: 'Mistral AI', color: '#ff7000', description: 'Mistral Large, Medium, Small', requiresKey: true },
  { id: 'openrouter', name: 'OpenRouter', color: '#ef4444', description: '100+ models unified API', requiresKey: true },
  { id: 'perplexity', name: 'Perplexity', color: '#20b8cd', description: 'Sonar search + LLM', requiresKey: true },
  { id: 'deepseek', name: 'DeepSeek', color: '#4f46e5', description: 'V3, R1, Coder', requiresKey: true },
  { id: 'cohere', name: 'Cohere', color: '#d4a574', description: 'Command R+, Embed', requiresKey: true },
  { id: 'qwen', name: 'Alibaba Qwen', color: '#ff6a00', description: 'Qwen 3.5 (397B MoE)', requiresKey: true },
  { id: 'kimi', name: 'Moonshot Kimi', color: '#6b4c9a', description: 'Kimi 2.5 Agent Swarm', requiresKey: true },
  { id: 'glm', name: 'Zhipu GLM', color: '#1a1a1a', description: 'GLM-5 (745B MoE)', requiresKey: true },
  { id: 'opencode', name: 'OpenCode', color: '#6366f1', description: 'Zen models via ACP', requiresKey: false },
  { id: 'gizzi', name: 'Gizzi Runtime', color: '#d4966a', description: 'Managed model runtime', requiresKey: false },
  { id: 'local', name: 'Local Models', color: '#10b981', description: 'Ollama, LM Studio, llama.cpp', requiresKey: false },
];

// ============================================================================
// Provider Logos - EXACT SVGs from ChatComposer
// ============================================================================
const ProviderLogos: Record<string, React.FC<{ size?: number }>> = {
  'anthropic': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M17.304 3.541h-3.672l6.696 16.918h3.672zm-10.608 0L0 20.459h3.744l1.368-3.6h6.696l1.368 3.6h3.744L10.416 3.541H6.696zm-.264 10.656 2.088-5.472 2.088 5.472z" fill="#D97757"/>
    </svg>
  ),
  'openai': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="openaiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10a37f"/>
          <stop offset="100%" stopColor="#0d8c6d"/>
        </linearGradient>
      </defs>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494z" fill="url(#openaiGrad)"/>
    </svg>
  ),
  'gemini': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="geminiGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4"/>
          <stop offset="50%" stopColor="#9B72CB"/>
          <stop offset="100%" stopColor="#EA4335"/>
        </linearGradient>
      </defs>
      <path d="M12 2L14.5 9.5H22.5L16 14.5L18.5 22L12 17L5.5 22L8 14.5L1.5 9.5H9.5L12 2Z" fill="url(#geminiGrad1)"/>
    </svg>
  ),
  'xai': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#FFFFFF"/>
    </svg>
  ),
  'github': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" fill="#FFFFFF"/>
    </svg>
  ),
  'azure': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5.483 21.3H24L14.025 4.013l-3.038 8.347 5.836 6.938L5.483 21.3zM13.23 2.7L6.105 8.677 0 19.253h5.505l7.848-13.735z" fill="#0078D4"/>
    </svg>
  ),
  'aws': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.863.279a2.01 2.01 0 0 1-.28.103.49.49 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.28-.144.617-.264 1.013-.36.4-.096.823-.143 1.274-.143.97 0 1.677.223 2.13.662.447.44.67 1.104.67 1.996v2.638zm-3.063.96c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.048-.191.08-.423.08-.694v-.335c-.232-.056-.479-.104-.743-.136a6.54 6.54 0 0 0-.766-.048c-.55 0-.95.104-1.22.32-.271.215-.4.518-.4.919 0 .375.095.655.295.846.191.2.47.296.842.296z" fill="#FF9900"/>
    </svg>
  ),
  'mistral': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2 3h3.5l3.5 8.5L12.5 3H17l-3 18h-3L11 13l-2.5 8H5.5L2 3z" fill="#FF7000"/>
      <path d="M13 3h3l3 18h-3l-1.5-9-1.5 9h-3L13 3z" fill="#FF7000" opacity="0.7"/>
    </svg>
  ),
  'openrouter': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="5" r="3" fill="#EF4444"/>
      <circle cx="5" cy="19" r="3" fill="#EF4444"/>
      <circle cx="19" cy="19" r="3" fill="#EF4444"/>
      <path d="M12 8L5 19M12 8L19 19" stroke="#EF4444" strokeWidth="2"/>
    </svg>
  ),
  'perplexity': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="10" cy="10" r="7" stroke="#20b8cd" strokeWidth="2" fill="none"/>
      <path d="M15.5 15.5L21 21" stroke="#20b8cd" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="10" cy="10" r="3" fill="#20b8cd"/>
    </svg>
  ),
  'deepseek': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#4F46E5" strokeWidth="2" fill="none"/>
      <path d="M11 7h2v6h-2zm0 8h2v2h-2z" fill="#4F46E5"/>
    </svg>
  ),
  'cohere': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#d4a574" strokeWidth="2" fill="none"/>
      <circle cx="12" cy="12" r="6" stroke="#d4a574" strokeWidth="2" fill="none"/>
      <circle cx="12" cy="12" r="2" fill="#d4a574"/>
    </svg>
  ),
  'qwen': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#ff6a00" strokeWidth="2.5" fill="none"/>
      <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5c.9 0 1.74-.24 2.47-.66l2.12 2.12 1.41-1.41-2.12-2.12A4.98 4.98 0 0 0 17 12c0-2.76-2.24-5-5-5z" fill="#ff6a00"/>
    </svg>
  ),
  'kimi': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="2" fill="none"/>
      <path d="M8 7v10l4-5 4 5V7" stroke="#8B5CF6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'glm': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="#1E40AF" strokeWidth="2" fill="none"/>
      <path d="M8 12h4c1.1 0 2-.9 2-2s-.9-2-2-2H8v8h2v-4z" fill="#1E40AF"/>
    </svg>
  ),
  'opencode': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="2" fill="#6366F1"/>
    </svg>
  ),
  'gizzi': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5" stroke="#d4966a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M2 12l10 5 10-5" stroke="#d4966a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  'local': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="#10b981" strokeWidth="2" fill="none"/>
      <rect x="9" y="9" width="6" height="6" fill="#10b981"/>
    </svg>
  ),
};

function getProviderLogo(providerId: string): React.FC<{ size?: number }> {
  return ProviderLogos[providerId] || ProviderLogos['gizzi'];
}

// ============================================================================
// Mock Models - would come from gizzi-code server
// ============================================================================
const MOCK_MODELS: Model[] = [
  { id: 'kimi/kimi-for-coding', name: 'Kimi K2.5', providerId: 'kimi', providerName: 'Moonshot' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', providerId: 'openai', providerName: 'OpenAI' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', providerId: 'openai', providerName: 'OpenAI' },
  { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', providerId: 'anthropic', providerName: 'Anthropic' },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', providerId: 'anthropic', providerName: 'Anthropic' },
  { id: 'gemini/gemini-1-5-pro', name: 'Gemini 1.5 Pro', providerId: 'gemini', providerName: 'Google' },
];

// ============================================================================
// Interface
// ============================================================================
interface InputAreaProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
  isCompact?: boolean;
}

// ============================================
// Model Selector Dropdown - EXACT from ChatComposer
// ============================================
function ModelSelectorDropdown({
  models,
  selectedModel,
  onSelect,
  onClose,
  onBrowseAllModels,
  onOpenProviderConnect,
}: {
  models: Model[];
  selectedModel: string;
  onSelect: (model: Model) => void;
  onClose: () => void;
  onBrowseAllModels?: () => void;
  onOpenProviderConnect?: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchInputRef.current?.focus(); }, []);

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const query = searchQuery.toLowerCase();
    return models.filter(model =>
      model.name?.toLowerCase().includes(query) ||
      model.id?.toLowerCase().includes(query) ||
      model.providerName?.toLowerCase().includes(query)
    );
  }, [models, searchQuery]);

  const groupedModels = useMemo(() => {
    const groups: Record<string, Model[]> = {};
    filteredModels.forEach(model => {
      const provider = model.providerName || 'Other';
      if (!groups[provider]) groups[provider] = [];
      groups[provider].push(model);
    });
    return groups;
  }, [filteredModels]);

  const sortedProviders = useMemo(() => {
    return Object.keys(groupedModels).sort((a, b) => a.localeCompare(b));
  }, [groupedModels]);

  return (
    <>
      <div className="model-dropdown-overlay" onClick={onClose} />
      <div className="model-dropdown">
        {/* Header with Search */}
        <div className="model-dropdown-header">
          <div className="model-dropdown-title">
            <span className="model-dropdown-label">Models</span>
            <span className="model-dropdown-count">{filteredModels.length} / {models.length}</span>
          </div>
          <div className="model-search-box">
            <Globe size={14} color={THEME.textMuted} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="model-search-clear">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Models List */}
        <div className="model-dropdown-list">
          {filteredModels.length === 0 ? (
            <div className="model-dropdown-empty">No models found</div>
          ) : (
            sortedProviders.map(provider => (
              <div key={provider}>
                <div className="model-provider-header">{provider}</div>
                {groupedModels[provider].map((model) => (
                  <button
                    key={model.id}
                    onClick={() => { onSelect(model); onClose(); }}
                    className={`model-item ${selectedModel === model.id ? 'active' : ''}`}
                  >
                    <span className="model-item-name">{model.name}</span>
                    {selectedModel === model.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="model-dropdown-footer">
          <button onClick={() => { onClose(); onBrowseAllModels?.(); }} className="model-footer-btn">
            <Sparkles size={14} />
            Browse all models...
          </button>
          <button onClick={() => { onClose(); onOpenProviderConnect?.(); }} className="model-footer-btn">
            <Plug size={14} />
            Connect provider
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================
// Browse All Models Overlay - EXACT from ChatComposer
// ============================================
function BrowseAllModelsOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [providerModels, setProviderModels] = useState<Array<{id: string; name: string}>>([]);

  // Simulate fetching models for selected provider
  useEffect(() => {
    if (!selectedProvider) return;
    setLoading(true);
    // Mock fetch - would connect to gizzi-code server
    setTimeout(() => {
      const mockModels = [
        { id: 'model-1', name: 'Model One' },
        { id: 'model-2', name: 'Model Two' },
        { id: 'model-3', name: 'Model Three' },
      ];
      setProviderModels(mockModels);
      setLoading(false);
    }, 500);
  }, [selectedProvider]);

  if (!isOpen) return null;

  const handleProviderClick = (providerId: string) => {
    setSelectedProvider(providerId);
  };

  const handleBack = () => {
    setSelectedProvider(null);
    setProviderModels([]);
  };

  const selectedProviderData = AVAILABLE_PROVIDERS.find(p => p.id === selectedProvider);

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-content overlay-browse-models" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="overlay-header">
          {!selectedProvider ? (
            <div>
              <h2>Browse All Models</h2>
              <p>Select a provider to see available models</p>
            </div>
          ) : (
            <div className="overlay-header-with-back">
              <button onClick={handleBack} className="overlay-back-btn">
                <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <div>
                <h2>{selectedProviderData?.name}</h2>
                <p>{providerModels.length} models available</p>
              </div>
            </div>
          )}
          <button onClick={onClose} className="overlay-close">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overlay-body">
          {!selectedProvider ? (
            /* Provider Grid */
            <div className="overlay-providers-grid">
              {AVAILABLE_PROVIDERS.map(provider => {
                const ProviderLogo = getProviderLogo(provider.id);
                return (
                  <button
                    key={provider.id}
                    onClick={() => handleProviderClick(provider.id)}
                    className="overlay-provider-card"
                    style={{ borderColor: 'transparent' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = provider.color;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                    }}
                  >
                    <div className="overlay-provider-logo">
                      <ProviderLogo size={32} />
                    </div>
                    <div className="overlay-provider-info">
                      <span className="overlay-provider-name">{provider.name}</span>
                      <span className="overlay-provider-desc">{provider.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Models List for Selected Provider */
            <div className="overlay-models-list">
              {loading ? (
                <div className="overlay-loading">Loading models...</div>
              ) : (
                providerModels.map(model => (
                  <button key={model.id} className="overlay-model-item">
                    <span>{model.name}</span>
                    <Check size={16} />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Connect Provider Overlay - EXACT from ChatComposer
// ============================================
function ConnectProviderOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<string[]>(['gizzi']);

  if (!isOpen) return null;

  const handleConnect = async () => {
    if (!selectedProvider) return;
    setIsConnecting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setConnectedProviders(prev => [...prev, selectedProvider]);
    setIsConnecting(false);
    setSelectedProvider(null);
    setApiKey('');
  };

  const handleDisconnect = (providerId: string) => {
    setConnectedProviders(prev => prev.filter(id => id !== providerId));
  };

  const selectedProviderData = AVAILABLE_PROVIDERS.find(p => p.id === selectedProvider);

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-content overlay-connect" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="overlay-header">
          <div>
            <h2>Connect AI Provider</h2>
            <p>Add your API keys to unlock more AI models</p>
          </div>
          <button onClick={onClose} className="overlay-close">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overlay-body">
          {selectedProvider ? (
            /* Provider Connect Form */
            <div className="overlay-connect-form">
              <button onClick={() => setSelectedProvider(null)} className="overlay-back-link">
                <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                Back to providers
              </button>

              <div className="overlay-selected-provider">
                <div className="overlay-provider-logo-large">
                  {selectedProviderData && React.createElement(getProviderLogo(selectedProviderData.id), { size: 40 })}
                </div>
                <div>
                  <h3>{selectedProviderData?.name}</h3>
                  <p>{selectedProviderData?.description}</p>
                </div>
              </div>

              {selectedProviderData?.requiresKey ? (
                <div className="overlay-api-key-section">
                  <label>API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Enter your ${selectedProviderData.name} API key`}
                  />
                </div>
              ) : (
                <div className="overlay-auto-connect">
                  <Check size={16} />
                  This provider connects automatically. Click connect to enable.
                </div>
              )}
            </div>
          ) : (
            /* Provider List */
            <div className="overlay-providers-sections">
              {/* Connected Providers */}
              {connectedProviders.length > 0 && (
                <div className="overlay-connected-section">
                  <h4>Connected</h4>
                  <div className="overlay-connected-list">
                    {connectedProviders.map(providerId => {
                      const provider = AVAILABLE_PROVIDERS.find(p => p.id === providerId);
                      if (!provider) return null;
                      const ProviderLogo = getProviderLogo(providerId);
                      return (
                        <div key={providerId} className="overlay-connected-item">
                          <div className="overlay-connected-logo">
                            <ProviderLogo size={24} />
                          </div>
                          <div className="overlay-connected-info">
                            <span>{provider.name}</span>
                            <span className="overlay-connected-status">Connected</span>
                          </div>
                          <button 
                            onClick={() => handleDisconnect(providerId)}
                            className="overlay-disconnect-btn"
                          >
                            Disconnect
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Available Providers */}
              <div className="overlay-available-section">
                <h4>Available Providers</h4>
                <div className="overlay-available-grid">
                  {AVAILABLE_PROVIDERS
                    .filter(p => !connectedProviders.includes(p.id))
                    .map(provider => {
                      const ProviderLogo = getProviderLogo(provider.id);
                      return (
                        <button
                          key={provider.id}
                          onClick={() => setSelectedProvider(provider.id)}
                          className="overlay-available-item"
                          style={{ borderColor: 'transparent' }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.borderColor = provider.color;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                          }}
                        >
                          <div className="overlay-provider-logo">
                            <ProviderLogo size={28} />
                          </div>
                          <div className="overlay-provider-info">
                            <span className="overlay-provider-name">{provider.name}</span>
                            <span className="overlay-provider-desc">{provider.description}</span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedProvider && (
          <div className="overlay-footer">
            <button onClick={() => setSelectedProvider(null)} className="overlay-cancel-btn">
              Cancel
            </button>
            <button
              onClick={handleConnect}
              disabled={selectedProviderData?.requiresKey && !apiKey || isConnecting}
              className="overlay-connect-btn"
            >
              {isConnecting ? 'Connecting...' : <><Check size={16} /> Connect</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Main InputArea Component
// ============================================
// ============================================
// Connector Bar - Extends input, shows discovered + connected
// ============================================
function ConnectorBar({ 
  connectors, 
  onToggleConnector,
  onOpenOverlay,
  onDetectApps,
  isDetecting
}: { 
  connectors: Connector[];
  onToggleConnector: (id: string) => void;
  onOpenOverlay: () => void;
  onDetectApps?: () => void;
  isDetecting?: boolean;
}) {
  const connectedConnectors = connectors.filter(c => c.connected);
  const discoveredConnectors = connectors.filter(c => c.discovered && !c.connected);
  const hasContent = connectedConnectors.length > 0 || discoveredConnectors.length > 0;

  return (
    <div className={`connector-bar ${hasContent ? 'has-content' : ''}`}>
      {/* Discovered Apps (last active surfaces) */}
      <AnimatePresence>
        {discoveredConnectors.map((connector) => (
          <motion.div
            key={connector.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="connector-discovery"
            title="Detected as frontmost app"
          >
            <span className="connector-discovery-text">Add {connector.name}</span>
            <button 
              className="connector-add-btn"
              onClick={() => onToggleConnector(connector.id)}
            >
              <Plus size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Connected Apps */}
      <AnimatePresence>
        {connectedConnectors.map((connector) => (
          <motion.button
            key={connector.id}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="connector-chip"
            onClick={() => onToggleConnector(connector.id)}
          >
            <connector.Icon size={16} />
            <span>{connector.name}</span>
            <X size={12} className="connector-remove" />
          </motion.button>
        ))}
      </AnimatePresence>

      {/* Detect Frontmost App Button */}
      {onDetectApps && discoveredConnectors.length === 0 && (
        <button 
          className="connector-simulate-btn" 
          onClick={onDetectApps} 
          disabled={isDetecting}
          title="Detect frontmost app for contextual assistance"
        >
          {isDetecting ? (
            <>
              <span className="detecting-spinner" />
              <span>Detecting...</span>
            </>
          ) : (
            <>
              <Zap size={12} />
              <span>Detect Frontmost App</span>
            </>
          )}
        </button>
      )}

      {/* More button */}
      <button className="connector-more-btn" onClick={onOpenOverlay} title="Browse all apps">
        <Zap size={14} />
      </button>
    </div>
  );
}

// ============================================
// Connector Overlay - Full connector management
// ============================================
function ConnectorOverlay({ 
  isOpen, 
  onClose, 
  connectors,
  onToggleConnector 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  connectors: Connector[];
  onToggleConnector: (id: string) => void;
}) {
  if (!isOpen) return null;

  const categories = [
    { id: 'ide', label: 'IDEs & Editors' },
    { id: 'browser', label: 'Browsers' },
    { id: 'terminal', label: 'Terminals' },
    { id: 'productivity', label: 'Productivity' },
  ];

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-content connector-overlay-panel" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <h2>Connect Apps</h2>
          <p>Link external tools to enable contextual assistance</p>
          <button onClick={onClose} className="overlay-close">
            <X size={20} />
          </button>
        </div>
        
        <div className="overlay-body">
          {categories.map(category => {
            const categoryConnectors = connectors.filter(c => c.category === category.id);
            if (categoryConnectors.length === 0) return null;
            
            return (
              <div key={category.id} className="connector-category">
                <h4>{category.label}</h4>
                <div className="connector-grid">
                  {categoryConnectors.map(connector => (
                    <button
                      key={connector.id}
                      className={`connector-item ${connector.connected ? 'connected' : ''}`}
                      onClick={() => onToggleConnector(connector.id)}
                    >
                      <div className="connector-icon">
                        <connector.Icon size={28} />
                      </div>
                      <span className="connector-name">{connector.name}</span>
                      <span className={`connector-status ${connector.connected ? 'on' : ''}`}>
                        {connector.connected ? 'Connected' : 'Connect'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Custom Connector Section */}
          <div className="connector-category custom-connector-section">
            <h4>Custom</h4>
            <button className="custom-connector-btn" onClick={() => alert('Custom connector: Would open file picker or URL input')}> 
              <Plus size={24} />
              <span>Add Custom App</span>
              <span className="custom-connector-desc">Connect an app not listed</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const InputArea: React.FC<InputAreaProps> = ({ 
  onSend, 
  isStreaming, 
  disabled = false,
}) => {
  const [input, setInput] = useState("");
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model>(MOCK_MODELS[0]);
  const [showBrowseAllModels, setShowBrowseAllModels] = useState(false);
  const [showProviderConnect, setShowProviderConnect] = useState(false);
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [connectors, setConnectors] = useState<Connector[]>(AVAILABLE_CONNECTORS);
  const [showConnectorOverlay, setShowConnectorOverlay] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleToggleConnector = (id: string) => {
    setConnectors(prev => prev.map(c => 
      c.id === id ? { ...c, connected: !c.connected, discovered: false } : c
    ));
  };

  // App Discovery - Connected to A2R Computer Use backend
  const [isDetecting, setIsDetecting] = useState(false);
  
  // Detect apps via Electron IPC (which calls A2R backend)
  const handleDetectApps = async () => {
    setIsDetecting(true);
    try {
      const discoveredApps = await window.thinClient?.getDiscoveredApps?.() || [];
      
      if (discoveredApps.length > 0) {
        // First app is frontmost
        const frontmost = discoveredApps[0];
        
        // Update connector states based on running apps
        setConnectors(prev => prev.map(c => {
          const isFrontmost = frontmost.id === c.id;
          
          return isFrontmost && !c.connected ? { ...c, discovered: true } :
                 (!isFrontmost && c.discovered) ? { ...c, discovered: false } : c;
        }));
      }
    } catch (error) {
      console.error('Failed to detect apps:', error);
    } finally {
      setIsDetecting(false);
    }
  };
  
  // Listen for real-time updates from main process
  useEffect(() => {
    if (!window.thinClient?.onDiscoveredApps) return;
    
    window.thinClient.onDiscoveredApps((apps: any[]) => {
      if (apps.length > 0) {
        const frontmost = apps[0];
        
        setConnectors(prev => prev.map(c => {
          const isFrontmost = frontmost.id === c.id;
          return isFrontmost && !c.connected ? { ...c, discovered: true } :
                 (!isFrontmost && c.discovered) ? { ...c, discovered: false } : c;
        }));
      }
    });
  }, []);
  
  // Auto-detect on mount
  useEffect(() => {
    handleDetectApps();
  }, []);
  
  // Rotate hints every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % PLACEHOLDER_HINTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.max(24, Math.min(textareaRef.current.scrollHeight, 100));
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);
  
  const handleSend = () => {
    if (!input.trim() || isStreaming || disabled) return;
    onSend(input);
    setInput("");
  };

  const canSubmit = input.trim().length > 0 && !isStreaming && !disabled;
  
  return (
    <div className="chat-composer-wrapper">
      {/* Overlays */}
      <BrowseAllModelsOverlay 
        isOpen={showBrowseAllModels} 
        onClose={() => setShowBrowseAllModels(false)} 
      />
      <ConnectProviderOverlay 
        isOpen={showProviderConnect} 
        onClose={() => setShowProviderConnect(false)} 
      />

      {/* Gizzi Mascot */}
      <AnimatePresence>
        {agentEnabled && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            className="gizzi-above-container"
          >
            <GizziMascot size={78} emotion="pleased" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connector Overlay */}
      <ConnectorOverlay
        isOpen={showConnectorOverlay}
        onClose={() => setShowConnectorOverlay(false)}
        connectors={connectors}
        onToggleConnector={handleToggleConnector}
      />

      {/* Main Input Container with Connector Bar */}
      <div className={`input-composer-container ${agentEnabled ? 'agent-active' : ''}`}>
        {agentEnabled && <div className="agent-glow-overlay" />}

        {/* Connector Bar - Inside input container */}
        <ConnectorBar
          connectors={connectors}
          onToggleConnector={handleToggleConnector}
          onOpenOverlay={() => setShowConnectorOverlay(true)}
          onDetectApps={handleDetectApps}
          isDetecting={isDetecting}
        />

        {/* Top Row */}
        <div className="composer-top-row">
          {/* Plus Button with Full Menu */}
          <div className="plus-menu-container">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                setShowPlusMenu(!showPlusMenu);
                setActiveSubMenu(null);
              }}
              className="composer-btn plus-btn"
              style={{ transform: showPlusMenu ? 'rotate(45deg)' : 'none' }}
            >
              <Plus size={20} />
            </motion.button>
            
            <AnimatePresence>
              {showPlusMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="composer-menu plus-menu"
                  onMouseLeave={() => { if (!activeSubMenu) setShowPlusMenu(false); }}
                >
                  {PLUS_MENU_ITEMS.map((item) => (
                    <div key={item.id} className="plus-menu-item-wrapper">
                      <button
                        className="menu-item"
                        onMouseEnter={() => { if (item.hasSubmenu) setActiveSubMenu(item.id); else setActiveSubMenu(null); }}
                        onClick={() => { if (!item.hasSubmenu) setShowPlusMenu(false); }}
                      >
                        <span className="menu-item-icon">{item.icon}</span>
                        <span className="menu-item-label">{item.label}</span>
                        {item.hasSubmenu && <ChevronRight size={14} className="menu-item-chevron" />}
                        {item.isActive && !item.hasSubmenu && <Check size={14} className="menu-item-check" />}
                      </button>

                      {activeSubMenu === item.id && item.submenuItems && (
                        <div className="submenu">
                          {item.submenuItems.map((sub) => (
                            <button key={sub.id} className="submenu-item">
                              {sub.icon && <span className="submenu-icon">{sub.icon}</span>}
                              <span>{sub.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={PLACEHOLDER_HINTS[hintIndex]}
            disabled={isStreaming || disabled}
            rows={1}
            className="composer-textarea"
          />

          {/* Model Selector */}
          <div className="model-selector-container">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.stopPropagation();
                setShowModelMenu(!showModelMenu);
              }}
              className="model-badge"
            >
              <span 
                className="model-dot" 
                style={{ 
                  background: AVAILABLE_PROVIDERS.find(p => p.id === selectedModel.providerId)?.color || '#888'
                }}
              />
              <span className="model-name-short">{selectedModel.name}</span>
              <ChevronDown 
                size={14} 
                style={{ transform: showModelMenu ? 'rotate(180deg)' : 'none' }} 
              />
            </motion.button>

            {showModelMenu && (
              <ModelSelectorDropdown
                models={MOCK_MODELS}
                selectedModel={selectedModel.id}
                onSelect={setSelectedModel}
                onClose={() => setShowModelMenu(false)}
                onBrowseAllModels={() => setShowBrowseAllModels(true)}
                onOpenProviderConnect={() => setShowProviderConnect(true)}
              />
            )}
          </div>

          {/* Send Button */}
          <motion.button
            whileHover={canSubmit ? { scale: 1.05 } : {}}
            whileTap={canSubmit ? { scale: 0.95 } : {}}
            onClick={handleSend}
            disabled={!canSubmit}
            className={`send-btn ${canSubmit ? 'active' : ''}`}
          >
            <ArrowUp size={20} />
          </motion.button>
        </div>

        {/* Bottom Row */}
        <div className="composer-bottom-row">
          <div className="composer-tools">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setAgentEnabled(!agentEnabled)}
              className={`agent-toggle-button ${agentEnabled ? 'active' : ''}`}
            >
              <Bot size={14} />
              <span>Agent {agentEnabled ? 'On' : 'Off'}</span>
            </motion.button>
          </div>
          <span className="composer-discretion">
            A2R can make mistakes. Check important info.
          </span>
        </div>
      </div>
    </div>
  );
};

export default InputArea;

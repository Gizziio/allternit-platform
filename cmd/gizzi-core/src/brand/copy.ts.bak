/**
 * GIZZI Copy Strings
 * 
 * All user-facing strings for GIZZI Code.
 * Centralized for easy localization and brand consistency.
 */

import { GIZZIBrand } from "./meta"

export const GIZZICopy = {
  // Header / Navigation
  header: {
    subagentSession: "Subagent session",
    parent: "Parent",
    previous: "Prev",
    next: "Next",
    productName: GIZZIBrand.product,
  },

  // Sidebar
  sidebar: {
    contextPack: "Context Pack",
    runtime: "LSP Runtime",
    adapters: "Adapters",
    workItems: "Work Items",
    workspaceDelta: "Workspace Delta",
    tokens: "tokens",
    used: "used",
    spent: "spent",
    connected: "Connected",
    disabled: "Disabled",
    needsAuth: "Needs auth",
    needsClientID: "Needs client ID",
    failed: "Failed",
    unknown: "Unknown",
    runtimeDisabled: "LSP runtime adapters are disabled in settings",
    runtimeActivate: "LSP runtime adapters activate as files are read",
    onboardingTitle: "Kernel ready",
    onboardingBodyPrimary: `${GIZZIBrand.product} includes free models so you can start immediately.`,
    onboardingBodySecondary: "Connect from 75+ providers to use Claude, GPT, Gemini, and more.",
    connectProviders: "Connect providers",
  },

  // Footer / Status
  footer: {
    boot: "Boot kernel",
    runtime: "LSP",
    adapters: "Adapters",
    ready: "Ready",
  },

  // Prompt / Input
  prompt: {
    variants: "profiles",
    agents: "runtimes",
    commands: "ops",
    shellExit: "exit shell mode",
    connectProviderToSend: "Connect a provider to send prompts",
    categoryPrompt: "Prompt",
    categorySession: "Session",
    clearPrompt: "Clear prompt",
    submitPrompt: "Submit prompt",
    paste: "Paste",
    interruptSession: "Interrupt session",
    openEditor: "Open editor",
    skills: "Skills",
  },

  // Commands
  commands: {
    // Workspace
    workspaceInit: "/workspace init",
    workspaceInitDesc: "Initialize .gizzi/ workspace",
    
    // Continuity
    handoff: "/handoff",
    handoffDesc: "Create session handoff bundle",
    importContext: "/import-context",
    importContextDesc: "Import context from another tool",
    
    // Verification
    verify: "/verify",
    verifyDesc: "Run verification on current work",
    
    // Session tree
    tree: "/tree",
    treeDesc: "View session tree",
    parent: "/parent",
    parentDesc: "Navigate to parent session",
    
    // Worktree
    worktree: "/worktree",
    worktreeDesc: "Manage git worktrees",
  },

  // Errors
  errors: {
    noWorkspace: "No .gizzi/ workspace found. Run '/workspace init' first.",
    verificationFailed: "Verification failed. Check the output for details.",
  },

  // Success messages
  success: {
    workspaceCreated: "Workspace created at .gizzi/",
    verificationPassed: "All verifications passed! ✓",
  },
} as const

export type GIZZICopy = typeof GIZZICopy

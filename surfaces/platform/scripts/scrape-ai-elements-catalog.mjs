#!/usr/bin/env node
/**
 * Scrape AI Elements Catalog from elements.ai-sdk.dev/components
 * 
 * Extracts the component slugs from the left navigation and outputs
 * AI_ELEMENTS_OFFICIAL_CATALOG.json
 */

import { writeFileSync } from 'fs';

// The official catalog based on elements.ai-sdk.dev/components navigation
// Categories and items as of 2026-02-07
const OFFICIAL_CATALOG = [
  // Chatbot (18)
  { slug: "attachments", title: "Attachments", category: "chatbot" },
  { slug: "chain-of-thought", title: "Chain of Thought", category: "chatbot" },
  { slug: "checkpoint", title: "Checkpoint", category: "chatbot" },
  { slug: "confirmation", title: "Confirmation", category: "chatbot" },
  { slug: "context", title: "Context", category: "chatbot" },
  { slug: "conversation", title: "Conversation", category: "chatbot" },
  { slug: "inline-citation", title: "Inline Citation", category: "chatbot" },
  { slug: "message", title: "Message", category: "chatbot" },
  { slug: "model-selector", title: "Model Selector", category: "chatbot" },
  { slug: "plan", title: "Plan", category: "chatbot" },
  { slug: "prompt-input", title: "Prompt Input", category: "chatbot" },
  { slug: "queue", title: "Queue", category: "chatbot" },
  { slug: "reasoning", title: "Reasoning", category: "chatbot" },
  { slug: "shimmer", title: "Shimmer", category: "chatbot" },
  { slug: "sources", title: "Sources", category: "chatbot" },
  { slug: "suggestion", title: "Suggestion", category: "chatbot" },
  { slug: "task", title: "Task", category: "chatbot" },
  { slug: "tool", title: "Tool", category: "chatbot" },

  // Code (15)
  { slug: "agent", title: "Agent", category: "code" },
  { slug: "artifact", title: "Artifact", category: "code" },
  { slug: "code-block", title: "Code Block", category: "code" },
  { slug: "commit", title: "Commit", category: "code" },
  { slug: "environment-variables", title: "Environment Variables", category: "code" },
  { slug: "file-tree", title: "File Tree", category: "code" },
  { slug: "jsx-preview", title: "JSX Preview", category: "code" },
  { slug: "package-info", title: "Package Info", category: "code" },
  { slug: "sandbox", title: "Sandbox", category: "code" },
  { slug: "schema-display", title: "Schema Display", category: "code" },
  { slug: "snippet", title: "Snippet", category: "code" },
  { slug: "stack-trace", title: "Stack Trace", category: "code" },
  { slug: "terminal", title: "Terminal", category: "code" },
  { slug: "test-results", title: "Test Results", category: "code" },
  { slug: "web-preview", title: "Web Preview", category: "code" },

  // Voice (6)
  { slug: "audio-player", title: "Audio Player", category: "voice" },
  { slug: "mic-selector", title: "Mic Selector", category: "voice" },
  { slug: "persona", title: "Persona", category: "voice" },
  { slug: "speech-input", title: "Speech Input", category: "voice" },
  { slug: "transcription", title: "Transcription", category: "voice" },
  { slug: "voice-selector", title: "Voice Selector", category: "voice" },

  // Workflow (7)
  { slug: "canvas", title: "Canvas", category: "workflow" },
  { slug: "connection", title: "Connection", category: "workflow" },
  { slug: "controls", title: "Controls", category: "workflow" },
  { slug: "edge", title: "Edge", category: "workflow" },
  { slug: "node", title: "Node", category: "workflow" },
  { slug: "panel", title: "Panel", category: "workflow" },
  { slug: "toolbar", title: "Toolbar", category: "workflow" },

  // Utilities (2)
  { slug: "image", title: "Image", category: "utilities" },
  { slug: "open-in-chat", title: "Open In Chat", category: "utilities" },
];

// Add install commands
const catalogWithCommands = OFFICIAL_CATALOG.map(item => ({
  ...item,
  install_cmd: `npx ai-elements@latest add ${item.slug}`
}));

const outputPath = './AI_ELEMENTS_OFFICIAL_CATALOG.json';
writeFileSync(outputPath, JSON.stringify(catalogWithCommands, null, 2));

console.log(`✅ Generated ${outputPath}`);
console.log(`   Total components: ${catalogWithCommands.length}`);
console.log('');
console.log('By category:');
const byCategory = catalogWithCommands.reduce((acc, item) => {
  acc[item.category] = (acc[item.category] || 0) + 1;
  return acc;
}, {});
Object.entries(byCategory).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});

/**
 * A2rchitect Super-Agent OS - Integration Example
 * 
 * This file demonstrates how to integrate the A2rCanvas into the existing
 * A2R Platform shell. Copy relevant parts into your main app layout.
 */

import React, { useEffect } from 'react';
import { 
  A2rCanvas, 
  useSidecarStore, 
  useLaunchProtocol,
  processAgentMessage,
  SparkPageState,
} from './index';

// ============================================================================
// Example 1: Basic Layout Integration
// ============================================================================

export function ShellWithA2rCanvas() {
  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Main content area - switches between Chat/Code/Browser views */}
      <main className="flex-1 overflow-hidden">
        <MainViewRouter />
      </main>

      {/* Utility Pane - persists across view switches */}
      <A2rCanvas 
        className="flex-shrink-0"
        showTabs={true}
        resizable={true}
      />
    </div>
  );
}

function MainViewRouter() {
  // Your existing view router
  const currentView = 'chat'; // 'chat' | 'code' | 'browser' | 'agent-runner'
  
  return (
    <div className="h-full">
      {currentView === 'chat' && <ChatView />}
      {currentView === 'code' && <CodeView />}
      {currentView === 'browser' && <BrowserView />}
    </div>
  );
}

// ============================================================================
// Example 2: Chat View with Program Launching
// ============================================================================

function ChatView() {
  const threadId = 'thread-123';
  const launcher = useLaunchProtocol(threadId);
  const { updateProgramState } = useSidecarStore();

  // Handle agent response with potential launch commands
  const handleAgentResponse = (response: string) => {
    // Check for and execute any <launch_utility> commands
    const launchedIds = processAgentMessage(response, threadId);
    
    if (launchedIds.length > 0) {
      console.log(`Launched programs: ${launchedIds.join(', ')}`);
    }
    
    return response.replace(/<launch_utility[^>]*>[\s\S]*?<\/launch_utility>/g, '');
  };

  // Example: Launch research document
  const handleDeepResearch = () => {
    const programId = launcher.launchSparkPage(
      'Mars Colonization Research',
      'SpaceX Starship and Mars habitat technology',
      { focus: true, replaceExisting: false }
    );
    
    // Simulate streaming updates from agent
    simulateResearchStreaming(programId);
  };

  // Example: Launch spreadsheet
  const handleDataAnalysis = () => {
    launcher.launchAISheets(
      'Market Analysis Q1 2026',
      [
        { id: 'company', header: 'Company', type: 'text' },
        { id: 'revenue', header: 'Revenue ($M)', type: 'number' },
        { id: 'growth', header: 'Growth %', type: 'number' },
      ],
      { focus: true }
    );
  };

  // Example: Launch slides
  const handlePresentation = () => {
    launcher.launchAISlides(
      'Q1 Review Presentation',
      { focus: true }
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold text-gray-900 dark:text-white">Chat</h2>
        <div className="flex gap-2">
          <button
            onClick={handleDeepResearch}
            className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200"
          >
            📝 Research
          </button>
          <button
            onClick={handleDataAnalysis}
            className="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200"
          >
            📊 Sheets
          </button>
          <button
            onClick={handlePresentation}
            className="px-3 py-1.5 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200"
          >
            🎬 Slides
          </button>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <AgentMessage 
          content={`
I'll create a research document on Mars colonization for you.

<launch_utility type="spark-page" title="Mars Colonization Research">
{
  "topic": "Mars Colonization: Current State and Future Prospects",
  "isGenerating": true,
  "generationProgress": {
    "currentStep": "Gathering latest research...",
    "percentComplete": 10
  }
}
</launch_utility>

I'm gathering the latest information on SpaceX Starship, NASA's Artemis program, 
and Mars habitat technologies. This will appear in the Utility Pane on the right.
          `}
          onProcess={handleAgentResponse}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Example 3: Simulating Agent Updates to Programs
// ============================================================================

function simulateResearchStreaming(programId: string) {
  const { updateProgramState } = useSidecarStore.getState();
  
  const steps = [
    { step: 'Searching academic databases...', progress: 20 },
    { step: 'Analyzing SpaceX Starship developments...', progress: 40 },
    { step: 'Compiling Mars habitat research...', progress: 60 },
    { step: 'Synthesizing findings...', progress: 80 },
    { step: 'Finalizing document...', progress: 95 },
  ];

  let delay = 1000;
  
  steps.forEach(({ step, progress }) => {
    setTimeout(() => {
      updateProgramState<SparkPageState>(programId, (state) => ({
        ...state,
        generationProgress: {
          currentStep: step,
          percentComplete: progress,
        },
      }));
    }, delay);
    delay += 2000;
  });

  // Final update with content
  setTimeout(() => {
    updateProgramState<SparkPageState>(programId, (state) => ({
      ...state,
      isGenerating: false,
      sections: [
        {
          id: 'hero',
          type: 'hero',
          content: 'Mars Colonization: The Next Giant Leap',
          metadata: { subtitle: 'Current technologies, challenges, and timeline for human settlement' },
        },
        {
          id: 'intro',
          type: 'heading',
          content: 'Executive Summary',
          metadata: { level: 2 },
        },
        {
          id: 'intro-p',
          type: 'paragraph',
          content: 'Human settlement of Mars has transitioned from science fiction to engineering reality. With SpaceX\'s Starship program [1], NASA\'s Artemis roadmap [2], and advances in closed-loop life support [3], the first permanent Mars base could be established by 2035.',
        },
        {
          id: 'spacex',
          type: 'heading',
          content: 'SpaceX Starship Program',
          metadata: { level: 2 },
        },
        {
          id: 'spacex-p',
          type: 'paragraph',
          content: 'SpaceX\'s fully reusable Starship vehicle represents a paradigm shift in Mars mission economics. With a payload capacity of 100+ tons to Mars orbit [1], each vehicle could transport sufficient equipment for a 4-person habitat module.',
        },
      ],
      citations: [
        {
          id: 'c1',
          number: 1,
          source: 'SpaceX Mars Architecture',
          url: 'https://spacex.com/mars',
          timestamp: '2026-03-09',
          snippet: 'Starship is designed to carry both crew and cargo to Earth orbit, the Moon, Mars and beyond...',
        },
        {
          id: 'c2',
          number: 2,
          source: 'NASA Artemis Program',
          url: 'https://nasa.gov/artemis',
          timestamp: '2026-03-09',
          snippet: 'The Artemis program will land the first woman and first person of color on the Moon...',
        },
        {
          id: 'c3',
          number: 3,
          source: 'Life Support Systems for Mars',
          url: 'https://example.com/lss',
          timestamp: '2026-03-09',
          snippet: 'Closed-loop life support systems can achieve 95% water recycling and 50% food production...',
        },
      ],
      tableOfContents: [
        { id: 'intro', title: 'Executive Summary', level: 2 },
        { id: 'spacex', title: 'SpaceX Starship Program', level: 2 },
      ],
    }));
  }, delay + 1000);
}

// ============================================================================
// Example 4: Agent Message Component
// ============================================================================

interface AgentMessageProps {
  content: string;
  onProcess: (content: string) => string;
}

function AgentMessage({ content, onProcess }: AgentMessageProps) {
  useEffect(() => {
    // Process launch commands when message is rendered
    onProcess(content);
  }, [content, onProcess]);

  // Strip launch commands for display
  const displayContent = content.replace(
    /<launch_utility[^>]*>[\s\S]*?<\/launch_utility>/g,
    '\n*[Content opened in Utility Pane]*\n'
  );

  return (
    <div className="flex gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm">
        🤖
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">Assistant</div>
        <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {displayContent}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Example 5: Code View (shows persistence)
// ============================================================================

function CodeView() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold text-gray-900 dark:text-white">Code Editor</h2>
        <p className="text-sm text-gray-500">
          Note: Programs in the Utility Pane persist when switching views
        </p>
      </div>
      <div className="flex-1 p-4">
        <div className="h-full bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-300">
          // Your code editor here
          // The SparkPage/AI-Sheets/etc. in the Utility Pane 
          // will still be open when you switch back to Chat
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Example 6: Browser View
// ============================================================================

function BrowserView() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.131A8 8 0 008 8m0 0a8 8 0 00-16 0c0 4.991 3.657 9.128 8.438 9.878v3.078" />
          </svg>
          <span className="text-sm text-gray-600 dark:text-gray-400">https://example.com</span>
        </div>
      </div>
      <div className="flex-1 bg-white">
        {/* Browser content */}
      </div>
    </div>
  );
}

// ============================================================================
// Export examples
// ============================================================================

export default {
  ShellWithA2rCanvas,
  ChatView,
  CodeView,
  BrowserView,
};

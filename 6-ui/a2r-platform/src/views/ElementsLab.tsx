/**
 * Elements Lab
 * 
 * Interactive playground for all AI Elements components.
 * Each component is rendered with proper demo children structure.
 */

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Layers, Sparkles, Code, Mic, Workflow, Layout } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AI_ELEMENTS_REGISTRY,
  getComponentsByCategory,
  getAllCategories,
  type ComponentCategory,
  type AIElementEntry,
} from "@/components/ai-elements/registry";
import { cn } from "@/lib/utils";
import { ReactFlowProvider, ReactFlow, Background, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// Import all AI Elements for compound component demos
import {
  Attachments, Attachment, AttachmentPreview, AttachmentInfo,
  Context, ContextTrigger, ContextContent, ContextContentHeader, ContextInputUsage, ContextOutputUsage,
  Conversation, ConversationContent, ConversationEmptyState,
  Message, MessageContent, MessageActions,
  Queue, QueueSection, QueueSectionTrigger, QueueSectionLabel, QueueSectionContent, QueueList, QueueItem, QueueItemIndicator, QueueItemContent,
  Task, TaskTrigger, TaskContent, TaskItem,
  AgentCard, AgentHeader, AgentContent, AgentInstructions,
  Artifact, ArtifactHeader, ArtifactTitle, ArtifactContent,
  Sandbox, SandboxHeader, SandboxContent,
  FileTree, FileTreeFolder, FileTreeFile,
  AudioPlayer,
  Transcription, TranscriptionSegment,
  Panel,
  ChainOfThought, ChainOfThoughtHeader, ChainOfThoughtStep, ChainOfThoughtContent,
  Checkpoint, CheckpointIcon, CheckpointTrigger,
  Confirmation, ConfirmationTitle, ConfirmationRequest, ConfirmationActions, ConfirmationAction,
  InlineCitation,
  ModelSelector, ModelSelectorTrigger, ModelSelectorContent,
  Plan, PlanHeader, PlanTitle, PlanDescription, PlanAction, PlanContent, PlanTrigger,
  Shimmer,
  Reasoning, ReasoningTrigger, ReasoningContent,
  StackTrace, StackTraceHeader, StackTraceError, StackTraceErrorType, StackTraceErrorMessage, StackTraceActions, StackTraceCopyButton, StackTraceExpandButton, StackTraceContent, StackTraceFrames,
  Sources, Source,
  Commit, CommitHash, CommitMessage,
  Snippet, SnippetInput, SnippetCopyButton,
  TestResults, TestResultsHeader, TestResultsSummary, TestResultsProgress,
  WebPreview, WebPreviewNavigation, WebPreviewUrl,
  MicSelector, MicSelectorTrigger, MicSelectorContent, MicSelectorInput, MicSelectorList, MicSelectorItem, MicSelectorLabel, MicSelectorEmpty, MicSelectorValue,
  VoiceSelector, VoiceSelectorTrigger, VoiceSelectorContent,
  OpenIn, OpenInContent, OpenInItem,
  PromptInput, PromptInputTextarea,
} from "@/components/ai-elements";

// Category icons and labels
const CATEGORY_META: Record<
  ComponentCategory,
  { label: string; icon: React.ReactNode; color: string }
> = {
  chatbot: { label: "Chatbot", icon: <Sparkles className="w-4 h-4" />, color: "bg-blue-500/10 text-blue-400" },
  code: { label: "Code", icon: <Code className="w-4 h-4" />, color: "bg-green-500/10 text-green-400" },
  voice: { label: "Voice", icon: <Mic className="w-4 h-4" />, color: "bg-pink-500/10 text-pink-400" },
  workflow: { label: "Workflow", icon: <Workflow className="w-4 h-4" />, color: "bg-cyan-500/10 text-cyan-400" },
  utilities: { label: "Utilities", icon: <Layout className="w-4 h-4" />, color: "bg-white/5 text-[var(--text-secondary)]" },
};

// Mock workflow data
const MOCK_NODES: Node[] = [
  { id: "node-1", position: { x: 50, y: 50 }, data: { label: "Node 1" }, type: "default" },
  { id: "node-2", position: { x: 250, y: 50 }, data: { label: "Node 2" }, type: "default" },
];

const MOCK_EDGES: Edge[] = [
  { id: "edge-1", source: "node-1", target: "node-2" },
];

interface ComponentDemoProps {
  entry: AIElementEntry;
}

// Render component with proper demo children structure
function ComponentDemo({ entry }: ComponentDemoProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = entry.component as React.ComponentType<any>;
  
  const renderDemo = (): React.ReactNode => {
    switch (entry.id) {
      // Chatbot components
      case "attachments":
        return (
          <Attachments variant="inline">
            <Attachment data={{ id: "1", type: "file", filename: "document.pdf", mediaType: "application/pdf", url: "#" }}>
              <AttachmentPreview />
              <AttachmentInfo />
            </Attachment>
            <Attachment data={{ id: "2", type: "file", filename: "image.png", mediaType: "image/png", url: "#" }}>
              <AttachmentPreview />
              <AttachmentInfo />
            </Attachment>
          </Attachments>
        );
      
      case "context":
        return (
          <Context usedTokens={1500} maxTokens={4096} modelId="gpt-4">
            <ContextTrigger />
            <ContextContent>
              <ContextContentHeader />
              <ContextInputUsage />
              <ContextOutputUsage />
            </ContextContent>
          </Context>
        );
      
      case "conversation":
        return (
          <Conversation className="h-32 border rounded">
            <ConversationContent>
              <div className="p-4 text-sm text-muted-foreground">Conversation messages would appear here</div>
            </ConversationContent>
          </Conversation>
        );
      
      case "message":
        return (
          <Message from="assistant">
            <MessageContent>Hello! I'm an AI assistant. How can I help you today?</MessageContent>
            <MessageActions />
          </Message>
        );
      
      case "queue":
        return (
          <Queue>
            <QueueSection>
              <QueueSectionTrigger>
                <QueueSectionLabel label="Tasks" count={3} />
              </QueueSectionTrigger>
              <QueueSectionContent>
                <QueueList>
                  <QueueItem>
                    <QueueItemIndicator />
                    <QueueItemContent>Review pull request</QueueItemContent>
                  </QueueItem>
                  <QueueItem>
                    <QueueItemIndicator completed />
                    <QueueItemContent completed>Update documentation</QueueItemContent>
                  </QueueItem>
                </QueueList>
              </QueueSectionContent>
            </QueueSection>
          </Queue>
        );
      
      case "task":
        return (
          <Task>
            <TaskTrigger title="Search for relevant files" />
            <TaskContent>
              <TaskItem>Found 3 matching files</TaskItem>
              <TaskItem>Analyzing file contents...</TaskItem>
            </TaskContent>
          </Task>
        );
      
      case "tool":
        return (
          <Component defaultOpen>
            <div className="w-full p-4 text-sm text-muted-foreground">
              Tool component with collapsible content
            </div>
          </Component>
        );
      
      // Code components
      case "agent":
        return (
          <AgentCard>
            <AgentHeader name="Code Assistant" model="GPT-4" />
            <AgentContent>
              <AgentInstructions>Help users write and review code</AgentInstructions>
            </AgentContent>
          </AgentCard>
        );
      
      case "artifact":
        return (
          <Artifact>
            <ArtifactHeader>
              <ArtifactTitle>Generated Component</ArtifactTitle>
            </ArtifactHeader>
            <ArtifactContent>
              <div className="p-4 text-sm">Artifact content would appear here</div>
            </ArtifactContent>
          </Artifact>
        );
      
      case "sandbox":
        return (
          <Sandbox>
            <SandboxHeader title="Code Execution" state="output-available" />
            <SandboxContent>
              <div className="p-4 text-sm font-mono">console.log(&quot;Hello World&quot;);</div>
            </SandboxContent>
          </Sandbox>
        );
      
      case "file-tree":
        return (
          <FileTree>
            <FileTreeFolder path="src" name="src">
              <FileTreeFolder path="src/components" name="components">
                <FileTreeFolder path="src/components/ui" name="ui" />
                <FileTreeFolder path="src/components/chat" name="chat" />
              </FileTreeFolder>
              <FileTreeFolder path="src/lib" name="lib" />
            </FileTreeFolder>
            <FileTreeFile path="package.json" name="package.json" />
            <FileTreeFile path="README.md" name="README.md" />
          </FileTree>
        );
      
      case "environment-variables":
        return (
          <Component>
            <div className="p-2 text-sm text-muted-foreground">Environment variables editor</div>
          </Component>
        );
      
      // Voice components
      case "audio-player":
        return (
          <div className="w-full border rounded p-3 flex items-center gap-2">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs">▶</span>
            </div>
            <div className="flex-1 h-1 bg-muted rounded">
              <div className="w-1/3 h-full bg-primary rounded" />
            </div>
            <span className="text-xs text-muted-foreground">1:23 / 3:45</span>
          </div>
        );
      
      case "transcription":
        return (
          <Transcription 
            segments={[
              { text: "Hello and welcome to the presentation.", startSecond: 0, endSecond: 3 },
              { text: "Today we'll discuss AI components.", startSecond: 3, endSecond: 6 },
            ]}
          >
            {(segment, index) => (
              <TranscriptionSegment 
                key={segment.startSecond ?? index} 
                segment={segment} 
                index={index} 
              />
            )}
          </Transcription>
        );
      
      // Workflow components
      case "connection":
        return (
          <svg width="200" height="60" viewBox="0 0 200 60" className="overflow-visible">
            <path
              d="M20,30 C70,30 130,30 180,30"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-primary"
            />
            <circle cx="20" cy="30" r="4" className="fill-primary" />
            <circle cx="180" cy="30" r="4" className="fill-primary" />
          </svg>
        );
      
      case "canvas":
        return (
          <div className="w-full h-[200px]">
            <Component nodes={[]} edges={[]} />
          </div>
        );
      
      case "controls":
      case "panel":
        return (
          <ReactFlowProvider>
            <div className="w-full h-[200px] relative">
              <ReactFlow 
                nodes={MOCK_NODES} 
                edges={MOCK_EDGES}
                fitView
                panOnDrag={false}
                zoomOnDoubleClick={false}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
              >
                <Background />
                <Component />
              </ReactFlow>
            </div>
          </ReactFlowProvider>
        );
      
      case "edge":
        return (
          <svg width="200" height="40" viewBox="0 0 200 40">
            <path
              d="M10,20 Q50,5 100,20 T190,20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-primary"
              markerEnd="url(#arrow)"
            />
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" className="fill-primary" />
              </marker>
            </defs>
          </svg>
        );
      
      case "node":
        return (
          <div className="w-32 h-16 border-2 border-primary rounded bg-card flex items-center justify-center shadow-sm">
            <span className="text-sm font-medium">Node</span>
          </div>
        );
      
      case "toolbar":
        return (
          <div className="flex items-center gap-1 p-2 border rounded bg-card shadow-sm">
            <button className="p-1.5 hover:bg-muted rounded">➕</button>
            <button className="p-1.5 hover:bg-muted rounded">✂️</button>
            <button className="p-1.5 hover:bg-muted rounded">📋</button>
            <div className="w-px h-4 bg-border mx-1" />
            <button className="p-1.5 hover:bg-muted rounded">🗑️</button>
          </div>
        );
      
      // Missing components - add proper rendering
      case "chain-of-thought":
        return (
          <ChainOfThought defaultOpen>
            <ChainOfThoughtHeader>Chain of Thought</ChainOfThoughtHeader>
            <ChainOfThoughtContent>
              <ChainOfThoughtStep label="Step 1">Analyzing the problem</ChainOfThoughtStep>
              <ChainOfThoughtStep label="Step 2">Breaking down components</ChainOfThoughtStep>
              <ChainOfThoughtStep label="Step 3">Finding solution</ChainOfThoughtStep>
            </ChainOfThoughtContent>
          </ChainOfThought>
        );
      
      case "checkpoint":
        return (
          <Checkpoint>
            <CheckpointIcon />
            <CheckpointTrigger tooltip="Save checkpoint">Save</CheckpointTrigger>
          </Checkpoint>
        );
      
      case "confirmation":
        return (
          <Confirmation state="approval-requested" approval={{ id: "1" }}>
            <ConfirmationTitle>Confirm this action?</ConfirmationTitle>
            <ConfirmationRequest>
              <span className="text-sm">This will execute the tool</span>
            </ConfirmationRequest>
            <ConfirmationActions>
              <ConfirmationAction variant="outline">Cancel</ConfirmationAction>
              <ConfirmationAction>Confirm</ConfirmationAction>
            </ConfirmationActions>
          </Confirmation>
        );
      
      case "inline-citation":
        return (
          <div className="text-sm">
            Text with citation <InlineCitation>[1]</InlineCitation>
          </div>
        );
      
      case "model-selector":
        return (
          <ModelSelector>
            <ModelSelectorTrigger asChild>
              <Button variant="outline" size="sm">Select Model</Button>
            </ModelSelectorTrigger>
            <ModelSelectorContent>
              <div className="p-2 text-sm text-muted-foreground">Model list would appear here</div>
            </ModelSelectorContent>
          </ModelSelector>
        );
      
      case "plan":
        return (
          <Plan defaultOpen>
            <PlanHeader>
              <div>
                <PlanTitle>Execution Plan</PlanTitle>
                <PlanDescription>3 steps to complete</PlanDescription>
              </div>
              <PlanAction>
                <PlanTrigger />
              </PlanAction>
            </PlanHeader>
            <PlanContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-green-500" />
                  Step 1: Analyze requirements
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-blue-500" />
                  Step 2: Design solution
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-gray-300" />
                  Step 3: Implement
                </li>
              </ul>
            </PlanContent>
          </Plan>
        );
      
      case "shimmer":
        return (
          <div className="p-4">
            <Shimmer as="span">Loading content, please wait...</Shimmer>
          </div>
        );
      
      case "reasoning":
        return (
          <Reasoning isStreaming={false} defaultOpen={true} duration={3}>
            <ReasoningTrigger />
            <ReasoningContent>Step 1: Analyzing the problem...\n\nStep 2: Considering options...\n\nStep 3: Final answer</ReasoningContent>
          </Reasoning>
        );
      
      case "sources":
        return (
          <Sources>
            <Source href="#" title="Example Source 1">Source 1</Source>
            <Source href="#" title="Example Source 2">Source 2</Source>
          </Sources>
        );
      
      case "commit":
        return (
          <Commit>
            <div className="flex items-center gap-2 text-sm">
              <CommitHash>abc1234</CommitHash>
              <CommitMessage>feat: add new feature</CommitMessage>
            </div>
          </Commit>
        );
      
      case "snippet":
        return (
          <div className="w-full">
            <Snippet code="npm install ai">
              <SnippetInput />
              <SnippetCopyButton />
            </Snippet>
          </div>
        );
      
      case "stack-trace":
        return (
          <StackTrace trace={`TypeError: Cannot read property 'foo' of undefined\n    at myFunction (app.js:42:15)\n    at main (index.js:10:5)`}>
            <StackTraceHeader>
              <StackTraceError>
                <StackTraceErrorType>TypeError</StackTraceErrorType>
                <StackTraceErrorMessage>Cannot read property 'foo' of undefined</StackTraceErrorMessage>
              </StackTraceError>
              <StackTraceActions>
                <StackTraceCopyButton />
                <StackTraceExpandButton />
              </StackTraceActions>
            </StackTraceHeader>
            <StackTraceContent>
              <StackTraceFrames />
            </StackTraceContent>
          </StackTrace>
        );
      
      case "prompt-input":
        return (
          <PromptInput onSubmit={() => {}}>
            <PromptInputTextarea placeholder="Type a message..." />
          </PromptInput>
        );
      
      case "test-results":
        return (
          <TestResults summary={{ passed: 8, failed: 1, skipped: 2, total: 11 }}>
            <TestResultsHeader>Test Results</TestResultsHeader>
            <TestResultsSummary />
            <TestResultsProgress />
          </TestResults>
        );
      
      case "web-preview":
        return (
          <WebPreview>
            <WebPreviewNavigation>
              <WebPreviewUrl />
            </WebPreviewNavigation>
            <div className="p-4 text-sm text-muted-foreground bg-muted/30 rounded">
              Web preview iframe would render here
            </div>
          </WebPreview>
        );
      
      case "jsx-preview":
        return (
          <div className="w-full border rounded p-4">
            <div className="text-sm font-mono">{`<div>Hello World</div>`}</div>
            <div className="mt-2 p-2 bg-muted rounded text-sm">Preview: Hello World</div>
          </div>
        );
      
      case "mic-selector":
        return (
          <MicSelector>
            <MicSelectorTrigger>
              <MicSelectorValue />
            </MicSelectorTrigger>
            <MicSelectorContent>
              <MicSelectorInput />
              <MicSelectorList>
                {(devices) =>
                  devices.length > 0 ? (
                    devices.map((device) => (
                      <MicSelectorItem key={device.deviceId} value={device.deviceId}>
                        <MicSelectorLabel device={device} />
                      </MicSelectorItem>
                    ))
                  ) : (
                    <MicSelectorEmpty>No microphones found</MicSelectorEmpty>
                  )
                }
              </MicSelectorList>
            </MicSelectorContent>
          </MicSelector>
        );
      
      case "voice-selector":
        return (
          <VoiceSelector>
            <VoiceSelectorTrigger asChild>
              <Button variant="outline" size="sm">Select Voice</Button>
            </VoiceSelectorTrigger>
            <VoiceSelectorContent>
              <div className="p-2 text-sm text-muted-foreground">Voice list</div>
            </VoiceSelectorContent>
          </VoiceSelector>
        );
      
      case "open-in-chat":
        return (
          <Button variant="outline" size="sm" className="gap-2">
            <span>💬</span> Open in Chat
          </Button>
        );
      
      case "image":
        return (
          <div className="w-24 h-24 bg-muted rounded flex items-center justify-center border">
            <span className="text-2xl">🖼️</span>
          </div>
        );
      
      // Default: render with demoFactory props
      default:
        const demoProps = entry.demoFactory();
        return <Component {...demoProps} />;
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{entry.title}</span>
          {entry.isInteractive && (
            <Badge variant="secondary" className="text-xs">
              Interactive
            </Badge>
          )}
        </div>
        <code className="text-xs text-muted-foreground">{entry.id}</code>
      </div>
      <div className="p-6 bg-background">
        <ComponentDemoWrapper>
          {renderDemo()}
        </ComponentDemoWrapper>
      </div>
      <div className="bg-muted/30 px-4 py-2 border-t">
        <p className="text-xs text-muted-foreground">{entry.description}</p>
      </div>
    </div>
  );
}

// Error boundary wrapper
class ComponentDemoWrapper extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Component demo error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-red-200 bg-red-50 rounded text-red-600 text-sm">
          <div className="font-medium mb-1">⚠️ Component failed to render</div>
          <div className="text-xs opacity-75">{this.state.error?.message}</div>
        </div>
      );
    }

    return (
      <div className="min-h-[100px] flex items-center justify-center">
        {this.props.children}
      </div>
    );
  }
}

interface CategorySectionProps {
  category: ComponentCategory;
  entries: AIElementEntry[];
  isExpanded: boolean;
  onToggle: () => void;
}

function CategorySection({ category, entries, isExpanded, onToggle }: CategorySectionProps) {
  const meta = CATEGORY_META[category];

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 bg-muted/50 hover:bg-muted transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <span className={cn("p-2 rounded-md", meta.color)}>{meta.icon}</span>
          <span className="font-semibold">{meta.label}</span>
          <Badge variant="outline" className="text-xs">
            {entries.length}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 bg-background">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <ComponentDemo key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ElementsLab() {
  const categories = getAllCategories();
  const [expandedCategories, setExpandedCategories] = useState<Set<ComponentCategory>>(
    () => new Set(categories)
  );

  const toggleCategory = (category: ComponentCategory) => {
    const next = new Set(expandedCategories);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    setExpandedCategories(next);
  };

  const expandAll = () => setExpandedCategories(new Set(categories));
  const collapseAll = () => setExpandedCategories(new Set());

  const stats = {
    total: AI_ELEMENTS_REGISTRY.length,
    categories: categories.length,
    interactive: AI_ELEMENTS_REGISTRY.filter((e) => e.isInteractive).length,
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Elements Lab</h1>
            <p className="text-sm text-muted-foreground">
              Interactive playground for all {stats.total} AI Elements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>{stats.total} components</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>{stats.interactive} interactive</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4">
          {categories.map((category) => (
            <CategorySection
              key={category}
              category={category}
              entries={getComponentsByCategory(category)}
              isExpanded={expandedCategories.has(category)}
              onToggle={() => toggleCategory(category)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

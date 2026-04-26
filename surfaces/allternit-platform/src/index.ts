import './design/theme.css';
import './design/modeStyles.css';

// Design System Exports
export { GlassPanel } from './design/glass/GlassPanel';
export { GlassDialog } from './design/glass/GlassDialog';
export { GlassTooltip } from './design/glass/GlassTooltip';
export { GlassPopover } from './design/glass/GlassPopover';
export { GlassInput } from './design/glass/GlassInput';
export { GlassButton } from './design/glass/GlassButton';
export { useGlass } from './design/glass/useGlass';

export { ShellApp } from './shell/ShellApp';
export { ShellFrame } from './shell/ShellFrame';
export { type AppMode, ShellHeader } from './shell/ShellHeader';
export { ShellRail } from './shell/ShellRail';
export { ShellCanvas } from './shell/ShellCanvas';
export { ShellOverlayLayer } from './shell/ShellOverlayLayer';
export { AgentRunnerWindow } from './shell/AgentRunnerWindow';
export { SHORTCUTS } from './shell/ShellShortcuts';

export { type DrawerScope, type DrawerType, type NavEvent, type NavState, type SpawnPolicy, type ViewContext, type ViewId, type ViewType } from './nav/nav.types';
export { createInitialNavState, navReducer } from './nav/nav.store';
export { goBack, goForward, pushHistory } from './nav/nav.history';
export { DEFAULT_POLICIES, makeStableViewId } from './nav/nav.policy';
export { canGoBack, canGoForward, selectActiveView, selectFuture, selectHistory, selectOpenViews } from './nav/nav.selectors';

export { type ViewInstance, type ViewRegistry, createViewRegistry } from './views/registry';
export { ViewHost } from './views/ViewHost';
export { type ViewLifecycle } from './views/ViewLifecycle';
export { AgentHub, AgentSystemView, AgentView, BlueprintCanvas, AutonomousCodeFactoryView, BrowserView, BudgetDashboardView, CanvasProtocolView, CapsuleManagerView, ChatView, Checkpointing, CloudDeployView, CodeRoot, ContextControlPlaneView, CoworkRoot, DAGWIH, DagIntegrationPage, DirectiveCompiler, EvaluationHarness, EvolutionLayerView, FormSurfacesView, GCAgents, HomeView, HooksSystemView, IVKGEPanel, type LazyViewComponent, LazyViewWrapper, MemoryKernelView, MultimodalInput, NativeAgentView, NodesView, ObservabilityDashboard, OntologyViewer, OpenClawControlUI, OperatorBrowserView, PlaygroundView, PluginRegistryView, PolicyGating, PolicyManager, PrewarmManagerView, ProjectView, PromotionDashboardView, PurposeBinding, RailsView, ReceiptsViewer, ReplayManagerView, RunReplayView, RunnerView, RuntimeOperationsView, SecurityDashboard, SkillsRegistryView, SwarmDashboard, SwarmMonitor, UIForge, TaskExecutor, TerminalView, ToolsView } from './views/lazyRegistry';

// Capsule System
export {
  // Core
  CapsuleHost,
  capsuleKindToViewType,
  // Browser
  BrowserCapsule,
  openSampleA2UITab,
  sampleA2UIPayload,
  useBrowserStore,
  useActiveTab,
  useTabCount,
  useActiveTabType,
  parseBrowserInput,
  createWebTab,
  createA2UITab,
  createMiniappTab,
  createComponentTab,
  // A2UI Renderer - Base
  A2UIRenderer,
  // A2UI Renderer - Extended (Full Roadmap)
  A2UIRendererExtended,
  ChartRenderer,
  DatePickerRenderer,
  CalendarRenderer,
  FileUploadRenderer,
  RichTextRenderer,
  TreeViewRenderer,
  SplitPaneRenderer,
  TimelineRenderer,
  AgentThinkingRenderer,
  ToolCallRenderer,
  ArtifactPreviewRenderer,
  ResponsiveContainerRenderer,
  DockPanelRenderer,
  // Backend Integration
  a2uiApi,
  useA2UIApi,
  useA2UISession,
  useA2UIAction,
  useA2UIBackend,
  // Utilities
  resolvePath,
  resolveValue,
  isVisible,
} from "./capsules";

export type {
  // Capsule Types
  CapsuleKind,
  CapsuleId,
  CapsuleContext,
  // Browser Types
  BrowserTab,
  BrowserContentType,
  WebTab,
  A2UITab,
  MiniappTab,
  ComponentTab,
  MiniappManifest,
  CapsuleRegistryEntry,
  CapsuleRuntimeState,
  ProtocolParseResult,
  // A2UI Types - Base
  A2UIRendererProps,
  A2UIPayload,
  A2UISurface,
  A2UIAction,
  ComponentNode,
  RenderContext,
  ContainerProps,
  StackProps,
  GridProps,
  TextProps,
  CardProps,
  ButtonProps,
  TextFieldProps,
  SelectProps,
  SwitchProps,
  CheckboxProps,
  RadioGroupProps,
  SliderProps,
  ListProps,
  DataTableProps,
  BadgeProps,
  ProgressProps,
  SpinnerProps,
  TabsProps,
  AccordionProps,
  AlertProps,
  DialogProps,
  TooltipProps,
  PopoverProps,
  MenuProps,
  CodeProps,
  SearchProps,
  ComponentType,
  VisibleCondition,
  BaseComponentProps,
  // A2UI Types - Extended
  A2UIRendererExtendedProps,
  ExtendedComponentNode,
  ExtendedComponentType,
  ExtendedChartProps,
  ExtendedDatePickerProps,
  ExtendedCalendarProps,
  ExtendedFileUploadProps,
  ExtendedRichTextProps,
  ExtendedTreeViewProps,
  TreeNode,
  ExtendedSplitPaneProps,
  ExtendedTimelineProps,
  TimelineItem,
  ExtendedAgentThinkingProps,
  AgentThinkingStep,
  ExtendedToolCallProps,
  ExtendedArtifactPreviewProps,
  ExtendedResponsiveContainerProps,
  ExtendedDockPanelProps,
  AnimationConfig,
  EnhancedVisibleCondition,
  DataSourceConfig,
  BreakpointConfig,
  // A2UI Backend Types
  A2UISession,
  A2UIActionRequest,
  A2UIActionResponse,
  A2UIEvent,
  CapsuleManifest,
  UseA2UIBackendOptions,
  UseA2UIBackendReturn,
} from "./capsules";

export { ConsoleDrawer } from './drawers/ConsoleDrawer';
export { useDrawerStore } from './drawers/drawer.store';
export { type DrawerState, type DrawerStoreState } from './drawers/drawer.types';

export { TaskDock } from './dock/TaskDock';
export { type Ticket, type TicketStatus } from './dock/ticket.model';
export { useTicketStore } from './dock/ticket.store';

export { AgentRunner } from './runner/AgentRunner';
export { type RunnerPlan, type RunnerPlanStep, useRunnerStore } from './runner/runner.store';
export { type RunState, type RunnerRun, type RunnerTraceEntry, type TraceKind, type TraceStatus } from './runner/runner.types';

// AI Elements - Full component suite from elements.ai-sdk.dev
// Includes all 50+ components: Conversation, Message, PromptInput, Tool, Reasoning, etc.
export { AgentCard, AgentContent, AgentHeader, AgentInstructions, AgentOutput, AgentTool, AgentTools, ArtifactAction, ArtifactActions, ArtifactCard, ArtifactClose, ArtifactContent, ArtifactDescription, ArtifactHeader, ArtifactSidePanel, ArtifactTitle, Attachment, AttachmentEmpty, AttachmentHoverCard, AttachmentHoverCardContent, AttachmentHoverCardTrigger, AttachmentInfo, AttachmentPreview, AttachmentRemove, Attachments, AudioPlayer, AudioPlayerControlBar, AudioPlayerDurationDisplay, AudioPlayerElement, AudioPlayerMuteButton, AudioPlayerPlayButton, AudioPlayerSeekBackwardButton, AudioPlayerSeekForwardButton, AudioPlayerTimeDisplay, AudioPlayerTimeRange, AudioPlayerVolumeRange, Canvas, ChainOfThought, ChainOfThoughtContent, ChainOfThoughtHeader, ChainOfThoughtImage, ChainOfThoughtSearchResult, ChainOfThoughtSearchResults, ChainOfThoughtStep, Checkpoint, CheckpointDescription, CheckpointIcon, CheckpointTrigger, CodeBlock, CodeBlockActions, CodeBlockContainer, CodeBlockContent, CodeBlockCopyButton, CodeBlockFilename, CodeBlockHeader, CodeBlockLanguageSelector, CodeBlockLanguageSelectorContent, CodeBlockLanguageSelectorItem, CodeBlockLanguageSelectorTrigger, CodeBlockLanguageSelectorValue, CodeBlockTitle, Commit, CommitActions, CommitAuthor, CommitAuthorAvatar, CommitContent, CommitCopyButton, CommitFile, CommitFileAdditions, CommitFileChanges, CommitFileDeletions, CommitFileIcon, CommitFileInfo, CommitFilePath, CommitFileStatus, CommitFiles, CommitHash, CommitHeader, CommitInfo, CommitMessage, CommitMetadata, CommitSeparator, CommitTimestamp, Confirmation, ConfirmationAccepted, ConfirmationAction, ConfirmationActions, ConfirmationRejected, ConfirmationRequest, ConfirmationTitle, Connection, Context, ContextCacheUsage, ContextContent, ContextContentBody, ContextContentFooter, ContextContentHeader, ContextInputUsage, ContextOutputUsage, ContextReasoningUsage, ContextTrigger, Controls, Conversation, ConversationContent, ConversationDownload, ConversationEmptyState, ConversationScrollButton, Edge, EnvironmentVariable, EnvironmentVariableCopyButton, EnvironmentVariableGroup, EnvironmentVariableName, EnvironmentVariableRequired, EnvironmentVariableValue, EnvironmentVariables, EnvironmentVariablesContent, EnvironmentVariablesHeader, EnvironmentVariablesTitle, EnvironmentVariablesToggle, FileTree, FileTreeActions, FileTreeFile, FileTreeFolder, FileTreeIcon, FileTreeName, Image, InlineCitation, InlineCitationCard, InlineCitationCardBody, InlineCitationCardTrigger, InlineCitationCarousel, InlineCitationCarouselContent, InlineCitationCarouselHeader, InlineCitationCarouselIndex, InlineCitationCarouselItem, InlineCitationCarouselNext, InlineCitationCarouselPrev, InlineCitationQuote, InlineCitationSource, InlineCitationText, JSXPreview, JSXPreviewContent, JSXPreviewError, LocalReferencedSourcesContext, Markdown, Message, MessageAction, MessageActions, MessageBranch, MessageBranchContent, MessageBranchNext, MessageBranchPage, MessageBranchPrevious, MessageBranchSelector, MessageContent, MessageResponse, MessageToolbar, MicSelector, MicSelectorContent, MicSelectorEmpty, MicSelectorInput, MicSelectorItem, MicSelectorLabel, MicSelectorList, MicSelectorTrigger, MicSelectorValue, ModelSelector, ModelSelectorContent, ModelSelectorDialog, ModelSelectorEmpty, ModelSelectorGroup, ModelSelectorInput, ModelSelectorItem, ModelSelectorList, ModelSelectorLogo, ModelSelectorLogoGroup, ModelSelectorName, ModelSelectorSeparator, ModelSelectorShortcut, ModelSelectorTrigger, Node, NodeAction, NodeContent, NodeDescription, NodeFooter, NodeHeader, NodeTitle, OpenIn, OpenInChatGPT, OpenInClaude, OpenInContent, OpenInCursor, OpenInItem, OpenInLabel, OpenInScira, OpenInSeparator, OpenInT3, OpenInTrigger, OpenInv0, PackageInfo, PackageInfoChangeType, PackageInfoContent, PackageInfoDependencies, PackageInfoDependency, PackageInfoDescription, PackageInfoHeader, PackageInfoName, PackageInfoVersion, Panel, Persona, Plan, PlanAction, PlanContent, PlanDescription, PlanFooter, PlanHeader, PlanTitle, PlanTrigger, PromptInput, PromptInputActionAddAttachments, PromptInputActionMenu, PromptInputActionMenuContent, PromptInputActionMenuItem, PromptInputActionMenuTrigger, PromptInputBody, PromptInputButton, PromptInputCommand, PromptInputCommandEmpty, PromptInputCommandGroup, PromptInputCommandInput, PromptInputCommandItem, PromptInputCommandList, PromptInputCommandSeparator, PromptInputFooter, PromptInputHeader, PromptInputHoverCard, PromptInputHoverCardContent, PromptInputHoverCardTrigger, PromptInputProvider, PromptInputSelect, PromptInputSelectContent, PromptInputSelectItem, PromptInputSelectTrigger, PromptInputSelectValue, PromptInputSubmit, PromptInputTab, PromptInputTabBody, PromptInputTabItem, PromptInputTabLabel, PromptInputTabsList, PromptInputTextarea, PromptInputTools, Queue, QueueItem, QueueItemAction, QueueItemActions, QueueItemAttachment, QueueItemContent, QueueItemDescription, QueueItemFile, QueueItemImage, QueueItemIndicator, QueueList, QueueSection, QueueSectionContent, QueueSectionLabel, QueueSectionTrigger, Reasoning, ReasoningContent, ReasoningTrigger, Sandbox, SandboxContent, SandboxHeader, SandboxTabContent, SandboxTabs, SandboxTabsBar, SandboxTabsList, SandboxTabsTrigger, SchemaDisplay, SchemaDisplayBody, SchemaDisplayContent, SchemaDisplayDescription, SchemaDisplayExample, SchemaDisplayHeader, SchemaDisplayMethod, SchemaDisplayParameter, SchemaDisplayParameters, SchemaDisplayPath, SchemaDisplayProperty, SchemaDisplayRequest, SchemaDisplayResponse, Shimmer, Snippet, SnippetAddon, SnippetCopyButton, SnippetInput, SnippetText, Source, Sources, SourcesContent, SourcesTrigger, SpeechInput, StackTrace, StackTraceActions, StackTraceContent, StackTraceCopyButton, StackTraceError, StackTraceErrorMessage, StackTraceErrorType, StackTraceExpandButton, StackTraceFrames, StackTraceHeader, Suggestion, Suggestions, Task, TaskContent, TaskItem, TaskItemFile, TaskTrigger, Terminal, TerminalActions, TerminalClearButton, TerminalContent, TerminalCopyButton, TerminalHeader, TerminalStatus, TerminalTitle, Test, TestDuration, TestError, TestErrorMessage, TestErrorStack, TestName, TestResults, TestResultsContent, TestResultsDuration, TestResultsHeader, TestResultsProgress, TestResultsSummary, TestStatus, TestSuite, TestSuiteContent, TestSuiteName, TestSuiteStats, Tool, ToolContent, ToolHeader, ToolInput, ToolOutput, Toolbar, Transcription, TranscriptionSegment, UnifiedMessageRenderer, VoiceOverlay, VoicePresence, VoiceSelector, VoiceSelectorAccent, VoiceSelectorAge, VoiceSelectorAttributes, VoiceSelectorBullet, VoiceSelectorContent, VoiceSelectorDescription, VoiceSelectorDialog, VoiceSelectorEmpty, VoiceSelectorGender, VoiceSelectorGroup, VoiceSelectorInput, VoiceSelectorItem, VoiceSelectorList, VoiceSelectorName, VoiceSelectorPreview, VoiceSelectorSeparator, VoiceSelectorShortcut, VoiceSelectorTrigger, VoiceToolbar, WebPreview, WebPreviewBody, WebPreviewConsole, WebPreviewNavigation, WebPreviewNavigationButton, WebPreviewUrl, getAttachmentLabel, getMediaCategory, getStatusBadge, highlightCode, messagesToMarkdown, useAttachmentContext, useAttachmentsContext, useAudioDevices, useJSXPreview, usePromptInputAttachments, usePromptInputController, usePromptInputReferencedSources, useProviderAttachments, useReasoning, useVoiceSelector } from './components/ai-elements';
export type { AgentCardProps, AgentContentProps, AgentHeaderProps, AgentInstructionsProps, AgentOutputProps, AgentToolProps, AgentToolsProps, ArtifactActionProps, ArtifactActionsProps, ArtifactCloseProps, ArtifactContentProps, ArtifactDescriptionProps, ArtifactHeaderProps, ArtifactKind, ArtifactProps, ArtifactTitleProps, AttachmentData, AttachmentEmptyProps, AttachmentHoverCardContentProps, AttachmentHoverCardProps, AttachmentHoverCardTriggerProps, AttachmentInfoProps, AttachmentMediaCategory, AttachmentPreviewProps, AttachmentProps, AttachmentRemoveProps, AttachmentVariant, AttachmentsContext, AttachmentsProps, AudioPlayerControlBarProps, AudioPlayerDurationDisplayProps, AudioPlayerElementProps, AudioPlayerMuteButtonProps, AudioPlayerPlayButtonProps, AudioPlayerProps, AudioPlayerSeekBackwardButtonProps, AudioPlayerSeekForwardButtonProps, AudioPlayerTimeDisplayProps, AudioPlayerTimeRangeProps, AudioPlayerVolumeRangeProps, ChainOfThoughtContentProps, ChainOfThoughtHeaderProps, ChainOfThoughtImageProps, ChainOfThoughtProps, ChainOfThoughtSearchResultProps, ChainOfThoughtSearchResultsProps, ChainOfThoughtStepProps, CheckpointDescriptionProps, CheckpointIconProps, CheckpointProps, CheckpointTriggerProps, CodeBlockCopyButtonProps, CodeBlockLanguageSelectorContentProps, CodeBlockLanguageSelectorItemProps, CodeBlockLanguageSelectorProps, CodeBlockLanguageSelectorTriggerProps, CodeBlockLanguageSelectorValueProps, CommitActionsProps, CommitAuthorAvatarProps, CommitAuthorProps, CommitContentProps, CommitCopyButtonProps, CommitFileAdditionsProps, CommitFileChangesProps, CommitFileDeletionsProps, CommitFileIconProps, CommitFileInfoProps, CommitFilePathProps, CommitFileProps, CommitFileStatusProps, CommitFilesProps, CommitHashProps, CommitHeaderProps, CommitInfoProps, CommitMessageProps, CommitMetadataProps, CommitProps, CommitSeparatorProps, CommitTimestampProps, ConfirmationAcceptedProps, ConfirmationActionProps, ConfirmationActionsProps, ConfirmationProps, ConfirmationRejectedProps, ConfirmationRequestProps, ConfirmationTitleProps, ContextCacheUsageProps, ContextContentBodyProps, ContextContentFooterProps, ContextContentHeaderProps, ContextContentProps, ContextInputUsageProps, ContextOutputUsageProps, ContextProps, ContextReasoningUsageProps, ContextTriggerProps, ControlsProps, ConversationContentProps, ConversationDownloadProps, ConversationEmptyStateProps, ConversationMessage, ConversationProps, ConversationScrollButtonProps, EnvironmentVariableCopyButtonProps, EnvironmentVariableGroupProps, EnvironmentVariableNameProps, EnvironmentVariableProps, EnvironmentVariableRequiredProps, EnvironmentVariableValueProps, EnvironmentVariablesContentProps, EnvironmentVariablesHeaderProps, EnvironmentVariablesProps, EnvironmentVariablesTitleProps, EnvironmentVariablesToggleProps, FileTreeActionsProps, FileTreeFileProps, FileTreeFolderProps, FileTreeIconProps, FileTreeNameProps, FileTreeProps, ImageProps, InlineCitationCardBodyProps, InlineCitationCardProps, InlineCitationCardTriggerProps, InlineCitationCarouselContentProps, InlineCitationCarouselHeaderProps, InlineCitationCarouselIndexProps, InlineCitationCarouselItemProps, InlineCitationCarouselNextProps, InlineCitationCarouselPrevProps, InlineCitationCarouselProps, InlineCitationProps, InlineCitationQuoteProps, InlineCitationSourceProps, InlineCitationTextProps, JSXPreviewContentProps, JSXPreviewErrorProps, JSXPreviewProps, MessageActionProps, MessageActionsProps, MessageBranchContentProps, MessageBranchNextProps, MessageBranchPageProps, MessageBranchPreviousProps, MessageBranchProps, MessageBranchSelectorProps, MessageContentProps, MessageProps, MessageResponseProps, MessageToolbarProps, MicSelectorContentProps, MicSelectorEmptyProps, MicSelectorInputProps, MicSelectorItemProps, MicSelectorLabelProps, MicSelectorListProps, MicSelectorProps, MicSelectorTriggerProps, MicSelectorValueProps, ModelSelectorContentProps, ModelSelectorDialogProps, ModelSelectorEmptyProps, ModelSelectorGroupProps, ModelSelectorInputProps, ModelSelectorItemProps, ModelSelectorListProps, ModelSelectorLogoGroupProps, ModelSelectorLogoProps, ModelSelectorNameProps, ModelSelectorProps, ModelSelectorSeparatorProps, ModelSelectorShortcutProps, ModelSelectorTriggerProps, NodeActionProps, NodeContentProps, NodeDescriptionProps, NodeFooterProps, NodeHeaderProps, NodeProps, NodeTitleProps, OpenInChatGPTProps, OpenInClaudeProps, OpenInContentProps, OpenInCursorProps, OpenInItemProps, OpenInLabelProps, OpenInProps, OpenInSciraProps, OpenInSeparatorProps, OpenInT3Props, OpenInTriggerProps, OpenInv0Props, PackageInfoChangeTypeProps, PackageInfoContentProps, PackageInfoDependenciesProps, PackageInfoDependencyProps, PackageInfoDescriptionProps, PackageInfoHeaderProps, PackageInfoNameProps, PackageInfoProps, PackageInfoVersionProps, PersonaState, PlanActionProps, PlanContentProps, PlanDescriptionProps, PlanFooterProps, PlanHeaderProps, PlanProps, PlanTitleProps, PlanTriggerProps, PromptInputActionAddAttachmentsProps, PromptInputActionMenuContentProps, PromptInputActionMenuItemProps, PromptInputActionMenuProps, PromptInputActionMenuTriggerProps, PromptInputBodyProps, PromptInputButtonProps, PromptInputButtonTooltip, PromptInputCommandEmptyProps, PromptInputCommandGroupProps, PromptInputCommandInputProps, PromptInputCommandItemProps, PromptInputCommandListProps, PromptInputCommandProps, PromptInputCommandSeparatorProps, PromptInputControllerProps, PromptInputFooterProps, PromptInputHeaderProps, PromptInputHoverCardContentProps, PromptInputHoverCardProps, PromptInputHoverCardTriggerProps, PromptInputMessage, PromptInputProps, PromptInputProviderProps, PromptInputSelectContentProps, PromptInputSelectItemProps, PromptInputSelectProps, PromptInputSelectTriggerProps, PromptInputSelectValueProps, PromptInputSubmitProps, PromptInputTabBodyProps, PromptInputTabItemProps, PromptInputTabLabelProps, PromptInputTabProps, PromptInputTabsListProps, PromptInputTextareaProps, PromptInputToolsProps, QueueItemActionProps, QueueItemActionsProps, QueueItemAttachmentProps, QueueItemContentProps, QueueItemDescriptionProps, QueueItemFileProps, QueueItemImageProps, QueueItemIndicatorProps, QueueItemProps, QueueListProps, QueueMessage, QueueMessagePart, QueueProps, QueueSectionContentProps, QueueSectionLabelProps, QueueSectionProps, QueueSectionTriggerProps, QueueTodo, ReasoningContentProps, ReasoningProps, ReasoningTriggerProps, ReferencedSourcesContext, SandboxContentProps, SandboxHeaderProps, SandboxRootProps, SandboxTabContentProps, SandboxTabsBarProps, SandboxTabsListProps, SandboxTabsProps, SandboxTabsTriggerProps, SchemaDisplayBodyProps, SchemaDisplayContentProps, SchemaDisplayDescriptionProps, SchemaDisplayExampleProps, SchemaDisplayHeaderProps, SchemaDisplayMethodProps, SchemaDisplayParameterProps, SchemaDisplayParametersProps, SchemaDisplayPathProps, SchemaDisplayPropertyProps, SchemaDisplayProps, SchemaDisplayRequestProps, SchemaDisplayResponseProps, SelectedArtifact, SnippetAddonProps, SnippetCopyButtonProps, SnippetInputProps, SnippetProps, SnippetTextProps, SourceProps, SourcesContentProps, SourcesProps, SourcesTriggerProps, SpeechInputProps, StackTraceActionsProps, StackTraceContentProps, StackTraceCopyButtonProps, StackTraceErrorMessageProps, StackTraceErrorProps, StackTraceErrorTypeProps, StackTraceExpandButtonProps, StackTraceFramesProps, StackTraceHeaderProps, StackTraceProps, SuggestionProps, SuggestionsProps, TaskContentProps, TaskItemFileProps, TaskItemProps, TaskProps, TaskTriggerProps, TerminalActionsProps, TerminalClearButtonProps, TerminalContentProps, TerminalCopyButtonProps, TerminalHeaderProps, TerminalProps, TerminalStatusProps, TerminalTitleProps, TestDurationProps, TestErrorMessageProps, TestErrorProps, TestErrorStackProps, TestNameProps, TestProps, TestResultsContentProps, TestResultsDurationProps, TestResultsHeaderProps, TestResultsProgressProps, TestResultsProps, TestResultsSummaryProps, TestStatusProps, TestSuiteContentProps, TestSuiteNameProps, TestSuiteProps, TestSuiteStatsProps, TextInputContext, TextShimmerProps, ToolContentProps, ToolHeaderProps, ToolInputProps, ToolOutputProps, ToolPart, ToolProps, TranscriptionProps, TranscriptionSegmentProps, VoiceOverlayProps, VoicePresenceProps, VoiceSelectorAccentProps, VoiceSelectorAgeProps, VoiceSelectorAttributesProps, VoiceSelectorBulletProps, VoiceSelectorContentProps, VoiceSelectorDescriptionProps, VoiceSelectorDialogProps, VoiceSelectorEmptyProps, VoiceSelectorGenderProps, VoiceSelectorGroupProps, VoiceSelectorInputProps, VoiceSelectorItemProps, VoiceSelectorListProps, VoiceSelectorNameProps, VoiceSelectorPreviewProps, VoiceSelectorProps, VoiceSelectorSeparatorProps, VoiceSelectorShortcutProps, VoiceSelectorTriggerProps, VoiceToolbarProps, WebPreviewBodyProps, WebPreviewConsoleProps, WebPreviewContextValue, WebPreviewNavigationButtonProps, WebPreviewNavigationProps, WebPreviewProps, WebPreviewUrlProps } from './components/ai-elements';

// Performance Components and Utilities
export { // Bundle Size
  BackgroundImage, CardSkeleton, ChunkPreloader, CodeEditorSkeleton, DashboardSkeleton, FormSkeleton, ImageSkeleton, LazyBoundary, LazyComponent, ListSkeleton, MessageSkeleton, OptimizedImage, PriorityLoad, ResponsiveImage, TableSkeleton, TerminalSkeleton, ViewSkeleton, VirtualList, VirtualMessageList, lazyImport, useImagePreloader, useVirtualList } from './components/performance';

// Voice Services - Hybrid backend + browser voice capabilities
export * from "./services/voice";
export { ModeProvider, useMode, useModeValue } from './providers/mode-provider';
export {
  VoiceProvider,
  useVoice,
  usePersonaState,
  useVoiceSettings,
  useTTS,
  useSTT,
} from "./providers/voice-provider";
export type {
  VoiceContextState,
  VoiceProviderProps,
} from "./providers/voice-provider";


// Visual Verification Components
export {
  VisualVerificationPanel,
  ConfidenceMeter,
  EvidenceCard,
  ArtifactViewer,
  TrendChart,
} from "./components/visual";
export type {
  ArtifactType,
  EvidenceCardProps,
  ArtifactViewerProps,
  TrendChartProps,
  VisualVerificationPanelProps,
} from "./components/visual";

// Verification View
export { VerificationView } from "./views/VerificationView";
export type { VerificationViewProps } from "./views/VerificationView";

export { tokens } from './design/tokens';
export { GlassSurface, GlassSurfaceBase, GlassSurfaceElevated, GlassSurfaceThick, GlassSurfaceThin, type GlassIntensity, type GlassSurfaceProps } from './design/GlassSurface';
export { GlassCard, GlassCardDanger, GlassCardFlat, GlassCardFloating, GlassCardInteractive, GlassCardPrimary, GlassCardSuccess, GlassCardWarning, type GlassCardProps } from './design/GlassCard';
export { IconButton } from './design/controls/IconButton';
export { SegmentedControl } from './design/controls/SegmentedControl';
export { ActionChip } from './design/controls/ActionChip';
export { motion } from './design/motion/motion';

export { type LegacyServices, initLegacyBridge, legacyBridge } from './integration/allternit/legacy.bridge';
export { type DropHandler, type DropTarget, DropzoneContext, type FileWithData, type GlobalDropzoneContextValue, GlobalDropzoneProvider, useDropTarget, useGlobalDropzone } from './components/GlobalDropzone';

// API Client - The canonical way to communicate with the backend
export {
  api,
  GATEWAY_BASE_URL,
  ALLTERNIT_BASE_URL,
  jobsApi,
  useApi,
  useSessions,
  useSession,
  useSkills,
  useModelDiscovery,
  AllternitApiError,
  type ChatMessage,
  type Session,
  type Skill,
  type Workflow as WorkflowDefinition,
  type Capsule,
  type ToolCall,
  type Agent,
  type ApiErrorDetails,
  type EventType,
  type StreamEvent,
  type EventHandler,
  type ErrorHandler,
  type ProviderAuthStatus,
  type DiscoveredModel,
  type ModelDiscoveryResult,
  type ModelValidationResult,
  type CreateJobRequest,
  type JobRecord,
  type JobQueueStats,
} from "./integration/api-client";

// DEPRECATED EXPORTS - These will be removed in v2.0
// Use api-client.ts instead of these direct integrations:
// - exec.facade.ts (direct kernel calls)
// - integration/kernel/index.ts (direct kernel calls)
// - integration/execution/* (direct kernel calls)

// Vendor wrappers (internal use - re-exported for convenience)
export { AllternitHotkeysProvider, HOTKEY_SCOPES, PLATFORM_SHORTCUTS, useAllternitHotkeys, useHotkeyScopes, useHotkeys } from './vendor/hotkeys';
export { type AllternitCommandAction, AllternitCommandPalette, AllternitCommandProvider, KBarAnimator, KBarPortal, KBarPositioner, KBarProvider, KBarResults, KBarSearch, useAllternitCommand, useMatches, useRegisterActions } from './vendor/command';
export { AllternitPanel as RNPPanel, AllternitPanelGroup as RNPPanelGroup, AllternitResizeHandle as RNPResizeHandle } from './vendor/panels';
export { FlexLayout, FlexLayoutHost, ensureSingletonTab, useFlexLayoutModel } from './vendor/flexlayout';
export { // Accordion
  Accordion, // Alert Dialog
  AlertDialog, // Avatar
  Avatar, // Collapsible
  Collapsible, // Dialog
  Dialog, // Dropdown Menu
  DropdownMenu, // Hover Card
  HoverCard, // Label
  Label, // Popover
  Popover, // Progress
  Progress, // Scroll Area
  ScrollArea, // Select
  Select, // Separator
  Separator, // Slider
  Slider, // Switch
  Switch, // Tabs
  Tabs, // Toggle
  Toggle, // Tooltip
  Tooltip, AccordionContent, AccordionItem, AccordionTrigger, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger, AvatarFallback, AvatarImage, CollapsibleContent, CollapsibleTrigger, DialogContent, DialogDescription, DialogTitle, DialogTrigger, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, HoverCardContent, HoverCardTrigger, PopoverContent, PopoverTrigger, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue, TabsContent, TabsList, TabsTrigger, TooltipContent, TooltipProvider, TooltipTrigger, useControllableState } from './vendor/radix';

export { assertNoDockingOutsideBrowser, assertSinglePrimaryView } from './qa/invariants';
export { runAllSmokeTests, smokeBridge, smokeCommand, smokeConsole, smokeDocking, smokeExecutionBridge, smokeFlexLayout, smokeGlass, smokeHotkeys, smokeNavigation, smokePanels, smokeRadix, smokeReport, smokeRunner } from './qa/smoke';

// Hooks - Ported from Rust consolidation
export {
  useBudget,
  useReplay,
  usePrewarm,
  useWorkflow,
  useToast,
  useProviderAuth,
  useAgentAvatar,
  useVisualVerification,
  DEFAULT_VISUAL_STATE,
  type ToastOptions,
  type UseAgentAvatarOptions,
  type UseAgentAvatarReturn,
  type Measurement,
  type RuntimeBudgetStatus,
  type RuntimeBudgetQuotaUpdate,
  type RuntimeBudgetMetric,
  type RuntimeBudgetAlert,
  type BudgetPercentages,
  type ValidationResult,
  type AuthStatus,
  type ModelsResponse,
  type ModelInfo,
  type ValidationResponse,
  type VerificationResult,
  type VerificationStatus,
  type Artifact,
  type TrendDataPoint,
  type UseVisualVerificationOptions,
  type UseVisualVerificationReturn,
} from "./hooks";

// Services - Ported from Rust consolidation  
export * from "./services";

// Types - Ported from Rust consolidation
export { ActivityType, AlertLevel, CaptureSize, ExecutionStatus, NodeCategory, PoolHealth, PortType, RendererType, ReplayEventType, RuntimeDriver, WorkflowPhase, defaultBrowserConfig, defaultPoolResources, defaultQuotaForm, defaultRuntimeSettings, defaultViewport, developmentPlaywrightConfig, productionPlaywrightConfig } from './types';
export type { BrowserAction, BrowserActionResult, BrowserState, BrowserViewConfig, BudgetAlert, BudgetDashboard, CaptureResult, ClickAction, CookieInfo, DesignerEdge, DesignerNode, EdgeCondition, EvaluateAction, ExecutableEdge, ExecutableNode, ExecutableWorkflow, ExecutionError, ExecutionLog, ExtractAction, FormattedUsageStats, HistoryEntry, LoggingConfig, MeasurementEntry, NavigateAction, NodeExecution, NodePosition, NodeTypeDefinition, PageInfo, PlaywrightConfig, PoolActivity, PoolCreateForm, PoolError, PoolResources, PoolStats, PoolStatus, PortDefinition, PrewarmPoolManager, ProxyConfig, QuotaForm, ReplayEntry, ReplayEvent, ReplayManager, ReplayMetadata, ReplaySession, RetryPolicy, RuntimeResources, RuntimeSettings, SandboxConfig, ScreenshotAction, ScreenshotResult, ScrollAction, SessionConfig, SessionMetadata, SimpleAction, TenantQuota, TypeTextAction, UsageSummary, ValidationError, ViewportSize, ViewportState, WaitForAction, WorkflowDesigner, WorkflowDraft, WorkflowExecution, WorkflowListEntry, WorkflowMonitor, WorkflowSystemStatus, WorkflowTemplate, WorkflowVariable } from './types';

// Performance Utilities
export { // Aliases for convenience
  type BundleSizeReport, DEFAULT_PERFORMANCE_BUDGET, type DebouncedFunction, PERFORMANCE_THRESHOLDS, type PerformanceBudget, type ThrottledFunction, type WebVitalMetric, checkPerformanceBudget, clearMarks, clearMeasures, debounce, debounceLeadingTrailing, mark, measure, memo, memoIgnoring, memoWithComparison, memoWithDeepComparison, observeLongTasks, prefetchResource, preloadResource, rafThrottle, reportWebVitals, throttle, trackBundleSize, useBatchedCallback, useCallback, useCallbackDebug, useConditionalRef, useDebouncedCallback, useDebouncedValue, useFrameRateMonitor, useMemo, useMemoDebug, useMemoizedComputation, useMemoizedDerived, useMemoizedList, useMountTiming, useRafCallback, useRenderCount, useRenderPerformance, useResizeHandler, useScrollHandler, useStableCallback, useThrottledCallback, useThrottledValue, useUpdatingRef, useWhyDidYouUpdate } from './lib/performance';

// Lazy loading utilities
export {
  preloadView,
  preloadViews,
  getViewSkeleton,
} from "./views/lazyRegistry";

import type { Client, Options as Options2, TDataShape } from './client';
import type { AgentCreateData, AgentGetData, AgentListData, AgentUpdateData, AppSkillsData, ArsContextaEnrichData, ArsContextaEntitiesData, ArsContextaHealthData, ArsContextaInsightsData, ArsContextaProvidersData, AssetDeleteData, AssetGetData, AssetListData, AssetUploadData, AuthRemoveData, AuthSetData, CommandListData, ConfigGetData, ConfigProvidersData, ConfigUpdateData, CronAllRunsData, CronCleanupSessionData, CronCreateData, CronDeleteData, CronGetData, CronGetRunData, CronListData, CronPauseData, CronResumeData, CronRunData, CronRunsData, CronStatusData, CronUpdateData, CronWakeData, EngineExecuteData, EngineHealthData, EngineReceiptsData, EngineRunApprovalData, EngineRunCancelData, EngineRunEventsData, EngineRunGetData, EngineRunPauseData, EngineRunResumeData, EngineSnapshotData, EngineWatchData, EventSubscribeData, FileGlobData, FileInfoData, FileReadData, FilesDeleteData, FileSearchData, FilesGetData, FilesListData, FilesUploadData, FileSymbolsData, FileTreeData, FormatterStatusData, GetV1MemorySearchData, GlobalEventData, GlobalHealthData, GlobalVersionData, InstanceDisposeData, InstanceHealthData, InstanceSyncData, InstanceVersionData, InstanceWorkspaceData, LspStatusData, McpAddData, McpListData, McpRemoveData, McpResourcesData, McpStatusData, PathGetData, PermissionListData, PermissionReplyData, PostV1PluginInstallData, PostV1PluginRemoveData, ProjectAgentListData, ProjectFindFileData, ProjectGetData, ProjectInitData, ProjectListData, ProjectListRootData, ProjectSessionAbortData, ProjectSessionCompactData, ProjectSessionCreateData, ProjectSessionDeleteData, ProjectSessionFileFindData, ProjectSessionFileReadData, ProjectSessionFileStatusData, ProjectSessionGetData, ProjectSessionInitializeData, ProjectSessionListData, ProjectSessionMessageCreateData, ProjectSessionMessageGetData, ProjectSessionMessagesData, ProjectSessionPermissionReplyData, ProjectSessionRevertData, ProjectSessionShareData, ProjectSessionUnrevertData, ProjectSessionUnshareData, ProjectUpdateData, ProviderAuthData, ProviderListData, ProviderOauthAuthorizeData, ProviderOauthVerifyData, PtyCreateData, PtyGetData, PtyKillData, PtyListData, PutV1MemoryByFilenameData, PutV1MemoryL1BySessionIdData, PutV1MemoryL2ByTypeData, QuestionListData, QuestionRejectData, QuestionReplyData, SandboxDisableData, SandboxEnableData, SandboxGetData, SandboxPolicyData, SandboxToggleData, SessionAbortData, SessionAllStatusData, SessionChildrenData, SessionClearData, SessionCommandData, SessionCreateData, SessionDeleteData, SessionDiffData, SessionForkData, SessionGetData, SessionInitializeData, SessionListData, SessionListGlobalData, SessionMessagesData, SessionPromptData, SessionRevertData, SessionShareData, SessionSummarizeData, SessionTodoData, SessionUnrevertData, SessionUpdateData, SkillAddData, SkillEvalData, SkillEvalsGetData, SkillEvalsListData, SkillInstallData, SkillPublishData, SkillRegistryData, SkillToolIdsData, SkillToolsData, TerminalClerkCallbackData, TerminalClerkClaimData, TerminalClerkPollData, TerminalClerkStartData, TokensCountData, TuiAppendPromptData, TuiClearPromptData, TuiControlNextData, TuiControlResponseData, TuiExecuteCommandData, TuiOpenHelpData, TuiOpenModelsData, TuiOpenSessionsData, TuiOpenThemesData, TuiPublishData, TuiSelectSessionData, TuiShowToastData, TuiSubmitPromptData, UserClearData, UserGetData, UserOnboardData, UserRefreshData, VcsGetData, VcsWorktreeCreateData, VcsWorktreeRemoveData, VmSessionDestroyData, VmSessionDisableData, VmSessionEnableData, VmSessionGetData, VmSessionToggleData, WorkspaceActivateData, WorkspaceGetData, WorkspaceIdentityGetData, WorkspaceIdentityPutData, WorkspaceImportData, WorkspaceInitData, WorkspaceLayersData, WorkspaceMemoryGetData, WorkspaceMemoryPostData, WorkspaceSkillsData } from './types.gen';
export type Options<TData extends TDataShape = TDataShape, ThrowOnError extends boolean = boolean> = Options2<TData, ThrowOnError> & {
    /**
     * You can provide a client instance returned by `createClient()` instead of
     * individual options. This might be also useful if you want to implement a
     * custom client.
     */
    client?: Client;
    /**
     * You can pass arbitrary values through the `meta` object. This can be
     * used to access values that aren't defined as part of the SDK function.
     */
    meta?: Record<string, unknown>;
};
/**
 * List global sessions
 *
 * Retrieve a list of all sessions across all projects.
 */
export declare const sessionListGlobal: <ThrowOnError extends boolean = false>(options?: Options<SessionListGlobalData, ThrowOnError>) => any;
/**
 * List sessions
 *
 * Retrieve a list of all active and archived sessions.
 */
export declare const sessionList: <ThrowOnError extends boolean = false>(options?: Options<SessionListData, ThrowOnError>) => any;
/**
 * Create session
 *
 * Create a new session.
 */
export declare const sessionCreate: <ThrowOnError extends boolean = false>(options: Options<SessionCreateData, ThrowOnError>) => any;
/**
 * Get all session statuses
 *
 * Retrieve the current status (idle, busy, etc.) for all active sessions.
 */
export declare const sessionAllStatus: <ThrowOnError extends boolean = false>(options?: Options<SessionAllStatusData, ThrowOnError>) => any;
/**
 * Delete session
 *
 * Delete a session and all its messages.
 */
export declare const sessionDelete: <ThrowOnError extends boolean = false>(options: Options<SessionDeleteData, ThrowOnError>) => any;
/**
 * Get session details
 *
 * Retrieve detailed information about a specific session by its ID.
 */
export declare const sessionGet: <ThrowOnError extends boolean = false>(options: Options<SessionGetData, ThrowOnError>) => any;
/**
 * Update session
 *
 * Update session properties like title.
 */
export declare const sessionUpdate: <ThrowOnError extends boolean = false>(options: Options<SessionUpdateData, ThrowOnError>) => any;
/**
 * Initialize session
 *
 * Initialize a session with a starting message or context.
 */
export declare const sessionInitialize: <ThrowOnError extends boolean = false>(options: Options<SessionInitializeData, ThrowOnError>) => any;
/**
 * List session messages
 *
 * Retrieve all messages belonging to a specific session.
 */
export declare const sessionMessages: <ThrowOnError extends boolean = false>(options: Options<SessionMessagesData, ThrowOnError>) => any;
/**
 * Send message to session
 *
 * Send a prompt message to a session and trigger the agent loop.
 */
export declare const sessionPrompt: <ThrowOnError extends boolean = false>(options: Options<SessionPromptData, ThrowOnError>) => any;
/**
 * Run command in session
 *
 * Execute a command within a session context.
 */
export declare const sessionCommand: <ThrowOnError extends boolean = false>(options: Options<SessionCommandData, ThrowOnError>) => any;
/**
 * Abort session
 *
 * Abort the currently running agent loop for a session.
 */
export declare const sessionAbort: <ThrowOnError extends boolean = false>(options: Options<SessionAbortData, ThrowOnError>) => any;
/**
 * Fork session
 *
 * Create a fork of an existing session.
 */
export declare const sessionFork: <ThrowOnError extends boolean = false>(options: Options<SessionForkData, ThrowOnError>) => any;
/**
 * Share session
 *
 * Share a session publicly.
 */
export declare const sessionShare: <ThrowOnError extends boolean = false>(options: Options<SessionShareData, ThrowOnError>) => any;
/**
 * Get session diff
 *
 * Get file diffs for a session.
 */
export declare const sessionDiff: <ThrowOnError extends boolean = false>(options: Options<SessionDiffData, ThrowOnError>) => any;
/**
 * Summarize session
 *
 * Generate a summary for a session.
 */
export declare const sessionSummarize: <ThrowOnError extends boolean = false>(options: Options<SessionSummarizeData, ThrowOnError>) => any;
/**
 * Revert session
 *
 * Revert file changes made during a session.
 */
export declare const sessionRevert: <ThrowOnError extends boolean = false>(options: Options<SessionRevertData, ThrowOnError>) => any;
/**
 * Unrevert session
 *
 * Undo a revert, restoring the session changes.
 */
export declare const sessionUnrevert: <ThrowOnError extends boolean = false>(options: Options<SessionUnrevertData, ThrowOnError>) => any;
/**
 * List session children
 *
 * List child sessions (forks) of a session.
 */
export declare const sessionChildren: <ThrowOnError extends boolean = false>(options: Options<SessionChildrenData, ThrowOnError>) => any;
/**
 * Get session todos
 *
 * Get todo items for a session.
 */
export declare const sessionTodo: <ThrowOnError extends boolean = false>(options: Options<SessionTodoData, ThrowOnError>) => any;
/**
 * Clear session messages
 *
 * Delete all messages and parts for a session.
 */
export declare const sessionClear: <ThrowOnError extends boolean = false>(options: Options<SessionClearData, ThrowOnError>) => any;
/**
 * List agents
 *
 * Retrieve a list of all agents available in the system.
 */
export declare const agentList: <ThrowOnError extends boolean = false>(options?: Options<AgentListData, ThrowOnError>) => any;
/**
 * Create agent
 *
 * Create a new agent definition.
 */
export declare const agentCreate: <ThrowOnError extends boolean = false>(options: Options<AgentCreateData, ThrowOnError>) => any;
/**
 * Get agent details
 *
 * Retrieve detailed information about a specific agent by its ID.
 */
export declare const agentGet: <ThrowOnError extends boolean = false>(options: Options<AgentGetData, ThrowOnError>) => any;
/**
 * Update agent
 *
 * Update the configuration of an existing agent.
 */
export declare const agentUpdate: <ThrowOnError extends boolean = false>(options: Options<AgentUpdateData, ThrowOnError>) => any;
/**
 * List commands
 *
 * Retrieve all slash commands available in the current instance.
 */
export declare const commandList: <ThrowOnError extends boolean = false>(options?: Options<CommandListData, ThrowOnError>) => any;
/**
 * List providers
 *
 * Get a list of all available AI providers, including both available and connected ones.
 */
export declare const providerList: <ThrowOnError extends boolean = false>(options?: Options<ProviderListData, ThrowOnError>) => any;
/**
 * Get provider auth methods
 *
 * Retrieve available authentication methods for all AI providers.
 */
export declare const providerAuth: <ThrowOnError extends boolean = false>(options?: Options<ProviderAuthData, ThrowOnError>) => any;
/**
 * OAuth authorize
 *
 * Initiate OAuth authorization for a specific AI provider to get an authorization URL.
 */
export declare const providerOauthAuthorize: <ThrowOnError extends boolean = false>(options: Options<ProviderOauthAuthorizeData, ThrowOnError>) => any;
/**
 * OAuth verify
 *
 * Verify the OAuth authorization result from an AI provider.
 */
export declare const providerOauthVerify: <ThrowOnError extends boolean = false>(options: Options<ProviderOauthVerifyData, ThrowOnError>) => any;
/**
 * Get configuration
 *
 * Retrieve the current GIZZI configuration settings and preferences.
 */
export declare const configGet: <ThrowOnError extends boolean = false>(options?: Options<ConfigGetData, ThrowOnError>) => any;
/**
 * Update configuration
 *
 * Update GIZZI configuration settings and preferences.
 */
export declare const configUpdate: <ThrowOnError extends boolean = false>(options: Options<ConfigUpdateData, ThrowOnError>) => any;
/**
 * List config providers
 *
 * Get a list of all configured AI providers and their default models.
 */
export declare const configProviders: <ThrowOnError extends boolean = false>(options?: Options<ConfigProvidersData, ThrowOnError>) => any;
/**
 * Get MCP status
 *
 * Retrieve the current status of all configured and connected MCP servers.
 */
export declare const mcpStatus: <ThrowOnError extends boolean = false>(options?: Options<McpStatusData, ThrowOnError>) => any;
/**
 * List MCP servers
 *
 * Retrieve a list of all configured and active MCP (Model Context Protocol) servers.
 */
export declare const mcpList: <ThrowOnError extends boolean = false>(options?: Options<McpListData, ThrowOnError>) => any;
/**
 * Add MCP server
 *
 * Configure and add a new MCP server to the system.
 */
export declare const mcpAdd: <ThrowOnError extends boolean = false>(options: Options<McpAddData, ThrowOnError>) => any;
/**
 * List MCP resources
 *
 * Retrieve a list of all available resources across all registered MCP servers.
 */
export declare const mcpResources: <ThrowOnError extends boolean = false>(options?: Options<McpResourcesData, ThrowOnError>) => any;
/**
 * Remove MCP server
 *
 * Remove a configured MCP server by its name.
 */
export declare const mcpRemove: <ThrowOnError extends boolean = false>(options: Options<McpRemoveData, ThrowOnError>) => any;
/**
 * Get cron status
 *
 * Get overall cron service status
 */
export declare const cronStatus: <ThrowOnError extends boolean = false>(options?: Options<CronStatusData, ThrowOnError>) => any;
/**
 * List cron jobs
 *
 * Get all cron jobs
 */
export declare const cronList: <ThrowOnError extends boolean = false>(options?: Options<CronListData, ThrowOnError>) => any;
/**
 * Create cron job
 *
 * Create a new scheduled job
 */
export declare const cronCreate: <ThrowOnError extends boolean = false>(options: Options<CronCreateData, ThrowOnError>) => any;
/**
 * Delete cron job
 *
 * Delete a cron job
 */
export declare const cronDelete: <ThrowOnError extends boolean = false>(options: Options<CronDeleteData, ThrowOnError>) => any;
/**
 * Get cron job
 *
 * Get details of a specific cron job
 */
export declare const cronGet: <ThrowOnError extends boolean = false>(options: Options<CronGetData, ThrowOnError>) => any;
/**
 * Update cron job
 *
 * Update an existing cron job
 */
export declare const cronUpdate: <ThrowOnError extends boolean = false>(options: Options<CronUpdateData, ThrowOnError>) => any;
/**
 * Pause cron job
 *
 * Pause a cron job temporarily
 */
export declare const cronPause: <ThrowOnError extends boolean = false>(options: Options<CronPauseData, ThrowOnError>) => any;
/**
 * Resume cron job
 *
 * Resume a paused cron job
 */
export declare const cronResume: <ThrowOnError extends boolean = false>(options: Options<CronResumeData, ThrowOnError>) => any;
/**
 * Trigger cron job
 *
 * Manually trigger a cron job to run immediately
 */
export declare const cronRun: <ThrowOnError extends boolean = false>(options: Options<CronRunData, ThrowOnError>) => any;
/**
 * List job runs
 *
 * Get run history for a specific job
 */
export declare const cronRuns: <ThrowOnError extends boolean = false>(options: Options<CronRunsData, ThrowOnError>) => any;
/**
 * List all runs
 *
 * Get all cron runs across all jobs
 */
export declare const cronAllRuns: <ThrowOnError extends boolean = false>(options?: Options<CronAllRunsData, ThrowOnError>) => any;
/**
 * Get run
 *
 * Get details of a specific run
 */
export declare const cronGetRun: <ThrowOnError extends boolean = false>(options: Options<CronGetRunData, ThrowOnError>) => any;
/**
 * Wake cron service
 *
 * Trigger due jobs immediately
 */
export declare const cronWake: <ThrowOnError extends boolean = false>(options?: Options<CronWakeData, ThrowOnError>) => any;
/**
 * Cleanup session loops
 *
 * Delete all session-scoped cron jobs for a session (called on session close).
 */
export declare const cronCleanupSession: <ThrowOnError extends boolean = false>(options: Options<CronCleanupSessionData, ThrowOnError>) => any;
/**
 * Respond to permission request
 *
 * Approve or deny a permission request from the AI assistant.
 */
export declare const permissionReply: <ThrowOnError extends boolean = false>(options: Options<PermissionReplyData, ThrowOnError>) => any;
/**
 * List pending permissions
 *
 * Get all pending permission requests across all sessions.
 */
export declare const permissionList: <ThrowOnError extends boolean = false>(options?: Options<PermissionListData, ThrowOnError>) => any;
/**
 * List pending questions
 *
 * Get all pending question requests across all sessions.
 */
export declare const questionList: <ThrowOnError extends boolean = false>(options?: Options<QuestionListData, ThrowOnError>) => any;
/**
 * Reply to question request
 *
 * Provide answers to a question request from the AI assistant.
 */
export declare const questionReply: <ThrowOnError extends boolean = false>(options: Options<QuestionReplyData, ThrowOnError>) => any;
/**
 * Reject question request
 *
 * Reject a question request from the AI assistant.
 */
export declare const questionReject: <ThrowOnError extends boolean = false>(options: Options<QuestionRejectData, ThrowOnError>) => any;
/**
 * Search file contents
 *
 * Perform a high-performance content search across the workspace using ripgrep.
 */
export declare const fileSearch: <ThrowOnError extends boolean = false>(options?: Options<FileSearchData, ThrowOnError>) => any;
/**
 * Find files by glob pattern
 *
 * List files matching a specific glob pattern within the workspace.
 */
export declare const fileGlob: <ThrowOnError extends boolean = false>(options?: Options<FileGlobData, ThrowOnError>) => any;
/**
 * List file symbols
 *
 * Retrieve all code symbols (functions, classes, variables) defined in a specific file.
 */
export declare const fileSymbols: <ThrowOnError extends boolean = false>(options?: Options<FileSymbolsData, ThrowOnError>) => any;
/**
 * Get file tree
 *
 * Retrieve a hierarchical tree representation of the workspace file structure.
 */
export declare const fileTree: <ThrowOnError extends boolean = false>(options?: Options<FileTreeData, ThrowOnError>) => any;
/**
 * Read file content
 *
 * Retrieve the full text content of a specific file.
 */
export declare const fileRead: <ThrowOnError extends boolean = false>(options?: Options<FileReadData, ThrowOnError>) => any;
/**
 * Get file info
 *
 * Retrieve basic metadata (size, permissions, etc.) for a list of files.
 */
export declare const fileInfo: <ThrowOnError extends boolean = false>(options?: Options<FileInfoData, ThrowOnError>) => any;
/**
 * Upload asset
 *
 * Upload a binary or text asset and receive an asset ID.
 */
export declare const assetUpload: <ThrowOnError extends boolean = false>(options?: Options<AssetUploadData, ThrowOnError>) => any;
/**
 * List assets
 *
 * List uploaded assets for the current workspace.
 */
export declare const assetList: <ThrowOnError extends boolean = false>(options?: Options<AssetListData, ThrowOnError>) => any;
/**
 * Delete asset
 *
 * Delete an uploaded asset.
 */
export declare const assetDelete: <ThrowOnError extends boolean = false>(options: Options<AssetDeleteData, ThrowOnError>) => any;
/**
 * Get asset metadata
 *
 * Get metadata for a previously uploaded asset.
 */
export declare const assetGet: <ThrowOnError extends boolean = false>(options: Options<AssetGetData, ThrowOnError>) => any;
/**
 * List files
 *
 * Legacy compatibility alias for the canonical asset listing API.
 */
export declare const filesList: <ThrowOnError extends boolean = false>(options?: Options<FilesListData, ThrowOnError>) => any;
/**
 * Upload file
 *
 * Legacy compatibility alias for the canonical asset upload API.
 */
export declare const filesUpload: <ThrowOnError extends boolean = false>(options?: Options<FilesUploadData, ThrowOnError>) => any;
/**
 * Delete file
 *
 * Legacy compatibility alias for the canonical asset delete API.
 */
export declare const filesDelete: <ThrowOnError extends boolean = false>(options: Options<FilesDeleteData, ThrowOnError>) => any;
/**
 * Get file metadata
 *
 * Legacy compatibility alias for the canonical asset metadata API.
 */
export declare const filesGet: <ThrowOnError extends boolean = false>(options: Options<FilesGetData, ThrowOnError>) => any;
/**
 * Get current user
 *
 * Get the currently authenticated user's information.
 */
export declare const userGet: <ThrowOnError extends boolean = false>(options?: Options<UserGetData, ThrowOnError>) => any;
/**
 * Refresh user data
 *
 * Force refresh user data from Clerk/platform.
 */
export declare const userRefresh: <ThrowOnError extends boolean = false>(options?: Options<UserRefreshData, ThrowOnError>) => any;
/**
 * Complete user onboarding
 *
 * Save user info from onboarding and mark onboarding as complete.
 */
export declare const userOnboard: <ThrowOnError extends boolean = false>(options: Options<UserOnboardData, ThrowOnError>) => any;
/**
 * Clear user data
 *
 * Clear all user data (logout).
 */
export declare const userClear: <ThrowOnError extends boolean = false>(options?: Options<UserClearData, ThrowOnError>) => any;
/**
 * List PTYs
 *
 * Retrieve a list of all active PTY (Pseudo-Terminal) sessions.
 */
export declare const ptyList: <ThrowOnError extends boolean = false>(options?: Options<PtyListData, ThrowOnError>) => any;
/**
 * Create PTY
 *
 * Create a new PTY (Pseudo-Terminal) session.
 */
export declare const ptyCreate: <ThrowOnError extends boolean = false>(options: Options<PtyCreateData, ThrowOnError>) => any;
/**
 * Kill PTY
 *
 * Terminate an active PTY (Pseudo-Terminal) session.
 */
export declare const ptyKill: <ThrowOnError extends boolean = false>(options: Options<PtyKillData, ThrowOnError>) => any;
/**
 * Get PTY details
 *
 * Retrieve detailed information about a specific PTY session by its ID.
 */
export declare const ptyGet: <ThrowOnError extends boolean = false>(options: Options<PtyGetData, ThrowOnError>) => any;
/**
 * Sync TUI state
 *
 * Emit instance.sync event with full TUI hydration snapshot
 */
export declare const instanceSync: <ThrowOnError extends boolean = false>(options?: Options<InstanceSyncData, ThrowOnError>) => any;
/**
 * Dispose instance
 *
 * Clean up and dispose the current GIZZI instance, releasing all resources.
 */
export declare const instanceDispose: <ThrowOnError extends boolean = false>(options?: Options<InstanceDisposeData, ThrowOnError>) => any;
/**
 * Get workspace identity
 *
 * Detect and return the active GizziClaw/.openclaw workspace identity.
 */
export declare const instanceWorkspace: <ThrowOnError extends boolean = false>(options?: Options<InstanceWorkspaceData, ThrowOnError>) => any;
/**
 * Get version
 *
 * Get the current version of the gizzi-code server.
 */
export declare const instanceVersion: <ThrowOnError extends boolean = false>(options?: Options<InstanceVersionData, ThrowOnError>) => any;
/**
 * Health check
 *
 * Returns healthy status and server version.
 */
export declare const instanceHealth: <ThrowOnError extends boolean = false>(options?: Options<InstanceHealthData, ThrowOnError>) => any;
/**
 * Append TUI prompt
 *
 * Append prompt to the TUI
 */
export declare const tuiAppendPrompt: <ThrowOnError extends boolean = false>(options: Options<TuiAppendPromptData, ThrowOnError>) => any;
/**
 * Open help dialog
 *
 * Open the help dialog in the TUI to display user assistance information.
 */
export declare const tuiOpenHelp: <ThrowOnError extends boolean = false>(options?: Options<TuiOpenHelpData, ThrowOnError>) => any;
/**
 * Open sessions dialog
 *
 * Open the session dialog
 */
export declare const tuiOpenSessions: <ThrowOnError extends boolean = false>(options?: Options<TuiOpenSessionsData, ThrowOnError>) => any;
/**
 * Open themes dialog
 *
 * Open the theme dialog
 */
export declare const tuiOpenThemes: <ThrowOnError extends boolean = false>(options?: Options<TuiOpenThemesData, ThrowOnError>) => any;
/**
 * Open models dialog
 *
 * Open the model dialog
 */
export declare const tuiOpenModels: <ThrowOnError extends boolean = false>(options?: Options<TuiOpenModelsData, ThrowOnError>) => any;
/**
 * Submit TUI prompt
 *
 * Submit the prompt
 */
export declare const tuiSubmitPrompt: <ThrowOnError extends boolean = false>(options?: Options<TuiSubmitPromptData, ThrowOnError>) => any;
/**
 * Clear TUI prompt
 *
 * Clear the prompt
 */
export declare const tuiClearPrompt: <ThrowOnError extends boolean = false>(options?: Options<TuiClearPromptData, ThrowOnError>) => any;
/**
 * Execute TUI command
 *
 * Execute a TUI command (e.g. agent_cycle)
 */
export declare const tuiExecuteCommand: <ThrowOnError extends boolean = false>(options: Options<TuiExecuteCommandData, ThrowOnError>) => any;
/**
 * Show TUI toast
 *
 * Show a toast notification in the TUI
 */
export declare const tuiShowToast: <ThrowOnError extends boolean = false>(options: Options<TuiShowToastData, ThrowOnError>) => any;
/**
 * Publish TUI event
 *
 * Publish a TUI event
 */
export declare const tuiPublish: <ThrowOnError extends boolean = false>(options: Options<TuiPublishData, ThrowOnError>) => any;
/**
 * Select session
 *
 * Navigate the TUI to display the specified session.
 */
export declare const tuiSelectSession: <ThrowOnError extends boolean = false>(options: Options<TuiSelectSessionData, ThrowOnError>) => any;
/**
 * Get next TUI request
 *
 * Retrieve the next TUI (Terminal User Interface) request from the queue for processing.
 */
export declare const tuiControlNext: <ThrowOnError extends boolean = false>(options?: Options<TuiControlNextData, ThrowOnError>) => any;
/**
 * Submit TUI response
 *
 * Submit a response to the TUI request queue to complete a pending request.
 */
export declare const tuiControlResponse: <ThrowOnError extends boolean = false>(options: Options<TuiControlResponseData, ThrowOnError>) => any;
/**
 * Get paths
 *
 * Retrieve the current working directory and related path information for the GIZZI instance.
 */
export declare const pathGet: <ThrowOnError extends boolean = false>(options?: Options<PathGetData, ThrowOnError>) => any;
/**
 * Get VCS info
 *
 * Retrieve version control system (VCS) information for the current project, such as git branch.
 */
export declare const vcsGet: <ThrowOnError extends boolean = false>(options?: Options<VcsGetData, ThrowOnError>) => any;
/**
 * Remove worktree
 *
 * Remove an existing git worktree by its name.
 */
export declare const vcsWorktreeRemove: <ThrowOnError extends boolean = false>(options: Options<VcsWorktreeRemoveData, ThrowOnError>) => any;
/**
 * Create worktree
 *
 * Create a new git worktree for the current project and run any configured startup scripts.
 */
export declare const vcsWorktreeCreate: <ThrowOnError extends boolean = false>(options: Options<VcsWorktreeCreateData, ThrowOnError>) => any;
/**
 * Get LSP status
 *
 * Get LSP server status
 */
export declare const lspStatus: <ThrowOnError extends boolean = false>(options?: Options<LspStatusData, ThrowOnError>) => any;
/**
 * Get formatter status
 *
 * Get formatter status
 */
export declare const formatterStatus: <ThrowOnError extends boolean = false>(options?: Options<FormatterStatusData, ThrowOnError>) => any;
/**
 * List tool IDs
 *
 * Get a list of all available tool IDs, including built-in and dynamically registered tools.
 */
export declare const skillToolIds: <ThrowOnError extends boolean = false>(options?: Options<SkillToolIdsData, ThrowOnError>) => any;
/**
 * List tools
 *
 * Get available tools with their JSON schema parameters for a given provider/model.
 */
export declare const skillTools: <ThrowOnError extends boolean = false>(options?: Options<SkillToolsData, ThrowOnError>) => any;
/**
 * List skills
 *
 * Get a list of all available skills.
 */
export declare const appSkills: <ThrowOnError extends boolean = false>(options?: Options<AppSkillsData, ThrowOnError>) => any;
/**
 * Add skill from URL
 *
 * Download and register skills from a remote index URL.
 */
export declare const skillAdd: <ThrowOnError extends boolean = false>(options: Options<SkillAddData, ThrowOnError>) => any;
/**
 * Evaluate skill
 *
 * Run N parallel eval passes of a skill against test input and rubric criteria.
 */
export declare const skillEval: <ThrowOnError extends boolean = false>(options: Options<SkillEvalData, ThrowOnError>) => any;
/**
 * List skill evals
 *
 * List all eval reports for a skill.
 */
export declare const skillEvalsList: <ThrowOnError extends boolean = false>(options: Options<SkillEvalsListData, ThrowOnError>) => any;
/**
 * Get skill eval
 *
 * Get a specific eval report by ID.
 */
export declare const skillEvalsGet: <ThrowOnError extends boolean = false>(options: Options<SkillEvalsGetData, ThrowOnError>) => any;
/**
 * List public skill registry entries
 *
 * Return paginated public skill registry entries.
 */
export declare const skillRegistry: <ThrowOnError extends boolean = false>(options?: Options<SkillRegistryData, ThrowOnError>) => any;
/**
 * Publish skill
 *
 * Publish a skill manifest into the registry.
 */
export declare const skillPublish: <ThrowOnError extends boolean = false>(options: Options<SkillPublishData, ThrowOnError>) => any;
/**
 * Install skill from registry
 *
 * Install a published skill into the current workspace namespace.
 */
export declare const skillInstall: <ThrowOnError extends boolean = false>(options: Options<SkillInstallData, ThrowOnError>) => any;
export declare const getV1MemorySearch: <ThrowOnError extends boolean = false>(options?: Options<GetV1MemorySearchData, ThrowOnError>) => any;
export declare const putV1MemoryL2ByType: <ThrowOnError extends boolean = false>(options: Options<PutV1MemoryL2ByTypeData, ThrowOnError>) => any;
export declare const putV1MemoryL1BySessionId: <ThrowOnError extends boolean = false>(options: Options<PutV1MemoryL1BySessionIdData, ThrowOnError>) => any;
export declare const putV1MemoryByFilename: <ThrowOnError extends boolean = false>(options: Options<PutV1MemoryByFilenameData, ThrowOnError>) => any;
/**
 * Count prompt tokens
 *
 * Estimate prompt token usage for messages, system prompt, and tool definitions.
 */
export declare const tokensCount: <ThrowOnError extends boolean = false>(options: Options<TokensCountData, ThrowOnError>) => any;
/**
 * Execute managed computer-use run
 *
 * Create and start a computer-use run on the managed gizzi-code server surface.
 */
export declare const engineExecute: <ThrowOnError extends boolean = false>(options: Options<EngineExecuteData, ThrowOnError>) => any;
/**
 * Watch computer-use run
 *
 * Stream event batches for a managed computer-use run via SSE.
 */
export declare const engineWatch: <ThrowOnError extends boolean = false>(options: Options<EngineWatchData, ThrowOnError>) => any;
/**
 * Get computer-use receipts
 *
 * Return the stored receipts for a managed computer-use run.
 */
export declare const engineReceipts: <ThrowOnError extends boolean = false>(options: Options<EngineReceiptsData, ThrowOnError>) => any;
/**
 * Get computer-use snapshot
 *
 * Return the latest snapshot for a managed computer-use run.
 */
export declare const engineSnapshot: <ThrowOnError extends boolean = false>(options: Options<EngineSnapshotData, ThrowOnError>) => any;
/**
 * Get computer-use run
 *
 * Compatibility alias for the latest managed computer-use run snapshot.
 */
export declare const engineRunGet: <ThrowOnError extends boolean = false>(options: Options<EngineRunGetData, ThrowOnError>) => any;
/**
 * Get computer-use run events
 *
 * Return a paginated event batch for a managed computer-use run.
 */
export declare const engineRunEvents: <ThrowOnError extends boolean = false>(options: Options<EngineRunEventsData, ThrowOnError>) => any;
/**
 * Approve or deny computer-use run
 *
 * Apply an approval decision to a managed computer-use run.
 */
export declare const engineRunApproval: <ThrowOnError extends boolean = false>(options: Options<EngineRunApprovalData, ThrowOnError>) => any;
/**
 * Cancel computer-use run
 *
 * Cancel a managed computer-use run in the server-owned run registry.
 */
export declare const engineRunCancel: <ThrowOnError extends boolean = false>(options: Options<EngineRunCancelData, ThrowOnError>) => any;
/**
 * Pause computer-use run
 *
 * Pause a managed computer-use run through the operator-native engine control surface.
 */
export declare const engineRunPause: <ThrowOnError extends boolean = false>(options: Options<EngineRunPauseData, ThrowOnError>) => any;
/**
 * Resume computer-use run
 *
 * Resume a paused managed computer-use run through the operator-native engine control surface.
 */
export declare const engineRunResume: <ThrowOnError extends boolean = false>(options: Options<EngineRunResumeData, ThrowOnError>) => any;
/**
 * Computer-use engine health
 *
 * Report whether the managed computer-use surface can reach the operator.
 */
export declare const engineHealth: <ThrowOnError extends boolean = false>(options?: Options<EngineHealthData, ThrowOnError>) => any;
/**
 * Get sandbox state
 *
 * Get the current sandbox state for a session.
 */
export declare const sandboxGet: <ThrowOnError extends boolean = false>(options: Options<SandboxGetData, ThrowOnError>) => any;
/**
 * Enable sandbox
 *
 * Enable shell sandbox for a session.
 */
export declare const sandboxEnable: <ThrowOnError extends boolean = false>(options: Options<SandboxEnableData, ThrowOnError>) => any;
/**
 * Disable sandbox
 *
 * Disable shell sandbox for a session.
 */
export declare const sandboxDisable: <ThrowOnError extends boolean = false>(options: Options<SandboxDisableData, ThrowOnError>) => any;
/**
 * Toggle sandbox
 *
 * Toggle shell sandbox on/off for a session.
 */
export declare const sandboxToggle: <ThrowOnError extends boolean = false>(options: Options<SandboxToggleData, ThrowOnError>) => any;
/**
 * Update sandbox policy
 *
 * Update network access or add write paths to an active sandbox.
 */
export declare const sandboxPolicy: <ThrowOnError extends boolean = false>(options: Options<SandboxPolicyData, ThrowOnError>) => any;
/**
 * Destroy VM session
 *
 * Destroy the VM session (same as disable, REST-style).
 */
export declare const vmSessionDestroy: <ThrowOnError extends boolean = false>(options: Options<VmSessionDestroyData, ThrowOnError>) => any;
/**
 * Get VM session state
 *
 * Get the current VM session state for a gizzi session.
 */
export declare const vmSessionGet: <ThrowOnError extends boolean = false>(options: Options<VmSessionGetData, ThrowOnError>) => any;
/**
 * Enable VM session
 *
 * Provision a VM for this gizzi session.
 */
export declare const vmSessionEnable: <ThrowOnError extends boolean = false>(options: Options<VmSessionEnableData, ThrowOnError>) => any;
/**
 * Disable VM session
 *
 * Destroy the VM for this gizzi session.
 */
export declare const vmSessionDisable: <ThrowOnError extends boolean = false>(options: Options<VmSessionDisableData, ThrowOnError>) => any;
/**
 * Toggle VM session
 *
 * Toggle VM session on or off for a gizzi session.
 */
export declare const vmSessionToggle: <ThrowOnError extends boolean = false>(options: Options<VmSessionToggleData, ThrowOnError>) => any;
export declare const postV1PluginInstall: <ThrowOnError extends boolean = false>(options: Options<PostV1PluginInstallData, ThrowOnError>) => any;
export declare const postV1PluginRemove: <ThrowOnError extends boolean = false>(options: Options<PostV1PluginRemoveData, ThrowOnError>) => any;
/**
 * Subscribe to events
 *
 * Get events
 */
export declare const eventSubscribe: <ThrowOnError extends boolean = false>(options?: Options<EventSubscribeData, ThrowOnError>) => any;
/**
 * Ars Contexta health check
 *
 * Check if Ars Contexta services are available
 */
export declare const arsContextaHealth: <ThrowOnError extends boolean = false>(options?: Options<ArsContextaHealthData, ThrowOnError>) => any;
/**
 * Generate insights
 *
 * Use LLM to generate insights from content
 */
export declare const arsContextaInsights: <ThrowOnError extends boolean = false>(options: Options<ArsContextaInsightsData, ThrowOnError>) => any;
/**
 * Extract entities
 *
 * Use NLP to extract entities from text
 */
export declare const arsContextaEntities: <ThrowOnError extends boolean = false>(options: Options<ArsContextaEntitiesData, ThrowOnError>) => any;
/**
 * Enrich content
 *
 * Combined LLM insight generation and NLP entity extraction
 */
export declare const arsContextaEnrich: <ThrowOnError extends boolean = false>(options: Options<ArsContextaEnrichData, ThrowOnError>) => any;
/**
 * List available providers
 *
 * Get list of available LLM and NLP providers
 */
export declare const arsContextaProviders: <ThrowOnError extends boolean = false>(options?: Options<ArsContextaProvidersData, ThrowOnError>) => any;
/**
 * Remove auth credentials
 *
 * Remove authentication credentials
 */
export declare const authRemove: <ThrowOnError extends boolean = false>(options: Options<AuthRemoveData, ThrowOnError>) => any;
/**
 * Set auth credentials
 *
 * Set authentication credentials
 */
export declare const authSet: <ThrowOnError extends boolean = false>(options: Options<AuthSetData, ThrowOnError>) => any;
/**
 * Start terminal Clerk login
 *
 * Create a pending terminal login request, then open Clerk sign-in in the browser.
 */
export declare const terminalClerkStart: <ThrowOnError extends boolean = false>(options: Options<TerminalClerkStartData, ThrowOnError>) => any;
/**
 * Poll terminal Clerk login
 *
 * Get the status for a pending terminal login request.
 */
export declare const terminalClerkPoll: <ThrowOnError extends boolean = false>(options: Options<TerminalClerkPollData, ThrowOnError>) => any;
/**
 * Claim terminal Clerk login
 *
 * Persist completed Clerk login into local auth storage.
 */
export declare const terminalClerkClaim: <ThrowOnError extends boolean = false>(options: Options<TerminalClerkClaimData, ThrowOnError>) => any;
/**
 * Complete terminal Clerk login
 *
 * Browser callback endpoint that posts Clerk token back to local runtime.
 */
export declare const terminalClerkCallback: <ThrowOnError extends boolean = false>(options: Options<TerminalClerkCallbackData, ThrowOnError>) => any;
/**
 * List projects
 *
 * Retrieve a list of all projects managed by the Allternit instance.
 */
export declare const projectListRoot: <ThrowOnError extends boolean = false>(options?: Options<ProjectListRootData, ThrowOnError>) => any;
/**
 * Initialize project
 *
 * Initialize a project from a filesystem directory.
 */
export declare const projectInit: <ThrowOnError extends boolean = false>(options: Options<ProjectInitData, ThrowOnError>) => any;
/**
 * List projects
 *
 * Retrieve a list of all projects managed by the Allternit instance.
 */
export declare const projectList: <ThrowOnError extends boolean = false>(options?: Options<ProjectListData, ThrowOnError>) => any;
/**
 * List project sessions
 *
 * List all sessions belonging to a specific project.
 */
export declare const projectSessionList: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionListData, ThrowOnError>) => any;
/**
 * Create project session
 *
 * Create a new session within a specific project.
 */
export declare const projectSessionCreate: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionCreateData, ThrowOnError>) => any;
/**
 * Delete project session
 *
 * Delete a session and all its messages.
 */
export declare const projectSessionDelete: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionDeleteData, ThrowOnError>) => any;
/**
 * Get project session
 *
 * Retrieve a specific session belonging to a project.
 */
export declare const projectSessionGet: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionGetData, ThrowOnError>) => any;
/**
 * Initialize project session
 *
 * Initialize a session with a starting message or context.
 */
export declare const projectSessionInitialize: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionInitializeData, ThrowOnError>) => any;
/**
 * Abort project session
 *
 * Abort the currently running agent loop for a session.
 */
export declare const projectSessionAbort: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionAbortData, ThrowOnError>) => any;
/**
 * Unshare project session
 *
 * Remove public sharing from a session.
 */
export declare const projectSessionUnshare: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionUnshareData, ThrowOnError>) => any;
/**
 * Share project session
 *
 * Share a session publicly.
 */
export declare const projectSessionShare: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionShareData, ThrowOnError>) => any;
/**
 * Compact project session
 *
 * Prune compactable tool outputs from session history.
 */
export declare const projectSessionCompact: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionCompactData, ThrowOnError>) => any;
/**
 * List session messages
 *
 * Retrieve all messages belonging to a specific session.
 */
export declare const projectSessionMessages: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionMessagesData, ThrowOnError>) => any;
/**
 * Send message to session
 *
 * Send a prompt message to a session and trigger the agent loop.
 */
export declare const projectSessionMessageCreate: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionMessageCreateData, ThrowOnError>) => any;
/**
 * Get session message
 *
 * Retrieve a specific message and its parts.
 */
export declare const projectSessionMessageGet: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionMessageGetData, ThrowOnError>) => any;
/**
 * Revert session
 *
 * Revert file changes made during a session.
 */
export declare const projectSessionRevert: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionRevertData, ThrowOnError>) => any;
/**
 * Unrevert session
 *
 * Undo a revert, restoring the session changes.
 */
export declare const projectSessionUnrevert: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionUnrevertData, ThrowOnError>) => any;
/**
 * Reply to permission request
 *
 * Approve or deny a pending permission request for a session.
 */
export declare const projectSessionPermissionReply: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionPermissionReplyData, ThrowOnError>) => any;
/**
 * Find files in session
 *
 * Search for files by name pattern within the session workspace.
 */
export declare const projectSessionFileFind: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionFileFindData, ThrowOnError>) => any;
/**
 * Get session file status
 *
 * Get the diff status of files changed during a session.
 */
export declare const projectSessionFileStatus: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionFileStatusData, ThrowOnError>) => any;
/**
 * Read file in session
 *
 * Read the content of a specific file in the session context.
 */
export declare const projectSessionFileRead: <ThrowOnError extends boolean = false>(options: Options<ProjectSessionFileReadData, ThrowOnError>) => any;
/**
 * List agents for project
 *
 * List agents available in a project directory, optionally overriding the directory via query param.
 */
export declare const projectAgentList: <ThrowOnError extends boolean = false>(options: Options<ProjectAgentListData, ThrowOnError>) => any;
/**
 * Find files in project
 *
 * Search for files by name pattern within a project directory, optionally overriding via query param.
 */
export declare const projectFindFile: <ThrowOnError extends boolean = false>(options: Options<ProjectFindFileData, ThrowOnError>) => any;
/**
 * Get project details
 *
 * Retrieve detailed information about a specific project by its ID.
 */
export declare const projectGet: <ThrowOnError extends boolean = false>(options: Options<ProjectGetData, ThrowOnError>) => any;
/**
 * Update project settings
 *
 * Update the configuration and settings for an existing project.
 */
export declare const projectUpdate: <ThrowOnError extends boolean = false>(options: Options<ProjectUpdateData, ThrowOnError>) => any;
/**
 * Get active workspace
 *
 * Detect the active agent workspace (.gizzi/ or .openclaw/) and return its summary.
 */
export declare const workspaceGet: <ThrowOnError extends boolean = false>(options?: Options<WorkspaceGetData, ThrowOnError>) => any;
/**
 * Initialize workspace
 *
 * Create a new .gizzi/ workspace. format=layered creates the full Allternit 5-layer structure (L1-COGNITIVE, L2-IDENTITY, L3-GOVERNANCE, L4-SKILLS). format=flat creates an OpenClaw-compatible flat structure (default).
 */
export declare const workspaceInit: <ThrowOnError extends boolean = false>(options: Options<WorkspaceInitData, ThrowOnError>) => any;
/**
 * Import from OpenClaw
 *
 * Copy workspace files from ~/.openclaw/workspace/ into the active .gizzi/ workspace. Skips existing files unless force=true.
 */
export declare const workspaceImport: <ThrowOnError extends boolean = false>(options: Options<WorkspaceImportData, ThrowOnError>) => any;
/**
 * Get workspace identity
 *
 * Return all identity file contents (SOUL.md, IDENTITY.md, USER.md, MEMORY.md, AGENTS.md, VOICE.md, POLICY.md, BRAIN.md) for the active workspace.
 */
export declare const workspaceIdentityGet: <ThrowOnError extends boolean = false>(options?: Options<WorkspaceIdentityGetData, ThrowOnError>) => any;
/**
 * Update identity file
 *
 * Write a single identity file (e.g. SOUL.md, USER.md, MEMORY.md) to the active workspace. For layered workspaces writes to the correct layer directory.
 */
export declare const workspaceIdentityPut: <ThrowOnError extends boolean = false>(options: Options<WorkspaceIdentityPutData, ThrowOnError>) => any;
/**
 * Get workspace layer status
 *
 * Return which of the 5 layers exist in the active workspace.
 */
export declare const workspaceLayers: <ThrowOnError extends boolean = false>(options?: Options<WorkspaceLayersData, ThrowOnError>) => any;
/**
 * Get workspace memory
 *
 * Read memory entries from the active workspace. Returns MEMORY.md content and, for layered workspaces, recent entries from memory.jsonl.
 */
export declare const workspaceMemoryGet: <ThrowOnError extends boolean = false>(options?: Options<WorkspaceMemoryGetData, ThrowOnError>) => any;
/**
 * Append memory entry
 *
 * Write a new memory entry to the workspace. For layered workspaces appends to memory.jsonl and updates MEMORY.md. For flat workspaces appends to MEMORY.md.
 */
export declare const workspaceMemoryPost: <ThrowOnError extends boolean = false>(options: Options<WorkspaceMemoryPostData, ThrowOnError>) => any;
/**
 * Activate agent workspace
 *
 * Write an agent's identity files to ~/.gizzi/, making it the active workspace for all gizzi-code sessions. Creates the workspace if it doesn't exist.
 */
export declare const workspaceActivate: <ThrowOnError extends boolean = false>(options: Options<WorkspaceActivateData, ThrowOnError>) => any;
/**
 * List workspace skills
 *
 * Return all skills available in the active workspace, including those in L4-SKILLS/ for layered workspaces.
 */
export declare const workspaceSkills: <ThrowOnError extends boolean = false>(options?: Options<WorkspaceSkillsData, ThrowOnError>) => any;
/**
 * Get health
 *
 * Get health information about the GIZZI server.
 */
export declare const globalHealth: <ThrowOnError extends boolean = false>(options?: Options<GlobalHealthData, ThrowOnError>) => any;
/**
 * Get global events
 *
 * Subscribe to global events from the GIZZI system using server-sent events.
 */
export declare const globalEvent: <ThrowOnError extends boolean = false>(options?: Options<GlobalEventData, ThrowOnError>) => any;
/**
 * Get version
 *
 * Get the current version of the GIZZI system.
 */
export declare const globalVersion: <ThrowOnError extends boolean = false>(options?: Options<GlobalVersionData, ThrowOnError>) => any;
//# sourceMappingURL=sdk.gen.d.ts.map
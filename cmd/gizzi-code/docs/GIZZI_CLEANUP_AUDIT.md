# Gizzi Code Cleanup Audit

- **Worktree:** `/Users/joe/Desktop/allternit-workspace/allternit-session-gizzi-cleanup/cmd/gizzi-code`
- **Entry points analyzed:** `src/cli/main.ts`, `src/cli/ui/ink-app/worker.ts`
- **Build status:** `bun run build` failed because workspace packages are not resolvable in this isolated worktree (missing `@allternit/*` workspace siblings). Static import analysis was used as the authoritative source.

## Summary counts

| Metric | Count |
| --- | ---: |
| Total `src/` files scanned | 5876 |
| Reachable from production entries (incl. dynamic imports) | 1411 |
| Dead / unreachable | 4505 |
| Reachable only via dynamic `import()` | 11 |
| Pure stub command files | 11 |
| Partial / no-op commands | 5 |
| Dependencies safe to remove | 4 |
| Dependencies to keep / review | 5 |

### Dynamic-only reachable files

These files are reached only through `import()` calls. Review before deleting:

- `src/codemap/vault-export.ts`
- `src/runtime/agents/communication-runtime-fixed.ts`
- `src/runtime/agents/mention-router.ts`
- `src/runtime/memory/kernel-sync.ts`
- `src/runtime/verification/visual/browser/playwright.ts`
- `src/runtime/verification/visual/integration/deterministic.ts`
- `src/runtime/vm/index.ts`
- `src/share/share-next.ts`
- `src/vault/graph/build.ts`
- `src/vault/graph/orphans.ts`
- `src/vault/mcp-server.ts`

## Old OpenTUI / abandoned stack evidence

### Specific files

| File | Reachable | Importers |
| --- | --- | --- |
| `src/cli/main-gizzi.tsx` | **No** | **no importers** |
| `src/screens/REPL.tsx` | **No** | **no importers** |
| `src/screens/Doctor.tsx` | **No** | **no importers** |
| `src/screens/ResumeConversation.tsx` | **No** | **no importers** |
| `src/runtime/gizzi-core/ink.ts` | **No** | **no importers** |
| `src/runtime/gizzi-core/interactiveHelpers.tsx` | **No** | **no importers** |
| `src/runtime/integrations/bridgeUI.ts` | **No** | **no importers** |
| `src/runtime/integrations/claude/bridgeUI.ts` | **No** | **no importers** |
| `src/runtime/server/routes/ars-contexta-tui-bridge.ts` | **No** | **no importers** |

### Directories

| Directory | Status | Notes |
| --- | --- | --- |
| `src/cli/ui/ink-renderer/` | live 0, dead 101 | Old OpenTUI renderer (entire directory) |
| `src/ink/` | live 0, dead 4 | Old OpenTUI ink helpers (entire directory) |
| `src/context/` | live 1, dead 11 | Old context stack (only notifications.tsx is live) |
| `src/cli/hooks/` | live 1, dead 103 | Old CLI hooks (only useChromeExtensionNotification.tsx is live) |
| `src/keybindings/` | live 0, dead 15 | Old keybindings stack (entire directory) |

### `src/cli/ui/components/` breakdown

Only `DesktopHandoff.tsx` is live (imported by `ink-app/components/DesktopUpsell/DesktopUpsellStartup.tsx`). All other files in this directory are dead.

| Subdirectory | Live | Dead | Notes |
| --- | ---:| ---:| --- |
| `AgentProgressLine.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `AllternitInChromeOnboarding.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `App.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ApproveApiKey.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `AutoModeOptInDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `AutoUpdater.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `AutoUpdaterWrapper.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `AwsAuthStatusBox.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `BaseTextInput.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `BashModeProgress.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `BridgeDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `BypassPermissionsModeDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ChannelDowngradeDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ClaudeCodeHint` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ClickableImageRef.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `CompactSummary.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ConfigurableShortcutHint.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ConsoleOAuthFlow.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ContextSuggestions.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ContextVisualization.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `CoordinatorAgentStatus.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `CostThresholdDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `CtrlOToExpand.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `CustomSelect` | 0 | 10 | Old OpenTUI components — safe to delete |
| `DesktopHandoff.tsx` | 1 | 0 | Keep live file(s) |
| `DesktopUpsell` | 0 | 1 | Old OpenTUI components — safe to delete |
| `DevBar.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `DevChannelsDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `DiagnosticsDisplay.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `EffortCallout.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `EffortIndicator.ts` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ExitFlow.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ExportDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `FallbackToolUseErrorMessage.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `FallbackToolUseRejectedMessage.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `FastIcon.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `Feedback.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `FeedbackSurvey` | 0 | 10 | Old OpenTUI components — safe to delete |
| `FileEditToolDiff.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `FileEditToolUpdatedMessage.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `FileEditToolUseRejectedMessage.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `FilePathLink.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `FullscreenLayout.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `GizziMdExternalIncludesDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `GlobalSearchDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `HelpV2` | 0 | 3 | Old OpenTUI components — safe to delete |
| `HighlightedCode` | 0 | 1 | Old OpenTUI components — safe to delete |
| `HighlightedCode.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `HistorySearchDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `IdeAutoConnectDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `IdeOnboardingDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `IdeStatusIndicator.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `IdleReturnDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `InterruptedByUser.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `InvalidConfigDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `InvalidSettingsDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `KeybindingWarnings.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `LanguagePicker.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `LogSelector.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `LogoV2` | 0 | 17 | Old OpenTUI components — safe to delete |
| `LspRecommendation` | 0 | 1 | Old OpenTUI components — safe to delete |
| `MCPServerApprovalDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `MCPServerDesktopImportDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `MCPServerDialogCopy.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `MCPServerMultiselectDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ManagedSettingsSecurityDialog` | 0 | 2 | Old OpenTUI components — safe to delete |
| `Markdown.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `MarkdownTable.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `MemoryUsageIndicator.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `Message.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `MessageModel.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `MessageResponse.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `MessageRow.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `MessageSelector.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `MessageTimestamp.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `Messages.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ModelPicker.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `NativeAutoUpdater.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `NotebookEditToolUseRejectedMessage.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `OffscreenFreeze.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `Onboarding.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `OutputStylePicker.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `PackageManagerAutoUpdater.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `Passes` | 0 | 1 | Old OpenTUI components — safe to delete |
| `PrBadge.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `PressEnterToContinue.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `PromptInput` | 0 | 21 | Old OpenTUI components — safe to delete |
| `QuickOpenDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `RemoteCallout.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `RemoteEnvironmentDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ResumeTask.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `SandboxViolationExpandedView.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ScrollKeybindingHandler.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `SearchBox.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `SentryErrorBoundary.ts` | 0 | 1 | Old OpenTUI components — safe to delete |
| `SessionBackgroundHint.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `SessionPreview.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `Settings` | 0 | 5 | Old OpenTUI components — safe to delete |
| `ShowInIDEPrompt.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `SkillImprovementSurvey.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `Spinner` | 0 | 13 | Old OpenTUI components — safe to delete |
| `Spinner.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `Stats.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `StatusLine.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `StatusNotices.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `StructuredDiff` | 0 | 2 | Old OpenTUI components — safe to delete |
| `StructuredDiff.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `StructuredDiffList.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `TagTabs.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `TaskListV2.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `TeammateViewHeader.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `TeleportError.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `TeleportProgress.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `TeleportRepoMismatchDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `TeleportResumeWrapper.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `TeleportStash.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `TextInput.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ThemePicker.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ThinkingToggle.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `TokenWarning.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ToolUseLoader.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `TrustDialog` | 0 | 2 | Old OpenTUI components — safe to delete |
| `TungstenPill.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `UltraplanChoiceDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `UltraplanLaunchDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `ValidationErrorsList.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `VimTextInput.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `VirtualMessageList.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `WorkflowMultiselectDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `WorktreeExitDialog.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `agent-workspace` | 0 | 3 | Old OpenTUI components — safe to delete |
| `agents` | 0 | 27 | Old OpenTUI components — safe to delete |
| `animation` | 0 | 8 | Old OpenTUI components — safe to delete |
| `design-system` | 0 | 16 | Old OpenTUI components — safe to delete |
| `diff` | 0 | 3 | Old OpenTUI components — safe to delete |
| `gizzi` | 0 | 22 | Old OpenTUI components — safe to delete |
| `grove` | 0 | 1 | Old OpenTUI components — safe to delete |
| `hooks` | 0 | 6 | Old OpenTUI components — safe to delete |
| `mcp` | 0 | 14 | Old OpenTUI components — safe to delete |
| `memory` | 0 | 2 | Old OpenTUI components — safe to delete |
| `messageActions.tsx` | 0 | 1 | Old OpenTUI components — safe to delete |
| `messages` | 0 | 45 | Old OpenTUI components — safe to delete |
| `permissions` | 0 | 53 | Old OpenTUI components — safe to delete |
| `sandbox` | 0 | 5 | Old OpenTUI components — safe to delete |
| `shell` | 0 | 4 | Old OpenTUI components — safe to delete |
| `skills` | 0 | 1 | Old OpenTUI components — safe to delete |
| `tasks` | 0 | 14 | Old OpenTUI components — safe to delete |
| `teams` | 0 | 2 | Old OpenTUI components — safe to delete |
| `ui` | 0 | 4 | Old OpenTUI components — safe to delete |
| `wizard` | 0 | 6 | Old OpenTUI components — safe to delete |

## Dead-file directory map

Directories with 10 or more dead files. A directory marked **Safe** has no live files under it. Mixed directories contain reachable code and must be pruned file-by-file.

| Directory | Dead | Live | Representative dead files | Safe to delete? |
| --- | ---:| ---:| --- | --- |
| `src/shared/utils/` | 311 | 7 | `collapseBackgroundBashNotifications.ts`, `tokenBudget.ts`, `collapseHookSummaries.ts` | **No — mixed with live code** |
| `src/cli/ui/ink-app/utils/` | 159 | 159 | `stats.ts`, `zodToJsonSchema.ts`, `cliArgs.ts` | **No — mixed with live code** |
| `src/cli/ui/components/` | 115 | 1 | `TeleportProgress.tsx`, `MessageSelector.tsx`, `UltraplanChoiceDialog.tsx` | **No — mixed with live code** |
| `src/cli/ui/ink-app/hooks/vendored/` | 83 | 0 | `useMainLoopModel.ts`, `useDirectConnect.ts`, `useTerminalSize.ts` | **Yes (entire directory)** |
| `src/cli/hooks/` | 82 | 1 | `unifiedSuggestions.ts`, `useSSHSession.ts`, `useNotifyAfterTimeout.ts` | **No — mixed with live code** |
| `src/cli/ui/ink-app/component/` | 54 | 0 | `session-mount.tsx`, `discretionary-screen.tsx`, `dialog-memory-explorer.tsx` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/components/` | 53 | 71 | `MCPServerMultiselectDialog.tsx`, `history.ts`, `ThemePicker.tsx` | **No — mixed with live code** |
| `src/cli/ui/ink-renderer/` | 46 | 0 | `terminal-querier.ts`, `terminal.ts`, `parse-keypress.ts` | **Yes (entire directory)** |
| `src/shared/utils/plugins/` | 44 | 0 | `schemas.ts`, `hintRecommendation.ts`, `officialMarketplace.ts` | **Yes (entire directory)** |
| `src/utils/` | 39 | 0 | `worktreeModeEnabled.ts`, `process.ts`, `stringUtils.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/components/vendored/` | 39 | 0 | `AwsAuthStatusBox.tsx`, `ThinkingToggle.tsx`, `IdleReturnDialog.tsx` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/utils/plugins/` | 37 | 8 | `loadPluginOutputStyles.ts`, `fetchTelemetry.ts`, `installCounts.ts` | **No — mixed with live code** |
| `src/cli/ui/components/messages/` | 37 | 0 | `AssistantThinkingMessage.tsx`, `UserTextMessage.tsx`, `TaskAssignmentMessage.tsx` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/components/vendored/permissions/` | 36 | 0 | `PreviewBox.tsx`, `PermissionRuleExplanation.tsx`, `shellPermissionHelpers.tsx` | **Yes (entire directory)** |
| `src/runtime/integrations/` | 33 | 1 | `types.ts`, `bridgeApi.ts`, `jwtUtils.ts` | **No — mixed with live code** |
| `src/runtime/integrations/claude/` | 32 | 0 | `types.ts`, `initReplBridge.ts`, `trustedDevice.ts` | **Yes (entire directory)** |
| `src/cli/commands/` | 28 | 37 | `status.ts`, `config.ts`, `plugin.ts` | **No — mixed with live code** |
| `src/shared/utils/permissions/` | 26 | 0 | `permissionsLoader.ts`, `permissionExplainer.ts`, `PermissionUpdate.ts` | **Yes (entire directory)** |
| `src/runtime/util/` | 25 | 3 | `abort.ts`, `model-safety.ts`, `code-blocks.ts` | **No — mixed with live code** |
| `src/constants/` | 25 | 1 | `outputStyleConfig.ts`, `product.ts`, `outputStyleConstants.ts` | **No — mixed with live code** |
| `src/cli/ui/components/gizzi/` | 22 | 0 | `message-list.tsx`, `mascot.tsx`, `provider.tsx` | **Yes (entire directory)** |
| `src/runtime/services/mcp/` | 22 | 1 | `officialRegistry.ts`, `headersHelper.ts`, `client.ts` | **No — mixed with live code** |
| `src/cli/ui/ink-app/components/vendored/PromptInput/` | 21 | 0 | `Notifications.tsx`, `PromptInput.tsx`, `VoiceIndicator.tsx` | **Yes (entire directory)** |
| `src/cli/ui/components/PromptInput/` | 21 | 0 | `PromptInputFooterLeftSide.tsx`, `usePromptInputPlaceholder.ts`, `HistorySearchInput.tsx` | **Yes (entire directory)** |
| `src/runtime/services/api/` | 21 | 1 | `bootstrap.ts`, `referral.ts`, `logging.ts` | **No — mixed with live code** |
| `src/cli/ui/ink-app/bridge/` | 20 | 12 | `initReplBridge.ts`, `replBridgeTransport.ts`, `codeSessionApi.ts` | **No — mixed with live code** |
| `src/types/` | 20 | 1 | `connectorText.ts`, `hooks.ts`, `logs.ts` | **No — mixed with live code** |
| `src/runtime/tools/builtins/bash/` | 19 | 1 | `bashCommandHelpers.ts`, `utils.ts`, `UI.tsx` | **No — mixed with live code** |
| `src/cli/ui/ink-app/commands/plugin/` | 19 | 0 | `ManageMarketplaces.tsx`, `ValidatePlugin.tsx`, `UnifiedInstalledCell.tsx` | **Yes (entire directory)** |
| `src/cli/` | 18 | 5 | `commands-claude.ts`, `update.ts`, `fallback.ts` | **No — mixed with live code** |
| `src/cli/ui/ink-renderer/components/` | 18 | 0 | `TerminalSizeContext.tsx`, `Box.tsx`, `Link.tsx` | **Yes (entire directory)** |
| `src/runtime/services/` | 18 | 0 | `voice.ts`, `diagnosticTracking.ts`, `rateLimitMessages.ts` | **Yes (entire directory)** |
| `src/skills/bundled/` | 18 | 0 | `workspaceSkills.ts`, `simplify.ts`, `updateConfig.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/components/tools/BashTool/` | 18 | 0 | `utils.ts`, `destructiveCommandWarning.ts`, `bashSecurity.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/components/LogoV2/` | 17 | 0 | `GuestPassesUpsell.tsx`, `FeedColumn.tsx`, `EmergencyTip.tsx` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/commands/` | 17 | 1 | `advisor.ts`, `goal.ts`, `brief.ts` | **No — mixed with live code** |
| `src/shared/utils/hooks/` | 17 | 0 | `hookEvents.ts`, `registerFrontmatterHooks.ts`, `skillImprovement.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/skills/bundled/` | 17 | 0 | `batch.ts`, `claudeApiContent.ts`, `allternitInChrome.ts` | **Yes (entire directory)** |
| `src/cli/ui/components/LogoV2/` | 17 | 0 | `Clawd.tsx`, `AnimatedClawd.tsx`, `LogoV2.tsx` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/hooks/vendored/notifs/` | 16 | 0 | `useNpmDeprecationNotification.tsx`, `useModelMigrationNotifications.tsx`, `useRateLimitWarningNotification.tsx` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/services/mcp/` | 16 | 7 | `xaaIdpLogin.ts`, `channelNotification.ts`, `channelPermissions.ts` | **No — mixed with live code** |
| `src/cli/ui/components/design-system/` | 16 | 0 | `Divider.tsx`, `Dialog.tsx`, `ListItem.tsx` | **Yes (entire directory)** |
| `src/cli/hooks/notifs/` | 16 | 0 | `useIDEStatusIndicator.tsx`, `useModelMigrationNotifications.tsx`, `useSettingsErrors.tsx` | **Yes (entire directory)** |
| `src/runtime/services/compact/` | 16 | 0 | `snipCompact.ts`, `apiMicrocompact.ts`, `snipProjection.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/utils/computerUse/` | 15 | 0 | `mcpServer.ts`, `swiftLoader.ts`, `setup.ts` | **Yes (entire directory)** |
| `src/shared/utils/settings/` | 15 | 1 | `settingsCache.ts`, `toolValidationConfig.ts`, `constants.ts` | **No — mixed with live code** |
| `src/shared/utils/computerUse/` | 15 | 0 | `cleanup.ts`, `setup.ts`, `wrapper.tsx` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/commands/install-github-app/` | 15 | 0 | `ChooseRepoStep.tsx`, `OAuthFlowStep.tsx`, `types.ts` | **Yes (entire directory)** |
| `src/keybindings/` | 15 | 0 | `schema.ts`, `reservedShortcuts.ts`, `template.ts` | **Yes (entire directory)** |
| `src/cli/ui/components/permissions/` | 15 | 0 | `WorkerBadge.tsx`, `FallbackPermissionRequest.tsx`, `utils.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/services/api/` | 15 | 6 | `localModel.ts`, `filesApi.ts`, `adminRequests.ts` | **No — mixed with live code** |
| `src/cli/commands/install-github-app/` | 15 | 0 | `ErrorStep.tsx`, `ExistingWorkflowStep.tsx`, `WarningsStep.tsx` | **Yes (entire directory)** |
| `src/shared/utils/model/` | 15 | 0 | `agent.ts`, `configs.ts`, `deprecation.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/components/commands/` | 15 | 0 | `security-review.ts`, `createMovedToPluginCommand.ts`, `statusline.tsx` | **Yes (entire directory)** |
| `src/shared/utils/bash/` | 15 | 0 | `bashParser.ts`, `shellPrefix.ts`, `bashPipeCommand.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/hooks/` | 14 | 76 | `useTeleportResume.tsx`, `useVoice.ts`, `tools.ts` | **No — mixed with live code** |
| `src/runtime/tools/builtins/AgentTool/` | 14 | 0 | `loadAgentsDir.ts`, `agentColorManager.ts`, `agentMemorySnapshot.ts` | **Yes (entire directory)** |
| `src/cli/ui/components/tasks/` | 14 | 0 | `renderToolActivity.tsx`, `RemoteSessionProgress.tsx`, `taskStatusUtils.tsx` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/components/constants/` | 14 | 0 | `errorIds.ts`, `turnCompletionVerbs.ts`, `figures.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/components/tools/PowerShellTool/` | 14 | 0 | `PowerShellTool.tsx`, `commonParameters.ts`, `readOnlyValidation.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/utils/hooks/` | 14 | 3 | `registerSkillHooks.ts`, `ssrfGuard.ts`, `registerFrontmatterHooks.ts` | **No — mixed with live code** |
| `src/runtime/gizzi-core/` | 14 | 0 | `query.ts`, `cost-tracker.ts`, `history.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/components/messages/` | 13 | 32 | `UserForkBoilerplateMessage.tsx`, `ToolUseMessage.tsx`, `UserChannelMessage.tsx` | **No — mixed with live code** |
| `src/cli/ui/ink-app/components/vendored/mcp/` | 13 | 0 | `MCPSettings.tsx`, `MCPReconnect.tsx`, `MCPStdioServerMenu.tsx` | **Yes (entire directory)** |
| `src/cli/ui/components/mcp/` | 13 | 0 | `MCPToolListView.tsx`, `ElicitationDialog.tsx`, `types.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/context/` | 13 | 13 | `exit.tsx`, `kv.tsx`, `keybind.tsx` | **No — mixed with live code** |
| `src/cli/ui/ink-app/constants/` | 13 | 12 | `github-app.ts`, `apiLimits.ts`, `common.ts` | **No — mixed with live code** |
| `src/cli/ui/components/Spinner/` | 13 | 0 | `types.ts`, `index.ts`, `useShimmerAnimation.ts` | **Yes (entire directory)** |
| `src/cli/ui/components/agents/` | 13 | 0 | `AgentDetail.tsx`, `utils.ts`, `AgentNavigationFooter.tsx` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/components/agents/` | 13 | 0 | `ColorPicker.tsx`, `ModelSelector.tsx`, `ToolSelector.tsx` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/components/agents/new-agent-creation/wizard-steps/` | 12 | 0 | `ColorStep.tsx`, `GenerateStep.tsx`, `ConfirmStep.tsx` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/services/` | 12 | 8 | `tokenEstimation.ts`, `awaySummary.ts`, `internalLogging.ts` | **No — mixed with live code** |
| `src/entrypoints/sdk/` | 12 | 0 | `coreTypes.generated.ts`, `sdkUtilityTypes.ts`, `messageTypes.ts` | **Yes (entire directory)** |
| `src/` | 12 | 1 | `Tool.ts`, `context.ts`, `commands.ts` | **No — mixed with live code** |
| `src/cli/ui/ink-renderer/hooks/` | 12 | 0 | `use-search-highlight.ts`, `use-terminal-title.ts`, `use-app.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/components/mcp/` | 12 | 1 | `CapabilitiesSection.tsx`, `McpParsingWarnings.tsx`, `MCPListPanel.tsx` | **No — mixed with live code** |
| `src/cli/ui/components/agents/new-agent-creation/wizard-steps/` | 12 | 0 | `GenerateStep.tsx`, `ConfirmStep.tsx`, `ConfirmStepWrapper.tsx` | **Yes (entire directory)** |
| `src/shared/utils/swarm/` | 12 | 1 | `reconnection.ts`, `permissionSync.ts`, `teammateLayoutManager.ts` | **No — mixed with live code** |
| `src/cli/ui/ink-app/components/tools/AgentTool/` | 12 | 0 | `agentDisplay.ts`, `constants.ts`, `prompt.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-renderer/events/` | 12 | 0 | `dispatcher.ts`, `terminal-event.ts`, `emitter.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/ink/` | 11 | 35 | `clearTerminal.ts`, `get-max-width.ts`, `measure-text.ts` | **No — mixed with live code** |
| `src/migrations/` | 11 | 0 | `migrateSonnet1mToSonnet45.ts`, `migrateEnableAllProjectMcpServersToSettings.ts`, `migrateSonnet45ToSonnet46.ts` | **Yes (entire directory)** |
| `src/context/` | 11 | 1 | `mailbox.tsx`, `fpsMetrics.tsx`, `pack-builder.d.ts` | **No — mixed with live code** |
| `src/cli/ui/ink-app/migrations/` | 11 | 0 | `migrateFennecToOpus.ts`, `migrateBypassPermissionsAcceptedToSettings.ts`, `migrateSonnet45ToSonnet46.ts` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/utils/bash/` | 11 | 4 | `bashPipeCommand.ts`, `ParsedCommand.ts`, `shellPrefix.ts` | **No — mixed with live code** |
| `src/cli/ui/ink-app/routes/session/` | 11 | 0 | `dialog-fork-from-timeline.tsx`, `header.tsx`, `sidebar.tsx` | **Yes (entire directory)** |
| `src/cli/ui/ink-app/utils/settings/` | 10 | 6 | `validateEditTool.ts`, `applySettingsChange.ts`, `internalWrites.ts` | **No — mixed with live code** |
| `src/runtime/tools/builtins/` | 10 | 44 | `memory-query.ts`, `bash.ts`, `read.ts` | **No — mixed with live code** |
| `src/cli/ui/ink-app/ui/` | 10 | 0 | `spinner.ts`, `dialog-alert.tsx`, `dialog-confirm.tsx` | **Yes (entire directory)** |
| `src/cli/ui/components/CustomSelect/` | 10 | 0 | `SelectMulti.tsx`, `select-input-option.tsx`, `select-option.tsx` | **Yes (entire directory)** |
| `src/cli/ui/components/FeedbackSurvey/` | 10 | 0 | `useDebouncedDigitInput.ts`, `utils.ts`, `usePostCompactSurvey.tsx` | **Yes (entire directory)** |
| `src/shared/utils/shell/` | 10 | 0 | `shellToolUtils.ts`, `bashProvider.ts`, `shellProvider.ts` | **Yes (entire directory)** |
| *(remaining directories with <10 dead files each)* | 2148 | — | — | Review individually |

## Stub / partial command inventory

### Pure stub command files

These command directories export `{ isEnabled: () => false, isHidden: true, name: "stub" }` and are not wired into `src/cli/main.ts`.

| Command directory | Stub file | Action |
| --- | --- | --- |
| `src/cli/commands/break-cache` | `src/cli/commands/break-cache/index.js` | Delete |
| `src/cli/commands/issue` | `src/cli/commands/issue/index.js` | Delete |
| `src/cli/commands/debug-tool-call` | `src/cli/commands/debug-tool-call/index.js` | Delete |
| `src/cli/commands/ant-trace` | `src/cli/commands/ant-trace/index.js` | Delete |
| `src/cli/commands/autofix-pr` | `src/cli/commands/autofix-pr/index.js` | Delete |
| `src/cli/commands/good` | `src/cli/commands/good/index.js` | Delete |
| `src/cli/commands/bughunter` | `src/cli/commands/bughunter/index.js` | Delete |
| `src/cli/commands/ctx_viz` | `src/cli/commands/ctx_viz/index.js` | Delete |
| `src/cli/commands/backfill-sessions` | `src/cli/commands/backfill-sessions/index.js` | Delete |
| `src/cli/commands/env` | `src/cli/commands/env/index.js` | Delete |

Additionally `src/cli/commands/debug/index.ts` is a pure stub (`console.log("Debug command - not implemented yet")`).

### Partial / no-op commands

| Command | Location | Classification | Documented in AGENTS.md | Action |
| --- | --- | --- | --- | --- |
| `voice` | `src/cli/commands/voice.ts` | Functional listen/speak/transcribe; voice chat echoes (TODO) | Yes | Keep but wire chat to AI |
| `swarm` | `src/cli/commands/swarm.ts` | Create redirects to `/team-create`; execute is a fake animation | Yes | Keep thin CLI or remove animation subcommand |
| `marketplace` | `src/cli/commands/marketplace.ts` | Redirects all actions to `gizzi plugin` | Yes | Keep or fold into plugin command |
| `cowork` | `src/cli/commands/cowork.ts` | Large command but `tasks`/`board` subcommands pull in dead `@/ink`/`@/screens` TUI | Yes | Keep core; delete dead TUI subcommands |
| `allternit` | `src/cli/commands/allternit.ts` | macOS desktop launcher DMG installer | No | Keep or deprecate if product retired |

## Top-level ad-hoc scripts

| File | Purpose | Action |
| --- | --- | --- |
| `agent-demo.ts` | Demo script for old SDK packages | Archive / delete |
| `debug-mode-switching.ts` | TUI mode-switching debug test script | Archive / delete |
| `test-mode-switching.ts` | TUI mode-switching test script | Archive / delete |
| `test-agent-comm-runtime.ts` | Agent communication runtime test script | Archive / delete |
| `test-verify-integration.ts` | Integration verification test script | Archive / delete |
| `test-local.ts` | Local model test script | Archive / delete |
| `test-zod.ts` | Zod schema compliance test script | Archive / delete |
| `diag-schemas.ts` | Schema diagnostic script | Archive / delete |
| `script.js` | Browser todo-list demo script | Archive / delete |
| `auto_test.py` | Python TUI smoke test script | Archive / delete |

## Stale markdown docs

43 status/plan/markdown files at repo root are unreferenced by source, docs, or CI. Recommended action: **archive** (move to `docs/archive/` or delete).

| File | Action |
| --- | --- |
| `ACTUAL_STATUS.md` | Archive |
| `BUILD_FIXES_SUMMARY.md` | Archive |
| `BUILD_PROGRESS_FINAL.md` | Archive |
| `BUILD_STATUS_FINAL.md` | Archive |
| `CLAUDE_FIRST_INTEGRATION_PLAN.md` | Archive |
| `CLAUDE_INTEGRATION_MASTER_PLAN.md` | Archive |
| `CLAUDE_INTEGRATION_STATUS.md` | Archive |
| `CLAUDE_REFERENCES_INVENTORY.txt` | Archive |
| `CONVERGENCE_MATRIX.md` | Archive |
| `CONVERGENCE_MATRIX_RESEARCHED.md` | Archive |
| `CORE_FUNCTIONALITY_STATUS.md` | Archive |
| `FINAL_RECOVERY_STATUS.md` | Archive |
| `FINAL_STATUS.md` | Archive |
| `GAPS_AND_TODOS.md` | Archive |
| `HARNESS_INTEGRATION_STATUS.md` | Archive |
| `INK_TUI_HANDOFF.md` | Archive |
| `INK_TUI_HONEST_STATUS.md` | Archive |
| `INK_TUI_PORTING_PLAN.md` | Archive |
| `INK_TUI_PORTING_STATUS.md` | Archive |
| `INK_TUI_PRODUCTION_STATUS.md` | Archive |
| `INK_TUI_QUICKSTART.md` | Archive |
| `INSTALL_COMMANDS_REFERENCE.md` | Archive |
| `INSTALL_FLOW_EXPLAINED.md` | Archive |
| `INTEGRATION_COMPLETE.md` | Archive |
| `INTEGRATION_MAPPING.md` | Archive |
| `INTEGRATION_PLAN.md` | Archive |
| `INTEGRATION_STATUS.md` | Archive |
| `INTEGRATION_TODO.md` | Archive |
| `MONOREPO_RELEASE_PLAN.md` | Archive |
| `PACKAGING_STATUS.md` | Archive |
| `PHASE1_LANDING_PLAN.md` | Archive |
| `PHASE1_LANDING_PLAN_AUDITED.md` | Archive |
| `PHASE2_MISSING_DEPENDENCY_AUDIT.md` | Archive |
| `PHASE3_RECONSTRUCTION_PLAN.md` | Archive |
| `PRODUCTION_INTEGRATION_COMPLETE.md` | Archive |
| `PRODUCTION_QUALITY_AUDIT.md` | Archive |
| `PRODUCTION_QUALITY_STATUS.md` | Archive |
| `PROJECT_PLAN.md` | Archive |
| `REPL_INTEGRATION_COMPLETE.md` | Archive |
| `STUB_IMPLEMENTATION_COMPLETE.md` | Archive |
| `STUB_INVENTORY.md` | Archive |
| `TUI_INTEGRATION_STATUS.md` | Archive |
| `TUI_TESTING_PLAN.md` | Archive |

## Dependencies to review

| Dependency | Live importers | Dead importers | Action | Notes |
| --- | ---:| ---:| --- | --- |
| `@opentui/core` | 0 | 55 | **Remove** | Only imported by dead files. |
| `@opentui/solid` | 0 | 61 | **Remove** | Only imported by dead files. |
| `opentui-spinner` | 0 | 3 | **Remove** | Only imported by dead files. |
| `@solid-primitives/event-bus` | 1 | 0 | Keep / review | Live files: `src/cli/ui/ink-app/context/sdk.tsx` |
| `@solid-primitives/scheduled` | 0 | 1 | **Remove** | Only imported by dead files. |
| `solid-js` | 2 | 108 | Keep / review | Live files: `src/cli/ui/ink-app/context/sdk.tsx`, `src/cli/ui/ink-app/context/helper.tsx` |
| `usehooks-ts` | 13 | 21 | Keep / review | Live files: `src/cli/ui/ink-app/hooks/usePasteHandler.ts`, `src/cli/ui/ink-app/components/NativeAutoUpdater.tsx`, `src/cli/ui/ink-app/components/messages/SystemAPIErrorMessage.tsx` ... |
| `react-dom` | 1 | 5 | Keep / review | Live files: `src/cli/ui/ink-app/ink/events/focus-event.ts` |
| `@parcel/watcher-darwin-x64` | 0 | 0 | Keep | Optional transitive dep of `@parcel/watcher`; not imported directly. |

## Appendix: All CLI command entries

| Entry | Path | Classification |
| --- | --- | --- |
| `ac.ts` | `src/cli/commands/ac.ts` | Live |
| `acp.ts` | `src/cli/commands/acp.ts` | Live |
| `add-dir/` | `src/cli/commands/add-dir/index.ts` | Dead |
| `advisor.ts` | `src/cli/commands/advisor.ts` | Dead |
| `agent-hub.ts` | `src/cli/commands/agent-hub.ts` | Live |
| `agent.ts` | `src/cli/commands/agent.ts` | Live |
| `agents/` | `src/cli/commands/agents/index.ts` | Dead |
| `allternit-capsules.ts` | `src/cli/commands/allternit-capsules.ts` | Dead |
| `allternit-plugins.ts` | `src/cli/commands/allternit-plugins.ts` | Dead |
| `allternit-sessions.ts` | `src/cli/commands/allternit-sessions.ts` | Dead |
| `allternit-vms.ts` | `src/cli/commands/allternit-vms.ts` | Dead |
| `allternit.ts` | `src/cli/commands/allternit.ts` | Partial / no-op |
| `ant-trace/` | `src/cli/commands/ant-trace/index.js` | Stub |
| `assistant/` | `src/cli/commands/assistant/index.ts` | Dead |
| `auth.ts` | `src/cli/commands/auth.ts` | Live |
| `autofix-pr/` | `src/cli/commands/autofix-pr/index.js` | Stub |
| `backfill-sessions/` | `src/cli/commands/backfill-sessions/index.js` | Stub |
| `brain/` | `src/cli/commands/brain/index.ts` | Live |
| `branch/` | `src/cli/commands/branch/index.ts` | Dead |
| `break-cache/` | `src/cli/commands/break-cache/index.js` | Stub |
| `bridge/` | `src/cli/commands/bridge/index.ts` | Dead |
| `bridge-kick.ts` | `src/cli/commands/bridge-kick.ts` | Dead |
| `brief.ts` | `src/cli/commands/brief.ts` | Dead |
| `btw/` | `src/cli/commands/btw/index.ts` | Dead |
| `buddy/` | `src/cli/commands/buddy/index.ts` | Dead |
| `bughunter/` | `src/cli/commands/bughunter/index.js` | Stub |
| `chrome/` | `src/cli/commands/chrome/index.ts` | Dead |
| `clear/` | `src/cli/commands/clear/index.ts` | Dead |
| `cmd.ts` | `src/cli/commands/cmd.ts` | Live |
| `codemap.ts` | `src/cli/commands/codemap.ts` | Live |
| `color/` | `src/cli/commands/color/index.ts` | Dead |
| `commit-claude.ts` | `src/cli/commands/commit-claude.ts` | Dead |
| `commit-push-pr.ts` | `src/cli/commands/commit-push-pr.ts` | Dead |
| `compact/` | `src/cli/commands/compact/index.ts` | Dead |
| `completions/` | `src/cli/commands/completions/index.ts` | Live |
| `config/` | `src/cli/commands/config/index.ts` | Live |
| `config.ts` | `src/cli/commands/config.ts` | Dead |
| `connect.ts` | `src/cli/commands/connect.ts` | Live |
| `context/` | `src/cli/commands/context/index.ts` | Dead |
| `copy/` | `src/cli/commands/copy/index.ts` | Dead |
| `cost/` | `src/cli/commands/cost/index.ts` | Dead |
| `cowork-team.ts` | `src/cli/commands/cowork-team.ts` | Live |
| `cowork.ts` | `src/cli/commands/cowork.ts` | Partial / no-op |
| `createMovedToPluginCommand.ts` | `src/cli/commands/createMovedToPluginCommand.ts` | Dead |
| `cron.ts` | `src/cli/commands/cron.ts` | Live |
| `ctx_viz/` | `src/cli/commands/ctx_viz/index.js` | Stub |
| `db.ts` | `src/cli/commands/db.ts` | Live |
| `debug/` | `src/cli/commands/debug/index.ts` | Stub |
| `debug-tool-call/` | `src/cli/commands/debug-tool-call/index.js` | Stub |
| `desktop/` | `src/cli/commands/desktop/index.ts` | Dead |
| `diff/` | `src/cli/commands/diff/index.ts` | Dead |
| `doctor/` | `src/cli/commands/doctor/index.ts` | Live |
| `doctor.ts` | `src/cli/commands/doctor.ts` | Dead |
| `effort/` | `src/cli/commands/effort/index.ts` | Dead |
| `env/` | `src/cli/commands/env/index.js` | Stub |
| `exit/` | `src/cli/commands/exit/index.ts` | Dead |
| `export/` | `src/cli/commands/export/index.ts` | Live |
| `export.ts` | `src/cli/commands/export.ts` | Dead |
| `extra-usage/` | `src/cli/commands/extra-usage/index.ts` | Dead |
| `fast/` | `src/cli/commands/fast/index.ts` | Dead |
| `feedback/` | `src/cli/commands/feedback/index.ts` | Dead |
| `files/` | `src/cli/commands/files/index.ts` | Dead |
| `fork/` | `src/cli/commands/fork/index.ts` | Dead |
| `generate.ts` | `src/cli/commands/generate.ts` | Live |
| `github.ts` | `src/cli/commands/github.ts` | Live |
| `good/` | `src/cli/commands/good/index.js` | Stub |
| `good-claude/` | `src/cli/commands/good-claude/index.ts` | Dead |
| `heapdump/` | `src/cli/commands/heapdump/index.ts` | Dead |
| `help/` | `src/cli/commands/help/index.ts` | Dead |
| `hooks/` | `src/cli/commands/hooks/index.ts` | Dead |
| `html-artifact.ts` | `src/cli/commands/html-artifact.ts` | Live |
| `ide/` | `src/cli/commands/ide/index.ts` | Dead |
| `import.ts` | `src/cli/commands/import.ts` | Live |
| `init-verifiers.ts` | `src/cli/commands/init-verifiers.ts` | Dead |
| `init.ts` | `src/cli/commands/init.ts` | Live |
| `ink.ts` | `src/cli/commands/ink.ts` | Dead |
| `insights.ts` | `src/cli/commands/insights.ts` | Dead |
| `install-github-app/` | `src/cli/commands/install-github-app/index.ts` | Dead |
| `install-slack-app/` | `src/cli/commands/install-slack-app/index.ts` | Dead |
| `install.tsx` | `src/cli/commands/install.tsx` | Dead |
| `issue/` | `src/cli/commands/issue/index.js` | Stub |
| `keybindings/` | `src/cli/commands/keybindings/index.ts` | Dead |
| `labs.ts` | `src/cli/commands/labs.ts` | Live |
| `mail.ts` | `src/cli/commands/mail.ts` | Live |
| `marketplace.ts` | `src/cli/commands/marketplace.ts` | Partial / no-op |
| `mcp/` | `src/cli/commands/mcp/index.ts` | Live |
| `mcp.ts` | `src/cli/commands/mcp.ts` | Dead |
| `mobile/` | `src/cli/commands/mobile/index.ts` | Dead |
| `mock-limits/` | `src/cli/commands/mock-limits/index.ts` | Dead |
| `models.ts` | `src/cli/commands/models.ts` | Live |
| `onboarding/` | `src/cli/commands/onboarding/index.ts` | Dead |
| `org.ts` | `src/cli/commands/org.ts` | Live |
| `pair.ts` | `src/cli/commands/pair.ts` | Live |
| `passes/` | `src/cli/commands/passes/index.ts` | Dead |
| `perf-issue/` | `src/cli/commands/perf-issue/index.ts` | Dead |
| `permission-profile/` | `src/cli/commands/permission-profile/index.ts` | Live |
| `permissions/` | `src/cli/commands/permissions/index.ts` | Dead |
| `plan/` | `src/cli/commands/plan/index.ts` | Dead |
| `plugin/` | `src/cli/commands/plugin/index.ts` | Live |
| `plugin.ts` | `src/cli/commands/plugin.ts` | Dead |
| `pr.ts` | `src/cli/commands/pr.ts` | Live |
| `pr_comments/` | `src/cli/commands/pr_comments/index.ts` | Dead |
| `privacy-settings/` | `src/cli/commands/privacy-settings/index.ts` | Dead |
| `products.ts` | `src/cli/commands/products.ts` | Live |
| `profile/` | `src/cli/commands/profile/index.ts` | Live |
| `programs.ts` | `src/cli/commands/programs.ts` | Live |
| `provider.ts` | `src/cli/commands/provider.ts` | Live |
| `release-notes/` | `src/cli/commands/release-notes/index.ts` | Dead |
| `reload-plugins/` | `src/cli/commands/reload-plugins/index.ts` | Dead |
| `remote/` | `src/cli/commands/remote/index.ts` | Live |
| `remote-setup/` | `src/cli/commands/remote-setup/index.ts` | Dead |
| `rename/` | `src/cli/commands/rename/index.ts` | Dead |
| `reset-limits/` | `src/cli/commands/reset-limits/index.ts` | Dead |
| `resume/` | `src/cli/commands/resume/index.ts` | Dead |
| `review/` | `src/cli/commands/review/index.ts` | Dead |
| `review.ts` | `src/cli/commands/review.ts` | Dead |
| `rewind/` | `src/cli/commands/rewind/index.ts` | Dead |
| `run.ts` | `src/cli/commands/run.ts` | Live |
| `runtime.ts` | `src/cli/commands/runtime.ts` | Live |
| `sandbox-toggle/` | `src/cli/commands/sandbox-toggle/index.ts` | Dead |
| `security-review/` | `src/cli/commands/security-review/index.ts` | Dead |
| `serve.ts` | `src/cli/commands/serve.ts` | Live |
| `session/` | `src/cli/commands/session/index.ts` | Live |
| `session.ts` | `src/cli/commands/session.ts` | Dead |
| `share/` | `src/cli/commands/share/index.ts` | Dead |
| `skills/` | `src/cli/commands/skills/index.ts` | Live |
| `skills.ts` | `src/cli/commands/skills.ts` | Dead |
| `stats.ts` | `src/cli/commands/stats.ts` | Live |
| `status/` | `src/cli/commands/status/index.ts` | Live |
| `status.ts` | `src/cli/commands/status.ts` | Dead |
| `stickers/` | `src/cli/commands/stickers/index.ts` | Dead |
| `summary/` | `src/cli/commands/summary/index.ts` | Dead |
| `swarm.ts` | `src/cli/commands/swarm.ts` | Partial / no-op |
| `tasks/` | `src/cli/commands/tasks/index.ts` | Dead |
| `teleport/` | `src/cli/commands/teleport/index.ts` | Dead |
| `terminalSetup/` | `src/cli/commands/terminalSetup/index.ts` | Dead |
| `theme/` | `src/cli/commands/theme/index.ts` | Dead |
| `thinkback/` | `src/cli/commands/thinkback/index.ts` | Dead |
| `thinkback-play/` | `src/cli/commands/thinkback-play/index.ts` | Dead |
| `udemy.ts` | `src/cli/commands/udemy.ts` | Live |
| `uninstall.ts` | `src/cli/commands/uninstall.ts` | Live |
| `upgrade.ts` | `src/cli/commands/upgrade.ts` | Live |
| `usage/` | `src/cli/commands/usage/index.ts` | Dead |
| `vault.ts` | `src/cli/commands/vault.ts` | Live |
| `verification.ts` | `src/cli/commands/verification.ts` | Live |
| `version/` | `src/cli/commands/version/index.ts` | Dead |
| `version.ts` | `src/cli/commands/version.ts` | Dead |
| `vim/` | `src/cli/commands/vim/index.ts` | Dead |
| `vm.ts` | `src/cli/commands/vm.ts` | Dead |
| `voice.ts` | `src/cli/commands/voice.ts` | Partial / no-op |
| `web.ts` | `src/cli/commands/web.ts` | Live |

## Cautions

1. **Build could not run:** `bun run build` fails because workspace siblings (`@allternit/gizzi-util`, `@allternit/sdk`, etc.) are not present in this isolated worktree. The static graph is therefore the authoritative reachability source.
2. **Dynamic imports:** Eleven files are reached only via `import()` (see list above). They are marked reachable, but verify runtime usage before deleting callers.
3. **Mixed directories:** `src/cli/ui/ink-app/`, `src/shared/utils/`, `src/runtime/tools/`, `src/runtime/services/`, and `src/cli/commands/` contain both live and dead files. Do not delete these directories wholesale.
4. **Live files in otherwise-dead directories:** `src/context/notifications.tsx`, `src/cli/hooks/useChromeExtensionNotification.tsx`, and `src/cli/ui/components/DesktopHandoff.tsx` are reachable even though their sibling files are dead.
5. **`src/cli/ui/ink-app/context/sdk.tsx` / `helper.tsx`:** Reachable from `thread.ts` only for the `EventSource` type, but they import `solid-js` and `@solid-primitives/event-bus`. If the OpenTUI stack is removed, replace the type import in `thread.ts` to drop these deps.
6. **Cowork TUI subcommands:** `src/cli/commands/cowork.ts` imports dead TUI modules (`@/ink`, `@/screens/IntelliTaskScreen`). The subcommands that use them are not reachable at runtime until invoked, but the module graph loads them eagerly. Remove those subcommands before deleting the dead TUI modules.
7. **Workspace packages:** Dependencies on `@allternit/*` workspace packages are unresolved in this environment; their usage was not counted. Verify them separately in the full monorepo.

---
*Audit generated from static import graph of 5876 `src/` files. Machine-readable graph available at `/tmp/gizzi-audit-graph6.json`.*
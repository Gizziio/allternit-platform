use crate::client::{BrainSession, KernelClient};
use crate::tui_components::{DiffViewer, GitManager, HookContext, HookManager, HookType, MultiLineInput, SyntaxHighlighter};
use clap::Parser;
use crossterm::{
    event::{self, Event, KeyCode, KeyEvent, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Wrap},
    Frame, Terminal,
};
use serde_json::{json, Value};
use std::collections::VecDeque;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use tokio::process::Command;
use tokio::sync::mpsc;
use tokio::sync::mpsc::error::TryRecvError;
use tokio::time::{Duration, Instant};

const SPINNER_FRAMES: [&str; 4] = ["-", "\\", "|", "/"];
const PROMPT_ICON_FRAMES: [&str; 4] = ["▸", "▹", "▸", "▹"];
const PATH_CACHE_TTL_SECONDS: u64 = 30;
const MAX_PATH_ENTRIES: usize = 8000;
const STREAM_WAVE_FRAMES: [&str; 8] = [
    "▁▂▃▄▅▆▇█",
    "▂▃▄▅▆▇█▆",
    "▃▄▅▆▇█▆▅",
    "▄▅▆▇█▆▅▄",
    "▅▆▇█▆▅▄▃",
    "▆▇█▆▅▄▃▂",
    "▇█▆▅▄▃▂▁",
    "█▆▅▄▃▂▁▂",
];

#[derive(Debug, Parser, Clone)]
#[command(name = "tui", about = "Open a terminal UI connected to the Gateway")]
pub struct TuiArgs {
    /// Override kernel/API base URL for this TUI session
    #[arg(long)]
    pub url: Option<String>,

    /// Bearer token for authenticated kernel/API connections
    #[arg(long)]
    pub token: Option<String>,

    /// Password used by gateways that do not issue bearer tokens
    #[arg(long)]
    pub password: Option<String>,

    /// Session key/id to target on startup
    #[arg(long)]
    pub session: Option<String>,

    /// Deliver assistant responses to downstream channels/providers
    #[arg(long, default_value_t = false)]
    pub deliver: bool,

    /// Thinking level hint for dispatched intents
    #[arg(long)]
    pub thinking: Option<String>,

    /// Number of history entries to keep in memory
    #[arg(long, default_value_t = 200)]
    pub history_limit: usize,

    /// HTTP timeout (milliseconds) for this TUI session
    #[arg(long)]
    pub timeout_ms: Option<u64>,

    /// Optional initial message to dispatch on startup
    #[arg(long)]
    pub message: Option<String>,
}

#[derive(Debug, Clone)]
enum ChatRole {
    User,
    Assistant,
    System,
    Error,
}

#[derive(Debug, Clone)]
struct ChatEntry {
    role: ChatRole,
    text: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Overlay {
    None,
    Agents,
    Sessions,
    Models,
    Commands,
    Paths,
    Help,
    History,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ScreenMode {
    Intro,
    Main,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PathOverlayMode {
    WorkspacePicker,
    MentionReference,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OverlayTrigger {
    None,
    SlashCommand,
    FileMention,
    Other,
}

#[derive(Debug, Clone)]
struct PathEntry {
    label: String,
    path: PathBuf,
}

#[derive(Debug, Clone)]
struct TodoItem {
    task: String,
    completed: bool,
    created_at: Instant,
}

pub struct TuiApp<'a> {
    client: &'a KernelClient,
    args: TuiArgs,
    should_quit: bool,
    input: MultiLineInput,
    entries: Vec<ChatEntry>,
    sessions: Vec<BrainSession>,
    current_agent: String,
    current_session: String,
    current_model: String,
    connection_status: String,
    activity_status: String,
    health_status: String,
    mcp_status: String,
    mcp_connected: usize,
    mcp_total: usize,
    status_line: String,
    screen_mode: ScreenMode,
    intro_input: String,
    intro_started_at: Instant,
    intro_frame: usize,
    overlay: Overlay,
    overlay_cursor: usize,
    overlay_filter: String,
    overlay_trigger: OverlayTrigger,
    show_thinking: bool,
    tools_expanded: bool,
    allow_local_shell: Option<bool>,
    ctrl_c_last: Option<Instant>,
    attached_session: Option<String>,
    stream_rx: Option<mpsc::Receiver<Value>>,
    last_refresh: Instant,
    refresh_interval: Duration,
    last_stream_event: Option<Instant>,
    activity_started_at: Option<Instant>,
    spinner_index: usize,
    input_history: Vec<String>,
    history_cursor: Option<usize>,
    prompt_queue: VecDeque<String>,
    queue_paused: bool,
    known_models: Vec<String>,
    current_path: PathBuf,
    path_entries: Vec<PathEntry>,
    path_error: Option<String>,
    path_overlay_mode: PathOverlayMode,
    path_cache_time: Option<Instant>,
    path_cache_root: Option<PathBuf>,
    telemetry_fields: Vec<String>,
    // Claude Code parity features
    output_style: String,
    plan_mode: bool,
    ultrathink_mode: bool,
    todos: Vec<TodoItem>,
    session_started_at: Instant,
    total_tokens_sent: usize,
    total_tokens_received: usize,
    // Syntax highlighting
    syntax_highlighter: SyntaxHighlighter,
    // Auto-completion suggestions
    current_suggestion: Option<String>,
    suggestion_context: SuggestionContext,
    // Diff viewer for AI changes
    diff_viewer: DiffViewer,
    show_diff: bool,
    // Hooks system
    hook_manager: HookManager,
    // Git auto-commit
    git_manager: GitManager,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SuggestionContext {
    None,
    SlashCommand,
    FileMention,
    FilePath,
    General,
}

impl<'a> TuiApp<'a> {
    fn new(client: &'a KernelClient, args: TuiArgs) -> Self {
        let current_session = args
            .session
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "main".to_string());
        let current_path = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let known_models = vec![
            "openai/gpt-4o".to_string(),
            "openai/gpt-4o-mini".to_string(),
            "anthropic/claude-3-5-sonnet".to_string(),
            "anthropic/claude-3-opus".to_string(),
            "gemini/gemini-1.5-pro".to_string(),
            "gemini/gemini-1.5-flash".to_string(),
        ];

        Self {
            client,
            current_agent: "main".to_string(),
            current_model: "default".to_string(),
            connection_status: "connecting".to_string(),
            activity_status: "idle".to_string(),
            health_status: "unknown".to_string(),
            mcp_status: "offline".to_string(),
            mcp_connected: 0,
            mcp_total: 0,
            status_line: "ready".to_string(),
            screen_mode: ScreenMode::Intro,
            intro_input: String::new(),
            intro_started_at: Instant::now(),
            intro_frame: 0,
            should_quit: false,
            input: MultiLineInput::new(),
            entries: Vec::new(),
            sessions: Vec::new(),
            overlay: Overlay::None,
            overlay_cursor: 0,
            overlay_filter: String::new(),
            overlay_trigger: OverlayTrigger::None,
            show_thinking: false,
            tools_expanded: false,
            allow_local_shell: None,
            ctrl_c_last: None,
            attached_session: None,
            stream_rx: None,
            last_refresh: Instant::now(),
            refresh_interval: Duration::from_secs(5),
            last_stream_event: None,
            activity_started_at: None,
            spinner_index: 0,
            input_history: Vec::new(),
            history_cursor: None,
            prompt_queue: VecDeque::new(),
            queue_paused: false,
            known_models,
            current_path,
            path_entries: Vec::new(),
            path_error: None,
            path_overlay_mode: PathOverlayMode::WorkspacePicker,
            path_cache_time: None,
            path_cache_root: None,
            telemetry_fields: vec![
                "conn".to_string(),
                "activity".to_string(),
                "health".to_string(),
                "mcp".to_string(),
                "agent".to_string(),
                "session".to_string(),
                "model".to_string(),
                "queue".to_string(),
                "path".to_string(),
            ],
            // Claude Code parity features
            output_style: "default".to_string(),
            plan_mode: false,
            ultrathink_mode: false,
            todos: Vec::new(),
            session_started_at: Instant::now(),
            total_tokens_sent: 0,
            total_tokens_received: 0,
            current_session,
            args,
            syntax_highlighter: SyntaxHighlighter::new(),
            current_suggestion: None,
            suggestion_context: SuggestionContext::None,
            diff_viewer: DiffViewer::new(),
            show_diff: false,
            hook_manager: Self::init_hook_manager(),
            git_manager: GitManager::new(std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))),
        }
    }

    /// Initialize hook manager and create default config if needed
    fn init_hook_manager() -> HookManager {
        let config_dir = directories::BaseDirs::new()
            .map(|d| d.config_dir().join("a2rchitech"))
            .or_else(|| directories::BaseDirs::new().map(|d| d.home_dir().join(".a2r")))
            .unwrap_or_else(|| PathBuf::from(".a2r"));
        
        std::fs::create_dir_all(&config_dir).ok();
        
        let config_path = config_dir.join("hooks.yml");
        
        // Create default config if it doesn't exist
        if !config_path.exists() {
            HookManager::create_default_config(&config_path).ok();
        }
        
        HookManager::new(&config_path)
    }

    /// Execute pre-command hooks
    async fn execute_pre_command_hooks(&self, command: &str) -> Vec<(String, crate::tui_components::hooks::HookResult)> {
        let context = HookContext::for_command(command);
        self.hook_manager.execute_hooks(HookType::PreCommand, &context).await
    }

    /// Execute post-command hooks
    async fn execute_post_command_hooks(&self, command: &str) {
        let context = HookContext::for_command(command);
        self.hook_manager.execute_hooks(HookType::PostCommand, &context).await;
    }

    async fn initialize(&mut self) {
        self.refresh_state().await;
        self.refresh_models().await;
        self.refresh_path_entries();
        self.push_system(format!(
            "Connected to {} | agent {} | session {}",
            self.client.base_url(),
            self.current_agent,
            self.current_session
        ));
        self.push_system(format!("workspace path: {}", self.current_path.display()));
        self.push_system(
            "Shortcuts: Ctrl+G agents, Ctrl+P sessions, Ctrl+L models, Ctrl+F path picker, Ctrl+O tools, Ctrl+T thinking, Esc abort, Ctrl+D exit"
                .to_string(),
        );
        self.push_system(
            "Slash: /queue /stop /resume /skills /telemetry /path /models /help".to_string(),
        );
        self.push_system("Type '@' in input to open file reference picker.".to_string());

        if let Some(message) = self
            .args
            .message
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
        {
            self.dispatch_message(message).await;
        }
    }

    /// Update auto-completion suggestion based on current input
    fn update_suggestion(&mut self) {
        let content = self.input.content();
        
        // Determine context and find suggestion
        if content.starts_with('/') {
            self.suggestion_context = SuggestionContext::SlashCommand;
            self.current_suggestion = self.find_slash_command_suggestion(&content);
        } else if let Some(query) = self.active_mention_query() {
            self.suggestion_context = SuggestionContext::FileMention;
            self.current_suggestion = self.find_file_mention_suggestion(&query);
        } else if !content.is_empty() {
            self.suggestion_context = SuggestionContext::General;
            self.current_suggestion = self.find_history_suggestion(&content);
        } else {
            self.suggestion_context = SuggestionContext::None;
            self.current_suggestion = None;
        }
    }

    /// Find best matching slash command suggestion
    fn find_slash_command_suggestion(&self, input: &str) -> Option<String> {
        let commands = slash_command_catalog();
        let input_lower = input.to_ascii_lowercase();
        
        // Find commands that start with the input
        let matches: Vec<_> = commands
            .iter()
            .filter(|cmd| cmd.to_ascii_lowercase().starts_with(&input_lower))
            .cloned()
            .collect();
        
        if matches.is_empty() {
            // Try partial match
            commands
                .into_iter()
                .find(|cmd| cmd.to_ascii_lowercase().contains(&input_lower))
        } else {
            // Return the shortest match (most specific)
            matches.into_iter().min_by_key(|cmd| cmd.len())
        }
    }

    /// Find best matching file mention suggestion
    fn find_file_mention_suggestion(&self, query: &str) -> Option<String> {
        let query_lower = query.to_ascii_lowercase();
        
        self.path_entries
            .iter()
            .map(|entry| entry.label.clone())
            .find(|label| label.to_ascii_lowercase().starts_with(&query_lower))
    }

    /// Find best matching history suggestion
    fn find_history_suggestion(&self, input: &str) -> Option<String> {
        let input_lower = input.to_ascii_lowercase();
        
        self.input_history
            .iter()
            .rev()
            .find(|cmd| {
                let cmd_lower = cmd.to_ascii_lowercase();
                cmd_lower.starts_with(&input_lower) && cmd.len() > input.len()
            })
            .cloned()
    }

    /// Accept the current suggestion
    fn accept_suggestion(&mut self) {
        if let Some(suggestion) = &self.current_suggestion {
            match self.suggestion_context {
                SuggestionContext::SlashCommand => {
                    self.input.set_text(format!("{} ", suggestion));
                }
                _ => {
                    self.input.set_text(suggestion.clone());
                }
            }
            self.current_suggestion = None;
            self.suggestion_context = SuggestionContext::None;
        }
    }

    fn set_activity_status(&mut self, status: &str) {
        if self.activity_status != status {
            self.activity_status = status.to_string();
            if status == "idle" {
                self.activity_started_at = None;
            } else {
                self.activity_started_at = Some(Instant::now());
            }
        }
    }

    fn push_entry(&mut self, role: ChatRole, text: String) {
        let limit = self.args.history_limit.clamp(50, 2000);
        self.entries.push(ChatEntry { role, text });
        if self.entries.len() > limit {
            let keep_from = self.entries.len() - limit;
            self.entries = self.entries.split_off(keep_from);
        }
    }

    fn push_user(&mut self, text: String) {
        self.push_entry(ChatRole::User, text);
    }

    fn push_assistant(&mut self, text: String) {
        self.push_entry(ChatRole::Assistant, text);
    }

    fn push_system(&mut self, text: String) {
        self.push_entry(ChatRole::System, text);
    }

    fn push_error(&mut self, text: String) {
        self.push_entry(ChatRole::Error, text);
    }

    fn has_telemetry_field(&self, field: &str) -> bool {
        self.telemetry_fields
            .iter()
            .any(|value| value.eq_ignore_ascii_case(field))
    }

    fn telemetry_line(&self) -> String {
        let mut parts = Vec::new();
        if self.has_telemetry_field("conn") {
            parts.push(format!("conn={}", self.connection_status));
        }
        if self.has_telemetry_field("activity") {
            parts.push(format!("activity={}", self.activity_status));
        }
        if self.has_telemetry_field("health") {
            parts.push(format!("health={}", self.health_status));
        }
        if self.has_telemetry_field("mcp") {
            parts.push(format!("mcp={}", self.mcp_status));
        }
        if self.has_telemetry_field("agent") {
            parts.push(format!("agent={}", self.current_agent));
        }
        if self.has_telemetry_field("session") {
            parts.push(format!("session={}", self.current_session));
        }
        if self.has_telemetry_field("model") {
            parts.push(format!("model={}", self.current_model));
        }
        if self.has_telemetry_field("queue") {
            parts.push(format!(
                "queue={}{}",
                self.prompt_queue.len(),
                if self.queue_paused { "(paused)" } else { "" }
            ));
        }
        if self.has_telemetry_field("path") {
            parts.push(format!(
                "path={}",
                truncate_for_ui(&self.current_path.display().to_string(), 30)
            ));
        }
        parts.join(" | ")
    }

    fn set_current_path<P: AsRef<Path>>(&mut self, path: P) {
        let target = path.as_ref();
        let resolved = if target.is_absolute() {
            target.to_path_buf()
        } else {
            self.current_path.join(target)
        };

        let canonical = resolved.canonicalize().unwrap_or_else(|_| resolved.clone());
        if canonical.is_dir() {
            self.current_path = canonical;
            self.path_error = None;
            self.refresh_path_entries();
        } else if canonical.is_file() {
            if let Some(parent) = canonical.parent() {
                self.current_path = parent.to_path_buf();
                self.path_error = None;
                self.refresh_path_entries();
            } else {
                self.path_error = Some(format!(
                    "path has no parent directory: {}",
                    canonical.display()
                ));
            }
        } else {
            self.path_error = Some(format!("path does not exist: {}", canonical.display()));
        }
    }

    fn refresh_path_entries(&mut self) {
        self.path_entries.clear();
        self.path_error = None;

        if let Some(parent) = self.current_path.parent() {
            self.path_entries.push(PathEntry {
                label: "..".to_string(),
                path: parent.to_path_buf(),
            });
        }

        let entries = fs::read_dir(&self.current_path);
        let mut dirs = Vec::new();
        let mut files = Vec::new();

        match entries {
            Ok(read_dir) => {
                for item in read_dir.flatten() {
                    let path = item.path();
                    let name = item.file_name().to_string_lossy().to_string();
                    if path.is_dir() {
                        dirs.push(PathEntry {
                            label: format!("{name}/"),
                            path,
                        });
                    } else {
                        files.push(PathEntry { label: name, path });
                    }
                }
                dirs.sort_by(|a, b| a.label.cmp(&b.label));
                files.sort_by(|a, b| a.label.cmp(&b.label));
                self.path_entries.extend(dirs);
                self.path_entries.extend(files);
            }
            Err(err) => {
                self.path_error = Some(format!(
                    "failed to read {}: {err}",
                    self.current_path.display()
                ));
            }
        }
    }

    fn refresh_mention_entries(&mut self) {
        self.path_error = None;

        let root = self.current_path.clone();
        let now = Instant::now();
        let cache_ttl = Duration::from_secs(PATH_CACHE_TTL_SECONDS);

        // Check if we can use cached entries
        let should_use_cache = self.path_cache_root.as_ref() == Some(&root)
            && self
                .path_cache_time
                .map(|t| now.duration_since(t) < cache_ttl)
                .unwrap_or(false)
            && !self.path_entries.is_empty();

        if should_use_cache {
            return;
        }

        // Need to refresh the cache
        self.path_entries.clear();

        let mut stack = vec![root.clone()];
        let mut entries = Vec::new();

        while let Some(dir) = stack.pop() {
            let read_dir = match fs::read_dir(&dir) {
                Ok(value) => value,
                Err(err) => {
                    self.path_error = Some(format!("failed to read {}: {err}", dir.display()));
                    continue;
                }
            };

            for item in read_dir.flatten() {
                let path = item.path();
                let name = item.file_name().to_string_lossy().to_string();

                if path.is_dir() {
                    if matches!(
                        name.as_str(),
                        ".git"
                            | "node_modules"
                            | "target"
                            | ".venv"
                            | "venv"
                            | "__pycache__"
                            | ".idea"
                            | ".vscode"
                            | "dist"
                            | "build"
                    ) {
                        continue;
                    }
                    stack.push(path);
                } else if let Ok(relative) = path.strip_prefix(&root) {
                    entries.push(PathEntry {
                        label: relative.display().to_string(),
                        path,
                    });
                } else {
                    entries.push(PathEntry {
                        label: path.display().to_string(),
                        path,
                    });
                }

                if entries.len() >= MAX_PATH_ENTRIES {
                    break;
                }
            }

            if entries.len() >= MAX_PATH_ENTRIES {
                break;
            }
        }

        entries.sort_by(|a, b| a.label.cmp(&b.label));
        self.path_entries = entries;
        self.path_cache_time = Some(now);
        self.path_cache_root = Some(root);
    }

    fn open_workspace_path_overlay(&mut self) {
        self.path_overlay_mode = PathOverlayMode::WorkspacePicker;
        self.refresh_path_entries();
        self.overlay = Overlay::Paths;
        self.overlay_cursor = 0;
        self.overlay_filter.clear();
        self.overlay_trigger = OverlayTrigger::Other;
    }

    fn open_mention_path_overlay(&mut self, query: String) {
        self.path_overlay_mode = PathOverlayMode::MentionReference;
        self.refresh_mention_entries();
        self.overlay = Overlay::Paths;
        self.overlay_cursor = 0;
        self.overlay_filter = query;
        self.overlay_trigger = OverlayTrigger::FileMention;
        self.clamp_overlay_cursor();
    }

    fn active_mention_query(&self) -> Option<String> {
        active_mention_range(&self.input.content()).map(|(start, end)| self.input.content()[start + 1..end].to_string())
    }

    fn insert_mention_reference(&mut self, reference: &str) {
        let mention = format!("@{} ", reference);
        if let Some((start, end)) = active_mention_range(&self.input.content()) {
            self.input.replace_range(start..end, &mention);
        } else if self.input.is_empty() {
            self.input.set_text(mention);
        } else {
            if !self.input.ends_with(" ") {
                self.input.push(' ');
            }
            self.input.push_str(&mention);
        }
        self.history_cursor = None;
    }

    fn path_filtered_indices(&self) -> Vec<usize> {
        let query = self.overlay_filter.trim().to_ascii_lowercase();
        if query.is_empty() {
            return (0..self.path_entries.len()).collect();
        }

        let mut scored: Vec<(usize, i32)> = self
            .path_entries
            .iter()
            .enumerate()
            .filter_map(|(idx, entry)| {
                let label_lower = entry.label.to_ascii_lowercase();
                if let Some(score) = fuzzy_match(&label_lower, &query) {
                    Some((idx, score))
                } else {
                    None
                }
            })
            .collect();

        // Sort by score descending (higher is better)
        scored.sort_by(|a, b| b.1.cmp(&a.1));
        scored.into_iter().map(|(idx, _)| idx).collect()
    }

    async fn refresh_models(&mut self) {
        let payload = match self.client.get::<Value>("/v1/models").await {
            Ok(value) => value,
            Err(_) => json!({
                "providers": {
                    "openai": ["gpt-4o", "gpt-4o-mini"],
                    "anthropic": ["claude-3-5-sonnet", "claude-3-opus"],
                    "gemini": ["gemini-1.5-pro", "gemini-1.5-flash"]
                }
            }),
        };

        let mut models = extract_models_from_payload(&payload);
        if !self.current_model.trim().is_empty() {
            models.push(self.current_model.clone());
        }
        models.sort();
        models.dedup();
        if !models.is_empty() {
            self.known_models = models;
        }
    }

    fn add_input_history(&mut self, line: &str) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return;
        }

        let should_push = self
            .input_history
            .last()
            .map(|last| last != trimmed)
            .unwrap_or(true);
        if should_push {
            self.input_history.push(trimmed.to_string());
            if self.input_history.len() > 200 {
                let keep_from = self.input_history.len() - 200;
                self.input_history = self.input_history.split_off(keep_from);
            }
        }
        self.history_cursor = None;
    }

    fn navigate_input_history(&mut self, upward: bool) {
        if self.input_history.is_empty() {
            return;
        }

        let next_cursor = match (self.history_cursor, upward) {
            (None, true) => Some(self.input_history.len().saturating_sub(1)),
            (None, false) => None,
            (Some(0), true) => Some(0),
            (Some(index), true) => Some(index.saturating_sub(1)),
            (Some(index), false) if index + 1 >= self.input_history.len() => None,
            (Some(index), false) => Some(index + 1),
        };

        self.history_cursor = next_cursor;
        if let Some(index) = self.history_cursor {
            if let Some(value) = self.input_history.get(index) {
                self.input.set_text(value.clone());
            }
        } else {
            self.input.clear();
        }
    }

    async fn on_tick(&mut self) {
        self.spinner_index = (self.spinner_index + 1) % SPINNER_FRAMES.len();
        self.intro_frame = (self.intro_frame + 1) % 10000;
        self.drain_stream();

        if self.activity_status == "streaming" {
            if let Some(last_event) = self.last_stream_event {
                if last_event.elapsed() > Duration::from_millis(1200) {
                    self.set_activity_status("idle");
                }
            }
        }

        let can_drain_queue = self.screen_mode == ScreenMode::Main
            && !self.queue_paused
            && self.activity_status == "idle"
            && self.stream_rx.is_none();
        if can_drain_queue {
            if let Some(next_prompt) = self.prompt_queue.pop_front() {
                self.push_system(format!(
                    "dispatching queued prompt ({} remaining)",
                    self.prompt_queue.len()
                ));
                self.dispatch_message(next_prompt).await;
            }
        }

        if self.last_refresh.elapsed() >= self.refresh_interval {
            self.refresh_state().await;
            self.last_refresh = Instant::now();
        }
    }

    async fn refresh_state(&mut self) {
        self.refresh_sessions().await;
        self.refresh_health().await;
        self.refresh_mcp_status().await;
    }

    async fn refresh_sessions(&mut self) {
        match self.client.list_brain_sessions().await {
            Ok(sessions) => {
                self.sessions = sessions;
                self.connection_status = "connected".to_string();
            }
            Err(err) => {
                self.connection_status = "disconnected".to_string();
                self.status_line = format!("session refresh failed: {err}");
            }
        }
    }

    async fn refresh_health(&mut self) {
        match self.client.health().await {
            Ok(payload) => {
                let status = payload
                    .get("status")
                    .and_then(|value| value.as_str())
                    .unwrap_or("ok");
                self.health_status = status.to_string();

                let mode = payload
                    .get("mode")
                    .and_then(|value| value.as_str())
                    .unwrap_or("runtime");

                self.status_line = format!("health: {status} | mode: {mode}");
            }
            Err(err) => {
                self.health_status = "unavailable".to_string();
                self.status_line = format!("health unavailable: {err}");
            }
        }
    }

    async fn refresh_mcp_status(&mut self) {
        match self.client.get::<Value>("/v1/system/presence").await {
            Ok(payload) => {
                let source = payload.get("mcp").unwrap_or(&payload);
                let (connected, total) = count_connected_flags(source);
                self.mcp_connected = connected;
                self.mcp_total = total;
                self.mcp_status = if total == 0 {
                    "online".to_string()
                } else if connected == total {
                    format!("online {connected}/{total}")
                } else if connected > 0 {
                    format!("degraded {connected}/{total}")
                } else {
                    format!("offline 0/{total}")
                };
            }
            Err(_) => {
                self.mcp_connected = 0;
                self.mcp_total = 0;
                self.mcp_status = "offline".to_string();
            }
        }
    }

    fn selectable_agents(&self) -> Vec<String> {
        let mut values = self
            .sessions
            .iter()
            .map(|session| session.brain_id.clone())
            .collect::<Vec<_>>();
        values.push(self.current_agent.clone());
        values.sort();
        values.dedup();
        values
    }

    fn selectable_sessions(&self) -> Vec<String> {
        let mut values = self
            .sessions
            .iter()
            .filter(|session| {
                session.brain_id == self.current_agent || self.current_agent == "main"
            })
            .map(|session| session.id.clone())
            .collect::<Vec<_>>();
        values.push(self.current_session.clone());
        values.sort();
        values.dedup();
        values
    }

    fn selectable_models(&self) -> Vec<String> {
        let mut models = self.known_models.clone();
        models.push(self.current_model.clone());
        models.sort();
        models.dedup();
        models
    }

    fn overlay_items_base(&self) -> Vec<String> {
        match self.overlay {
            Overlay::Agents => self.selectable_agents(),
            Overlay::Sessions => self.selectable_sessions(),
            Overlay::Models => self.selectable_models(),
            Overlay::Commands => slash_command_catalog(),
            Overlay::Paths => self
                .path_entries
                .iter()
                .map(|entry| entry.label.clone())
                .collect(),
            Overlay::Help => vec![
                "/help /status /agent <id> /agents /session <id> /sessions".to_string(),
                "/model <id> /models /skills [query]".to_string(),
                "/queue [add|list|clear|pause|resume|run]".to_string(),
                "/path [show|set <path>|picker]  /cd <path>".to_string(),
                "/shell [on|off|status]".to_string(),
                "/telemetry [show|toggle <field>|preset <name>|fields]".to_string(),
                "/verbose <on|off> /reasoning <on|off|stream> /usage <off|tokens|full>".to_string(),
                "/new /reset /abort /settings /exit".to_string(),
                "Tab cycles agents. Type '/' for command palette.".to_string(),
                "Type '@' to open file picker and insert @path into your prompt.".to_string(),
                "Ctrl+G/P/L pickers, Ctrl+F paths, Ctrl+O tools, Ctrl+T thinking, Ctrl+H history".to_string(),
                "Overlay filter: type to search, Backspace to edit filter".to_string(),
            ],
            Overlay::History => {
                // Return history in reverse order (most recent first), deduplicated
                let mut seen = std::collections::HashSet::new();
                self.input_history
                    .iter()
                    .rev()
                    .filter(|cmd| seen.insert(*cmd))
                    .cloned()
                    .collect()
            }
            Overlay::None => Vec::new(),
        }
    }

    fn overlay_items_filtered(&self) -> Vec<String> {
        let items = self.overlay_items_base();
        if self.overlay == Overlay::Help {
            return items;
        }

        let query = self.overlay_filter.trim().to_ascii_lowercase();
        if query.is_empty() {
            return items;
        }

        items
            .into_iter()
            .filter(|value| value.to_ascii_lowercase().contains(&query))
            .collect()
    }

    fn clamp_overlay_cursor(&mut self) {
        let count = if self.overlay == Overlay::Commands {
            self.count_filtered_commands()
        } else {
            self.overlay_items_filtered().len()
        };
        if count == 0 {
            self.overlay_cursor = 0;
        } else if self.overlay_cursor >= count {
            self.overlay_cursor = count - 1;
        }
    }

    fn cycle_agent(&mut self, forward: bool) {
        let agents = self.selectable_agents();
        if agents.is_empty() {
            return;
        }

        let current_idx = agents
            .iter()
            .position(|agent| agent == &self.current_agent)
            .unwrap_or(0);
        let next_idx = if forward {
            (current_idx + 1) % agents.len()
        } else if current_idx == 0 {
            agents.len() - 1
        } else {
            current_idx - 1
        };

        self.current_agent = agents[next_idx].clone();
        self.push_system(format!("active agent: {}", self.current_agent));
    }

    fn open_commands_overlay(&mut self) {
        self.overlay = Overlay::Commands;
        self.overlay_cursor = 0;
        self.overlay_filter = self.input.trim().trim_start_matches('/').to_string();
        self.overlay_trigger = OverlayTrigger::SlashCommand;
        self.clamp_overlay_cursor();
    }

    fn open_history_search(&mut self) {
        if self.input_history.is_empty() {
            self.push_system("No command history available".to_string());
            return;
        }
        self.overlay = Overlay::History;
        self.overlay_cursor = 0;
        self.overlay_filter = self.input.content().trim().to_string();
        self.overlay_trigger = OverlayTrigger::Other;
        self.clamp_overlay_cursor();
    }

    /// Get the selected command name from the categorized list based on cursor position
    fn get_selected_command_at_cursor(&self) -> Option<String> {
        if self.overlay != Overlay::Commands {
            return None;
        }

        let categorized = slash_command_catalog_by_category();
        let filter = self.overlay_filter.trim().to_ascii_lowercase();
        
        let mut current_index = 0;
        
        for (_, commands) in categorized {
            let filtered_commands: Vec<_> = if filter.is_empty() {
                commands
            } else {
                commands
                    .into_iter()
                    .filter(|cmd| {
                        cmd.name.to_ascii_lowercase().contains(&filter) ||
                        cmd.description.to_ascii_lowercase().contains(&filter)
                    })
                    .collect()
            };

            if current_index + filtered_commands.len() > self.overlay_cursor {
                // The selected item is in this category
                let index_in_category = self.overlay_cursor - current_index;
                return filtered_commands.get(index_in_category).map(|cmd| cmd.name.clone());
            }
            
            current_index += filtered_commands.len();
        }
        
        None
    }

    /// Count total commands matching current filter (for cursor clamping)
    fn count_filtered_commands(&self) -> usize {
        let categorized = slash_command_catalog_by_category();
        let filter = self.overlay_filter.trim().to_ascii_lowercase();
        
        let mut total = 0;
        for (_, commands) in categorized {
            let filtered: Vec<_> = if filter.is_empty() {
                commands
            } else {
                commands
                    .into_iter()
                    .filter(|cmd| {
                        cmd.name.to_ascii_lowercase().contains(&filter) ||
                        cmd.description.to_ascii_lowercase().contains(&filter)
                    })
                    .collect()
            };
            total += filtered.len();
        }
        total
    }

    async fn handle_key(&mut self, key: KeyEvent) {
        if self.screen_mode == ScreenMode::Intro {
            self.handle_intro_key(key).await;
            return;
        }

        if self.overlay != Overlay::None {
            self.handle_overlay_key(key).await;
            return;
        }

        if key.modifiers.contains(KeyModifiers::CONTROL) {
            match key.code {
                KeyCode::Char('d') => {
                    self.should_quit = true;
                    return;
                }
                KeyCode::Char('c') => {
                    self.handle_ctrl_c();
                    return;
                }
                KeyCode::Char('g') => {
                    self.overlay = Overlay::Agents;
                    self.overlay_cursor = 0;
                    self.overlay_filter.clear();
                    self.overlay_trigger = OverlayTrigger::Other;
                    return;
                }
                KeyCode::Char('p') => {
                    self.overlay = Overlay::Sessions;
                    self.overlay_cursor = 0;
                    self.overlay_filter.clear();
                    self.overlay_trigger = OverlayTrigger::Other;
                    return;
                }
                KeyCode::Char('l') => {
                    self.overlay = Overlay::Models;
                    self.overlay_cursor = 0;
                    self.overlay_filter.clear();
                    self.overlay_trigger = OverlayTrigger::Other;
                    return;
                }
                KeyCode::Char('f') => {
                    self.open_workspace_path_overlay();
                    return;
                }
                KeyCode::Char('h') => {
                    self.overlay = Overlay::Help;
                    self.overlay_cursor = 0;
                    self.overlay_filter.clear();
                    self.overlay_trigger = OverlayTrigger::Other;
                    return;
                }
                KeyCode::Char('o') => {
                    self.tools_expanded = !self.tools_expanded;
                    self.push_system(format!(
                        "tool output {}",
                        if self.tools_expanded {
                            "expanded"
                        } else {
                            "collapsed"
                        }
                    ));
                    return;
                }
                KeyCode::Char('t') => {
                    self.show_thinking = !self.show_thinking;
                    self.push_system(format!(
                        "thinking visibility {}",
                        if self.show_thinking { "on" } else { "off" }
                    ));
                    return;
                }
                KeyCode::Char('s') => {
                    self.abort_active_run().await;
                    return;
                }
                KeyCode::Char('r') => {
                    self.queue_paused = false;
                    if self.attached_session.is_none() {
                        self.attach_stream_for_current_session().await;
                    }
                    self.push_system("resumed queue/stream".to_string());
                    return;
                }
                KeyCode::Char('h') => {
                    self.open_history_search();
                    return;
                }
                _ => {}
            }
        }

        match key.code {
            KeyCode::Esc => self.abort_active_run().await,
            KeyCode::Tab => {
                // Check if there's a suggestion to accept
                if self.current_suggestion.is_some() && self.suggestion_context != SuggestionContext::None {
                    self.accept_suggestion();
                } else if self.input.trim_start().starts_with('/') {
                    self.open_commands_overlay();
                } else if let Some(query) = self.active_mention_query() {
                    self.open_mention_path_overlay(query);
                } else {
                    self.cycle_agent(true);
                }
            }
            KeyCode::BackTab => self.cycle_agent(false),
            // Shift+Enter inserts newline, Enter submits
            KeyCode::Enter => {
                if key.modifiers.contains(KeyModifiers::SHIFT) {
                    self.input.insert_char('\n');
                    self.history_cursor = None;
                } else {
                    self.submit_input().await;
                }
            }
            KeyCode::Backspace => {
                self.input.backspace();
                self.history_cursor = None;
                self.update_suggestion();
            }
            KeyCode::Delete => {
                self.input.delete_char();
                self.history_cursor = None;
                self.update_suggestion();
            }
            // Arrow key navigation (including Alt+arrows for word movement)
            KeyCode::Up => {
                if key.modifiers.contains(KeyModifiers::ALT) {
                    // Move line up (future enhancement)
                } else {
                    self.input.move_up(1);
                }
            }
            KeyCode::Down => {
                if key.modifiers.contains(KeyModifiers::ALT) {
                    // Move line down (future enhancement)
                } else {
                    self.input.move_down(1);
                }
            }
            KeyCode::Left => {
                if key.modifiers.contains(KeyModifiers::CONTROL) || key.modifiers.contains(KeyModifiers::ALT) {
                    self.input.move_word_left();
                } else {
                    self.input.move_left(1);
                }
            }
            KeyCode::Right => {
                if key.modifiers.contains(KeyModifiers::CONTROL) || key.modifiers.contains(KeyModifiers::ALT) {
                    self.input.move_word_right();
                } else {
                    self.input.move_right(1);
                }
            }
            // Home/End for line navigation
            KeyCode::Home => {
                self.input.move_to_start();
            }
            KeyCode::End => {
                self.input.move_to_end();
            }
            // PageUp/PageDown for history (keep existing behavior)
            KeyCode::PageUp => self.navigate_input_history(true),
            KeyCode::PageDown => self.navigate_input_history(false),
            // Character insertion
            KeyCode::Char(ch) => {
                let ctrl = key.modifiers.contains(KeyModifiers::CONTROL);
                let alt = key.modifiers.contains(KeyModifiers::ALT);
                
                // Ctrl+A - beginning of line
                if ctrl && ch == 'a' {
                    self.input.move_to_start();
                    return;
                }
                // Ctrl+E - end of line
                if ctrl && ch == 'e' {
                    self.input.move_to_end();
                    return;
                }
                // Ctrl+K - delete to end of line
                if ctrl && ch == 'k' {
                    self.input.delete_to_end();
                    return;
                }
                // Ctrl+U - delete to start of line
                if ctrl && ch == 'u' {
                    self.input.delete_to_start();
                    return;
                }
                // Ctrl+L - clear screen (handled elsewhere)
                if ctrl && ch == 'l' {
                    return;
                }
                // Ctrl+C - copy selection
                if ctrl && ch == 'c' {
                    // Selection copy would go here
                    return;
                }
                // Ctrl+V - paste (handled by terminal)
                // Ctrl+X - cut selection
                if ctrl && ch == 'x' {
                    self.input.delete_selection();
                    return;
                }
                // Normal character input
                if !ctrl && !alt {
                    self.input.insert_char(ch);
                    self.history_cursor = None;
                    if self.input.starts_with("/") {
                        self.open_commands_overlay();
                    } else if let Some(query) = self.active_mention_query() {
                        self.open_mention_path_overlay(query);
                    } else {
                        self.update_suggestion();
                    }
                }
            }
            _ => {}
        }
    }

    async fn handle_intro_key(&mut self, key: KeyEvent) {
        if key.modifiers.contains(KeyModifiers::CONTROL) {
            match key.code {
                KeyCode::Char('d') => {
                    self.should_quit = true;
                    return;
                }
                KeyCode::Char('c') => {
                    self.handle_ctrl_c();
                    return;
                }
                _ => {}
            }
        }

        match key.code {
            KeyCode::Enter => {
                let command = std::mem::take(&mut self.intro_input);
                let trimmed = command.trim().to_string();
                self.screen_mode = ScreenMode::Main;
                if trimmed.is_empty() {
                    self.push_system("intro complete. type /help for commands".to_string());
                } else if trimmed.starts_with('/') {
                    self.handle_slash_command(trimmed).await;
                } else {
                    self.dispatch_message(trimmed).await;
                }
            }
            KeyCode::Backspace => {
                self.intro_input.pop();
            }
            KeyCode::Char(ch)
                if key.modifiers.is_empty() || key.modifiers == KeyModifiers::SHIFT =>
            {
                self.intro_input.push(ch);
            }
            _ => {}
        }
    }

    fn handle_ctrl_c(&mut self) {
        if self.screen_mode == ScreenMode::Intro && !self.intro_input.is_empty() {
            self.intro_input.clear();
            return;
        }

        if !self.input.is_empty() {
            self.input.clear();
            self.push_system("input cleared".to_string());
            self.history_cursor = None;
            return;
        }

        let now = Instant::now();
        if let Some(last) = self.ctrl_c_last {
            if now.duration_since(last) <= Duration::from_secs(2) {
                self.should_quit = true;
                return;
            }
        }
        self.ctrl_c_last = Some(now);
        self.push_system("Press Ctrl+C again to exit".to_string());
    }

    async fn handle_overlay_key(&mut self, key: KeyEvent) {
        let count = self.overlay_items_filtered().len();

        match key.code {
            KeyCode::Esc => {
                // Preserve the typed token based on what triggered the overlay
                match self.overlay_trigger {
                    OverlayTrigger::SlashCommand => {
                        self.input.set_text("/");
                    }
                    OverlayTrigger::FileMention => {
                        // Restore the @ mention prefix with the filter content
                        if self.overlay_filter.is_empty() {
                            self.input.set_text("@");
                        } else {
                            self.input.set_text(format!("@{}", self.overlay_filter));
                        }
                    }
                    _ => {
                        // For other overlays, preserve original input
                    }
                }
                self.overlay = Overlay::None;
                self.overlay_filter.clear();
                self.overlay_trigger = OverlayTrigger::None;
            }
            KeyCode::Up => {
                if self.overlay_cursor > 0 {
                    self.overlay_cursor -= 1;
                }
            }
            KeyCode::BackTab => {
                if self.overlay_cursor > 0 {
                    self.overlay_cursor -= 1;
                }
            }
            KeyCode::Down => {
                if self.overlay_cursor + 1 < count {
                    self.overlay_cursor += 1;
                }
            }
            KeyCode::Tab => {
                if self.overlay_cursor + 1 < count {
                    self.overlay_cursor += 1;
                } else {
                    self.overlay_cursor = 0;
                }
            }
            KeyCode::PageUp => {
                self.overlay_cursor = self.overlay_cursor.saturating_sub(6);
            }
            KeyCode::PageDown => {
                if count > 0 {
                    self.overlay_cursor = (self.overlay_cursor + 6).min(count - 1);
                }
            }
            KeyCode::Backspace => {
                if self.overlay != Overlay::Help {
                    self.overlay_filter.pop();
                    self.overlay_cursor = 0;
                    self.clamp_overlay_cursor();
                }
            }
            KeyCode::Char(ch)
                if self.overlay != Overlay::Help
                    && (key.modifiers.is_empty() || key.modifiers == KeyModifiers::SHIFT) =>
            {
                self.overlay_filter.push(ch);
                self.overlay_cursor = 0;
                self.clamp_overlay_cursor();
            }
            KeyCode::Enter => {
                self.commit_overlay_selection().await;
                self.overlay = Overlay::None;
                self.overlay_filter.clear();
                self.overlay_trigger = OverlayTrigger::None;
            }
            _ => {}
        }
    }

    async fn commit_overlay_selection(&mut self) {
        let items = self.overlay_items_filtered();
        let selected = items.get(self.overlay_cursor).cloned();

        match self.overlay {
            Overlay::Agents => {
                if let Some(agent) = selected {
                    self.current_agent = agent;
                    self.push_system(format!("active agent: {}", self.current_agent));
                }
            }
            Overlay::Sessions => {
                if let Some(session) = selected {
                    self.current_session = session;
                    self.push_system(format!("active session: {}", self.current_session));
                    self.attach_stream_for_current_session().await;
                }
            }
            Overlay::Models => {
                if let Some(model) = selected {
                    self.current_model = model;
                    let (provider, model_id) = split_provider_model(&self.current_model);
                    let req = json!({ "provider": provider, "model": model_id });
                    match self.client.post::<_, Value>("/v1/config/model", &req).await {
                        Ok(_) => self.push_system(format!("model set: {}", self.current_model)),
                        Err(err) => self.push_error(format!("failed to set model: {err}")),
                    }
                }
            }
            Overlay::Commands => {
                // Get selected command from categorized list
                if let Some(command) = self.get_selected_command_at_cursor() {
                    self.input.set_text(command);
                    if !self.input.ends_with(" ") {
                        self.input.push(' ');
                    }
                    self.history_cursor = None;
                }
            }
            Overlay::Paths => {
                let filtered = self.path_filtered_indices();
                if let Some(entry_index) = filtered.get(self.overlay_cursor) {
                    let selected_path = self
                        .path_entries
                        .get(*entry_index)
                        .map(|entry| entry.path.clone());
                    if let Some(path) = selected_path {
                        match self.path_overlay_mode {
                            PathOverlayMode::WorkspacePicker => {
                                self.set_current_path(path);
                                self.push_system(format!(
                                    "workspace path: {}",
                                    self.current_path.display()
                                ));
                            }
                            PathOverlayMode::MentionReference => {
                                if path.is_file() {
                                    let reference = path
                                        .strip_prefix(&self.current_path)
                                        .map(|value| value.display().to_string())
                                        .unwrap_or_else(|_| path.display().to_string());
                                    self.insert_mention_reference(&reference);
                                }
                            }
                        }
                    }
                }
            }
            Overlay::History => {
                if let Some(command) = selected {
                    self.input.set_text(command);
                    self.history_cursor = None;
                }
            }
            Overlay::Help | Overlay::None => {}
        }
    }

    async fn submit_input(&mut self) {
        let raw = self.input.take_text();
        let text = raw.trim().to_string();
        if text.is_empty() {
            return;
        }

        // Execute pre-command hooks for non-slash commands
        if !text.starts_with('/') && !text.starts_with('!') {
            let hook_results = self.execute_pre_command_hooks(&text).await;
            for (cmd, result) in hook_results {
                if !result.stdout.is_empty() {
                    self.push_system(format!("[pre-hook] {}", result.stdout.trim()));
                }
                if !result.success {
                    self.push_error(format!("Pre-command hook failed: {}", result.stderr));
                    // Continue anyway, just log the error
                }
            }
        }

        self.add_input_history(&raw);

        if raw.starts_with('!') && raw != "!" {
            self.run_local_shell(raw).await;
            return;
        }

        if text == "/" {
            self.open_commands_overlay();
            return;
        }

        if text.starts_with('/') {
            self.handle_slash_command(text).await;
            return;
        }

        let busy = self.activity_status != "idle" || self.stream_rx.is_some();
        if busy || !self.prompt_queue.is_empty() {
            self.prompt_queue.push_back(text.clone());
            self.push_system(format!(
                "queued prompt #{} (use /queue run to force, /queue list to inspect)",
                self.prompt_queue.len()
            ));
            return;
        }

        self.dispatch_message(text.clone()).await;
        
        // Execute post-command hooks (fire and forget)
        let _ = self.execute_post_command_hooks(&text).await;
    }

    async fn run_local_shell(&mut self, line: String) {
        let command = line.trim_start_matches('!').trim().to_string();
        if command.is_empty() {
            self.push_user("!".to_string());
            self.dispatch_message("!".to_string()).await;
            return;
        }

        if self.allow_local_shell.is_none() {
            self.allow_local_shell = Some(false);
            self.push_system(
                "Local shell execution is disabled by default. Run '/shell on' to enable for this session."
                    .to_string(),
            );
            return;
        }

        if !self.allow_local_shell.unwrap_or(false) {
            self.push_error("Local shell execution is disabled for this session.".to_string());
            return;
        }

        self.push_user(format!("!{}", command));
        match Command::new("sh")
            .arg("-lc")
            .arg(&command)
            .current_dir(&self.current_path)
            .output()
            .await
        {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                let stdout_empty = stdout.is_empty();
                let stderr_empty = stderr.is_empty();
                if !stdout.is_empty() {
                    self.push_assistant(stdout);
                }
                if !stderr.is_empty() {
                    self.push_error(stderr);
                }
                if output.status.success() && stdout_empty && stderr_empty {
                    self.push_system("command completed".to_string());
                }
            }
            Err(err) => self.push_error(format!("shell command failed: {err}")),
        }
    }

    async fn handle_slash_command(&mut self, command: String) {
        let mut parts = command.split_whitespace();
        let verb = parts.next().unwrap_or_default();
        let rest = command
            .strip_prefix(verb)
            .map(str::trim)
            .unwrap_or_default()
            .to_string();

        match verb {
            "/help" | "/?" => {
                self.overlay = Overlay::Help;
                self.overlay_filter.clear();
                self.overlay_cursor = 0;
            }
            "/status" => {
                self.refresh_state().await;
                self.refresh_models().await;
                self.push_system(format!(
                    "status {} | health {} | mcp {} | sessions {} | queue {} | path {}",
                    self.connection_status,
                    self.health_status,
                    self.mcp_status,
                    self.sessions.len(),
                    self.prompt_queue.len(),
                    self.current_path.display()
                ));
            }
            "/commands" | "/slash" => {
                self.open_commands_overlay();
            }
            "/agent" => {
                if let Some(agent) = parts.next() {
                    self.current_agent = agent.to_string();
                    self.push_system(format!("active agent: {}", self.current_agent));
                } else {
                    self.overlay = Overlay::Agents;
                    self.overlay_filter.clear();
                    self.overlay_cursor = 0;
                    self.overlay_trigger = OverlayTrigger::Other;
                }
            }
            "/agents" => {
                self.overlay = Overlay::Agents;
                self.overlay_filter.clear();
                self.overlay_cursor = 0;
                self.overlay_trigger = OverlayTrigger::Other;
            }
            "/session" => {
                if let Some(session) = parts.next() {
                    self.current_session = session.to_string();
                    self.push_system(format!("active session: {}", self.current_session));
                    self.attach_stream_for_current_session().await;
                } else {
                    self.overlay = Overlay::Sessions;
                    self.overlay_filter.clear();
                    self.overlay_cursor = 0;
                    self.overlay_trigger = OverlayTrigger::Other;
                }
            }
            "/sessions" => {
                self.overlay = Overlay::Sessions;
                self.overlay_filter.clear();
                self.overlay_cursor = 0;
                self.overlay_trigger = OverlayTrigger::Other;
            }
            "/model" => {
                let model_arg = parts.next();
                if model_arg.is_none() || model_arg == Some("list") {
                    self.refresh_models().await;
                    self.overlay = Overlay::Models;
                    self.overlay_filter.clear();
                    self.overlay_cursor = 0;
                    self.overlay_trigger = OverlayTrigger::Other;
                } else if let Some(model) = model_arg {
                    self.current_model = model.to_string();
                    let (provider, model_id) = split_provider_model(&self.current_model);
                    let req = json!({ "provider": provider, "model": model_id });
                    match self.client.post::<_, Value>("/v1/config/model", &req).await {
                        Ok(_) => self.push_system(format!("model set: {}", self.current_model)),
                        Err(err) => self.push_error(format!("model set failed: {err}")),
                    }
                }
            }
            "/models" => {
                self.refresh_models().await;
                self.overlay = Overlay::Models;
                self.overlay_filter.clear();
                self.overlay_cursor = 0;
                self.overlay_trigger = OverlayTrigger::Other;
            }
            "/skills" => {
                let query = rest.trim();
                match self.client.list_marketplace_skills().await {
                    Ok(skills) => {
                        let mut names = skills
                            .into_iter()
                            .filter_map(|skill| {
                                skill
                                    .get("name")
                                    .and_then(|value| value.as_str())
                                    .or_else(|| skill.get("id").and_then(|value| value.as_str()))
                                    .map(str::to_owned)
                            })
                            .collect::<Vec<_>>();
                        names.sort();
                        names.dedup();
                        if !query.is_empty() {
                            names.retain(|name| {
                                name.to_ascii_lowercase()
                                    .contains(&query.to_ascii_lowercase())
                            });
                        }
                        if names.is_empty() {
                            self.push_system("no skills matched query".to_string());
                        } else {
                            self.push_system(format!(
                                "skills ({}): {}",
                                names.len(),
                                names.join(", ")
                            ));
                        }
                    }
                    Err(err) => self.push_error(format!("skills lookup failed: {err}")),
                }
            }
            "/think" => {
                if let Some(level) = parts.next() {
                    self.args.thinking = Some(level.to_string());
                    self.push_system(format!("thinking: {}", level));
                }
            }
            "/deliver" => {
                if let Some(mode) = parts.next() {
                    let on = matches!(mode, "on" | "true" | "1");
                    self.args.deliver = on;
                    self.push_system(format!("deliver: {}", if on { "on" } else { "off" }));
                }
            }
            "/verbose" => {
                let value = parts.next().unwrap_or("off");
                self.push_system(format!("verbose: {value}"));
            }
            "/reasoning" => {
                let value = parts.next().unwrap_or("off");
                self.push_system(format!("reasoning: {value}"));
            }
            "/usage" => {
                let value = parts.next().unwrap_or("tokens");
                self.push_system(format!("usage: {value}"));
            }
            "/elevated" | "/elev" => {
                let value = parts.next().unwrap_or("ask");
                self.push_system(format!("elevated: {value}"));
            }
            "/activation" => {
                let value = parts.next().unwrap_or("mention");
                self.push_system(format!("activation: {value}"));
            }
            "/queue" => {
                let action = parts.next().unwrap_or("list");
                match action {
                    "add" => {
                        let queued = rest
                            .strip_prefix("add")
                            .map(str::trim)
                            .unwrap_or_default()
                            .to_string();
                        if queued.is_empty() {
                            self.push_error("usage: /queue add <prompt>".to_string());
                        } else {
                            self.prompt_queue.push_back(queued);
                            self.push_system(format!("queued prompt #{}", self.prompt_queue.len()));
                        }
                    }
                    "clear" => {
                        self.prompt_queue.clear();
                        self.push_system("queue cleared".to_string());
                    }
                    "pause" => {
                        self.queue_paused = true;
                        self.push_system("queue paused".to_string());
                    }
                    "resume" => {
                        self.queue_paused = false;
                        self.push_system("queue resumed".to_string());
                    }
                    "run" => {
                        self.queue_paused = false;
                        if self.activity_status == "idle" && self.stream_rx.is_none() {
                            if let Some(next_prompt) = self.prompt_queue.pop_front() {
                                self.dispatch_message(next_prompt).await;
                            } else {
                                self.push_system("queue is empty".to_string());
                            }
                        } else {
                            self.push_system("run queued; active run in progress".to_string());
                        }
                    }
                    "list" => {
                        if self.prompt_queue.is_empty() {
                            self.push_system("queue is empty".to_string());
                        } else {
                            let preview = self
                                .prompt_queue
                                .iter()
                                .take(6)
                                .enumerate()
                                .map(|(idx, value)| {
                                    format!("{}: {}", idx + 1, truncate_for_ui(value, 80))
                                })
                                .collect::<Vec<_>>()
                                .join(" | ");
                            self.push_system(format!(
                                "queue ({}{}) {}",
                                self.prompt_queue.len(),
                                if self.queue_paused { ", paused" } else { "" },
                                preview
                            ));
                        }
                    }
                    _ => self
                        .push_error("usage: /queue [add|list|clear|pause|resume|run]".to_string()),
                }
            }
            "/stop" | "/abort" => self.abort_active_run().await,
            "/resume" => {
                self.queue_paused = false;
                if self.attached_session.is_none() {
                    self.attach_stream_for_current_session().await;
                }
                self.push_system("resumed queue/stream".to_string());
            }
            "/path" => {
                let action = parts.next().unwrap_or("show");
                match action {
                    "show" => {
                        self.push_system(format!("workspace path: {}", self.current_path.display()))
                    }
                    "picker" => {
                        self.open_workspace_path_overlay();
                    }
                    "set" => {
                        let path_arg = rest
                            .strip_prefix("set")
                            .map(str::trim)
                            .unwrap_or_default()
                            .to_string();
                        if path_arg.is_empty() {
                            self.push_error("usage: /path set <path>".to_string());
                        } else {
                            self.set_current_path(path_arg);
                            if let Some(err) = &self.path_error {
                                self.push_error(err.clone());
                            } else {
                                self.push_system(format!(
                                    "workspace path: {}",
                                    self.current_path.display()
                                ));
                            }
                        }
                    }
                    _ => self.push_error("usage: /path [show|set <path>|picker]".to_string()),
                }
            }
            "/cd" => {
                let path_arg = rest.trim();
                if path_arg.is_empty() {
                    self.push_error("usage: /cd <path>".to_string());
                } else {
                    self.set_current_path(path_arg);
                    if let Some(err) = &self.path_error {
                        self.push_error(err.clone());
                    } else {
                        self.push_system(format!(
                            "workspace path: {}",
                            self.current_path.display()
                        ));
                    }
                }
            }
            "/shell" => {
                let action = parts.next().unwrap_or("status");
                match action {
                    "on" => {
                        self.allow_local_shell = Some(true);
                        self.push_system("local shell enabled for this session".to_string());
                    }
                    "off" => {
                        self.allow_local_shell = Some(false);
                        self.push_system("local shell disabled for this session".to_string());
                    }
                    _ => {
                        let status = match self.allow_local_shell {
                            Some(true) => "enabled",
                            Some(false) => "disabled",
                            None => "not configured",
                        };
                        self.push_system(format!("local shell: {status}"));
                    }
                }
            }
            "/telemetry" => {
                let action = parts.next().unwrap_or("show");
                match action {
                    "show" => {
                        self.push_system(format!(
                            "telemetry fields: {}",
                            self.telemetry_fields.join(", ")
                        ));
                    }
                    "fields" => {
                        self.push_system(
                            "available fields: conn, activity, health, mcp, agent, session, model, queue, path"
                                .to_string(),
                        );
                    }
                    "toggle" => {
                        if let Some(field) = parts.next() {
                            if let Some(position) = self
                                .telemetry_fields
                                .iter()
                                .position(|value| value.eq_ignore_ascii_case(field))
                            {
                                self.telemetry_fields.remove(position);
                            } else {
                                self.telemetry_fields.push(field.to_string());
                            }
                            self.push_system(format!(
                                "telemetry fields: {}",
                                self.telemetry_fields.join(", ")
                            ));
                        } else {
                            self.push_error("usage: /telemetry toggle <field>".to_string());
                        }
                    }
                    "preset" => {
                        let preset = parts.next().unwrap_or("default");
                        self.telemetry_fields = match preset {
                            "minimal" => vec![
                                "conn".to_string(),
                                "activity".to_string(),
                                "queue".to_string(),
                            ],
                            "full" => vec![
                                "conn".to_string(),
                                "activity".to_string(),
                                "health".to_string(),
                                "mcp".to_string(),
                                "agent".to_string(),
                                "session".to_string(),
                                "model".to_string(),
                                "queue".to_string(),
                                "path".to_string(),
                            ],
                            _ => vec![
                                "conn".to_string(),
                                "activity".to_string(),
                                "health".to_string(),
                                "mcp".to_string(),
                                "agent".to_string(),
                                "session".to_string(),
                                "model".to_string(),
                                "queue".to_string(),
                                "path".to_string(),
                            ],
                        };
                        self.push_system(format!("telemetry preset '{}' applied", preset));
                    }
                    _ => self.push_error(
                        "usage: /telemetry [show|fields|toggle <field>|preset <name>]".to_string(),
                    ),
                }
            }
            "/clear" => {
                self.entries.clear();
                self.push_system("conversation cleared".to_string());
            }
            "/new" | "/reset" => self.create_new_session().await,
            "/settings" => {
                self.push_system(format!(
                    "settings | deliver={} thinking={} model={} tools={} queue={} path={}",
                    if self.args.deliver { "on" } else { "off" },
                    self.args
                        .thinking
                        .as_deref()
                        .filter(|value| !value.is_empty())
                        .unwrap_or("default"),
                    self.current_model,
                    if self.tools_expanded {
                        "expanded"
                    } else {
                        "collapsed"
                    },
                    self.prompt_queue.len(),
                    self.current_path.display()
                ));
            }
            "/exit" => self.should_quit = true,
            "/compact" => {
                // Compact conversation by summarizing entries
                if self.entries.len() > 10 {
                    let summary = self.summarize_conversation(&rest);
                    self.entries.clear();
                    self.push_system(format!("conversation compacted | summary: {}", summary));
                } else {
                    self.push_system("conversation too short to compact".to_string());
                }
            }
            "/cost" => {
                // Show session cost and usage statistics
                let stats = self.calculate_usage_stats();
                self.push_system(format!(
                    "session stats | entries: {} | queued: {} | path: {} | elapsed: {} | {}",
                    stats.entries_count,
                    stats.queue_count,
                    stats.path_entries,
                    stats.elapsed_formatted,
                    stats.estimated_tokens
                ));
            }
            "/output-style" | "/style" => {
                let style = parts.next().unwrap_or("menu");
                match style {
                    "menu" => {
                        self.push_system("output styles: default | compact | explanatory | learning".to_string());
                    }
                    "default" | "compact" | "explanatory" | "learning" => {
                        self.output_style = style.to_string();
                        self.push_system(format!("output style set to: {}", style));
                    }
                    _ => {
                        self.push_error("usage: /output-style [default|compact|explanatory|learning]".to_string());
                    }
                }
            }
            "/memory" => {
                let action = parts.next().unwrap_or("show");
                match action {
                    "show" => {
                        if let Some(memory) = self.load_memory() {
                            self.push_system(format!("memory loaded | {} chars", memory.len()));
                        } else {
                            self.push_system("no memory file found".to_string());
                        }
                    }
                    "edit" => {
                        self.edit_memory_file().await;
                    }
                    "reload" => {
                        self.reload_memory();
                        self.push_system("memory reloaded".to_string());
                    }
                    _ => self.push_error("usage: /memory [show|edit|reload]".to_string()),
                }
            }
            "/plan" => {
                // Enter plan mode - create a structured plan before execution
                if rest.trim().is_empty() {
                    self.push_system("plan mode: describe your goal and I'll create a structured plan".to_string());
                    self.plan_mode = true;
                } else {
                    self.create_plan(rest.trim()).await;
                }
            }
            "/ultrathink" | "/ultra" => {
                // Deep thinking mode - more thorough reasoning
                self.ultrathink_mode = !self.ultrathink_mode;
                self.push_system(format!(
                    "ultrathink mode: {}",
                    if self.ultrathink_mode { "on" } else { "off" }
                ));
            }
            "/subagent" => {
                // Spawn a subagent for specific tasks
                if let Some(agent_type) = parts.next() {
                    self.spawn_subagent(agent_type, &rest).await;
                } else {
                    self.push_system("available subagents: explore | plan | general | code-review".to_string());
                }
            }
            "/mcp" => {
                let action = parts.next().unwrap_or("status");
                match action {
                    "status" => {
                        self.push_system(format!("mcp status: {} ({} connected / {} total)",
                            self.mcp_status, self.mcp_connected, self.mcp_total));
                    }
                    "list" => {
                        self.push_system("mcp servers: fetch from kernel/api".to_string());
                    }
                    _ => self.push_error("usage: /mcp [status|list]".to_string()),
                }
            }
            "/todo" => {
                let action = parts.next().unwrap_or("list");
                match action {
                    "list" => self.list_todos(),
                    "add" => {
                        let task = rest.strip_prefix("add").map(str::trim).unwrap_or_default();
                        if task.is_empty() {
                            self.push_error("usage: /todo add <task>".to_string());
                        } else {
                            self.add_todo(task);
                        }
                    }
                    "done" => {
                        if let Some(idx) = parts.next().and_then(|s| s.parse::<usize>().ok()) {
                            self.complete_todo(idx);
                        } else {
                            self.push_error("usage: /todo done <index>".to_string());
                        }
                    }
                    "clear" => {
                        self.todos.clear();
                        self.push_system("todo list cleared".to_string());
                    }
                    _ => self.push_error("usage: /todo [list|add <task>|done <index>|clear]".to_string()),
                }
            }
            "/hooks" => {
                let action = parts.next().unwrap_or("status");
                match action {
                    "status" => {
                        let enabled = self.hook_manager.is_enabled();
                        let pre_count = self.hook_manager.get_hooks(HookType::PreCommand).len();
                        let post_count = self.hook_manager.get_hooks(HookType::PostCommand).len();
                        self.push_system(format!(
                            "hooks: {} | pre: {} | post: {}",
                            if enabled { "enabled" } else { "disabled" },
                            pre_count,
                            post_count
                        ));
                    }
                    "reload" => {
                        self.hook_manager.reload();
                        self.push_system("hooks configuration reloaded".to_string());
                    }
                    "run" => {
                        if let Some(hook_type_str) = parts.next() {
                            if let Some(hook_type) = HookType::from_str(hook_type_str) {
                                let context = HookContext::for_command("manual test");
                                let results = self.hook_manager.execute_hooks(hook_type, &context).await;
                                for (cmd, result) in results {
                                    if result.success {
                                        self.push_system(format!("✓ {}: {}", cmd, result.stdout.trim()));
                                    } else {
                                        self.push_error(format!("✗ {}: {}", cmd, result.stderr));
                                    }
                                }
                            } else {
                                self.push_error(format!("unknown hook type: {}", hook_type_str));
                            }
                        } else {
                            self.push_error("usage: /hooks run <hook_type>".to_string());
                        }
                    }
                    _ => self.push_error("usage: /hooks [status|reload|run <type>]".to_string()),
                }
            }
            "/git" => {
                let action = parts.next().unwrap_or("status");
                match action {
                    "status" => {
                        if let Some(status) = self.git_manager.get_status().await {
                            if status.is_repo {
                                self.push_system(format!(
                                    "git: {} | staged: {} | unstaged: {} | untracked: {}",
                                    status.branch, status.staged_count, status.unstaged_count, status.untracked_count
                                ));
                            } else {
                                self.push_system("not a git repository".to_string());
                            }
                        }
                    }
                    "commit" => {
                        let msg = if rest.len() > 7 { &rest[7..] } else { "" };
                        let msg = if msg.is_empty() { None } else { Some(msg) };
                        match self.git_manager.auto_commit(msg).await {
                            Ok(output) => self.push_system(format!("committed: {}", output)),
                            Err(e) => self.push_error(format!("commit failed: {}", e)),
                        }
                    }
                    "log" => {
                        let count = parts.next().and_then(|s| s.parse().ok()).unwrap_or(5);
                        let commits = self.git_manager.get_recent_commits(count).await;
                        for commit in commits {
                            self.push_system(commit);
                        }
                    }
                    "auto" => {
                        let mode = parts.next().unwrap_or("ask");
                        if let Some(m) = crate::tui_components::git::AutoCommitMode::from_str(mode) {
                            let mut config = self.git_manager.config().clone();
                            config.mode = m;
                            config.enabled = m != crate::tui_components::git::AutoCommitMode::Off;
                            self.git_manager.set_config(config);
                            self.push_system(format!("git auto-commit: {} (enabled: {})", mode, self.git_manager.config().enabled));
                        } else {
                            self.push_error("usage: /git auto [auto|ask|off]".to_string());
                        }
                    }
                    _ => self.push_error("usage: /git [status|commit|log|auto]".to_string()),
                }
            }
            _ => {
                self.push_system(format!("forwarding slash command: {command}"));
                self.dispatch_message(command).await;
            }
        }
    }

    async fn create_new_session(&mut self) {
        self.set_activity_status("running");
        let workspace = Some(self.current_path.display().to_string());
        match self
            .client
            .create_brain_session(Some(self.current_agent.clone()), workspace)
            .await
        {
            Ok(session) => {
                self.current_session = session.id.clone();
                self.push_system(format!("new session: {}", self.current_session));
                self.refresh_sessions().await;
                self.attach_stream_for_current_session().await;
            }
            Err(err) => self.push_error(format!("failed to create session: {err}")),
        }
        self.set_activity_status("idle");
    }

    async fn abort_active_run(&mut self) {
        if let Some(session_id) = self.attached_session.clone() {
            match self.client.terminate_brain_session(&session_id).await {
                Ok(_) => self.push_system(format!("aborted session {}", session_id)),
                Err(err) => self.push_error(format!("abort failed: {err}")),
            }
        } else {
            self.push_system("no active attached session".to_string());
        }
    }

    async fn attach_stream_for_current_session(&mut self) {
        match self.client.stream_brain_events(&self.current_session).await {
            Ok(receiver) => {
                self.stream_rx = Some(receiver);
                self.attached_session = Some(self.current_session.clone());
                self.push_system(format!("attached stream: {}", self.current_session));
                self.set_activity_status("streaming");
                self.last_stream_event = Some(Instant::now());
            }
            Err(err) => {
                self.push_error(format!(
                    "stream unavailable for {}: {}",
                    self.current_session, err
                ));
                self.stream_rx = None;
                self.attached_session = None;
                self.set_activity_status("idle");
            }
        }
    }

    fn drain_stream(&mut self) {
        let mut drained = Vec::new();
        let mut disconnected = false;

        if let Some(receiver) = self.stream_rx.as_mut() {
            loop {
                match receiver.try_recv() {
                    Ok(event) => drained.push(format_stream_event(&event)),
                    Err(TryRecvError::Empty) => break,
                    Err(TryRecvError::Disconnected) => {
                        disconnected = true;
                        break;
                    }
                }
            }
        }

        for line in drained {
            if !self.show_thinking && line.to_ascii_lowercase().contains("thinking") {
                continue;
            }
            self.last_stream_event = Some(Instant::now());
            self.set_activity_status("streaming");
            self.push_assistant(line);
        }

        if disconnected {
            self.stream_rx = None;
            self.attached_session = None;
            self.push_system("stream disconnected".to_string());
            self.set_activity_status("idle");
        }
    }

    async fn dispatch_message(&mut self, text: String) {
        self.set_activity_status("sending");
        self.push_user(text.clone());

        let mut request = json!({
            "intent_text": text,
            "agent_id": self.current_agent,
            "session_id": self.current_session,
            "deliver": self.args.deliver,
            "model": self.current_model,
            "workspace_dir": self.current_path.display().to_string(),
        });
        if let Some(thinking) = self
            .args
            .thinking
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            request["thinking"] = Value::String(thinking.to_string());
        }

        match self
            .client
            .post::<_, Value>("/v1/intent/dispatch", &request)
            .await
        {
            Ok(payload) => {
                if let Some(text) = extract_assistant_text(&payload) {
                    self.push_assistant(text);
                } else if let Some(capsule) = payload.get("capsule") {
                    self.push_assistant(format!("capsule: {}", capsule));
                } else {
                    self.push_assistant("request accepted".to_string());
                }

                if self.tools_expanded {
                    if let Some(events) = payload.get("events").and_then(|value| value.as_array()) {
                        for event in events {
                            self.push_system(format!("event: {}", event));
                        }
                    }
                }

                if self.attached_session.is_none() {
                    self.attach_stream_for_current_session().await;
                } else {
                    self.set_activity_status("streaming");
                    self.last_stream_event = Some(Instant::now());
                }
            }
            Err(err) => {
                self.push_error(format!("dispatch failed: {err}"));
                self.set_activity_status("idle");
            }
        }
    }

    fn current_spinner(&self) -> &'static str {
        SPINNER_FRAMES[self.spinner_index % SPINNER_FRAMES.len()]
    }

    fn current_elapsed_label(&self) -> String {
        if let Some(started) = self.activity_started_at {
            let elapsed = started.elapsed();
            let total_seconds = elapsed.as_secs();
            if total_seconds < 60 {
                format!("{}s", total_seconds)
            } else {
                let minutes = total_seconds / 60;
                let seconds = total_seconds % 60;
                format!("{}m {}s", minutes, seconds)
            }
        } else {
            "0s".to_string()
        }
    }

    // Claude Code parity: conversation compaction
    fn summarize_conversation(&self, _instructions: &str) -> String {
        let user_msgs = self.entries.iter().filter(|e| matches!(e.role, ChatRole::User)).count();
        let assistant_msgs = self.entries.iter().filter(|e| matches!(e.role, ChatRole::Assistant)).count();
        format!("{} user messages, {} assistant responses", user_msgs, assistant_msgs)
    }

    // Claude Code parity: usage statistics
    fn calculate_usage_stats(&self) -> UsageStats {
        let session_elapsed = self.session_started_at.elapsed();
        UsageStats {
            entries_count: self.entries.len(),
            queue_count: self.prompt_queue.len(),
            path_entries: self.path_entries.len(),
            elapsed_formatted: format_duration(session_elapsed),
            estimated_tokens: format!("~{} tokens", self.entries.len() * 500),
        }
    }

    // Claude Code parity: memory/CLAUDE.md
    fn load_memory(&self) -> Option<String> {
        let project_memory = self.current_path.join(".a2r").join("CLAUDE.md");
        
        // Try project memory first
        if let Ok(content) = fs::read_to_string(&project_memory) {
            return Some(content);
        }
        
        // Then try global memory
        if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
            let global_memory = PathBuf::from(home).join(".a2r").join("CLAUDE.md");
            if let Ok(content) = fs::read_to_string(&global_memory) {
                return Some(content);
            }
        }
        None
    }

    async fn edit_memory_file(&mut self) {
        let memory_path = self.current_path.join(".a2r").join("CLAUDE.md");
        if let Some(parent) = memory_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        
        // Open in default editor
        let editor = std::env::var("EDITOR").unwrap_or_else(|_| "vi".to_string());
        let _ = Command::new(&editor).arg(&memory_path).spawn();
        
        self.push_system(format!("opened memory file: {}", memory_path.display()));
    }

    fn reload_memory(&mut self) {
        // Memory is loaded on demand, this is a no-op but signals intent
        self.push_system("memory cache invalidated".to_string());
    }

    // Claude Code parity: plan mode
    async fn create_plan(&mut self, goal: &str) {
        self.push_system(format!("creating plan for: {}", goal));
        
        // Create a structured plan entry
        let plan = format!(
            "## Plan: {}\n\n1. Analyze requirements\n2. Research codebase\n3. Design solution\n4. Implement changes\n5. Verify and test\n\nUse /todo to track tasks.",
            goal
        );
        
        self.entries.push(ChatEntry {
            role: ChatRole::System,
            text: plan,
        });
        
        self.plan_mode = true;
        self.push_system("plan created. use /todo add <task> to track tasks".to_string());
    }

    // Claude Code parity: subagents
    async fn spawn_subagent(&mut self, agent_type: &str, task: &str) {
        let agent_desc = match agent_type {
            "explore" => "fast, read-only codebase exploration",
            "plan" => "research agent for planning",
            "general" => "general-purpose implementation agent",
            "code-review" => "code review and quality analysis",
            _ => "general-purpose agent",
        };
        
        self.push_system(format!(
            "spawning {} subagent ({}): {}",
            agent_type, agent_desc, task
        ));
        
        // In a full implementation, this would actually spawn a separate context/agent
        // For now, we delegate to the main agent with context
        let prompt = format!("[{} agent task]: {}", agent_type, task);
        self.dispatch_message(prompt).await;
    }

    // Claude Code parity: todo system
    fn list_todos(&mut self) {
        if self.todos.is_empty() {
            self.push_system("no todos. use /todo add <task>".to_string());
            return;
        }
        
        let mut lines = vec![format!("todos ({} total):", self.todos.len())];
        for (idx, todo) in self.todos.iter().enumerate() {
            let status = if todo.completed { "[x]" } else { "[ ]" };
            lines.push(format!("{} {} {}", idx + 1, status, todo.task));
        }
        
        for line in lines {
            self.push_system(line);
        }
    }

    fn add_todo(&mut self, task: &str) {
        self.todos.push(TodoItem {
            task: task.to_string(),
            completed: false,
            created_at: Instant::now(),
        });
        self.push_system(format!("added todo #{}: {}", self.todos.len(), task));
    }

    fn complete_todo(&mut self, idx: usize) {
        if idx == 0 || idx > self.todos.len() {
            self.push_error(format!("invalid todo index: {}", idx));
            return;
        }
        
        let task = self.todos.get(idx - 1).map(|t| t.task.clone());
        if let Some(todo) = self.todos.get_mut(idx - 1) {
            todo.completed = true;
        }
        if let Some(task_name) = task {
            self.push_system(format!("completed todo #{}: {}", idx, task_name));
        }
    }
}

struct UsageStats {
    entries_count: usize,
    queue_count: usize,
    path_entries: usize,
    elapsed_formatted: String,
    estimated_tokens: String,
}

fn format_duration(duration: Duration) -> String {
    let total_secs = duration.as_secs();
    if total_secs < 60 {
        format!("{}s", total_secs)
    } else if total_secs < 3600 {
        format!("{}m {}s", total_secs / 60, total_secs % 60)
    } else {
        let hours = total_secs / 3600;
        let mins = (total_secs % 3600) / 60;
        format!("{}h {}m", hours, mins)
    }
}

fn extract_assistant_text(payload: &Value) -> Option<String> {
    payload
        .get("response")
        .or_else(|| payload.get("message"))
        .or_else(|| payload.get("text"))
        .or_else(|| payload.get("result"))
        .and_then(|value| {
            value
                .as_str()
                .map(str::to_owned)
                .or_else(|| serde_json::to_string_pretty(value).ok())
        })
}

fn split_provider_model(model: &str) -> (String, String) {
    if let Some((provider, model_id)) = model.split_once('/') {
        (provider.to_string(), model_id.to_string())
    } else {
        ("openai".to_string(), model.to_string())
    }
}

fn extract_models_from_payload(payload: &Value) -> Vec<String> {
    let mut models = Vec::new();

    if let Some(providers) = payload.get("providers").and_then(|value| value.as_object()) {
        for (provider, models_value) in providers {
            if let Some(arr) = models_value.as_array() {
                for entry in arr {
                    if let Some(model) = entry.as_str() {
                        models.push(format!("{provider}/{model}"));
                    } else if let Some(obj) = entry.as_object() {
                        if let Some(model) = obj.get("id").and_then(|value| value.as_str()) {
                            models.push(format!("{provider}/{model}"));
                        } else if let Some(model) =
                            obj.get("model").and_then(|value| value.as_str())
                        {
                            models.push(format!("{provider}/{model}"));
                        }
                    }
                }
            }
        }
    }

    if let Some(arr) = payload.as_array() {
        for entry in arr {
            if let Some(model) = entry.as_str() {
                models.push(model.to_string());
            } else if let Some(obj) = entry.as_object() {
                let provider = obj
                    .get("provider")
                    .and_then(|value| value.as_str())
                    .unwrap_or("openai");
                let model = obj
                    .get("model")
                    .or_else(|| obj.get("id"))
                    .and_then(|value| value.as_str());
                if let Some(model) = model {
                    if model.contains('/') {
                        models.push(model.to_string());
                    } else {
                        models.push(format!("{provider}/{model}"));
                    }
                }
            }
        }
    }

    models.sort();
    models.dedup();
    models
}

/// Command category for grouped display
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum CommandCategory {
    General,
    Session,
    Model,
    Agent,
    Queue,
    Path,
    Config,
    Hooks,
    System,
    ClaudeCode, // New Claude Code parity commands
}

impl CommandCategory {
    fn name(&self) -> &'static str {
        match self {
            CommandCategory::General => "General",
            CommandCategory::Session => "Session",
            CommandCategory::Model => "Model",
            CommandCategory::Agent => "Agent",
            CommandCategory::Queue => "Queue",
            CommandCategory::Path => "Path",
            CommandCategory::Config => "Config",
            CommandCategory::Hooks => "Hooks",
            CommandCategory::System => "System",
            CommandCategory::ClaudeCode => "Claude Code",
        }
    }

    fn color(&self) -> Color {
        match self {
            CommandCategory::General => Color::Rgb(140, 200, 255),    // Blue
            CommandCategory::Session => Color::Rgb(125, 211, 165),    // Green
            CommandCategory::Model => Color::Rgb(246, 196, 83),       // Amber
            CommandCategory::Agent => Color::Rgb(198, 164, 255),      // Purple
            CommandCategory::Queue => Color::Rgb(248, 162, 141),      // Coral
            CommandCategory::Path => Color::Rgb(112, 214, 255),       // Cyan
            CommandCategory::Config => Color::Rgb(255, 174, 99),      // Orange
            CommandCategory::Hooks => Color::Rgb(198, 120, 221),      // Purple
            CommandCategory::System => Color::Rgb(144, 224, 190),     // Mint
            CommandCategory::ClaudeCode => Color::Rgb(232, 227, 213), // Cream
        }
    }
}

/// A slash command with its category and description
#[derive(Debug, Clone)]
struct SlashCommand {
    name: String,
    category: CommandCategory,
    description: String,
}

impl SlashCommand {
    fn new(name: impl Into<String>, category: CommandCategory, description: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            category,
            description: description.into(),
        }
    }
}

/// Get the full command catalog with categories
fn slash_command_catalog_full() -> Vec<SlashCommand> {
    vec![
        // General
        SlashCommand::new("/help", CommandCategory::General, "Show help information"),
        SlashCommand::new("/commands", CommandCategory::General, "Open command palette"),
        SlashCommand::new("/status", CommandCategory::General, "Show system status"),
        SlashCommand::new("/clear", CommandCategory::General, "Clear conversation"),
        SlashCommand::new("/settings", CommandCategory::General, "Show current settings"),
        SlashCommand::new("/exit", CommandCategory::General, "Exit the TUI"),
        
        // Session
        SlashCommand::new("/session", CommandCategory::Session, "Switch to session"),
        SlashCommand::new("/sessions", CommandCategory::Session, "List all sessions"),
        SlashCommand::new("/new", CommandCategory::Session, "Create new session"),
        SlashCommand::new("/reset", CommandCategory::Session, "Reset current session"),
        
        // Model
        SlashCommand::new("/model", CommandCategory::Model, "Set active model"),
        SlashCommand::new("/models", CommandCategory::Model, "List available models"),
        
        // Agent
        SlashCommand::new("/agent", CommandCategory::Agent, "Set active agent"),
        SlashCommand::new("/agents", CommandCategory::Agent, "List available agents"),
        SlashCommand::new("/skills", CommandCategory::Agent, "Search marketplace skills"),
        
        // Queue
        SlashCommand::new("/queue add", CommandCategory::Queue, "Add prompt to queue"),
        SlashCommand::new("/queue list", CommandCategory::Queue, "Show queue contents"),
        SlashCommand::new("/queue clear", CommandCategory::Queue, "Clear queue"),
        SlashCommand::new("/queue pause", CommandCategory::Queue, "Pause queue processing"),
        SlashCommand::new("/queue resume", CommandCategory::Queue, "Resume queue processing"),
        SlashCommand::new("/queue run", CommandCategory::Queue, "Run queue immediately"),
        SlashCommand::new("/stop", CommandCategory::Queue, "Stop current run"),
        SlashCommand::new("/resume", CommandCategory::Queue, "Resume stopped run"),
        
        // Path
        SlashCommand::new("/path show", CommandCategory::Path, "Show current path"),
        SlashCommand::new("/path set", CommandCategory::Path, "Set workspace path"),
        SlashCommand::new("/path picker", CommandCategory::Path, "Open path picker"),
        SlashCommand::new("/cd", CommandCategory::Path, "Change directory"),
        
        // Config
        SlashCommand::new("/shell", CommandCategory::Config, "Toggle local shell"),
        SlashCommand::new("/telemetry", CommandCategory::Config, "Manage telemetry fields"),
        SlashCommand::new("/think", CommandCategory::Config, "Set thinking level"),
        SlashCommand::new("/deliver", CommandCategory::Config, "Toggle delivery"),
        SlashCommand::new("/verbose", CommandCategory::Config, "Toggle verbose mode"),
        SlashCommand::new("/reasoning", CommandCategory::Config, "Set reasoning mode"),
        SlashCommand::new("/usage", CommandCategory::Config, "Set usage display"),
        
        // System
        SlashCommand::new("/abort", CommandCategory::System, "Abort active run"),
        SlashCommand::new("/elevated", CommandCategory::System, "Set elevated mode"),
        SlashCommand::new("/activation", CommandCategory::System, "Set activation mode"),
        
        // Claude Code parity commands
        SlashCommand::new("/compact", CommandCategory::ClaudeCode, "Summarize conversation"),
        SlashCommand::new("/cost", CommandCategory::ClaudeCode, "Show session cost/stats"),
        SlashCommand::new("/output-style", CommandCategory::ClaudeCode, "Set output style"),
        SlashCommand::new("/memory", CommandCategory::ClaudeCode, "Manage CLAUDE.md memory"),
        SlashCommand::new("/plan", CommandCategory::ClaudeCode, "Create execution plan"),
        SlashCommand::new("/ultrathink", CommandCategory::ClaudeCode, "Toggle deep thinking"),
        SlashCommand::new("/subagent", CommandCategory::ClaudeCode, "Spawn subagent"),
        SlashCommand::new("/mcp", CommandCategory::ClaudeCode, "MCP server management"),
        SlashCommand::new("/todo", CommandCategory::ClaudeCode, "Task tracking"),
        
        // Hooks
        SlashCommand::new("/hooks", CommandCategory::Hooks, "Manage hooks [status|reload|run]"),
        
        // Git
        SlashCommand::new("/git", CommandCategory::Hooks, "Git operations [status|commit|log|auto]"),
    ]
}

/// Get flat list for backward compatibility
fn slash_command_catalog() -> Vec<String> {
    slash_command_catalog_full()
        .into_iter()
        .map(|cmd| cmd.name)
        .collect()
}

/// Get categorized commands for grouped display
fn slash_command_catalog_by_category() -> Vec<(CommandCategory, Vec<SlashCommand>)> {
    let mut grouped: std::collections::HashMap<CommandCategory, Vec<SlashCommand>> = 
        std::collections::HashMap::new();
    
    for cmd in slash_command_catalog_full() {
        grouped.entry(cmd.category).or_default().push(cmd);
    }
    
    // Sort by category order
    let order = [
        CommandCategory::General,
        CommandCategory::Session,
        CommandCategory::Model,
        CommandCategory::Agent,
        CommandCategory::Queue,
        CommandCategory::Path,
        CommandCategory::Config,
        CommandCategory::ClaudeCode,
        CommandCategory::System,
    ];
    
    order
        .into_iter()
        .filter_map(|cat| {
            grouped.remove(&cat).map(|cmds| (cat, cmds))
        })
        .collect()
}

fn count_connected_flags(value: &Value) -> (usize, usize) {
    let mut connected = 0usize;
    let mut total = 0usize;
    count_connected_flags_inner(value, &mut connected, &mut total);
    (connected, total)
}

fn count_connected_flags_inner(value: &Value, connected: &mut usize, total: &mut usize) {
    match value {
        Value::Object(map) => {
            if let Some(is_connected) = map.get("connected").and_then(|value| value.as_bool()) {
                *total += 1;
                if is_connected {
                    *connected += 1;
                }
            }
            for child in map.values() {
                count_connected_flags_inner(child, connected, total);
            }
        }
        Value::Array(arr) => {
            for child in arr {
                count_connected_flags_inner(child, connected, total);
            }
        }
        _ => {}
    }
}

fn format_stream_event(event: &Value) -> String {
    let event_type = event
        .get("type")
        .and_then(|value| value.as_str())
        .unwrap_or("event");
    match event_type {
        "stream.open" => "stream opened".to_string(),
        "stream.error" => event
            .get("error")
            .and_then(|value| value.as_str())
            .unwrap_or("stream error")
            .to_string(),
        "stream.event" => event
            .get("event")
            .map(stringify_value)
            .unwrap_or_else(|| stringify_value(event)),
        _ => stringify_value(event),
    }
}

fn stringify_value(value: &Value) -> String {
    value
        .as_str()
        .map(str::to_owned)
        .unwrap_or_else(|| serde_json::to_string(value).unwrap_or_else(|_| "<json>".to_string()))
}

pub async fn run_tui(base_client: &KernelClient, args: TuiArgs) -> anyhow::Result<()> {
    let auth_override = args.token.as_deref().or(args.password.as_deref());
    let runtime_client =
        base_client.with_runtime_overrides(args.url.as_deref(), auth_override, args.timeout_ms)?;

    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut app = TuiApp::new(&runtime_client, args);
    app.initialize().await;

    let tick_rate = Duration::from_millis(150);
    let mut last_tick = Instant::now();

    loop {
        terminal.draw(|frame| ui(frame, &app))?;

        let timeout = tick_rate
            .checked_sub(last_tick.elapsed())
            .unwrap_or_else(|| Duration::from_millis(0));
        if event::poll(timeout)? {
            if let Event::Key(key) = event::read()? {
                app.handle_key(key).await;
            }
        }

        if last_tick.elapsed() >= tick_rate {
            app.on_tick().await;
            last_tick = Instant::now();
        }

        if app.should_quit {
            break;
        }
    }

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;
    Ok(())
}

fn ui(frame: &mut Frame, app: &TuiApp<'_>) {
    if app.screen_mode == ScreenMode::Intro {
        render_intro(frame, app);
        return;
    }

    let page = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(2),
            Constraint::Min(10),
            Constraint::Length(3),
            Constraint::Length(1),
        ])
        .split(frame.size());

    render_header(frame, page[0], app);
    render_body(frame, page[1], app);
    render_input(frame, page[2], app);
    render_status(frame, page[3], app);

    if app.overlay != Overlay::None {
        render_overlay(frame, app);
    }
}

fn render_intro(frame: &mut Frame, app: &TuiApp<'_>) {
    // Animated brand color cycling through warm amber spectrum
    let pulse_colors = [
        Color::Rgb(246, 196, 83),  // accent gold
        Color::Rgb(232, 180, 70),  // warm gold
        Color::Rgb(255, 200, 100), // bright gold
        Color::Rgb(220, 170, 60),  // deep gold
    ];
    let logo_color = pulse_colors[(app.intro_frame / 6) % pulse_colors.len()];
    let elapsed = app.intro_started_at.elapsed().as_secs_f32();
    let shimmer = ((elapsed * 0.9) as usize) % SPINNER_FRAMES.len();
    let accent = Color::Rgb(246, 196, 83);

    let card_area = centered_rect(62, 38, frame.size());
    frame.render_widget(
        Block::default()
            .borders(Borders::ALL)
            .title(" A2R Shell Studio ")
            .border_style(Style::default().fg(Color::Rgb(60, 65, 75))),
        card_area,
    );
    let card_inner = Block::default().inner(card_area);
    let card_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(9), Constraint::Length(5)])
        .split(card_inner);

    // Brand-accurate ASCII art with A2R stylized logo
    let logo = Paragraph::new(Text::from(vec![
        Line::styled(
            "    █████╗ ██████╗ ██████╗ ",
            Style::default().fg(logo_color).add_modifier(Modifier::BOLD),
        ),
        Line::styled(
            "   ██╔══██╗╚═══██║██╔══██╗",
            Style::default().fg(logo_color).add_modifier(Modifier::BOLD),
        ),
        Line::styled(
            "   ███████║ █████╔╝██████╔╝",
            Style::default().fg(logo_color).add_modifier(Modifier::BOLD),
        ),
        Line::styled(
            "   ██╔══██║██╔══██║██╔══██╗",
            Style::default().fg(logo_color).add_modifier(Modifier::BOLD),
        ),
        Line::styled(
            "   ██║  ██║██████╔╝██║  ██║",
            Style::default().fg(logo_color).add_modifier(Modifier::BOLD),
        ),
        Line::styled(
            "   ╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝",
            Style::default().fg(logo_color).add_modifier(Modifier::BOLD),
        ),
        Line::styled("", Style::default().fg(logo_color)),
        Line::styled(
            "      A://RCHITECT       ",
            Style::default().fg(logo_color).add_modifier(Modifier::BOLD),
        ),
        Line::styled(
            format!("   booting shell runtime {}", SPINNER_FRAMES[shimmer]),
            Style::default().fg(Color::Rgb(155, 163, 178)),
        ),
    ]));
    frame.render_widget(logo, card_layout[0]);

    let intro_cursor = if (app.intro_frame / 10).is_multiple_of(2) {
        "█"
    } else {
        " "
    };
    let intro_line = if app.intro_input.is_empty() {
        format!("ask anything... \"fix broken tests\"{}", intro_cursor)
    } else {
        format!("{}{}", app.intro_input, intro_cursor)
    };
    let prompt_icon = PROMPT_ICON_FRAMES[app.intro_frame % PROMPT_ICON_FRAMES.len()];
    let (provider, model) = split_provider_model(&app.current_model);
    let agent_color = color_for_agent(&app.current_agent);
    let agent_display = app.current_agent.to_ascii_uppercase();
    let agent_chip = Style::default()
        .fg(agent_color)
        .bg(Color::Rgb(28, 32, 40))
        .add_modifier(Modifier::BOLD);

    let prompt = Paragraph::new(Text::from(vec![
        Line::from(vec![
            Span::styled(
                format!("{prompt_icon} "),
                Style::default().fg(accent).add_modifier(Modifier::BOLD),
            ),
            Span::styled(intro_line, Style::default().fg(Color::Rgb(232, 227, 213))),
        ]),
        Line::styled(
            "Enter to launch shell UI  |  Ctrl+D exit",
            Style::default().fg(Color::Rgb(123, 127, 135)),
        ),
        Line::from(vec![
            Span::styled("agent ", Style::default().fg(Color::Rgb(123, 127, 135))),
            Span::styled(format!(" {} ", agent_display), agent_chip),
            Span::raw("  "),
            Span::styled("provider ", Style::default().fg(Color::Rgb(123, 127, 135))),
            Span::styled(provider, Style::default().fg(Color::Rgb(140, 200, 255))),
            Span::raw("  "),
            Span::styled("model ", Style::default().fg(Color::Rgb(123, 127, 135))),
            Span::styled(
                model,
                Style::default()
                    .fg(Color::White)
                    .add_modifier(Modifier::BOLD),
            ),
        ]),
        Line::styled(
            "Tip: Tab switches agents. Use '/' for commands and '@' for file paths.",
            Style::default().fg(Color::Rgb(123, 127, 135)),
        ),
    ]))
    .block(
        Block::default()
            .borders(Borders::ALL)
            .style(Style::default().bg(Color::Rgb(24, 27, 33)))
            .border_style(Style::default().fg(accent)),
    );
    frame.render_widget(prompt, card_layout[1]);
}

fn render_header(frame: &mut Frame, area: Rect, app: &TuiApp<'_>) {
    let conn_label = if app.connection_status == "connected" {
        "connected"
    } else {
        "disconnected"
    };
    let conn_color = if app.connection_status == "connected" {
        Color::Rgb(125, 211, 165)
    } else {
        Color::Rgb(249, 112, 102)
    };
    let mcp_color = if app.mcp_status.starts_with("offline") {
        Color::Rgb(249, 112, 102)
    } else if app.mcp_status.starts_with("degraded") {
        Color::Rgb(246, 196, 83)
    } else {
        Color::Rgb(125, 211, 165)
    };
    let agent_color = color_for_agent(&app.current_agent);
    let agent_display = app.current_agent.to_ascii_uppercase();
    let (provider, model_id) = split_provider_model(&app.current_model);
    let status_chip = Style::default()
        .fg(Color::Rgb(17, 20, 25))
        .bg(Color::Rgb(246, 196, 83))
        .add_modifier(Modifier::BOLD);
    let agent_chip = Style::default()
        .fg(agent_color)
        .bg(Color::Rgb(28, 32, 40))
        .add_modifier(Modifier::BOLD);
    let line = Line::from(vec![
        Span::styled(
            "A://RCHITECH",
            Style::default()
                .fg(Color::Rgb(246, 196, 83))
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw("  "),
        Span::styled(
            format!(
                "{} ",
                SPINNER_FRAMES[app.intro_frame % SPINNER_FRAMES.len()]
            ),
            Style::default().fg(Color::Rgb(246, 196, 83)),
        ),
        Span::styled("●", Style::default().fg(conn_color)),
        Span::raw(" "),
        Span::styled(
            conn_label,
            Style::default().fg(conn_color).add_modifier(Modifier::BOLD),
        ),
        Span::raw("  "),
        Span::styled("agent ", Style::default().fg(Color::Rgb(123, 127, 135))),
        Span::styled(format!(" {} ", agent_display), agent_chip),
        Span::raw("  "),
        Span::styled("provider ", Style::default().fg(Color::Rgb(123, 127, 135))),
        Span::styled(provider, Style::default().fg(Color::Rgb(140, 200, 255))),
        Span::raw("  "),
        Span::styled("model ", Style::default().fg(Color::Rgb(123, 127, 135))),
        Span::styled(
            model_id,
            Style::default()
                .fg(Color::White)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw("  "),
        Span::styled(" /status ", status_chip),
        Span::raw("  "),
        Span::styled("● ", Style::default().fg(mcp_color)),
        Span::styled(
            format!("mcp {}", app.mcp_status),
            Style::default().fg(mcp_color),
        ),
    ]);

    frame.render_widget(Paragraph::new(line).wrap(Wrap { trim: true }), area);
}

fn render_body(frame: &mut Frame, area: Rect, app: &TuiApp<'_>) {
    render_chat_panel(frame, area, app);
}

fn render_chat_panel(frame: &mut Frame, area: Rect, app: &TuiApp<'_>) {
    let mut lines = Vec::new();
    let stream_wave = STREAM_WAVE_FRAMES[app.intro_frame % STREAM_WAVE_FRAMES.len()];
    let stream_cursor = if (app.intro_frame / 3).is_multiple_of(2) {
        "▌"
    } else {
        " "
    };

    if app.activity_status == "streaming" {
        lines.push(Line::from(vec![Span::styled(
            format!(
                "[stream {}] {} generating {}",
                SPINNER_FRAMES[app.intro_frame % SPINNER_FRAMES.len()],
                stream_wave,
                stream_cursor
            ),
            Style::default().fg(Color::Rgb(246, 196, 83)),
        )]));
        lines.push(Line::raw(""));
    }

    if app.entries.is_empty() {
        lines.push(Line::styled(
            "No conversation yet. Type a message and press Enter.",
            Style::default().fg(Color::Rgb(123, 127, 135)),
        ));
    } else {
        let mut last_assistant_index = None;
        for (index, entry) in app.entries.iter().enumerate() {
            if matches!(entry.role, ChatRole::Assistant) {
                last_assistant_index = Some(index);
            }
        }

        for (index, entry) in app.entries.iter().enumerate() {
            let (label, label_style, body_style) = match entry.role {
                ChatRole::User => (
                    "[you]",
                    Style::default()
                        .fg(Color::Rgb(140, 200, 255))
                        .add_modifier(Modifier::BOLD),
                    Style::default().fg(Color::Rgb(243, 238, 224)),
                ),
                ChatRole::Assistant => (
                    "[assistant]",
                    Style::default()
                        .fg(Color::Rgb(125, 211, 165))
                        .add_modifier(Modifier::BOLD),
                    Style::default().fg(Color::Rgb(232, 227, 213)),
                ),
                ChatRole::System => (
                    "[system]",
                    Style::default()
                        .fg(Color::Rgb(155, 163, 178))
                        .add_modifier(Modifier::BOLD),
                    Style::default().fg(Color::Rgb(155, 163, 178)),
                ),
                ChatRole::Error => (
                    "[error]",
                    Style::default()
                        .fg(Color::Rgb(249, 112, 102))
                        .add_modifier(Modifier::BOLD),
                    Style::default().fg(Color::Rgb(249, 112, 102)),
                ),
            };

            let mut text_lines = entry.text.lines();
            if let Some(first) = text_lines.next() {
                let mut spans = vec![
                    Span::styled(format!("{label} "), label_style),
                    Span::styled(first.to_string(), body_style),
                ];
                if app.activity_status == "streaming"
                    && Some(index) == last_assistant_index
                    && matches!(entry.role, ChatRole::Assistant)
                {
                    spans.push(Span::styled(
                        format!(" {}", stream_cursor),
                        Style::default().fg(Color::Rgb(246, 196, 83)),
                    ));
                }
                lines.push(Line::from(vec![spans[0].clone(), spans[1].clone()]));
                if spans.len() > 2 {
                    lines.pop();
                    lines.push(Line::from(spans));
                }
            } else {
                lines.push(Line::from(vec![
                    Span::styled(format!("{label} "), label_style),
                    Span::styled("(empty)", body_style),
                ]));
            }

            for continuation in text_lines {
                lines.push(Line::from(vec![
                    Span::raw("          "),
                    Span::styled(continuation.to_string(), body_style),
                ]));
            }
            lines.push(Line::raw(""));
        }
    }

    let chat = Paragraph::new(lines).wrap(Wrap { trim: false }).block(
        Block::default()
            .borders(Borders::TOP)
            .border_style(Style::default().fg(Color::Rgb(60, 65, 75))),
    );
    frame.render_widget(chat, area);
}

fn render_sidebar(frame: &mut Frame, area: Rect, app: &TuiApp<'_>) {
    let blocks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(10),
            Constraint::Min(6),
            Constraint::Length(9),
        ])
        .split(area);

    let runtime_lines = vec![
        Line::from(vec![
            Span::styled("health ", Style::default().fg(Color::Rgb(123, 127, 135))),
            Span::styled(
                app.health_status.as_str(),
                Style::default()
                    .fg(Color::Rgb(125, 211, 165))
                    .add_modifier(Modifier::BOLD),
            ),
        ]),
        Line::from(vec![
            Span::styled("activity ", Style::default().fg(Color::Rgb(123, 127, 135))),
            Span::styled(
                app.activity_status.as_str(),
                Style::default().fg(Color::Rgb(246, 196, 83)),
            ),
        ]),
        Line::from(vec![
            Span::styled("deliver ", Style::default().fg(Color::Rgb(123, 127, 135))),
            Span::styled(
                if app.args.deliver { "on" } else { "off" },
                Style::default().fg(Color::Rgb(232, 227, 213)),
            ),
        ]),
        Line::from(vec![
            Span::styled("thinking ", Style::default().fg(Color::Rgb(123, 127, 135))),
            Span::styled(
                app.args
                    .thinking
                    .as_deref()
                    .filter(|value| !value.is_empty())
                    .unwrap_or("default"),
                Style::default().fg(Color::Rgb(232, 227, 213)),
            ),
        ]),
        Line::from(vec![
            Span::styled("tools ", Style::default().fg(Color::Rgb(123, 127, 135))),
            Span::styled(
                if app.tools_expanded {
                    "expanded"
                } else {
                    "collapsed"
                },
                Style::default().fg(Color::Rgb(232, 227, 213)),
            ),
        ]),
        Line::from(vec![
            Span::styled("queue ", Style::default().fg(Color::Rgb(123, 127, 135))),
            Span::styled(
                format!(
                    "{}{}",
                    app.prompt_queue.len(),
                    if app.queue_paused { " (paused)" } else { "" }
                ),
                Style::default().fg(Color::Rgb(232, 227, 213)),
            ),
        ]),
        Line::from(vec![
            Span::styled("path ", Style::default().fg(Color::Rgb(123, 127, 135))),
            Span::styled(
                truncate_for_ui(&app.current_path.display().to_string(), 20),
                Style::default().fg(Color::Rgb(232, 227, 213)),
            ),
        ]),
    ];
    frame.render_widget(
        Paragraph::new(runtime_lines)
            .wrap(Wrap { trim: true })
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title(" Runtime ")
                    .border_style(Style::default().fg(Color::Rgb(60, 65, 75))),
            ),
        blocks[0],
    );

    let mut session_items = Vec::new();
    let mut relevant_sessions = app
        .sessions
        .iter()
        .filter(|session| session.brain_id == app.current_agent || app.current_agent == "main")
        .collect::<Vec<_>>();
    relevant_sessions.sort_by(|a, b| a.id.cmp(&b.id));

    if relevant_sessions.is_empty() {
        session_items.push(ListItem::new(Line::styled(
            "No sessions yet",
            Style::default().fg(Color::Rgb(123, 127, 135)),
        )));
    } else {
        for session in relevant_sessions.into_iter().take(8) {
            let is_active = session.id == app.current_session;
            let status = normalize_status_short(&session.status);
            let marker = if is_active { ">" } else { " " };
            let id = truncate_for_ui(&session.id, 26);
            let line = format!("{marker} {id} [{status}]");
            let style = if is_active {
                Style::default()
                    .fg(Color::Rgb(246, 196, 83))
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::Rgb(232, 227, 213))
            };
            session_items.push(ListItem::new(Line::styled(line, style)));
        }
    }

    frame.render_widget(
        List::new(session_items).block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Sessions ")
                .border_style(Style::default().fg(Color::Rgb(60, 65, 75))),
        ),
        blocks[1],
    );

    let shortcuts = Paragraph::new(Text::from(vec![
        Line::styled(
            "Ctrl+G agents  Ctrl+P sessions",
            Style::default().fg(Color::Rgb(155, 163, 178)),
        ),
        Line::styled(
            "Ctrl+L models  Ctrl+F paths",
            Style::default().fg(Color::Rgb(155, 163, 178)),
        ),
        Line::styled(
            "Ctrl+O tools  Ctrl+T thinking",
            Style::default().fg(Color::Rgb(155, 163, 178)),
        ),
        Line::styled(
            "Ctrl+H help  Ctrl+S stop  Ctrl+R resume",
            Style::default().fg(Color::Rgb(155, 163, 178)),
        ),
        Line::styled(
            "Esc abort  Ctrl+D exit",
            Style::default().fg(Color::Rgb(155, 163, 178)),
        ),
    ]))
    .wrap(Wrap { trim: true })
    .block(
        Block::default()
            .borders(Borders::ALL)
            .title(" Keys ")
            .border_style(Style::default().fg(Color::Rgb(60, 65, 75))),
    );
    frame.render_widget(shortcuts, blocks[2]);
}

fn normalize_status_short(status: &str) -> &'static str {
    let lower = status.to_ascii_lowercase();
    if lower.contains("run") || lower.contains("active") || lower.contains("stream") {
        "run"
    } else if lower.contains("idle") {
        "idle"
    } else if lower.contains("error") || lower.contains("fail") {
        "err"
    } else {
        "unk"
    }
}

fn truncate_for_ui(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }

    let keep = max_chars.saturating_sub(3);
    let mut output = String::new();
    for (index, ch) in value.chars().enumerate() {
        if index >= keep {
            break;
        }
        output.push(ch);
    }
    output.push_str("...");
    output
}

fn line_left_right(left: &str, right: &str, width: usize) -> String {
    let safe_width = width.saturating_sub(2);
    let left_count = left.chars().count();
    let right_count = right.chars().count();

    if left_count + right_count + 1 >= safe_width {
        let left_max = safe_width.saturating_sub(right_count + 1);
        let left_trim = truncate_for_ui(left, left_max.max(1));
        return format!("{left_trim} {right}");
    }

    let spaces = safe_width.saturating_sub(left_count + right_count);
    format!("{left}{}{}", " ".repeat(spaces), right)
}

fn active_mention_range(input: &str) -> Option<(usize, usize)> {
    if input.is_empty() {
        return None;
    }
    if input.ends_with(char::is_whitespace) {
        return None;
    }

    let end = input.len();
    let start = input[..end]
        .rfind(char::is_whitespace)
        .map(|index| index + 1)
        .unwrap_or(0);

    if input[start..end].starts_with('@') {
        Some((start, end))
    } else {
        None
    }
}

fn color_for_agent(agent: &str) -> Color {
    const PALETTE: [Color; 8] = [
        Color::Rgb(125, 211, 165),
        Color::Rgb(140, 200, 255),
        Color::Rgb(246, 196, 83),
        Color::Rgb(248, 162, 141),
        Color::Rgb(198, 164, 255),
        Color::Rgb(112, 214, 255),
        Color::Rgb(255, 174, 99),
        Color::Rgb(144, 224, 190),
    ];

    let mut hash = 0u32;
    for byte in agent.bytes() {
        hash = hash.wrapping_mul(33).wrapping_add(byte as u32);
    }
    PALETTE[hash as usize % PALETTE.len()]
}

fn render_status(frame: &mut Frame, area: Rect, app: &TuiApp<'_>) {
    let busy = app.activity_status != "idle";
    let activity_label = if busy {
        format!(
            "{} {} ({})",
            app.current_spinner(),
            app.activity_status,
            app.current_elapsed_label()
        )
    } else {
        "idle".to_string()
    };

    let left = format!(
        "state {}  activity {}",
        app.connection_status, activity_label
    );
    let right = app.telemetry_line();
    let line = line_left_right(&left, &right, area.width as usize);

    frame.render_widget(
        Paragraph::new(Line::styled(
            line,
            Style::default().fg(Color::Rgb(123, 127, 135)),
        )),
        area,
    );
}

fn render_input(frame: &mut Frame, area: Rect, app: &TuiApp<'_>) {
    let hint = if app.input.starts_with("/") {
        "Slash commands: type '/' for full command palette.".to_string()
    } else if active_mention_range(&app.input.content()).is_some() {
        "File references: pick a file to insert @path.".to_string()
    } else if app.input.starts_with("!") {
        "Run /shell on to allow local shell commands.".to_string()
    } else if app.input.is_empty() {
        "Enter send. Tab cycles agent. '/' commands. '@' files. Ctrl+H history.".to_string()
    } else if app.current_suggestion.is_some() {
        format!("Tab to accept: {}", app.current_suggestion.as_ref().unwrap())
    } else {
        "Press Enter to send (or auto-queue while a run is active).".to_string()
    };

    let shell_label = match app.allow_local_shell {
        Some(true) => "local shell: enabled",
        Some(false) => "local shell: disabled",
        None => "local shell: not set",
    };

    let prompt_icon = PROMPT_ICON_FRAMES[app.intro_frame % PROMPT_ICON_FRAMES.len()];
    let thinking_badge = if app.activity_status != "idle" {
        format!(
            "{} {} {}",
            SPINNER_FRAMES[app.intro_frame % SPINNER_FRAMES.len()],
            app.activity_status,
            STREAM_WAVE_FRAMES[app.intro_frame % STREAM_WAVE_FRAMES.len()]
        )
    } else {
        "ready".to_string()
    };

    // Create input widget from MultiLineInput with syntax highlighting
    let highlighted_lines = app.syntax_highlighter.highlight_markdown(&app.input.content());
    let input_widget = app.input.render_with_highlight(highlighted_lines).block(
        Block::default()
            .borders(Borders::ALL)
            .title(format!(" {} ", prompt_icon))
            .style(Style::default().bg(Color::Rgb(24, 27, 33)))
            .border_style(Style::default().fg(Color::Rgb(60, 65, 75))),
    );

    // Create status line
    let (provider, model_id) = split_provider_model(&app.current_model);
    let agent_color = color_for_agent(&app.current_agent);
    let agent_display = app.current_agent.to_ascii_uppercase();
    let agent_chip = Style::default()
        .fg(agent_color)
        .bg(Color::Rgb(28, 32, 40))
        .add_modifier(Modifier::BOLD);

    // Split area for input and status
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Min(3),  // Input area
            Constraint::Length(1), // Status line
        ])
        .split(area);

    // Render the multi-line input
    frame.render_widget(input_widget, chunks[0]);

    // Render hint and status
    let status = Paragraph::new(Text::from(vec![
        Line::styled(hint, Style::default().fg(Color::Rgb(155, 163, 178))),
        Line::from(vec![
            Span::styled(shell_label, Style::default().fg(Color::Rgb(123, 127, 135))),
            Span::raw(" | "),
            Span::styled("agent=", Style::default().fg(Color::Rgb(123, 127, 135))),
            Span::styled(format!(" {} ", agent_display), agent_chip),
            Span::raw(" "),
            Span::styled("provider=", Style::default().fg(Color::Rgb(123, 127, 135))),
            Span::styled(provider, Style::default().fg(Color::Rgb(140, 200, 255))),
            Span::raw(" "),
            Span::styled("model=", Style::default().fg(Color::Rgb(123, 127, 135))),
            Span::styled(
                model_id,
                Style::default()
                    .fg(Color::White)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::raw(" | "),
            Span::styled(
                format!(
                    "queue={}{}",
                    app.prompt_queue.len(),
                    if app.queue_paused { " (paused)" } else { "" }
                ),
                Style::default().fg(Color::Rgb(123, 127, 135)),
            ),
            Span::raw(" | "),
            Span::styled(
                format!(
                    "path={}",
                    truncate_for_ui(&app.current_path.display().to_string(), 36)
                ),
                Style::default().fg(Color::Rgb(123, 127, 135)),
            ),
        ]),
    ]));

    frame.render_widget(status, chunks[1]);
}

fn render_overlay(frame: &mut Frame, app: &TuiApp<'_>) {
    let area = centered_rect(74, 72, frame.size());
    frame.render_widget(Clear, area);

    let title = match app.overlay {
        Overlay::Agents => " Agents ",
        Overlay::Sessions => " Sessions ",
        Overlay::Models => " Models ",
        Overlay::Commands => " Commands ",
        Overlay::Paths => match app.path_overlay_mode {
            PathOverlayMode::WorkspacePicker => " Paths ",
            PathOverlayMode::MentionReference => " Files ",
        },
        Overlay::Help => " Help ",
        Overlay::History => " History (Ctrl+H) ",
        Overlay::None => "",
    };

    let block = Block::default()
        .borders(Borders::ALL)
        .title(format!("{} Esc close | Enter select ", title))
        .border_style(Style::default().fg(Color::Rgb(246, 196, 83)));
    let inner = block.inner(area);
    frame.render_widget(block, area);

    if app.overlay == Overlay::Help {
        let help_text = Paragraph::new(Text::from(
            app.overlay_items_base()
                .into_iter()
                .map(|line| Line::styled(line, Style::default().fg(Color::Rgb(232, 227, 213))))
                .collect::<Vec<_>>(),
        ))
        .wrap(Wrap { trim: true });
        frame.render_widget(help_text, inner);
        return;
    }

    // Use categorized display for Commands overlay
    if app.overlay == Overlay::Commands {
        render_commands_overlay(frame, app, inner);
        return;
    }

    let items = app.overlay_items_filtered();
    let mut list_items = Vec::new();

    if items.is_empty() {
        list_items.push(ListItem::new(Line::styled(
            "No matches",
            Style::default().fg(Color::Rgb(123, 127, 135)),
        )));
    } else {
        for (index, item) in items.iter().enumerate() {
            let selected = index == app.overlay_cursor;
            let content = if selected {
                format!("> {item}")
            } else {
                format!("  {item}")
            };
            let style = if selected {
                Style::default()
                    .fg(Color::Rgb(246, 196, 83))
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::Rgb(232, 227, 213))
            };
            list_items.push(ListItem::new(Line::styled(content, style)));
        }
    }

    let sections = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(2), Constraint::Min(4)])
        .split(inner);

    let search_line = Paragraph::new(Line::from(vec![
        Span::styled("search: ", Style::default().fg(Color::Rgb(242, 166, 90))),
        Span::styled(
            if app.overlay_filter.is_empty() {
                "(type to filter)"
            } else {
                app.overlay_filter.as_str()
            },
            Style::default().fg(Color::Rgb(243, 238, 224)),
        ),
    ]));

    frame.render_widget(search_line, sections[0]);
    frame.render_widget(List::new(list_items), sections[1]);

    if app.overlay == Overlay::Paths {
        let path_hint = match app.path_overlay_mode {
            PathOverlayMode::WorkspacePicker => {
                if let Some(err) = &app.path_error {
                    format!("{} | {}", app.current_path.display(), err)
                } else {
                    format!("current: {}", app.current_path.display())
                }
            }
            PathOverlayMode::MentionReference => {
                if let Some(err) = &app.path_error {
                    format!("insert @path from {} | {}", app.current_path.display(), err)
                } else {
                    format!(
                        "insert @path from {} | {} files indexed",
                        app.current_path.display(),
                        app.path_entries.len()
                    )
                }
            }
        };
        let hint_area = Rect {
            x: sections[0].x,
            y: sections[1].y.saturating_sub(1),
            width: sections[1].width,
            height: 1,
        };
        frame.render_widget(
            Paragraph::new(Line::styled(
                truncate_for_ui(&path_hint, sections[1].width.saturating_sub(2) as usize),
                Style::default().fg(Color::Rgb(123, 127, 135)),
            )),
            hint_area,
        );
    }
}

/// Render the commands overlay with categorized groups
fn render_commands_overlay(frame: &mut Frame, app: &TuiApp<'_>, area: Rect) {
    let sections = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(2), Constraint::Min(4)])
        .split(area);

    // Search/filter line
    let search_line = Paragraph::new(Line::from(vec![
        Span::styled("search: ", Style::default().fg(Color::Rgb(242, 166, 90))),
        Span::styled(
            if app.overlay_filter.is_empty() {
                "(type to filter)"
            } else {
                app.overlay_filter.as_str()
            },
            Style::default().fg(Color::Rgb(243, 238, 224)),
        ),
    ]));
    frame.render_widget(search_line, sections[0]);

    // Get categorized commands
    let categorized = slash_command_catalog_by_category();
    let filter = app.overlay_filter.trim().to_ascii_lowercase();
    
    // Build list items with categories
    let mut list_items: Vec<ListItem> = Vec::new();
    let mut current_index = 0;
    let mut selected_item_found = false;

    for (category, commands) in categorized {
        // Filter commands for this category
        let filtered_commands: Vec<_> = if filter.is_empty() {
            commands
        } else {
            commands
                .into_iter()
                .filter(|cmd| {
                    cmd.name.to_ascii_lowercase().contains(&filter) ||
                    cmd.description.to_ascii_lowercase().contains(&filter)
                })
                .collect()
        };

        if filtered_commands.is_empty() {
            continue;
        }

        // Add category header
        let header_style = Style::default()
            .fg(category.color())
            .add_modifier(Modifier::BOLD);
        list_items.push(ListItem::new(Line::styled(
            format!("  {} ──────────────────────────────", category.name()),
            header_style,
        )));

        // Add commands in this category
        for cmd in filtered_commands {
            let is_selected = current_index == app.overlay_cursor;
            if is_selected {
                selected_item_found = true;
            }

            let prefix = if is_selected { "> " } else { "  " };
            let style = if is_selected {
                Style::default()
                    .fg(Color::Rgb(246, 196, 83))
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::Rgb(232, 227, 213))
            };

            // Command name with description
            let line = Line::from(vec![
                Span::styled(prefix, style),
                Span::styled(format!("{:<25}", cmd.name), style),
                Span::styled(
                    format!("  {}", cmd.description),
                    Style::default().fg(Color::Rgb(123, 127, 135)),
                ),
            ]);
            list_items.push(ListItem::new(line));
            current_index += 1;
        }

        // Add spacing between categories
        list_items.push(ListItem::new(""));
    }

    if list_items.is_empty() {
        list_items.push(ListItem::new(Line::styled(
            "No matching commands",
            Style::default().fg(Color::Rgb(123, 127, 135)),
        )));
    }

    frame.render_widget(List::new(list_items), sections[1]);
}

/// Simple fuzzy matching algorithm.
/// Returns a score if the pattern matches the text, None otherwise.
/// Higher scores indicate better matches.
fn fuzzy_match(text: &str, pattern: &str) -> Option<i32> {
    if pattern.is_empty() {
        return Some(0);
    }

    let text_chars: Vec<char> = text.chars().collect();
    let pattern_chars: Vec<char> = pattern.chars().collect();
    let mut pattern_idx = 0;
    let mut score = 0i32;
    let mut last_match_idx: Option<usize> = None;
    let mut consecutive_count = 0;

    for (text_idx, &text_ch) in text_chars.iter().enumerate() {
        if pattern_idx >= pattern_chars.len() {
            break;
        }

        let pattern_ch = pattern_chars[pattern_idx];

        if text_ch == pattern_ch {
            // Base score for matching character
            score += 10;

            // Bonus for consecutive matches
            if let Some(last_idx) = last_match_idx {
                if text_idx == last_idx + 1 {
                    consecutive_count += 1;
                    score += consecutive_count * 5;
                } else {
                    consecutive_count = 0;
                }
            }

            // Bonus for matching at word boundary (after / or _ or - or .)
            if text_idx > 0 {
                let prev_ch = text_chars[text_idx - 1];
                if prev_ch == '/' || prev_ch == '_' || prev_ch == '-' || prev_ch == '.' {
                    score += 15;
                }
            }

            // Bonus for exact substring match
            if pattern_idx == 0 && text_idx == 0 {
                score += 20; // Starts with pattern
            }

            last_match_idx = Some(text_idx);
            pattern_idx += 1;
        }
    }

    if pattern_idx >= pattern_chars.len() {
        // All pattern characters were matched
        // Bonus for shorter text (prefer shorter matches)
        score += 100i32.saturating_sub(text_chars.len() as i32);
        Some(score)
    } else {
        None
    }
}

fn centered_rect(percent_x: u16, percent_y: u16, rect: Rect) -> Rect {
    let popup_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - percent_y) / 2),
            Constraint::Percentage(percent_y),
            Constraint::Percentage((100 - percent_y) / 2),
        ])
        .split(rect);

    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(popup_layout[1])[1]
}

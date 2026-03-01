use std::collections::HashMap;

use chrono::{DateTime, Utc};
use crossterm::event::KeyEvent;
use ratatui::widgets::block::BorderType;
use ratatui::{
    layout::{Constraint, Direction, Layout},
    style::{Color, Style},
    text::Text,
    widgets::{Block, Borders, List, ListItem, Paragraph},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TuiTheme {
    pub primary_color: String,
    pub secondary_color: String,
    pub accent_color: String,
}

impl Default for TuiTheme {
    fn default() -> Self {
        Self {
            primary_color: "cyan".to_string(),
            secondary_color: "gray".to_string(),
            accent_color: "magenta".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TuiConfig {
    pub theme: TuiTheme,
    pub enable_logging: bool,
    pub history_limit: Option<usize>,
    pub auto_refresh_interval_ms: Option<u64>,
    pub enable_key_bindings: bool,
}

impl Default for TuiConfig {
    fn default() -> Self {
        Self {
            theme: TuiTheme::default(),
            enable_logging: true,
            history_limit: Some(500),
            auto_refresh_interval_ms: Some(100),
            enable_key_bindings: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TuiMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: DateTime<Utc>,
    pub metadata: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone)]
pub struct TuiService {
    pub active_tab: TuiTab,
    pub messages: Vec<TuiMessage>,
    pub sessions: Vec<String>,
    pub agents: Vec<String>,
    pub current_session: Option<String>,
    pub current_agent: Option<String>,
    pub input: String,
    pub input_cursor: usize,
    pub scroll_offset: usize,
    pub config: TuiConfig,
}

impl Default for TuiService {
    fn default() -> Self {
        Self::new()
    }
}

impl TuiService {
    pub fn new() -> Self {
        Self {
            active_tab: TuiTab::default(),
            messages: Vec::new(),
            sessions: Vec::new(),
            agents: Vec::new(),
            current_session: None,
            current_agent: None,
            input: String::new(),
            input_cursor: 0,
            scroll_offset: 0,
            config: TuiConfig::default(),
        }
    }

    pub fn with_config(config: TuiConfig) -> Self {
        let mut service = Self::new();
        service.config = config;
        service
    }

    pub async fn initialize(&mut self) -> Result<(), TuiError> {
        if let Ok(path) = std::env::var("A2R_TUI_CONFIG") {
            let content = tokio::fs::read_to_string(&path).await.map_err(|e| {
                TuiError::IoError(format!("Failed to read TUI config {}: {}", path, e))
            })?;
            let config: TuiConfig = serde_json::from_str(&content).map_err(|e| {
                TuiError::SerializationError(format!("Invalid TUI config {}: {}", path, e))
            })?;
            self.config = config;
        }

        self.validate_config()?;
        Ok(())
    }

    fn validate_config(&self) -> Result<(), TuiError> {
        if let Some(limit) = self.config.history_limit {
            if limit == 0 {
                return Err(TuiError::ValidationError(
                    "history_limit must be greater than 0".to_string(),
                ));
            }
        }

        if let Some(interval) = self.config.auto_refresh_interval_ms {
            if interval == 0 {
                return Err(TuiError::ValidationError(
                    "auto_refresh_interval_ms must be greater than 0".to_string(),
                ));
            }
        }

        Ok(())
    }
}

// Enhanced TUI implementation with interactive terminal interface
impl TuiService {
    /// Run the TUI in interactive mode
    pub async fn run_interactive(&mut self) -> Result<(), TuiError> {
        use crossterm::{
            event::{self, Event},
            execute,
            terminal::{
                disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen,
            },
        };
        use ratatui::{backend::CrosstermBackend, Terminal};
        use std::io;

        // Setup terminal
        enable_raw_mode()
            .map_err(|e| TuiError::IoError(format!("Failed to enable raw mode: {}", e)))?;
        let mut stdout = io::stdout();
        execute!(stdout, EnterAlternateScreen)
            .map_err(|e| TuiError::IoError(format!("Failed to enter alternate screen: {}", e)))?;
        let backend = CrosstermBackend::new(stdout);
        let mut terminal = Terminal::new(backend)
            .map_err(|e| TuiError::IoError(format!("Failed to create terminal: {}", e)))?;

        // Main event loop
        loop {
            // Draw UI
            terminal
                .draw(|f| {
                    self.draw_ui(f);
                })
                .map_err(|e| TuiError::IoError(format!("Failed to draw UI: {}", e)))?;

            // Handle events
            if event::poll(std::time::Duration::from_millis(50))
                .map_err(|e| TuiError::IoError(format!("Failed to poll events: {}", e)))?
            {
                if let Event::Key(key) = event::read()
                    .map_err(|e| TuiError::IoError(format!("Failed to read event: {}", e)))?
                {
                    match self.handle_key_event(key).await {
                        Ok(should_continue) => {
                            if !should_continue {
                                break;
                            }
                        }
                        Err(e) => {
                            eprintln!("Error handling key event: {}", e);
                            break;
                        }
                    }
                }
            }
        }

        // Restore terminal
        disable_raw_mode()
            .map_err(|e| TuiError::IoError(format!("Failed to disable raw mode: {}", e)))?;
        execute!(terminal.backend_mut(), LeaveAlternateScreen)
            .map_err(|e| TuiError::IoError(format!("Failed to leave alternate screen: {}", e)))?;

        Ok(())
    }

    /// Draw the TUI interface
    fn draw_ui(&mut self, frame: &mut ratatui::Frame) {
        // Create main layout
        let size = frame.size();
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(3), // Header
                Constraint::Min(10),   // Main content area
                Constraint::Length(3), // Input area
            ])
            .split(size);

        // Draw header
        let header_block = Block::default()
            .title(" A2R Terminal UI ")
            .borders(Borders::BOTTOM)
            .border_type(BorderType::Thick);
        let header_text = format!(
            "Active Session: {} | Active Agent: {} | Tab: {:?}",
            self.current_session.as_deref().unwrap_or("None"),
            self.current_agent.as_deref().unwrap_or("None"),
            self.active_tab
        );
        let header_paragraph = Paragraph::new(header_text)
            .block(header_block)
            .style(Style::default().fg(Color::Cyan));
        frame.render_widget(header_paragraph, chunks[0]);

        // Draw main content based on active tab
        match self.active_tab {
            TuiTab::Chat => self.draw_chat_tab(frame, chunks[1]),
            TuiTab::Agents => self.draw_agents_tab(frame, chunks[1]),
            TuiTab::Sessions => self.draw_sessions_tab(frame, chunks[1]),
            TuiTab::Tools => self.draw_tools_tab(frame, chunks[1]),
            TuiTab::Settings => self.draw_settings_tab(frame, chunks[1]),
        }

        // Draw input area
        self.draw_input_area(frame, chunks[2]);
    }

    /// Draw chat tab
    fn draw_chat_tab(&mut self, frame: &mut ratatui::Frame, area: ratatui::prelude::Rect) {
        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Percentage(70), // Chat messages
                Constraint::Percentage(30), // Sidebar
            ])
            .split(area);

        // Draw chat messages
        let visible_messages = std::cmp::min(20, self.messages.len()); // Show last 20 messages
        let start_idx = self
            .messages
            .len()
            .saturating_sub(visible_messages + self.scroll_offset);
        let end_idx = std::cmp::min(self.messages.len(), start_idx + visible_messages);

        let messages_to_show = &self.messages[start_idx..end_idx];

        let message_items: Vec<ListItem> = messages_to_show
            .iter()
            .map(|msg| {
                let content = format!("{}: {}", msg.role, msg.content);
                let color = match msg.role.as_str() {
                    "user" => Color::Blue,
                    "assistant" => Color::Green,
                    "system" => Color::Yellow,
                    "tool" => Color::Magenta,
                    _ => Color::White,
                };
                ListItem::new(Text::styled(content, Style::default().fg(color)))
            })
            .collect();

        let messages_list = List::new(message_items)
            .block(Block::default().title(" Chat ").borders(Borders::ALL))
            .highlight_style(Style::default().bg(Color::DarkGray));
        frame.render_widget(messages_list, chunks[0]);

        // Draw sidebar with session info
        let session_info = if let Some(session_id) = &self.current_session {
            format!(
                "Current Session: {}\nMessages: {}\nActive: Yes",
                session_id,
                self.messages.len()
            )
        } else {
            "No active session\nUse /session create to start".to_string()
        };

        let session_paragraph = Paragraph::new(session_info)
            .block(
                Block::default()
                    .title(" Session Info ")
                    .borders(Borders::ALL),
            )
            .style(Style::default().fg(Color::LightCyan));
        frame.render_widget(session_paragraph, chunks[1]);
    }

    /// Draw agents tab
    fn draw_agents_tab(&mut self, frame: &mut ratatui::Frame, area: ratatui::prelude::Rect) {
        let agent_items: Vec<ListItem> = self
            .agents
            .iter()
            .map(|agent| {
                let content = format!("• {}", agent);
                ListItem::new(Text::styled(content, Style::default().fg(Color::Green)))
            })
            .collect();

        let agents_list = List::new(agent_items)
            .block(
                Block::default()
                    .title(" Available Agents ")
                    .borders(Borders::ALL),
            )
            .highlight_style(Style::default().bg(Color::DarkGray));
        frame.render_widget(agents_list, area);
    }

    /// Draw sessions tab
    fn draw_sessions_tab(&mut self, frame: &mut ratatui::Frame, area: ratatui::prelude::Rect) {
        let session_items: Vec<ListItem> = self
            .sessions
            .iter()
            .map(|session| {
                let is_active = self.current_session.as_ref() == Some(session);
                let prefix = if is_active { "●" } else { "○" };
                let content = format!("{} {}", prefix, session);
                let color = if is_active {
                    Color::Green
                } else {
                    Color::White
                };
                ListItem::new(Text::styled(content, Style::default().fg(color)))
            })
            .collect();

        let sessions_list = List::new(session_items)
            .block(
                Block::default()
                    .title(" Available Sessions ")
                    .borders(Borders::ALL),
            )
            .highlight_style(Style::default().bg(Color::DarkGray));
        frame.render_widget(sessions_list, area);
    }

    /// Draw tools tab
    fn draw_tools_tab(&mut self, frame: &mut ratatui::Frame, area: ratatui::prelude::Rect) {
        let tools = [
            "bash - Execute bash commands",
            "fs - File system operations",
            "git - Git operations",
            "docker - Docker operations",
            "kubectl - Kubernetes operations",
            "skill - Skill execution",
            "memory - Vector memory operations",
        ];

        let tool_items: Vec<ListItem> = tools
            .iter()
            .map(|tool| ListItem::new(Text::styled(*tool, Style::default().fg(Color::Yellow))))
            .collect();

        let tools_list = List::new(tool_items)
            .block(
                Block::default()
                    .title(" Available Tools ")
                    .borders(Borders::ALL),
            )
            .highlight_style(Style::default().bg(Color::DarkGray));
        frame.render_widget(tools_list, area);
    }

    /// Draw settings tab
    fn draw_settings_tab(&mut self, frame: &mut ratatui::Frame, area: ratatui::prelude::Rect) {
        let settings = format!(
            "Theme: {}\nLogging: {}\nHistory Limit: {}\nAuto Refresh: {}\nKey Bindings: {}",
            self.config.theme.primary_color,
            self.config.enable_logging,
            self.config.history_limit.unwrap_or(0),
            self.config.auto_refresh_interval_ms.is_some(),
            self.config.enable_key_bindings
        );

        let settings_paragraph = Paragraph::new(settings)
            .block(Block::default().title(" Settings ").borders(Borders::ALL))
            .style(Style::default().fg(Color::LightYellow));
        frame.render_widget(settings_paragraph, area);
    }

    /// Draw input area
    fn draw_input_area(&mut self, frame: &mut ratatui::Frame, area: ratatui::prelude::Rect) {
        let input_block = Block::default()
            .title(" Input (/ for commands) ")
            .borders(Borders::TOP)
            .border_type(BorderType::Thick);

        let input_text = format!("> {}", self.input);
        let input_paragraph = Paragraph::new(input_text)
            .block(input_block)
            .style(Style::default().fg(Color::White));

        frame.render_widget(input_paragraph, area);

        // Position cursor
        let cursor_x = area.x + 2 + self.input_cursor as u16; // Account for "> "
        let cursor_y = area.y + 1;
        frame.set_cursor(cursor_x, cursor_y);
    }

    /// Handle key events
    async fn handle_key_event(&mut self, key: KeyEvent) -> Result<bool, TuiError> {
        use crossterm::event::KeyCode;

        match key.code {
            KeyCode::Char(c) => {
                // Insert character at cursor position
                self.input.push(c);
            }
            KeyCode::Backspace => {
                self.input.pop();
            }
            KeyCode::Enter => {
                if !self.input.trim().is_empty() {
                    self.process_input().await?;
                }
                self.input.clear();
            }
            KeyCode::Tab => {
                // Cycle through tabs
                self.cycle_tab();
            }
            KeyCode::Esc => {
                // Quit
                return Ok(false);
            }
            _ => {}
        }

        Ok(true)
    }

    /// Cycle through tabs
    fn cycle_tab(&mut self) {
        self.active_tab = match self.active_tab {
            TuiTab::Chat => TuiTab::Agents,
            TuiTab::Agents => TuiTab::Sessions,
            TuiTab::Sessions => TuiTab::Tools,
            TuiTab::Tools => TuiTab::Settings,
            TuiTab::Settings => TuiTab::Chat,
        };
    }

    /// Process user input
    async fn process_input(&mut self) -> Result<(), TuiError> {
        let input = self.input.trim().to_string();

        if input.is_empty() {
            return Ok(());
        }

        // Check if it's a command
        if input.starts_with('/') {
            self.process_command(&input).await?;
        } else {
            // It's a message to the current session
            if let Some(_session_id) = &self.current_session {
                // Add user message to UI
                let user_message = TuiMessage {
                    id: uuid::Uuid::new_v4().to_string(),
                    role: "user".to_string(),
                    content: input.clone(),
                    timestamp: chrono::Utc::now(),
                    metadata: None,
                };
                self.messages.push(user_message);

                // In a real implementation, this would send the message to the agent
                // For now, we'll just add a mock response
                let assistant_message = TuiMessage {
                    id: uuid::Uuid::new_v4().to_string(),
                    role: "assistant".to_string(),
                    content: format!("Echo: {}", input),
                    timestamp: chrono::Utc::now(),
                    metadata: None,
                };
                self.messages.push(assistant_message);
            } else {
                // No active session, show error
                let error_message = TuiMessage {
                    id: uuid::Uuid::new_v4().to_string(),
                    role: "system".to_string(),
                    content: "No active session. Use /session create to start a new session."
                        .to_string(),
                    timestamp: chrono::Utc::now(),
                    metadata: None,
                };
                self.messages.push(error_message);
            }
        }

        Ok(())
    }

    /// Process commands
    async fn process_command(&mut self, command: &str) -> Result<(), TuiError> {
        let parts: Vec<&str> = command.split_whitespace().collect();
        if parts.is_empty() {
            return Ok(());
        }

        match parts[0] {
            "/help" => {
                let help_text = "Available commands:\n\
                                /help - Show this help\n\
                                /session create [name] - Create new session\n\
                                /session list - List sessions\n\
                                /session switch <id> - Switch to session\n\
                                /agent list - List available agents\n\
                                /agent switch <name> - Switch to agent\n\
                                /tool list - List available tools\n\
                                /tool exec <name> - Execute a tool\n\
                                /quit - Exit TUI\n\
                                /clear - Clear chat\n\
                                /tab <name> - Switch to tab (chat, agents, sessions, tools, settings)";

                let help_message = TuiMessage {
                    id: uuid::Uuid::new_v4().to_string(),
                    role: "system".to_string(),
                    content: help_text.to_string(),
                    timestamp: chrono::Utc::now(),
                    metadata: None,
                };
                self.messages.push(help_message);
            }
            "/session" => {
                if parts.len() < 2 {
                    let msg = TuiMessage {
                        id: uuid::Uuid::new_v4().to_string(),
                        role: "system".to_string(),
                        content: "Usage: /session create [name] | list | switch <id>".to_string(),
                        timestamp: chrono::Utc::now(),
                        metadata: None,
                    };
                    self.messages.push(msg);
                    return Ok(());
                }

                match parts[1] {
                    "create" => {
                        let session_name = if parts.len() > 2 {
                            parts[2].to_string()
                        } else {
                            format!("session-{}", chrono::Utc::now().format("%H:%M:%S"))
                        };

                        // Add to sessions list
                        self.sessions.push(session_name.clone());

                        // Set as current session
                        self.current_session = Some(session_name.clone());

                        let msg = TuiMessage {
                            id: uuid::Uuid::new_v4().to_string(),
                            role: "system".to_string(),
                            content: format!("Created and switched to session: {}", session_name),
                            timestamp: chrono::Utc::now(),
                            metadata: None,
                        };
                        self.messages.push(msg);
                    }
                    "list" => {
                        let session_list = if self.sessions.is_empty() {
                            "No sessions available".to_string()
                        } else {
                            let mut list = "Available sessions:\n".to_string();
                            for (i, session) in self.sessions.iter().enumerate() {
                                let is_active = if self.current_session.as_ref() == Some(session) {
                                    " (active)"
                                } else {
                                    ""
                                };
                                list.push_str(&format!("  {}. {}{}\n", i + 1, session, is_active));
                            }
                            list
                        };

                        let msg = TuiMessage {
                            id: uuid::Uuid::new_v4().to_string(),
                            role: "system".to_string(),
                            content: session_list,
                            timestamp: chrono::Utc::now(),
                            metadata: None,
                        };
                        self.messages.push(msg);
                    }
                    "switch" => {
                        if parts.len() < 3 {
                            let msg = TuiMessage {
                                id: uuid::Uuid::new_v4().to_string(),
                                role: "system".to_string(),
                                content: "Usage: /session switch <id>".to_string(),
                                timestamp: chrono::Utc::now(),
                                metadata: None,
                            };
                            self.messages.push(msg);
                            return Ok(());
                        }

                        let session_id = parts[2];
                        if self.sessions.iter().any(|s| s == session_id) {
                            self.current_session = Some(session_id.to_string());

                            let msg = TuiMessage {
                                id: uuid::Uuid::new_v4().to_string(),
                                role: "system".to_string(),
                                content: format!("Switched to session: {}", session_id),
                                timestamp: chrono::Utc::now(),
                                metadata: None,
                            };
                            self.messages.push(msg);
                        } else {
                            let msg = TuiMessage {
                                id: uuid::Uuid::new_v4().to_string(),
                                role: "system".to_string(),
                                content: format!("Session not found: {}", session_id),
                                timestamp: chrono::Utc::now(),
                                metadata: None,
                            };
                            self.messages.push(msg);
                        }
                    }
                    _ => {
                        let msg = TuiMessage {
                            id: uuid::Uuid::new_v4().to_string(),
                            role: "system".to_string(),
                            content: "Unknown session command. Use: create, list, or switch"
                                .to_string(),
                            timestamp: chrono::Utc::now(),
                            metadata: None,
                        };
                        self.messages.push(msg);
                    }
                }
            }
            "/agent" => {
                if parts.len() < 2 {
                    let msg = TuiMessage {
                        id: uuid::Uuid::new_v4().to_string(),
                        role: "system".to_string(),
                        content: "Usage: /agent list | switch <name>".to_string(),
                        timestamp: chrono::Utc::now(),
                        metadata: None,
                    };
                    self.messages.push(msg);
                    return Ok(());
                }

                match parts[1] {
                    "list" => {
                        let agent_list = if self.agents.is_empty() {
                            "No agents available".to_string()
                        } else {
                            let mut list = "Available agents:\n".to_string();
                            for (i, agent) in self.agents.iter().enumerate() {
                                let is_active = if self.current_agent.as_ref() == Some(agent) {
                                    " (active)"
                                } else {
                                    ""
                                };
                                list.push_str(&format!("  {}. {}{}\n", i + 1, agent, is_active));
                            }
                            list
                        };

                        let msg = TuiMessage {
                            id: uuid::Uuid::new_v4().to_string(),
                            role: "system".to_string(),
                            content: agent_list,
                            timestamp: chrono::Utc::now(),
                            metadata: None,
                        };
                        self.messages.push(msg);
                    }
                    "switch" => {
                        if parts.len() < 3 {
                            let msg = TuiMessage {
                                id: uuid::Uuid::new_v4().to_string(),
                                role: "system".to_string(),
                                content: "Usage: /agent switch <name>".to_string(),
                                timestamp: chrono::Utc::now(),
                                metadata: None,
                            };
                            self.messages.push(msg);
                            return Ok(());
                        }

                        let agent_name = parts[2];
                        if self.agents.iter().any(|a| a == agent_name) {
                            self.current_agent = Some(agent_name.to_string());

                            let msg = TuiMessage {
                                id: uuid::Uuid::new_v4().to_string(),
                                role: "system".to_string(),
                                content: format!("Switched to agent: {}", agent_name),
                                timestamp: chrono::Utc::now(),
                                metadata: None,
                            };
                            self.messages.push(msg);
                        } else {
                            let msg = TuiMessage {
                                id: uuid::Uuid::new_v4().to_string(),
                                role: "system".to_string(),
                                content: format!("Agent not found: {}", agent_name),
                                timestamp: chrono::Utc::now(),
                                metadata: None,
                            };
                            self.messages.push(msg);
                        }
                    }
                    _ => {
                        let msg = TuiMessage {
                            id: uuid::Uuid::new_v4().to_string(),
                            role: "system".to_string(),
                            content: "Unknown agent command. Use: list or switch".to_string(),
                            timestamp: chrono::Utc::now(),
                            metadata: None,
                        };
                        self.messages.push(msg);
                    }
                }
            }
            "/tool" => {
                if parts.len() < 2 {
                    let msg = TuiMessage {
                        id: uuid::Uuid::new_v4().to_string(),
                        role: "system".to_string(),
                        content: "Usage: /tool list | exec <name>".to_string(),
                        timestamp: chrono::Utc::now(),
                        metadata: None,
                    };
                    self.messages.push(msg);
                    return Ok(());
                }

                match parts[1] {
                    "list" => {
                        let tool_list = "Available tools:\n  1. bash - Execute bash commands\n  2. fs - File system operations\n  3. git - Git operations\n  4. docker - Docker operations\n  5. kubectl - Kubernetes operations\n  6. skill - Skill execution\n  7. memory - Vector memory operations";

                        let msg = TuiMessage {
                            id: uuid::Uuid::new_v4().to_string(),
                            role: "system".to_string(),
                            content: tool_list.to_string(),
                            timestamp: chrono::Utc::now(),
                            metadata: None,
                        };
                        self.messages.push(msg);
                    }
                    "exec" => {
                        if parts.len() < 3 {
                            let msg = TuiMessage {
                                id: uuid::Uuid::new_v4().to_string(),
                                role: "system".to_string(),
                                content: "Usage: /tool exec <name> [args...]".to_string(),
                                timestamp: chrono::Utc::now(),
                                metadata: None,
                            };
                            self.messages.push(msg);
                            return Ok(());
                        }

                        let tool_name = parts[2];
                        let args = if parts.len() > 3 {
                            parts[3..].join(" ")
                        } else {
                            "".to_string()
                        };

                        // In a real implementation, this would execute the tool
                        let msg = TuiMessage {
                            id: uuid::Uuid::new_v4().to_string(),
                            role: "system".to_string(),
                            content: format!("Executing tool: {} with args: {}", tool_name, args),
                            timestamp: chrono::Utc::now(),
                            metadata: None,
                        };
                        self.messages.push(msg);
                    }
                    _ => {
                        let msg = TuiMessage {
                            id: uuid::Uuid::new_v4().to_string(),
                            role: "system".to_string(),
                            content: "Unknown tool command. Use: list or exec".to_string(),
                            timestamp: chrono::Utc::now(),
                            metadata: None,
                        };
                        self.messages.push(msg);
                    }
                }
            }
            "/tab" => {
                if parts.len() < 2 {
                    let msg = TuiMessage {
                        id: uuid::Uuid::new_v4().to_string(),
                        role: "system".to_string(),
                        content: "Usage: /tab <name> (chat, agents, sessions, tools, settings)"
                            .to_string(),
                        timestamp: chrono::Utc::now(),
                        metadata: None,
                    };
                    self.messages.push(msg);
                    return Ok(());
                }

                match parts[1] {
                    "chat" => self.active_tab = TuiTab::Chat,
                    "agents" => self.active_tab = TuiTab::Agents,
                    "sessions" => self.active_tab = TuiTab::Sessions,
                    "tools" => self.active_tab = TuiTab::Tools,
                    "settings" => self.active_tab = TuiTab::Settings,
                    _ => {
                        let msg = TuiMessage {
                            id: uuid::Uuid::new_v4().to_string(),
                            role: "system".to_string(),
                            content: "Invalid tab. Use: chat, agents, sessions, tools, or settings"
                                .to_string(),
                            timestamp: chrono::Utc::now(),
                            metadata: None,
                        };
                        self.messages.push(msg);
                    }
                }
            }
            "/clear" => {
                self.messages.clear();
                let msg = TuiMessage {
                    id: uuid::Uuid::new_v4().to_string(),
                    role: "system".to_string(),
                    content: "Chat cleared".to_string(),
                    timestamp: chrono::Utc::now(),
                    metadata: None,
                };
                self.messages.push(msg);
            }
            "/quit" | "/exit" => {
                return Err(TuiError::Quit);
            }
            _ => {
                let msg = TuiMessage {
                    id: uuid::Uuid::new_v4().to_string(),
                    role: "system".to_string(),
                    content: format!(
                        "Unknown command: {}. Type /help for available commands.",
                        parts[0]
                    )
                    .to_string(),
                    timestamp: chrono::Utc::now(),
                    metadata: None,
                };
                self.messages.push(msg);
            }
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum TuiTab {
    #[default]
    Chat,
    Agents,
    Sessions,
    Tools,
    Settings,
}

/// TUI error
#[derive(Debug, thiserror::Error)]
pub enum TuiError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Quit signal")]
    Quit,
}

impl From<serde_json::Error> for TuiError {
    fn from(error: serde_json::Error) -> Self {
        TuiError::SerializationError(error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_tui_service_creation() {
        let service = TuiService::new();
        assert_eq!(service.active_tab, TuiTab::Chat);
        assert_eq!(service.messages.len(), 0);
        assert!(service.current_session.is_none());
        assert!(service.current_agent.is_none());
    }

    #[tokio::test]
    async fn test_process_help_command() {
        let mut service = TuiService::new();

        service.process_command("/help").await.unwrap();

        assert!(!service.messages.is_empty());
        let last_msg = service.messages.last().unwrap();
        assert!(last_msg.content.contains("Available commands"));
        assert_eq!(last_msg.role, "system");
    }

    #[tokio::test]
    async fn test_session_commands() {
        let mut service = TuiService::new();

        // Test session create
        service
            .process_command("/session create test-session")
            .await
            .unwrap();
        assert!(service.current_session.as_ref().unwrap() == "test-session");
        assert!(service.sessions.contains(&"test-session".to_string()));

        // Test session list
        service.process_command("/session list").await.unwrap();
        let list_msg = service.messages.last().unwrap();
        assert!(list_msg.content.contains("test-session"));

        // Test session switch
        service
            .process_command("/session switch test-session")
            .await
            .unwrap();
        assert!(service.current_session.as_ref().unwrap() == "test-session");
    }

    #[tokio::test]
    async fn test_agent_commands() {
        let mut service = TuiService::new();

        // Add an agent for testing
        service.agents.push("test-agent".to_string());

        // Test agent list
        service.process_command("/agent list").await.unwrap();
        let list_msg = service.messages.last().unwrap();
        assert!(list_msg.content.contains("test-agent"));

        // Test agent switch
        service
            .process_command("/agent switch test-agent")
            .await
            .unwrap();
        assert!(service.current_agent.as_ref().unwrap() == "test-agent");
    }

    #[tokio::test]
    async fn test_tool_commands() {
        let mut service = TuiService::new();

        // Test tool list
        service.process_command("/tool list").await.unwrap();
        let list_msg = service.messages.last().unwrap();
        assert!(list_msg.content.contains("bash"));
        assert!(list_msg.content.contains("docker"));
    }

    #[tokio::test]
    async fn test_tab_commands() {
        let mut service = TuiService::new();
        assert_eq!(service.active_tab, TuiTab::Chat);

        service.process_command("/tab agents").await.unwrap();
        assert_eq!(service.active_tab, TuiTab::Agents);

        service.process_command("/tab sessions").await.unwrap();
        assert_eq!(service.active_tab, TuiTab::Sessions);

        service.process_command("/tab tools").await.unwrap();
        assert_eq!(service.active_tab, TuiTab::Tools);

        service.process_command("/tab settings").await.unwrap();
        assert_eq!(service.active_tab, TuiTab::Settings);

        service.process_command("/tab chat").await.unwrap();
        assert_eq!(service.active_tab, TuiTab::Chat);
    }

    #[tokio::test]
    async fn test_clear_command() {
        let mut service = TuiService::new();

        // Add a message
        service.messages.push(TuiMessage {
            id: uuid::Uuid::new_v4().to_string(),
            role: "user".to_string(),
            content: "test message".to_string(),
            timestamp: chrono::Utc::now(),
            metadata: None,
        });
        assert_eq!(service.messages.len(), 1);

        // Clear messages
        service.process_command("/clear").await.unwrap();
        assert_eq!(service.messages.len(), 1); // Should have 1 message (the "Chat cleared" system message)

        let clear_msg = service.messages.last().unwrap();
        assert!(clear_msg.content.contains("cleared"));
    }

    #[test]
    fn test_tui_tab_default() {
        let tab: TuiTab = Default::default();
        assert_eq!(tab, TuiTab::Chat);
    }
}

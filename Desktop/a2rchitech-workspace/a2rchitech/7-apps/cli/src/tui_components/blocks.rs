//! Blocks/cell-based UI component for chat display
//!
//! Features:
//! - Each command/response is a block
//! - Block actions (copy, rerun, delete)
//! - Collapsible blocks
//! - Block navigation
//! - Visual separation between blocks

use ratatui::{
    layout::{Constraint, Direction, Layout, Margin, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, Paragraph, Widget, Wrap},
    Frame,
};

/// Block type representing different kinds of content
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BlockType {
    UserInput,
    AssistantResponse,
    SystemMessage,
    ErrorMessage,
    ToolOutput,
}

impl BlockType {
    pub fn icon(&self) -> &'static str {
        match self {
            BlockType::UserInput => "▸",
            BlockType::AssistantResponse => "◆",
            BlockType::SystemMessage => "●",
            BlockType::ErrorMessage => "✗",
            BlockType::ToolOutput => "⚙",
        }
    }

    pub fn color(&self) -> Color {
        match self {
            BlockType::UserInput => Color::Rgb(140, 200, 255),      // Blue
            BlockType::AssistantResponse => Color::Rgb(152, 195, 121), // Green
            BlockType::SystemMessage => Color::Rgb(246, 196, 83),   // Yellow
            BlockType::ErrorMessage => Color::Rgb(224, 108, 117),   // Red
            BlockType::ToolOutput => Color::Rgb(198, 120, 221),     // Purple
        }
    }

    pub fn border_color(&self) -> Color {
        match self {
            BlockType::UserInput => Color::Rgb(60, 70, 90),
            BlockType::AssistantResponse => Color::Rgb(60, 80, 70),
            BlockType::SystemMessage => Color::Rgb(80, 75, 60),
            BlockType::ErrorMessage => Color::Rgb(80, 50, 50),
            BlockType::ToolOutput => Color::Rgb(70, 60, 80),
        }
    }
}

/// A single block/cell in the UI
#[derive(Debug, Clone)]
pub struct Cell {
    pub id: usize,
    pub block_type: BlockType,
    pub content: String,
    pub timestamp: Option<String>,
    pub collapsed: bool,
    pub selected: bool,
    pub metadata: Option<String>,
}

impl Cell {
    pub fn new(id: usize, block_type: BlockType, content: impl Into<String>) -> Self {
        Self {
            id,
            block_type,
            content: content.into(),
            timestamp: None,
            collapsed: false,
            selected: false,
            metadata: None,
        }
    }

    pub fn with_timestamp(mut self, timestamp: impl Into<String>) -> Self {
        self.timestamp = Some(timestamp.into());
        self
    }

    pub fn with_metadata(mut self, metadata: impl Into<String>) -> Self {
        self.metadata = Some(metadata.into());
        self
    }

    pub fn toggle_collapsed(&mut self) {
        self.collapsed = !self.collapsed;
    }

    pub fn set_selected(&mut self, selected: bool) {
        self.selected = selected;
    }

    /// Get the content lines for display
    pub fn display_lines(&self, max_lines: Option<usize>) -> Vec<Line> {
        if self.collapsed {
            let preview = self.content.lines().next().unwrap_or("");
            let preview = if preview.len() > 80 {
                format!("{}...", &preview[..77])
            } else {
                preview.to_string()
            };
            vec![Line::styled(
                preview,
                Style::default().fg(Color::Rgb(150, 150, 150)),
            )]
        } else {
            let lines: Vec<Line> = self
                .content
                .lines()
                .map(|line| Line::raw(line.to_string()))
                .collect();

            if let Some(max) = max_lines {
                if lines.len() > max {
                    let mut truncated: Vec<Line> = lines.into_iter().take(max).collect();
                    truncated.push(Line::styled(
                        format!("... ({} more lines)", self.content.lines().count() - max),
                        Style::default().fg(Color::Rgb(100, 100, 100)),
                    ));
                    return truncated;
                }
            }
            lines
        }
    }
}

/// Block manager for handling cells
#[derive(Debug, Clone)]
pub struct BlockManager {
    cells: Vec<Cell>,
    selected_index: Option<usize>,
    scroll_offset: usize,
    show_line_numbers: bool,
}

impl Default for BlockManager {
    fn default() -> Self {
        Self::new()
    }
}

impl BlockManager {
    pub fn new() -> Self {
        Self {
            cells: Vec::new(),
            selected_index: None,
            scroll_offset: 0,
            show_line_numbers: false,
        }
    }

    /// Add a new cell
    pub fn add_cell(&mut self, block_type: BlockType, content: impl Into<String>) -> usize {
        let id = self.cells.len();
        let cell = Cell::new(id, block_type, content);
        self.cells.push(cell);
        id
    }

    /// Add a cell with full configuration
    pub fn add_cell_full(&mut self, cell: Cell) -> usize {
        let id = self.cells.len();
        let mut cell = cell;
        cell.id = id;
        self.cells.push(cell);
        id
    }

    /// Get a cell by ID
    pub fn get_cell(&self, id: usize) -> Option<&Cell> {
        self.cells.get(id)
    }

    /// Get a mutable cell by ID
    pub fn get_cell_mut(&mut self, id: usize) -> Option<&mut Cell> {
        self.cells.get_mut(id)
    }

    /// Get the currently selected cell
    pub fn selected_cell(&self) -> Option<&Cell> {
        self.selected_index.and_then(|idx| self.cells.get(idx))
    }

    /// Get mutable selected cell
    pub fn selected_cell_mut(&mut self) -> Option<&mut Cell> {
        self.selected_index.and_then(|idx| self.cells.get_mut(idx))
    }

    /// Select next cell
    pub fn select_next(&mut self) {
        if let Some(idx) = self.selected_index {
            if idx + 1 < self.cells.len() {
                self.set_selected(idx + 1);
            }
        } else if !self.cells.is_empty() {
            self.set_selected(0);
        }
    }

    /// Select previous cell
    pub fn select_prev(&mut self) {
        if let Some(idx) = self.selected_index {
            if idx > 0 {
                self.set_selected(idx - 1);
            }
        }
    }

    /// Set selected cell by index
    pub fn set_selected(&mut self, index: usize) {
        // Clear previous selection
        if let Some(prev) = self.selected_index {
            if let Some(cell) = self.cells.get_mut(prev) {
                cell.set_selected(false);
            }
        }

        // Set new selection
        if index < self.cells.len() {
            self.selected_index = Some(index);
            if let Some(cell) = self.cells.get_mut(index) {
                cell.set_selected(true);
            }
        }
    }

    /// Clear selection
    pub fn clear_selection(&mut self) {
        if let Some(prev) = self.selected_index {
            if let Some(cell) = self.cells.get_mut(prev) {
                cell.set_selected(false);
            }
        }
        self.selected_index = None;
    }

    /// Toggle collapse on selected cell
    pub fn toggle_selected_collapsed(&mut self) {
        if let Some(cell) = self.selected_cell_mut() {
            cell.toggle_collapsed();
        }
    }

    /// Delete selected cell
    pub fn delete_selected(&mut self) {
        if let Some(idx) = self.selected_index {
            self.cells.remove(idx);
            // Update IDs
            for (i, cell) in self.cells.iter_mut().enumerate().skip(idx) {
                cell.id = i;
            }
            // Adjust selection
            if idx >= self.cells.len() && !self.cells.is_empty() {
                self.set_selected(self.cells.len() - 1);
            } else if !self.cells.is_empty() {
                self.set_selected(idx);
            } else {
                self.selected_index = None;
            }
        }
    }

    /// Get all cells
    pub fn cells(&self) -> &[Cell] {
        &self.cells
    }

    /// Get cell count
    pub fn len(&self) -> usize {
        self.cells.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.cells.is_empty()
    }

    /// Clear all cells
    pub fn clear(&mut self) {
        self.cells.clear();
        self.selected_index = None;
    }

    /// Copy selected cell content to clipboard
    pub fn copy_selected(&self) -> Option<String> {
        self.selected_cell().map(|cell| cell.content.clone())
    }

    /// Scroll down
    pub fn scroll_down(&mut self, lines: usize) {
        self.scroll_offset += lines;
    }

    /// Scroll up
    pub fn scroll_up(&mut self, lines: usize) {
        self.scroll_offset = self.scroll_offset.saturating_sub(lines);
    }

    /// Render the block manager
    pub fn render(&self, frame: &mut Frame, area: Rect) {
        if self.cells.is_empty() {
            let block = Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Rgb(60, 65, 75)))
                .title(" Chat ");
            frame.render_widget(
                Paragraph::new("No messages yet. Type a message to start.").block(block),
                area,
            );
            return;
        }

        let constraints: Vec<Constraint> = self
            .cells
            .iter()
            .map(|cell| {
                if cell.collapsed {
                    Constraint::Length(3)
                } else {
                    let line_count = cell.content.lines().count().min(20) + 2;
                    Constraint::Length(line_count as u16)
                }
            })
            .collect();

        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints(constraints)
            .margin(1)
            .split(area);

        for (i, (cell, chunk)) in self.cells.iter().zip(chunks.iter()).enumerate() {
            self.render_cell(frame, cell, *chunk);
        }
    }

    /// Render a single cell
    fn render_cell(&self, frame: &mut Frame, cell: &Cell, area: Rect) {
        let icon = cell.block_type.icon();
        let color = cell.block_type.color();
        let border_color = if cell.selected {
            color
        } else {
            cell.block_type.border_color()
        };

        let title = format!(
            " {} {} ",
            icon,
            if cell.collapsed { "[collapsed]" } else { "" }
        );

        let block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(border_color))
            .title(title)
            .title_style(Style::default().fg(color).add_modifier(Modifier::BOLD));

        let inner = block.inner(area);
        frame.render_widget(block, area);

        // Render content
        let lines = cell.display_lines(Some(20));
        let paragraph = Paragraph::new(Text::from(lines))
            .wrap(Wrap { trim: true })
            .style(Style::default().fg(Color::Rgb(232, 227, 213)));

        frame.render_widget(paragraph, inner);
    }

    /// Get help text for block navigation
    pub fn help_text() -> &'static str {
        "j/k: navigate | space: toggle | c: copy | d: delete | [: collapse | ]: expand"
    }
}

/// Block action for key handling
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BlockAction {
    NavigateNext,
    NavigatePrev,
    ToggleCollapse,
    Copy,
    Delete,
    ExpandAll,
    CollapseAll,
    None,
}

impl BlockAction {
    pub fn from_key(key: char) -> Self {
        match key {
            'j' | '\n' => BlockAction::NavigateNext,
            'k' => BlockAction::NavigatePrev,
            ' ' => BlockAction::ToggleCollapse,
            'c' => BlockAction::Copy,
            'd' => BlockAction::Delete,
            '[' => BlockAction::CollapseAll,
            ']' => BlockAction::ExpandAll,
            _ => BlockAction::None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_cell() {
        let mut manager = BlockManager::new();
        let id = manager.add_cell(BlockType::UserInput, "Hello");
        assert_eq!(id, 0);
        assert_eq!(manager.len(), 1);
    }

    #[test]
    fn test_selection() {
        let mut manager = BlockManager::new();
        manager.add_cell(BlockType::UserInput, "First");
        manager.add_cell(BlockType::UserInput, "Second");
        manager.add_cell(BlockType::UserInput, "Third");

        manager.set_selected(1);
        assert!(manager.cells[1].selected);
        assert!(!manager.cells[0].selected);

        manager.select_next();
        assert!(manager.cells[2].selected);

        manager.select_prev();
        assert!(manager.cells[1].selected);
    }

    #[test]
    fn test_collapse() {
        let mut manager = BlockManager::new();
        let id = manager.add_cell(BlockType::UserInput, "Line 1\nLine 2\nLine 3");
        
        manager.set_selected(0);
        assert!(!manager.cells[0].collapsed);
        
        manager.toggle_selected_collapsed();
        assert!(manager.cells[0].collapsed);
        
        // Check display lines when collapsed
        let lines = manager.cells[0].display_lines(None);
        assert_eq!(lines.len(), 1);
    }

    #[test]
    fn test_delete() {
        let mut manager = BlockManager::new();
        manager.add_cell(BlockType::UserInput, "First");
        manager.add_cell(BlockType::UserInput, "Second");
        manager.add_cell(BlockType::UserInput, "Third");

        manager.set_selected(1);
        manager.delete_selected();

        assert_eq!(manager.len(), 2);
        assert_eq!(manager.cells[0].content, "First");
        assert_eq!(manager.cells[1].content, "Third"); // Shifted up
    }

    #[test]
    fn test_block_type_colors() {
        assert_eq!(BlockType::UserInput.icon(), "▸");
        assert_eq!(BlockType::ErrorMessage.icon(), "✗");
        
        // Colors should be different
        let user_color = BlockType::UserInput.color();
        let error_color = BlockType::ErrorMessage.color();
        assert_ne!(user_color, error_color);
    }

    #[test]
    fn test_block_action_from_key() {
        assert_eq!(BlockAction::from_key('j'), BlockAction::NavigateNext);
        assert_eq!(BlockAction::from_key('k'), BlockAction::NavigatePrev);
        assert_eq!(BlockAction::from_key(' '), BlockAction::ToggleCollapse);
        assert_eq!(BlockAction::from_key('c'), BlockAction::Copy);
        assert_eq!(BlockAction::from_key('x'), BlockAction::None);
    }
}

//! Multi-line text input component with IDE-like editing
//!
//! Features:
//! - Multi-line text editing
//! - Cursor movement (arrows, home/end, word jump)
//! - Text selection and clipboard operations
//! - Vim/Emacs key bindings
//! - Syntax highlighting support

use ratatui::{
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Paragraph, Widget},
};

/// Input editing mode
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputMode {
    /// Normal mode (vim-style)
    Normal,
    /// Insert mode
    Insert,
    /// Visual selection mode
    Visual,
}

impl InputMode {
    pub fn to_string(&self) -> &'static str {
        match self {
            InputMode::Normal => "NORMAL",
            InputMode::Insert => "INSERT",
            InputMode::Visual => "VISUAL",
        }
    }
}

/// Text selection range
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Selection {
    pub start_line: usize,
    pub start_col: usize,
    pub end_line: usize,
    pub end_col: usize,
}

impl Selection {
    /// Check if a position is within the selection
    pub fn contains(&self, line: usize, col: usize) -> bool {
        let (start_line, start_col, end_line, end_col) = self.normalized();
        
        if line < start_line || line > end_line {
            return false;
        }
        
        if line == start_line && col < start_col {
            return false;
        }
        
        if line == end_line && col > end_col {
            return false;
        }
        
        true
    }
    
    /// Get normalized (ordered) selection coordinates
    fn normalized(&self) -> (usize, usize, usize, usize) {
        if self.start_line < self.end_line {
            (self.start_line, self.start_col, self.end_line, self.end_col)
        } else if self.start_line > self.end_line {
            (self.end_line, self.end_col, self.start_line, self.start_col)
        } else {
            // Same line
            if self.start_col <= self.end_col {
                (self.start_line, self.start_col, self.end_line, self.end_col)
            } else {
                (self.end_line, self.end_col, self.start_line, self.start_col)
            }
        }
    }
}

/// Multi-line text input component
#[derive(Debug, Clone)]
pub struct MultiLineInput {
    /// Lines of text
    lines: Vec<String>,
    /// Cursor line position
    cursor_line: usize,
    /// Cursor column position
    cursor_col: usize,
    /// Current input mode
    mode: InputMode,
    /// Current selection (if any)
    selection: Option<Selection>,
    /// Selection anchor for visual mode
    selection_anchor: Option<(usize, usize)>,
    /// Maximum number of lines allowed
    max_lines: Option<usize>,
    /// Maximum characters per line
    max_line_length: Option<usize>,
    /// Show line numbers
    show_line_numbers: bool,
    /// Tab size (in spaces)
    tab_size: usize,
    /// Use spaces instead of tabs
    use_spaces: bool,
}

impl Default for MultiLineInput {
    fn default() -> Self {
        Self::new()
    }
}

impl MultiLineInput {
    /// Create a new empty multi-line input
    pub fn new() -> Self {
        Self {
            lines: vec![String::new()],
            cursor_line: 0,
            cursor_col: 0,
            mode: InputMode::Insert,
            selection: None,
            selection_anchor: None,
            max_lines: None,
            max_line_length: None,
            show_line_numbers: false,
            tab_size: 2,
            use_spaces: true,
        }
    }
    
    /// Create with initial content
    pub fn with_content(content: impl Into<String>) -> Self {
        let content = content.into();
        let lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
        let lines = if lines.is_empty() {
            vec![String::new()]
        } else {
            lines
        };
        
        Self {
            lines,
            cursor_line: 0,
            cursor_col: 0,
            mode: InputMode::Insert,
            selection: None,
            selection_anchor: None,
            max_lines: None,
            max_line_length: None,
            show_line_numbers: false,
            tab_size: 2,
            use_spaces: true,
        }
    }
    
    /// Get the full text content
    pub fn content(&self) -> String {
        self.lines.join("\n")
    }
    
    /// Get the content as a single line (for single-line mode compatibility)
    pub fn single_line_content(&self) -> String {
        self.lines.join(" ").replace('\n', " ")
    }
    
    /// Check if content is empty
    pub fn is_empty(&self) -> bool {
        self.lines.len() == 1 && self.lines[0].is_empty()
    }
    
    /// Get current line count
    pub fn line_count(&self) -> usize {
        self.lines.len()
    }
    
    /// Get current cursor position
    pub fn cursor_position(&self) -> (usize, usize) {
        (self.cursor_line, self.cursor_col)
    }
    
    /// Get current mode
    pub fn mode(&self) -> InputMode {
        self.mode
    }
    
    /// Set input mode
    pub fn set_mode(&mut self, mode: InputMode) {
        self.mode = mode;
        if mode != InputMode::Visual {
            self.selection = None;
            self.selection_anchor = None;
        }
    }
    
    /// Toggle between normal and insert mode
    pub fn toggle_mode(&mut self) {
        self.mode = match self.mode {
            InputMode::Normal => InputMode::Insert,
            InputMode::Insert => InputMode::Normal,
            InputMode::Visual => InputMode::Normal,
        };
        if self.mode != InputMode::Visual {
            self.selection = None;
            self.selection_anchor = None;
        }
    }
    
    /// Clear all content
    pub fn clear(&mut self) {
        self.lines = vec![String::new()];
        self.cursor_line = 0;
        self.cursor_col = 0;
        self.selection = None;
        self.selection_anchor = None;
    }
    
    /// Insert a character at cursor position
    pub fn insert_char(&mut self, ch: char) {
        match ch {
            '\n' => self.insert_newline(),
            '\t' => self.insert_tab(),
            _ => {
                let line = &mut self.lines[self.cursor_line];
                if let Some(max_len) = self.max_line_length {
                    if line.len() >= max_len {
                        return;
                    }
                }
                
                if self.cursor_col > line.len() {
                    self.cursor_col = line.len();
                }
                line.insert(self.cursor_col, ch);
                self.cursor_col += 1;
            }
        }
        
        // Clear selection on edit
        if self.mode != InputMode::Visual {
            self.selection = None;
        }
    }
    
    /// Insert a string at cursor position
    pub fn insert_str(&mut self, s: &str) {
        for ch in s.chars() {
            self.insert_char(ch);
        }
    }
    
    /// Insert a newline (Enter key)
    fn insert_newline(&mut self) {
        if let Some(max) = self.max_lines {
            if self.lines.len() >= max {
                return;
            }
        }
        
        let line = &mut self.lines[self.cursor_line];
        let remainder: String = line.split_off(self.cursor_col);
        self.cursor_line += 1;
        self.cursor_col = 0;
        self.lines.insert(self.cursor_line, remainder);
    }
    
    /// Insert tab (or spaces)
    fn insert_tab(&mut self) {
        if self.use_spaces {
            for _ in 0..self.tab_size {
                self.insert_char(' ');
            }
        } else {
            self.insert_char('\t');
        }
    }
    
    /// Delete character before cursor (Backspace)
    pub fn backspace(&mut self) {
        if self.cursor_col > 0 {
            let line = &mut self.lines[self.cursor_line];
            line.remove(self.cursor_col - 1);
            self.cursor_col -= 1;
        } else if self.cursor_line > 0 {
            // Merge with previous line
            let current = self.lines.remove(self.cursor_line);
            self.cursor_line -= 1;
            self.cursor_col = self.lines[self.cursor_line].len();
            self.lines[self.cursor_line].push_str(&current);
        }
        self.selection = None;
    }
    
    /// Delete character at cursor (Delete key)
    pub fn delete_char(&mut self) {
        let line = &self.lines[self.cursor_line];
        if self.cursor_col < line.len() {
            self.lines[self.cursor_line].remove(self.cursor_col);
        } else if self.cursor_line + 1 < self.lines.len() {
            // Merge with next line
            let next = self.lines.remove(self.cursor_line + 1);
            self.lines[self.cursor_line].push_str(&next);
        }
        self.selection = None;
    }
    
    /// Delete from cursor to end of line
    pub fn delete_to_end(&mut self) {
        self.lines[self.cursor_line].truncate(self.cursor_col);
        self.selection = None;
    }
    
    /// Delete from cursor to start of line
    pub fn delete_to_start(&mut self) {
        self.lines[self.cursor_line].drain(0..self.cursor_col);
        self.cursor_col = 0;
        self.selection = None;
    }
    
    /// Delete current line
    pub fn delete_line(&mut self) {
        if self.lines.len() > 1 {
            self.lines.remove(self.cursor_line);
            if self.cursor_line >= self.lines.len() {
                self.cursor_line = self.lines.len() - 1;
            }
            self.cursor_col = self.cursor_col.min(self.lines[self.cursor_line].len());
        } else {
            self.lines[0].clear();
            self.cursor_col = 0;
        }
        self.selection = None;
    }
    
    /// Move cursor up
    pub fn move_up(&mut self, n: usize) {
        self.cursor_line = self.cursor_line.saturating_sub(n);
        self.clamp_cursor_col();
        self.update_selection();
    }
    
    /// Move cursor down
    pub fn move_down(&mut self, n: usize) {
        self.cursor_line = (self.cursor_line + n).min(self.lines.len() - 1);
        self.clamp_cursor_col();
        self.update_selection();
    }
    
    /// Move cursor left
    pub fn move_left(&mut self, n: usize) {
        for _ in 0..n {
            if self.cursor_col > 0 {
                self.cursor_col -= 1;
            } else if self.cursor_line > 0 {
                self.cursor_line -= 1;
                self.cursor_col = self.lines[self.cursor_line].len();
            }
        }
        self.update_selection();
    }
    
    /// Move cursor right
    pub fn move_right(&mut self, n: usize) {
        for _ in 0..n {
            let line_len = self.lines[self.cursor_line].len();
            if self.cursor_col < line_len {
                self.cursor_col += 1;
            } else if self.cursor_line + 1 < self.lines.len() {
                self.cursor_line += 1;
                self.cursor_col = 0;
            }
        }
        self.update_selection();
    }
    
    /// Move cursor to start of line
    pub fn move_to_start(&mut self) {
        self.cursor_col = 0;
        self.update_selection();
    }
    
    /// Move cursor to end of line
    pub fn move_to_end(&mut self) {
        self.cursor_col = self.lines[self.cursor_line].len();
        self.update_selection();
    }
    
    /// Move cursor to start of content
    pub fn move_to_top(&mut self) {
        self.cursor_line = 0;
        self.cursor_col = 0;
        self.update_selection();
    }
    
    /// Move cursor to end of content
    pub fn move_to_bottom(&mut self) {
        self.cursor_line = self.lines.len() - 1;
        self.cursor_col = self.lines[self.cursor_line].len();
        self.update_selection();
    }
    
    /// Move cursor to previous word
    pub fn move_word_left(&mut self) {
        let line = &self.lines[self.cursor_line];
        let bytes = line.as_bytes();
        
        // Skip whitespace
        while self.cursor_col > 0 {
            let prev = self.cursor_col - 1;
            if !bytes[prev].is_ascii_whitespace() {
                break;
            }
            self.cursor_col = prev;
        }
        
        // Skip word characters
        while self.cursor_col > 0 {
            let prev = self.cursor_col - 1;
            if bytes[prev].is_ascii_whitespace() {
                break;
            }
            self.cursor_col = prev;
        }
        
        self.update_selection();
    }
    
    /// Move cursor to next word
    pub fn move_word_right(&mut self) {
        let line = &self.lines[self.cursor_line];
        let bytes = line.as_bytes();
        
        // Skip word characters
        while self.cursor_col < bytes.len() {
            if bytes[self.cursor_col].is_ascii_whitespace() {
                break;
            }
            self.cursor_col += 1;
        }
        
        // Skip whitespace
        while self.cursor_col < bytes.len() {
            if !bytes[self.cursor_col].is_ascii_whitespace() {
                break;
            }
            self.cursor_col += 1;
        }
        
        self.update_selection();
    }
    
    /// Clamp cursor column to current line length
    fn clamp_cursor_col(&mut self) {
        let line_len = self.lines[self.cursor_line].len();
        if self.cursor_col > line_len {
            self.cursor_col = line_len;
        }
    }
    
    /// Update selection based on mode
    fn update_selection(&mut self) {
        if self.mode == InputMode::Visual {
            if let Some((anchor_line, anchor_col)) = self.selection_anchor {
                self.selection = Some(Selection {
                    start_line: anchor_line,
                    start_col: anchor_col,
                    end_line: self.cursor_line,
                    end_col: self.cursor_col,
                });
            }
        }
    }
    
    /// Start visual selection
    pub fn start_selection(&mut self) {
        self.mode = InputMode::Visual;
        self.selection_anchor = Some((self.cursor_line, self.cursor_col));
        self.selection = Some(Selection {
            start_line: self.cursor_line,
            start_col: self.cursor_col,
            end_line: self.cursor_line,
            end_col: self.cursor_col,
        });
    }
    
    /// Get selected text
    pub fn selected_text(&self) -> Option<String> {
        let sel = self.selection?;
        let (start_line, start_col, end_line, end_col) = sel.normalized();
        
        if start_line == end_line {
            let line = &self.lines[start_line];
            Some(line[start_col..end_col.min(line.len())].to_string())
        } else {
            let mut result = String::new();
            for line_idx in start_line..=end_line {
                let line = &self.lines[line_idx];
                if line_idx == start_line {
                    result.push_str(&line[start_col.min(line.len())..]);
                } else if line_idx == end_line {
                    result.push('\n');
                    result.push_str(&line[..end_col.min(line.len())]);
                } else {
                    result.push('\n');
                    result.push_str(line);
                }
            }
            Some(result)
        }
    }
    
    /// Delete selected text
    pub fn delete_selection(&mut self) {
        if let Some(sel) = self.selection {
            let (start_line, start_col, end_line, end_col) = sel.normalized();
            
            if start_line == end_line {
                let line = &mut self.lines[start_line];
                line.drain(start_col..end_col.min(line.len()));
                self.cursor_line = start_line;
                self.cursor_col = start_col;
            } else {
                // Get content from first line before selection
                let first_line_remainder = self.lines[start_line][..start_col.min(self.lines[start_line].len())].to_string();
                
                // Get content from last line after selection
                let last_line_remainder = if end_line < self.lines.len() {
                    self.lines[end_line][end_col.min(self.lines[end_line].len())..].to_string()
                } else {
                    String::new()
                };
                
                // Remove lines in between
                for _ in start_line..=end_line.min(self.lines.len() - 1) {
                    if self.lines.len() > 1 {
                        self.lines.remove(start_line);
                    }
                }
                
                // Insert merged line
                let merged = format!("{}{}", first_line_remainder, last_line_remainder);
                if self.lines.is_empty() {
                    self.lines.push(merged);
                } else {
                    self.lines.insert(start_line, merged);
                }
                
                self.cursor_line = start_line;
                self.cursor_col = first_line_remainder.len();
            }
            
            self.selection = None;
            self.selection_anchor = None;
            if self.mode == InputMode::Visual {
                self.mode = InputMode::Normal;
            }
        }
    }
    
    /// Render as ratatui widget
    pub fn render(&self) -> Paragraph<'_> {
        let lines: Vec<Line> = self.lines.iter().enumerate().map(|(idx, line)| {
            let mut spans = Vec::new();
            
            // Line number (if enabled)
            if self.show_line_numbers {
                spans.push(Span::styled(
                    format!("{:3} │ ", idx + 1),
                    Style::default().fg(Color::Rgb(100, 100, 100)),
                ));
            }
            
            // Line content with cursor
            if idx == self.cursor_line {
                let before = &line[..self.cursor_col.min(line.len())];
                let cursor_ch = line.chars().nth(self.cursor_col).unwrap_or(' ');
                let after = &line[self.cursor_col.min(line.len()) + 1..];
                
                spans.push(Span::raw(before));
                spans.push(Span::styled(
                    cursor_ch.to_string(),
                    Style::default()
                        .bg(Color::Rgb(246, 196, 83))
                        .fg(Color::Rgb(24, 27, 33))
                        .add_modifier(Modifier::BOLD),
                ));
                spans.push(Span::raw(after));
            } else {
                spans.push(Span::raw(line.as_str()));
            }
            
            Line::from(spans)
        }).collect();
        
        Paragraph::new(lines)
    }
    
    /// Get widget for rendering
    pub fn widget(&self) -> impl Widget + '_ {
        self.render()
    }
    
    // Convenience methods for TUI compatibility
    
    /// Check if content starts with a prefix
    pub fn starts_with(&self, prefix: &str) -> bool {
        self.content().starts_with(prefix)
    }
    
    /// Check if content ends with a suffix
    pub fn ends_with(&self, suffix: &str) -> bool {
        self.content().ends_with(suffix)
    }
    
    /// Get trimmed content
    pub fn trim(&self) -> String {
        self.content().trim().to_string()
    }
    
    /// Get trimmed content with start trim only
    pub fn trim_start(&self) -> String {
        self.content().trim_start().to_string()
    }
    
    /// Replace a range of text (for mention insertion)
    pub fn replace_range(&mut self, range: std::ops::Range<usize>, replacement: &str) {
        let content = self.content();
        if range.start > content.len() || range.end > content.len() {
            return;
        }
        let mut new_content = content[..range.start].to_string();
        new_content.push_str(replacement);
        new_content.push_str(&content[range.end..]);
        *self = Self::with_content(new_content);
    }
    
    /// Push a character to the end (compatibility)
    pub fn push(&mut self, ch: char) {
        // Move cursor to end first
        self.move_to_bottom();
        self.move_to_end();
        self.insert_char(ch);
    }
    
    /// Push a string to the end (compatibility)
    pub fn push_str(&mut self, s: &str) {
        // Move cursor to end first
        self.move_to_bottom();
        self.move_to_end();
        self.insert_str(s);
    }
    
    /// Pop last character (compatibility)
    pub fn pop(&mut self) -> Option<char> {
        self.move_to_bottom();
        self.move_to_end();
        let line = self.lines.last_mut()?;
        let ch = line.pop()?;
        if line.is_empty() && self.lines.len() > 1 {
            self.lines.pop();
            self.cursor_line = self.lines.len() - 1;
        }
        self.cursor_col = self.lines[self.cursor_line].len();
        Some(ch)
    }
    
    /// Take all content and clear (like std::mem::take for String)
    pub fn take_text(&mut self) -> String {
        let content = self.content();
        self.clear();
        content
    }
    
    /// Set text content
    pub fn set_text(&mut self, text: impl Into<String>) {
        *self = Self::with_content(text);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_new_input() {
        let input = MultiLineInput::new();
        assert_eq!(input.line_count(), 1);
        assert!(input.is_empty());
        assert_eq!(input.content(), "");
    }
    
    #[test]
    fn test_insert_text() {
        let mut input = MultiLineInput::new();
        input.insert_str("hello");
        assert_eq!(input.content(), "hello");
        assert_eq!(input.cursor_position(), (0, 5));
    }
    
    #[test]
    fn test_multi_line() {
        let mut input = MultiLineInput::new();
        input.insert_str("line1");
        input.insert_char('\n');
        input.insert_str("line2");
        assert_eq!(input.content(), "line1\nline2");
        assert_eq!(input.line_count(), 2);
    }
    
    #[test]
    fn test_cursor_movement() {
        let mut input = MultiLineInput::with_content("abc\ndef");
        input.move_to_start();
        assert_eq!(input.cursor_position(), (0, 0));
        
        // move_to_end moves to end of current line (line 0)
        input.move_to_end();
        assert_eq!(input.cursor_position(), (0, 3));
        
        // move_to_bottom moves to end of document
        input.move_to_bottom();
        assert_eq!(input.cursor_position(), (1, 3));
        
        input.move_up(1);
        assert_eq!(input.cursor_position(), (0, 3));
    }
    
    #[test]
    fn test_backspace_merge() {
        let mut input = MultiLineInput::with_content("hello\nworld");
        input.cursor_line = 1;
        input.cursor_col = 0;
        input.backspace();
        assert_eq!(input.content(), "helloworld");
    }
    
    #[test]
    fn test_selection() {
        let mut input = MultiLineInput::with_content("hello world");
        input.start_selection();
        input.move_word_right();
        // move_word_right skips word chars AND trailing whitespace, so "hello " is selected
        assert_eq!(input.selected_text(), Some("hello ".to_string()));
    }
}

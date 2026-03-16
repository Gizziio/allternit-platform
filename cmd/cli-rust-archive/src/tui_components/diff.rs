//! Diff viewer component for displaying AI-generated code changes
//!
//! Features:
//! - Side-by-side diff view
//! - Inline diff view
//! - Syntax highlighting
//! - Navigation between hunks
//! - Accept/Reject actions

use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Widget},
};

/// Type of diff line
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiffLineType {
    Context,
    Added,
    Removed,
    Header,
    HunkHeader,
}

/// A single line in a diff
#[derive(Debug, Clone)]
pub struct DiffLine {
    pub line_type: DiffLineType,
    pub content: String,
    pub old_line_num: Option<usize>,
    pub new_line_num: Option<usize>,
}

/// A hunk of changes in a diff
#[derive(Debug, Clone)]
pub struct DiffHunk {
    pub old_start: usize,
    pub old_lines: usize,
    pub new_start: usize,
    pub new_lines: usize,
    pub lines: Vec<DiffLine>,
}

/// A file diff
#[derive(Debug, Clone)]
pub struct FileDiff {
    pub old_path: String,
    pub new_path: String,
    pub hunks: Vec<DiffHunk>,
    pub is_new: bool,
    pub is_deleted: bool,
    pub is_binary: bool,
}

/// Diff viewer state
pub struct DiffViewer {
    pub files: Vec<FileDiff>,
    pub current_file: usize,
    pub current_hunk: usize,
    pub scroll_offset: usize,
    pub view_mode: DiffViewMode,
    pub syntax_highlighter: Option<crate::tui_components::SyntaxHighlighter>,
}

impl std::fmt::Debug for DiffViewer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DiffViewer")
            .field("files", &self.files)
            .field("current_file", &self.current_file)
            .field("current_hunk", &self.current_hunk)
            .field("scroll_offset", &self.scroll_offset)
            .field("view_mode", &self.view_mode)
            .field("syntax_highlighter", &"<SyntaxHighlighter>")
            .finish()
    }
}

impl Clone for DiffViewer {
    fn clone(&self) -> Self {
        Self {
            files: self.files.clone(),
            current_file: self.current_file,
            current_hunk: self.current_hunk,
            scroll_offset: self.scroll_offset,
            view_mode: self.view_mode,
            syntax_highlighter: None, // Don't clone the highlighter, create new one
        }
    }
}

/// Diff display mode
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiffViewMode {
    SideBySide,
    Inline,
}

impl Default for DiffViewer {
    fn default() -> Self {
        Self::new()
    }
}

impl DiffViewer {
    /// Create a new empty diff viewer
    pub fn new() -> Self {
        Self {
            files: Vec::new(),
            current_file: 0,
            current_hunk: 0,
            scroll_offset: 0,
            view_mode: DiffViewMode::Inline,
            syntax_highlighter: Some(crate::tui_components::SyntaxHighlighter::new()),
        }
    }

    /// Load diff from unified diff format string
    pub fn load_from_unified_diff(&mut self, diff_text: &str) {
        self.files = parse_unified_diff(diff_text);
        self.current_file = 0;
        self.current_hunk = 0;
        self.scroll_offset = 0;
    }

    /// Load diff from old and new content
    pub fn load_from_content(&mut self, old_content: &str, new_content: &str, path: &str) {
        let diff = generate_inline_diff(old_content, new_content, path);
        self.files = vec![diff];
        self.current_file = 0;
        self.current_hunk = 0;
        self.scroll_offset = 0;
    }

    /// Check if there are any changes to display
    pub fn has_changes(&self) -> bool {
        !self.files.is_empty() && self.files.iter().any(|f| !f.hunks.is_empty())
    }

    /// Get current file diff
    pub fn current_file(&self) -> Option<&FileDiff> {
        self.files.get(self.current_file)
    }

    /// Navigate to next hunk
    pub fn next_hunk(&mut self) {
        if let Some(file) = self.current_file() {
            if self.current_hunk + 1 < file.hunks.len() {
                self.current_hunk += 1;
            } else if self.current_file + 1 < self.files.len() {
                self.current_file += 1;
                self.current_hunk = 0;
            }
        }
    }

    /// Navigate to previous hunk
    pub fn prev_hunk(&mut self) {
        if self.current_hunk > 0 {
            self.current_hunk -= 1;
        } else if self.current_file > 0 {
            self.current_file -= 1;
            if let Some(file) = self.files.get(self.current_file) {
                self.current_hunk = file.hunks.len().saturating_sub(1);
            }
        }
    }

    /// Navigate to next file
    pub fn next_file(&mut self) {
        if self.current_file + 1 < self.files.len() {
            self.current_file += 1;
            self.current_hunk = 0;
        }
    }

    /// Navigate to previous file
    pub fn prev_file(&mut self) {
        if self.current_file > 0 {
            self.current_file -= 1;
            self.current_hunk = 0;
        }
    }

    /// Scroll down
    pub fn scroll_down(&mut self, lines: usize) {
        self.scroll_offset += lines;
    }

    /// Scroll up
    pub fn scroll_up(&mut self, lines: usize) {
        self.scroll_offset = self.scroll_offset.saturating_sub(lines);
    }

    /// Toggle view mode
    pub fn toggle_view_mode(&mut self) {
        self.view_mode = match self.view_mode {
            DiffViewMode::SideBySide => DiffViewMode::Inline,
            DiffViewMode::Inline => DiffViewMode::SideBySide,
        };
    }

    /// Get summary of changes
    pub fn summary(&self) -> String {
        let total_files = self.files.len();
        let total_additions: usize = self
            .files
            .iter()
            .map(|f| {
                f.hunks
                    .iter()
                    .map(|h| h.lines.iter().filter(|l| l.line_type == DiffLineType::Added).count())
                    .sum::<usize>()
            })
            .sum();
        let total_deletions: usize = self
            .files
            .iter()
            .map(|f| {
                f.hunks
                    .iter()
                    .map(|h| h.lines.iter().filter(|l| l.line_type == DiffLineType::Removed).count())
                    .sum::<usize>()
            })
            .sum();

        format!(
            "{} file{} changed, +{} -{}",
            total_files,
            if total_files == 1 { "" } else { "s" },
            total_additions,
            total_deletions
        )
    }

    /// Render the diff viewer
    pub fn render(&self, area: Rect) -> impl Widget + '_ {
        let block = Block::default()
            .borders(Borders::ALL)
            .title(format!(
                " Diff: {} ({}/{}) ",
                self.summary(),
                self.current_file + 1,
                self.files.len()
            ))
            .border_style(Style::default().fg(Color::Rgb(246, 196, 83)));

        if !self.has_changes() {
            return Paragraph::new("No changes to display").block(block);
        }

        let file = match self.files.get(self.current_file) {
            Some(f) => f,
            None => return Paragraph::new("No changes to display").block(block),
        };

        let hunk = match file.hunks.get(self.current_hunk) {
            Some(h) => h,
            None => return Paragraph::new("No changes to display").block(block),
        };

        // Build visible lines
        let mut lines: Vec<Line> = Vec::new();

        // File header
        lines.push(Line::styled(
            format!("--- {}", file.old_path),
            Style::default()
                .fg(Color::Rgb(100, 100, 100))
                .add_modifier(Modifier::BOLD),
        ));
        lines.push(Line::styled(
            format!("+++ {}", file.new_path),
            Style::default()
                .fg(Color::Rgb(100, 100, 100))
                .add_modifier(Modifier::BOLD),
        ));

        // Hunk header
        lines.push(Line::styled(
            format!(
                "@@ -{},{} +{},{} @@",
                hunk.old_start, hunk.old_lines, hunk.new_start, hunk.new_lines
            ),
            Style::default()
                .fg(Color::Rgb(198, 120, 221))
                .add_modifier(Modifier::BOLD),
        ));

        // Diff lines
        for line in &hunk.lines {
            let (prefix, style) = match line.line_type {
                DiffLineType::Context => (" ", Style::default().fg(Color::Rgb(171, 178, 191))),
                DiffLineType::Added => (
                    "+",
                    Style::default()
                        .fg(Color::Rgb(152, 195, 121))
                        .bg(Color::Rgb(30, 50, 40)),
                ),
                DiffLineType::Removed => (
                    "-",
                    Style::default()
                        .fg(Color::Rgb(224, 108, 117))
                        .bg(Color::Rgb(50, 30, 30)),
                ),
                DiffLineType::Header | DiffLineType::HunkHeader => continue,
            };

            lines.push(Line::from(vec![
                Span::styled(prefix, style),
                Span::styled(line.content.clone(), style),
            ]));
        }

        // Apply scroll offset
        let visible_lines: Vec<Line> = lines
            .into_iter()
            .skip(self.scroll_offset)
            .take(area.height as usize)
            .collect();

        Paragraph::new(visible_lines).block(block)
    }
}

/// Parse unified diff format
fn parse_unified_diff(diff_text: &str) -> Vec<FileDiff> {
    let mut files = Vec::new();
    let mut current_file: Option<FileDiff> = None;
    let mut current_hunk: Option<DiffHunk> = None;

    for line in diff_text.lines() {
        if line.starts_with("--- ") {
            // Save previous file if exists
            if let Some(mut file) = current_file.take() {
                if let Some(hunk) = current_hunk.take() {
                    file.hunks.push(hunk);
                }
                files.push(file);
            }

            let path = line[4..].split('\t').next().unwrap_or("").to_string();
            current_file = Some(FileDiff {
                old_path: path.clone(),
                new_path: path,
                hunks: Vec::new(),
                is_new: false,
                is_deleted: false,
                is_binary: false,
            });
        } else if line.starts_with("+++ ") {
            if let Some(ref mut file) = current_file {
                file.new_path = line[4..].split('\t').next().unwrap_or("").to_string();
            }
        } else if line.starts_with("@@") {
            // Save previous hunk if exists
            if let Some(ref mut file) = current_file {
                if let Some(hunk) = current_hunk.take() {
                    file.hunks.push(hunk);
                }
            }

            // Parse hunk header: @@ -old_start,old_lines +new_start,new_lines @@
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                let old_info = &parts[1][1..]; // Remove leading '-'
                let new_info = &parts[2][1..]; // Remove leading '+'

                let (old_start, old_lines) = parse_hunk_range(old_info);
                let (new_start, new_lines) = parse_hunk_range(new_info);

                current_hunk = Some(DiffHunk {
                    old_start,
                    old_lines,
                    new_start,
                    new_lines,
                    lines: Vec::new(),
                });
            }
        } else if !line.is_empty() {
            let (line_type, content) = match line.chars().next() {
                Some(' ') => (DiffLineType::Context, &line[1..]),
                Some('+') => (DiffLineType::Added, &line[1..]),
                Some('-') => (DiffLineType::Removed, &line[1..]),
                _ => (DiffLineType::Context, line),
            };

            if let Some(ref mut hunk) = current_hunk {
                hunk.lines.push(DiffLine {
                    line_type,
                    content: content.to_string(),
                    old_line_num: None,
                    new_line_num: None,
                });
            }
        }
    }

    // Save final file
    if let Some(mut file) = current_file {
        if let Some(hunk) = current_hunk {
            file.hunks.push(hunk);
        }
        files.push(file);
    }

    files
}

/// Parse hunk range like "1,7" or "1"
fn parse_hunk_range(range: &str) -> (usize, usize) {
    let parts: Vec<&str> = range.split(',').collect();
    let start = parts.get(0).and_then(|s| s.parse().ok()).unwrap_or(1);
    let lines = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(1);
    (start, lines)
}

/// Generate inline diff from old and new content
fn generate_inline_diff(old_content: &str, new_content: &str, path: &str) -> FileDiff {
    let old_lines: Vec<&str> = old_content.lines().collect();
    let new_lines: Vec<&str> = new_content.lines().collect();

    // Simple line-by-line diff
    let mut diff_lines = Vec::new();
    let max_len = old_lines.len().max(new_lines.len());

    for i in 0..max_len {
        match (old_lines.get(i), new_lines.get(i)) {
            (Some(old), Some(new)) if old == new => {
                diff_lines.push(DiffLine {
                    line_type: DiffLineType::Context,
                    content: old.to_string(),
                    old_line_num: Some(i + 1),
                    new_line_num: Some(i + 1),
                });
            }
            (Some(old), Some(new)) => {
                diff_lines.push(DiffLine {
                    line_type: DiffLineType::Removed,
                    content: old.to_string(),
                    old_line_num: Some(i + 1),
                    new_line_num: None,
                });
                diff_lines.push(DiffLine {
                    line_type: DiffLineType::Added,
                    content: new.to_string(),
                    old_line_num: None,
                    new_line_num: Some(i + 1),
                });
            }
            (Some(old), None) => {
                diff_lines.push(DiffLine {
                    line_type: DiffLineType::Removed,
                    content: old.to_string(),
                    old_line_num: Some(i + 1),
                    new_line_num: None,
                });
            }
            (None, Some(new)) => {
                diff_lines.push(DiffLine {
                    line_type: DiffLineType::Added,
                    content: new.to_string(),
                    old_line_num: None,
                    new_line_num: Some(i + 1),
                });
            }
            (None, None) => break,
        }
    }

    FileDiff {
        old_path: path.to_string(),
        new_path: path.to_string(),
        hunks: vec![DiffHunk {
            old_start: 1,
            old_lines: old_lines.len(),
            new_start: 1,
            new_lines: new_lines.len(),
            lines: diff_lines,
        }],
        is_new: old_content.is_empty(),
        is_deleted: new_content.is_empty(),
        is_binary: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_hunk_range() {
        assert_eq!(parse_hunk_range("1,7"), (1, 7));
        assert_eq!(parse_hunk_range("5"), (5, 1));
        assert_eq!(parse_hunk_range("10,20"), (10, 20));
    }

    #[test]
    fn test_generate_inline_diff() {
        let old = "line1\nline2\nline3";
        let new = "line1\nmodified\nline3";
        let diff = generate_inline_diff(old, new, "test.txt");

        assert_eq!(diff.old_path, "test.txt");
        assert_eq!(diff.hunks.len(), 1);
        assert_eq!(diff.hunks[0].lines.len(), 4); // Context, removed, added, context
    }

    #[test]
    fn test_diff_viewer_navigation() {
        let mut viewer = DiffViewer::new();
        viewer.load_from_content("old", "new", "test.txt");

        assert!(viewer.has_changes());
        assert_eq!(viewer.current_file, 0);

        viewer.next_hunk();
        // Should stay at 0 since there's only one hunk
        assert_eq!(viewer.current_hunk, 0);
    }

    #[test]
    fn test_diff_summary() {
        let mut viewer = DiffViewer::new();
        viewer.load_from_content("line1\nline2", "line1\nmodified\nline3", "test.txt");

        let summary = viewer.summary();
        assert!(summary.contains("1 file"));
        assert!(summary.contains("+2"));
        assert!(summary.contains("-1"));
    }
}

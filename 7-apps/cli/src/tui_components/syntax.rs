//! Syntax highlighting for input field using syntect
//!
//! Features:
//! - Markdown highlighting (headers, bold, italic, code)
//! - Code block syntax highlighting with language detection
//! - Shell command highlighting
//! - File path highlighting for @mentions
//! - URL highlighting

use ratatui::{
    style::{Color, Modifier, Style},
    text::{Line, Span},
};
use syntect::{
    easy::HighlightLines,
    highlighting::{ThemeSet, Style as SyntectStyle},
    parsing::SyntaxSet,
    util::LinesWithEndings,
};

/// Syntax highlighter for input text
pub struct SyntaxHighlighter {
    syntax_set: SyntaxSet,
    theme_set: ThemeSet,
}

impl Default for SyntaxHighlighter {
    fn default() -> Self {
        Self::new()
    }
}

impl SyntaxHighlighter {
    /// Create a new syntax highlighter with default syntaxes
    pub fn new() -> Self {
        Self {
            syntax_set: SyntaxSet::load_defaults_newlines(),
            theme_set: ThemeSet::load_defaults(),
        }
    }

    /// Highlight markdown text from lines
    pub fn highlight_markdown_lines(&self, lines: &[String]) -> Vec<Line<'static>> {
        let text = lines.join("\n");
        self.highlight_markdown(&text)
    }

    /// Highlight markdown text
    pub fn highlight_markdown(&self, text: &str) -> Vec<Line<'static>> {
        let mut lines = Vec::new();
        let mut in_code_block = false;
        let mut code_language = String::new();
        let mut code_content = String::new();

        for line in text.lines() {
            if line.trim_start().starts_with("```") {
                if in_code_block {
                    // End of code block - highlight the accumulated code
                    let highlighted = if code_language.is_empty() {
                        self.highlight_plain_code(&code_content)
                    } else {
                        self.highlight_code(&code_content, &code_language)
                    };
                    lines.extend(highlighted);
                    in_code_block = false;
                    code_language.clear();
                    code_content.clear();
                } else {
                    // Start of code block
                    in_code_block = true;
                    code_language = line.trim_start()[3..].trim().to_string();
                }
                // Add the fence line
                lines.push(Line::styled(
                    line.to_string(),
                    Style::default().fg(Color::Rgb(100, 100, 100)),
                ));
            } else if in_code_block {
                code_content.push_str(line);
                code_content.push('\n');
            } else {
                lines.push(self.highlight_inline_markdown(line));
            }
        }

        // Handle unclosed code block
        if in_code_block && !code_content.is_empty() {
            let highlighted = if code_language.is_empty() {
                self.highlight_plain_code(&code_content)
            } else {
                self.highlight_code(&code_content, &code_language)
            };
            lines.extend(highlighted);
        }

        lines
    }

    /// Highlight inline markdown elements
    fn highlight_inline_markdown(&self, line: &str) -> Line<'static> {
        let mut spans: Vec<Span<'static>> = Vec::new();
        let mut chars = line.chars().peekable();
        let mut current_text = String::new();

        while let Some(ch) = chars.next() {
            match ch {
                '#' if current_text.is_empty() => {
                    // Header
                    let mut header_level = 1;
                    while chars.peek() == Some(&'#') {
                        chars.next();
                        header_level += 1;
                    }
                    if chars.peek() == Some(&' ') {
                        chars.next(); // consume space
                        let mut header_text = String::new();
                        while let Some(&c) = chars.peek() {
                            if c == '\n' {
                                break;
                            }
                            header_text.push(c);
                            chars.next();
                        }
                        spans.push(Span::styled(
                            format!("{} {}", "#".repeat(header_level), header_text),
                            Style::default()
                                .fg(Color::Rgb(246, 196, 83))
                                .add_modifier(Modifier::BOLD),
                        ));
                        return Line::from(spans);
                    } else {
                        current_text.push('#');
                        current_text.push_str(&"#".repeat(header_level - 1));
                    }
                }
                '`' => {
                    if !current_text.is_empty() {
                        spans.push(Span::raw(current_text.clone()));
                        current_text.clear();
                    }
                    // Inline code
                    let mut code = String::new();
                    while let Some(&c) = chars.peek() {
                        if c == '`' {
                            chars.next();
                            break;
                        }
                        code.push(c);
                        chars.next();
                    }
                    spans.push(Span::styled(
                        format!("`{}`", code),
                        Style::default()
                            .fg(Color::Rgb(140, 200, 255))
                            .bg(Color::Rgb(40, 44, 52)),
                    ));
                }
                '*' | '_' => {
                    if !current_text.is_empty() {
                        spans.push(Span::raw(current_text.clone()));
                        current_text.clear();
                    }
                    // Bold or italic
                    let marker = ch;
                    let is_double = chars.peek() == Some(&marker);
                    if is_double {
                        chars.next();
                    }
                    let mut styled_text = String::new();
                    while let Some(&c) = chars.peek() {
                        if c == marker {
                            if is_double && chars.peek() == Some(&marker) {
                                chars.next();
                                break;
                            } else if !is_double {
                                chars.next();
                                break;
                            }
                        }
                        styled_text.push(c);
                        chars.next();
                    }
                    let style = if is_double {
                        Style::default()
                            .fg(Color::Rgb(255, 255, 255))
                            .add_modifier(Modifier::BOLD)
                    } else {
                        Style::default()
                            .fg(Color::Rgb(200, 200, 200))
                            .add_modifier(Modifier::ITALIC)
                    };
                    spans.push(Span::styled(styled_text, style));
                }
                '@' => {
                    if !current_text.is_empty() {
                        spans.push(Span::raw(current_text.clone()));
                        current_text.clear();
                    }
                    // File mention
                    let mut mention = String::new();
                    mention.push('@');
                    while let Some(&c) = chars.peek() {
                        if c.is_whitespace() {
                            break;
                        }
                        mention.push(c);
                        chars.next();
                    }
                    spans.push(Span::styled(
                        mention,
                        Style::default()
                            .fg(Color::Rgb(152, 195, 121))
                            .add_modifier(Modifier::BOLD),
                    ));
                }
                '/' if current_text.is_empty() || current_text.ends_with(' ') => {
                    if !current_text.is_empty() {
                        spans.push(Span::raw(current_text.clone()));
                        current_text.clear();
                    }
                    // Slash command
                    let mut command = String::new();
                    command.push('/');
                    while let Some(&c) = chars.peek() {
                        if c.is_whitespace() {
                            break;
                        }
                        command.push(c);
                        chars.next();
                    }
                    spans.push(Span::styled(
                        command,
                        Style::default()
                            .fg(Color::Rgb(198, 120, 221))
                            .add_modifier(Modifier::BOLD),
                    ));
                }
                '!' if current_text.is_empty() || current_text.ends_with(' ') => {
                    if !current_text.is_empty() {
                        spans.push(Span::raw(current_text.clone()));
                        current_text.clear();
                    }
                    // Shell command
                    let mut command = String::new();
                    command.push('!');
                    while let Some(&c) = chars.peek() {
                        command.push(c);
                        chars.next();
                    }
                    spans.push(Span::styled(
                        command,
                        Style::default()
                            .fg(Color::Rgb(224, 108, 117))
                            .add_modifier(Modifier::BOLD),
                    ));
                    // Don't continue, we've consumed the rest of the line
                    break;
                }
                'h' if current_text.ends_with("ttp") || current_text.ends_with("ttps") => {
                    // URL detection
                    current_text.push(ch);
                    if chars.peek() == Some(&':') {
                        chars.next();
                        current_text.push(':');
                        if chars.peek() == Some(&'/') {
                            chars.next();
                            current_text.push('/');
                            if chars.peek() == Some(&'/') {
                                chars.next();
                                current_text.push('/');
                                // Continue consuming URL
                                while let Some(&c) = chars.peek() {
                                    if c.is_whitespace() {
                                        break;
                                    }
                                    current_text.push(c);
                                    chars.next();
                                }
                                spans.push(Span::styled(
                                    current_text.clone(),
                                    Style::default()
                                        .fg(Color::Rgb(97, 175, 239))
                                        .add_modifier(Modifier::UNDERLINED),
                                ));
                                current_text.clear();
                            }
                        }
                    }
                }
                _ => {
                    current_text.push(ch);
                }
            }
        }

        if !current_text.is_empty() {
            spans.push(Span::raw(current_text));
        }

        Line::from(spans)
    }

    /// Highlight code with specific language syntax
    pub fn highlight_code(&self, code: &str, language: &str) -> Vec<Line<'static>> {
        let syntax = self
            .syntax_set
            .find_syntax_by_token(language)
            .unwrap_or_else(|| self.syntax_set.find_syntax_plain_text());

        let theme = &self.theme_set.themes["base16-ocean.dark"];
        let mut highlighter = HighlightLines::new(syntax, theme);

        let mut lines = Vec::new();
        for line in LinesWithEndings::from(code) {
            let highlighted = highlighter.highlight_line(line, &self.syntax_set);
            match highlighted {
                Ok(ranges) => {
                    let spans: Vec<Span<'static>> = ranges
                        .into_iter()
                        .map(|(style, text)| Span::styled(text.to_string(), syntect_style_to_ratatui(style)))
                        .collect();
                    lines.push(Line::from(spans));
                }
                Err(_) => {
                    lines.push(Line::raw(line.to_string()));
                }
            }
        }
        lines
    }

    /// Highlight plain code (no specific language)
    fn highlight_plain_code(&self, code: &str) -> Vec<Line<'static>> {
        code.lines()
            .map(|line| {
                Line::styled(
                    line.to_string(),
                    Style::default().fg(Color::Rgb(171, 178, 191)),
                )
            })
            .collect()
    }

    /// Highlight shell commands
    pub fn highlight_shell(&self, text: &str) -> Vec<Line<'static>> {
        self.highlight_code(text, "bash")
    }
}

/// Convert syntect style to ratatui style
fn syntect_style_to_ratatui(style: SyntectStyle) -> Style {
    let fg = style.foreground;
    Style::default().fg(Color::Rgb(fg.r, fg.g, fg.b))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_highlight_markdown_headers() {
        let highlighter = SyntaxHighlighter::new();
        let lines = highlighter.highlight_markdown("# Header 1\n## Header 2");
        assert_eq!(lines.len(), 2);
    }

    #[test]
    fn test_highlight_inline_code() {
        let highlighter = SyntaxHighlighter::new();
        let line = highlighter.highlight_inline_markdown("Use `code` here");
        assert_eq!(line.spans.len(), 3);
    }

    #[test]
    fn test_highlight_mentions() {
        let highlighter = SyntaxHighlighter::new();
        let line = highlighter.highlight_inline_markdown("Check @file.txt");
        // Should have the text before @, and the styled mention
        assert!(line.spans.len() >= 2);
    }

    #[test]
    fn test_highlight_slash_commands() {
        let highlighter = SyntaxHighlighter::new();
        let line = highlighter.highlight_inline_markdown("Run /help");
        // Should have "Run " and the styled "/help"
        assert!(line.spans.len() >= 2);
    }
}

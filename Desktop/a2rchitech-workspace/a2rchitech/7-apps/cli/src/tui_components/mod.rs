//! TUI components for a2rchitech-cli
//!
//! This module provides reusable UI components for the terminal interface.

pub mod diff;
pub mod git;
pub mod hooks;
pub mod input;
pub mod syntax;

pub use diff::{DiffLineType, DiffViewer, DiffViewMode};
pub use git::{AutoCommitMode, GitAutoCommitConfig, GitManager};
pub use hooks::{HookContext, HookManager, HookType};
pub use input::{InputMode, MultiLineInput};
pub use syntax::SyntaxHighlighter;

import Foundation
import Runestone
import TreeSitterJSONRunestone
import TreeSitterMarkdownRunestone
import TreeSitterPythonRunestone
import TreeSitterJavaScriptRunestone
import TreeSitterTypeScriptRunestone
import TreeSitterYAMLRunestone
import TreeSitterBashRunestone
import TreeSitterSwiftRunestone

/// Maps a workspace file's extension to a Tree-sitter grammar for
/// Runestone's syntax highlighting (`CodeEditorView`). `nil` falls back to
/// Runestone's plain-text mode — still gets line numbers/gutter, no
/// highlighting.
enum CodeLanguage {
    static func language(forPath path: String) -> TreeSitterLanguage? {
        switch (path as NSString).pathExtension.lowercased() {
        case "json": return .json
        case "md", "markdown": return .markdown
        case "py": return .python
        case "js", "mjs", "cjs", "jsx": return .javaScript
        case "ts", "mts", "cts": return .typeScript
        case "yml", "yaml": return .yaml
        case "sh", "bash", "zsh": return .bash
        case "swift": return .swift
        default: return nil
        }
    }
}

# Changelog

All notable changes to the Gizzi Thin Client will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Gizzi Thin Client
- Floating chat interface with global hotkey (Cmd/Ctrl+Shift+A)
- Streaming chat with markdown support
- Settings persistence with zustand
- Theme support (light/dark/system)
- Backend health checking with retry logic
- Computer Use integration for browser/desktop automation
- App discovery (detect frontmost applications)
- Model selector with 18 providers
- Agent mode toggle
- Production build configuration for macOS, Windows, Linux

### Technical
- Electron 28 with React 18
- TypeScript throughout
- Vite for renderer build
- electron-builder for packaging
- Tailwind CSS for styling
- framer-motion for animations

## [0.1.0] - 2024-01-15

### Added
- First public release
- Core chat functionality
- Connection to A2R Terminal Server
- Basic settings management
- Auto-updater support
- Code signing setup for macOS and Windows

[Unreleased]: https://github.com/a2r/thin-client/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/a2r/thin-client/releases/tag/v0.1.0

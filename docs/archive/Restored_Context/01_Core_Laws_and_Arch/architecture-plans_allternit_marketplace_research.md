# Allternit Platform Marketplace & Studio - Research Findings

## Claude's Plugin System Architecture

### Architecture Pattern
- **Structure**: Slash command → Agent → Subagent (haiku) → External tool
- **Principles**: Claude orchestrates while external tools execute
- **Integration**: All integrations are CLI or script-based (no MCP servers, background processes, or daemons)
- **Execution**: Each plugin loads, runs, exits with minimal overhead
- **Token Isolation**: Uses subagents (haiku) for token isolation - verbose external tool output is handled by haiku subagents to keep costs low and main session clean

### Plugin Structure
- Markdown agents with YAML frontmatter
- Slash commands that delegate to agents
- Optional library code for complex operations

### Available Tools/Plugins
1. **Gemini Tools** - Visual analysis and UI generation
2. **Codex** - Architecture thinking via OpenAI Codex
3. **DNS** - Multi-provider DNS management
4. **Headless** - Browser automation for site comparison and E2E testing
5. **Mobile** - Native mobile app testing via Appium
6. **Miro** - Board reading and interpretation via API

## VSCode Extensions Marketplace Architecture

### Extension Structure
- **Manifest**: `package.json` containing metadata and contribution points
- **Entry Point**: `extension.js`/`.ts` with `activate()` function
- **Activation Events**: Determined by events like file opening, commands, or language usage

### API Capabilities
- **Language Extensions**: Syntax highlighting, semantic highlighting, snippets
- **UI Extensions**: Tree views, webviews, custom editors
- **Theming**: Color themes, file icon themes, product icon themes
- **Debugging**: Custom debug adapters and configurations
- **Testing**: Test controllers and run profiles
- **AI/Chat**: Chat participants, language model integration

### Publishing Process
- Extensions published to VSCode marketplace
- Thorough testing before publishing
- Bundling for optimization
- Continuous integration setup

## Figma Plugin System Architecture

### Security Architecture
- **Realms + Membrane Pattern**: Creates secure JavaScript environment with isolated globals
- **Whitelist Approach**: Only explicitly allowed APIs are accessible
- **Global Variable Isolation**: Plugins can't access Figma's global state
- **Origin Restrictions**: Null origin prevents requests to figma.com

### Communication Architecture
- **Dual Component**: Main thread component (Realms sandbox) + iFrame component (browser APIs)
- **Message Passing**: Components communicate via message passing
- **API Operations**: `figma.loadScene()` and `figma.updateScene()` for data manipulation

### Plugin Capabilities
- Accessibility checking (contrast measurement)
- Translation apps
- Design tools (color wheels)
- Importers for populating designs with content

## npm Registry Architecture

### Package Structure
- **package.json**: Contains metadata, dependencies, and entry points
- **Version Management**: Semantic versioning with registry tracking
- **Dependency Resolution**: Automatic dependency resolution and installation

### Registry Operations
- **Publishing**: `npm publish` command uploads packages to registry
- **Installation**: `npm install` downloads and installs packages
- **Versioning**: Tag-based versioning (latest, beta, etc.)

### Marketplace Features
- **Search**: Package search functionality
- **Categories**: Organized by functionality and use cases
- **Metadata**: Rich package metadata including descriptions, keywords, authors

## Key Insights for Allternit Platform

### Security Considerations
1. **Sandboxing**: Implement secure execution environments for plugins
2. **API Whitelisting**: Only expose safe APIs to plugins
3. **Isolation**: Separate plugin execution from main application
4. **Validation**: Validate all plugin inputs and outputs

### Architecture Patterns
1. **Modular Design**: Separate plugin management from core functionality
2. **Message Passing**: Use secure communication channels between components
3. **Dual Execution**: Separate UI components from computational components
4. **Extensibility Points**: Define clear interfaces for plugin integration

### Marketplace Features
1. **Discovery**: Search, browse, and recommendation systems
2. **Management**: Install, update, enable/disable functionality
3. **Categorization**: Organize plugins by type and functionality
4. **Metadata**: Rich plugin information including ratings, descriptions, dependencies

### Studio Features
1. **Creative Tools**: Canvas-based composition and timeline editing
2. **Asset Management**: Media processing and asset libraries
3. **Template System**: Pre-built templates for common use cases
4. **Collaboration**: Real-time editing and sharing capabilities

## Recommended Implementation Approach

### For Marketplace
- Implement a plugin registry with security scanning
- Create a sandboxed execution environment
- Develop a rich metadata system for plugins
- Build search and categorization features

### For Studio
- Create a canvas-based composition interface
- Implement timeline editing for video/audio
- Build asset management and processing pipelines
- Add template and collaboration features

This research provides a solid foundation for implementing both the Marketplace and Studio features in the Allternit platform, drawing from proven architectures in the industry.
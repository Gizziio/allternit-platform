//! Allternit Vendor Wrappers
//!
//! Defines wrapper contracts for vendor library integration.
//! These wrappers provide a unified Allternit-compatible interface for:
//! - UI components (flexlayout, resizable panels, virtual lists, etc.)
//! - Command palettes (kbar, cmdk)
//! - Hotkeys (react-hotkeys-hook)
//! - UI primitives (Radix UI)
//! - Editors (Monaco)
//! - Terminals (xterm)
//! - Canvas/Graph (tldraw, reactflow)
//!
//! Based on VENDOR_INGESTION_CHECKLIST.md specification

use serde::{Deserialize, Serialize};

// ============================================================================
// Vendor Wrapper Contract
// ============================================================================

/// Vendor wrapper metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VendorWrapper {
    /// Unique wrapper ID
    pub wrapper_id: String,
    /// Vendor package name
    pub vendor_package: String,
    /// Vendor version (pinned)
    pub vendor_version: String,
    /// Allternit wrapper name
    pub wrapper_name: String,
    /// Wrapper description
    pub description: String,
    /// Upstream repo URL
    pub upstream_repo: Option<String>,
    /// License
    pub license: String,
    /// Allternit exports
    pub exports: Vec<String>,
    /// Usage example
    pub usage_example: String,
    /// Integration notes
    pub notes: Option<String>,
}

// ============================================================================
// UI Component Wrappers
// ============================================================================

/// FlexLayout wrapper (caplin/flexlayout)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlexLayoutWrapper {
    /// Vendor: flexlayout-react
    pub vendor_version: String,
    /// Allternit wrapper: FlexLayoutHost
    pub wrapper_component: String,
    /// Purpose: Docking, tabsets, draggable tabs, layout model
    pub purpose: String,
}

impl Default for FlexLayoutWrapper {
    fn default() -> Self {
        Self {
            vendor_version: "0.17.0".to_string(),
            wrapper_component: "FlexLayoutHost".to_string(),
            purpose: "Docking, tabsets, draggable tabs, layout model".to_string(),
        }
    }
}

/// Resizable Panels wrapper (bvaughn/react-resizable-panels)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResizablePanelsWrapper {
    /// Vendor: react-resizable-panels
    pub vendor_version: String,
    /// Allternit wrapper: AllternitPanelGroup
    pub wrapper_component: String,
    /// Purpose: Split panes for console/inspector/workspace
    pub purpose: String,
}

impl Default for ResizablePanelsWrapper {
    fn default() -> Self {
        Self {
            vendor_version: "2.1.0".to_string(),
            wrapper_component: "AllternitPanelGroup".to_string(),
            purpose: "Split panes for console/inspector/workspace".to_string(),
        }
    }
}

/// Virtual List wrapper (tanstack/react-virtual or bvaughn/react-window)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VirtualListWrapper {
    /// Vendor: @tanstack/react-virtual OR react-window
    pub vendor_package: String,
    /// Vendor version
    pub vendor_version: String,
    /// Allternit wrapper: VirtualList
    pub wrapper_component: String,
    /// Purpose: Ticket lists, logs, sessions at scale
    pub purpose: String,
}

impl Default for VirtualListWrapper {
    fn default() -> Self {
        Self {
            vendor_package: "@tanstack/react-virtual".to_string(),
            vendor_version: "3.0.0".to_string(),
            wrapper_component: "VirtualList".to_string(),
            purpose: "Ticket lists, logs, sessions at scale".to_string(),
        }
    }
}

// ============================================================================
// Command Runner Wrappers
// ============================================================================

/// Command Palette wrapper (kbar or cmdk)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandPaletteWrapper {
    /// Vendor: kbar OR cmdk
    pub vendor_package: String,
    /// Vendor version
    pub vendor_version: String,
    /// Allternit wrapper: CommandPalette
    pub wrapper_component: String,
    /// Purpose: Option+A command runner
    pub purpose: String,
}

impl Default for CommandPaletteWrapper {
    fn default() -> Self {
        Self {
            vendor_package: "kbar".to_string(),
            vendor_version: "0.1.0-beta.45".to_string(),
            wrapper_component: "CommandPalette".to_string(),
            purpose: "Option+A command runner".to_string(),
        }
    }
}

/// Hotkeys wrapper (kentcdodds/react-hotkeys-hook)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeysWrapper {
    /// Vendor: react-hotkeys-hook
    pub vendor_version: String,
    /// Allternit wrapper: useAllternitHotkeys
    pub wrapper_hook: String,
    /// Purpose: Keyboard shortcuts
    pub purpose: String,
}

impl Default for HotkeysWrapper {
    fn default() -> Self {
        Self {
            vendor_version: "4.5.0".to_string(),
            wrapper_hook: "useAllternitHotkeys".to_string(),
            purpose: "Keyboard shortcuts".to_string(),
        }
    }
}

// ============================================================================
// UI Primitive Wrappers
// ============================================================================

/// Radix UI wrapper (radix-ui/primitives)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadixUIWrapper {
    /// Vendor: @radix-ui/react-*
    pub vendor_version: String,
    /// Allternit wrapper: Radix wrappers (export only what we use)
    pub wrapper_module: String,
    /// Purpose: UI primitives (dialog, dropdown, etc.)
    pub purpose: String,
    /// Used components
    pub components: Vec<String>,
}

impl Default for RadixUIWrapper {
    fn default() -> Self {
        Self {
            vendor_version: "2.0.0".to_string(),
            wrapper_module: "RadixUI".to_string(),
            purpose: "UI primitives (dialog, dropdown, etc.)".to_string(),
            components: vec![
                "Dialog".to_string(),
                "DropdownMenu".to_string(),
                "Tooltip".to_string(),
                "Popover".to_string(),
            ],
        }
    }
}

// ============================================================================
// Editor & Terminal Wrappers
// ============================================================================

/// Monaco Editor wrapper (suren-atoyan/monaco-react)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonacoEditorWrapper {
    /// Vendor: @monaco-editor/react
    pub vendor_version: String,
    /// Allternit wrapper: CodeEditor
    pub wrapper_component: String,
    /// Purpose: Code editing
    pub purpose: String,
}

impl Default for MonacoEditorWrapper {
    fn default() -> Self {
        Self {
            vendor_version: "4.6.0".to_string(),
            wrapper_component: "CodeEditor".to_string(),
            purpose: "Code editing".to_string(),
        }
    }
}

/// Terminal wrapper (xtermjs/xterm.js)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalWrapper {
    /// Vendor: xterm + xterm-addon-fit
    pub vendor_version: String,
    /// Allternit wrapper: TerminalView
    pub wrapper_component: String,
    /// Purpose: Terminal emulation
    pub purpose: String,
}

impl Default for TerminalWrapper {
    fn default() -> Self {
        Self {
            vendor_version: "5.3.0".to_string(),
            wrapper_component: "TerminalView".to_string(),
            purpose: "Terminal emulation".to_string(),
        }
    }
}

// ============================================================================
// Canvas & Graph Wrappers
// ============================================================================

/// Tldraw wrapper (tldraw/tldraw)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TldrawWrapper {
    /// Vendor: tldraw
    pub vendor_version: String,
    /// Allternit wrapper: CanvasSurface
    pub wrapper_component: String,
    /// Purpose: Infinite canvas
    pub purpose: String,
}

impl Default for TldrawWrapper {
    fn default() -> Self {
        Self {
            vendor_version: "2.0.0".to_string(),
            wrapper_component: "CanvasSurface".to_string(),
            purpose: "Infinite canvas".to_string(),
        }
    }
}

/// React Flow wrapper (xyflow/xyflow)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReactFlowWrapper {
    /// Vendor: reactflow
    pub vendor_version: String,
    /// Allternit wrapper: GraphSurface
    pub wrapper_component: String,
    /// Purpose: Graph editor
    pub purpose: String,
}

impl Default for ReactFlowWrapper {
    fn default() -> Self {
        Self {
            vendor_version: "11.11.0".to_string(),
            wrapper_component: "GraphSurface".to_string(),
            purpose: "Graph editor".to_string(),
        }
    }
}

// ============================================================================
// Vendor Registry
// ============================================================================

/// Vendor wrapper registry
pub struct VendorRegistry {
    wrappers: Vec<VendorWrapper>,
}

impl VendorRegistry {
    pub fn new() -> Self {
        Self {
            wrappers: Vec::new(),
        }
    }

    /// Register a vendor wrapper
    pub fn register(&mut self, wrapper: VendorWrapper) {
        self.wrappers.push(wrapper);
    }

    /// Get wrapper by ID
    pub fn get_wrapper(&self, wrapper_id: &str) -> Option<&VendorWrapper> {
        self.wrappers.iter().find(|w| w.wrapper_id == wrapper_id)
    }

    /// List all wrappers
    pub fn list_wrappers(&self) -> &[VendorWrapper] {
        &self.wrappers
    }

    /// Get wrappers by category
    pub fn get_wrappers_by_category(&self, category: &str) -> Vec<&VendorWrapper> {
        self.wrappers
            .iter()
            .filter(|w| w.wrapper_id.starts_with(category))
            .collect()
    }
}

impl Default for VendorRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Create default vendor registry with all wrappers
pub fn create_default_registry() -> VendorRegistry {
    let mut registry = VendorRegistry::new();

    // UI Components
    registry.register(VendorWrapper {
        wrapper_id: "ui.flexlayout".to_string(),
        vendor_package: "flexlayout-react".to_string(),
        vendor_version: FlexLayoutWrapper::default().vendor_version,
        wrapper_name: "FlexLayoutHost".to_string(),
        description: "Docking, tabsets, draggable tabs, layout model".to_string(),
        upstream_repo: Some("https://github.com/caplin/FlexLayout".to_string()),
        license: "MIT".to_string(),
        exports: vec!["FlexLayoutHost".to_string()],
        usage_example: "<FlexLayoutHost model={layout} />".to_string(),
        notes: None,
    });

    registry.register(VendorWrapper {
        wrapper_id: "ui.panels".to_string(),
        vendor_package: "react-resizable-panels".to_string(),
        vendor_version: ResizablePanelsWrapper::default().vendor_version,
        wrapper_name: "AllternitPanelGroup".to_string(),
        description: "Split panes for console/inspector/workspace".to_string(),
        upstream_repo: Some("https://github.com/bvaughn/react-resizable-panels".to_string()),
        license: "MIT".to_string(),
        exports: vec!["AllternitPanelGroup".to_string()],
        usage_example: "<AllternitPanelGroup><Panel size={50} /><Panel size={50} /></AllternitPanelGroup>".to_string(),
        notes: None,
    });

    registry.register(VendorWrapper {
        wrapper_id: "ui.virtual".to_string(),
        vendor_package: "@tanstack/react-virtual".to_string(),
        vendor_version: VirtualListWrapper::default().vendor_version,
        wrapper_name: "VirtualList".to_string(),
        description: "Ticket lists, logs, sessions at scale".to_string(),
        upstream_repo: Some("https://github.com/TanStack/virtual".to_string()),
        license: "MIT".to_string(),
        exports: vec!["VirtualList".to_string()],
        usage_example: "<VirtualList count={items.length} renderItem={renderItem} />".to_string(),
        notes: None,
    });

    // Command Runner
    registry.register(VendorWrapper {
        wrapper_id: "cmd.palette".to_string(),
        vendor_package: "kbar".to_string(),
        vendor_version: CommandPaletteWrapper::default().vendor_version,
        wrapper_name: "CommandPalette".to_string(),
        description: "Option+A command runner".to_string(),
        upstream_repo: Some("https://github.com/timc1/kbar".to_string()),
        license: "MIT".to_string(),
        exports: vec!["CommandPalette".to_string(), "useKBar".to_string()],
        usage_example: "<CommandPalette><KBarProvider>{children}</KBarProvider></CommandPalette>".to_string(),
        notes: None,
    });

    registry.register(VendorWrapper {
        wrapper_id: "cmd.hotkeys".to_string(),
        vendor_package: "react-hotkeys-hook".to_string(),
        vendor_version: HotkeysWrapper::default().vendor_version,
        wrapper_name: "useAllternitHotkeys".to_string(),
        description: "Keyboard shortcuts".to_string(),
        upstream_repo: Some("https://github.com/JohannesKlauss/react-hotkeys-hook".to_string()),
        license: "MIT".to_string(),
        exports: vec!["useAllternitHotkeys".to_string()],
        usage_example: "const { enabled } = useAllternitHotkeys('mod+k', handleShortcut);".to_string(),
        notes: None,
    });

    // UI Primitives
    registry.register(VendorWrapper {
        wrapper_id: "ui.radix".to_string(),
        vendor_package: "@radix-ui/react-*".to_string(),
        vendor_version: RadixUIWrapper::default().vendor_version,
        wrapper_name: "RadixUI".to_string(),
        description: "UI primitives (dialog, dropdown, etc.)".to_string(),
        upstream_repo: Some("https://github.com/radix-ui/primitives".to_string()),
        license: "MIT".to_string(),
        exports: vec!["Dialog".to_string(), "DropdownMenu".to_string()],
        usage_example: "<Dialog><DialogTrigger>Open</DialogTrigger><DialogContent>...</DialogContent></Dialog>".to_string(),
        notes: None,
    });

    // Editor & Terminal
    registry.register(VendorWrapper {
        wrapper_id: "edit.monaco".to_string(),
        vendor_package: "@monaco-editor/react".to_string(),
        vendor_version: MonacoEditorWrapper::default().vendor_version,
        wrapper_name: "CodeEditor".to_string(),
        description: "Code editing".to_string(),
        upstream_repo: Some("https://github.com/suren-atoyan/monaco-react".to_string()),
        license: "MIT".to_string(),
        exports: vec!["CodeEditor".to_string()],
        usage_example: "<CodeEditor language=\"typescript\" value={code} onChange={handleChange} />".to_string(),
        notes: None,
    });

    registry.register(VendorWrapper {
        wrapper_id: "term.xterm".to_string(),
        vendor_package: "xterm".to_string(),
        vendor_version: TerminalWrapper::default().vendor_version,
        wrapper_name: "TerminalView".to_string(),
        description: "Terminal emulation".to_string(),
        upstream_repo: Some("https://github.com/xtermjs/xterm.js".to_string()),
        license: "MIT".to_string(),
        exports: vec!["TerminalView".to_string()],
        usage_example: "<TerminalView onInput={handleInput} />".to_string(),
        notes: None,
    });

    // Canvas & Graph
    registry.register(VendorWrapper {
        wrapper_id: "canvas.tldraw".to_string(),
        vendor_package: "tldraw".to_string(),
        vendor_version: TldrawWrapper::default().vendor_version,
        wrapper_name: "CanvasSurface".to_string(),
        description: "Infinite canvas".to_string(),
        upstream_repo: Some("https://github.com/tldraw/tldraw".to_string()),
        license: "MIT".to_string(),
        exports: vec!["CanvasSurface".to_string()],
        usage_example: "<CanvasSurface assets={assets} />".to_string(),
        notes: None,
    });

    registry.register(VendorWrapper {
        wrapper_id: "graph.reactflow".to_string(),
        vendor_package: "reactflow".to_string(),
        vendor_version: ReactFlowWrapper::default().vendor_version,
        wrapper_name: "GraphSurface".to_string(),
        description: "Graph editor".to_string(),
        upstream_repo: Some("https://github.com/xyflow/xyflow".to_string()),
        license: "MIT".to_string(),
        exports: vec!["GraphSurface".to_string()],
        usage_example: "<GraphSurface nodes={nodes} edges={edges} />".to_string(),
        notes: None,
    });

    registry
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_default_registry() {
        let registry = create_default_registry();
        let wrappers = registry.list_wrappers();

        // Should have all 10 wrappers
        assert_eq!(wrappers.len(), 10);
    }

    #[test]
    fn test_get_wrapper() {
        let registry = create_default_registry();

        let wrapper = registry.get_wrapper("ui.flexlayout");
        assert!(wrapper.is_some());
        assert_eq!(wrapper.unwrap().wrapper_name, "FlexLayoutHost");
    }

    #[test]
    fn test_get_wrappers_by_category() {
        let registry = create_default_registry();

        let ui_wrappers = registry.get_wrappers_by_category("ui");
        assert_eq!(ui_wrappers.len(), 4); // flexlayout, panels, virtual, radix

        let cmd_wrappers = registry.get_wrappers_by_category("cmd");
        assert_eq!(cmd_wrappers.len(), 2); // palette, hotkeys
    }

    #[test]
    fn test_wrapper_metadata() {
        let registry = create_default_registry();

        let wrapper = registry.get_wrapper("edit.monaco").unwrap();
        assert_eq!(wrapper.vendor_package, "@monaco-editor/react");
        assert_eq!(wrapper.license, "MIT");
        assert!(wrapper.upstream_repo.is_some());
    }
}

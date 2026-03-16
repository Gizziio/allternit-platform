use crate::error::{PKError, Result};
use crate::types::{
    CanvasSpec, ColorSemantics, InteractionSpec, LayoutConstraints, LayoutPosition, LayoutRegion,
    LayoutSize, LayoutStrategy, MotionSpec, RiskLevel, SpatialRules, ViewSpec,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// CanvasProtocol defines the communication and rendering protocol for canvas-based UIs
pub struct CanvasProtocol {
    /// Registry of available view types and their renderers
    view_registry: HashMap<String, ViewRenderer>,

    /// Default interaction specifications for different canvas types
    default_interactions: HashMap<String, InteractionSpec>,

    /// Layout strategies for different canvas types
    layout_strategies: HashMap<String, LayoutStrategy>,
}

/// ViewRenderer represents a function that can render a view spec to HTML
pub type ViewRenderer = fn(&ViewSpec) -> String;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasUpdate {
    pub canvas_id: Uuid,
    pub changes: Vec<CanvasChange>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CanvasChange {
    AddView {
        view_spec: ViewSpec,
    },
    RemoveView {
        view_id: Uuid,
    },
    UpdateView {
        view_id: Uuid,
        new_spec: ViewSpec,
    },
    MoveView {
        view_id: Uuid,
        new_region_id: String,
    },
    UpdateLayout {
        new_layout: LayoutStrategy,
    },
    UpdateInteraction {
        new_interaction: InteractionSpec,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasState {
    pub canvas_id: Uuid,
    pub current_spec: CanvasSpec,
    pub layout: LayoutStrategy,
    pub interaction: InteractionSpec,
    pub view_states: HashMap<Uuid, ViewState>,
    pub history: Vec<CanvasUpdate>,
    pub last_updated: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewState {
    pub view_id: Uuid,
    pub rendered_html: String,
    pub interaction_state: HashMap<String, serde_json::Value>,
    pub last_rendered: u64,
}

impl Default for CanvasProtocol {
    fn default() -> Self {
        Self::new()
    }
}

impl CanvasProtocol {
    pub fn new() -> Self {
        let mut protocol = Self {
            view_registry: HashMap::new(),
            default_interactions: HashMap::new(),
            layout_strategies: HashMap::new(),
        };

        // Register default interaction specs
        protocol.register_default_interactions();

        // Register default layout strategies
        protocol.register_default_layout_strategies();

        protocol
    }

    fn register_default_interactions(&mut self) {
        // Default interaction spec for list views
        self.default_interactions.insert(
            "list_view".to_string(),
            InteractionSpec {
                motion: MotionSpec {
                    weight: 0.5,
                    resistance: 0.3,
                    continuity: 0.8,
                },
                color_semantics: ColorSemantics {
                    risk: RiskLevel::Read,
                    confidence: 0.9,
                },
                spatial_rules: SpatialRules {
                    layout_preference: "vertical".to_string(),
                    interaction_model: "scroll".to_string(),
                },
            },
        );

        // Default interaction spec for graph views
        self.default_interactions.insert(
            "graph_view".to_string(),
            InteractionSpec {
                motion: MotionSpec {
                    weight: 0.7,
                    resistance: 0.5,
                    continuity: 0.6,
                },
                color_semantics: ColorSemantics {
                    risk: RiskLevel::Read,
                    confidence: 0.85,
                },
                spatial_rules: SpatialRules {
                    layout_preference: "flexible".to_string(),
                    interaction_model: "zoom_pan".to_string(),
                },
            },
        );

        // Default interaction spec for form views
        self.default_interactions.insert(
            "form_view".to_string(),
            InteractionSpec {
                motion: MotionSpec {
                    weight: 0.3,
                    resistance: 0.2,
                    continuity: 0.9,
                },
                color_semantics: ColorSemantics {
                    risk: RiskLevel::Write,
                    confidence: 0.95,
                },
                spatial_rules: SpatialRules {
                    layout_preference: "vertical".to_string(),
                    interaction_model: "tab_focus".to_string(),
                },
            },
        );
    }

    fn register_default_layout_strategies(&mut self) {
        // Default layout for list views
        self.layout_strategies.insert(
            "list_view".to_string(),
            LayoutStrategy {
                layout_type: "vertical".to_string(),
                constraints: Some(LayoutConstraints {
                    min_width: Some(300),
                    max_width: Some(800),
                    min_height: Some(200),
                    max_height: None,
                    aspect_ratio: None,
                }),
                regions: vec![LayoutRegion {
                    id: "primary".to_string(),
                    region_type: "primary".to_string(),
                    position: Some(LayoutPosition { x: 0.0, y: 0.0 }),
                    size: Some(LayoutSize {
                        width: 100.0,
                        height: 100.0,
                    }),
                    allowed_view_types: vec!["list_view".to_string(), "table_view".to_string()],
                }],
            },
        );

        // Default layout for dashboard views
        self.layout_strategies.insert(
            "dashboard".to_string(),
            LayoutStrategy {
                layout_type: "grid".to_string(),
                constraints: Some(LayoutConstraints {
                    min_width: Some(800),
                    max_width: None,
                    min_height: Some(600),
                    max_height: None,
                    aspect_ratio: None,
                }),
                regions: vec![
                    LayoutRegion {
                        id: "header".to_string(),
                        region_type: "header".to_string(),
                        position: Some(LayoutPosition { x: 0.0, y: 0.0 }),
                        size: Some(LayoutSize {
                            width: 100.0,
                            height: 10.0,
                        }),
                        allowed_view_types: vec![
                            "text_view".to_string(),
                            "status_view".to_string(),
                        ],
                    },
                    LayoutRegion {
                        id: "sidebar".to_string(),
                        region_type: "sidebar".to_string(),
                        position: Some(LayoutPosition { x: 0.0, y: 10.0 }),
                        size: Some(LayoutSize {
                            width: 20.0,
                            height: 80.0,
                        }),
                        allowed_view_types: vec!["nav_view".to_string(), "menu_view".to_string()],
                    },
                    LayoutRegion {
                        id: "main".to_string(),
                        region_type: "primary".to_string(),
                        position: Some(LayoutPosition { x: 20.0, y: 10.0 }),
                        size: Some(LayoutSize {
                            width: 80.0,
                            height: 80.0,
                        }),
                        allowed_view_types: vec![
                            "graph_view".to_string(),
                            "list_view".to_string(),
                            "form_view".to_string(),
                            "text_view".to_string(),
                        ],
                    },
                    LayoutRegion {
                        id: "footer".to_string(),
                        region_type: "footer".to_string(),
                        position: Some(LayoutPosition { x: 0.0, y: 90.0 }),
                        size: Some(LayoutSize {
                            width: 100.0,
                            height: 10.0,
                        }),
                        allowed_view_types: vec![
                            "status_view".to_string(),
                            "info_view".to_string(),
                        ],
                    },
                ],
            },
        );
    }

    /// Register a view renderer with the protocol
    pub fn register_view_renderer(&mut self, view_type: &str, renderer: ViewRenderer) {
        self.view_registry.insert(view_type.to_string(), renderer);
    }

    /// Render a canvas spec to HTML
    pub fn render_canvas(&self, canvas_spec: &CanvasSpec) -> Result<String> {
        let mut html_parts = Vec::new();

        // Start canvas container
        html_parts.push(format!(
            r#"<div class="ax-canvas" data-canvas-id="{}">"#,
            canvas_spec.canvas_id
        ));

        // Add canvas title
        html_parts.push(format!(
            r#"<h2 class="ax-canvas-title">{}</h2>"#,
            canvas_spec.title
        ));

        // Add canvas content area
        html_parts.push("<div class=\"ax-canvas-content\">".to_string());

        // Render each view in the canvas
        for view_spec in &canvas_spec.views {
            if let Some(renderer) = self.view_registry.get(&view_spec.view_type) {
                let view_html = renderer(view_spec);
                html_parts.push(format!(
                    "<div class=\"ax-view-wrapper\">{}</div>",
                    view_html
                ));
            } else {
                html_parts.push(format!(
                    r#"<div class="ax-unknown-view" data-view-type="{}">Unknown view type: {}</div>"#,
                    view_spec.view_type, view_spec.view_type
                ));
            }
        }

        // Close canvas content area
        html_parts.push("</div>".to_string());

        // Close canvas container
        html_parts.push("</div>".to_string());

        Ok(html_parts.join(""))
    }

    /// Create a new canvas state with default layout and interaction
    pub fn create_canvas_state(&self, canvas_spec: CanvasSpec) -> CanvasState {
        let canvas_id = canvas_spec.canvas_id;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Determine layout strategy based on canvas title or view types
        let layout = self.select_layout_strategy(&canvas_spec);

        // Determine interaction spec based on canvas title or view types
        let interaction = self.select_interaction_spec(&canvas_spec);

        CanvasState {
            canvas_id,
            current_spec: canvas_spec,
            layout,
            interaction,
            view_states: HashMap::new(),
            history: Vec::new(),
            last_updated: now,
        }
    }

    /// Select an appropriate layout strategy for a canvas
    fn select_layout_strategy(&self, canvas_spec: &CanvasSpec) -> LayoutStrategy {
        // If canvas title suggests a dashboard, use dashboard layout
        if canvas_spec.title.to_lowercase().contains("dashboard") {
            return self
                .layout_strategies
                .get("dashboard")
                .cloned()
                .unwrap_or_else(|| self.default_layout_strategy());
        }

        // If canvas has multiple views, use grid layout
        if canvas_spec.views.len() > 1 {
            return LayoutStrategy {
                layout_type: "grid".to_string(),
                constraints: Some(LayoutConstraints {
                    min_width: Some(800),
                    max_width: None,
                    min_height: Some(600),
                    max_height: None,
                    aspect_ratio: None,
                }),
                regions: vec![LayoutRegion {
                    id: "primary".to_string(),
                    region_type: "primary".to_string(),
                    position: Some(LayoutPosition { x: 0.0, y: 0.0 }),
                    size: Some(LayoutSize {
                        width: 100.0,
                        height: 100.0,
                    }),
                    allowed_view_types: vec!["*".to_string()], // Allow all view types
                }],
            };
        }

        // Default to vertical layout for single view
        self.default_layout_strategy()
    }

    /// Select an appropriate interaction spec for a canvas
    fn select_interaction_spec(&self, canvas_spec: &CanvasSpec) -> InteractionSpec {
        // If canvas has a form view, use form interaction spec
        for view in &canvas_spec.views {
            if view.view_type.to_lowercase().contains("form") {
                return self
                    .default_interactions
                    .get("form_view")
                    .cloned()
                    .unwrap_or_else(|| self.default_interaction_spec());
            }
        }

        // If canvas has a graph view, use graph interaction spec
        for view in &canvas_spec.views {
            if view.view_type.to_lowercase().contains("graph") {
                return self
                    .default_interactions
                    .get("graph_view")
                    .cloned()
                    .unwrap_or_else(|| self.default_interaction_spec());
            }
        }

        // Default to list view interaction spec
        self.default_interactions
            .get("list_view")
            .cloned()
            .unwrap_or_else(|| self.default_interaction_spec())
    }

    /// Get default layout strategy
    fn default_layout_strategy(&self) -> LayoutStrategy {
        LayoutStrategy {
            layout_type: "vertical".to_string(),
            constraints: Some(LayoutConstraints {
                min_width: Some(300),
                max_width: None,
                min_height: Some(200),
                max_height: None,
                aspect_ratio: None,
            }),
            regions: vec![LayoutRegion {
                id: "primary".to_string(),
                region_type: "primary".to_string(),
                position: Some(LayoutPosition { x: 0.0, y: 0.0 }),
                size: Some(LayoutSize {
                    width: 100.0,
                    height: 100.0,
                }),
                allowed_view_types: vec!["*".to_string()], // Allow all view types
            }],
        }
    }

    /// Get default interaction spec
    fn default_interaction_spec(&self) -> InteractionSpec {
        InteractionSpec {
            motion: MotionSpec {
                weight: 0.5,
                resistance: 0.4,
                continuity: 0.7,
            },
            color_semantics: ColorSemantics {
                risk: RiskLevel::Read,
                confidence: 0.8,
            },
            spatial_rules: SpatialRules {
                layout_preference: "vertical".to_string(),
                interaction_model: "scroll".to_string(),
            },
        }
    }

    /// Apply an update to a canvas state
    pub fn apply_update(&mut self, state: &mut CanvasState, update: CanvasUpdate) -> Result<()> {
        // Validate update
        if update.canvas_id != state.canvas_id {
            return Err(PKError::InvalidCanvasUpdate(
                "Update canvas_id does not match state canvas_id".to_string(),
            ));
        }

        // Apply changes
        for change in &update.changes {
            match change {
                CanvasChange::AddView { view_spec } => {
                    state.current_spec.views.push(view_spec.clone());
                }
                CanvasChange::RemoveView { view_id } => {
                    state.current_spec.views.retain(|v| v.view_id != *view_id);
                    state.view_states.remove(view_id);
                }
                CanvasChange::UpdateView { view_id, new_spec } => {
                    if let Some(pos) = state
                        .current_spec
                        .views
                        .iter()
                        .position(|v| v.view_id == *view_id)
                    {
                        state.current_spec.views[pos] = new_spec.clone();
                        state.view_states.remove(view_id); // Invalidate view state
                    }
                }
                CanvasChange::MoveView {
                    view_id: _,
                    new_region_id: _,
                } => {
                    // For now, just log that this operation would happen
                    println!("Move view operation would happen");
                }
                CanvasChange::UpdateLayout { new_layout } => {
                    state.layout = new_layout.clone();
                }
                CanvasChange::UpdateInteraction { new_interaction } => {
                    state.interaction = new_interaction.clone();
                }
            }
        }

        // Update timestamp and add to history
        state.last_updated = update.timestamp;
        state.history.push(update);

        // Limit history to prevent memory bloat
        if state.history.len() > 100 {
            state.history.drain(0..50); // Remove oldest 50 updates
        }

        Ok(())
    }

    /// Get a view from the canvas state
    pub fn get_view_state<'a>(
        &'a self,
        state: &'a CanvasState,
        view_id: Uuid,
    ) -> Option<&'a ViewState> {
        state.view_states.get(&view_id)
    }

    /// Update a view's state in the canvas
    pub fn update_view_state(&mut self, state: &mut CanvasState, view_state: ViewState) {
        state.view_states.insert(view_state.view_id, view_state);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CanvasSpec, ViewSpec};

    #[test]
    fn test_canvas_protocol_creation() {
        let protocol = CanvasProtocol::new();
        // View registry starts empty, renderers are registered as needed
        assert!(!protocol.default_interactions.is_empty());
        assert!(!protocol.layout_strategies.is_empty());
    }

    #[test]
    fn test_canvas_rendering() {
        let mut protocol = CanvasProtocol::new();

        // Register a simple renderer for testing
        protocol.register_view_renderer("test_view", |_view_spec: &ViewSpec| -> String {
            "<div class=\"test-view\">Test View Content</div>".to_string()
        });

        let canvas_spec = CanvasSpec {
            canvas_id: Uuid::new_v4(),
            title: "Test Canvas".to_string(),
            views: vec![ViewSpec {
                view_id: Uuid::new_v4(),
                view_type: "test_view".to_string(),
                title: "Test View".to_string(),
                bindings: vec!["test_binding".to_string()],
                region_id: None,
                position: None,
                size: None,
                permissions: None,
                metadata: None,
            }],
            layout_strategy: None,
            interaction_spec: None,
            theme: None,
            permissions: None,
            metadata: None,
        };

        let result = protocol.render_canvas(&canvas_spec);
        assert!(result.is_ok());
        let html = result.unwrap();
        assert!(html.contains("ax-canvas"));
        assert!(html.contains("Test Canvas"));
        assert!(html.contains("test-view"));
    }

    #[test]
    fn test_canvas_state_creation() {
        let protocol = CanvasProtocol::new();

        let canvas_spec = CanvasSpec {
            canvas_id: Uuid::new_v4(),
            title: "Dashboard".to_string(),
            views: vec![],
            layout_strategy: None,
            interaction_spec: None,
            theme: None,
            permissions: None,
            metadata: None,
        };

        let state = protocol.create_canvas_state(canvas_spec);
        assert_eq!(state.canvas_id, state.current_spec.canvas_id);
        assert_eq!(state.layout.layout_type, "grid"); // Dashboard should use grid layout
    }

    #[test]
    fn test_canvas_updates() {
        let mut protocol = CanvasProtocol::new();

        let canvas_spec = CanvasSpec {
            canvas_id: Uuid::new_v4(),
            title: "Test Canvas".to_string(),
            views: vec![],
            layout_strategy: None,
            interaction_spec: None,
            theme: None,
            permissions: None,
            metadata: None,
        };

        let mut state = protocol.create_canvas_state(canvas_spec);

        let view_spec = ViewSpec {
            view_id: Uuid::new_v4(),
            view_type: "test_view".to_string(),
            title: "New View".to_string(),
            bindings: vec!["binding".to_string()],
            region_id: None,
            position: None,
            size: None,
            permissions: None,
            metadata: None,
        };

        let update = CanvasUpdate {
            canvas_id: state.canvas_id,
            changes: vec![CanvasChange::AddView { view_spec }],
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        let result = protocol.apply_update(&mut state, update);
        assert!(result.is_ok());
        assert_eq!(state.current_spec.views.len(), 1);
    }
}

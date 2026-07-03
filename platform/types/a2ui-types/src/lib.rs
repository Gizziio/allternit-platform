//! A2UI Component Types
//!
//! Declarative UI component definitions following Google's A2UI protocol.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct A2UISurface {
    pub surface_id: String,
    pub title: String,
    pub root: ComponentNode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct A2UIPayload {
    pub schema_version: String,
    pub data_model: serde_json::Value,
    pub surfaces: Vec<A2UISurface>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ui_state: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum ComponentNode {
    #[serde(rename = "Container")]
    Container(ContainerProps),
    #[serde(rename = "Card")]
    Card(CardProps),
    #[serde(rename = "Text")]
    Text(TextProps),
    #[serde(rename = "Button")]
    Button(ButtonProps),
    #[serde(rename = "TextField")]
    TextField(TextFieldProps),
    #[serde(rename = "List")]
    List(ListProps),
    #[serde(rename = "DataTable")]
    DataTable(DataTableProps),
    #[serde(rename = "Tabs")]
    Tabs(TabsProps),
    #[serde(rename = "Badge")]
    Badge(BadgeProps),
    #[serde(rename = "Accordion")]
    Accordion(AccordionProps),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BaseProps {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visible_when: Option<VisibleCondition>,
}

impl BaseProps {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            visible_when: None,
        }
    }

    pub fn with_visible_when(mut self, condition: VisibleCondition) -> Self {
        self.visible_when = Some(condition);
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VisibleCondition {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eq: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ne: Option<serde_json::Value>,
}

impl VisibleCondition {
    pub fn eq(path: impl Into<String>, value: impl Into<serde_json::Value>) -> Self {
        Self {
            path: path.into(),
            eq: Some(value.into()),
            ne: None,
        }
    }

    pub fn ne(path: impl Into<String>, value: impl Into<serde_json::Value>) -> Self {
        Self {
            path: path.into(),
            eq: None,
            ne: Some(value.into()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContainerProps {
    #[serde(flatten)]
    pub base: BaseProps,
    pub layout: ContainerLayout,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gap: Option<ContainerGap>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub padding: Option<ContainerPadding>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<ComponentNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ContainerLayout {
    Column,
    Row,
    Stack,
    Grid,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ContainerGap {
    Xs,
    Sm,
    Md,
    Lg,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ContainerPadding {
    None,
    Sm,
    Md,
    Lg,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CardProps {
    #[serde(flatten)]
    pub base: BaseProps,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant: Option<CardVariant>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<ComponentNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CardVariant {
    Default,
    Hero,
    Muted,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TextProps {
    #[serde(flatten)]
    pub base: BaseProps,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub style: Option<TextStyle>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub truncate: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TextStyle {
    H1,
    H2,
    Body,
    Subtle,
    Mono,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ButtonProps {
    #[serde(flatten)]
    pub base: BaseProps,
    pub label: String,
    pub action_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant: Option<ButtonVariant>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requires_confirm: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ButtonVariant {
    Primary,
    Secondary,
    Ghost,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TextFieldProps {
    #[serde(flatten)]
    pub base: BaseProps,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    pub value_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub on_change_binding: Option<OnChangeBinding>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submit_action_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OnChangeBinding {
    pub to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ListProps {
    #[serde(flatten)]
    pub base: BaseProps,
    pub items_path: String,
    pub item_title_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_meta_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub empty_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DataTableProps {
    #[serde(flatten)]
    pub base: BaseProps,
    pub rows_path: String,
    pub columns: Vec<DataTableColumn>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub row_action_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DataTableColumn {
    pub key: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TabsProps {
    #[serde(flatten)]
    pub base: BaseProps,
    pub tabs: Vec<TabDefinition>,
    pub active_tab_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub on_tab_select_binding: Option<OnChangeBinding>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TabDefinition {
    pub id: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BadgeProps {
    #[serde(flatten)]
    pub base: BaseProps,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tone: Option<BadgeTone>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BadgeTone {
    Neutral,
    Info,
    Warn,
    Danger,
    Success,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AccordionProps {
    #[serde(flatten)]
    pub base: BaseProps,
    pub items_path: String,
    pub item_title_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_body_text_path: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ComponentWhitelist {
    pub allowed_types: Vec<&'static str>,
}

impl Default for ComponentWhitelist {
    fn default() -> Self {
        Self {
            allowed_types: vec![
                "Container",
                "Card",
                "Text",
                "Button",
                "TextField",
                "List",
                "DataTable",
                "Tabs",
                "Badge",
                "Accordion",
            ],
        }
    }
}

impl ComponentWhitelist {
    pub fn is_allowed(&self, component_type: &str) -> bool {
        self.allowed_types.contains(&component_type)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_visible_condition() {
        let cond = VisibleCondition::eq("uiState.activeTab", "tab:itinerary");
        assert_eq!(cond.path, "uiState.activeTab");
        assert_eq!(cond.eq, Some(serde_json::json!("tab:itinerary")));
    }

    #[test]
    fn test_component_whitelist() {
        let whitelist = ComponentWhitelist::default();
        assert!(whitelist.is_allowed("Container"));
        assert!(whitelist.is_allowed("Button"));
        assert!(!whitelist.is_allowed("Unknown"));
    }
}
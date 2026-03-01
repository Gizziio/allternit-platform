//! UI Generator Module
//!
//! Assembles generated components into complete UI.

use crate::{Layout, Style, TamboError, UIType};

/// UI Generator
#[derive(Clone)]
pub struct UIGenerator {
    indent_size: usize,
}

impl UIGenerator {
    /// Create a new UI generator
    pub fn new() -> Self {
        Self { indent_size: 2 }
    }

    /// Assemble components into final UI
    pub fn assemble(
        &self,
        components: &[String],
        layout: &Layout,
        styles: &Style,
        ui_type: UIType,
    ) -> Result<String, TamboError> {
        match ui_type {
            UIType::React => self.assemble_react(components, layout, styles),
            UIType::Vue => self.assemble_vue(components, layout, styles),
            UIType::Svelte => self.assemble_svelte(components, layout, styles),
            UIType::Angular => self.assemble_angular(components, layout, styles),
            UIType::WebComponents => self.assemble_web_components(components, layout, styles),
            UIType::PlainHtml => self.assemble_html(components, layout, styles),
        }
    }

    /// Assemble React component
    fn assemble_react(
        &self,
        components: &[String],
        layout: &Layout,
        styles: &Style,
    ) -> Result<String, TamboError> {
        let mut code = String::new();

        // React imports
        code.push_str("import React from 'react';\n");
        code.push_str("import './styles.css';\n\n");

        // Component export
        code.push_str("export default function GeneratedComponent() {\n");
        code.push_str(&self.indent());
        code.push_str("return (\n");

        // Layout wrapper
        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str(&format!("<div className=\"{}\">\n", layout.container_class));

        // Components
        for component in components {
            code.push_str(&self.indent());
            code.push_str(&self.indent());
            code.push_str(&self.indent());
            code.push_str(component);
            code.push('\n');
        }

        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str("</div>\n");

        code.push_str(&self.indent());
        code.push_str(");\n");
        code.push_str("}\n");

        Ok(code)
    }

    /// Assemble Vue component
    fn assemble_vue(
        &self,
        components: &[String],
        layout: &Layout,
        styles: &Style,
    ) -> Result<String, TamboError> {
        let mut code = String::new();

        // Vue template
        code.push_str("<template>\n");
        code.push_str(&self.indent());
        code.push_str(&format!("<div class=\"{}\">\n", layout.container_class));

        for component in components {
            code.push_str(&self.indent());
            code.push_str(&self.indent());
            code.push_str(component);
            code.push('\n');
        }

        code.push_str(&self.indent());
        code.push_str("</div>\n");
        code.push_str("</template>\n\n");

        // Vue script
        code.push_str("<script>\n");
        code.push_str("export default {\n");
        code.push_str(&self.indent());
        code.push_str("name: 'GeneratedComponent'\n");
        code.push_str("};\n");
        code.push_str("</script>\n");

        Ok(code)
    }

    /// Assemble Svelte component
    fn assemble_svelte(
        &self,
        components: &[String],
        layout: &Layout,
        styles: &Style,
    ) -> Result<String, TamboError> {
        let mut code = String::new();

        // Svelte template
        code.push_str(&format!("<div class=\"{}\">\n", layout.container_class));

        for component in components {
            code.push_str(&self.indent());
            code.push_str(component);
            code.push('\n');
        }

        code.push_str("</div>\n\n");

        // Svelte styles
        code.push_str("<style>\n");
        code.push_str("/* Generated styles */\n");
        code.push_str("</style>\n");

        Ok(code)
    }

    /// Assemble Angular component
    fn assemble_angular(
        &self,
        components: &[String],
        layout: &Layout,
        styles: &Style,
    ) -> Result<String, TamboError> {
        let mut code = String::new();

        // Angular imports
        code.push_str("import { Component } from '@angular/core';\n\n");

        // Component decorator
        code.push_str("@Component({\n");
        code.push_str(&self.indent());
        code.push_str("selector: 'app-generated-component',\n");
        code.push_str(&self.indent());
        code.push_str("template: `\n");

        // Template
        code.push_str(&self.indent());
        code.push_str(&format!("<div class=\"{}\">\n", layout.container_class));

        for component in components {
            code.push_str(&self.indent());
            code.push_str(&self.indent());
            code.push_str(component);
            code.push('\n');
        }

        code.push_str(&self.indent());
        code.push_str("</div>\n");
        code.push_str(&self.indent());
        code.push_str("`,\n");
        code.push_str(&self.indent());
        code.push_str("styleUrls: ['./generated.component.css']\n");
        code.push_str("})\n");

        // Component class
        code.push_str("export class GeneratedComponent {\n");
        code.push_str(&self.indent());
        code.push_str("constructor() { }\n");
        code.push_str("}\n");

        Ok(code)
    }

    /// Assemble Web Component
    fn assemble_web_components(
        &self,
        components: &[String],
        layout: &Layout,
        styles: &Style,
    ) -> Result<String, TamboError> {
        let mut code = String::new();

        // Web Component class
        code.push_str("class GeneratedComponent extends HTMLElement {\n");
        code.push_str(&self.indent());
        code.push_str("constructor() {\n");
        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str("super();\n");
        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str("this.attachShadow({ mode: 'open' });\n");
        code.push_str(&self.indent());
        code.push_str("}\n\n");

        code.push_str(&self.indent());
        code.push_str("connectedCallback() {\n");
        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str("this.render();\n");
        code.push_str(&self.indent());
        code.push_str("}\n\n");

        code.push_str(&self.indent());
        code.push_str("render() {\n");
        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str("this.shadowRoot.innerHTML = `\n");

        // Styles in shadow DOM
        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str("<style>\n");
        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str("/* Generated styles */\n");
        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str("</style>\n");

        // Layout wrapper
        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str(&format!("<div class=\"{}\">\n", layout.container_class));

        for component in components {
            code.push_str(&self.indent());
            code.push_str(&self.indent());
            code.push_str(&self.indent());
            code.push_str(&self.indent());
            code.push_str(component);
            code.push('\n');
        }

        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str("</div>\n");

        code.push_str(&self.indent());
        code.push_str(&self.indent());
        code.push_str("`;\n");
        code.push_str(&self.indent());
        code.push_str("}\n");
        code.push_str("}\n\n");

        // Register custom element
        code.push_str("customElements.define('generated-component', GeneratedComponent);\n");

        Ok(code)
    }

    /// Assemble plain HTML
    fn assemble_html(
        &self,
        components: &[String],
        layout: &Layout,
        styles: &Style,
    ) -> Result<String, TamboError> {
        let mut code = String::new();

        // HTML doctype
        code.push_str("<!DOCTYPE html>\n");
        code.push_str("<html>\n");
        code.push_str("<head>\n");
        code.push_str(&self.indent());
        code.push_str("<meta charset=\"UTF-8\">\n");
        code.push_str(&self.indent());
        code.push_str("<title>Generated UI</title>\n");
        code.push_str(&self.indent());
        code.push_str("<link rel=\"stylesheet\" href=\"styles.css\">\n");
        code.push_str("</head>\n");
        code.push_str("<body>\n");

        // Layout wrapper
        code.push_str(&self.indent());
        code.push_str(&format!("<div class=\"{}\">\n", layout.container_class));

        for component in components {
            code.push_str(&self.indent());
            code.push_str(&self.indent());
            code.push_str(component);
            code.push('\n');
        }

        code.push_str(&self.indent());
        code.push_str("</div>\n");
        code.push_str("</body>\n");
        code.push_str("</html>\n");

        Ok(code)
    }

    /// Get indentation string
    fn indent(&self) -> String {
        " ".repeat(self.indent_size)
    }
}

impl Default for UIGenerator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        LayoutConstraints, LayoutRegionSpec, RegionPosition, RegionSize, SpacingSpec, Style,
        StyleSpec, TypographySpec,
    };

    #[test]
    fn test_generator_creation() {
        let generator = UIGenerator::new();
        assert_eq!(generator.indent_size, 2);
    }

    #[test]
    fn test_indent_generation() {
        let generator = UIGenerator::new();
        assert_eq!(generator.indent(), "  ");
    }

    #[test]
    fn test_assemble_react() {
        let generator = UIGenerator::new();
        let components = vec!["<button>Click</button>".to_string()];
        let layout = Layout {
            container_class: "container".to_string(),
            regions: vec![],
        };
        let style = Style { css: String::new() };

        let result = generator.assemble(&components, &layout, &style, UIType::React);
        assert!(result.is_ok());
        let code = result.unwrap();
        assert!(code.contains("import React"));
        assert!(code.contains("GeneratedComponent"));
    }

    #[test]
    fn test_assemble_vue() {
        let generator = UIGenerator::new();
        let components = vec!["<button>Click</button>".to_string()];
        let layout = Layout {
            container_class: "container".to_string(),
            regions: vec![],
        };
        let style = Style { css: String::new() };

        let result = generator.assemble(&components, &layout, &style, UIType::Vue);
        assert!(result.is_ok());
        let code = result.unwrap();
        assert!(code.contains("<template>"));
        assert!(code.contains("<script>"));
    }

    #[test]
    fn test_assemble_svelte() {
        let generator = UIGenerator::new();
        let components = vec!["<button>Click</button>".to_string()];
        let layout = Layout {
            container_class: "container".to_string(),
            regions: vec![],
        };
        let style = Style { css: String::new() };

        let result = generator.assemble(&components, &layout, &style, UIType::Svelte);
        assert!(result.is_ok());
        let code = result.unwrap();
        assert!(code.contains("<style>"));
    }

    #[test]
    fn test_assemble_html() {
        let generator = UIGenerator::new();
        let components = vec!["<button>Click</button>".to_string()];
        let layout = Layout {
            container_class: "container".to_string(),
            regions: vec![],
        };
        let style = Style { css: String::new() };

        let result = generator.assemble(&components, &layout, &style, UIType::PlainHtml);
        assert!(result.is_ok());
        let code = result.unwrap();
        assert!(code.contains("<!DOCTYPE html>"));
        assert!(code.contains("<html>"));
    }

    #[test]
    fn test_assemble_angular() {
        let generator = UIGenerator::new();
        let components = vec!["<button>Click</button>".to_string()];
        let layout = Layout {
            container_class: "container".to_string(),
            regions: vec![],
        };
        let style = Style { css: String::new() };

        let result = generator.assemble(&components, &layout, &style, UIType::Angular);
        assert!(result.is_ok());
        let code = result.unwrap();
        assert!(code.contains("@Component"));
        assert!(code.contains("selector: 'app-generated-component'"));
        assert!(code.contains("export class GeneratedComponent"));
    }

    #[test]
    fn test_assemble_web_components() {
        let generator = UIGenerator::new();
        let components = vec!["<button>Click</button>".to_string()];
        let layout = Layout {
            container_class: "container".to_string(),
            regions: vec![],
        };
        let style = Style { css: String::new() };

        let result = generator.assemble(&components, &layout, &style, UIType::WebComponents);
        assert!(result.is_ok());
        let code = result.unwrap();
        assert!(code.contains("class GeneratedComponent extends HTMLElement"));
        assert!(code.contains("this.attachShadow"));
        assert!(code.contains("customElements.define"));
    }
}

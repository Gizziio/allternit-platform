/**
 * MoA Synthesizer
 * 
 * Aggregates outputs from multiple tasks into unified artifacts.
 * Generates final Sparkpage-style documents.
 */

use crate::moa::types::*;
use serde_json::{json, Value};

pub struct MoASynthesizer {
    config: MoAConfig,
}

impl MoASynthesizer {
    pub fn new(config: MoAConfig) -> Self {
        Self { config }
    }

    /// Synthesize task outputs into final artifacts
    pub async fn synthesize(&self, graph: &MoAGraph) -> Result<SynthesisResult, String> {
        let mut result = SynthesisResult::default();
        
        // Collect outputs by type
        let mut text_outputs: Vec<String> = Vec::new();
        let mut code_outputs: Vec<CodeArtifact> = Vec::new();
        let mut image_outputs: Vec<ImageArtifact> = Vec::new();
        let mut audio_outputs: Vec<AudioArtifact> = Vec::new();
        let mut video_outputs: Vec<VideoArtifact> = Vec::new();
        let mut search_results: Vec<SearchResult> = Vec::new();
        
        for task in &graph.tasks {
            if task.status != TaskStatus::Complete {
                continue;
            }
            
            if let Some(output) = &task.output {
                match output {
                    TaskOutput::Text(text) => {
                        text_outputs.push(text.clone());
                    }
                    TaskOutput::Code { language, content } => {
                        code_outputs.push(CodeArtifact {
                            language: language.clone(),
                            content: content.clone(),
                            task_id: task.id.clone(),
                        });
                    }
                    TaskOutput::Image { url, width, height } => {
                        image_outputs.push(ImageArtifact {
                            url: url.clone(),
                            width: *width,
                            height: *height,
                            task_id: task.id.clone(),
                        });
                    }
                    TaskOutput::Audio { url, duration_secs } => {
                        audio_outputs.push(AudioArtifact {
                            url: url.clone(),
                            duration_secs: *duration_secs,
                            task_id: task.id.clone(),
                        });
                    }
                    TaskOutput::Video { url, duration_secs } => {
                        video_outputs.push(VideoArtifact {
                            url: url.clone(),
                            duration_secs: *duration_secs,
                            task_id: task.id.clone(),
                        });
                    }
                    TaskOutput::Search { results } => {
                        search_results.extend(results.clone());
                    }
                    TaskOutput::Data(_) => {}
                }
            }
        }
        
        // Generate primary artifact based on prompt intent
        let primary_artifact = self.generate_primary_artifact(
            &graph.original_prompt,
            &text_outputs,
            &code_outputs,
            &image_outputs,
            &search_results,
        )?;
        
        result.primary_artifact = Some(primary_artifact);
        result.code_artifacts = code_outputs;
        result.image_artifacts = image_outputs;
        result.audio_artifacts = audio_outputs;
        result.video_artifacts = video_outputs;
        result.search_results = search_results;
        result.task_count = graph.tasks.len();
        result.completed_count = graph.tasks_by_status(TaskStatus::Complete).len();
        
        Ok(result)
    }

    /// Generate primary artifact based on intent
    fn generate_primary_artifact(
        &self,
        prompt: &str,
        texts: &[String],
        codes: &[CodeArtifact],
        images: &[ImageArtifact],
        search_results: &[SearchResult],
    ) -> Result<Artifact, String> {
        let prompt_lower = prompt.to_lowercase();
        
        // Determine artifact type from prompt
        if prompt_lower.contains("slide") || prompt_lower.contains("presentation") || prompt_lower.contains("deck") {
            return self.create_slides_artifact(texts, prompt);
        }
        
        if prompt_lower.contains("sheet") || prompt_lower.contains("spreadsheet") || prompt_lower.contains("table") || prompt_lower.contains("data") {
            return self.create_sheet_artifact(texts, search_results, prompt);
        }
        
        if prompt_lower.contains("website") || prompt_lower.contains("landing page") || prompt_lower.contains("html") {
            return self.create_website_artifact(codes, images, prompt);
        }
        
        if prompt_lower.contains("document") || prompt_lower.contains("article") || prompt_lower.contains("blog") || prompt_lower.contains("write") {
            return self.create_document_artifact(texts, search_results, prompt);
        }
        
        // Default: create document
        self.create_document_artifact(texts, search_results, prompt)
    }

    fn create_document_artifact(
        &self,
        texts: &[String],
        search_results: &[SearchResult],
        prompt: &str,
    ) -> Result<Artifact, String> {
        let mut content = String::new();
        
        // Add title
        content.push_str(&format!("# {}\n\n", self.extract_title(prompt)));
        
        // Add search context if available
        if !search_results.is_empty() {
            content.push_str("## Research\n\n");
            for result in search_results.iter().take(5) {
                content.push_str(&format!(
                    "- [{}]({}) - {}\n",
                    result.title, result.url, result.snippet
                ));
            }
            content.push_str("\n---\n\n");
        }
        
        // Add generated content
        for text in texts {
            content.push_str(text);
            content.push_str("\n\n");
        }
        
        Ok(Artifact {
            kind: "document".to_string(),
            title: self.extract_title(prompt),
            content: Some(content),
            url: None,
            metadata: serde_json::json!({
                "type": "document",
                "word_count": content.split_whitespace().count(),
            }),
        })
    }

    fn create_slides_artifact(
        &self,
        texts: &[String],
        prompt: &str,
    ) -> Result<Artifact, String> {
        let mut content = String::new();
        
        // Add title slide
        content.push_str(&format!("# {}\n\n", self.extract_title(prompt)));
        content.push_str("Generated Presentation\n\n");
        content.push_str("---\n\n");
        
        // Create slides from text
        for (i, text) in texts.iter().enumerate() {
            content.push_str(&format!("## Slide {}\n\n", i + 1));
            content.push_str(text);
            content.push_str("\n\n");
            content.push_str("---\n\n");
        }
        
        Ok(Artifact {
            kind: "slides".to_string(),
            title: format!("{} - Presentation", self.extract_title(prompt)),
            content: Some(content),
            url: None,
            metadata: serde_json::json!({
                "type": "slides",
                "slide_count": texts.len() + 1,
            }),
        })
    }

    fn create_sheet_artifact(
        &self,
        texts: &[String],
        search_results: &[SearchResult],
        prompt: &str,
    ) -> Result<Artifact, String> {
        let mut content = String::new();
        
        // Add headers
        content.push_str("Name,Type,Value,Source\n");
        
        // Add data rows from search results
        for result in search_results {
            content.push_str(&format!(
                "{},{},{},{}\n",
                result.title,
                "Research",
                result.relevance_score,
                result.url
            ));
        }
        
        Ok(Artifact {
            kind: "sheet".to_string(),
            title: format!("{} - Data", self.extract_title(prompt)),
            content: Some(content),
            url: None,
            metadata: serde_json::json!({
                "type": "sheet",
                "row_count": search_results.len(),
            }),
        })
    }

    fn create_website_artifact(
        &self,
        codes: &[CodeArtifact],
        images: &[ImageArtifact],
        prompt: &str,
    ) -> Result<Artifact, String> {
        // Find HTML code or generate wrapper
        let html_code = codes.iter()
            .find(|c| c.language == "html")
            .or_else(|| codes.first())
            .map(|c| c.content.clone())
            .unwrap_or_else(|| self.generate_html_wrapper(prompt, images));
        
        Ok(Artifact {
            kind: "html".to_string(),
            title: self.extract_title(prompt),
            content: Some(html_code),
            url: None,
            metadata: serde_json::json!({
                "type": "website",
                "image_count": images.len(),
            }),
        })
    }

    fn generate_html_wrapper(&self, prompt: &str, images: &[ImageArtifact]) -> String {
        let mut html = String::new();
        html.push_str("<!DOCTYPE html>\n<html>\n<head>\n");
        html.push_str(&format!("<title>{}</title>\n", self.extract_title(prompt)));
        html.push_str("<style>\n");
        html.push_str("body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }\n");
        html.push_str("h1 { color: #333; }\n");
        html.push_str(".image-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }\n");
        html.push_str("img { width: 100%; border-radius: 8px; }\n");
        html.push_str("</style>\n");
        html.push_str("</head>\n<body>\n");
        html.push_str(&format!("<h1>{}</h1>\n", self.extract_title(prompt)));
        
        if !images.is_empty() {
            html.push_str("<div class=\"image-grid\">\n");
            for image in images {
                html.push_str(&format!("<img src=\"{}\" alt=\"Generated image\">\n", image.url));
            }
            html.push_str("</div>\n");
        }
        
        html.push_str("</body>\n</html>");
        html
    }

    fn extract_title(&self, prompt: &str) -> String {
        // Extract first line or first 50 chars as title
        let first_line = prompt.lines().next().unwrap_or(prompt);
        if first_line.len() > 50 {
            format!("{}...", &first_line[..50])
        } else {
            first_line.to_string()
        }
    }
}

/// Synthesis result containing all artifacts
#[derive(Debug, Clone, Default)]
pub struct SynthesisResult {
    pub primary_artifact: Option<Artifact>,
    pub code_artifacts: Vec<CodeArtifact>,
    pub image_artifacts: Vec<ImageArtifact>,
    pub audio_artifacts: Vec<AudioArtifact>,
    pub video_artifacts: Vec<VideoArtifact>,
    pub search_results: Vec<SearchResult>,
    pub task_count: usize,
    pub completed_count: usize,
}

/// Generic artifact structure
#[derive(Debug, Clone)]
pub struct Artifact {
    pub kind: String,
    pub title: String,
    pub content: Option<String>,
    pub url: Option<String>,
    pub metadata: Value,
}

/// Specialized artifact types
#[derive(Debug, Clone)]
pub struct CodeArtifact {
    pub language: String,
    pub content: String,
    pub task_id: String,
}

#[derive(Debug, Clone)]
pub struct ImageArtifact {
    pub url: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub task_id: String,
}

#[derive(Debug, Clone)]
pub struct AudioArtifact {
    pub url: String,
    pub duration_secs: Option<f32>,
    pub task_id: String,
}

#[derive(Debug, Clone)]
pub struct VideoArtifact {
    pub url: String,
    pub duration_secs: Option<f32>,
    pub task_id: String,
}

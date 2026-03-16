/**
 * MoA Router
 * 
 * Analyzes user prompts and generates task DAGs.
 * Routes different parts of the prompt to appropriate models.
 */

use crate::moa::types::*;
use serde_json::{json, Value};
use std::collections::HashMap;

pub struct MoARouter {
    config: MoAConfig,
}

impl MoARouter {
    pub fn new(config: MoAConfig) -> Self {
        Self { config }
    }

    /// Analyze prompt and generate task graph
    pub async fn route(&self, prompt: &str) -> Result<MoAGraph, String> {
        // Step 1: Use router model to analyze prompt and extract tasks
        let analysis = self.analyze_prompt(prompt).await?;
        
        // Step 2: Build task graph from analysis
        let mut graph = MoAGraph::new(prompt.to_string());
        
        // Step 3: Create tasks based on analysis
        for (i, task_desc) in analysis.tasks.iter().enumerate() {
            let task = self.create_task(task_desc, i, &analysis.dependencies, &analysis.tasks)?;
            graph.tasks.push(task);
        }
        
        // Step 4: Validate graph (check for cycles, etc.)
        self.validate_graph(&mut graph)?;
        
        Ok(graph)
    }

    /// Analyze prompt using router model
    async fn analyze_prompt(&self, prompt: &str) -> Result<PromptAnalysis, String> {
        // In production, this would call the router model (e.g., Gemini 2.5 Flash)
        // For now, we'll use heuristic-based analysis
        
        let mut analysis = PromptAnalysis::default();
        
        // Detect task types from prompt keywords
        let prompt_lower = prompt.to_lowercase();
        
        // Image generation tasks
        if prompt_lower.contains("image") || prompt_lower.contains("picture") || 
           prompt_lower.contains("draw") || prompt_lower.contains("generate") && 
           (prompt_lower.contains("visual") || prompt_lower.contains("logo") || prompt_lower.contains("design")) {
            analysis.tasks.push(TaskDescription {
                task_type: TaskType::Image,
                description: "Generate image(s) based on prompt".to_string(),
                model_id: self.config.default_models.image.clone(),
                priority: 1,
            });
        }
        
        // Code generation tasks
        if prompt_lower.contains("code") || prompt_lower.contains("function") || 
           prompt_lower.contains("website") || prompt_lower.contains("app") ||
           prompt_lower.contains("html") || prompt_lower.contains("css") ||
           prompt_lower.contains("javascript") || prompt_lower.contains("python") {
            analysis.tasks.push(TaskDescription {
                task_type: TaskType::Code,
                description: "Generate code".to_string(),
                model_id: self.config.default_models.code.clone(),
                priority: 0,
            });
        }
        
        // Text/content tasks
        if prompt_lower.contains("write") || prompt_lower.contains("document") || 
           prompt_lower.contains("article") || prompt_lower.contains("blog") ||
           prompt_lower.contains("slides") || prompt_lower.contains("presentation") ||
           prompt_lower.contains("sheet") || prompt_lower.contains("spreadsheet") {
            analysis.tasks.push(TaskDescription {
                task_type: TaskType::Text,
                description: "Generate text content".to_string(),
                model_id: self.config.default_models.text.clone(),
                priority: 0,
            });
        }
        
        // Search tasks
        if prompt_lower.contains("research") || prompt_lower.contains("find") || 
           prompt_lower.contains("search") || prompt_lower.contains("look up") {
            analysis.tasks.push(TaskDescription {
                task_type: TaskType::Search,
                description: "Search for information".to_string(),
                model_id: self.config.default_models.search.clone(),
                priority: 0,
            });
        }
        
        // If no specific tasks detected, default to text
        if analysis.tasks.is_empty() {
            analysis.tasks.push(TaskDescription {
                task_type: TaskType::Text,
                description: "Process prompt".to_string(),
                model_id: self.config.default_models.text.clone(),
                priority: 0,
            });
        }
        
        // Detect dependencies (e.g., search before writing)
        let search_idx = analysis.tasks.iter().position(|t| t.task_type == TaskType::Search);
        let text_idx = analysis.tasks.iter().position(|t| t.task_type == TaskType::Text);
        
        if let (Some(search_i), Some(text_i)) = (search_idx, text_idx) {
            analysis.dependencies.push((search_i, text_i));
        }
        
        Ok(analysis)
    }

    /// Create a task from description
    fn create_task(
        &self,
        desc: &TaskDescription,
        index: usize,
        dependencies: &[(usize, usize)],
        all_tasks: &[TaskDescription],
    ) -> Result<MoATask, String> {
        let task_id = format!("task-{}-{}", desc.task_type_as_str(), index);
        
        // Find dependencies for this task
        let dep_ids: Vec<String> = dependencies
            .iter()
            .filter(|(_, to)| *to == index)
            .map(|(from, _)| format!("task-{}-{}", 
                all_tasks[*from].task_type_as_str(),
                from
            ))
            .collect();
        
        Ok(MoATask {
            id: task_id,
            task_type: desc.task_type.clone(),
            model_id: desc.model_id.clone(),
            prompt: desc.description.clone(),
            status: TaskStatus::Pending,
            progress: Some(0),
            output: None,
            error: None,
            dependencies: dep_ids,
            metadata: HashMap::new(),
        })
    }

    /// Validate task graph (check for cycles, orphaned dependencies, etc.)
    fn validate_graph(&self, graph: &mut MoAGraph) -> Result<(), String> {
        // Check for cycles using DFS
        let task_ids: HashMap<&str, usize> = graph.tasks.iter()
            .enumerate()
            .map(|(i, t)| (t.id.as_str(), i))
            .collect();
        
        for task in &graph.tasks {
            for dep_id in &task.dependencies {
                if !task_ids.contains_key(dep_id.as_str()) {
                    return Err(format!("Task {} has unknown dependency: {}", task.id, dep_id));
                }
            }
        }
        
        // Topological sort to detect cycles
        let mut visited = vec![false; graph.tasks.len()];
        let mut rec_stack = vec![false; graph.tasks.len()];
        
        for i in 0..graph.tasks.len() {
            if !visited[i] {
                if self.has_cycle(i, &task_ids, &mut visited, &mut rec_stack, graph)? {
                    return Err("Task graph contains a cycle".to_string());
                }
            }
        }
        
        Ok(())
    }

    /// DFS cycle detection
    fn has_cycle(
        &self,
        node_idx: usize,
        task_ids: &HashMap<&str, usize>,
        visited: &mut Vec<bool>,
        rec_stack: &mut Vec<bool>,
        graph: &MoAGraph,
    ) -> Result<bool, String> {
        visited[node_idx] = true;
        rec_stack[node_idx] = true;
        
        let task = &graph.tasks[node_idx];
        for dep_id in &task.dependencies {
            if let Some(&dep_idx) = task_ids.get(dep_id.as_str()) {
                if !visited[dep_idx] {
                    if self.has_cycle(dep_idx, task_ids, visited, rec_stack, graph)? {
                        return Ok(true);
                    }
                } else if rec_stack[dep_idx] {
                    return Ok(true);
                }
            }
        }
        
        rec_stack[node_idx] = false;
        Ok(false)
    }
}

/// Prompt analysis result
#[derive(Debug, Clone, Default)]
struct PromptAnalysis {
    tasks: Vec<TaskDescription>,
    dependencies: Vec<(usize, usize)>, // (from_task_idx, to_task_idx)
}

/// Task description from analysis
#[derive(Debug, Clone)]
struct TaskDescription {
    task_type: TaskType,
    description: String,
    model_id: String,
    priority: u8,
}

impl TaskDescription {
    fn task_type_as_str(&self) -> &'static str {
        self.task_type.task_type_as_str()
    }
}

impl TaskType {
    fn task_type_as_str(&self) -> &'static str {
        match self {
            TaskType::Text => "text",
            TaskType::Code => "code",
            TaskType::Image => "image",
            TaskType::Audio => "audio",
            TaskType::Video => "video",
            TaskType::Search => "search",
            TaskType::Telephony => "telephony",
            TaskType::Browser => "browser",
            TaskType::FileRead => "fileread",
            TaskType::FileWrite => "filewrite",
            TaskType::Command => "command",
        }
    }
}

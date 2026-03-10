/**
 * MoA Executor
 * 
 * Executes tasks in parallel based on dependency graph.
 * Manages model routing and task state.
 */

use crate::moa::types::*;
use tokio::sync::mpsc;
use std::sync::Arc;
use tokio::task::JoinHandle;

pub struct MoAExecutor {
    config: MoAConfig,
    max_parallel: usize,
}

impl MoAExecutor {
    pub fn new(config: MoAConfig) -> Self {
        let max_parallel = config.max_parallel_tasks;
        Self { config, max_parallel }
    }

    /// Execute all tasks in the graph with parallelism
    pub async fn execute(
        &self,
        mut graph: MoAGraph,
        progress_tx: mpsc::UnboundedSender<MoAGraph>,
    ) -> Result<MoAGraph, String> {
        graph.status = GraphStatus::Running;
        let _ = progress_tx.send(graph.clone());

        // Build dependency map
        let mut task_status: std::collections::HashMap<String, TaskStatus> = graph.tasks.iter()
            .map(|t| (t.id.clone(), t.status.clone()))
            .collect();

        // Track completed tasks for dependency resolution
        let mut completed: std::collections::HashSet<String> = std::collections::HashSet::new();
        
        // Execute tasks in waves based on dependencies
        let mut pending_tasks: Vec<usize> = (0..graph.tasks.len()).collect();
        
        while !pending_tasks.is_empty() {
            // Find tasks that can run (all dependencies satisfied)
            let mut ready_tasks = Vec::new();
            let mut still_pending = Vec::new();
            
            for &task_idx in &pending_tasks {
                let task = &graph.tasks[task_idx];
                let deps_satisfied = task.dependencies.iter()
                    .all(|dep| completed.contains(dep));
                
                if deps_satisfied {
                    ready_tasks.push(task_idx);
                } else {
                    still_pending.push(task_idx);
                }
            }
            
            if ready_tasks.is_empty() {
                if still_pending.is_empty() {
                    break; // All done
                } else {
                    // Deadlock or error - tasks waiting on failed deps
                    for task_idx in still_pending {
                        graph.tasks[task_idx].status = TaskStatus::Skipped;
                        graph.tasks[task_idx].error = Some("Dependency failed".to_string());
                    }
                    break;
                }
            }
            
            // Execute ready tasks in parallel (up to max_parallel)
            let mut batches = ready_tasks.chunks(self.max_parallel);
            
            while let Some(batch) = batches.next() {
                let mut handles: Vec<JoinHandle<Result<(usize, TaskOutput), String>>> = Vec::new();
                
                // Mark tasks as running
                for &task_idx in batch {
                    graph.tasks[task_idx].status = TaskStatus::Running;
                    graph.tasks[task_idx].progress = Some(0);
                }
                let _ = progress_tx.send(graph.clone());
                
                // Spawn tasks
                for &task_idx in batch {
                    let task = graph.tasks[task_idx].clone();
                    let handle = tokio::spawn(async move {
                        execute_single_task(task).await
                    });
                    handles.push(handle);
                }
                
                // Wait for all tasks in batch
                for (i, handle) in handles.into_iter().enumerate() {
                    let task_idx = batch[i];
                    match handle.await {
                        Ok(Ok(output)) => {
                            graph.tasks[task_idx].status = TaskStatus::Complete;
                            graph.tasks[task_idx].progress = Some(100);
                            graph.tasks[task_idx].output = Some(output);
                            completed.insert(graph.tasks[task_idx].id.clone());
                        }
                        Ok(Err(e)) => {
                            graph.tasks[task_idx].status = TaskStatus::Error;
                            graph.tasks[task_idx].error = Some(e);
                        }
                        Err(e) => {
                            graph.tasks[task_idx].status = TaskStatus::Error;
                            graph.tasks[task_idx].error = Some(format!("Task panicked: {}", e));
                        }
                    }
                    task_status.insert(graph.tasks[task_idx].id.clone(), graph.tasks[task_idx].status.clone());
                }
                
                let _ = progress_tx.send(graph.clone());
            }
            
            pending_tasks = still_pending;
        }
        
        // Set final graph status
        if graph.has_errors() {
            graph.status = GraphStatus::Error;
        } else if graph.is_complete() {
            graph.status = GraphStatus::Complete;
            graph.completed_at = Some(chrono::Utc::now().timestamp());
        }
        
        graph.updated_at = chrono::Utc::now().timestamp();
        let _ = progress_tx.send(graph.clone());
        
        Ok(graph)
    }
}

/// Execute a single task based on its type
async fn execute_single_task(task: MoATask) -> Result<TaskOutput, String> {
    // In production, this would route to actual model APIs
    // For now, we'll simulate execution
    
    match task.task_type {
        TaskType::Text => {
            // Call text model (Claude, Gemini, etc.)
            simulate_text_generation(&task.prompt).await
        }
        TaskType::Code => {
            // Call code model
            simulate_code_generation(&task.prompt).await
        }
        TaskType::Image => {
            // Call image generation API (FLUX, DALL-E)
            simulate_image_generation(&task.prompt).await
        }
        TaskType::Audio => {
            // Call audio generation API (ElevenLabs)
            simulate_audio_generation(&task.prompt).await
        }
        TaskType::Video => {
            // Call video generation API (Kling, Sora)
            simulate_video_generation(&task.prompt).await
        }
        TaskType::Search => {
            // Call search API
            simulate_search(&task.prompt).await
        }
        _ => {
            Err(format!("Unsupported task type: {:?}", task.task_type))
        }
    }
}

// Simulation functions (replace with actual API calls in production)

async fn simulate_text_generation(prompt: &str) -> Result<TaskOutput, String> {
    // Simulate delay
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    Ok(TaskOutput::Text(format!(
        "[Generated text for: {}]",
        prompt.chars().take(50).collect::<String>()
    )))
}

async fn simulate_code_generation(prompt: &str) -> Result<TaskOutput, String> {
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    Ok(TaskOutput::Code {
        language: "javascript".to_string(),
        content: format!("// Generated code for: {}", prompt),
    })
}

async fn simulate_image_generation(prompt: &str) -> Result<TaskOutput, String> {
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
    
    Ok(TaskOutput::Image {
        url: "https://example.com/generated-image.png".to_string(),
        width: Some(1024),
        height: Some(1024),
    })
}

async fn simulate_audio_generation(prompt: &str) -> Result<TaskOutput, String> {
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
    
    Ok(TaskOutput::Audio {
        url: "https://example.com/generated-audio.mp3".to_string(),
        duration_secs: Some(30.0),
    })
}

async fn simulate_video_generation(prompt: &str) -> Result<TaskOutput, String> {
    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
    
    Ok(TaskOutput::Video {
        url: "https://example.com/generated-video.mp4".to_string(),
        duration_secs: Some(10.0),
    })
}

async fn simulate_search(prompt: &str) -> Result<TaskOutput, String> {
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    Ok(TaskOutput::Search {
        results: vec![
            SearchResult {
                title: "Search Result 1".to_string(),
                url: "https://example.com/1".to_string(),
                snippet: "Relevant information found...".to_string(),
                relevance_score: 0.95,
            },
        ],
    })
}

/**
 * MoA Service
 * 
 * Main service entry point for Mixture of Agents orchestration.
 * Provides HTTP API for submitting and monitoring MoA jobs.
 */

use crate::moa::types::*;
use crate::moa::router::MoARouter;
use crate::moa::executor::MoAExecutor;
use crate::moa::synthesizer::MoASynthesizer;
use tokio::sync::{mpsc, RwLock};
use std::collections::HashMap;
use std::sync::Arc;

/// MoA Service state
pub struct MoAService {
    config: MoAConfig,
    router: MoARouter,
    executor: MoAExecutor,
    synthesizer: MoASynthesizer,
    jobs: Arc<RwLock<HashMap<String, MoAJob>>>,
}

/// MoA Job (tracks execution state)
#[derive(Debug, Clone)]
pub struct MoAJob {
    pub id: String,
    pub graph: MoAGraph,
    pub status: JobStatus,
    pub created_at: i64,
    pub updated_at: i64,
    pub result: Option<SynthesisResult>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JobStatus {
    Queued,
    Running,
    Complete,
    Error,
    Cancelled,
}

impl MoAService {
    pub fn new(config: MoAConfig) -> Self {
        let router = MoARouter::new(config.clone());
        let executor = MoAExecutor::new(config.clone());
        let synthesizer = MoASynthesizer::new(config.clone());
        let jobs = Arc::new(RwLock::new(HashMap::new()));
        
        Self {
            config,
            router,
            executor,
            synthesizer,
            jobs,
        }
    }

    /// Submit a new MoA job
    pub async fn submit(&self, prompt: String) -> Result<String, String> {
        // Route prompt to generate task graph
        let graph = self.router.route(&prompt).await?;
        
        let job_id = graph.id.clone();
        let job = MoAJob {
            id: job_id.clone(),
            graph,
            status: JobStatus::Queued,
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            result: None,
        };
        
        // Store job
        {
            let mut jobs = self.jobs.write().await;
            jobs.insert(job_id.clone(), job);
        }
        
        // Start execution in background
        self.execute_job(job_id.clone());
        
        Ok(job_id)
    }

    /// Get job status
    pub async fn get_job(&self, job_id: &str) -> Option<MoAJob> {
        let jobs = self.jobs.read().await;
        jobs.get(job_id).cloned()
    }

    /// Cancel a job
    pub async fn cancel(&self, job_id: &str) -> Result<(), String> {
        let mut jobs = self.jobs.write().await;
        
        if let Some(job) = jobs.get_mut(job_id) {
            if job.status == JobStatus::Running || job.status == JobStatus::Queued {
                job.status = JobStatus::Cancelled;
                job.updated_at = chrono::Utc::now().timestamp();
                return Ok(());
            }
            return Err("Job cannot be cancelled in current state".to_string());
        }
        
        Err("Job not found".to_string())
    }

    /// Execute job in background
    fn execute_job(&self, job_id: String) {
        let jobs = self.jobs.clone();
        let executor = self.executor.clone();
        let synthesizer = self.synthesizer.clone();
        
        tokio::spawn(async move {
            // Create progress channel
            let (progress_tx, mut progress_rx) = mpsc::unbounded_channel::<MoAGraph>();
            
            // Get initial graph
            let graph = {
                let jobs = jobs.read().await;
                if let Some(job) = jobs.get(&job_id) {
                    job.graph.clone()
                } else {
                    return;
                }
            };
            
            // Update job status to running
            {
                let mut jobs = jobs.write().await;
                if let Some(job) = jobs.get_mut(&job_id) {
                    job.status = JobStatus::Running;
                }
            }
            
            // Execute graph
            let executor_clone = MoAExecutor::new(MoAConfig::default());
            let result = executor_clone.execute(graph, progress_tx).await;
            
            // Process progress updates
            while let Ok(graph) = progress_rx.try_recv() {
                let mut jobs = jobs.write().await;
                if let Some(job) = jobs.get_mut(&job_id) {
                    job.graph = graph;
                    job.updated_at = chrono::Utc::now().timestamp();
                    
                    // Update status based on graph
                    job.status = match job.graph.status {
                        GraphStatus::Complete => JobStatus::Complete,
                        GraphStatus::Error => JobStatus::Error,
                        GraphStatus::Cancelled => JobStatus::Cancelled,
                        _ => JobStatus::Running,
                    };
                }
            }
            
            // Synthesize results if complete
            let mut jobs = jobs.write().await;
            if let Some(job) = jobs.get_mut(&job_id) {
                if job.status == JobStatus::Complete {
                    let synthesizer_clone = MoASynthesizer::new(MoAConfig::default());
                    match synthesizer_clone.synthesize(&job.graph).await {
                        Ok(result) => {
                            job.result = Some(result);
                        }
                        Err(e) => {
                            job.status = JobStatus::Error;
                            // Could store error message in graph metadata
                        }
                    }
                }
                job.updated_at = chrono::Utc::now().timestamp();
            }
        });
    }

    /// Get all jobs (for admin/monitoring)
    pub async fn list_jobs(&self) -> Vec<MoAJob> {
        let jobs = self.jobs.read().await;
        jobs.values().cloned().collect()
    }

    /// Stream job progress (SSE)
    pub async fn stream_progress(
        &self,
        job_id: String,
    ) -> mpsc::UnboundedReceiver<MoAProgressEvent> {
        let (tx, rx) = mpsc::unbounded_channel();
        let jobs = self.jobs.clone();
        
        tokio::spawn(async move {
            let mut last_progress = 0;
            
            loop {
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                
                let jobs_read = jobs.read().await;
                if let Some(job) = jobs_read.get(&job_id) {
                    let progress = job.graph.progress();
                    
                    if progress != last_progress {
                        let _ = tx.send(MoAProgressEvent {
                            job_id: job_id.clone(),
                            progress,
                            status: job.status.clone(),
                            task_statuses: job.graph.tasks.iter()
                                .map(|t| (t.id.clone(), t.status.clone(), t.progress))
                                .collect(),
                        });
                        last_progress = progress;
                    }
                    
                    // Stop if job is done
                    if job.status == JobStatus::Complete || 
                       job.status == JobStatus::Error ||
                       job.status == JobStatus::Cancelled {
                        break;
                    }
                } else {
                    break; // Job not found
                }
            }
        });
        
        rx
    }
}

/// Progress event for SSE streaming
#[derive(Debug, Clone)]
pub struct MoAProgressEvent {
    pub job_id: String,
    pub progress: u8,
    pub status: JobStatus,
    pub task_statuses: Vec<(String, TaskStatus, Option<u8>)>,
}

// Clone implementation for MoAExecutor (needed for spawn)
impl Clone for MoAExecutor {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            max_parallel: self.max_parallel,
        }
    }
}

// Clone implementation for MoASynthesizer
impl Clone for MoASynthesizer {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
        }
    }
}

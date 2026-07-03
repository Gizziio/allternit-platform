use crate::intent_graph::IntentGraphKernel;
use crate::journal_ledger::JournalLedger;
use crate::state_engine::StateEngine;
use serde::{Deserialize, Serialize};
use std::collections::BinaryHeap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{self, Duration};

/// Task priority (higher = more urgent)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskPriority {
    Critical = 10,
    High = 7,
    Normal = 5,
    Low = 3,
    Background = 1,
}

impl Ord for TaskPriority {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        (*self as i32).cmp(&(*other as i32))
    }
}

impl PartialOrd for TaskPriority {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

/// Scheduled task with priority
#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct ScheduledTask {
    pub task_id: String,
    pub priority: TaskPriority,
    pub dag_id: String,
    pub node_id: String,
    pub wih_id: String,
    pub run_id: String,
    pub scheduled_at: String,
    pub deadline: Option<String>,
    pub resource_requirements: ResourceRequirements,
}

/// Resource requirements for a task
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ResourceRequirements {
    pub cpu_cores: Option<f32>,
    pub memory_mb: Option<u64>,
    pub gpu_count: Option<u32>,
    pub max_duration_seconds: Option<u64>,
}

impl Eq for ResourceRequirements {}

/// Admission control decision
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AdmissionDecision {
    Allow,
    Deny { reason: String },
    Queue { position: usize, estimated_wait_seconds: u64 },
}

/// Scheduler configuration
#[derive(Debug, Clone)]
pub struct SchedulerConfig {
    pub interval_seconds: u64,
    pub max_concurrent_tasks: usize,
    pub admission_control_enabled: bool,
    pub priority_boost_threshold_seconds: u64,  // Boost priority if deadline within this threshold
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            interval_seconds: 10,
            max_concurrent_tasks: 10,
            admission_control_enabled: true,
            priority_boost_threshold_seconds: 300,  // 5 minutes
        }
    }
}

/// Priority queue entry
#[derive(Debug, Clone, Eq, PartialEq)]
struct PriorityQueueEntry {
    priority: TaskPriority,
    scheduled_at: chrono::DateTime<chrono::Utc>,
    task: ScheduledTask,
}

impl Ord for PriorityQueueEntry {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        // Higher priority first, then earlier scheduled_at
        self.priority
            .cmp(&other.priority)
            .then_with(|| other.scheduled_at.cmp(&self.scheduled_at))
    }
}

impl PartialOrd for PriorityQueueEntry {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

pub struct Scheduler {
    config: SchedulerConfig,
    pending_tasks: Arc<RwLock<BinaryHeap<PriorityQueueEntry>>>,
    running_tasks: Arc<RwLock<usize>>,
    total_capacity: Arc<RwLock<ResourceCapacity>>,
}

/// Current resource capacity
#[derive(Debug, Clone, Default)]
pub struct ResourceCapacity {
    pub available_cpu_cores: f32,
    pub available_memory_mb: u64,
    pub available_gpu_count: u32,
}

impl Scheduler {
    pub fn new(config: SchedulerConfig) -> Self {
        Self {
            config,
            pending_tasks: Arc::new(RwLock::new(BinaryHeap::new())),
            running_tasks: Arc::new(RwLock::new(0)),
            total_capacity: Arc::new(RwLock::new(ResourceCapacity {
                available_cpu_cores: 8.0,
                available_memory_mb: 16384,
                available_gpu_count: 1,
            })),
        }
    }

    pub fn with_defaults() -> Self {
        Self::new(SchedulerConfig::default())
    }

    /// Schedule a new task
    pub async fn schedule_task(&self, task: ScheduledTask) -> AdmissionDecision {
        if !self.config.admission_control_enabled {
            // Add directly to queue
            self.add_to_queue(task).await;
            return AdmissionDecision::Allow;
        }

        // Check if we can admit this task
        match self.check_admission(&task).await {
            AdmissionDecision::Allow => {
                self.add_to_queue(task).await;
                AdmissionDecision::Allow
            }
            decision => decision,
        }
    }

    /// Check admission for a task
    async fn check_admission(&self, task: &ScheduledTask) -> AdmissionDecision {
        let running = *self.running_tasks.read().await;
        
        if running >= self.config.max_concurrent_tasks {
            // Estimate queue position and wait time
            let queue = self.pending_tasks.read().await;
            let position = queue.len() + 1;
            let estimated_wait = position as u64 * 60;  // Rough estimate: 1 minute per task
            
            return AdmissionDecision::Queue {
                position,
                estimated_wait_seconds: estimated_wait,
            };
        }

        // Check resource requirements
        let capacity = self.total_capacity.read().await;
        
        if let Some(required_cpu) = task.resource_requirements.cpu_cores {
            if required_cpu > capacity.available_cpu_cores {
                return AdmissionDecision::Deny {
                    reason: format!(
                        "Insufficient CPU: requested {}, available {}",
                        required_cpu, capacity.available_cpu_cores
                    ),
                };
            }
        }

        if let Some(required_memory) = task.resource_requirements.memory_mb {
            if required_memory > capacity.available_memory_mb {
                return AdmissionDecision::Deny {
                    reason: format!(
                        "Insufficient memory: requested {}MB, available {}MB",
                        required_memory, capacity.available_memory_mb
                    ),
                };
            }
        }

        AdmissionDecision::Allow
    }

    /// Add task to priority queue
    async fn add_to_queue(&self, task: ScheduledTask) {
        let scheduled_at = chrono::Utc::now();
        
        // Apply priority boost if deadline is approaching
        let mut priority = task.priority;
        if let Some(deadline_str) = &task.deadline {
            if let Ok(deadline) = chrono::DateTime::parse_from_rfc3339(deadline_str) {
                let until_deadline = deadline.signed_duration_since(chrono::Utc::now());
                if until_deadline.num_seconds() < self.config.priority_boost_threshold_seconds as i64 {
                    priority = TaskPriority::Critical;
                }
            }
        }

        let entry = PriorityQueueEntry {
            priority,
            scheduled_at,
            task,
        };

        let mut queue = self.pending_tasks.write().await;
        queue.push(entry);
    }

    /// Get next task to execute (highest priority)
    pub async fn next_task(&self) -> Option<ScheduledTask> {
        let mut queue = self.pending_tasks.write().await;
        let mut running = self.running_tasks.write().await;

        if *running >= self.config.max_concurrent_tasks {
            return None;
        }

        queue.pop().map(|entry| {
            *running += 1;
            entry.task
        })
    }

    /// Mark task as completed
    pub async fn complete_task(&self, task_id: &str) {
        let mut running = self.running_tasks.write().await;
        *running = running.saturating_sub(1);
        
        tracing::debug!("Task {} completed, running tasks: {}", task_id, *running);
    }

    /// Start the scheduler background task
    pub async fn start(
        &self,
        state_engine: Arc<StateEngine>,
        ledger: Arc<JournalLedger>,
        intent_graph: Arc<RwLock<IntentGraphKernel>>,
    ) {
        let config = self.config.clone();
        let pending_tasks = self.pending_tasks.clone();
        let running_tasks = self.running_tasks.clone();

        tokio::spawn(async move {
            let mut interval_timer = time::interval(Duration::from_secs(config.interval_seconds));
            loop {
                interval_timer.tick().await;
                
                // Run proactive check
                let suggestions = state_engine.check_deltas(&ledger, &intent_graph).await;
                if !suggestions.is_empty() {
                    tracing::info!(
                        "Proactive State Engine found {} suggestions",
                        suggestions.len()
                    );
                }

                // Log queue status
                let queue_len = pending_tasks.read().await.len();
                let running = *running_tasks.read().await;
                
                if queue_len > 0 || running > 0 {
                    tracing::debug!(
                        "Scheduler status: {} pending, {} running",
                        queue_len,
                        running
                    );
                }
            }
        });
    }

    /// Get scheduler statistics
    pub async fn get_stats(&self) -> SchedulerStats {
        let queue = self.pending_tasks.read().await;
        let running = *self.running_tasks.read().await;

        SchedulerStats {
            pending_tasks: queue.len(),
            running_tasks: running,
            max_concurrent_tasks: self.config.max_concurrent_tasks,
            admission_control_enabled: self.config.admission_control_enabled,
        }
    }
}

/// Scheduler statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerStats {
    pub pending_tasks: usize,
    pub running_tasks: usize,
    pub max_concurrent_tasks: usize,
    pub admission_control_enabled: bool,
}

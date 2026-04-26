//! DAG/WIH Executor
//!
//! Creates and manages execution plans for DAG/WIH structures.

use crate::*;
use std::collections::{HashMap, HashSet, VecDeque};
use tracing::{debug, info, warn};

/// Executor for DAG/WIH structures
pub struct DagExecutor;

impl DagExecutor {
    /// Create a new executor
    pub fn new() -> Self {
        Self
    }

    /// Create an execution plan for a graph
    pub fn create_plan(
        &self,
        graph: &Graph,
        wih_files: &HashMap<String, WorkItemHeader>,
    ) -> Result<ExecutionPlan, DagWihError> {
        info!("Creating execution plan for graph: {}", graph.graph_id);
        
        // Build dependency graph
        let mut dependencies: HashMap<&str, HashSet<&str>> = HashMap::new();
        let mut dependents: HashMap<&str, Vec<&str>> = HashMap::new();
        
        for node in &graph.nodes {
            dependencies.entry(&node.task_id).or_default();
            
            for dep in &node.blocked_by {
                dependencies.get_mut(node.task_id.as_str()).unwrap().insert(dep.as_str());
                dependents.entry(dep.as_str()).or_default().push(&node.task_id);
            }
        }
        
        // Topological sort (Kahn's algorithm)
        let mut in_degree: HashMap<&str, usize> = HashMap::new();
        for (node_id, deps) in &dependencies {
            in_degree.insert(node_id, deps.len());
        }
        
        let mut queue: VecDeque<&str> = in_degree
            .iter()
            .filter(|(_, &deg)| deg == 0)
            .map(|(&id, _)| id)
            .collect();
        
        let mut execution_order: Vec<String> = Vec::new();
        
        while let Some(node_id) = queue.pop_front() {
            execution_order.push(node_id.to_string());
            
            if let Some(deps) = dependents.get(node_id) {
                for &dependent in deps {
                    let deg = in_degree.get_mut(dependent).unwrap();
                    *deg -= 1;
                    if *deg == 0 {
                        queue.push_back(dependent);
                    }
                }
            }
        }
        
        // Check if all nodes were processed
        if execution_order.len() != graph.nodes.len() {
            return Err(DagWihError::ExecutionError(
                "Cycle detected in graph - cannot create execution plan".to_string()
            ));
        }
        
        // Build execution stages (parallelizable tasks)
        let stages = self.build_stages(&execution_order, &dependencies);
        
        // Calculate depth for each task (clone to avoid borrow issues)
        let exec_order_clone = execution_order.clone();
        let depths = self.calculate_depths(&exec_order_clone, &dependencies);
        
        // Build task details
        let mut tasks = HashMap::new();
        for node in &graph.nodes {
            let wih = wih_files.get(&node.task_id).cloned();
            let depth = depths.get(&node.task_id.as_str()).copied().unwrap_or(0);
            
            tasks.insert(
                node.task_id.clone(),
                ExecutionTask {
                    task_id: node.task_id.clone(),
                    title: node.title.clone(),
                    wih_path: node.wih_path.clone(),
                    wih,
                    dependencies: node.blocked_by.clone(),
                    depth,
                    estimated_duration_secs: None, // Could be estimated from historical data
                },
            );
        }
        
        let plan = ExecutionPlan {
            graph_id: graph.graph_id.clone(),
            created_at: Utc::now(),
            stages,
            execution_order,
            tasks,
            parallelizable_groups: self.identify_parallel_groups(&depths, &dependencies),
        };
        
        info!(
            "Execution plan created: {} tasks in {} stages",
            plan.tasks.len(),
            plan.stages.len()
        );
        
        Ok(plan)
    }

    /// Build execution stages (tasks that can run in parallel)
    fn build_stages<'a>(
        &self,
        execution_order: &[String],
        dependencies: &HashMap<&'a str, HashSet<&'a str>>,
    ) -> Vec<ExecutionStage> {
        let mut stages: Vec<ExecutionStage> = Vec::new();
        let mut completed: HashSet<&str> = HashSet::new();
        
        for task_id in execution_order {
            // Find the earliest stage where all dependencies are satisfied
            let dep_satisfied_stage = dependencies
                .get(task_id.as_str())
                .map(|deps| {
                    deps.iter()
                        .filter_map(|dep| {
                            stages.iter().enumerate().find_map(|(idx, stage)| {
                                if stage.tasks.contains(&dep.to_string()) {
                                    Some(idx)
                                } else {
                                    None
                                }
                            })
                        })
                        .max()
                        .map(|max| max + 1)
                        .unwrap_or(0)
                })
                .unwrap_or(0);
            
            // Add task to appropriate stage
            if dep_satisfied_stage >= stages.len() {
                stages.push(ExecutionStage {
                    stage_number: dep_satisfied_stage,
                    tasks: vec![task_id.clone()],
                });
            } else {
                stages[dep_satisfied_stage].tasks.push(task_id.clone());
            }
            
            completed.insert(task_id.as_str());
        }
        
        stages
    }

    /// Calculate depth (longest path from root) for each task
    fn calculate_depths<'a>(
        &self,
        execution_order: &'a [String],
        dependencies: &HashMap<&'a str, HashSet<&'a str>>,
    ) -> HashMap<&'a str, usize> {
        let mut depths: HashMap<&'a str, usize> = HashMap::new();
        
        for task_id in execution_order {
            let depth = dependencies
                .get(task_id.as_str())
                .map(|deps| {
                    deps.iter()
                        .filter_map(|dep| depths.get(dep).copied())
                        .max()
                        .map(|max| max + 1)
                        .unwrap_or(0)
                })
                .unwrap_or(0);
            
            depths.insert(task_id.as_str(), depth);
        }
        
        depths
    }

    /// Identify groups of tasks that can run in parallel
    fn identify_parallel_groups<'a>(
        &self,
        depths: &HashMap<&'a str, usize>,
        dependencies: &HashMap<&'a str, HashSet<&'a str>>,
    ) -> Vec<Vec<String>> {
        let mut groups: HashMap<usize, Vec<String>> = HashMap::new();
        
        for (task_id, depth) in depths {
            groups.entry(*depth).or_default().push(task_id.to_string());
        }
        
        let mut result: Vec<(usize, Vec<String>)> = groups.into_iter().collect();
        result.sort_by_key(|(depth, _)| *depth);
        result.into_iter().map(|(_, tasks)| tasks).collect()
    }

    /// Estimate total duration based on task history
    pub fn estimate_duration(&self, plan: &ExecutionPlan) -> std::time::Duration {
        // This would typically use historical data
        // For now, use a simple heuristic: 1 hour per task
        let total_tasks = plan.tasks.len();
        let parallel_stages = plan.stages.len();
        
        // Estimate: tasks in parallel stages reduce total time
        let estimated_hours = (total_tasks as f64 / 2.0).max(parallel_stages as f64);
        
        std::time::Duration::from_secs((estimated_hours * 3600.0) as u64)
    }

    /// Check if a task is ready to execute
    pub fn is_task_ready(
        &self,
        task_id: &str,
        plan: &ExecutionPlan,
        completed_tasks: &HashSet<String>,
    ) -> bool {
        if let Some(task) = plan.tasks.get(task_id) {
            task.dependencies.iter().all(|dep| completed_tasks.contains(dep))
        } else {
            false
        }
    }

    /// Get next ready tasks
    pub fn get_next_ready_tasks(
        &self,
        plan: &ExecutionPlan,
        completed_tasks: &HashSet<String>,
        in_progress_tasks: &HashSet<String>,
    ) -> Vec<String> {
        plan.execution_order
            .iter()
            .filter(|task_id| {
                !completed_tasks.contains(*task_id)
                    && !in_progress_tasks.contains(*task_id)
                    && self.is_task_ready(task_id, plan, completed_tasks)
            })
            .cloned()
            .collect()
    }
}

impl Default for DagExecutor {
    fn default() -> Self {
        Self::new()
    }
}

/// Execution plan for a graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionPlan {
    pub graph_id: String,
    pub created_at: DateTime<Utc>,
    pub stages: Vec<ExecutionStage>,
    pub execution_order: Vec<String>,
    pub tasks: HashMap<String, ExecutionTask>,
    pub parallelizable_groups: Vec<Vec<String>>,
}

/// An execution stage (tasks that can run in parallel)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionStage {
    pub stage_number: usize,
    pub tasks: Vec<String>,
}

/// Execution task details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTask {
    pub task_id: String,
    pub title: String,
    pub wih_path: String,
    pub wih: Option<WorkItemHeader>,
    pub dependencies: Vec<String>,
    pub depth: usize,
    /// Estimated duration in seconds
    pub estimated_duration_secs: Option<u64>,
}

/// Execution context for running tasks
pub struct ExecutionContext {
    pub plan: ExecutionPlan,
    pub completed_tasks: HashSet<String>,
    pub in_progress_tasks: HashSet<String>,
    pub failed_tasks: HashMap<String, String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
}

impl ExecutionContext {
    /// Create a new execution context
    pub fn new(plan: ExecutionPlan) -> Self {
        Self {
            plan,
            completed_tasks: HashSet::new(),
            in_progress_tasks: HashSet::new(),
            failed_tasks: HashMap::new(),
            start_time: None,
            end_time: None,
        }
    }

    /// Start execution
    pub fn start(&mut self) {
        self.start_time = Some(Utc::now());
        info!("Started execution of graph: {}", self.plan.graph_id);
    }

    /// Mark a task as in progress
    pub fn start_task(&mut self, task_id: &str) {
        self.in_progress_tasks.insert(task_id.to_string());
        debug!("Task {} started", task_id);
    }

    /// Mark a task as completed
    pub fn complete_task(&mut self, task_id: &str) {
        self.in_progress_tasks.remove(task_id);
        self.completed_tasks.insert(task_id.to_string());
        debug!("Task {} completed", task_id);
    }

    /// Mark a task as failed
    pub fn fail_task(&mut self, task_id: &str, error: String) {
        self.in_progress_tasks.remove(task_id);
        self.failed_tasks.insert(task_id.to_string(), error);
        warn!("Task {} failed: {}", task_id, self.failed_tasks.get(task_id).unwrap());
    }

    /// Check if execution is complete
    pub fn is_complete(&self) -> bool {
        self.completed_tasks.len() + self.failed_tasks.len() == self.plan.tasks.len()
    }

    /// Check if execution succeeded (all tasks completed)
    pub fn is_success(&self) -> bool {
        self.is_complete() && self.failed_tasks.is_empty()
    }

    /// Get progress percentage
    pub fn progress_percent(&self) -> f64 {
        let total = self.plan.tasks.len();
        if total == 0 {
            return 100.0;
        }
        let done = self.completed_tasks.len() + self.failed_tasks.len();
        (done as f64 / total as f64) * 100.0
    }

    /// Get elapsed time
    pub fn elapsed(&self) -> Option<chrono::Duration> {
        self.start_time.map(|start| Utc::now() - start)
    }

    /// End execution
    pub fn end(&mut self) {
        self.end_time = Some(Utc::now());
        let status = if self.is_success() { "succeeded" } else { "completed with failures" };
        info!(
            "Execution of graph {} {}: {}/{} tasks completed",
            self.plan.graph_id,
            status,
            self.completed_tasks.len(),
            self.plan.tasks.len()
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_graph() -> Graph {
        Graph {
            graph_id: "exec-test".to_string(),
            created_at: None,
            title: "Execution Test".to_string(),
            subgraphs: vec![],
            nodes: vec![
                GraphNode {
                    task_id: "A".to_string(),
                    title: "Task A".to_string(),
                    blocked_by: vec![],
                    wih_path: "/.allternit/wih/A.wih.json".to_string(),
                    wih: None,
                },
                GraphNode {
                    task_id: "B".to_string(),
                    title: "Task B".to_string(),
                    blocked_by: vec!["A".to_string()],
                    wih_path: "/.allternit/wih/B.wih.json".to_string(),
                    wih: None,
                },
                GraphNode {
                    task_id: "C".to_string(),
                    title: "Task C".to_string(),
                    blocked_by: vec!["A".to_string()],
                    wih_path: "/.allternit/wih/C.wih.json".to_string(),
                    wih: None,
                },
                GraphNode {
                    task_id: "D".to_string(),
                    title: "Task D".to_string(),
                    blocked_by: vec!["B".to_string(), "C".to_string()],
                    wih_path: "/.allternit/wih/D.wih.json".to_string(),
                    wih: None,
                },
            ],
            edges: vec![
                GraphEdge { from: "A".to_string(), to: "B".to_string() },
                GraphEdge { from: "A".to_string(), to: "C".to_string() },
                GraphEdge { from: "B".to_string(), to: "D".to_string() },
                GraphEdge { from: "C".to_string(), to: "D".to_string() },
            ],
            meta_policy: None,
        }
    }

    #[test]
    fn test_execution_plan_creation() {
        let graph = create_test_graph();
        let executor = DagExecutor::new();
        
        let plan = executor.create_plan(&graph, &HashMap::new()).unwrap();
        
        assert_eq!(plan.graph_id, "exec-test");
        assert_eq!(plan.tasks.len(), 4);
        
        // A should be first
        assert_eq!(plan.execution_order[0], "A");
        
        // D should be last
        assert_eq!(plan.execution_order[3], "D");
        
        // B and C should be in the middle (order may vary)
        let middle: HashSet<_> = plan.execution_order[1..3].iter().cloned().collect();
        assert!(middle.contains("B"));
        assert!(middle.contains("C"));
    }

    #[test]
    fn test_parallel_groups() {
        let graph = create_test_graph();
        let executor = DagExecutor::new();
        
        let plan = executor.create_plan(&graph, &HashMap::new()).unwrap();
        
        // Should have 3 parallel groups:
        // Group 0: A
        // Group 1: B, C (both depend on A)
        // Group 2: D (depends on B and C)
        assert_eq!(plan.parallelizable_groups.len(), 3);
        assert_eq!(plan.parallelizable_groups[0], vec!["A"]);
        assert!(plan.parallelizable_groups[1].contains(&"B".to_string()));
        assert!(plan.parallelizable_groups[1].contains(&"C".to_string()));
        assert_eq!(plan.parallelizable_groups[2], vec!["D"]);
    }

    #[test]
    fn test_execution_context() {
        let graph = create_test_graph();
        let executor = DagExecutor::new();
        let plan = executor.create_plan(&graph, &HashMap::new()).unwrap();
        
        let mut context = ExecutionContext::new(plan);
        
        context.start();
        assert!(context.start_time.is_some());
        
        context.start_task("A");
        assert!(context.in_progress_tasks.contains("A"));
        
        context.complete_task("A");
        assert!(!context.in_progress_tasks.contains("A"));
        assert!(context.completed_tasks.contains("A"));
        
        assert!(!context.is_complete());
        
        // Complete remaining tasks
        context.complete_task("B");
        context.complete_task("C");
        context.complete_task("D");
        
        assert!(context.is_complete());
        assert!(context.is_success());
        assert_eq!(context.progress_percent(), 100.0);
    }
}

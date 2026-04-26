# Selfhosted Executor Architecture

// OWNER: T1-A1

**GAP:** GAP-46  
**Version:** 1.0.0  
**Status:** DRAFT  
**Created:** 2026-02-24  
**Owner:** T1-A1  

---

## 1. Overview

The Selfhosted Executor is a containerized job execution system designed to run agent workloads in isolated Docker environments. It provides resource management, job queuing, and container orchestration for the Allternitchitech platform.

### 1.1 Purpose

- Execute agent jobs in isolated Docker containers
- Manage container lifecycle (create, start, stop, remove)
- Handle resource allocation and limits
- Provide job queuing and scheduling
- Support volume mounts and environment variables

### 1.2 Scope

This document covers:
- System architecture and components
- Component responsibilities and interfaces
- Job lifecycle and state transitions
- Sequence diagrams for key operations

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Selfhosted Executor                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Executor   │  │   Runtime    │  │    JobQueue          │  │
│  │   Service    │  │   Manager    │  │    Service           │  │
│  │              │  │              │  │                      │  │
│  │ - Job Runner │  │ - Container  │  │ - Priority Queue     │  │
│  │ - Lifecycle  │  │   Lifecycle  │  │ - Scheduling         │  │
│  │ - Status     │  │ - Resource   │  │ - Job Routing        │  │
│  │   Tracking   │  │   Binding    │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┼──────────────────────┘              │
│                           │                                     │
│                  ┌────────▼────────┐                            │
│                  │  ResourceManager │                            │
│                  │                  │                            │
│                  │ - CPU/Memory     │                            │
│                  │ - Disk Quotas    │                            │
│                  │ - Concurrency    │                            │
│                  └────────┬────────┘                            │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                  ┌─────────▼─────────┐
                  │   Docker Engine   │
                  │   (bollard)       │
                  └───────────────────┘
```

---

## 3. Components

### 3.1 Executor Service

**Module:** `src/executor.rs`

The Executor is the primary job execution engine. It coordinates job lifecycle and manages execution state.

#### Responsibilities

- Accept and validate job submissions
- Coordinate with Runtime for container operations
- Track job status and emit events
- Handle job completion and cleanup

#### Interface

```rust
pub trait ExecutorService {
    /// Submit a new job for execution
    async fn submit(&self, job: Job) -> Result<JobId>;
    
    /// Cancel a running or pending job
    async fn cancel(&self, job_id: JobId) -> Result<()>;
    
    /// Get job status
    async fn status(&self, job_id: JobId) -> Result<JobStatus>;
    
    /// List all jobs with optional filter
    async fn list(&self, filter: Option<JobFilter>) -> Result<Vec<JobSummary>>;
}
```

#### State Machine

```
                    ┌─────────────┐
         submit     │             │
    ───────────────►│   PENDING   │
                    │             │
                    └──────┬──────┘
                           │ schedule
                           ▼
                    ┌─────────────┐
                    │   QUEUED    │
                    │             │
                    └──────┬──────┘
                           │ acquire resources
                           ▼
                    ┌─────────────┐
                    │   STARTING  │
                    │             │
                    └──────┬──────┘
                           │ container started
                           ▼
                    ┌─────────────┐
                    │   RUNNING   │
                    │             │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         complete     fail/timeout   cancel
              │            │            │
              ▼            ▼            ▼
       ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
       │ COMPLETED   │ │  FAILED     │ │ CANCELLED   │
       │             │ │             │ │             │
       └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
              │               │               │
              └───────────────┼───────────────┘
                              │ cleanup
                              ▼
                       ┌─────────────┐
                       │ TERMINATED  │
                       │             │
                       └─────────────┘
```

---

### 3.2 Runtime Manager

**Module:** `src/runtime.rs`

The Runtime Manager handles Docker container operations and lifecycle.

#### Responsibilities

- Container creation with specified configuration
- Image pulling and management
- Container start/stop/restart operations
- Container removal and cleanup
- Log streaming and capture

#### Interface

```rust
pub trait RuntimeManager {
    /// Pull Docker image if not present
    async fn pull_image(&self, image: &str, auth: Option<AuthConfig>) -> Result<()>;
    
    /// Create container from image
    async fn create_container(&self, config: ContainerConfig) -> Result<ContainerId>;
    
    /// Start a created container
    async fn start_container(&self, container_id: ContainerId) -> Result<()>;
    
    /// Stop a running container
    async fn stop_container(&self, container_id: ContainerId, timeout: Option<Duration>) -> Result<()>;
    
    /// Remove a container
    async fn remove_container(&self, container_id: ContainerId, force: bool) -> Result<()>;
    
    /// Stream container logs
    async fn logs(&self, container_id: ContainerId, follow: bool) -> Result<LogStream>;
    
    /// Get container status
    async fn inspect(&self, container_id: ContainerId) -> Result<ContainerInfo>;
}
```

#### Container Configuration

```rust
pub struct ContainerConfig {
    /// Docker image to use
    pub image: String,
    
    /// Command to execute
    pub command: Vec<String>,
    
    /// Environment variables
    pub env: HashMap<String, String>,
    
    /// Volume mounts
    pub volumes: Vec<VolumeMount>,
    
    /// Resource limits
    pub resources: ResourceLimits,
    
    /// Network mode
    pub network_mode: NetworkMode,
    
    /// Working directory
    pub working_dir: Option<String>,
    
    /// User ID
    pub user: Option<String>,
}

pub struct VolumeMount {
    /// Host path or named volume
    pub source: String,
    
    /// Container path
    pub target: String,
    
    /// Mount options (ro, rw, etc.)
    pub options: Vec<String>,
}

pub struct ResourceLimits {
    /// CPU limit in cores
    pub cpu_limit: Option<f64>,
    
    /// Memory limit in bytes
    pub memory_limit: Option<u64>,
    
    /// Disk quota in bytes
    pub disk_quota: Option<u64>,
}
```

---

### 3.3 JobQueue Service

**Module:** `src/job_queue.rs`

The JobQueue manages job scheduling and prioritization.

#### Responsibilities

- Maintain priority queue of pending jobs
- Schedule jobs based on priority and resource availability
- Route jobs to appropriate executors
- Track queue metrics and statistics

#### Interface

```rust
pub trait JobQueueService {
    /// Enqueue a job
    async fn enqueue(&self, job: QueuedJob) -> Result<QueuePosition>;
    
    /// Dequeue next job for execution
    async fn dequeue(&self) -> Result<Option<QueuedJob>>;
    
    /// Peek at next job without removing
    async fn peek(&self) -> Result<Option<QueuedJob>>;
    
    /// Remove job from queue
    async fn remove(&self, job_id: JobId) -> Result<()>;
    
    /// Get queue length
    async fn len(&self) -> Result<usize>;
    
    /// Get job position in queue
    async fn position(&self, job_id: JobId) -> Result<Option<usize>>;
}
```

#### Priority Levels

| Priority | Value | Description |
|----------|-------|-------------|
| CRITICAL | 100   | System-critical jobs |
| HIGH     | 75    | User-facing agent jobs |
| NORMAL   | 50    | Standard background jobs |
| LOW      | 25    | Maintenance tasks |
| BATCH    | 10    | Bulk processing jobs |

#### Scheduling Policy

1. **Priority-based**: Higher priority jobs scheduled first
2. **Fair scheduling**: Prevent starvation of low-priority jobs
3. **Resource-aware**: Consider resource requirements when scheduling
4. **Affinity**: Prefer executors with cached images/volumes

---

### 3.4 ResourceManager

**Module:** `src/resource_manager.rs`

The ResourceManager tracks and allocates system resources.

#### Responsibilities

- Track available CPU, memory, and disk resources
- Allocate resources to jobs
- Enforce resource limits and quotas
- Monitor resource utilization
- Handle resource reclamation

#### Interface

```rust
pub trait ResourceManagerService {
    /// Get total system resources
    fn total_resources(&self) -> SystemResources;
    
    /// Get available resources
    async fn available_resources(&self) -> SystemResources;
    
    /// Allocate resources for a job
    async fn allocate(&self, request: ResourceRequest) -> Result<Allocation>;
    
    /// Release allocated resources
    async fn release(&self, allocation: Allocation) -> Result<()>;
    
    /// Get resource utilization metrics
    async fn metrics(&self) -> ResourceMetrics;
}

pub struct SystemResources {
    pub cpu_cores: f64,
    pub memory_bytes: u64,
    pub disk_bytes: u64,
}

pub struct ResourceRequest {
    pub cpu_cores: Option<f64>,
    pub memory_bytes: Option<u64>,
    pub disk_bytes: Option<u64>,
}

pub struct Allocation {
    pub allocation_id: String,
    pub job_id: JobId,
    pub resources: SystemResources,
    pub created_at: Instant,
}
```

#### Resource Tracking

```
┌─────────────────────────────────────────────────────────┐
│                    Resource Pool                         │
│                                                          │
│  CPU:    ████████████████░░░░░░░░  12/20 cores          │
│  Memory: ████████████████████░░░░  48/64 GB             │
│  Disk:   ██████░░░░░░░░░░░░░░░░░░  200/1000 GB          │
│                                                          │
│  Active Allocations: 8                                   │
│  Queued Requests: 3                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Job Lifecycle

### 4.1 End-to-End Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Client │     │  Queue  │     │Executor │     │ Runtime │
│         │     │         │     │         │     │         │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │ Submit Job    │               │               │
     │──────────────►│               │               │
     │               │               │               │
     │               │ Enqueue       │               │
     │               │──────────────►│               │
     │               │               │               │
     │ JobId         │               │               │
     │◄──────────────│               │               │
     │               │               │               │
     │               │ Dequeue       │               │
     │               │──────────────►│               │
     │               │               │               │
     │               │               │ Allocate      │
     │               │               │ Resources     │
     │               │               │──────────────►│
     │               │               │               │
     │               │               │ Allocation    │
     │               │               │◄──────────────│
     │               │               │               │
     │               │               │ Pull Image    │
     │               │               │──────────────►│
     │               │               │               │
     │               │               │ Image Ready   │
     │               │               │◄──────────────│
     │               │               │               │
     │               │               │ Create        │
     │               │               │ Container     │
     │               │               │──────────────►│
     │               │               │               │
     │               │               │ Container     │
     │               │               │◄──────────────│
     │               │               │               │
     │               │               │ Start         │
     │               │               │ Container     │
     │───────────────│───────────────│──────────────►│
     │ Job Started   │               │               │
     │◄──────────────│               │               │
     │               │               │               │
     │               │               │ Monitor       │
     │               │               │◄──────────────│
     │               │               │               │
     │               │               │ Complete      │
     │               │               │◄──────────────│
     │               │               │               │
     │               │               │ Release       │
     │               │               │ Resources     │
     │               │               │──────────────►│
     │               │               │               │
     │ Job Complete  │               │               │
     │◄──────────────│               │               │
     │               │               │               │
```

### 4.2 Job Submission Sequence

```
Client          Executor        JobQueue      ResourceManager   Docker
  │                │               │                │             │
  │ submit(job)    │               │                │             │
  │───────────────►│               │                │             │
  │                │ validate(job) │                │             │
  │                │──────┐        │                │             │
  │                │◄─────┘        │                │             │
  │                │               │                │             │
  │                │ enqueue(job)  │                │             │
  │                │──────────────►│                │             │
  │                │               │ push(job)      │             │
  │                │               │──────┐         │             │
  │                │               │◄─────┘         │             │
  │                │               │                │             │
  │ JobId          │               │                │             │
  │◄───────────────│               │                │             │
  │                │               │                │             │
```

### 4.3 Job Execution Sequence

```
Executor        JobQueue      ResourceManager   Runtime       Container
  │               │                │              │             │
  │ dequeue()     │                │              │             │
  │──────────────►│                │              │             │
  │               │                │              │             │
  │ Job           │                │              │             │
  │◄──────────────│                │              │             │
  │               │                │              │             │
  │ allocate(req) │                │              │             │
  │───────────────────────────────►│              │             │
  │               │                │              │             │
  │ Allocation    │                │              │             │
  │◄───────────────────────────────│              │             │
  │               │                │              │             │
  │ pull(image)   │                │              │             │
  │──────────────────────────────────────────────►│             │
  │               │                │              │             │
  │ ImageReady    │                │              │             │
  │◄──────────────────────────────────────────────│             │
  │               │                │              │             │
  │ create(cfg)   │                │              │             │
  │──────────────────────────────────────────────►│             │
  │               │                │              │              │
  │ ContainerId   │                │              │             │
  │◄──────────────────────────────────────────────│             │
  │               │                │              │             │
  │ start(id)     │                │              │             │
  │──────────────────────────────────────────────►│             │
  │               │                │              │              │
  │ Started       │                │              │             │
  │◄──────────────────────────────────────────────│             │
  │               │                │              │             │
  │               │                │              │  Execute    │
  │               │                │              │  Command    │
  │               │                │              │──────┐      │
  │               │                │              │◄─────┘      │
  │               │                │              │             │
  │ complete(evt) │                │              │             │
  │◄──────────────────────────────────────────────│             │
  │               │                │              │             │
  │ release(alc)  │                │              │             │
  │───────────────────────────────►│              │             │
  │               │                │              │             │
```

### 4.4 Error Handling Sequence

```
Executor        Runtime       ResourceManager   JobQueue
  │               │                │              │
  │ monitor()     │                │              │
  │──────────────►│                │              │
  │               │                │              │
  │ Error         │                │              │
  │◄──────────────│                │              │
  │               │                │              │
  │ release(alc)  │                │              │
  │───────────────────────────────►│              │
  │               │                │              │
  │ cleanup(id)   │                │              │
  │──────────────►│                │              │
  │               │                │              │
  │ markFailed    │                │              │
  │──────────────────────────────────────────────►│
  │               │                │              │
  │ emit(Event::JobFailed)         │              │
  │───────────────┐                │              │
  │◄──────────────┘                │              │
  │               │                │              │
```

---

## 5. Data Models

### 5.1 Job

```rust
pub struct Job {
    pub id: JobId,
    pub name: String,
    pub image: String,
    pub command: Vec<String>,
    pub env: HashMap<String, String>,
    pub volumes: Vec<VolumeMount>,
    pub resources: ResourceRequest,
    pub priority: Priority,
    pub timeout: Option<Duration>,
    pub created_at: Instant,
    pub metadata: HashMap<String, String>,
}

pub enum JobStatus {
    Pending,
    Queued { position: usize },
    Starting,
    Running { container_id: ContainerId },
    Completed { exit_code: i32 },
    Failed { error: String },
    Cancelled,
    Terminated,
}
```

### 5.2 Events

```rust
pub enum ExecutorEvent {
    JobSubmitted { job_id: JobId },
    JobQueued { job_id: JobId, position: usize },
    JobStarted { job_id: JobId, container_id: ContainerId },
    JobCompleted { job_id: JobId, exit_code: i32 },
    JobFailed { job_id: JobId, error: String },
    JobCancelled { job_id: JobId },
    JobTerminated { job_id: JobId },
    ResourceAllocated { job_id: JobId, allocation: Allocation },
    ResourceReleased { job_id: JobId },
}
```

---

## 6. Configuration

### 6.1 Executor Configuration

```yaml
executor:
  # Maximum concurrent jobs
  max_concurrency: 10
  
  # Default resource limits
  defaults:
    cpu_limit: 2.0
    memory_limit: 4Gi
    disk_quota: 10Gi
  
  # Job queue settings
  queue:
    max_size: 1000
    scheduling_policy: priority
  
  # Docker settings
  docker:
    socket: /var/run/docker.sock
    prune_interval: 1h
    log_driver: json-file
  
  # Resource monitoring
  monitoring:
    interval: 30s
    metrics_enabled: true
```

### 6.2 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EXECUTOR_MAX_CONCURRENCY` | Max concurrent jobs | 10 |
| `EXECUTOR_DOCKER_SOCKET` | Docker socket path | `/var/run/docker.sock` |
| `EXECUTOR_LOG_LEVEL` | Logging level | `info` |
| `EXECUTOR_METRICS_ENABLED` | Enable metrics | `true` |

---

## 7. Observability

### 7.1 Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `executor_jobs_total` | Counter | Total jobs submitted |
| `executor_jobs_active` | Gauge | Currently running jobs |
| `executor_queue_length` | Gauge | Jobs waiting in queue |
| `executor_job_duration_seconds` | Histogram | Job execution time |
| `executor_resources_cpu_used` | Gauge | CPU cores in use |
| `executor_resources_memory_used` | Gauge | Memory bytes in use |

### 7.2 Logging

All components emit structured JSON logs with:
- `timestamp`: ISO-8601 timestamp
- `level`: Log level (error, warn, info, debug)
- `component`: Component name
- `job_id`: Associated job ID (if applicable)
- `message`: Log message
- `context`: Additional structured context

### 7.3 Tracing

Distributed tracing with OpenTelemetry:
- Job submission span
- Queue wait span
- Container creation span
- Execution span
- Cleanup span

---

## 8. Security Considerations

### 8.1 Container Isolation

- Jobs run in isolated containers
- No network access by default (configurable)
- Read-only root filesystem option
- Non-root user execution

### 8.2 Resource Limits

- CPU and memory limits enforced by Docker
- Disk quotas prevent storage exhaustion
- Process limits prevent fork bombs

### 8.3 Image Security

- Image digest verification
- Private registry authentication
- Image scanning integration point

---

## 9. Future Extensions

1. **Multi-node Support**: Distributed executor cluster
2. **GPU Support**: GPU resource allocation
3. **Spot Instances**: Preemptible job execution
4. **Job Dependencies**: DAG-based job scheduling
5. **Checkpointing**: Save/restore job state

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Job** | A unit of work to be executed in a container |
| **Container** | Docker container running a job |
| **Image** | Docker image used to create containers |
| **Volume Mount** | Host directory or volume mounted in container |
| **Allocation** | Reserved resources for a job |

---

*Document Owner: T1-A1*  
*Last Updated: 2026-02-24*

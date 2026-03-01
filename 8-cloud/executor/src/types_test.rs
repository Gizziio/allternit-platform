// OWNER: T1-A5

//! Executor Types Unit Tests
//!
//! Comprehensive unit tests for executor type definitions.

#[cfg(test)]
mod tests {
    use super::super::types::*;
    use std::collections::HashMap;
    use std::time::Duration;
    use uuid::Uuid;

    // ========================================================================
    // Priority Tests
    // ========================================================================

    #[test]
    fn test_priority_default() {
        let priority = Priority::default();
        assert_eq!(priority, Priority::Normal);
    }

    #[test]
    fn test_priority_ordering() {
        assert!(Priority::Critical > Priority::High);
        assert!(Priority::High > Priority::Normal);
        assert!(Priority::Normal > Priority::Low);
        assert!(Priority::Low > Priority::Batch);
    }

    #[test]
    fn test_priority_values() {
        assert_eq!(Priority::Critical as i32, 100);
        assert_eq!(Priority::High as i32, 75);
        assert_eq!(Priority::Normal as i32, 50);
        assert_eq!(Priority::Low as i32, 25);
        assert_eq!(Priority::Batch as i32, 10);
    }

    // ========================================================================
    // JobStatus Tests
    // ========================================================================

    #[test]
    fn test_job_status_is_terminal() {
        // Non-terminal states
        assert!(!JobStatus::Pending.is_terminal());
        assert!(!JobStatus::Queued { position: 0 }.is_terminal());
        assert!(!JobStatus::Starting.is_terminal());
        assert!(!JobStatus::Running {
            container_id: "abc123".to_string()
        }
        .is_terminal());

        // Terminal states
        assert!(JobStatus::Completed { exit_code: 0 }.is_terminal());
        assert!(JobStatus::Failed {
            error: "error".to_string()
        }
        .is_terminal());
        assert!(JobStatus::Cancelled.is_terminal());
        assert!(JobStatus::Terminated.is_terminal());
    }

    #[test]
    fn test_job_status_serialization() {
        let status = JobStatus::Pending;
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("Pending"));

        let status = JobStatus::Completed { exit_code: 0 };
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("Completed"));
        assert!(json.contains("0"));
    }

    // ========================================================================
    // Job Tests
    // ========================================================================

    #[test]
    fn test_job_new() {
        let job = Job::new("test-job", "alpine:latest");

        assert_eq!(job.name, "test-job");
        assert_eq!(job.image, "alpine:latest");
        assert!(job.command.is_empty());
        assert!(job.env.is_empty());
        assert!(job.volumes.is_empty());
        assert_eq!(job.priority, Priority::Normal);
        assert!(job.timeout.is_none());
        assert!(job.metadata.is_empty());
    }

    #[test]
    fn test_job_with_command() {
        let job = Job::new("test-job", "alpine:latest")
            .with_command(vec!["echo".to_string(), "hello".to_string()]);

        assert_eq!(job.command.len(), 2);
        assert_eq!(job.command[0], "echo");
        assert_eq!(job.command[1], "hello");
    }

    #[test]
    fn test_job_with_env() {
        let mut env = HashMap::new();
        env.insert("KEY".to_string(), "VALUE".to_string());

        let job = Job::new("test-job", "alpine:latest").with_env(env.clone());

        assert_eq!(job.env.len(), 1);
        assert_eq!(job.env.get("KEY"), Some(&"VALUE".to_string()));
    }

    #[test]
    fn test_job_with_volumes() {
        let volumes = vec![VolumeMount::new("/host", "/container")];

        let job = Job::new("test-job", "alpine:latest").with_volumes(volumes.clone());

        assert_eq!(job.volumes.len(), 1);
        assert_eq!(job.volumes[0].source, "/host");
        assert_eq!(job.volumes[0].target, "/container");
    }

    #[test]
    fn test_job_with_resources() {
        let resources = ResourceRequest::default()
            .with_cpu(2.0)
            .with_memory(1024 * 1024 * 1024);

        let job = Job::new("test-job", "alpine:latest").with_resources(resources.clone());

        assert_eq!(job.resources.cpu_cores, Some(2.0));
        assert_eq!(job.resources.memory_bytes, Some(1024 * 1024 * 1024));
    }

    #[test]
    fn test_job_with_priority() {
        let job = Job::new("test-job", "alpine:latest").with_priority(Priority::Critical);

        assert_eq!(job.priority, Priority::Critical);
    }

    #[test]
    fn test_job_with_timeout() {
        let timeout = Duration::from_secs(300);

        let job = Job::new("test-job", "alpine:latest").with_timeout(timeout);

        assert_eq!(job.timeout, Some(timeout));
    }

    #[test]
    fn test_job_builder_pattern() {
        let mut env = HashMap::new();
        env.insert("ENV".to_string(), "prod".to_string());

        let job = Job::new("test-job", "alpine:latest")
            .with_command(vec![
                "sh".to_string(),
                "-c".to_string(),
                "echo test".to_string(),
            ])
            .with_env(env)
            .with_priority(Priority::High)
            .with_timeout(Duration::from_secs(600));

        assert_eq!(job.name, "test-job");
        assert_eq!(job.command.len(), 3);
        assert_eq!(job.priority, Priority::High);
        assert_eq!(job.timeout, Some(Duration::from_secs(600)));
    }

    // ========================================================================
    // VolumeMount Tests
    // ========================================================================

    #[test]
    fn test_volume_mount_new() {
        let mount = VolumeMount::new("/host/path", "/container/path");

        assert_eq!(mount.source, "/host/path");
        assert_eq!(mount.target, "/container/path");
        assert!(mount.options.is_empty());
    }

    #[test]
    fn test_volume_mount_read_only() {
        let mount = VolumeMount::new("/host/path", "/container/path").read_only();

        assert!(mount.options.contains(&"ro".to_string()));
    }

    #[test]
    fn test_volume_mount_with_options() {
        let mount = VolumeMount::new("/host/path", "/container/path")
            .with_options(vec!["ro".to_string(), "noexec".to_string()]);

        assert_eq!(mount.options.len(), 2);
        assert!(mount.options.contains(&"ro".to_string()));
        assert!(mount.options.contains(&"noexec".to_string()));
    }

    // ========================================================================
    // ResourceLimits Tests
    // ========================================================================

    #[test]
    fn test_resource_limits_default() {
        let limits = ResourceLimits::default();

        assert!(limits.cpu_limit.is_none());
        assert!(limits.memory_limit.is_none());
        assert!(limits.disk_quota.is_none());
    }

    #[test]
    fn test_resource_limits_with_cpu() {
        let limits = ResourceLimits::default().with_cpu(4.0);

        assert_eq!(limits.cpu_limit, Some(4.0));
    }

    #[test]
    fn test_resource_limits_with_memory() {
        let limits = ResourceLimits::default().with_memory(4 * 1024 * 1024 * 1024);

        assert_eq!(limits.memory_limit, Some(4 * 1024 * 1024 * 1024));
    }

    #[test]
    fn test_resource_limits_with_disk() {
        let limits = ResourceLimits::default().with_disk(100 * 1024 * 1024 * 1024);

        assert_eq!(limits.disk_quota, Some(100 * 1024 * 1024 * 1024));
    }

    #[test]
    fn test_resource_limits_chaining() {
        let limits = ResourceLimits::default()
            .with_cpu(2.0)
            .with_memory(2 * 1024 * 1024 * 1024)
            .with_disk(50 * 1024 * 1024 * 1024);

        assert_eq!(limits.cpu_limit, Some(2.0));
        assert_eq!(limits.memory_limit, Some(2 * 1024 * 1024 * 1024));
        assert_eq!(limits.disk_quota, Some(50 * 1024 * 1024 * 1024));
    }

    // ========================================================================
    // ContainerConfig Tests
    // ========================================================================

    #[test]
    fn test_container_config_default() {
        let config = ContainerConfig::default();

        assert_eq!(config.image, "alpine:latest");
        assert!(config.command.is_empty());
        assert!(config.env.is_empty());
        assert!(config.volumes.is_empty());
        assert_eq!(config.network_mode, NetworkMode::Bridge);
        assert!(config.working_dir.is_none());
        assert!(config.user.is_none());
        assert!(config.labels.is_empty());
        assert_eq!(config.timeout, Some(Duration::from_secs(3600)));
    }

    #[test]
    fn test_container_config_new() {
        let config = ContainerConfig::new("nginx:latest");

        assert_eq!(config.image, "nginx:latest");
    }

    #[test]
    fn test_container_config_with_command() {
        let config = ContainerConfig::default().with_command(vec![
            "nginx".to_string(),
            "-g".to_string(),
            "daemon off;".to_string(),
        ]);

        assert_eq!(config.command.len(), 3);
    }

    #[test]
    fn test_container_config_with_working_dir() {
        let config = ContainerConfig::default().with_working_dir("/app");

        assert_eq!(config.working_dir, Some("/app".to_string()));
    }

    #[test]
    fn test_container_config_with_user() {
        let config = ContainerConfig::default().with_user("1000:1000");

        assert_eq!(config.user, Some("1000:1000".to_string()));
    }

    // ========================================================================
    // NetworkMode Tests
    // ========================================================================

    #[test]
    fn test_network_mode_default() {
        let mode = NetworkMode::default();
        assert_eq!(mode, NetworkMode::Bridge);
    }

    #[test]
    fn test_network_mode_variants() {
        assert_eq!(NetworkMode::Host, NetworkMode::Host);
        assert_eq!(NetworkMode::None, NetworkMode::None);
        assert_eq!(
            NetworkMode::Container("abc".to_string()),
            NetworkMode::Container("abc".to_string())
        );
        assert_eq!(
            NetworkMode::Custom("my-network".to_string()),
            NetworkMode::Custom("my-network".to_string())
        );
    }

    // ========================================================================
    // ResourceRequest Tests
    // ========================================================================

    #[test]
    fn test_resource_request_default() {
        let request = ResourceRequest::default();

        assert!(request.cpu_cores.is_none());
        assert!(request.memory_bytes.is_none());
        assert!(request.disk_bytes.is_none());
    }

    #[test]
    fn test_resource_request_with_cpu() {
        let request = ResourceRequest::default().with_cpu(1.5);

        assert_eq!(request.cpu_cores, Some(1.5));
    }

    #[test]
    fn test_resource_request_with_memory() {
        let request = ResourceRequest::default().with_memory(512 * 1024 * 1024);

        assert_eq!(request.memory_bytes, Some(512 * 1024 * 1024));
    }

    #[test]
    fn test_resource_request_with_disk() {
        let request = ResourceRequest::default().with_disk(10 * 1024 * 1024 * 1024);

        assert_eq!(request.disk_bytes, Some(10 * 1024 * 1024 * 1024));
    }

    // ========================================================================
    // SystemResources Tests
    // ========================================================================

    #[test]
    fn test_system_resources_default() {
        let resources = SystemResources::default();

        assert_eq!(resources.cpu_cores, 0.0);
        assert_eq!(resources.memory_bytes, 0);
        assert_eq!(resources.disk_bytes, 0);
    }

    // ========================================================================
    // ContainerInfo Tests
    // ========================================================================

    #[test]
    fn test_container_info_creation() {
        let mut labels = HashMap::new();
        labels.insert("test".to_string(), "value".to_string());

        let info = ContainerInfo {
            id: "abc123".to_string(),
            name: "test-container".to_string(),
            image: "alpine:latest".to_string(),
            status: ContainerStatus::Running,
            created_at: chrono::Utc::now(),
            started_at: Some(chrono::Utc::now()),
            finished_at: None,
            exit_code: None,
            labels,
        };

        assert_eq!(info.id, "abc123");
        assert_eq!(info.name, "test-container");
        assert_eq!(info.status, ContainerStatus::Running);
        assert!(info.started_at.is_some());
        assert!(info.finished_at.is_none());
        assert!(info.exit_code.is_none());
    }

    // ========================================================================
    // ContainerStatus Tests
    // ========================================================================

    #[test]
    fn test_container_status_variants() {
        let statuses = vec![
            ContainerStatus::Created,
            ContainerStatus::Running,
            ContainerStatus::Paused,
            ContainerStatus::Restarting,
            ContainerStatus::Removing,
            ContainerStatus::Exited,
            ContainerStatus::Dead,
        ];

        for status in statuses {
            // Test serialization
            let json = serde_json::to_string(&status).unwrap();
            assert!(!json.is_empty());

            // Test deserialization
            let deserialized: ContainerStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(status, deserialized);
        }
    }

    // ========================================================================
    // LogLine Tests
    // ========================================================================

    #[test]
    fn test_log_line_creation() {
        let log = LogLine {
            is_stderr: false,
            content: "Hello, World!".to_string(),
            timestamp: Some(chrono::Utc::now()),
        };

        assert!(!log.is_stderr);
        assert_eq!(log.content, "Hello, World!");
        assert!(log.timestamp.is_some());
    }

    #[test]
    fn test_log_line_stderr() {
        let log = LogLine {
            is_stderr: true,
            content: "Error occurred".to_string(),
            timestamp: None,
        };

        assert!(log.is_stderr);
        assert!(log.timestamp.is_none());
    }

    // ========================================================================
    // Allocation Tests
    // ========================================================================

    #[test]
    fn test_allocation_creation() {
        let allocation = Allocation {
            allocation_id: "alloc-123".to_string(),
            job_id: Uuid::new_v4(),
            resources: SystemResources {
                cpu_cores: 2.0,
                memory_bytes: 1024 * 1024 * 1024,
                disk_bytes: 10 * 1024 * 1024 * 1024,
            },
            created_at: chrono::Utc::now(),
        };

        assert_eq!(allocation.allocation_id, "alloc-123");
        assert_eq!(allocation.resources.cpu_cores, 2.0);
    }

    // ========================================================================
    // ResourceMetrics Tests
    // ========================================================================

    #[test]
    fn test_resource_metrics_creation() {
        let metrics = ResourceMetrics {
            cpu_used: 1.5,
            cpu_total: 4.0,
            memory_used: 2 * 1024 * 1024 * 1024,
            memory_total: 8 * 1024 * 1024 * 1024,
            disk_used: 50 * 1024 * 1024 * 1024,
            disk_total: 100 * 1024 * 1024 * 1024,
            active_allocations: 5,
            queued_requests: 2,
        };

        assert_eq!(metrics.cpu_used, 1.5);
        assert_eq!(metrics.cpu_total, 4.0);
        assert_eq!(metrics.active_allocations, 5);
        assert_eq!(metrics.queued_requests, 2);
    }

    // ========================================================================
    // ExecutorEvent Tests
    // ========================================================================

    #[test]
    fn test_executor_event_job_id() {
        let job_id = Uuid::new_v4();

        let events = vec![
            ExecutorEvent::JobSubmitted { job_id },
            ExecutorEvent::JobQueued {
                job_id,
                position: 1,
            },
            ExecutorEvent::JobStarted {
                job_id,
                container_id: "abc".to_string(),
            },
            ExecutorEvent::JobCompleted {
                job_id,
                exit_code: 0,
            },
            ExecutorEvent::JobFailed {
                job_id,
                error: "error".to_string(),
            },
            ExecutorEvent::JobCancelled { job_id },
            ExecutorEvent::JobTerminated { job_id },
            ExecutorEvent::ResourceAllocated {
                job_id,
                allocation: Allocation {
                    allocation_id: "alloc-1".to_string(),
                    job_id,
                    resources: SystemResources::default(),
                    created_at: chrono::Utc::now(),
                },
            },
            ExecutorEvent::ResourceReleased { job_id },
        ];

        for event in &events {
            assert_eq!(event.job_id(), job_id);
        }
    }

    #[test]
    fn test_executor_event_serialization() {
        let job_id = Uuid::new_v4();
        let event = ExecutorEvent::JobSubmitted { job_id };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("JobSubmitted"));

        let deserialized: ExecutorEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.job_id(), job_id);
    }

    // ========================================================================
    // DockerCapabilities Tests
    // ========================================================================

    #[test]
    fn test_docker_capabilities_default() {
        let caps = DockerCapabilities::default();

        assert!(!caps.available);
        assert!(caps.version.is_empty());
        assert!(caps.api_version.is_empty());
        assert!(!caps.swarm_enabled);
        assert!(!caps.gpu_support);
        assert!(!caps.rootless);
    }

    // ========================================================================
    // JobFilter Tests
    // ========================================================================

    #[test]
    fn test_job_filter_default() {
        let filter = JobFilter::default();

        assert!(filter.status.is_none());
        assert!(filter.priority.is_none());
        assert!(filter.image.is_none());
        assert!(filter.created_after.is_none());
        assert!(filter.created_before.is_none());
    }

    // ========================================================================
    // Error Type Tests
    // ========================================================================

    #[test]
    fn test_executor_error_job_not_found() {
        let job_id = Uuid::new_v4();
        let error = ExecutorError::JobNotFound(job_id);

        let msg = format!("{}", error);
        assert!(msg.contains("Job not found"));
    }

    #[test]
    fn test_executor_error_job_already_exists() {
        let job_id = Uuid::new_v4();
        let error = ExecutorError::JobAlreadyExists(job_id);

        let msg = format!("{}", error);
        assert!(msg.contains("Job already exists"));
    }

    #[test]
    fn test_executor_error_invalid_state_transition() {
        let error = ExecutorError::InvalidStateTransition {
            from: JobStatus::Pending,
            to: JobStatus::Completed { exit_code: 0 },
        };

        let msg = format!("{}", error);
        assert!(msg.contains("Invalid job state transition"));
    }

    #[test]
    fn test_container_error_not_found() {
        let error = ContainerError::NotFound("container-123".to_string());

        let msg = format!("{}", error);
        assert!(msg.contains("Container not found"));
    }

    #[test]
    fn test_container_error_already_exists() {
        let error = ContainerError::AlreadyExists("container-123".to_string());

        let msg = format!("{}", error);
        assert!(msg.contains("Container already exists"));
    }

    #[test]
    fn test_resource_error_insufficient() {
        let error = ResourceError::InsufficientResources {
            requested: ResourceRequest::default().with_cpu(100.0),
            available: SystemResources {
                cpu_cores: 4.0,
                memory_bytes: 0,
                disk_bytes: 0,
            },
        };

        let msg = format!("{}", error);
        assert!(msg.contains("Insufficient resources"));
    }

    #[test]
    fn test_queue_error_full() {
        let error = QueueError::QueueFull;

        let msg = format!("{}", error);
        assert!(msg.contains("Queue is full"));
    }

    #[test]
    fn test_queue_error_empty() {
        let error = QueueError::Empty;

        let msg = format!("{}", error);
        assert!(msg.contains("Queue is empty"));
    }

    // ========================================================================
    // Serialization Tests
    // ========================================================================

    #[test]
    fn test_job_serialization_roundtrip() {
        let job = Job::new("test-job", "alpine:latest")
            .with_command(vec!["echo".to_string(), "hello".to_string()])
            .with_priority(Priority::High);

        let json = serde_json::to_string_pretty(&job).unwrap();
        let deserialized: Job = serde_json::from_str(&json).unwrap();

        assert_eq!(job.id, deserialized.id);
        assert_eq!(job.name, deserialized.name);
        assert_eq!(job.image, deserialized.image);
        assert_eq!(job.command, deserialized.command);
        assert_eq!(job.priority, deserialized.priority);
    }

    #[test]
    fn test_container_config_serialization_roundtrip() {
        let config = ContainerConfig::new("nginx:latest")
            .with_command(vec!["nginx".to_string()])
            .with_working_dir("/app");

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ContainerConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(config.image, deserialized.image);
        assert_eq!(config.command, deserialized.command);
        assert_eq!(config.working_dir, deserialized.working_dir);
    }

    #[test]
    fn test_volume_mount_serialization() {
        let mount = VolumeMount::new("/host", "/container").read_only();

        let json = serde_json::to_string(&mount).unwrap();
        let deserialized: VolumeMount = serde_json::from_str(&json).unwrap();

        assert_eq!(mount.source, deserialized.source);
        assert_eq!(mount.target, deserialized.target);
        assert_eq!(mount.options, deserialized.options);
    }
}

// OWNER: T1-A5

//! Test Utilities
//!
//! Common test utilities and helpers for executor tests.

use std::collections::HashMap;
use std::time::Duration;
use uuid::Uuid;

use a2r_executor::{
    ContainerConfig, Job, JobFilter, JobStatus, Priority, ResourceLimits, ResourceRequest,
    VolumeMount,
};

/// Create a test job with default values
pub fn create_test_job(name: &str) -> Job {
    Job::new(name, "alpine:latest")
}

/// Create a test job with custom image
pub fn create_test_job_with_image(name: &str, image: &str) -> Job {
    Job::new(name, image)
}

/// Create a test job with command
pub fn create_test_job_with_command(name: &str, command: Vec<String>) -> Job {
    Job::new(name, "alpine:latest").with_command(command)
}

/// Create a test job with priority
pub fn create_test_job_with_priority(name: &str, priority: Priority) -> Job {
    Job::new(name, "alpine:latest").with_priority(priority)
}

/// Create a test job with resources
pub fn create_test_job_with_resources(name: &str, cpu: f64, memory_bytes: u64) -> Job {
    Job::new(name, "alpine:latest").with_resources(
        ResourceRequest::default()
            .with_cpu(cpu)
            .with_memory(memory_bytes),
    )
}

/// Create a test container config
pub fn create_test_container_config(image: &str) -> ContainerConfig {
    ContainerConfig::new(image)
}

/// Create a test container config with command
pub fn create_test_container_config_with_command(
    image: &str,
    command: Vec<String>,
) -> ContainerConfig {
    ContainerConfig::new(image).with_command(command)
}

/// Create a test container config with environment variables
pub fn create_test_container_config_with_env(
    image: &str,
    env: HashMap<String, String>,
) -> ContainerConfig {
    ContainerConfig::new(image).with_env(env)
}

/// Create a test volume mount
pub fn create_test_volume_mount(source: &str, target: &str) -> VolumeMount {
    VolumeMount::new(source, target)
}

/// Create a test volume mount (read-only)
pub fn create_test_volume_mount_ro(source: &str, target: &str) -> VolumeMount {
    VolumeMount::new(source, target).read_only()
}

/// Create test resource limits
pub fn create_test_resource_limits(cpu: f64, memory: u64) -> ResourceLimits {
    ResourceLimits::default().with_cpu(cpu).with_memory(memory)
}

/// Create test resource request
pub fn create_test_resource_request(cpu: f64, memory: u64) -> ResourceRequest {
    ResourceRequest::default().with_cpu(cpu).with_memory(memory)
}

/// Create a test job filter
pub fn create_test_job_filter() -> JobFilter {
    JobFilter::default()
}

/// Create a test job filter with status
pub fn create_test_job_filter_with_status(status: JobStatus) -> JobFilter {
    JobFilter {
        status: Some(status),
        ..Default::default()
    }
}

/// Create a test job filter with priority
pub fn create_test_job_filter_with_priority(priority: Priority) -> JobFilter {
    JobFilter {
        priority: Some(priority),
        ..Default::default()
    }
}

/// Generate a random test ID
pub fn generate_test_id() -> String {
    format!("test-{}", Uuid::new_v4().to_string()[..8].to_string())
}

/// Generate a random test job ID
pub fn generate_test_job_id() -> Uuid {
    Uuid::new_v4()
}

/// Sleep helper for async tests
pub async fn sleep_ms(ms: u64) {
    tokio::time::sleep(Duration::from_millis(ms)).await;
}

/// Assert that a result is Ok and return the value
#[track_caller]
pub fn assert_ok<T>(result: Result<T, impl std::fmt::Debug>) -> T {
    match result {
        Ok(v) => v,
        Err(e) => panic!("Expected Ok, got Err: {:?}", e),
    }
}

/// Assert that a result is Err
#[track_caller]
pub fn assert_err<T, E: std::fmt::Debug>(result: Result<T, E>) {
    match result {
        Ok(_) => panic!("Expected Err, got Ok"),
        Err(e) => {
            // Success - we got an error as expected
            let _ = e;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_test_job() {
        let job = create_test_job("test-job");
        assert_eq!(job.name, "test-job");
        assert_eq!(job.image, "alpine:latest");
        assert_eq!(job.priority, Priority::Normal);
    }

    #[test]
    fn test_create_test_job_with_image() {
        let job = create_test_job_with_image("test-job", "nginx:latest");
        assert_eq!(job.image, "nginx:latest");
    }

    #[test]
    fn test_create_test_job_with_command() {
        let job =
            create_test_job_with_command("test-job", vec!["echo".to_string(), "hello".to_string()]);
        assert_eq!(job.command.len(), 2);
    }

    #[test]
    fn test_create_test_job_with_priority() {
        let job = create_test_job_with_priority("test-job", Priority::Critical);
        assert_eq!(job.priority, Priority::Critical);
    }

    #[test]
    fn test_create_test_job_with_resources() {
        let job = create_test_job_with_resources("test-job", 2.0, 1024 * 1024 * 1024);
        assert_eq!(job.resources.cpu_cores, Some(2.0));
        assert_eq!(job.resources.memory_bytes, Some(1024 * 1024 * 1024));
    }

    #[test]
    fn test_create_test_container_config() {
        let config = create_test_container_config("alpine:latest");
        assert_eq!(config.image, "alpine:latest");
    }

    #[test]
    fn test_create_test_container_config_with_command() {
        let config =
            create_test_container_config_with_command("alpine:latest", vec!["echo".to_string()]);
        assert_eq!(config.command.len(), 1);
    }

    #[test]
    fn test_create_test_container_config_with_env() {
        let mut env = HashMap::new();
        env.insert("KEY".to_string(), "VALUE".to_string());

        let config = create_test_container_config_with_env("alpine:latest", env.clone());
        assert_eq!(config.env.len(), 1);
    }

    #[test]
    fn test_create_test_volume_mount() {
        let mount = create_test_volume_mount("/host", "/container");
        assert_eq!(mount.source, "/host");
        assert_eq!(mount.target, "/container");
    }

    #[test]
    fn test_create_test_volume_mount_ro() {
        let mount = create_test_volume_mount_ro("/host", "/container");
        assert!(mount.options.contains(&"ro".to_string()));
    }

    #[test]
    fn test_create_test_resource_limits() {
        let limits = create_test_resource_limits(2.0, 1024 * 1024 * 1024);
        assert_eq!(limits.cpu_limit, Some(2.0));
        assert_eq!(limits.memory_limit, Some(1024 * 1024 * 1024));
    }

    #[test]
    fn test_create_test_resource_request() {
        let request = create_test_resource_request(2.0, 1024 * 1024 * 1024);
        assert_eq!(request.cpu_cores, Some(2.0));
        assert_eq!(request.memory_bytes, Some(1024 * 1024 * 1024));
    }

    #[test]
    fn test_create_test_job_filter() {
        let filter = create_test_job_filter();
        assert!(filter.status.is_none());
        assert!(filter.priority.is_none());
    }

    #[test]
    fn test_create_test_job_filter_with_status() {
        let filter = create_test_job_filter_with_status(JobStatus::Pending);
        assert_eq!(filter.status, Some(JobStatus::Pending));
    }

    #[test]
    fn test_create_test_job_filter_with_priority() {
        let filter = create_test_job_filter_with_priority(Priority::High);
        assert_eq!(filter.priority, Some(Priority::High));
    }

    #[test]
    fn test_generate_test_id() {
        let id1 = generate_test_id();
        let id2 = generate_test_id();

        assert!(id1.starts_with("test-"));
        assert_ne!(id1, id2, "Generated IDs should be unique");
    }

    #[test]
    fn test_generate_test_job_id() {
        let id1 = generate_test_job_id();
        let id2 = generate_test_job_id();

        assert_ne!(id1, id2, "Generated job IDs should be unique");
    }

    #[test]
    fn test_assert_ok() {
        let result: Result<i32, &str> = Ok(42);
        let value = assert_ok(result);
        assert_eq!(value, 42);
    }

    #[test]
    #[should_panic(expected = "Expected Ok, got Err")]
    fn test_assert_ok_panics_on_err() {
        let result: Result<i32, &str> = Err("error");
        let _ = assert_ok(result);
    }

    #[test]
    fn test_assert_err() {
        let result: Result<i32, &str> = Err("error");
        assert_err(result);
    }

    #[test]
    #[should_panic(expected = "Expected Err, got Ok")]
    fn test_assert_err_panics_on_ok() {
        let result: Result<i32, &str> = Ok(42);
        assert_err(result);
    }
}

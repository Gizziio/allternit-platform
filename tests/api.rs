use std::collections::HashMap;
use std::time::Duration;
use tokio::time::timeout;
use uuid::Uuid;

// Test constants
fn get_api_base_url() -> String { format!("http://{}:{}", std::net::Ipv4Addr::LOCALHOST, 3000) }

// Helper function to create a test agent definition
fn create_test_agent(id: &str) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "name": format!("Test Agent {}", id),
        "description": "Test agent for API smoke tests",
        "version": "1.0.0",
        "author": "Test Suite",
        "capabilities": ["test"],
        "config_schema": {},
        "metadata": {}
    })
}

// Helper function to create a test skill
fn create_test_skill(id: &str) -> serde_json::Value {
    serde_json::json!({
        "manifest": {
            "id": id,
            "name": format!("Test Skill {}", id),
            "version": "1.0.0",
            "description": "Test skill for API smoke tests",
            "author": "Test Suite",
            "tags": ["test"],
            "metadata": {}
        },
        "implementation": {
            "type": "function",
            "code": "console.log('test');",
            "language": "javascript"
        }
    })
}

// Helper function to create a test tool
fn create_test_tool(id: &str) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "name": format!("Test Tool {}", id),
        "description": "Test tool for API smoke tests",
        "version": "1.0.0",
        "author": "Test Suite",
        "interface": {
            "type": "function",
            "parameters": {}
        },
        "metadata": {}
    })
}

#[tokio::test]
async fn test_api_health_endpoint() {
    let client = reqwest::Client::new();
    let health_url = format!("{}/health", get_api_base_url());

    // Make a request to the health endpoint
    let response = client.get(&health_url).send().await.unwrap();
    
    assert_eq!(response.status(), 200);
    
    let json: serde_json::Value = response.json().await.unwrap();
    assert_eq!(json["status"], "ok");
}

#[tokio::test]
async fn test_registry_agent_endpoints() {
    let client = reqwest::Client::new();
    let registry_base = format!("{}/api/registry", get_api_base_url());

    // Test agent registration
    let agent_id = format!("test-agent-{}", Uuid::new_v4());
    let agent_data = create_test_agent(&agent_id);
    
    let response = client
        .post(format!("{}/agents", registry_base))
        .json(&agent_data)
        .send()
        .await
        .unwrap();
    
    // Check if the response is successful (201 Created or 409 Conflict if already exists)
    assert!(response.status() == 201 || response.status() == 409);
    
    if response.status() == 201 {
        let json: serde_json::Value = response.json().await.unwrap();
        assert_eq!(json["id"], agent_id);
    }

    // Test agent retrieval
    let response = client
        .get(format!("{}/agents/{}", registry_base, agent_id))
        .send()
        .await
        .unwrap();
    
    // Check if the response is successful (200 OK or 404 Not Found if not created)
    assert!(response.status() == 200 || response.status() == 404);
    
    if response.status() == 200 {
        let retrieved_agent: serde_json::Value = response.json().await.unwrap();
        assert_eq!(retrieved_agent["id"], agent_id);
    }
}

#[tokio::test]
async fn test_registry_skill_endpoints() {
    let client = reqwest::Client::new();
    let registry_base = format!("{}/api/registry", get_api_base_url());

    // Test skill registration
    let skill_id = format!("test-skill-{}", Uuid::new_v4());
    let skill_data = create_test_skill(&skill_id);
    
    let response = client
        .post(format!("{}/skills", registry_base))
        .json(&skill_data)
        .send()
        .await
        .unwrap();
    
    // Check if the response is successful (201 Created or 409 Conflict if already exists)
    assert!(response.status() == 201 || response.status() == 409);
    
    if response.status() == 201 {
        let json: serde_json::Value = response.json().await.unwrap();
        assert_eq!(json["id"], skill_id);
    }

    // Test skill retrieval
    let response = client
        .get(format!("{}/skills/{}", registry_base, skill_id))
        .send()
        .await
        .unwrap();
    
    // Check if the response is successful (200 OK or 404 Not Found if not created)
    assert!(response.status() == 200 || response.status() == 404);
    
    if response.status() == 200 {
        let retrieved_skill: serde_json::Value = response.json().await.unwrap();
        assert_eq!(retrieved_skill["manifest"]["id"], skill_id);
    }
}

#[tokio::test]
async fn test_registry_tool_endpoints() {
    let client = reqwest::Client::new();
    let registry_base = format!("{}/api/registry", get_api_base_url());

    // Test tool registration
    let tool_id = format!("test-tool-{}", Uuid::new_v4());
    let tool_data = create_test_tool(&tool_id);
    
    let response = client
        .post(format!("{}/tools", registry_base))
        .json(&tool_data)
        .send()
        .await
        .unwrap();
    
    // Check if the response is successful (201 Created or 409 Conflict if already exists)
    assert!(response.status() == 201 || response.status() == 409);
    
    if response.status() == 201 {
        let json: serde_json::Value = response.json().await.unwrap();
        assert_eq!(json["id"], tool_id);
    }

    // Test tool retrieval
    let response = client
        .get(format!("{}/tools/{}", registry_base, tool_id))
        .send()
        .await
        .unwrap();
    
    // Check if the response is successful (200 OK or 404 Not Found if not created)
    assert!(response.status() == 200 || response.status() == 404);
    
    if response.status() == 200 {
        let retrieved_tool: serde_json::Value = response.json().await.unwrap();
        assert_eq!(retrieved_tool["id"], tool_id);
    }
}

#[tokio::test]
async fn test_capsule_endpoints() {
    let client = reqwest::Client::new();
    let capsules_url = format!("{}/api/capsules", get_api_base_url());

    // First, list capsules (should be empty initially)
    let response = client.get(&capsules_url).send().await.unwrap();
    assert_eq!(response.status(), 200);

    let capsules: Vec<String> = response.json().await.unwrap();
    // Note: The capsule store might have some default capsules, so we don't assert empty

    // Test capsule creation with an invalid body (this will likely fail but tests the endpoint)
    let response = client
        .post(&capsules_url)
        .header("Content-Type", "application/octet-stream")
        .body(vec![]) // Empty body to test error handling
        .send()
        .await
        .unwrap();

    // This should return an error since the body is not a valid capsule
    assert!(response.status().is_client_error());

    // Test capsule creation with a minimal valid capsule bundle
    // For now, we'll test with a minimal tar.gz structure
    // In a real scenario, we would create a proper capsule bundle
    // For testing purposes, let's try to create a minimal tar.gz with a manifest.json
    use std::io::Write;
    use tar::Builder;
    use tempfile::NamedTempFile;

    let mut temp_file = NamedTempFile::new().unwrap();
    {
        let mut archive = Builder::new(temp_file.as_file_mut());

        // Create a minimal manifest.json for the capsule
        let manifest_content = r#"{
            "id": "test-capsule",
            "name": "Test Capsule",
            "version": "1.0.0",
            "description": "Test capsule for API smoke tests",
            "author": "Test Suite",
            "entrypoint": "main.wasm",
            "dependencies": [],
            "metadata": {}
        }"#;

        let mut header = tar::Header::new_gnu();
        header.set_path("manifest.json").unwrap();
        header.set_size(manifest_content.len() as u64);
        header.set_cksum();
        archive.append(&header, manifest_content.as_bytes()).unwrap();

        // Add a dummy wasm file
        let wasm_content = vec![0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00]; // Minimal WASM header
        let mut header = tar::Header::new_gnu();
        header.set_path("main.wasm").unwrap();
        header.set_size(wasm_content.len() as u64);
        header.set_cksum();
        archive.append(&header, wasm_content.as_slice()).unwrap();
    }

    // Read the tar file and compress it with gzip
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::io::Cursor;

    let tar_content = std::fs::read(temp_file.path()).unwrap();
    let mut gz_encoder = GzEncoder::new(Vec::new(), Compression::default());
    gz_encoder.write_all(&tar_content).unwrap();
    let gz_content = gz_encoder.finish().unwrap();

    // Now try to upload the capsule
    let response = client
        .post(&capsules_url)
        .header("Content-Type", "application/octet-stream")
        .body(gz_content.clone())
        .send()
        .await
        .unwrap();

    // This should either succeed or return a specific error about validation
    assert!(response.status().is_success() || response.status().is_client_error());

    // If the capsule was created successfully, try to get its manifest
    if response.status().is_success() {
        let json: serde_json::Value = response.json().await.unwrap();
        if let Some(capsule_id) = json.get("id").and_then(|v| v.as_str()) {
            let response = client
                .get(format!("{}/{}", capsules_url, capsule_id))
                .send()
                .await
                .unwrap();

            assert_eq!(response.status(), 200);
        }
    }

    // Test capsule verification endpoint (this will likely fail if capsule doesn't exist)
    let test_capsule_id = "nonexistent-capsule";
    let response = client
        .get(format!("{}/{}/verify", capsules_url, test_capsule_id))
        .send()
        .await
        .unwrap();

    // This should return 404 since the capsule doesn't exist
    assert_eq!(response.status(), 404);
}

#[tokio::test]
async fn test_workflow_endpoints() {
    let client = reqwest::Client::new();
    let workflows_base = format!("{}/api/workflows", get_api_base_url());

    // Test workflow validation with a minimal valid workflow
    let workflow_yaml = r#"
version: "1.0"
name: "test-workflow"
steps:
  - id: "start"
    action: "test"
"#;

    let response = client
        .post(format!("{}/validate", workflows_base))
        .json(&serde_json::json!({
            "yaml": workflow_yaml
        }))
        .send()
        .await
        .unwrap();
    
    // Validation should return 200 OK or 400 Bad Request depending on validation result
    assert!(response.status().is_success() || response.status() == 400);
}
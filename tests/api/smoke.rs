use std::collections::HashMap;
use std::time::Duration;
use tokio::time::timeout;
use uuid::Uuid;

// Test constants
fn get_api_base_url() -> String { format!("http://{}:{}", std::net::Ipv4Addr::LOCALHOST, 3000) }

// Helper function to start the API server
async fn start_api_server() -> Result<tokio::process::Child, Box<dyn std::error::Error>> {
    let mut child = tokio::process::Command::new("cargo")
        .args(&["run", "--bin", "allternit-api"])
        .env("Allternit_API_BIND", format!("{}:{}", std::net::Ipv4Addr::UNSPECIFIED, 3000))
        .env("Allternit_LEDGER_PATH", format!("./test-ledger-{}.jsonl", Uuid::new_v4()))
        .env("Allternit_DB_PATH", format!("./test-db-{}.db", Uuid::new_v4()))
        .env("Allternit_API_BOOTSTRAP_POLICY", "true")
        .env("Allternit_API_POLICY_ENFORCE", "false") // Disable policy enforcement for tests
        .spawn()?;

    // Give the server some time to start
    tokio::time::sleep(Duration::from_secs(2)).await;

    // Verify the server is running
    let client = reqwest::Client::new();
    let health_url = format!("{}/health", get_api_base_url());
    
    // Retry health check up to 10 times with 1 second delay
    for _ in 0..10 {
        match client.get(&health_url).send().await {
            Ok(response) if response.status().is_success() => {
                println!("API server is ready");
                return Ok(child);
            }
            _ => {
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        }
    }

    Err("API server failed to start".into())
}

// Helper function to stop the API server
fn stop_api_server(mut child: tokio::process::Child) {
    let _ = child.kill();
}

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
async fn test_registry_endpoints() {
    // Start the API server
    let mut server = start_api_server().await.unwrap();
    
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
    
    assert_eq!(response.status(), 201);
    
    let json: serde_json::Value = response.json().await.unwrap();
    assert_eq!(json["id"], agent_id);

    // Test agent retrieval
    let response = client
        .get(format!("{}/agents/{}", registry_base, agent_id))
        .send()
        .await
        .unwrap();
    
    assert_eq!(response.status(), 200);
    
    let retrieved_agent: serde_json::Value = response.json().await.unwrap();
    assert_eq!(retrieved_agent["id"], agent_id);

    // Test skill registration
    let skill_id = format!("test-skill-{}", Uuid::new_v4());
    let skill_data = create_test_skill(&skill_id);
    
    let response = client
        .post(format!("{}/skills", registry_base))
        .json(&skill_data)
        .send()
        .await
        .unwrap();
    
    assert_eq!(response.status(), 201);
    
    let json: serde_json::Value = response.json().await.unwrap();
    assert_eq!(json["id"], skill_id);

    // Test skill retrieval
    let response = client
        .get(format!("{}/skills/{}", registry_base, skill_id))
        .send()
        .await
        .unwrap();
    
    assert_eq!(response.status(), 200);
    
    let retrieved_skill: serde_json::Value = response.json().await.unwrap();
    assert_eq!(retrieved_skill["manifest"]["id"], skill_id);

    // Test tool registration
    let tool_id = format!("test-tool-{}", Uuid::new_v4());
    let tool_data = create_test_tool(&tool_id);
    
    let response = client
        .post(format!("{}/tools", registry_base))
        .json(&tool_data)
        .send()
        .await
        .unwrap();
    
    assert_eq!(response.status(), 201);
    
    let json: serde_json::Value = response.json().await.unwrap();
    assert_eq!(json["id"], tool_id);

    // Test tool retrieval
    let response = client
        .get(format!("{}/tools/{}", registry_base, tool_id))
        .send()
        .await
        .unwrap();
    
    assert_eq!(response.status(), 200);
    
    let retrieved_tool: serde_json::Value = response.json().await.unwrap();
    assert_eq!(retrieved_tool["id"], tool_id);

    // Stop the server
    stop_api_server(server);
}

#[tokio::test]
async fn test_capsule_endpoints() {
    // Start the API server
    let mut server = start_api_server().await.unwrap();
    
    let client = reqwest::Client::new();
    let capsules_url = format!("{}/api/capsules", get_api_base_url());

    // First, list capsules (should be empty initially)
    let response = client.get(&capsules_url).send().await.unwrap();
    assert_eq!(response.status(), 200);
    
    let capsules: Vec<String> = response.json().await.unwrap();
    // Note: The capsule store might have some default capsules, so we don't assert empty

    // For capsule tests, we need to create a valid capsule bundle
    // Since creating a real capsule bundle is complex, we'll test with a minimal valid bundle
    // For now, let's just test the endpoint structure
    
    // Test capsule creation with a minimal bundle (this will likely fail but tests the endpoint)
    let response = client
        .post(&capsules_url)
        .header("Content-Type", "application/octet-stream")
        .body(vec![]) // Empty body to test error handling
        .send()
        .await
        .unwrap();
    
    // This should return an error since the body is not a valid capsule
    assert!(response.status().is_client_error());

    // Stop the server
    stop_api_server(server);
}

#[tokio::test]
async fn test_workflow_endpoints() {
    // Start the API server
    let mut server = start_api_server().await.unwrap();
    
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

    // Stop the server
    stop_api_server(server);
}
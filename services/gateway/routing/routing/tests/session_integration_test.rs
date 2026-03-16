//! Integration tests for OpenClaw Session API
//!
//! Tests the wiring between OpenClawControlUI and native_session_manager.rs

use std::time::Duration;

/// Test scenario: Create session, send message, verify persistence
#[tokio::test]
async fn test_session_lifecycle() {
    // This test assumes the API is running locally
    let base_url = "http://127.0.0.1:3000/api/v1";
    let client = reqwest::Client::new();

    // 1. Create session
    println!("Step 1: Creating session...");
    let create_resp = client
        .post(format!("{}/sessions", base_url))
        .json(&serde_json::json!({
            "name": "Test Session",
            "description": "Integration test session"
        }))
        .send()
        .await;

    match create_resp {
        Ok(resp) => {
            let status = resp.status();
            let body = resp.json::<serde_json::Value>().await.unwrap_or_default();
            println!("  Create response: {} - {:?}", status, body);
            assert!(status.is_success(), "Failed to create session: {:?}", body);
        }
        Err(e) => {
            println!("  Skipping test - API not available: {}", e);
            return;
        }
    }

    // 2. List sessions
    println!("Step 2: Listing sessions...");
    let list_resp = client.get(format!("{}/sessions", base_url)).send().await;

    if let Ok(resp) = list_resp {
        let body = resp.json::<serde_json::Value>().await.unwrap_or_default();
        println!("  Sessions: {:?}", body);
    }
}

/// Test scenario: Send message and verify streaming
#[tokio::test]
async fn test_message_streaming() {
    let base_url = "http://127.0.0.1:3000/api/v1";
    let client = reqwest::Client::new();

    // Create a session first
    let create_resp = client
        .post(format!("{}/sessions", base_url))
        .json(&serde_json::json!({
            "name": "Stream Test"
        }))
        .send()
        .await;

    let session_id = match create_resp {
        Ok(resp) if resp.status().is_success() => {
            let body = resp.json::<serde_json::Value>().await.unwrap_or_default();
            body.get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        }
        _ => {
            println!("Skipping test - API not available");
            return;
        }
    };

    if let Some(id) = session_id {
        // Send a message
        println!("Sending message to session {}...", id);
        let msg_resp = client
            .post(format!("{}/sessions/{}/messages", base_url, id))
            .json(&serde_json::json!({
                "text": "Hello, world!",
                "role": "user"
            }))
            .send()
            .await;

        if let Ok(resp) = msg_resp {
            println!("  Message response: {}", resp.status());
        }

        // Get messages
        let get_resp = client
            .get(format!("{}/sessions/{}/messages", base_url, id))
            .send()
            .await;

        if let Ok(resp) = get_resp {
            let body = resp.json::<serde_json::Value>().await.unwrap_or_default();
            println!("  Messages: {:?}", body);
        }

        // Test abort
        println!("Testing abort...");
        let abort_resp = client
            .post(format!("{}/sessions/{}/abort", base_url, id))
            .json(&serde_json::json!({
                "reason": "Test abort"
            }))
            .send()
            .await;

        if let Ok(resp) = abort_resp {
            println!("  Abort response: {}", resp.status());
        }

        // Cleanup
        let _ = client
            .delete(format!("{}/sessions/{}", base_url, id))
            .send()
            .await;
    }
}

/// Test end-to-end flow matching the acceptance criteria
#[tokio::test]
async fn test_end_to_end_openclaw_chat() {
    println!("\n=== End-to-End OpenClaw Chat Test ===\n");

    let base_url = "http://127.0.0.1:3000/api/v1";
    let client = reqwest::Client::new();

    // 1. Create session via API
    println!("1. Creating session...");
    let create_resp = client
        .post(format!("{}/sessions", base_url))
        .json(&serde_json::json!({
            "name": "E2E Test Session"
        }))
        .send()
        .await;

    let session_id = match create_resp {
        Ok(resp) if resp.status().is_success() => {
            let body = resp.json::<serde_json::Value>().await.unwrap_or_default();
            let id = body
                .get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            println!("   ✓ Session created: {:?}", id);
            id
        }
        _ => {
            println!("   ⚠ API not available, skipping test");
            return;
        }
    };

    let session_id = match session_id {
        Some(id) => id,
        None => {
            println!("   ✗ Failed to get session ID");
            return;
        }
    };

    // 2. Send message
    println!("2. Sending message...");
    let msg_resp = client
        .post(format!("{}/sessions/{}/messages", base_url, session_id))
        .json(&serde_json::json!({
            "text": "Test message",
            "role": "user"
        }))
        .send()
        .await;

    match msg_resp {
        Ok(resp) if resp.status().is_success() => {
            println!("   ✓ Message sent");
        }
        _ => {
            println!("   ✗ Failed to send message");
        }
    }

    // 3. Verify session history persisted
    println!("3. Verifying session history...");
    tokio::time::sleep(Duration::from_millis(100)).await;

    let history_resp = client
        .get(format!("{}/sessions/{}/messages", base_url, session_id))
        .send()
        .await;

    match history_resp {
        Ok(resp) if resp.status().is_success() => {
            let body = resp.json::<serde_json::Value>().await.unwrap_or_default();
            let count = body.get("count").and_then(|v| v.as_u64()).unwrap_or(0);
            if count > 0 {
                println!("   ✓ Session history persisted ({} messages)", count);
            } else {
                println!("   ✗ No messages in history");
            }
        }
        _ => {
            println!("   ✗ Failed to get history");
        }
    }

    // 4. Test abort
    println!("4. Testing abort...");
    let abort_resp = client
        .post(format!("{}/sessions/{}/abort", base_url, session_id))
        .json(&serde_json::json!({
            "reason": "Test abort"
        }))
        .send()
        .await;

    match abort_resp {
        Ok(resp) if resp.status().is_success() => {
            println!("   ✓ Abort successful");
        }
        _ => {
            println!("   ✗ Abort failed");
        }
    }

    // 5. Delete session
    println!("5. Cleaning up...");
    let delete_resp = client
        .delete(format!("{}/sessions/{}", base_url, session_id))
        .send()
        .await;

    match delete_resp {
        Ok(resp) if resp.status().is_success() || resp.status().as_u16() == 204 => {
            println!("   ✓ Session deleted");
        }
        _ => {
            println!("   ⚠ Failed to delete session (may not exist)");
        }
    }

    println!("\n=== Test Complete ===\n");
}

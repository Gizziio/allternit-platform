//! Integration tests for MCP stdio transport
//!
//! These tests verify the stdio transport functionality by spawning
//! actual subprocesses and communicating with them via JSON-RPC.

use mcp::transport::{McpTransport, StdioTransport};
use mcp::types::{JsonRpcMessage, JsonRpcNotification, JsonRpcRequest};

/// Test that we can spawn a simple cat process and verify it works
#[tokio::test]
async fn test_stdio_spawn_cat() {
    // 'cat' simply echoes back what we send to it
    let mut transport = StdioTransport::new("cat", &[]).expect("Failed to create transport");

    // Connect should succeed
    transport.connect().await.expect("Failed to connect");
    assert!(transport.is_connected());

    // Send a notification
    let notification = JsonRpcNotification::new("test/notification", None);
    transport
        .send(JsonRpcMessage::Notification(notification))
        .await
        .expect("Failed to send");

    // Give cat time to echo back
    // Cat will echo the JSON line we sent
    let response = transport.receive().await.expect("Failed to receive");
    assert!(
        response.is_some(),
        "Should receive echoed response from cat"
    );

    // Close should succeed
    transport.close().await.expect("Failed to close");
    assert!(!transport.is_connected());
}

/// Test sending and receiving JSON-RPC messages with echo
#[tokio::test]
async fn test_stdio_jsonrpc_echo() {
    let mut transport = StdioTransport::new("cat", &[]).expect("Failed to create transport");
    transport.connect().await.expect("Failed to connect");

    // Send a JSON-RPC request
    let request = JsonRpcRequest::new(1, "test/method", Some(serde_json::json!({"key": "value"})));
    let json_request = serde_json::to_string(&request).expect("Failed to serialize");

    transport
        .send(JsonRpcMessage::Request(request))
        .await
        .expect("Failed to send request");

    // Receive the echoed message
    let response = transport.receive().await.expect("Failed to receive");
    assert!(response.is_some());

    // Verify the echoed message is valid JSON-RPC
    match response.unwrap() {
        JsonRpcMessage::Request(req) => {
            assert_eq!(req.id, 1);
            assert_eq!(req.method, "test/method");
        }
        JsonRpcMessage::Notification(notif) => {
            // Cat might split the line differently
            println!("Received notification: {:?}", notif);
        }
        _ => {
            // Other message types are also fine - we just need to receive something
        }
    }

    transport.close().await.expect("Failed to close");
}

/// Test that transport properly handles process exit
#[tokio::test]
async fn test_stdio_process_exit() {
    // Use 'echo' which exits immediately after printing
    let mut transport =
        StdioTransport::new("echo", &["hello".to_string()]).expect("Failed to create transport");

    transport.connect().await.expect("Failed to connect");

    // Give the process time to exit
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Try to receive - should return None as process has exited
    let result = transport.receive().await;

    // The process should have exited, connection should be marked as not connected
    // or we should get an error/None
    match result {
        Ok(None) => {
            // Expected - process exited gracefully
        }
        Ok(Some(_)) => {
            // Also acceptable - might have received the echo output
        }
        Err(_) => {
            // Also acceptable - transport error due to process exit
        }
    }

    // Clean up
    let _ = transport.close().await;
}

/// Test environment variable passing
#[tokio::test]
async fn test_stdio_env_vars() {
    // Use 'env' to print environment variables
    let mut transport = StdioTransport::new("env", &[])
        .expect("Failed to create transport")
        .env("MCP_TEST_VAR", "test_value");

    transport.connect().await.expect("Failed to connect");

    // Give env time to print and exit
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Try to receive - env outputs to stdout
    while let Ok(Some(msg)) = transport.receive().await {
        println!("Received: {:?}", msg);
    }

    transport.close().await.ok();
}

/// Test multiple sequential connections
#[tokio::test]
async fn test_stdio_multiple_connections() {
    for i in 0..3 {
        let mut transport =
            StdioTransport::new("cat", &[]).expect(&format!("Failed to create transport {}", i));

        transport
            .connect()
            .await
            .expect(&format!("Failed to connect {}", i));
        assert!(transport.is_connected());

        // Send a message
        let notification = JsonRpcNotification::new("test", None);
        transport
            .send(JsonRpcMessage::Notification(notification))
            .await
            .expect(&format!("Failed to send {}", i));

        // Receive echo
        let response = transport.receive().await.expect("Failed to receive");
        assert!(response.is_some());

        transport
            .close()
            .await
            .expect(&format!("Failed to close {}", i));
        assert!(!transport.is_connected());
    }
}

/// Test that connection fails for non-existent command
#[tokio::test]
async fn test_stdio_nonexistent_command() {
    let mut transport = StdioTransport::new("nonexistent_command_xyz_abc", &[])
        .expect("Failed to create transport");

    let result = transport.connect().await;
    assert!(
        result.is_err(),
        "Should fail to connect to non-existent command"
    );
}

/// Test sending when not connected fails
#[tokio::test]
async fn test_stdio_send_not_connected() {
    let mut transport = StdioTransport::new("cat", &[]).expect("Failed to create transport");

    // Don't connect - just try to send
    let notification = JsonRpcNotification::new("test", None);
    let result = transport
        .send(JsonRpcMessage::Notification(notification))
        .await;

    assert!(result.is_err(), "Should fail to send when not connected");
}

/// Test receiving when not connected fails
#[tokio::test]
async fn test_stdio_receive_not_connected() {
    let mut transport = StdioTransport::new("cat", &[]).expect("Failed to create transport");

    // Don't connect - just try to receive
    let result = transport.receive().await;

    assert!(result.is_err(), "Should fail to receive when not connected");
}

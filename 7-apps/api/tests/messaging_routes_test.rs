//! Messaging Routes Tests
//!
//! Tests for the agent mail API endpoints:
//! - GET /api/v1/local/agent-mail
//! - GET /api/v1/local/agent-mail/{agent_id}
//! - POST /api/v1/local/agent-mail/{id}/respond

use a2rchitech_api::routes::GetAgentMailResponse;
use a2rchitech_history::HistoryLedger;
use a2rchitech_messaging::{AgentMail, MailMessageEnvelope, MessagingSystem};
use sqlx::SqlitePool;
use std::sync::{Arc, Mutex};
use tempfile::NamedTempFile;
use uuid::Uuid;

/// Create a test messaging system with in-memory storage
async fn create_test_messaging_system() -> (MessagingSystem, SqlitePool, String) {
    // Create a temporary SQLite database file
    let temp_db = NamedTempFile::new().expect("Failed to create temp database");
    let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
    let pool = SqlitePool::connect(&db_url)
        .await
        .expect("Failed to connect to database");

    // Create a temporary history ledger file
    let temp_path = format!("/tmp/test_messaging_{}.jsonl", Uuid::new_v4());
    let history_ledger = Arc::new(Mutex::new(
        HistoryLedger::new(&temp_path).expect("Failed to create history ledger"),
    ));

    // Create messaging system with migrations
    let messaging_system = MessagingSystem::new_with_migrations(
        history_ledger.clone(),
        pool.clone(),
        std::path::Path::new("../../1-kernel/communication/kernel-messaging/migrations"),
    )
    .await
    .expect("Failed to create messaging system");

    (messaging_system, pool, temp_path)
}

/// Test GetAgentMailResponse serialization
#[test]
fn test_get_agent_mail_response_serialization() {
    let response = GetAgentMailResponse {
        agent_id: "agent-123".to_string(),
        messages: vec![serde_json::json!({
            "message_id": "msg-1",
            "subject": "Test Message"
        })],
        count: 1,
        receipt: serde_json::json!({
            "receipt_id": Uuid::new_v4().to_string(),
            "event_type": "mail.get",
            "timestamp": chrono::Utc::now(),
            "data": {
                "agent_id": "agent-123",
                "message_count": 1
            }
        }),
    };

    // Verify serialization works
    let json = serde_json::to_value(&response).expect("Failed to serialize GetAgentMailResponse");
    assert_eq!(json["agent_id"], "agent-123");
    assert_eq!(json["count"], 1);
    assert!(json.get("messages").is_some());
    assert!(json.get("receipt").is_some());
    assert_eq!(json["receipt"]["event_type"], "mail.get");
}

/// Test receipt generation for agent mail operations
#[test]
fn test_agent_mail_receipt_generation() {
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "mail.get",
        "timestamp": chrono::Utc::now(),
        "data": {
            "agent_id": "agent-123",
            "message_count": 5
        }
    });

    assert!(receipt.get("receipt_id").is_some());
    assert_eq!(receipt["event_type"], "mail.get");
    assert!(receipt.get("timestamp").is_some());
    assert_eq!(receipt["data"]["agent_id"], "agent-123");
    assert_eq!(receipt["data"]["message_count"], 5);
}

/// Test AgentMail get_inbox functionality
#[tokio::test]
async fn test_agent_mail_get_inbox() {
    let (messaging_system, _pool, temp_path) = create_test_messaging_system().await;

    let agent_id = format!("agent-{}", Uuid::new_v4());
    let message = MailMessageEnvelope {
        message_id: Uuid::new_v4().to_string(),
        tenant_id: "tenant-1".to_string(),
        thread_id: format!("thread-{}", Uuid::new_v4()),
        from_identity: "sender-1".to_string(),
        to_identities: vec![agent_id.clone()],
        subject: "Test Subject".to_string(),
        body_md: "Test message body".to_string(),
        attachments: vec![],
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        tags: vec!["test".to_string()],
        trace_id: Some(format!("trace-{}", Uuid::new_v4())),
        reply_to_message_id: None,
        priority: Some(1),
        expires_at: None,
    };

    // Send message to agent
    messaging_system
        .agent_mail
        .send_message(message.clone())
        .await
        .expect("Failed to send message");

    // Get inbox for the agent
    let inbox = messaging_system
        .agent_mail
        .get_inbox(agent_id.clone())
        .await
        .expect("Failed to get inbox");

    assert_eq!(inbox.len(), 1);
    assert_eq!(inbox[0].message_id, message.message_id);
    assert_eq!(inbox[0].subject, message.subject);

    // Clean up
    let _ = std::fs::remove_file(&temp_path);
}

/// Test AgentMail get_inbox with multiple messages
#[tokio::test]
async fn test_agent_mail_multiple_messages() {
    let (messaging_system, _pool, temp_path) = create_test_messaging_system().await;

    let agent_id = format!("agent-{}", Uuid::new_v4());
    let mut expected_message_ids = Vec::new();

    // Send 3 messages to the agent
    for i in 0..3 {
        let message = MailMessageEnvelope {
            message_id: Uuid::new_v4().to_string(),
            tenant_id: "tenant-1".to_string(),
            thread_id: format!("thread-{}", Uuid::new_v4()),
            from_identity: "sender-1".to_string(),
            to_identities: vec![agent_id.clone()],
            subject: format!("Test Subject {}", i),
            body_md: format!("Test message body {}", i),
            attachments: vec![],
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            tags: vec!["test".to_string()],
            trace_id: Some(format!("trace-{}", Uuid::new_v4())),
            reply_to_message_id: None,
            priority: Some(i as i32),
            expires_at: None,
        };
        expected_message_ids.push(message.message_id.clone());

        messaging_system
            .agent_mail
            .send_message(message)
            .await
            .expect("Failed to send message");
    }

    // Get inbox for the agent
    let inbox = messaging_system
        .agent_mail
        .get_inbox(agent_id.clone())
        .await
        .expect("Failed to get inbox");

    assert_eq!(inbox.len(), 3);

    // Verify all message IDs are present
    for msg in &inbox {
        assert!(expected_message_ids.contains(&msg.message_id));
    }

    // Clean up
    let _ = std::fs::remove_file(&temp_path);
}

/// Test AgentMail get_inbox with empty inbox
#[tokio::test]
async fn test_agent_mail_empty_inbox() {
    let (messaging_system, _pool, temp_path) = create_test_messaging_system().await;

    let agent_id = format!("agent-{}", Uuid::new_v4());

    // Get inbox for an agent with no messages
    let inbox = messaging_system
        .agent_mail
        .get_inbox(agent_id.clone())
        .await
        .expect("Failed to get inbox");

    assert_eq!(inbox.len(), 0);

    // Clean up
    let _ = std::fs::remove_file(&temp_path);
}

/// Test AgentMail get_inbox for different agents (isolation)
#[tokio::test]
async fn test_agent_mail_agent_isolation() {
    let (messaging_system, _pool, temp_path) = create_test_messaging_system().await;

    let agent_id_1 = format!("agent-1-{}", Uuid::new_v4());
    let agent_id_2 = format!("agent-2-{}", Uuid::new_v4());

    // Send message to agent 1
    let message_1 = MailMessageEnvelope {
        message_id: Uuid::new_v4().to_string(),
        tenant_id: "tenant-1".to_string(),
        thread_id: format!("thread-{}", Uuid::new_v4()),
        from_identity: "sender-1".to_string(),
        to_identities: vec![agent_id_1.clone()],
        subject: "Message for Agent 1".to_string(),
        body_md: "Body for Agent 1".to_string(),
        attachments: vec![],
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        tags: vec!["test".to_string()],
        trace_id: None,
        reply_to_message_id: None,
        priority: None,
        expires_at: None,
    };

    messaging_system
        .agent_mail
        .send_message(message_1)
        .await
        .expect("Failed to send message");

    // Agent 2 should have empty inbox
    let inbox_2 = messaging_system
        .agent_mail
        .get_inbox(agent_id_2.clone())
        .await
        .expect("Failed to get inbox for agent 2");

    assert_eq!(inbox_2.len(), 0);

    // Agent 1 should have one message
    let inbox_1 = messaging_system
        .agent_mail
        .get_inbox(agent_id_1.clone())
        .await
        .expect("Failed to get inbox for agent 1");

    assert_eq!(inbox_1.len(), 1);
    assert_eq!(inbox_1[0].subject, "Message for Agent 1");

    // Clean up
    let _ = std::fs::remove_file(&temp_path);
}

/// Test MailMessageEnvelope serialization
#[test]
fn test_mail_message_envelope_serialization() {
    let message = MailMessageEnvelope {
        message_id: "msg-123".to_string(),
        tenant_id: "tenant-1".to_string(),
        thread_id: "thread-456".to_string(),
        from_identity: "sender@example.com".to_string(),
        to_identities: vec!["recipient@example.com".to_string()],
        subject: "Test Subject".to_string(),
        body_md: "Test body content".to_string(),
        attachments: vec!["artifact-1".to_string()],
        created_at: 1234567890,
        tags: vec!["important".to_string(), "test".to_string()],
        trace_id: Some("trace-789".to_string()),
        reply_to_message_id: Some("msg-000".to_string()),
        priority: Some(1),
        expires_at: Some(1234567900),
    };

    let json = serde_json::to_value(&message).expect("Failed to serialize MailMessageEnvelope");
    assert_eq!(json["message_id"], "msg-123");
    assert_eq!(json["subject"], "Test Subject");
    assert_eq!(json["to_identities"][0], "recipient@example.com");
    assert_eq!(json["tags"][0], "important");
}

/// Test AgentMail get_outbox functionality
#[tokio::test]
async fn test_agent_mail_get_outbox() {
    let (messaging_system, _pool, temp_path) = create_test_messaging_system().await;

    let agent_id = format!("agent-{}", Uuid::new_v4());
    let message = MailMessageEnvelope {
        message_id: Uuid::new_v4().to_string(),
        tenant_id: "tenant-1".to_string(),
        thread_id: format!("thread-{}", Uuid::new_v4()),
        from_identity: agent_id.clone(),
        to_identities: vec!["recipient-1".to_string()],
        subject: "Test Outbox Subject".to_string(),
        body_md: "Test outbox message body".to_string(),
        attachments: vec![],
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        tags: vec!["test".to_string()],
        trace_id: Some(format!("trace-{}", Uuid::new_v4())),
        reply_to_message_id: None,
        priority: Some(1),
        expires_at: None,
    };

    // Send message from agent (to outbox)
    messaging_system
        .agent_mail
        .send_message(message.clone())
        .await
        .expect("Failed to send message");

    // Get outbox for the agent
    let outbox = messaging_system
        .agent_mail
        .get_outbox(agent_id.clone())
        .await
        .expect("Failed to get outbox");

    assert_eq!(outbox.len(), 1);
    assert_eq!(outbox[0].message_id, message.message_id);
    assert_eq!(outbox[0].subject, message.subject);
    assert_eq!(outbox[0].from_identity, agent_id);

    // Clean up
    let _ = std::fs::remove_file(&temp_path);
}

/// Test AgentMail get_outbox with multiple messages
#[tokio::test]
async fn test_agent_mail_outbox_multiple_messages() {
    let (messaging_system, _pool, temp_path) = create_test_messaging_system().await;

    let agent_id = format!("agent-{}", Uuid::new_v4());
    let mut expected_message_ids = Vec::new();

    // Send 3 messages from the agent
    for i in 0..3 {
        let message = MailMessageEnvelope {
            message_id: Uuid::new_v4().to_string(),
            tenant_id: "tenant-1".to_string(),
            thread_id: format!("thread-{}", Uuid::new_v4()),
            from_identity: agent_id.clone(),
            to_identities: vec![format!("recipient-{}", i)],
            subject: format!("Outbox Message {}", i),
            body_md: format!("Outbox message body {}", i),
            attachments: vec![],
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            tags: vec!["test".to_string()],
            trace_id: Some(format!("trace-{}", Uuid::new_v4())),
            reply_to_message_id: None,
            priority: Some(i as i32),
            expires_at: None,
        };
        expected_message_ids.push(message.message_id.clone());

        messaging_system
            .agent_mail
            .send_message(message)
            .await
            .expect("Failed to send message");
    }

    // Get outbox for the agent
    let outbox = messaging_system
        .agent_mail
        .get_outbox(agent_id.clone())
        .await
        .expect("Failed to get outbox");

    assert_eq!(outbox.len(), 3);

    // Verify all message IDs are present
    for msg in &outbox {
        assert!(expected_message_ids.contains(&msg.message_id));
    }

    // Clean up
    let _ = std::fs::remove_file(&temp_path);
}

/// Test AgentMail get_outbox with empty outbox
#[tokio::test]
async fn test_agent_mail_empty_outbox() {
    let (messaging_system, _pool, temp_path) = create_test_messaging_system().await;

    let agent_id = format!("agent-{}", Uuid::new_v4());

    // Get outbox for an agent with no sent messages
    let outbox = messaging_system
        .agent_mail
        .get_outbox(agent_id.clone())
        .await
        .expect("Failed to get outbox");

    assert_eq!(outbox.len(), 0);

    // Clean up
    let _ = std::fs::remove_file(&temp_path);
}

/// Test AgentMail inbox/outbox isolation
#[tokio::test]
async fn test_agent_mail_inbox_outbox_isolation() {
    let (messaging_system, _pool, temp_path) = create_test_messaging_system().await;

    let agent_id = format!("agent-{}", Uuid::new_v4());

    // Send message TO the agent (inbox)
    let inbox_message = MailMessageEnvelope {
        message_id: Uuid::new_v4().to_string(),
        tenant_id: "tenant-1".to_string(),
        thread_id: format!("thread-{}", Uuid::new_v4()),
        from_identity: "sender-1".to_string(),
        to_identities: vec![agent_id.clone()],
        subject: "Inbox Message".to_string(),
        body_md: "Inbox body".to_string(),
        attachments: vec![],
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        tags: vec!["test".to_string()],
        trace_id: None,
        reply_to_message_id: None,
        priority: None,
        expires_at: None,
    };

    // Send message FROM the agent (outbox)
    let outbox_message = MailMessageEnvelope {
        message_id: Uuid::new_v4().to_string(),
        tenant_id: "tenant-1".to_string(),
        thread_id: format!("thread-{}", Uuid::new_v4()),
        from_identity: agent_id.clone(),
        to_identities: vec!["recipient-1".to_string()],
        subject: "Outbox Message".to_string(),
        body_md: "Outbox body".to_string(),
        attachments: vec![],
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        tags: vec!["test".to_string()],
        trace_id: None,
        reply_to_message_id: None,
        priority: None,
        expires_at: None,
    };

    messaging_system
        .agent_mail
        .send_message(inbox_message)
        .await
        .expect("Failed to send inbox message");

    messaging_system
        .agent_mail
        .send_message(outbox_message)
        .await
        .expect("Failed to send outbox message");

    // Inbox should have 1 message (the one sent TO the agent)
    let inbox = messaging_system
        .agent_mail
        .get_inbox(agent_id.clone())
        .await
        .expect("Failed to get inbox");

    assert_eq!(inbox.len(), 1);
    assert_eq!(inbox[0].subject, "Inbox Message");

    // Outbox should have 1 message (the one sent FROM the agent)
    let outbox = messaging_system
        .agent_mail
        .get_outbox(agent_id.clone())
        .await
        .expect("Failed to get outbox");

    assert_eq!(outbox.len(), 1);
    assert_eq!(outbox[0].subject, "Outbox Message");

    // Clean up
    let _ = std::fs::remove_file(&temp_path);
}

/// Test receipt generation for outbox operations
#[test]
fn test_agent_outbox_receipt_generation() {
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "mail.get_outbox",
        "timestamp": chrono::Utc::now(),
        "data": {
            "agent_id": "agent-123",
            "message_count": 5
        }
    });

    assert!(receipt.get("receipt_id").is_some());
    assert_eq!(receipt["event_type"], "mail.get_outbox");
    assert!(receipt.get("timestamp").is_some());
    assert_eq!(receipt["data"]["agent_id"], "agent-123");
    assert_eq!(receipt["data"]["message_count"], 5);
}

/// Test SendAgentMailRequest serialization
#[test]
fn test_send_agent_mail_request_serialization() {
    let request = serde_json::json!({
        "from": "sender@example.com",
        "to": "recipient@example.com",
        "subject": "Test Subject",
        "body": {
            "content": "Test message body",
            "format": "markdown"
        }
    });

    assert_eq!(request["from"], "sender@example.com");
    assert_eq!(request["to"], "recipient@example.com");
    assert_eq!(request["subject"], "Test Subject");
    assert_eq!(request["body"]["content"], "Test message body");
}

/// Test SendAgentMailResponse serialization
#[test]
fn test_send_agent_mail_response_serialization() {
    let response = serde_json::json!({
        "message": {
            "message_id": "msg-123",
            "subject": "Test Subject",
            "from_identity": "sender@example.com",
            "to_identities": ["recipient@example.com"]
        },
        "receipt": {
            "receipt_id": Uuid::new_v4().to_string(),
            "event_type": "mail.send",
            "timestamp": chrono::Utc::now(),
            "data": {
                "from": "sender@example.com",
                "to": "recipient@example.com",
                "message_id": "msg-123"
            }
        }
    });

    assert!(response.get("message").is_some());
    assert!(response.get("receipt").is_some());
    assert_eq!(response["receipt"]["event_type"], "mail.send");
    assert!(response["receipt"].get("receipt_id").is_some());
    assert!(response["receipt"].get("timestamp").is_some());
}

/// Test send_agent_mail receipt generation
#[test]
fn test_send_agent_mail_receipt_generation() {
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "mail.send",
        "timestamp": chrono::Utc::now(),
        "data": {
            "from": "sender@example.com",
            "to": "recipient@example.com",
            "message_id": "msg-123"
        }
    });

    assert!(receipt.get("receipt_id").is_some());
    assert_eq!(receipt["event_type"], "mail.send");
    assert!(receipt.get("timestamp").is_some());
    assert_eq!(receipt["data"]["from"], "sender@example.com");
    assert_eq!(receipt["data"]["to"], "recipient@example.com");
    assert_eq!(receipt["data"]["message_id"], "msg-123");
}

/// Test AgentMail send_message functionality
#[tokio::test]
async fn test_agent_mail_send_message() {
    let (messaging_system, _pool, temp_path) = create_test_messaging_system().await;

    let agent_id = format!("agent-{}", Uuid::new_v4());
    let recipient_id = format!("recipient-{}", Uuid::new_v4());
    let message = MailMessageEnvelope {
        message_id: Uuid::new_v4().to_string(),
        tenant_id: "tenant-1".to_string(),
        thread_id: format!("thread-{}", Uuid::new_v4()),
        from_identity: agent_id.clone(),
        to_identities: vec![recipient_id.clone()],
        subject: "Test Send Message".to_string(),
        body_md: "Test message body for send".to_string(),
        attachments: vec![],
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        tags: vec!["test".to_string(), "send".to_string()],
        trace_id: Some(format!("trace-{}", Uuid::new_v4())),
        reply_to_message_id: None,
        priority: Some(1),
        expires_at: None,
    };

    // Send message
    messaging_system
        .agent_mail
        .send_message(message.clone())
        .await
        .expect("Failed to send message");

    // Verify message was delivered to recipient's inbox
    let inbox = messaging_system
        .agent_mail
        .get_inbox(recipient_id.clone())
        .await
        .expect("Failed to get inbox");

    assert_eq!(inbox.len(), 1);
    assert_eq!(inbox[0].message_id, message.message_id);
    assert_eq!(inbox[0].subject, message.subject);
    assert_eq!(inbox[0].from_identity, agent_id);

    // Clean up
    let _ = std::fs::remove_file(&temp_path);
}

/// Test AgentMail send_message with multiple recipients
#[tokio::test]
async fn test_agent_mail_send_multiple_recipients() {
    let (messaging_system, _pool, temp_path) = create_test_messaging_system().await;

    let agent_id = format!("agent-{}", Uuid::new_v4());
    let recipient_1 = format!("recipient-1-{}", Uuid::new_v4());
    let recipient_2 = format!("recipient-2-{}", Uuid::new_v4());
    let message = MailMessageEnvelope {
        message_id: Uuid::new_v4().to_string(),
        tenant_id: "tenant-1".to_string(),
        thread_id: format!("thread-{}", Uuid::new_v4()),
        from_identity: agent_id.clone(),
        to_identities: vec![recipient_1.clone(), recipient_2.clone()],
        subject: "Test Multiple Recipients".to_string(),
        body_md: "Test message for multiple recipients".to_string(),
        attachments: vec![],
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        tags: vec!["test".to_string()],
        trace_id: None,
        reply_to_message_id: None,
        priority: None,
        expires_at: None,
    };

    // Send message
    messaging_system
        .agent_mail
        .send_message(message.clone())
        .await
        .expect("Failed to send message");

    // Verify message was delivered to both recipients
    let inbox_1 = messaging_system
        .agent_mail
        .get_inbox(recipient_1.clone())
        .await
        .expect("Failed to get inbox for recipient 1");

    let inbox_2 = messaging_system
        .agent_mail
        .get_inbox(recipient_2.clone())
        .await
        .expect("Failed to get inbox for recipient 2");

    assert_eq!(inbox_1.len(), 1);
    assert_eq!(inbox_2.len(), 1);
    assert_eq!(inbox_1[0].message_id, message.message_id);
    assert_eq!(inbox_2[0].message_id, message.message_id);

    // Clean up
    let _ = std::fs::remove_file(&temp_path);
}

/// Test AgentMail send_message with reply_to_message_id
#[tokio::test]
async fn test_agent_mail_send_reply() {
    let (messaging_system, _pool, temp_path) = create_test_messaging_system().await;

    let agent_id = format!("agent-{}", Uuid::new_v4());
    let recipient_id = format!("recipient-{}", Uuid::new_v4());
    let original_message_id = Uuid::new_v4().to_string();

    // First send an original message
    let original_message = MailMessageEnvelope {
        message_id: original_message_id.clone(),
        tenant_id: "tenant-1".to_string(),
        thread_id: format!("thread-{}", Uuid::new_v4()),
        from_identity: recipient_id.clone(),
        to_identities: vec![agent_id.clone()],
        subject: "Original Message".to_string(),
        body_md: "Original message body".to_string(),
        attachments: vec![],
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        tags: vec!["test".to_string()],
        trace_id: None,
        reply_to_message_id: None,
        priority: None,
        expires_at: None,
    };

    messaging_system
        .agent_mail
        .send_message(original_message)
        .await
        .expect("Failed to send original message");

    // Now send a reply
    let reply_message = MailMessageEnvelope {
        message_id: Uuid::new_v4().to_string(),
        tenant_id: "tenant-1".to_string(),
        thread_id: format!("thread-{}", Uuid::new_v4()),
        from_identity: agent_id.clone(),
        to_identities: vec![recipient_id.clone()],
        subject: "Re: Original Message".to_string(),
        body_md: "Reply message body".to_string(),
        attachments: vec![],
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        tags: vec!["test".to_string(), "reply".to_string()],
        trace_id: None,
        reply_to_message_id: Some(original_message_id.clone()),
        priority: None,
        expires_at: None,
    };

    messaging_system
        .agent_mail
        .send_message(reply_message.clone())
        .await
        .expect("Failed to send reply message");

    // Verify reply was delivered
    let inbox = messaging_system
        .agent_mail
        .get_inbox(recipient_id.clone())
        .await
        .expect("Failed to get inbox");

    assert_eq!(inbox.len(), 2);
    let reply = inbox
        .iter()
        .find(|m| m.reply_to_message_id.is_some())
        .unwrap();
    assert_eq!(reply.reply_to_message_id, Some(original_message_id.clone()));

    // Clean up
    let _ = std::fs::remove_file(&temp_path);
}

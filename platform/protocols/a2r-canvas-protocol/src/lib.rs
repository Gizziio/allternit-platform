use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasEvent {
    #[serde(rename = "type")]
    pub event_type: CanvasEventType,
    pub id: Uuid,
    pub ts: i64,
    pub topic: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CanvasEventType {
    Render,
    Status,
    ToolResult,
    Notification,
}

impl CanvasEvent {
    pub fn new(event_type: CanvasEventType, topic: impl Into<String>, payload: serde_json::Value) -> Self {
        Self {
            event_type,
            id: Uuid::new_v4(),
            ts: Utc::now().timestamp_millis(),
            topic: topic.into(),
            payload,
        }
    }
}

pub const CANVAS_PROTOCOL_SCHEMA: &str = r#"{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CanvasEvent",
  "type": "object",
  "required": ["type", "id", "ts", "topic", "payload"],
      "properties": {
      "type": {
        "type": "string",
        "enum": ["render", "status", "tool_result", "notification"]
      },
      "id": {
        "type": "string",
        "format": "uuid"
      },
      "ts": {
        "type": "integer",
        "description": "Unix timestamp in milliseconds"
      },
      "topic": {
        "type": "string"
      },
      "payload": {
        "type": "object"
      }
    }
  }"#;
  
  #[cfg(test)]
  mod tests {
      use super::*;
  
      #[test]
      fn test_event_serialization() {
          let event = CanvasEvent::new(
              CanvasEventType::Status,
              "test.topic",
              serde_json::json!({"foo": "bar"}),
          );
          let json = serde_json::to_string(&event).unwrap();
          let deserialized: CanvasEvent = serde_json::from_str(&json).unwrap();
          
          assert_eq!(deserialized.topic, "test.topic");
          assert_eq!(deserialized.payload["foo"], "bar");
      }
  }
  

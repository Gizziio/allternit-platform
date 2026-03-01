use crate::{EventEnvelope, LeaseEnvelope, MailMessageEnvelope, MessagingError, TaskEnvelope};
use async_trait::async_trait;
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

// SQLite-based storage implementation for TaskQueue
pub struct SqliteTaskQueueStorage {
    pool: SqlitePool,
}

impl SqliteTaskQueueStorage {
    pub async fn new(pool: SqlitePool) -> Result<Self, MessagingError> {
        // Create the tasks table if it doesn't exist
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS tasks (
                task_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                tenant_id TEXT NOT NULL,
                workflow_id TEXT NOT NULL,
                step_id TEXT NOT NULL,
                role TEXT NOT NULL,
                intent TEXT NOT NULL,
                input_refs TEXT NOT NULL,
                constraints TEXT NOT NULL,
                idempotency_key TEXT,
                created_at INTEGER NOT NULL,
                ttl INTEGER,
                retry_policy TEXT NOT NULL,
                priority INTEGER,
                deadline INTEGER,
                parent_task_id TEXT,
                trace_id TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                completed_at INTEGER,
                error_message TEXT
            )",
        )
        .execute(&pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        // Backfill missing columns for older schemas.
        let columns: Vec<(i64, String, String, i64, Option<String>, i64)> =
            sqlx::query_as("PRAGMA table_info(tasks)")
                .fetch_all(&pool)
                .await
                .map_err(MessagingError::Sqlx)?;
        let has_status = columns.iter().any(|col| col.1 == "status");
        if !has_status {
            sqlx::query("ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'")
                .execute(&pool)
                .await
                .map_err(MessagingError::Sqlx)?;
        }
        let has_completed_at = columns.iter().any(|col| col.1 == "completed_at");
        if !has_completed_at {
            sqlx::query("ALTER TABLE tasks ADD COLUMN completed_at INTEGER")
                .execute(&pool)
                .await
                .map_err(MessagingError::Sqlx)?;
        }
        let has_error_message = columns.iter().any(|col| col.1 == "error_message");
        if !has_error_message {
            sqlx::query("ALTER TABLE tasks ADD COLUMN error_message TEXT")
                .execute(&pool)
                .await
                .map_err(MessagingError::Sqlx)?;
        }

        Ok(SqliteTaskQueueStorage { pool })
    }
}

#[async_trait]
impl super::TaskQueueStorage for SqliteTaskQueueStorage {
    async fn enqueue(&self, task: TaskEnvelope) -> Result<(), MessagingError> {
        let input_refs_json =
            serde_json::to_string(&task.input_refs).map_err(MessagingError::Json)?;
        let constraints_json =
            serde_json::to_string(&task.constraints).map_err(MessagingError::Json)?;
        let retry_policy_json =
            serde_json::to_string(&task.retry_policy).map_err(MessagingError::Json)?;

        sqlx::query(
            "INSERT INTO tasks (
                task_id, session_id, tenant_id, workflow_id, step_id, role, intent,
                input_refs, constraints, idempotency_key, created_at, ttl, retry_policy,
                priority, deadline, parent_task_id, trace_id, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&task.task_id)
        .bind(&task.session_id)
        .bind(&task.tenant_id)
        .bind(&task.workflow_id)
        .bind(&task.step_id)
        .bind(&task.role)
        .bind(&task.intent)
        .bind(&input_refs_json)
        .bind(&constraints_json)
        .bind(&task.idempotency_key)
        .bind(task.created_at as i64)
        .bind(task.ttl.map(|t| t as i64))
        .bind(&retry_policy_json)
        .bind(task.priority)
        .bind(task.deadline.map(|d| d as i64))
        .bind(&task.parent_task_id)
        .bind(&task.trace_id)
        .bind("pending")
        .execute(&self.pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        Ok(())
    }

    async fn dequeue(&self) -> Result<Option<TaskEnvelope>, MessagingError> {
        // Get the oldest pending task and update its status to 'processing'
        let row = sqlx::query(
            "UPDATE tasks 
             SET status = 'processing' 
             WHERE task_id = (
                 SELECT task_id 
                 FROM tasks 
                 WHERE status = 'pending' 
                 ORDER BY created_at ASC 
                 LIMIT 1
             )
             RETURNING *",
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        if let Some(row) = row {
            let input_refs: Vec<String> = serde_json::from_str(row.get::<&str, _>("input_refs"))
                .map_err(MessagingError::Json)?;
            let constraints: serde_json::Value =
                serde_json::from_str(row.get::<&str, _>("constraints"))
                    .map_err(MessagingError::Json)?;
            let retry_policy: crate::RetryPolicy =
                serde_json::from_str(row.get::<&str, _>("retry_policy"))
                    .map_err(MessagingError::Json)?;

            let task = TaskEnvelope {
                task_id: row.get("task_id"),
                session_id: row.get("session_id"),
                tenant_id: row.get("tenant_id"),
                workflow_id: row.get("workflow_id"),
                step_id: row.get("step_id"),
                role: row.get("role"),
                intent: row.get("intent"),
                input_refs,
                constraints,
                idempotency_key: row.get("idempotency_key"),
                created_at: row.get::<i64, _>("created_at") as u64,
                ttl: row.get::<Option<i64>, _>("ttl").map(|t| t as u64),
                retry_policy,
                priority: row.get("priority"),
                deadline: row.get::<Option<i64>, _>("deadline").map(|d| d as u64),
                parent_task_id: row.get("parent_task_id"),
                trace_id: row.get("trace_id"),
            };

            Ok(Some(task))
        } else {
            Ok(None)
        }
    }

    async fn get_pending_count(&self) -> Result<usize, MessagingError> {
        let result: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tasks WHERE status = 'pending'")
            .fetch_one(&self.pool)
            .await
            .map_err(MessagingError::Sqlx)?;

        Ok(result.0 as usize)
    }

    async fn complete_task(
        &self,
        task_id: String,
        _task: TaskEnvelope,
    ) -> Result<(), MessagingError> {
        let completed_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| MessagingError::TimeError(e.to_string()))?
            .as_secs();

        sqlx::query("UPDATE tasks SET status = 'completed', completed_at = ? WHERE task_id = ?")
            .bind(completed_at as i64)
            .bind(&task_id)
            .execute(&self.pool)
            .await
            .map_err(MessagingError::Sqlx)?;

        Ok(())
    }

    async fn fail_task(
        &self,
        task_id: String,
        task: TaskEnvelope,
        error: String,
    ) -> Result<(), MessagingError> {
        sqlx::query("UPDATE tasks SET status = 'failed', error_message = ? WHERE task_id = ?")
            .bind(&error)
            .bind(&task_id)
            .execute(&self.pool)
            .await
            .map_err(MessagingError::Sqlx)?;

        Ok(())
    }
}

// SQLite-based storage implementation for EventBus
pub struct SqliteEventBusStorage {
    pool: SqlitePool,
}

impl SqliteEventBusStorage {
    pub async fn new(pool: SqlitePool) -> Result<Self, MessagingError> {
        // Create the events table if it doesn't exist
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS events (
                event_id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                session_id TEXT NOT NULL,
                tenant_id TEXT NOT NULL,
                actor_id TEXT NOT NULL,
                role TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                trace_id TEXT,
                payload TEXT NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        Ok(SqliteEventBusStorage { pool })
    }
}

#[async_trait]
impl super::EventBusStorage for SqliteEventBusStorage {
    async fn publish(&self, event: EventEnvelope) -> Result<(), MessagingError> {
        let payload_json = serde_json::to_string(&event.payload).map_err(MessagingError::Json)?;

        sqlx::query(
            "INSERT INTO events (
                event_id, event_type, session_id, tenant_id, actor_id, role, timestamp, trace_id, payload
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&event.event_id)
        .bind(&event.event_type)
        .bind(&event.session_id)
        .bind(&event.tenant_id)
        .bind(&event.actor_id)
        .bind(&event.role)
        .bind(event.timestamp as i64)
        .bind(&event.trace_id)
        .bind(&payload_json)
        .execute(&self.pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        Ok(())
    }

    async fn subscribe(&self, event_type: String) -> Result<Vec<EventEnvelope>, MessagingError> {
        let rows = sqlx::query(
            "SELECT event_id, event_type, session_id, tenant_id, actor_id, role, timestamp, trace_id, payload
             FROM events 
             WHERE event_type = ? 
             ORDER BY timestamp ASC"
        )
        .bind(&event_type)
        .fetch_all(&self.pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        let mut events = Vec::new();
        for row in rows {
            let payload: serde_json::Value = serde_json::from_str(row.get::<&str, _>("payload"))
                .map_err(MessagingError::Json)?;

            let event = EventEnvelope {
                event_id: row.get("event_id"),
                event_type: row.get("event_type"),
                session_id: row.get("session_id"),
                tenant_id: row.get("tenant_id"),
                actor_id: row.get("actor_id"),
                role: row.get("role"),
                timestamp: row.get::<i64, _>("timestamp") as u64,
                trace_id: row.get("trace_id"),
                payload,
            };

            events.push(event);
        }

        Ok(events)
    }
}

// SQLite-based storage implementation for AgentMail
pub struct SqliteAgentMailStorage {
    pool: SqlitePool,
}

impl SqliteAgentMailStorage {
    pub async fn new(pool: SqlitePool) -> Result<Self, MessagingError> {
        // Create the mail_messages table if it doesn't exist
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS mail_messages (
                message_id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                thread_id TEXT NOT NULL,
                from_identity TEXT NOT NULL,
                to_identities TEXT NOT NULL,
                subject TEXT NOT NULL,
                body_md TEXT NOT NULL,
                attachments TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                tags TEXT NOT NULL,
                trace_id TEXT,
                reply_to_message_id TEXT,
                priority INTEGER,
                expires_at INTEGER
            )",
        )
        .execute(&pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        // Create an index for efficient inbox queries
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_to_identities ON mail_messages(to_identities)")
            .execute(&pool)
            .await
            .map_err(MessagingError::Sqlx)?;

        // Create an index for efficient thread queries
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_thread_id ON mail_messages(thread_id)")
            .execute(&pool)
            .await
            .map_err(MessagingError::Sqlx)?;

        Ok(SqliteAgentMailStorage { pool })
    }
}

#[async_trait]
impl super::AgentMailStorage for SqliteAgentMailStorage {
    async fn send_message(&self, message: MailMessageEnvelope) -> Result<(), MessagingError> {
        let to_identities_json =
            serde_json::to_string(&message.to_identities).map_err(MessagingError::Json)?;
        let attachments_json =
            serde_json::to_string(&message.attachments).map_err(MessagingError::Json)?;
        let tags_json = serde_json::to_string(&message.tags).map_err(MessagingError::Json)?;

        sqlx::query(
            "INSERT INTO mail_messages (
                message_id, tenant_id, thread_id, from_identity, to_identities, subject,
                body_md, attachments, created_at, tags, trace_id, reply_to_message_id,
                priority, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&message.message_id)
        .bind(&message.tenant_id)
        .bind(&message.thread_id)
        .bind(&message.from_identity)
        .bind(&to_identities_json)
        .bind(&message.subject)
        .bind(&message.body_md)
        .bind(&attachments_json)
        .bind(message.created_at as i64)
        .bind(&tags_json)
        .bind(&message.trace_id)
        .bind(&message.reply_to_message_id)
        .bind(message.priority)
        .bind(message.expires_at.map(|e| e as i64))
        .execute(&self.pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        Ok(())
    }

    async fn get_inbox(
        &self,
        agent_identity: String,
    ) -> Result<Vec<MailMessageEnvelope>, MessagingError> {
        let rows = sqlx::query(
            "SELECT message_id, tenant_id, thread_id, from_identity, to_identities, subject,
                    body_md, attachments, created_at, tags, trace_id, reply_to_message_id,
                    priority, expires_at
             FROM mail_messages
             WHERE to_identities LIKE ? 
             ORDER BY created_at ASC",
        )
        .bind(format!("%{}%", agent_identity)) // This is a simplified approach - in practice, we'd need proper JSON querying
        .fetch_all(&self.pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        let mut messages = Vec::new();
        for row in rows {
            let to_identities: Vec<String> =
                serde_json::from_str(row.get::<&str, _>("to_identities"))
                    .map_err(MessagingError::Json)?;
            let attachments: Vec<String> = serde_json::from_str(row.get::<&str, _>("attachments"))
                .map_err(MessagingError::Json)?;
            let tags: Vec<String> =
                serde_json::from_str(row.get::<&str, _>("tags")).map_err(MessagingError::Json)?;

            let message = MailMessageEnvelope {
                message_id: row.get("message_id"),
                tenant_id: row.get("tenant_id"),
                thread_id: row.get("thread_id"),
                from_identity: row.get("from_identity"),
                to_identities,
                subject: row.get("subject"),
                body_md: row.get("body_md"),
                attachments,
                created_at: row.get::<i64, _>("created_at") as u64,
                tags,
                trace_id: row.get("trace_id"),
                reply_to_message_id: row.get("reply_to_message_id"),
                priority: row.get("priority"),
                expires_at: row.get::<Option<i64>, _>("expires_at").map(|e| e as u64),
            };

            messages.push(message);
        }

        Ok(messages)
    }

    async fn get_outbox(
        &self,
        agent_identity: String,
    ) -> Result<Vec<MailMessageEnvelope>, MessagingError> {
        let rows = sqlx::query(
            "SELECT message_id, tenant_id, thread_id, from_identity, to_identities, subject,
                    body_md, attachments, created_at, tags, trace_id, reply_to_message_id,
                    priority, expires_at
             FROM mail_messages
             WHERE from_identity = ?
             ORDER BY created_at ASC",
        )
        .bind(&agent_identity)
        .fetch_all(&self.pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        let mut messages = Vec::new();
        for row in rows {
            let to_identities: Vec<String> =
                serde_json::from_str(row.get::<&str, _>("to_identities"))
                    .map_err(MessagingError::Json)?;
            let attachments: Vec<String> = serde_json::from_str(row.get::<&str, _>("attachments"))
                .map_err(MessagingError::Json)?;
            let tags: Vec<String> =
                serde_json::from_str(row.get::<&str, _>("tags")).map_err(MessagingError::Json)?;

            let message = MailMessageEnvelope {
                message_id: row.get("message_id"),
                tenant_id: row.get("tenant_id"),
                thread_id: row.get("thread_id"),
                from_identity: row.get("from_identity"),
                to_identities,
                subject: row.get("subject"),
                body_md: row.get("body_md"),
                attachments,
                created_at: row.get::<i64, _>("created_at") as u64,
                tags,
                trace_id: row.get("trace_id"),
                reply_to_message_id: row.get("reply_to_message_id"),
                priority: row.get("priority"),
                expires_at: row.get::<Option<i64>, _>("expires_at").map(|e| e as u64),
            };

            messages.push(message);
        }

        Ok(messages)
    }

    async fn get_thread(
        &self,
        thread_id: String,
    ) -> Result<Vec<MailMessageEnvelope>, MessagingError> {
        let rows = sqlx::query(
            "SELECT message_id, tenant_id, thread_id, from_identity, to_identities, subject,
                    body_md, attachments, created_at, tags, trace_id, reply_to_message_id,
                    priority, expires_at
             FROM mail_messages
             WHERE thread_id = ?
             ORDER BY created_at ASC",
        )
        .bind(&thread_id)
        .fetch_all(&self.pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        let mut messages = Vec::new();
        for row in rows {
            let to_identities: Vec<String> =
                serde_json::from_str(row.get::<&str, _>("to_identities"))
                    .map_err(MessagingError::Json)?;
            let attachments: Vec<String> = serde_json::from_str(row.get::<&str, _>("attachments"))
                .map_err(MessagingError::Json)?;
            let tags: Vec<String> =
                serde_json::from_str(row.get::<&str, _>("tags")).map_err(MessagingError::Json)?;

            let message = MailMessageEnvelope {
                message_id: row.get("message_id"),
                tenant_id: row.get("tenant_id"),
                thread_id: row.get("thread_id"),
                from_identity: row.get("from_identity"),
                to_identities,
                subject: row.get("subject"),
                body_md: row.get("body_md"),
                attachments,
                created_at: row.get::<i64, _>("created_at") as u64,
                tags,
                trace_id: row.get("trace_id"),
                reply_to_message_id: row.get("reply_to_message_id"),
                priority: row.get("priority"),
                expires_at: row.get::<Option<i64>, _>("expires_at").map(|e| e as u64),
            };

            messages.push(message);
        }

        Ok(messages)
    }
}

// SQLite-based storage implementation for CoordinationLeases
pub struct SqliteCoordinationLeasesStorage {
    pool: SqlitePool,
}

impl SqliteCoordinationLeasesStorage {
    pub async fn new(pool: SqlitePool) -> Result<Self, MessagingError> {
        // Create the leases table if it doesn't exist
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS leases (
                lease_id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                holder_identity TEXT NOT NULL,
                resource_selector TEXT NOT NULL UNIQUE,
                purpose TEXT NOT NULL,
                scope TEXT NOT NULL,
                acquired_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                trace_id TEXT,
                renew_token TEXT,
                conflict_policy TEXT NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        Ok(SqliteCoordinationLeasesStorage { pool })
    }
}

#[async_trait]
impl super::CoordinationLeasesStorage for SqliteCoordinationLeasesStorage {
    async fn acquire_lease(
        &self,
        mut lease: LeaseEnvelope,
    ) -> Result<LeaseEnvelope, MessagingError> {
        // Generate a renew token if not provided
        if lease.renew_token.is_none() {
            lease.renew_token = Some(Uuid::new_v4().to_string());
        }

        let scope_str = match lease.scope {
            crate::LeaseScope::Session => "Session",
            crate::LeaseScope::Workflow => "Workflow",
            crate::LeaseScope::Task => "Task",
        };

        let conflict_policy_str = match lease.conflict_policy {
            crate::ConflictPolicy::NotifyOnly => "NotifyOnly",
            crate::ConflictPolicy::Block => "Block",
            crate::ConflictPolicy::BranchOnly => "BranchOnly",
        };

        // Check for existing lease on the same resource
        let existing_lease: Option<(String, i64)> = sqlx::query_as(
            "SELECT holder_identity, expires_at FROM leases WHERE resource_selector = ?",
        )
        .bind(&lease.resource_selector)
        .fetch_optional(&self.pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        if let Some((holder_identity, expires_at)) = existing_lease {
            // Check if existing lease is still valid
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| MessagingError::TimeError(e.to_string()))?
                .as_secs() as i64;

            if expires_at > now {
                match lease.conflict_policy {
                    crate::ConflictPolicy::Block => {
                        return Err(MessagingError::LeaseConflict(format!(
                            "Resource {} is already leased by {}",
                            lease.resource_selector, holder_identity
                        )));
                    }
                    crate::ConflictPolicy::NotifyOnly => {
                        // Just log the conflict but allow acquisition
                        tracing::warn!(
                            "Lease conflict detected for resource {} between {} and {}",
                            lease.resource_selector,
                            holder_identity,
                            lease.holder_identity
                        );
                    }
                    crate::ConflictPolicy::BranchOnly => {
                        return Err(MessagingError::LeaseConflict(format!(
                            "Lease conflict for {} - branch-only policy",
                            lease.resource_selector
                        )));
                    }
                }
            }
        }

        // Insert or replace the lease
        sqlx::query(
            "INSERT OR REPLACE INTO leases (
                lease_id, tenant_id, holder_identity, resource_selector, purpose, scope,
                acquired_at, expires_at, trace_id, renew_token, conflict_policy
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&lease.lease_id)
        .bind(&lease.tenant_id)
        .bind(&lease.holder_identity)
        .bind(&lease.resource_selector)
        .bind(&lease.purpose)
        .bind(scope_str)
        .bind(lease.acquired_at as i64)
        .bind(lease.expires_at as i64)
        .bind(&lease.trace_id)
        .bind(lease.renew_token.as_ref())
        .bind(conflict_policy_str)
        .execute(&self.pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        Ok(lease)
    }

    async fn release_lease(
        &self,
        resource_selector: String,
        renew_token: String,
    ) -> Result<bool, MessagingError> {
        let result =
            sqlx::query("DELETE FROM leases WHERE resource_selector = ? AND renew_token = ?")
                .bind(&resource_selector)
                .bind(&renew_token)
                .execute(&self.pool)
                .await
                .map_err(MessagingError::Sqlx)?;

        Ok(result.rows_affected() > 0)
    }

    async fn renew_lease(
        &self,
        resource_selector: String,
        renew_token: String,
    ) -> Result<bool, MessagingError> {
        let new_expires_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| MessagingError::TimeError(e.to_string()))?
            .as_secs()
            + 3600; // Extend by 1 hour

        let result = sqlx::query(
            "UPDATE leases SET expires_at = ? WHERE resource_selector = ? AND renew_token = ?",
        )
        .bind(new_expires_at as i64)
        .bind(&resource_selector)
        .bind(&renew_token)
        .execute(&self.pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        Ok(result.rows_affected() > 0)
    }

    async fn check_lease(
        &self,
        resource_selector: String,
    ) -> Result<Option<LeaseEnvelope>, MessagingError> {
        let row = sqlx::query(
            "SELECT lease_id, tenant_id, holder_identity, resource_selector, purpose, scope,
                    acquired_at, expires_at, trace_id, renew_token, conflict_policy
             FROM leases
             WHERE resource_selector = ?",
        )
        .bind(&resource_selector)
        .fetch_optional(&self.pool)
        .await
        .map_err(MessagingError::Sqlx)?;

        if let Some(row) = row {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| MessagingError::TimeError(e.to_string()))?
                .as_secs() as i64;

            let expires_at: i64 = row.get("expires_at");
            if expires_at > now {
                let scope_str: String = row.get("scope");
                let scope = match scope_str.as_str() {
                    "Session" => crate::LeaseScope::Session,
                    "Workflow" => crate::LeaseScope::Workflow,
                    "Task" => crate::LeaseScope::Task,
                    _ => {
                        return Err(MessagingError::InvalidEnvelope(
                            "Invalid lease scope".to_string(),
                        ))
                    }
                };

                let conflict_policy_str: String = row.get("conflict_policy");
                let conflict_policy = match conflict_policy_str.as_str() {
                    "NotifyOnly" => crate::ConflictPolicy::NotifyOnly,
                    "Block" => crate::ConflictPolicy::Block,
                    "BranchOnly" => crate::ConflictPolicy::BranchOnly,
                    _ => {
                        return Err(MessagingError::InvalidEnvelope(
                            "Invalid conflict policy".to_string(),
                        ))
                    }
                };

                let lease = LeaseEnvelope {
                    lease_id: row.get("lease_id"),
                    tenant_id: row.get("tenant_id"),
                    holder_identity: row.get("holder_identity"),
                    resource_selector: row.get("resource_selector"),
                    purpose: row.get("purpose"),
                    scope,
                    acquired_at: row.get::<i64, _>("acquired_at") as u64,
                    expires_at: expires_at as u64,
                    trace_id: row.get("trace_id"),
                    renew_token: row.get("renew_token"),
                    conflict_policy,
                };

                Ok(Some(lease))
            } else {
                // Lease expired, remove it
                sqlx::query("DELETE FROM leases WHERE resource_selector = ?")
                    .bind(&resource_selector)
                    .execute(&self.pool)
                    .await
                    .map_err(MessagingError::Sqlx)?;

                Ok(None)
            }
        } else {
            Ok(None)
        }
    }
}

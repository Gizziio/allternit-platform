//! Task management service
//!
//! Provides CRUD operations for tasks, comments, assignments,
//! and task optimization (IntelliSchedule).

use crate::db::cowork_models::*;
use crate::error::ApiError;
use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

/// Create a new task
pub async fn create_task(
    pool: &SqlitePool,
    req: CreateTaskRequest,
    tenant_id: Option<String>,
    owner_id: Option<String>,
) -> Result<Task, ApiError> {
    let task_id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let status = req.status.unwrap_or_default();
    let priority = req.priority.unwrap_or(50);
    let dependencies = req.dependencies.map(sqlx::types::Json);

    let task = sqlx::query_as::<_, Task>(
        r#"
        INSERT INTO tasks (
            id, workspace_id, tenant_id, owner_id, title, description, status,
            priority, estimated_minutes, deadline, assignee_type, assignee_id,
            assignee_name, assignee_avatar, dependencies, optimize_rank, risk,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#
    )
    .bind(&task_id)
    .bind(&req.workspace_id)
    .bind(&tenant_id)
    .bind(&owner_id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(status)
    .bind(priority)
    .bind(req.estimated_minutes)
    .bind(req.deadline)
    .bind(req.assignee_type)
    .bind(&req.assignee_id)
    .bind(&req.assignee_name)
    .bind(&req.assignee_avatar)
    .bind(dependencies)
    .bind(None::<i32>) // optimize_rank
    .bind(req.risk)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(ApiError::DatabaseError)?;

    // Record task created event
    record_task_event(
        pool,
        &task_id,
        "created",
        Some(serde_json::json!({
            "title": req.title,
            "workspace_id": req.workspace_id,
            "priority": priority,
        })),
        None,
    )
    .await?;

    // If assigned to an agent, also enqueue it for the agent worker
    if let Some(AssigneeType::Agent) = req.assignee_type {
        let queue_id = Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO task_queue (id, task_id, status, max_retries, created_at)
            VALUES (?, ?, 'pending', 3, ?)
            "#
        )
        .bind(&queue_id)
        .bind(&task_id)
        .bind(now)
        .execute(pool)
        .await
        .map_err(ApiError::DatabaseError)?;
    }

    Ok(task)
}

/// List tasks for a workspace with tenant isolation and optional filters
pub async fn list_tasks(
    pool: &SqlitePool,
    filters: &TaskListFilter,
) -> Result<Vec<Task>, ApiError> {
    let tenant_id = filters.tenant_id.as_deref();
    let workspace_id = filters.workspace_id.as_deref().unwrap_or("");
    let mut query = String::from("SELECT * FROM tasks WHERE tenant_id = ? AND workspace_id = ?");
    let mut conditions: Vec<String> = Vec::new();

    if let Some(statuses) = &filters.status {
        if !statuses.is_empty() {
            let placeholders: Vec<String> = (0..statuses.len()).map(|_| "?".to_string()).collect();
            conditions.push(format!("status IN ({})", placeholders.join(", ")));
        }
    }

    if filters.assignee_id.is_some() {
        conditions.push("assignee_id = ?".to_string());
    }

    if filters.priority_min.is_some() {
        conditions.push("priority >= ?".to_string());
    }

    if filters.priority_max.is_some() {
        conditions.push("priority <= ?".to_string());
    }

    if !conditions.is_empty() {
        query.push_str(" AND ");
        query.push_str(&conditions.join(" AND "));
    }

    query.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");

    let mut sql_query = sqlx::query_as::<_, Task>(&query);

    // Bind tenant_id and workspace_id first (isolation enforcement)
    sql_query = sql_query.bind(tenant_id);
    sql_query = sql_query.bind(workspace_id);

    if let Some(statuses) = &filters.status {
        for status in statuses {
            sql_query = sql_query.bind(status);
        }
    }

    if let Some(assignee_id) = &filters.assignee_id {
        sql_query = sql_query.bind(assignee_id);
    }

    if let Some(priority_min) = filters.priority_min {
        sql_query = sql_query.bind(priority_min);
    }

    if let Some(priority_max) = filters.priority_max {
        sql_query = sql_query.bind(priority_max);
    }

    sql_query = sql_query.bind(filters.limit.unwrap_or(50));
    sql_query = sql_query.bind(filters.offset.unwrap_or(0));

    let tasks = sql_query
        .fetch_all(pool)
        .await
        .map_err(ApiError::DatabaseError)?;

    Ok(tasks)
}

/// Get a single task by ID with tenant isolation
pub async fn get_task(
    pool: &SqlitePool,
    id: &str,
    tenant_id: Option<&str>,
) -> Result<Task, ApiError> {
    let task = sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks WHERE id = ? AND tenant_id = ?"
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(pool)
    .await
    .map_err(ApiError::DatabaseError)?;

    task.ok_or_else(|| ApiError::NotFound(format!("Task not found: {}", id)))
}

/// Update a task with tenant isolation
pub async fn update_task(
    pool: &SqlitePool,
    id: &str,
    req: UpdateTaskRequest,
    tenant_id: Option<&str>,
) -> Result<Task, ApiError> {
    // Get existing task (enforces tenant isolation)
    let task = get_task(pool, id, tenant_id).await?;

    let title = req.title.unwrap_or_else(|| task.title.clone());
    let description = req.description.or(task.description.clone());
    let status = req.status.unwrap_or(task.status);
    let priority = req.priority.unwrap_or(task.priority);
    let estimated_minutes = req.estimated_minutes.or(task.estimated_minutes);
    let deadline = req.deadline.or(task.deadline);
    let assignee_type = req.assignee_type.or(task.assignee_type);
    let assignee_id = req.assignee_id.or(task.assignee_id.clone());
    let assignee_name = req.assignee_name.or(task.assignee_name.clone());
    let assignee_avatar = req.assignee_avatar.or(task.assignee_avatar.clone());
    let dependencies = req.dependencies.map(sqlx::types::Json).or(task.dependencies.clone());
    let risk = req.risk.or(task.risk);
    let now = Utc::now();

    let updated = sqlx::query_as::<_, Task>(
        r#"
        UPDATE tasks
        SET title = ?, description = ?, status = ?, priority = ?,
            estimated_minutes = ?, deadline = ?, assignee_type = ?, assignee_id = ?,
            assignee_name = ?, assignee_avatar = ?, dependencies = ?, risk = ?, updated_at = ?
        WHERE id = ? AND tenant_id = ?
        RETURNING *
        "#
    )
    .bind(&title)
    .bind(&description)
    .bind(status)
    .bind(priority)
    .bind(estimated_minutes)
    .bind(deadline)
    .bind(assignee_type)
    .bind(&assignee_id)
    .bind(&assignee_name)
    .bind(&assignee_avatar)
    .bind(dependencies)
    .bind(risk)
    .bind(now)
    .bind(id)
    .bind(tenant_id)
    .fetch_one(pool)
    .await
    .map_err(ApiError::DatabaseError)?;

    // Record task updated event
    record_task_event(
        pool,
        id,
        "updated",
        Some(serde_json::json!({
            "title": title,
            "status": status,
            "priority": priority,
        })),
        None,
    )
    .await?;

    Ok(updated)
}

/// Delete a task with tenant isolation
pub async fn delete_task(
    pool: &SqlitePool,
    id: &str,
    tenant_id: Option<&str>,
) -> Result<(), ApiError> {
    let result = sqlx::query(
        "DELETE FROM tasks WHERE id = ? AND tenant_id = ?"
    )
    .bind(id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .map_err(ApiError::DatabaseError)?;

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound(format!("Task not found: {}", id)));
    }

    Ok(())
}

/// Assign a task to a human or agent with tenant isolation
pub async fn assign_task(
    pool: &SqlitePool,
    task_id: &str,
    req: AssignTaskRequest,
    tenant_id: Option<&str>,
    assigned_by: Option<&str>,
) -> Result<Task, ApiError> {
    // Get existing task (enforces tenant isolation)
    let _task = get_task(pool, task_id, tenant_id).await?;

    let now = Utc::now();

    // Update task assignee
    let updated = sqlx::query_as::<_, Task>(
        r#"
        UPDATE tasks
        SET assignee_type = ?, assignee_id = ?, assignee_name = ?, assignee_avatar = ?, updated_at = ?
        WHERE id = ? AND tenant_id = ?
        RETURNING *
        "#
    )
    .bind(req.assignee_type)
    .bind(&req.assignee_id)
    .bind(&req.assignee_name)
    .bind(&req.assignee_avatar)
    .bind(now)
    .bind(task_id)
    .bind(tenant_id)
    .fetch_one(pool)
    .await
    .map_err(ApiError::DatabaseError)?;

    // Create assignment audit record
    let assignment_id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO task_assignments (
            id, task_id, assignee_type, assignee_id, assignee_name, assigned_by, assigned_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&assignment_id)
    .bind(task_id)
    .bind(req.assignee_type)
    .bind(&req.assignee_id)
    .bind(&req.assignee_name)
    .bind(assigned_by)
    .bind(now)
    .execute(pool)
    .await
    .map_err(ApiError::DatabaseError)?;

    // Record task assigned event
    record_task_event(
        pool,
        task_id,
        "assigned",
        Some(serde_json::json!({
            "assignee_type": req.assignee_type,
            "assignee_id": req.assignee_id,
            "assignee_name": req.assignee_name,
            "assigned_by": assigned_by,
        })),
        None,
    )
    .await?;

    Ok(updated)
}

/// List comments for a task with tenant isolation
pub async fn list_comments(
    pool: &SqlitePool,
    task_id: &str,
    tenant_id: Option<&str>,
) -> Result<Vec<TaskComment>, ApiError> {
    // Verify task exists and belongs to tenant
    let _ = get_task(pool, task_id, tenant_id).await?;

    let comments = sqlx::query_as::<_, TaskComment>(
        "SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC"
    )
    .bind(task_id)
    .fetch_all(pool)
    .await
    .map_err(ApiError::DatabaseError)?;

    Ok(comments)
}

/// Add a comment to a task with tenant isolation
pub async fn add_comment(
    pool: &SqlitePool,
    task_id: &str,
    req: CreateCommentRequest,
    tenant_id: Option<&str>,
) -> Result<TaskComment, ApiError> {
    // Verify task exists and belongs to tenant
    let _ = get_task(pool, task_id, tenant_id).await?;

    let comment_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    let comment = sqlx::query_as::<_, TaskComment>(
        r#"
        INSERT INTO task_comments (id, task_id, author, author_avatar, body, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING *
        "#
    )
    .bind(&comment_id)
    .bind(task_id)
    .bind(&req.author)
    .bind(&req.author_avatar)
    .bind(&req.body)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(ApiError::DatabaseError)?;

    // Record task commented event
    record_task_event(
        pool,
        task_id,
        "commented",
        Some(serde_json::json!({
            "comment_id": comment_id,
            "author": req.author,
        })),
        None,
    )
    .await?;

    Ok(comment)
}

/// Optimize task ordering for a workspace (IntelliSchedule)
/// Sorts by priority (desc), deadline (asc), created_at (asc)
/// and updates optimize_rank on each task.
pub async fn optimize_tasks(
    pool: &SqlitePool,
    workspace_id: &str,
    tenant_id: Option<&str>,
) -> Result<Vec<Task>, ApiError> {
    // Fetch all tasks for the workspace/tenant
    let filter = TaskListFilter {
        tenant_id: tenant_id.map(|s| s.to_string()),
        workspace_id: Some(workspace_id.to_string()),
        status: Some(vec![TaskStatus::Backlog, TaskStatus::Todo, TaskStatus::InProgress]),
        ..Default::default()
    };

    let mut tasks = list_tasks(pool, &filter).await?;

    // IntelliSchedule: sort by priority (higher first), then deadline (earlier first), then created_at
    tasks.sort_by(|a, b| {
        b.priority
            .cmp(&a.priority)
            .then_with(|| a.deadline.cmp(&b.deadline))
            .then_with(|| a.created_at.cmp(&b.created_at))
    });

    let now = Utc::now();

    // Update optimize_rank for each task
    for (rank, task) in tasks.iter_mut().enumerate() {
        let rank_i32 = rank as i32 + 1;
        if let Some(tid) = tenant_id {
            sqlx::query(
                "UPDATE tasks SET optimize_rank = ?, updated_at = ? WHERE id = ? AND tenant_id = ?"
            )
            .bind(rank_i32)
            .bind(now)
            .bind(&task.id)
            .bind(tid)
            .execute(pool)
            .await
            .map_err(ApiError::DatabaseError)?;
        } else {
            sqlx::query(
                "UPDATE tasks SET optimize_rank = ?, updated_at = ? WHERE id = ? AND tenant_id IS NULL"
            )
            .bind(rank_i32)
            .bind(now)
            .bind(&task.id)
            .execute(pool)
            .await
            .map_err(ApiError::DatabaseError)?;
        }

        task.optimize_rank = Some(rank_i32);
    }

    Ok(tasks)
}

// ============================================================================
// Helpers
// ============================================================================

/// Record an append-only task event
async fn record_task_event(
    pool: &SqlitePool,
    task_id: &str,
    event_type: &str,
    payload: Option<serde_json::Value>,
    source_client: Option<&str>,
) -> Result<(), ApiError> {
    sqlx::query(
        r#"
        INSERT INTO task_events (task_id, event_type, payload, source_client, created_at)
        VALUES (?, ?, ?, ?, ?)
        "#
    )
    .bind(task_id)
    .bind(event_type)
    .bind(payload.map(sqlx::types::Json))
    .bind(source_client)
    .bind(Utc::now())
    .execute(pool)
    .await
    .map_err(ApiError::DatabaseError)?;

    Ok(())
}

/// Claim the next pending queue item for an agent (free function)
pub async fn claim_queue_item(
    pool: &SqlitePool,
    agent_id: &str,
    agent_role: Option<&str>,
    workspace_id: Option<&str>,
) -> Result<Option<TaskQueueEntry>, ApiError> {
    let now = Utc::now();

    let entry = sqlx::query_as::<_, TaskQueueEntry>(
        r#"
        UPDATE task_queue
        SET status = 'claimed', agent_id = ?, agent_role = ?, claimed_at = ?
        WHERE id = (
            SELECT q.id FROM task_queue q
            JOIN tasks t ON q.task_id = t.id
            WHERE q.status = 'pending'
            AND (?1 IS NULL OR t.workspace_id = ?1)
            ORDER BY q.created_at ASC
            LIMIT 1
        )
        RETURNING *
        "#
    )
    .bind(agent_id)
    .bind(agent_role)
    .bind(now)
    .bind(workspace_id)
    .fetch_optional(pool)
    .await
    .map_err(ApiError::DatabaseError)?;

    Ok(entry)
}

/// Start a claimed queue item (transition claimed → running)
pub async fn start_queue_item(
    pool: &SqlitePool,
    queue_id: &str,
) -> Result<TaskQueueEntry, ApiError> {
    let entry = sqlx::query_as::<_, TaskQueueEntry>(
        r#"
        UPDATE task_queue
        SET status = 'running', started_at = ?
        WHERE id = ? AND status = 'claimed'
        RETURNING *
        "#
    )
    .bind(Utc::now())
    .bind(queue_id)
    .fetch_one(pool)
    .await
    .map_err(ApiError::DatabaseError)?;

    Ok(entry)
}

/// List queue items for a workspace with optional status filter
pub async fn list_queue_items(
    pool: &SqlitePool,
    workspace_id: Option<&str>,
    status: Option<&str>,
) -> Result<Vec<TaskQueueEntry>, ApiError> {
    let items = if let Some(ws) = workspace_id {
        if let Some(st) = status {
            sqlx::query_as::<_, TaskQueueEntry>(
                r#"
                SELECT q.* FROM task_queue q
                JOIN tasks t ON q.task_id = t.id
                WHERE t.workspace_id = ? AND q.status = ?
                ORDER BY q.created_at ASC
                "#
            )
            .bind(ws)
            .bind(st)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, TaskQueueEntry>(
                r#"
                SELECT q.* FROM task_queue q
                JOIN tasks t ON q.task_id = t.id
                WHERE t.workspace_id = ?
                ORDER BY q.created_at ASC
                "#
            )
            .bind(ws)
            .fetch_all(pool)
            .await
        }
    } else if let Some(st) = status {
        sqlx::query_as::<_, TaskQueueEntry>(
            "SELECT * FROM task_queue WHERE status = ? ORDER BY created_at ASC"
        )
        .bind(st)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, TaskQueueEntry>(
            "SELECT * FROM task_queue ORDER BY created_at ASC"
        )
        .fetch_all(pool)
        .await
    }
    .map_err(ApiError::DatabaseError)?;

    Ok(items)
}

/// Complete a queue item with result or error (free function)
/// If error is provided, status becomes 'failed'; otherwise 'completed'.
pub async fn complete_queue_item(
    pool: &SqlitePool,
    queue_id: &str,
    result: Option<String>,
    error: Option<String>,
) -> Result<TaskQueueEntry, ApiError> {
    let result_json: Option<serde_json::Value> = result.and_then(|r| serde_json::from_str(&r).ok());
    let status = if error.is_some() { "failed" } else { "completed" };

    let updated = sqlx::query_as::<_, TaskQueueEntry>(
        r#"
        UPDATE task_queue
        SET status = ?, completed_at = ?, result = ?, error = ?
        WHERE id = ?
        RETURNING *
        "#
    )
    .bind(status)
    .bind(Utc::now())
    .bind(result_json.map(sqlx::types::Json))
    .bind(&error)
    .bind(queue_id)
    .fetch_one(pool)
    .await
    .map_err(ApiError::DatabaseError)?;

    Ok(updated)
}

// ============================================================================
// TaskService
// ============================================================================

/// Task management service
///
/// Provides CRUD operations for tasks, comments, assignments,
/// and task optimization (IntelliSchedule).
pub struct TaskService {
    pub db: SqlitePool,
}

impl TaskService {
    /// Create a new task service
    pub fn new(db: SqlitePool) -> Self {
        Self { db }
    }

    /// Create a new task
    pub async fn create_task(
        &self,
        req: CreateTaskRequest,
        tenant_id: Option<String>,
        owner_id: Option<String>,
    ) -> Result<Task, ApiError> {
        create_task(&self.db, req, tenant_id, owner_id).await
    }

    /// List tasks for a workspace with tenant isolation and optional filters
    pub async fn list_tasks(&self, filter: TaskListFilter) -> Result<Vec<Task>, ApiError> {
        list_tasks(&self.db, &filter).await
    }

    /// Get a single task by ID with tenant isolation
    pub async fn get_task(
        &self,
        id: &str,
        tenant_id: Option<String>,
    ) -> Result<Option<Task>, ApiError> {
        let task = sqlx::query_as::<_, Task>(
            "SELECT * FROM tasks WHERE id = ? AND tenant_id = ?"
        )
        .bind(id)
        .bind(tenant_id)
        .fetch_optional(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;

        Ok(task)
    }

    /// Update a task with tenant isolation
    pub async fn update_task(
        &self,
        id: &str,
        req: UpdateTaskRequest,
        tenant_id: Option<String>,
    ) -> Result<Task, ApiError> {
        update_task(&self.db, id, req, tenant_id.as_deref()).await
    }

    /// Delete a task with tenant isolation
    pub async fn delete_task(&self, id: &str, tenant_id: Option<String>) -> Result<(), ApiError> {
        delete_task(&self.db, id, tenant_id.as_deref()).await
    }

    /// Assign a task to a human or agent with tenant isolation
    pub async fn assign_task(
        &self,
        id: &str,
        req: AssignTaskRequest,
        tenant_id: Option<String>,
        assigned_by: Option<String>,
    ) -> Result<Task, ApiError> {
        assign_task(&self.db, id, req, tenant_id.as_deref(), assigned_by.as_deref()).await
    }

    /// List comments for a task with tenant isolation
    pub async fn list_comments(
        &self,
        task_id: &str,
        tenant_id: Option<String>,
    ) -> Result<Vec<TaskComment>, ApiError> {
        list_comments(&self.db, task_id, tenant_id.as_deref()).await
    }

    /// Add a comment to a task with tenant isolation
    pub async fn add_comment(
        &self,
        task_id: &str,
        req: CreateCommentRequest,
        tenant_id: Option<String>,
    ) -> Result<TaskComment, ApiError> {
        add_comment(&self.db, task_id, req, tenant_id.as_deref()).await
    }

    /// List queue items for a workspace
    pub async fn list_queue_items(
        &self,
        workspace_id: Option<String>,
        status: Option<String>,
    ) -> Result<Vec<TaskQueueEntry>, ApiError> {
        list_queue_items(&self.db, workspace_id.as_deref(), status.as_deref()).await
    }

    /// Claim the next pending queue item for an agent
    pub async fn claim_queue_item(
        &self,
        agent_id: &str,
        agent_role: Option<String>,
        workspace_id: Option<String>,
    ) -> Result<Option<TaskQueueEntry>, ApiError> {
        claim_queue_item(&self.db, agent_id, agent_role.as_deref(), workspace_id.as_deref()).await
    }

    /// Start a claimed queue item (transition to running)
    pub async fn start_queue_item(
        &self,
        queue_id: &str,
    ) -> Result<TaskQueueEntry, ApiError> {
        start_queue_item(&self.db, queue_id).await
    }

    /// Complete a queue item with result or error
    pub async fn complete_queue_item(
        &self,
        queue_id: &str,
        result: Option<String>,
        error: Option<String>,
    ) -> Result<TaskQueueEntry, ApiError> {
        complete_queue_item(&self.db, queue_id, result, error).await
    }

    /// Emit an append-only task event
    pub async fn emit_event(
        &self,
        task_id: &str,
        event_type: &str,
        payload: Option<String>,
        source_client: Option<String>,
    ) -> Result<(), ApiError> {
        let payload_json: Option<serde_json::Value> = payload.and_then(|p| serde_json::from_str(&p).ok());

        sqlx::query(
            r#"
            INSERT INTO task_events (task_id, event_type, payload, source_client, created_at)
            VALUES (?, ?, ?, ?, ?)
            "#
        )
        .bind(task_id)
        .bind(event_type)
        .bind(payload_json.map(sqlx::types::Json))
        .bind(source_client)
        .bind(Utc::now())
        .execute(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;

        Ok(())
    }
}

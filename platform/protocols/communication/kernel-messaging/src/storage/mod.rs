use crate::{EventEnvelope, LeaseEnvelope, MailMessageEnvelope, MessagingError, TaskEnvelope};

// Storage trait that defines the interface for durable storage
#[async_trait::async_trait]
pub trait TaskQueueStorage: Send + Sync {
    async fn enqueue(&self, task: TaskEnvelope) -> Result<(), MessagingError>;
    async fn dequeue(&self) -> Result<Option<TaskEnvelope>, MessagingError>;
    async fn get_pending_count(&self) -> Result<usize, MessagingError>;
    async fn complete_task(
        &self,
        task_id: String,
        task: TaskEnvelope,
    ) -> Result<(), MessagingError>;
    async fn fail_task(
        &self,
        task_id: String,
        task: TaskEnvelope,
        error: String,
    ) -> Result<(), MessagingError>;
}

#[async_trait::async_trait]
pub trait EventBusStorage: Send + Sync {
    async fn publish(&self, event: EventEnvelope) -> Result<(), MessagingError>;
    async fn subscribe(&self, event_type: String) -> Result<Vec<EventEnvelope>, MessagingError>;
}

#[async_trait::async_trait]
pub trait AgentMailStorage: Send + Sync {
    async fn send_message(&self, message: MailMessageEnvelope) -> Result<(), MessagingError>;
    async fn get_inbox(
        &self,
        agent_identity: String,
    ) -> Result<Vec<MailMessageEnvelope>, MessagingError>;
    async fn get_outbox(
        &self,
        agent_identity: String,
    ) -> Result<Vec<MailMessageEnvelope>, MessagingError>;
    async fn get_thread(
        &self,
        thread_id: String,
    ) -> Result<Vec<MailMessageEnvelope>, MessagingError>;
}

#[async_trait::async_trait]
pub trait CoordinationLeasesStorage: Send + Sync {
    async fn acquire_lease(&self, lease: LeaseEnvelope) -> Result<LeaseEnvelope, MessagingError>;
    async fn release_lease(
        &self,
        resource_selector: String,
        renew_token: String,
    ) -> Result<bool, MessagingError>;
    async fn renew_lease(
        &self,
        resource_selector: String,
        renew_token: String,
    ) -> Result<bool, MessagingError>;
    async fn check_lease(
        &self,
        resource_selector: String,
    ) -> Result<Option<LeaseEnvelope>, MessagingError>;
}

pub mod sqlite;

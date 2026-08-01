pub mod agents;
pub mod mail;
pub mod projection;
pub mod types;

pub use agents::{AgentRecord, AgentRegistry};
pub use mail::{canonical_thread_id, ensure_thread_id, resolve_thread_id, Mail, MailOptions, DEFAULT_MAIL_THREAD};
pub use projection::rebuild_threads;
pub use types::{MailImportance, MailMessage, TypedMessage};

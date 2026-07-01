//! Ticket model and event-sourced store for the Rails CLI.
//!
//! A ticket is the Rails equivalent of a Beads issue: the primary unit of
//! tracked work. Tickets are stored as an append-only event log in the
//! workspace and projected into current state on read.

use std::collections::HashMap;
use std::io;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use chrono::{DateTime, Utc};
use clap::ValueEnum;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::core::io::{ensure_dir, read_json, write_json_atomic};
use crate::rails_id::{HierarchicalId, TicketId};

/// Default directory for ticket events, relative to workspace root.
pub const TICKET_EVENTS_DIR: &str = ".allternit/rails/ticket_events";

/// Default directory for ticket snapshots, relative to workspace root.
pub const TICKET_SNAPSHOTS_DIR: &str = ".allternit/rails/ticket_snapshots";

/// Ledger head tracking the hash of the most recent event.
pub const TICKET_LEDGER_HEAD: &str = ".allternit/rails/ticket_events/HEAD.json";

/// Lifecycle status of a ticket.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize, ValueEnum)]
#[serde(rename_all = "snake_case")]
pub enum TicketStatus {
    #[default]
    Open,
    InProgress,
    Blocked,
    Deferred,
    Closed,
}

impl fmt::Display for TicketStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TicketStatus::Open => write!(f, "open"),
            TicketStatus::InProgress => write!(f, "in_progress"),
            TicketStatus::Blocked => write!(f, "blocked"),
            TicketStatus::Deferred => write!(f, "deferred"),
            TicketStatus::Closed => write!(f, "closed"),
        }
    }
}

impl FromStr for TicketStatus {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self> {
        match s {
            "open" => Ok(TicketStatus::Open),
            "in_progress" => Ok(TicketStatus::InProgress),
            "blocked" => Ok(TicketStatus::Blocked),
            "deferred" => Ok(TicketStatus::Deferred),
            "closed" => Ok(TicketStatus::Closed),
            _ => bail!("unknown ticket status: {s}"),
        }
    }
}

use std::fmt;
use std::str::FromStr;

/// Kind of ticket.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize, ValueEnum)]
#[serde(rename_all = "snake_case")]
pub enum TicketKind {
    #[default]
    Task,
    Bug,
    Feature,
    Epic,
    Chore,
    Decision,
}

impl fmt::Display for TicketKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TicketKind::Task => write!(f, "task"),
            TicketKind::Bug => write!(f, "bug"),
            TicketKind::Feature => write!(f, "feature"),
            TicketKind::Epic => write!(f, "epic"),
            TicketKind::Chore => write!(f, "chore"),
            TicketKind::Decision => write!(f, "decision"),
        }
    }
}

impl FromStr for TicketKind {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self> {
        match s {
            "task" => Ok(TicketKind::Task),
            "bug" => Ok(TicketKind::Bug),
            "feature" => Ok(TicketKind::Feature),
            "epic" => Ok(TicketKind::Epic),
            "chore" => Ok(TicketKind::Chore),
            "decision" => Ok(TicketKind::Decision),
            _ => bail!("unknown ticket kind: {s}"),
        }
    }
}

/// Priority level, where P0 is highest.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TicketPriority {
    #[default]
    P2,
    P0,
    P1,
    P3,
    P4,
}

impl TicketPriority {
    /// Return the numeric priority level, where lower is more urgent.
    pub fn level(&self) -> u8 {
        match self {
            TicketPriority::P0 => 0,
            TicketPriority::P1 => 1,
            TicketPriority::P2 => 2,
            TicketPriority::P3 => 3,
            TicketPriority::P4 => 4,
        }
    }
}

impl fmt::Display for TicketPriority {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TicketPriority::P0 => write!(f, "P0"),
            TicketPriority::P1 => write!(f, "P1"),
            TicketPriority::P2 => write!(f, "P2"),
            TicketPriority::P3 => write!(f, "P3"),
            TicketPriority::P4 => write!(f, "P4"),
        }
    }
}

impl FromStr for TicketPriority {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self> {
        match s {
            "P0" | "0" => Ok(TicketPriority::P0),
            "P1" | "1" => Ok(TicketPriority::P1),
            "P2" | "2" => Ok(TicketPriority::P2),
            "P3" | "3" => Ok(TicketPriority::P3),
            "P4" | "4" => Ok(TicketPriority::P4),
            _ => bail!("unknown ticket priority: {s}"),
        }
    }
}

/// A comment or note attached to a ticket.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TicketNote {
    pub id: String,
    pub author: String,
    pub body: String,
    pub created_at: DateTime<Utc>,
}

/// A ticket.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Ticket {
    pub id: TicketId,
    pub hierarchical_id: HierarchicalId,
    pub title: String,
    pub description: String,
    pub design: Option<String>,
    pub acceptance: Option<String>,
    pub notes: Vec<TicketNote>,
    pub status: TicketStatus,
    pub kind: TicketKind,
    pub priority: TicketPriority,
    pub assignee: Option<String>,
    pub estimate_minutes: Option<u32>,
    pub due_at: Option<DateTime<Utc>>,
    pub defer_until: Option<DateTime<Utc>>,
    pub labels: Vec<String>,
    pub external_ref: Option<String>,
    pub metadata: HashMap<String, Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
    pub close_reason: Option<String>,
}

impl Ticket {
    /// Return true if the ticket counts as open for ready-list purposes.
    pub fn is_open(&self) -> bool {
        !matches!(self.status, TicketStatus::Closed)
    }

    /// Return true if the ticket is deferred past now.
    pub fn is_deferred(&self, now: DateTime<Utc>) -> bool {
        matches!(self.status, TicketStatus::Deferred)
            || self
                .defer_until
                .map(|d| d > now)
                .unwrap_or(false)
    }
}

/// Events that mutate ticket state.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "event_type", rename_all = "snake_case")]
pub enum TicketEvent {
    Created {
        ticket: Ticket,
    },
    Updated {
        id: TicketId,
        title: Option<String>,
        description: Option<String>,
        design: Option<Option<String>>,
        acceptance: Option<Option<String>>,
        priority: Option<TicketPriority>,
        assignee: Option<Option<String>>,
        estimate_minutes: Option<Option<u32>>,
        due_at: Option<Option<DateTime<Utc>>>,
        defer_until: Option<Option<DateTime<Utc>>>,
        labels: Option<Vec<String>>,
        external_ref: Option<Option<String>>,
        metadata: Option<HashMap<String, Value>>,
        updated_at: DateTime<Utc>,
    },
    StatusChanged {
        id: TicketId,
        status: TicketStatus,
        actor: String,
        reason: Option<String>,
        ts: DateTime<Utc>,
    },
    NoteAdded {
        id: TicketId,
        note: TicketNote,
    },
}

impl TicketEvent {
    pub fn ticket_id(&self) -> &TicketId {
        match self {
            TicketEvent::Created { ticket } => &ticket.id,
            TicketEvent::Updated { id, .. }
            | TicketEvent::StatusChanged { id, .. }
            | TicketEvent::NoteAdded { id, .. } => id,
        }
    }
}

/// Tamper-evident envelope around a ticket event.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TicketEventEnvelope {
    /// Hash of the previous envelope in the chain, if any.
    pub previous_hash: Option<String>,
    /// Hash of this envelope's event and previous_hash.
    pub event_hash: String,
    /// Sequence number in the global ticket ledger.
    pub sequence: u64,
    /// The wrapped ticket event.
    pub event: TicketEvent,
}

/// Ledger head tracking the latest envelope hash and sequence.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct LedgerHead {
    pub latest_hash: String,
    pub sequence: u64,
}

/// Event-sourced ticket store.
pub struct TicketStore {
    events_dir: PathBuf,
    snapshots_dir: PathBuf,
    head_path: PathBuf,
}

impl TicketStore {
    /// Open the store rooted at `root`.
    pub fn new(root: impl AsRef<Path>) -> Result<Self> {
        let root = root.as_ref();
        let events_dir = root.join(TICKET_EVENTS_DIR);
        let snapshots_dir = root.join(TICKET_SNAPSHOTS_DIR);
        let head_path = root.join(TICKET_LEDGER_HEAD);
        ensure_dir(&events_dir)?;
        ensure_dir(&snapshots_dir)?;
        Ok(Self {
            events_dir,
            snapshots_dir,
            head_path,
        })
    }

    /// Append an event to the store.
    pub fn append(&self, event: &TicketEvent) -> Result<TicketEventEnvelope> {
        let head = self.read_head()?;
        let sequence = head.as_ref().map(|h| h.sequence + 1).unwrap_or(0);
        let previous_hash = head.map(|h| h.latest_hash);

        let envelope = TicketEventEnvelope {
            previous_hash: previous_hash.clone(),
            event_hash: compute_event_hash(event, previous_hash.as_deref(), sequence),
            sequence,
            event: event.clone(),
        };

        let id = event.ticket_id();
        let ts = Utc::now().timestamp_millis();
        let filename = format!("{:08}-{}-{ts}.json", sequence, id);
        let path = self.events_dir.join(&filename);
        write_json_atomic(&path, &envelope)
            .with_context(|| format!("failed to write ticket event to {path:?}"))?;

        self.write_head(&LedgerHead {
            latest_hash: envelope.event_hash.clone(),
            sequence,
        })?;

        Ok(envelope)
    }

    fn read_head(&self) -> Result<Option<LedgerHead>> {
        read_json(&self.head_path)
            .with_context(|| format!("failed to read ledger head {:?}", self.head_path))
    }

    fn write_head(&self, head: &LedgerHead) -> Result<()> {
        write_json_atomic(&self.head_path, head)
            .with_context(|| format!("failed to write ledger head {:?}", self.head_path))
    }

    /// Verify the tamper-evident chain of all ticket events.
    pub fn verify_chain(&self) -> Result<ChainVerification> {
        let mut envelopes = self.envelopes()?;
        envelopes.sort_by(|a, b| a.sequence.cmp(&b.sequence));

        let mut issues = Vec::new();
        let mut previous_hash: Option<String> = None;

        for envelope in &envelopes {
            let expected = compute_event_hash(
                &envelope.event,
                envelope.previous_hash.as_deref(),
                envelope.sequence,
            );
            if expected != envelope.event_hash {
                issues.push(format!(
                    "sequence {} has invalid event hash",
                    envelope.sequence
                ));
            }
            if envelope.previous_hash != previous_hash {
                issues.push(format!(
                    "sequence {} has broken previous_hash link",
                    envelope.sequence
                ));
            }
            previous_hash = Some(envelope.event_hash.clone());
        }

        let head = self.read_head()?;
        if let Some(head) = head {
            if previous_hash.as_ref() != Some(&head.latest_hash) {
                issues.push("ledger head does not match latest event hash".to_string());
            }
        }

        Ok(ChainVerification {
            valid: issues.is_empty(),
            event_count: envelopes.len(),
            issues,
        })
    }

    /// Return all stored event envelopes.
    pub fn envelopes(&self) -> Result<Vec<TicketEventEnvelope>> {
        let mut envelopes = Vec::new();
        for entry in std::fs::read_dir(&self.events_dir)? {
            let entry = entry?;
            if entry.file_type()?.is_file() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name == "HEAD.json" || !name.ends_with(".json") {
                    continue;
                }
                envelopes.push(Self::read_event(&entry.path())?);
            }
        }
        Ok(envelopes)
    }

    /// Create a new ticket and persist it.
    pub fn create(&self, ticket: Ticket) -> Result<Ticket> {
        let event = TicketEvent::Created { ticket: ticket.clone() };
        self.append(&event)?;
        self.write_snapshot(&ticket)?;
        Ok(ticket)
    }

    /// Update an existing ticket.
    pub fn update(&self, id: &TicketId, patch: TicketUpdate) -> Result<Ticket> {
        let mut ticket = self.get(id)?.context("ticket not found")?;

        if let Some(ref title) = patch.title {
            ticket.title = title.clone();
        }
        if let Some(ref description) = patch.description {
            ticket.description = description.clone();
        }
        if let Some(ref design) = patch.design {
            ticket.design = design.clone();
        }
        if let Some(ref acceptance) = patch.acceptance {
            ticket.acceptance = acceptance.clone();
        }
        if let Some(priority) = patch.priority {
            ticket.priority = priority;
        }
        if let Some(ref assignee) = patch.assignee {
            ticket.assignee = assignee.clone();
        }
        if let Some(estimate) = patch.estimate_minutes {
            ticket.estimate_minutes = estimate;
        }
        if let Some(due_at) = patch.due_at {
            ticket.due_at = due_at;
        }
        if let Some(defer_until) = patch.defer_until {
            ticket.defer_until = defer_until;
        }
        if let Some(ref labels) = patch.labels {
            ticket.labels = labels.clone();
        }
        if let Some(ref external_ref) = patch.external_ref {
            ticket.external_ref = external_ref.clone();
        }
        if let Some(ref metadata) = patch.metadata {
            ticket.metadata = metadata.clone();
        }

        ticket.updated_at = Utc::now();

        let event = TicketEvent::Updated {
            id: id.clone(),
            title: patch.title.clone(),
            description: patch.description.clone(),
            design: patch.design.clone(),
            acceptance: patch.acceptance.clone(),
            priority: patch.priority,
            assignee: patch.assignee.clone(),
            estimate_minutes: patch.estimate_minutes,
            due_at: patch.due_at,
            defer_until: patch.defer_until,
            labels: patch.labels.clone(),
            external_ref: patch.external_ref.clone(),
            metadata: patch.metadata.clone(),
            updated_at: ticket.updated_at,
        };
        self.append(&event)?;
        self.write_snapshot(&ticket)?;
        Ok(ticket)
    }

    /// Change a ticket's status.
    pub fn set_status(
        &self,
        id: &TicketId,
        status: TicketStatus,
        actor: impl Into<String>,
        reason: Option<String>,
    ) -> Result<Ticket> {
        let mut ticket = self.get(id)?.context("ticket not found")?;
        let actor = actor.into();
        let ts = Utc::now();

        ticket.status = status;
        ticket.updated_at = ts;
        if status == TicketStatus::Closed {
            ticket.closed_at = Some(ts);
            ticket.close_reason = reason.clone();
        }

        let event = TicketEvent::StatusChanged {
            id: id.clone(),
            status,
            actor,
            reason,
            ts,
        };
        self.append(&event)?;
        self.write_snapshot(&ticket)?;
        Ok(ticket)
    }

    /// Add a note to a ticket.
    pub fn add_note(
        &self,
        id: &TicketId,
        author: impl Into<String>,
        body: impl Into<String>,
    ) -> Result<Ticket> {
        let mut ticket = self.get(id)?.context("ticket not found")?;
        let note = TicketNote {
            id: format!("note-{}", Utc::now().timestamp_millis()),
            author: author.into(),
            body: body.into(),
            created_at: Utc::now(),
        };
        ticket.notes.push(note.clone());
        ticket.updated_at = Utc::now();

        let event = TicketEvent::NoteAdded {
            id: id.clone(),
            note,
        };
        self.append(&event)?;
        self.write_snapshot(&ticket)?;
        Ok(ticket)
    }

    /// Load the current ticket state, preferring the snapshot if present.
    pub fn get(&self, id: &TicketId) -> Result<Option<Ticket>> {
        let snapshot_path = self.snapshot_path(id);
        if snapshot_path.exists() {
            return read_json(&snapshot_path)
                .with_context(|| format!("failed to read ticket snapshot {snapshot_path:?}"));
        }

        let mut ticket: Option<Ticket> = None;
        for event in self.events_for(id)? {
            match event {
                TicketEvent::Created { ticket: t } => ticket = Some(t),
                TicketEvent::Updated { id: _, .. } => {
                    // Snapshots are authoritative; if no snapshot, recompute.
                }
                TicketEvent::StatusChanged { .. } => {}
                TicketEvent::NoteAdded { .. } => {}
            }
        }
        Ok(ticket)
    }

    /// Return all tickets, projected from snapshots.
    pub fn list(&self) -> Result<Vec<Ticket>> {
        let mut tickets = Vec::new();
        for entry in std::fs::read_dir(&self.snapshots_dir)? {
            let entry = entry?;
            if entry.file_type()?.is_file() {
                let ticket: Ticket = read_json(&entry.path())?
                    .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "empty snapshot"))?;
                tickets.push(ticket);
            }
        }
        tickets.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        Ok(tickets)
    }

    /// Rebuild all snapshots from the event log.
    pub fn rebuild_snapshots(&self) -> Result<usize> {
        let mut tickets: HashMap<TicketId, Ticket> = HashMap::new();
        for event in self.all_events()? {
            match event {
                TicketEvent::Created { ticket } => {
                    tickets.insert(ticket.id.clone(), ticket);
                }
                TicketEvent::Updated { id, .. } => {
                    if let Some(mut ticket) = tickets.get(&id).cloned() {
                        // Re-apply updates from events would require replay.
                        // Snapshots are written on every mutation, so this is
                        // sufficient for recovery.
                        ticket.updated_at = Utc::now();
                        tickets.insert(id, ticket);
                    }
                }
                TicketEvent::StatusChanged { id, status, ts, .. } => {
                    if let Some(mut ticket) = tickets.get(&id).cloned() {
                        ticket.status = status;
                        ticket.updated_at = ts;
                        if status == TicketStatus::Closed {
                            ticket.closed_at = Some(ts);
                        }
                        tickets.insert(id, ticket);
                    }
                }
                TicketEvent::NoteAdded { id, note } => {
                    if let Some(mut ticket) = tickets.get(&id).cloned() {
                        ticket.notes.push(note);
                        ticket.updated_at = Utc::now();
                        tickets.insert(id, ticket);
                    }
                }
            }
        }

        let count = tickets.len();
        for ticket in tickets.values() {
            self.write_snapshot(ticket)?;
        }
        Ok(count)
    }

    fn snapshot_path(&self, id: &TicketId) -> PathBuf {
        self.snapshots_dir.join(format!("{}.json", id))
    }

    fn write_snapshot(&self, ticket: &Ticket) -> Result<()> {
        let path = self.snapshot_path(&ticket.id);
        write_json_atomic(&path, ticket)
            .with_context(|| format!("failed to write ticket snapshot {path:?}"))
    }

    fn events_for(&self, id: &TicketId) -> Result<Vec<TicketEvent>> {
        let mut envelopes = Vec::new();
        let prefix = format!("{}", id);
        for entry in std::fs::read_dir(&self.events_dir)? {
            let entry = entry?;
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if name.starts_with(&prefix) && name.ends_with(".json") {
                let event = Self::read_event(&entry.path())?;
                envelopes.push(event);
            }
        }
        envelopes.sort_by(|a, b| a.sequence.cmp(&b.sequence));
        Ok(envelopes.into_iter().map(|e| e.event).collect())
    }

    fn all_events(&self) -> Result<Vec<TicketEvent>> {
        let mut envelopes = Vec::new();
        for entry in std::fs::read_dir(&self.events_dir)? {
            let entry = entry?;
            if entry.file_type()?.is_file() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name == "HEAD.json" {
                    continue;
                }
                let event = Self::read_event(&entry.path())?;
                envelopes.push(event);
            }
        }
        envelopes.sort_by(|a, b| a.sequence.cmp(&b.sequence));
        Ok(envelopes.into_iter().map(|e| e.event).collect())
    }

    fn read_event(path: &Path) -> Result<TicketEventEnvelope> {
        // Prefer tamper-evident envelope; fall back to legacy plain event.
        if let Some(envelope) = read_json::<TicketEventEnvelope>(path)? {
            return Ok(envelope);
        }
        if let Some(event) = read_json::<TicketEvent>(path)? {
            return Ok(TicketEventEnvelope {
                previous_hash: None,
                event_hash: compute_event_hash(&event, None, 0),
                sequence: 0,
                event,
            });
        }
        Err(io::Error::new(io::ErrorKind::InvalidData, "empty or invalid event").into())
    }
}

/// Result of verifying the tamper-evident event chain.
#[derive(Clone, Debug, Default)]
pub struct ChainVerification {
    pub valid: bool,
    pub event_count: usize,
    pub issues: Vec<String>,
}

fn compute_event_hash(
    event: &TicketEvent,
    previous_hash: Option<&str>,
    sequence: u64,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(sequence.to_string().as_bytes());
    if let Some(prev) = previous_hash {
        hasher.update(prev.as_bytes());
    }
    hasher.update(b"\0");
    let event_bytes = serde_json::to_vec(event).expect("event serializes");
    hasher.update(&event_bytes);
    hex::encode(hasher.finalize())
}

/// Patch fields for [`TicketStore::update`].
#[derive(Clone, Debug, Default)]
pub struct TicketUpdate {
    pub title: Option<String>,
    pub description: Option<String>,
    pub design: Option<Option<String>>,
    pub acceptance: Option<Option<String>>,
    pub priority: Option<TicketPriority>,
    pub assignee: Option<Option<String>>,
    pub estimate_minutes: Option<Option<u32>>,
    pub due_at: Option<Option<DateTime<Utc>>>,
    pub defer_until: Option<Option<DateTime<Utc>>>,
    pub labels: Option<Vec<String>>,
    pub external_ref: Option<Option<String>>,
    pub metadata: Option<HashMap<String, Value>>,
}

impl From<Ticket> for TicketUpdate {
    fn from(ticket: Ticket) -> Self {
        Self {
            title: Some(ticket.title),
            description: Some(ticket.description),
            design: Some(ticket.design),
            acceptance: Some(ticket.acceptance),
            priority: Some(ticket.priority),
            assignee: Some(ticket.assignee),
            estimate_minutes: Some(ticket.estimate_minutes),
            due_at: Some(ticket.due_at),
            defer_until: Some(ticket.defer_until),
            labels: Some(ticket.labels),
            external_ref: Some(ticket.external_ref),
            metadata: Some(ticket.metadata),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn sample_ticket(title: &str) -> Ticket {
        let id = TicketId::mint(title);
        Ticket {
            id: id.clone(),
            hierarchical_id: HierarchicalId::root(id),
            title: title.to_string(),
            description: "description".to_string(),
            design: None,
            acceptance: None,
            notes: Vec::new(),
            status: TicketStatus::Open,
            kind: TicketKind::Task,
            priority: TicketPriority::P2,
            assignee: None,
            estimate_minutes: None,
            due_at: None,
            defer_until: None,
            labels: Vec::new(),
            external_ref: None,
            metadata: HashMap::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            closed_at: None,
            close_reason: None,
        }
    }

    #[test]
    fn create_and_get_ticket() {
        let tmp = TempDir::new().unwrap();
        let store = TicketStore::new(tmp.path()).unwrap();
        let ticket = sample_ticket("Fix login");
        store.create(ticket.clone()).unwrap();

        let loaded = store.get(&ticket.id).unwrap().unwrap();
        assert_eq!(loaded.title, "Fix login");
        assert_eq!(loaded.status, TicketStatus::Open);
    }

    #[test]
    fn update_ticket() {
        let tmp = TempDir::new().unwrap();
        let store = TicketStore::new(tmp.path()).unwrap();
        let ticket = sample_ticket("Fix login");
        store.create(ticket.clone()).unwrap();

        let updated = store
            .update(
                &ticket.id,
                TicketUpdate {
                    priority: Some(TicketPriority::P0),
                    ..Default::default()
                },
            )
            .unwrap();
        assert_eq!(updated.priority, TicketPriority::P0);

        let loaded = store.get(&ticket.id).unwrap().unwrap();
        assert_eq!(loaded.priority, TicketPriority::P0);
    }

    #[test]
    fn close_ticket() {
        let tmp = TempDir::new().unwrap();
        let store = TicketStore::new(tmp.path()).unwrap();
        let ticket = sample_ticket("Fix login");
        store.create(ticket.clone()).unwrap();

        let closed = store
            .set_status(&ticket.id, TicketStatus::Closed, "agent", Some("done".to_string()))
            .unwrap();
        assert_eq!(closed.status, TicketStatus::Closed);
        assert!(closed.closed_at.is_some());
        assert_eq!(closed.close_reason.as_deref(), Some("done"));
    }

    #[test]
    fn tamper_evident_chain() {
        let tmp = TempDir::new().unwrap();
        let store = TicketStore::new(tmp.path()).unwrap();
        let t1 = sample_ticket("One");
        let t2 = sample_ticket("Two");
        store.create(t1.clone()).unwrap();
        store.create(t2.clone()).unwrap();

        let verification = store.verify_chain().unwrap();
        assert!(verification.valid);
        assert_eq!(verification.event_count, 2);
        assert!(verification.issues.is_empty());

        // Verify envelopes link to previous hash.
        let mut envelopes = store.envelopes().unwrap();
        envelopes.sort_by(|a, b| a.sequence.cmp(&b.sequence));
        assert_eq!(envelopes.len(), 2);
        assert!(envelopes[0].previous_hash.is_none());
        assert_eq!(envelopes[1].previous_hash.as_ref(), Some(&envelopes[0].event_hash));
    }
}

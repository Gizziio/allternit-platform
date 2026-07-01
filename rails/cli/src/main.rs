//! `rails` — the Rails CLI port of Beads capabilities.
//!
//! This binary provides the ticket/DAG workflow surface for Allternit:
//! ticket management, typed dependencies, ready-list derivation, and
//! health checks. It is intentionally separate from the broader
//! `allternit-rails` admin/service CLI.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::str::FromStr;

use anyhow::{bail, Context, Result};
use chrono::Utc;
use clap::{Parser, Subcommand, ValueEnum};

use allternit_agent_system_rails::batch::{BatchExecutor, BatchOp, BatchOpResult};
use allternit_agent_system_rails::compact::Compactor;
use allternit_agent_system_rails::dependencies::{DependencyEdge, DependencyGraph, DependencyKind};
use allternit_agent_system_rails::echoes::{EchoKind, EchoStore, DEFAULT_ECHO_TTL_SECONDS};
use allternit_agent_system_rails::memory::{MemoryStore, MemoryUpdate};
use allternit_agent_system_rails::rails_id::{HierarchicalId, TicketId};
use allternit_agent_system_rails::query::{Query, QueryEngine, QueryEntity, QueryResultItem};
use allternit_agent_system_rails::setup::{AgentTarget, SetupRecipe};
use allternit_agent_system_rails::sync::{build_provider, SyncDirection, SyncStore};
use allternit_agent_system_rails::templates::{TemplateStep, TemplateStore};
use allternit_agent_system_rails::killswitch::{KillSwitch, SloMetrics};
use allternit_agent_system_rails::ledger::{Ledger, LedgerOptions};
use allternit_agent_system_rails::mcp::McpServer;
use allternit_agent_system_rails::merge_locks::{MergeLockStore, DEFAULT_LOCK_TTL_SECONDS};
use allternit_agent_system_rails::policy::inject_policy;
use allternit_agent_system_rails::wait_gates::{GateOutcome, WaitGateKind, WaitGateStore};
use allternit_agent_system_rails::tickets::{
    Ticket, TicketKind, TicketPriority, TicketStatus, TicketStore, TicketUpdate,
};
#[cfg(feature = "dolt")]
use allternit_agent_system_rails::dolt::{DoltConfig, DoltStorage};

/// Default directory for Rails CLI state, relative to workspace root.
const RAILS_DIR: &str = ".allternit/rails";

#[derive(Parser)]
#[command(name = "rails")]
#[command(about = "Allternit Rails — ticket and DAG workflow CLI", long_about = None)]
struct Cli {
    /// Workspace root directory.
    #[arg(short, long, default_value = ".")]
    root: PathBuf,

    /// Output JSON instead of human-readable text.
    #[arg(long, global = true)]
    json: bool,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize a workspace for Rails.
    Init,

    /// Create, list, show, and manage tickets.
    #[command(subcommand)]
    Ticket(TicketCmd),

    /// Manage dependencies between tickets.
    #[command(subcommand)]
    Dag(DagCmd),

    /// Show tickets that are ready to be worked on.
    Ready {
        /// Explain why each ticket is or is not ready.
        #[arg(long)]
        explain: bool,
    },

    /// Run health checks on the Rails workspace.
    Doctor,

    /// Learn, recall, and forget persistent project memories.
    #[command(subcommand)]
    Memory(MemoryCmd),

    /// Create and manage ephemeral echoes.
    #[command(subcommand)]
    Echo(EchoCmd),

    /// Create and instantiate workflow templates.
    #[command(subcommand)]
    Template(TemplateCmd),

    /// Execute atomic batch operations.
    #[command(subcommand)]
    Batch(BatchCmd),

    /// Add and resolve wait-gates on tickets.
    #[command(subcommand)]
    Gate(GateCmd),

    /// Acquire and release merge locks.
    #[command(subcommand)]
    Lock(LockCmd),

    /// Configure agent/editor integrations.
    Setup {
        /// Agent/editor target.
        target: AgentTarget,
    },

    /// Query tickets, memories, echoes, gates, and locks.
    Query {
        /// Entity to query.
        #[arg(short, long, value_enum, default_value = "tickets")]
        entity: QueryEntity,

        /// Query expression.
        query: Vec<String>,
    },

    /// Sync with an external tracker.
    Sync {
        /// Provider name: linear, github, jira, ado, gitlab, notion.
        provider: String,

        /// Sync direction or status.
        #[arg(value_enum, default_value = "pull")]
        direction: SyncDirection,

        /// Configure the provider (interactive if no token given).
        #[arg(short, long)]
        configure: bool,

        /// API token for configuration.
        #[arg(long)]
        token: Option<String>,
    },

    /// Inject policy bundles into the ledger.
    Policy {
        /// Who is injecting the policy.
        #[arg(short, long, default_value = "cli")]
        injected_by: String,
    },

    /// Start the MCP server over stdin/stdout.
    Mcp,

    /// Compact and prune Rails storage.
    #[command(subcommand)]
    Compact(CompactCmd),

    /// Enable or disable the kill switch.
    #[command(subcommand)]
    Kill(KillCmd),

    /// Manage the optional Dolt storage backend.
    #[cfg(feature = "dolt")]
    #[command(subcommand)]
    Dolt(DoltCmd),

    /// Show SLO metrics.
    Slo {
        /// Window in minutes.
        #[arg(short, long, default_value_t = 60)]
        window: i64,
    },
}

#[cfg(feature = "dolt")]
#[derive(Subcommand)]
enum DoltCmd {
    /// Initialize the Dolt schema.
    Init {
        /// Dolt database URL (mysql://user:pass@host:port/db).
        #[arg(short, long)]
        url: Option<String>,
    },
    /// Push local tickets into Dolt.
    Push {
        /// Dolt database URL.
        #[arg(short, long)]
        url: Option<String>,
    },
    /// Pull tickets from Dolt into the local store.
    Pull {
        /// Dolt database URL.
        #[arg(short, long)]
        url: Option<String>,
    },
    /// Show the ticket count on both sides.
    Status {
        /// Dolt database URL.
        #[arg(short, long)]
        url: Option<String>,
    },
}

#[derive(Subcommand)]
enum TicketCmd {
    /// Create a new ticket.
    New {
        /// Ticket title.
        title: String,

        /// Ticket description.
        #[arg(short, long)]
        description: Option<String>,

        /// Ticket kind.
        #[arg(short, long, value_enum, default_value = "task")]
        kind: CliTicketKind,

        /// Priority (P0-P4).
        #[arg(short, long, default_value = "P2")]
        priority: TicketPriority,

        /// Assignee.
        #[arg(short, long)]
        assignee: Option<String>,

        /// Labels (comma-separated).
        #[arg(short, long, value_delimiter = ',')]
        labels: Vec<String>,

        /// External reference.
        #[arg(long)]
        external_ref: Option<String>,

        /// Estimate in minutes.
        #[arg(long)]
        estimate: Option<u32>,
    },

    /// Show a ticket.
    Show {
        /// Ticket ID.
        id: String,
    },

    /// List tickets.
    List {
        /// Filter by status.
        #[arg(short, long)]
        status: Option<TicketStatus>,

        /// Filter by kind.
        #[arg(short, long)]
        kind: Option<TicketKind>,

        /// Filter by label.
        #[arg(short, long)]
        label: Option<String>,

        /// Include closed tickets.
        #[arg(long)]
        all: bool,
    },

    /// Update a ticket.
    Update {
        /// Ticket ID.
        id: String,

        #[command(flatten)]
        patch: TicketPatch,
    },

    /// Close a ticket.
    Close {
        /// Ticket ID.
        id: String,

        /// Reason for closing.
        #[arg(short, long)]
        reason: Option<String>,
    },

    /// Add a note to a ticket.
    Note {
        /// Ticket ID.
        id: String,

        /// Note text.
        text: String,

        /// Note author.
        #[arg(short, long, default_value = "cli")]
        author: String,
    },
}

#[derive(Subcommand)]
enum DagCmd {
    /// Add a dependency between two tickets.
    Block {
        /// Ticket that is blocked.
        ticket: String,
        /// Ticket that blocks it.
        blocker: String,
    },

    /// Add a non-blocking relation between two tickets.
    Relate {
        /// First ticket.
        a: String,
        /// Second ticket.
        b: String,
    },

    /// Show the dependency tree for a ticket.
    Tree {
        /// Root ticket ID.
        id: String,
    },

    /// Verify the dependency graph is acyclic.
    Verify,
}

#[derive(Subcommand)]
enum EchoCmd {
    /// Create a new echo.
    New {
        /// Echo content.
        content: String,

        /// Echo kind.
        #[arg(short, long, default_value = "heartbeat")]
        kind: EchoKind,

        /// TTL in seconds.
        #[arg(short, long, default_value_t = DEFAULT_ECHO_TTL_SECONDS)]
        ttl: i64,
    },

    /// List echoes.
    List {
        /// Include expired echoes.
        #[arg(long)]
        expired: bool,
    },

    /// Garbage collect expired echoes.
    Gc,
}

#[derive(Subcommand)]
enum LockCmd {
    /// Acquire a merge lock on a domain.
    Acquire {
        /// Conflict domain, e.g. branch:main.
        domain: String,

        /// Owner of the lock.
        #[arg(short, long, default_value = "cli")]
        owner: String,

        /// Lock TTL in seconds.
        #[arg(short, long, default_value_t = DEFAULT_LOCK_TTL_SECONDS)]
        ttl: i64,
    },

    /// Release a lock.
    Release {
        /// Lock ID.
        id: String,
    },

    /// List locks.
    List {
        /// Only show active locks.
        #[arg(long)]
        active: bool,
    },

    /// Show active lock for a domain.
    Status {
        /// Conflict domain.
        domain: String,
    },

    /// Clean up expired/released locks.
    Gc,
}

#[derive(Subcommand)]
enum GateCmd {
    /// Add a wait-gate to a ticket.
    Add {
        /// Ticket ID.
        ticket: String,

        /// Gate kind.
        kind: WaitGateKind,

        /// Description.
        #[arg(short, long)]
        description: Option<String>,

        /// For timer gates: ISO 8601 timestamp.
        #[arg(short, long)]
        until: Option<String>,

        /// For GitHub gates: owner/repo.
        #[arg(short, long)]
        repo: Option<String>,

        /// For GitHub run gates: run ID.
        #[arg(long)]
        run_id: Option<String>,

        /// For GitHub PR gates: PR number.
        #[arg(long)]
        pr: Option<u64>,
    },

    /// Resolve a gate.
    Resolve {
        /// Gate ID.
        id: String,

        /// Outcome.
        #[arg(short, long, default_value = "ok")]
        outcome: GateOutcome,
    },

    /// List gates for a ticket.
    List {
        /// Ticket ID.
        ticket: String,

        /// Include resolved gates.
        #[arg(long)]
        resolved: bool,
    },

    /// Remove a gate.
    Remove {
        /// Gate ID.
        id: String,
    },
}

#[derive(Subcommand)]
enum KillCmd {
    /// Enable the kill switch.
    Enable {
        /// Reason for enabling.
        #[arg(short, long)]
        reason: String,

        /// Who enabled it.
        #[arg(short, long, default_value = "cli")]
        actor: String,
    },

    /// Disable the kill switch.
    Disable,

    /// Show kill switch status.
    Status,
}

#[derive(Subcommand)]
enum CompactCmd {
    /// Rebuild ticket snapshots from events.
    Snapshots,

    /// Remove expired echoes.
    Echoes,

    /// Remove stale sync mappings.
    SyncState,

    /// Prune closed tickets older than N days.
    Prune {
        /// Retention period in days.
        #[arg(short, long, default_value_t = 90)]
        retention: i64,
    },

    /// Run all compaction operations.
    All,
}

#[derive(Subcommand)]
enum BatchCmd {
    /// Execute a batch of operations from a JSON file.
    Exec {
        /// JSON file containing an array of BatchOp objects.
        file: PathBuf,
    },
}

#[derive(Subcommand)]
enum TemplateCmd {
    /// Create a template from a JSON file.
    New {
        /// Template name.
        name: String,

        /// Template description.
        #[arg(short, long)]
        description: Option<String>,

        /// JSON file containing an array of TemplateStep objects.
        #[arg(short, long)]
        steps: PathBuf,
    },

    /// Show a template.
    Show {
        /// Template ID.
        id: String,
    },

    /// List templates.
    List,

    /// Instantiate a template into tickets.
    Instantiate {
        /// Template ID.
        id: String,
    },

    /// Delete a template.
    Delete {
        /// Template ID.
        id: String,
    },
}

#[derive(Subcommand)]
enum MemoryCmd {
    /// Store a new memory.
    Learn {
        /// Memory content.
        content: String,

        /// Tags (comma-separated).
        #[arg(short, long, value_delimiter = ',')]
        tags: Vec<String>,
    },

    /// Recall a memory by ID.
    Recall {
        /// Memory ID.
        id: String,
    },

    /// List memories, optionally filtered by tag.
    List {
        /// Filter by tag.
        #[arg(short, long)]
        tag: Option<String>,
    },

    /// Search memories by content or tag.
    Search {
        /// Search query.
        query: String,
    },

    /// Generate a brief from memories matching tags.
    Brief {
        /// Tags to include (comma-separated). If empty, all memories are included.
        #[arg(short, long, value_delimiter = ',')]
        tags: Vec<String>,

        /// Maximum number of memories to include.
        #[arg(short, long, default_value_t = 10)]
        limit: usize,
    },

    /// Update a memory.
    Update {
        /// Memory ID.
        id: String,

        /// New content.
        #[arg(short, long)]
        content: Option<String>,

        /// New tags.
        #[arg(short, long, value_delimiter = ',')]
        tags: Option<Vec<String>>,
    },

    /// Delete a memory.
    Forget {
        /// Memory ID.
        id: String,
    },
}

#[derive(Parser, Clone)]
struct TicketPatch {
    #[arg(short, long)]
    title: Option<String>,
    #[arg(short, long)]
    description: Option<String>,
    #[arg(short, long)]
    priority: Option<TicketPriority>,
    #[arg(short, long)]
    assignee: Option<String>,
    #[arg(short, long, value_delimiter = ',')]
    labels: Option<Vec<String>>,
}

#[derive(Clone, Copy, Debug, ValueEnum)]
enum CliTicketKind {
    Task,
    Bug,
    Feature,
    Epic,
    Chore,
    Decision,
}

impl From<CliTicketKind> for TicketKind {
    fn from(k: CliTicketKind) -> Self {
        match k {
            CliTicketKind::Task => TicketKind::Task,
            CliTicketKind::Bug => TicketKind::Bug,
            CliTicketKind::Feature => TicketKind::Feature,
            CliTicketKind::Epic => TicketKind::Epic,
            CliTicketKind::Chore => TicketKind::Chore,
            CliTicketKind::Decision => TicketKind::Decision,
        }
    }
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let root = std::env::current_dir()?.join(cli.root);

    match cli.command {
        Commands::Init => cmd_init(&root),
        Commands::Ticket(cmd) => cmd_ticket(&root, cmd, cli.json),
        Commands::Dag(cmd) => cmd_dag(&root, cmd),
        Commands::Ready { explain } => cmd_ready(&root, explain, cli.json),
        Commands::Doctor => cmd_doctor(&root, cli.json),
        Commands::Memory(cmd) => cmd_memory(&root, cmd, cli.json),
        Commands::Echo(cmd) => cmd_echo(&root, cmd, cli.json),
        Commands::Template(cmd) => cmd_template(&root, cmd, cli.json),
        Commands::Batch(cmd) => cmd_batch(&root, cmd, cli.json),
        Commands::Gate(cmd) => cmd_gate(&root, cmd, cli.json),
        Commands::Lock(cmd) => cmd_lock(&root, cmd, cli.json),
        Commands::Setup { target } => cmd_setup(&root, target, cli.json),
        Commands::Query { entity, query } => cmd_query(&root, entity, query, cli.json),
        Commands::Sync {
            provider,
            direction,
            configure,
            token,
        } => cmd_sync(&root, provider, direction, configure, token, cli.json),
        Commands::Policy { injected_by } => cmd_policy(&root, injected_by, cli.json),
        Commands::Mcp => cmd_mcp(&root),
        Commands::Compact(cmd) => cmd_compact(&root, cmd, cli.json),
        Commands::Kill(cmd) => cmd_kill(&root, cmd, cli.json),
        #[cfg(feature = "dolt")]
        Commands::Dolt(cmd) => cmd_dolt(&root, cmd, cli.json),
        Commands::Slo { window } => cmd_slo(&root, window, cli.json),
    }
}

fn check_kill_switch(root: &Path) -> Result<()> {
    allternit_agent_system_rails::killswitch::KillSwitch::load(root)?.check()
}

fn cmd_init(root: &Path) -> Result<()> {
    let rails_dir = root.join(RAILS_DIR);
    std::fs::create_dir_all(&rails_dir)?;
    std::fs::create_dir_all(rails_dir.join("ticket_events"))?;
    std::fs::create_dir_all(rails_dir.join("ticket_snapshots"))?;
    std::fs::create_dir_all(rails_dir.join("dependencies"))?;
    println!("initialized rails workspace at {}", rails_dir.display());
    Ok(())
}

fn cmd_ticket(root: &Path, cmd: TicketCmd, json: bool) -> Result<()> {
    let store = open_store(root)?;

    match cmd {
        TicketCmd::New {
            title,
            description,
            kind,
            priority,
            assignee,
            labels,
            external_ref,
            estimate,
        } => {
            ensure_init(root)?;
            check_kill_switch(root)?;
            let id = TicketId::mint(title.as_bytes());
            let ticket = Ticket {
                id: id.clone(),
                hierarchical_id: HierarchicalId::root(id),
                title,
                description: description.unwrap_or_default(),
                design: None,
                acceptance: None,
                notes: Vec::new(),
                status: TicketStatus::Open,
                kind: kind.into(),
                priority,
                assignee,
                estimate_minutes: estimate,
                due_at: None,
                defer_until: None,
                labels,
                external_ref,
                metadata: HashMap::new(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
                closed_at: None,
                close_reason: None,
            };
            let ticket = store.create(ticket)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&ticket)?);
            } else {
                println!("created ticket {}", ticket.id);
            }
        }

        TicketCmd::Show { id } => {
            let ticket_id = parse_ticket_id(&id)?;
            let ticket = store
                .get(&ticket_id)?
                .with_context(|| format!("ticket {id} not found"))?;
            if json {
                println!("{}", serde_json::to_string_pretty(&ticket)?);
            } else {
                print_ticket(&ticket);
            }
        }

        TicketCmd::List {
            status,
            kind,
            label,
            all,
        } => {
            let mut tickets = store.list()?;
            if let Some(status) = status {
                tickets.retain(|t| t.status == status);
            }
            if let Some(kind) = kind {
                tickets.retain(|t| t.kind == kind);
            }
            if let Some(label) = label {
                tickets.retain(|t| t.labels.contains(&label));
            }
            if !all {
                tickets.retain(|t| t.status != TicketStatus::Closed);
            }

            if json {
                println!("{}", serde_json::to_string_pretty(&tickets)?);
            } else {
                for ticket in tickets {
                    println!(
                        "{} [{}] {} ({})",
                        ticket.id,
                        ticket.status,
                        ticket.title,
                        ticket.kind
                    );
                }
            }
        }

        TicketCmd::Update { id, patch } => {
            check_kill_switch(root)?;
            let ticket_id = parse_ticket_id(&id)?;
            let update = TicketUpdate {
                title: patch.title,
                description: patch.description,
                design: None,
                acceptance: None,
                priority: patch.priority,
                assignee: Some(patch.assignee),
                estimate_minutes: None,
                due_at: None,
                defer_until: None,
                labels: patch.labels,
                external_ref: None,
                metadata: None,
            };
            let ticket = store.update(&ticket_id, update)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&ticket)?);
            } else {
                println!("updated ticket {}", ticket.id);
            }
        }

        TicketCmd::Close { id, reason } => {
            check_kill_switch(root)?;
            let ticket_id = parse_ticket_id(&id)?;
            let ticket = store.set_status(&ticket_id, TicketStatus::Closed, "cli", reason)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&ticket)?);
            } else {
                println!("closed ticket {}", ticket.id);
            }
        }

        TicketCmd::Note { id, text, author } => {
            check_kill_switch(root)?;
            let ticket_id = parse_ticket_id(&id)?;
            let ticket = store.add_note(&ticket_id, author, text)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&ticket)?);
            } else {
                println!("added note to ticket {}", ticket.id);
            }
        }
    }

    Ok(())
}

fn cmd_dag(root: &Path, cmd: DagCmd) -> Result<()> {
    check_kill_switch(root)?;
    match cmd {
        DagCmd::Block { ticket, blocker } => {
            let ticket_id = parse_ticket_id(&ticket)?;
            let blocker_id = parse_ticket_id(&blocker)?;
            let mut graph = load_graph(root)?;
            let edge = DependencyEdge::new(blocker_id, ticket_id, DependencyKind::Blocks);
            if graph.would_cycle(&edge) {
                bail!("adding this block would create a cycle");
            }
            graph.add(edge);
            save_graph(root, &graph)?;
            println!("{blocker} now blocks {ticket}");
        }
        DagCmd::Relate { a, b } => {
            let a_id = parse_ticket_id(&a)?;
            let b_id = parse_ticket_id(&b)?;
            let mut graph = load_graph(root)?;
            graph.add(DependencyEdge::new(a_id.clone(), b_id.clone(), DependencyKind::Related));
            graph.add(DependencyEdge::new(b_id, a_id, DependencyKind::Related));
            save_graph(root, &graph)?;
            println!("{a} and {b} are now related");
        }
        DagCmd::Tree { id } => {
            let ticket_id = parse_ticket_id(&id)?;
            let graph = load_graph(root)?;
            println!("{id}");
            print_tree(&graph, &ticket_id, "", true);
        }
        DagCmd::Verify => {
            let graph = load_graph(root)?;
            if graph.has_cycle() {
                if let Some(cycle) = graph.find_cycle() {
                    println!("cycle detected: {}", cycle.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(" -> "));
                } else {
                    println!("cycle detected");
                }
                std::process::exit(1);
            } else {
                println!("dependency graph is acyclic");
            }
        }
    }
    Ok(())
}

fn cmd_ready(root: &Path, explain: bool, json: bool) -> Result<()> {
    ensure_init(root)?;
    let store = open_store(root)?;
    let graph = load_graph(root)?;
    let gate_store = WaitGateStore::new(root)?;
    let tickets = store.list()?;
    let now = Utc::now();

    let mut ready = Vec::new();
    let mut not_ready = Vec::new();

    for ticket in &tickets {
        if ticket.status == TicketStatus::Closed {
            continue;
        }
        if ticket.is_deferred(now) {
            not_ready.push((ticket, "deferred".to_string()));
            continue;
        }

        let gates = gate_store.blocking_for(&ticket.id).ok().unwrap_or_default();
        if !gates.is_empty() {
            let reasons: Vec<String> = gates
                .iter()
                .map(|g| format!("{} gate {}", format!("{:?}", g.kind).to_lowercase(), g.id))
                .collect();
            not_ready.push((ticket, format!("gated: {}", reasons.join(", "))));
            continue;
        }

        let blockers = graph.blocks(&ticket.id);
        let open_blockers: Vec<_> = blockers
            .iter()
            .filter_map(|&id| tickets.iter().find(|t| t.id == *id))
            .filter(|t| t.status != TicketStatus::Closed)
            .collect();

        if open_blockers.is_empty() {
            ready.push(ticket);
        } else {
            not_ready.push((ticket, "blocked".to_string()));
        }
    }

    if json {
        let payload = serde_json::json!({
            "ready": ready,
            "not_ready": not_ready.iter().map(|(t, reason)| {
                serde_json::json!({"ticket": t, "reason": reason})
            }).collect::<Vec<_>>()
        });
        println!("{}", serde_json::to_string_pretty(&payload)?);
    } else {
        println!("ready:");
        for ticket in ready {
            if explain {
                println!("  {} {} — no open blockers", ticket.id, ticket.title);
            } else {
                println!("  {} {}", ticket.id, ticket.title);
            }
        }
        if explain {
            println!("\nnot ready:");
            for (ticket, reason) in not_ready {
                let blockers: Vec<String> = graph
                    .blocks(&ticket.id)
                    .into_iter()
                    .map(|id| id.to_string())
                    .collect();
                println!(
                    "  {} {} — {reason}{}",
                    ticket.id,
                    ticket.title,
                    if blockers.is_empty() {
                        String::new()
                    } else {
                        format!(" (blocked by: {})", blockers.join(", "))
                    }
                );
            }
        }
    }

    Ok(())
}

fn cmd_doctor(root: &Path, json: bool) -> Result<()> {
    ensure_init(root)?;
    let report = allternit_agent_system_rails::doctor::diagnose(root, 30)?;

    if json {
        println!("{}", serde_json::to_string_pretty(&report)?);
    } else {
        println!("checked {} tickets, {} edges", report.ticket_count, report.edge_count);
        println!("ledger valid: {}", report.ledger_valid);
        println!("stale: {}, orphans: {}, duplicates: {}", report.stale_count, report.orphan_count, report.duplicate_count);
        if report.ok {
            println!("rails doctor: ok");
        } else {
            println!("rails doctor: found issues");
            for issue in report.issues {
                println!("  [{}] {}: {}", issue.severity, issue.code, issue.message);
            }
        }
    }

    if !report.ok {
        std::process::exit(1);
    }

    Ok(())
}

fn cmd_memory(root: &Path, cmd: MemoryCmd, json: bool) -> Result<()> {
    ensure_init(root)?;
    let store = MemoryStore::new(root)?;

    match cmd {
        MemoryCmd::Learn { content, tags } => {
            check_kill_switch(root)?;
            let memory = store.learn(content, tags)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&memory)?);
            } else {
                println!("learned memory {}", memory.id);
            }
        }
        MemoryCmd::Recall { id } => {
            let memory = store
                .recall(&id)?
                .with_context(|| format!("memory {id} not found"))?;
            if json {
                println!("{}", serde_json::to_string_pretty(&memory)?);
            } else {
                println!("{}\n{}", memory.id, memory.content);
            }
        }
        MemoryCmd::List { tag } => {
            let memories = store.list(tag.as_deref())?;
            if json {
                println!("{}", serde_json::to_string_pretty(&memories)?);
            } else {
                for memory in memories {
                    println!(
                        "{} [{}] {}",
                        memory.id,
                        memory.tags.join(", "),
                        memory.content.lines().next().unwrap_or(&memory.content)
                    );
                }
            }
        }
        MemoryCmd::Search { query } => {
            let memories = store.search(&query)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&memories)?);
            } else {
                for memory in memories {
                    println!("{}: {}", memory.id, memory.content);
                }
            }
        }
        MemoryCmd::Brief { tags, limit } => {
            let brief = store.brief(&tags, limit)?;
            println!("{brief}");
        }
        MemoryCmd::Update { id, content, tags } => {
            check_kill_switch(root)?;
            let update = MemoryUpdate { content, tags };
            let memory = store.update(&id, update)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&memory)?);
            } else {
                println!("updated memory {}", memory.id);
            }
        }
        MemoryCmd::Forget { id } => {
            check_kill_switch(root)?;
            let forgot = store.forget(&id)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&serde_json::json!({"forgot": forgot, "id": id}))?);
            } else if forgot {
                println!("forgot memory {id}");
            } else {
                println!("memory {id} not found");
            }
        }
    }

    Ok(())
}

fn cmd_echo(root: &Path, cmd: EchoCmd, json: bool) -> Result<()> {
    ensure_init(root)?;
    let store = EchoStore::new(root)?;

    match cmd {
        EchoCmd::New { content, kind, ttl } => {
            check_kill_switch(root)?;
            let echo = store.create(kind, content, ttl)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&echo)?);
            } else {
                println!("created echo {} ({}) expires {}", echo.id, echo.kind, echo.expires_at);
            }
        }
        EchoCmd::List { expired } => {
            let echoes = store.list(expired)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&echoes)?);
            } else {
                for echo in echoes {
                    println!(
                        "{} [{}] {} (expires {})",
                        echo.id, echo.kind, echo.content, echo.expires_at
                    );
                }
            }
        }
        EchoCmd::Gc => {
            check_kill_switch(root)?;
            let removed = store.gc()?;
            if json {
                println!("{}", serde_json::to_string_pretty(&serde_json::json!({"removed": removed}))?);
            } else {
                println!("garbage collected {removed} expired echoes");
            }
        }
    }

    Ok(())
}

fn cmd_template(root: &Path, cmd: TemplateCmd, json: bool) -> Result<()> {
    ensure_init(root)?;
    let template_store = TemplateStore::new(root)?;

    match cmd {
        TemplateCmd::New {
            name,
            description,
            steps,
        } => {
            check_kill_switch(root)?;
            let raw = std::fs::read_to_string(&steps)
                .with_context(|| format!("failed to read steps file {steps:?}"))?;
            let steps: Vec<TemplateStep> = serde_json::from_str(&raw)
                .with_context(|| "failed to parse steps JSON")?;
            let template = template_store.create(name, description.unwrap_or_default(), steps)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&template)?);
            } else {
                println!("created template {} with {} steps", template.id, template.steps.len());
            }
        }
        TemplateCmd::Show { id } => {
            let template = template_store
                .get(&id)?
                .with_context(|| format!("template {id} not found"))?;
            if json {
                println!("{}", serde_json::to_string_pretty(&template)?);
            } else {
                println!("{}: {}", template.id, template.name);
                println!("{}", template.description);
                for step in &template.steps {
                    println!("  - {} [{}] {}", step.id, step.kind, step.title);
                }
            }
        }
        TemplateCmd::List => {
            let templates = template_store.list()?;
            if json {
                println!("{}", serde_json::to_string_pretty(&templates)?);
            } else {
                for template in templates {
                    println!("{} {} ({} steps)", template.id, template.name, template.steps.len());
                }
            }
        }
        TemplateCmd::Instantiate { id } => {
            check_kill_switch(root)?;
            let ticket_store = open_store(root)?;
            let mut graph = load_graph(root)?;
            let result = template_store.instantiate(&id, &ticket_store, &mut graph)?;
            save_graph(root, &graph)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&result)?);
            } else {
                println!("instantiated template {} into {} tickets", result.template_id, result.tickets.len());
                for ticket in &result.tickets {
                    println!("  created {}", ticket.id);
                }
            }
        }
        TemplateCmd::Delete { id } => {
            check_kill_switch(root)?;
            let deleted = template_store.delete(&id)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&serde_json::json!({"deleted": deleted, "id": id}))?);
            } else if deleted {
                println!("deleted template {id}");
            } else {
                println!("template {id} not found");
            }
        }
    }

    Ok(())
}

fn cmd_batch(root: &Path, cmd: BatchCmd, json: bool) -> Result<()> {
    ensure_init(root)?;
    let store = open_store(root)?;
    let executor = BatchExecutor::new(&store, root);

    check_kill_switch(root)?;
    match cmd {
        BatchCmd::Exec { file } => {
            let raw = std::fs::read_to_string(&file)
                .with_context(|| format!("failed to read batch file {file:?}"))?;
            let ops: Vec<BatchOp> = serde_json::from_str(&raw)
                .with_context(|| "failed to parse batch JSON")?;
            let results = executor.execute(ops)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&results)?);
            } else {
                println!("applied {} operations", results.len());
                for result in results {
                    match result {
                        BatchOpResult::CreateTicket { id, ticket_id } => {
                            println!("  created ticket {ticket_id} (ref {id})")
                        }
                        BatchOpResult::UpdateTicket { id } => println!("  updated {id}"),
                        BatchOpResult::CloseTicket { id } => println!("  closed {id}"),
                        BatchOpResult::AddDependency { from, to, kind } => {
                            println!("  added {kind:?} edge {from} -> {to}")
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

fn cmd_gate(root: &Path, cmd: GateCmd, json: bool) -> Result<()> {
    ensure_init(root)?;
    let store = WaitGateStore::new(root)?;

    match cmd {
        GateCmd::Add {
            ticket,
            kind,
            description,
            until,
            repo,
            run_id,
            pr,
        } => {
            check_kill_switch(root)?;
            let ticket_id = parse_ticket_id(&ticket)?;
            let mut params = std::collections::HashMap::new();
            if let Some(until) = until {
                params.insert("until".to_string(), serde_json::json!(until));
            }
            if let Some(repo) = repo {
                params.insert("repo".to_string(), serde_json::json!(repo));
            }
            if let Some(run_id) = run_id {
                params.insert("run_id".to_string(), serde_json::json!(run_id));
            }
            if let Some(pr) = pr {
                params.insert("pr".to_string(), serde_json::json!(pr));
            }
            let desc = description.unwrap_or_else(|| format!("{kind:?} gate"));
            let gate = store.add(ticket_id, kind, desc, params)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&gate)?);
            } else {
                println!("added gate {} to {}", gate.id, gate.ticket_id);
            }
        }
        GateCmd::Resolve { id, outcome } => {
            check_kill_switch(root)?;
            let gate = store.resolve(&id, outcome)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&gate)?);
            } else {
                println!("resolved gate {} as {}", gate.id, gate.outcome.unwrap());
            }
        }
        GateCmd::List { ticket, resolved } => {
            let ticket_id = parse_ticket_id(&ticket)?;
            let gates = store.for_ticket(&ticket_id, resolved)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&gates)?);
            } else {
                for gate in gates {
                    let status = if let Some(outcome) = gate.outcome {
                        format!("resolved: {outcome}")
                    } else {
                        "open".to_string()
                    };
                    println!("{} [{}] {} - {}", gate.id, gate.kind, gate.description, status);
                }
            }
        }
        GateCmd::Remove { id } => {
            check_kill_switch(root)?;
            let removed = store.remove(&id)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&serde_json::json!({"removed": removed, "id": id}))?);
            } else if removed {
                println!("removed gate {id}");
            } else {
                println!("gate {id} not found");
            }
        }
    }

    Ok(())
}

fn cmd_lock(root: &Path, cmd: LockCmd, json: bool) -> Result<()> {
    ensure_init(root)?;
    let store = MergeLockStore::new(root)?;

    match cmd {
        LockCmd::Acquire { domain, owner, ttl } => {
            check_kill_switch(root)?;
            match store.acquire(&domain, &owner, ttl) {
                Ok(lock) => {
                    if json {
                        println!("{}", serde_json::to_string_pretty(&lock)?);
                    } else {
                        println!("acquired lock {} on {} until {}", lock.id, lock.domain, lock.expires_at);
                    }
                }
                Err(e) => {
                    if json {
                        println!("{}", serde_json::to_string_pretty(&serde_json::json!({"error": e.to_string()}))?);
                    } else {
                        println!("{e}");
                    }
                    std::process::exit(1);
                }
            }
        }
        LockCmd::Release { id } => {
            check_kill_switch(root)?;
            let lock = store.release(&id)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&lock)?);
            } else {
                println!("released lock {} on {}", lock.id, lock.domain);
            }
        }
        LockCmd::List { active } => {
            let locks = store.list(active)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&locks)?);
            } else {
                for lock in locks {
                    let status = if lock.released_at.is_some() {
                        "released"
                    } else if Utc::now() >= lock.expires_at {
                        "expired"
                    } else {
                        "active"
                    };
                    println!("{} [{}] {} by {} (expires {})", lock.id, status, lock.domain, lock.owner, lock.expires_at);
                }
            }
        }
        LockCmd::Status { domain } => {
            let lock = store.active_for_domain(&domain)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&serde_json::json!({"domain": domain, "lock": lock}))?);
            } else if let Some(lock) = lock {
                println!("{} locked by {} until {}", domain, lock.owner, lock.expires_at);
            } else {
                println!("{domain} is not locked");
            }
        }
        LockCmd::Gc => {
            check_kill_switch(root)?;
            let removed = store.gc()?;
            if json {
                println!("{}", serde_json::to_string_pretty(&serde_json::json!({"removed": removed}))?);
            } else {
                println!("removed {removed} stale locks");
            }
        }
    }

    Ok(())
}

fn cmd_setup(root: &Path, target: AgentTarget, json: bool) -> Result<()> {
    check_kill_switch(root)?;
    let files = SetupRecipe::apply(target, root)?;
    if json {
        println!("{}", serde_json::to_string_pretty(&serde_json::json!({"target": target.to_string(), "files": files}))?);
    } else {
        println!("configured {target}:");
        for file in files {
            println!("  wrote {}", file.display());
        }
    }
    Ok(())
}

fn cmd_query(root: &Path, entity: QueryEntity, query: Vec<String>, json: bool) -> Result<()> {
    ensure_init(root)?;
    let engine = QueryEngine::new(root);
    let query_str = query.join(" ");
    let parsed = Query::parse(&query_str)?;
    let results = engine.execute(entity, &parsed)?;

    if json {
        println!("{}", serde_json::to_string_pretty(&results)?);
    } else {
        println!("{} result(s) for '{}':", results.len(), query_str.trim());
        for item in results {
            match item {
                QueryResultItem::Ticket(t) => println!("  ticket {} [{}] {}", t.id, t.status, t.title),
                QueryResultItem::Memory(m) => println!("  memory {} {}", m.id, m.content),
                QueryResultItem::Echo(e) => println!("  echo {} [{}] {}", e.id, e.kind, e.content),
                QueryResultItem::Gate(g) => println!("  gate {} for {} [{}]", g.id, g.ticket_id, g.kind),
                QueryResultItem::Lock(l) => println!("  lock {} on {} by {}", l.id, l.domain, l.owner),
                QueryResultItem::Other(_) => {}
            }
        }
    }

    Ok(())
}

fn cmd_mcp(root: &Path) -> Result<()> {
    ensure_init(root)?;
    let server = McpServer::new(root);
    server.run_stdio()
}

fn cmd_kill(root: &Path, cmd: KillCmd, json: bool) -> Result<()> {
    ensure_init(root)?;
    let mut ks = KillSwitch::load(root)?;

    match cmd {
        KillCmd::Enable { reason, actor } => {
            ks.enable(reason, actor);
            ks.save(root)?;
        }
        KillCmd::Disable => {
            ks.disable();
            ks.save(root)?;
        }
        KillCmd::Status => {}
    }

    if json {
        println!("{}", serde_json::to_string_pretty(&ks)?);
    } else {
        if ks.enabled {
            println!("kill switch enabled");
            println!("  reason: {}", ks.reason.unwrap_or_default());
            println!("  at: {}", ks.enabled_at.unwrap_or_else(Utc::now));
            println!("  by: {}", ks.enabled_by.unwrap_or_default());
        } else {
            println!("kill switch disabled");
        }
    }
    Ok(())
}

fn cmd_slo(root: &Path, window: i64, json: bool) -> Result<()> {
    ensure_init(root)?;
    let metrics = SloMetrics::load(root)?;
    let summary = metrics.summary(window);
    if json {
        println!("{}", serde_json::to_string_pretty(&summary)?);
    } else {
        println!("SLO metrics (last {window} minutes):");
        println!("  total operations: {}", summary.total);
        println!("  successes: {}", summary.successes);
        println!("  failures: {}", summary.failures);
        println!("  avg duration: {} ms", summary.avg_duration_ms);
    }
    Ok(())
}

#[cfg(feature = "dolt")]
fn parse_dolt_config(url: Option<String>) -> DoltConfig {
    if let Some(url) = url {
        // Simple URL parsing: mysql://user:pass@host:port/db
        let rest = url.strip_prefix("mysql://").unwrap_or(&url);
        let (credentials, rest) = rest.split_once('@').unwrap_or(("root:", rest));
        let (user, password) = credentials.split_once(':').unwrap_or((credentials, ""));
        let (host_port, db) = rest.split_once('/').unwrap_or((rest, "rails"));
        let (host, port) = host_port.split_once(':').unwrap_or((host_port, "3306"));
        DoltConfig {
            user: user.to_string(),
            password: password.to_string(),
            host: host.to_string(),
            port: port.parse().unwrap_or(3306),
            database: db.to_string(),
        }
    } else {
        DoltConfig::from_env()
    }
}

#[cfg(feature = "dolt")]
fn cmd_dolt(root: &Path, cmd: DoltCmd, json: bool) -> Result<()> {
    ensure_init(root)?;
    let config = match &cmd {
        DoltCmd::Init { url } => parse_dolt_config(url.clone()),
        DoltCmd::Push { url } => parse_dolt_config(url.clone()),
        DoltCmd::Pull { url } => parse_dolt_config(url.clone()),
        DoltCmd::Status { url } => parse_dolt_config(url.clone()),
    };

    let rt = tokio::runtime::Runtime::new()?;

    match cmd {
        DoltCmd::Init { .. } => {
            check_kill_switch(root)?;
            rt.block_on(async {
                let storage = DoltStorage::connect(&config).await?;
                storage.init_schema().await
            })?;
            if json {
                println!("{}", serde_json::to_string_pretty(&serde_json::json!({"initialized": true, "database": config.database}))?);
            } else {
                println!("initialized Dolt schema in database {}", config.database);
            }
        }
        DoltCmd::Push { .. } => {
            check_kill_switch(root)?;
            let count = rt.block_on(async {
                let storage = DoltStorage::connect(&config).await?;
                storage.init_schema().await?;
                storage.sync_from_file_store(root).await
            })?;
            if json {
                println!("{}", serde_json::to_string_pretty(&serde_json::json!({"pushed": count, "database": config.database}))?);
            } else {
                println!("pushed {count} ticket(s) to Dolt database {}", config.database);
            }
        }
        DoltCmd::Pull { .. } => {
            check_kill_switch(root)?;
            let count = rt.block_on(async {
                let storage = DoltStorage::connect(&config).await?;
                storage.sync_to_file_store(root).await
            })?;
            if json {
                println!("{}", serde_json::to_string_pretty(&serde_json::json!({"pulled": count, "database": config.database}))?);
            } else {
                println!("pulled {count} ticket(s) from Dolt database {}", config.database);
            }
        }
        DoltCmd::Status { .. } => {
            let status = rt.block_on(async {
                let storage = DoltStorage::connect(&config).await?;
                storage.status(root).await
            })?;
            if json {
                println!("{}", serde_json::to_string_pretty(&status)?);
            } else {
                println!("Dolt status for database {}:", config.database);
                println!("  local tickets: {}", status.file_tickets);
                println!("  dolt tickets: {}", status.dolt_tickets);
            }
        }
    }

    Ok(())
}

fn cmd_compact(root: &Path, cmd: CompactCmd, json: bool) -> Result<()> {
    ensure_init(root)?;
    check_kill_switch(root)?;
    let compactor = Compactor::new(root);

    let result = match cmd {
        CompactCmd::Snapshots => {
            let removed = compactor.compact_snapshots()?;
            serde_json::json!({ "snapshots_removed": removed, "snapshots_rebuilt": removed })
        }
        CompactCmd::Echoes => {
            let removed = compactor.compact_echoes()?;
            serde_json::json!({ "echoes_removed": removed })
        }
        CompactCmd::SyncState => {
            let removed = compactor.compact_sync_mappings()?;
            serde_json::json!({ "sync_mappings_removed": removed })
        }
        CompactCmd::Prune { retention } => {
            let pruned = compactor.prune_tickets(retention)?;
            serde_json::json!({ "tickets_pruned": pruned })
        }
        CompactCmd::All => {
            let summary = compactor.compact_all()?;
            serde_json::to_value(summary)?
        }
    };

    if json {
        println!("{}", serde_json::to_string_pretty(&result)?);
    } else {
        println!("{}", serde_json::to_string_pretty(&result)?);
    }

    Ok(())
}

fn cmd_policy(root: &Path, injected_by: String, json: bool) -> Result<()> {
    ensure_init(root)?;
    check_kill_switch(root)?;
    let ledger = Ledger::new(LedgerOptions {
        root_dir: Some(root.to_path_buf()),
        ledger_dir: None,
    });
    let rt = tokio::runtime::Runtime::new()?;
    let bundle = rt.block_on(inject_policy(root, &ledger, None, &injected_by))?;
    if json {
        println!(
            "{}",
            serde_json::to_string_pretty(&serde_json::json!({
                "policy_bundle_id": bundle.policy_bundle_id,
                "agents_md_hash": bundle.agents_md_hash,
                "sources": bundle.sources,
                "injected_by": bundle.injected_by,
            }))?
        );
    } else {
        println!("injected policy bundle {}", bundle.policy_bundle_id);
        println!("hash: {}", bundle.agents_md_hash);
        println!("sources: {}", bundle.sources.join(", "));
    }
    Ok(())
}

fn cmd_sync(
    root: &Path,
    provider: String,
    direction: SyncDirection,
    configure: bool,
    token: Option<String>,
    json: bool,
) -> Result<()> {
    ensure_init(root)?;
    check_kill_switch(root)?;
    let store = SyncStore::new(root)?;

    if configure {
        let mut config = store.config(&provider)?.unwrap_or_default();
        config.enabled = true;
        if let Some(token) = token {
            config.token = Some(token);
        }
        store.set_config(&provider, &config)?;
        if json {
            println!("{}", serde_json::to_string_pretty(&config)?);
        } else {
            println!("configured {provider} sync");
        }
        return Ok(());
    }

    let config = store.config(&provider)?.unwrap_or_default();
    let tracker = build_provider(&provider, config.clone())?;

    if matches!(direction, SyncDirection::Pull) {
        let result = tracker.pull(root)?;
        if json {
            println!("{}", serde_json::to_string_pretty(&result)?);
        } else {
            println!(
                "{} pull: {} created, {} updated, {} unchanged",
                result.provider, result.created, result.updated, result.unchanged
            );
            if let Some(msg) = result.message {
                println!("  note: {msg}");
            }
            for err in result.errors {
                println!("  error: {err}");
            }
        }
    } else {
        let ticket_store = open_store(root)?;
        let tickets = ticket_store.list()?;
        let result = tracker.push(root, &tickets)?;
        if json {
            println!("{}", serde_json::to_string_pretty(&result)?);
        } else {
            println!(
                "{} push: {} created, {} updated, {} unchanged",
                result.provider, result.created, result.updated, result.unchanged
            );
            if let Some(msg) = result.message {
                println!("  note: {msg}");
            }
            for err in result.errors {
                println!("  error: {err}");
            }
        }
    }

    Ok(())
}

fn open_store(root: &Path) -> Result<TicketStore> {
    TicketStore::new(root).context("failed to open ticket store")
}

fn ensure_init(root: &Path) -> Result<()> {
    if !root.join(RAILS_DIR).exists() {
        bail!("rails workspace not initialized. run `rails init` first.");
    }
    Ok(())
}

fn parse_ticket_id(s: &str) -> Result<TicketId> {
    TicketId::from_str(s).with_context(|| format!("invalid ticket id: {s}"))
}

fn graph_path(root: &Path) -> PathBuf {
    root.join(RAILS_DIR).join("dependencies").join("graph.json")
}

fn load_graph(root: &Path) -> Result<DependencyGraph> {
    let path = graph_path(root);
    if !path.exists() {
        return Ok(DependencyGraph::new());
    }
    let raw = std::fs::read_to_string(&path)?;
    let graph: DependencyGraph = serde_json::from_str(&raw)?;
    Ok(graph)
}

fn save_graph(root: &Path, graph: &DependencyGraph) -> Result<()> {
    let path = graph_path(root);
    allternit_agent_system_rails::core::io::write_json_atomic(&path, graph)?;
    Ok(())
}

fn print_ticket(ticket: &Ticket) {
    println!("{} [{}] {}", ticket.id, ticket.status, ticket.title);
    println!("  kind:      {}", ticket.kind);
    println!("  priority:  {}", ticket.priority);
    println!("  status:    {}", ticket.status);
    if let Some(assignee) = &ticket.assignee {
        println!("  assignee:  {assignee}");
    }
    if !ticket.labels.is_empty() {
        println!("  labels:    {}", ticket.labels.join(", "));
    }
    if !ticket.description.is_empty() {
        println!("\n{}", ticket.description);
    }
    if !ticket.notes.is_empty() {
        println!("\nnotes:");
        for note in &ticket.notes {
            println!("  [{}] {}: {}", note.created_at.format("%Y-%m-%d"), note.author, note.body);
        }
    }
}

fn print_tree(graph: &DependencyGraph, id: &TicketId, prefix: &str, _is_last: bool) {
    let children: Vec<_> = graph
        .blocked_by(id)
        .into_iter()
        .map(|id| id.clone())
        .collect();

    for (i, child) in children.iter().enumerate() {
        let is_last_child = i == children.len() - 1;
        let connector = if is_last_child { "└── " } else { "├── " };
        println!("{prefix}{}{child}", connector);
        let new_prefix = format!(
            "{}{}",
            prefix,
            if is_last_child { "    " } else { "│   " }
        );
        print_tree(graph, child, &new_prefix, is_last_child);
    }
}

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::{bail, Result};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use a2r_agent_system_rails::bus::{Bus, BusMessage, BusOptions, NewBusMessage};
use a2r_agent_system_rails::cli::work::{run_work_command, WorkCmd, WorkContext};
use a2r_agent_system_rails::core::ids::{create_event_id, create_lease_id};
use a2r_agent_system_rails::core::io::{ensure_dir, write_json_atomic};
use a2r_agent_system_rails::gate::gate::{GateOptions, WihPickupOptions};
use a2r_agent_system_rails::leases::leases::LeasesOptions;
use a2r_agent_system_rails::ledger::ledger::LedgerOptions;
use a2r_agent_system_rails::policy;
use a2r_agent_system_rails::wih::projection::project_wih;
use a2r_agent_system_rails::wih::types::LoopPolicy;
use a2r_agent_system_rails::work::graph::{has_cycle_edges, ready_nodes};
use a2r_agent_system_rails::work::projection::project_dag;
use a2r_agent_system_rails::work::types::DagState;
use a2r_agent_system_rails::{
    A2REvent, Actor, ActorType, DagMutation, EventScope, Gate, Index, IndexOptions, LeaseRequest,
    Leases, Ledger, LedgerQuery, Mail, MailOptions, ReceiptStore, ReceiptStoreOptions, Vault,
    VaultOptions, WorkOps,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixStream;
use tokio::process::Command;
use tokio::time::{sleep, Duration as TokioDuration};

#[derive(Parser)]
#[command(name = "a2r-rails")]
#[command(about = "A2R Agent System Rails CLI", long_about = None)]
struct Cli {
    #[arg(long)]
    root: Option<PathBuf>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    #[command(subcommand)]
    Plan(PlanCmd),
    #[command(subcommand)]
    Dag(DagCmd),
    #[command(subcommand)]
    Wih(WihCmd),
    #[command(subcommand)]
    Lease(LeaseCmd),
    #[command(subcommand)]
    Ledger(LedgerCmd),
    #[command(subcommand)]
    Index(IndexCmd),
    #[command(subcommand)]
    Mail(MailCmd),
    #[command(subcommand)]
    Gate(GateCmd),
    #[command(subcommand)]
    Vault(VaultCmd),
    #[command(subcommand)]
    Runner(RunnerCmd),
    #[command(subcommand)]
    Bus(BusCmd),
    #[command(subcommand)]
    Transport(TransportCmd),
    Init,
    #[command(subcommand)]
    Work(WorkCmd),
}

#[derive(Subcommand)]
enum PlanCmd {
    New {
        text: String,
    },
    Refine {
        dag_id: String,
        #[arg(long)]
        delta: String,
        #[arg(long)]
        mutations: Option<PathBuf>,
        #[arg(long)]
        mutations_json: Option<String>,
    },
    Show {
        dag_id: String,
    },
}

#[derive(Subcommand)]
enum DagCmd {
    Render {
        dag_id: String,
        #[arg(long, default_value = "json")]
        format: String,
    },
}

#[derive(Subcommand)]
enum WihCmd {
    List {
        #[arg(long)]
        ready: bool,
        #[arg(long = "dag")]
        dag_id: Option<String>,
    },
    Pickup {
        node_id: String,
        #[arg(long = "dag")]
        dag_id: String,
        #[arg(long = "agent")]
        agent_id: String,
        #[arg(long)]
        role: Option<String>,
        #[arg(long)]
        fresh: bool,
    },
    Context {
        wih_id: String,
    },
    SignOpen {
        wih_id: String,
        signature: String,
    },
    Close {
        wih_id: String,
        status: String,
        evidence: Vec<String>,
    },
}

#[derive(Subcommand)]
enum LeaseCmd {
    Request {
        wih_id: String,
        agent_id: String,
        paths: Vec<String>,
        ttl: Option<i64>,
    },
    Release {
        lease_id: String,
    },
}

#[derive(Subcommand)]
enum LedgerCmd {
    Tail {
        #[arg(default_value_t = 50)]
        n: usize,
    },
    Trace {
        #[arg(long = "node")]
        node_id: Option<String>,
        #[arg(long = "wih")]
        wih_id: Option<String>,
        #[arg(long = "prompt")]
        prompt_id: Option<String>,
    },
}

#[derive(Subcommand)]
enum IndexCmd {
    Rebuild,
}

#[derive(Subcommand)]
enum MailCmd {
    EnsureThread {
        topic: String,
    },
    Send {
        thread_id: String,
        body_ref: String,
        attachments: Vec<String>,
    },
    RequestReview {
        thread_id: String,
        #[arg(long = "wih")]
        wih_id: String,
        #[arg(long = "diff")]
        diff_ref: String,
    },
    Decide {
        thread_id: String,
        #[arg(long)]
        approve: bool,
        #[arg(long)]
        reject: bool,
        #[arg(long = "notes")]
        notes_ref: Option<String>,
    },
    Inbox {
        thread_id: Option<String>,
        #[arg(long, default_value_t = 20)]
        limit: usize,
    },
    Ack {
        thread_id: String,
        message_id: String,
        #[arg(long)]
        note: Option<String>,
    },
    Reserve {
        wih_id: String,
        #[arg(long = "agent")]
        agent_id: String,
        paths: Vec<String>,
        #[arg(long)]
        ttl: Option<i64>,
    },
    Release {
        lease_id: String,
    },
    Share {
        thread_id: String,
        asset_ref: String,
        #[arg(long)]
        note: Option<String>,
    },
    Archive {
        thread_id: String,
        path: String,
        #[arg(long)]
        reason: Option<String>,
    },
    Guard {
        action: String,
        #[arg(long)]
        detail: Option<String>,
    },
}

#[derive(Subcommand)]
enum GateCmd {
    Status,
    Check {
        wih_id: String,
        tool: String,
        paths: Vec<String>,
    },
    Rules,
    Verify {
        #[arg(long)]
        json: bool,
    },
    Decision {
        note: String,
        #[arg(long)]
        reason: Option<String>,
        #[arg(long = "link")]
        links: Vec<String>,
    },
    Mutate {
        #[arg(long)]
        dag_id: String,
        note: String,
        #[arg(long)]
        reason: Option<String>,
        #[arg(long)]
        mutations: Option<PathBuf>,
        #[arg(long)]
        mutations_json: Option<String>,
    },
}

#[derive(Subcommand)]
enum VaultCmd {
    Archive {
        wih_id: String,
    },
    Status {
        #[arg(long)]
        json: bool,
    },
}

#[derive(Subcommand)]
enum RunnerCmd {
    /// Start the Rails Runner as a long-running loop
    Start,
    /// Run the Rails Runner once (process events up to the latest)
    Once,
}

#[derive(Subcommand)]
enum BusCmd {
    Send {
        to: String,
        from: String,
        kind: String,
        payload: String,
        #[arg(long)]
        transport: Option<String>,
        #[arg(long)]
        correlation_id: Option<String>,
    },
    Poll {
        #[arg(long, default_value_t = 20)]
        limit: usize,
    },
    Deliver {
        message_id: i64,
    },
    TmuxSend {
        session: String,
        #[arg(long)]
        pane: Option<String>,
        command: String,
        #[arg(long)]
        iteration: Option<String>,
        #[arg(long)]
        correlation_id: Option<String>,
    },
    SocketSend {
        socket: String,
        payload: String,
        #[arg(long)]
        iteration: Option<String>,
        #[arg(long)]
        correlation_id: Option<String>,
    },
    TmuxRunner {
        session: String,
        #[arg(long)]
        pane: Option<String>,
        #[arg(long)]
        watch: bool,
    },
    SocketRunner {
        socket: String,
        #[arg(long)]
        watch: bool,
    },
}

#[derive(Subcommand)]
enum TransportCmd {
    TmuxInspect {
        #[arg(long)]
        session: Option<String>,
    },
    SocketInspect {
        #[arg(long)]
        socket: Option<String>,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let root = cli.root.unwrap_or_else(|| std::env::current_dir().unwrap());

    let ledger = Arc::new(Ledger::new(LedgerOptions {
        root_dir: Some(root.clone()),
        ledger_dir: Some(PathBuf::from(".a2r/ledger")),
    }));

    let lease_store = Arc::new(
        Leases::new(LeasesOptions {
            root_dir: Some(root.clone()),
            leases_dir: Some(PathBuf::from(".a2r/leases")),
            event_sink: Some(ledger.clone()),
            actor_id: Some("gate".to_string()),
            auto_renewal_enabled: true,
            auto_renewal_threshold_seconds: 300,
            auto_renewal_interval_seconds: 60,
            auto_renewal_extend_seconds: 600,
        })
        .await?,
    );

    let receipts = Arc::new(ReceiptStore::new(ReceiptStoreOptions {
        root_dir: Some(root.clone()),
        receipts_dir: Some(PathBuf::from(".a2r/receipts")),
        blobs_dir: Some(PathBuf::from(".a2r/blobs")),
    })?);

    let index = Arc::new(
        Index::new(IndexOptions {
            root_dir: Some(root.clone()),
            index_dir: Some(PathBuf::from(".a2r/index")),
        })
        .await?,
    );

    let vault = Arc::new(Vault::new(VaultOptions {
        root_dir: Some(root.clone()),
        ledger: ledger.clone(),
        actor_id: Some("gate".to_string()),
    }));

    let gate = Arc::new(Gate::new(GateOptions {
        ledger: ledger.clone(),
        leases: lease_store.clone(),
        receipts: receipts.clone(),
        index: Some(index.clone()),
        vault: Some(vault.clone()),
        root_dir: Some(root.clone()),
        actor_id: Some("gate".to_string()),
        strict_provenance: None,
        visual_provider: None,
        visual_config: None,
    }));

    let transport_root = Arc::new(root.clone());
    let bus = Arc::new(
        Bus::new(BusOptions {
            root_dir: root.clone(),
            ledger: ledger.clone(),
            actor_id: Some("bus".to_string()),
            actor_type: Some(ActorType::Gate),
        })
        .await?,
    );

    let work_ops = Arc::new(WorkOps::new(
        ledger.clone(),
        Some("a2r work".to_string()),
        Some(ActorType::Agent),
    ));
    let work_ctx = WorkContext {
        root: root.clone(),
        ledger: ledger.clone(),
        gate: gate.clone(),
        work: work_ops.clone(),
        index: index.clone(),
    };

    let mail = Mail::new(MailOptions {
        root_dir: Some(root.clone()),
        ledger: ledger.clone(),
        actor_id: Some("mail".to_string()),
        actor_type: None,
    });

    match cli.command {
        Commands::Plan(cmd) => match cmd {
            PlanCmd::New { text } => {
                let (prompt_id, dag_id, node_id) = gate.plan_new(&text, None).await?;
                println!("prompt_id: {prompt_id}\ndag_id: {dag_id}\nnode_id: {node_id}");
            }
            PlanCmd::Refine {
                dag_id,
                delta,
                mutations,
                mutations_json,
            } => {
                let mutations = load_mutations(mutations, mutations_json)?;
                let delta_id = gate.plan_refine(&dag_id, &delta, "cli", mutations).await?;
                println!("delta_id: {delta_id}");
            }
            PlanCmd::Show { dag_id } => {
                let dag = resolve_dag(&ledger, &root, &dag_id).await?;
                println!("{}", serde_json::to_string_pretty(&dag)?);
            }
        },
        Commands::Dag(cmd) => match cmd {
            DagCmd::Render { dag_id, format } => {
                let dag = resolve_dag(&ledger, &root, &dag_id).await?;
                if format == "md" {
                    println!("{}", render_dag_markdown(&dag));
                } else {
                    println!("{}", serde_json::to_string_pretty(&dag)?);
                }
            }
        },
        Commands::Wih(cmd) => match cmd {
            WihCmd::List { ready, dag_id } => {
                let events = ledger.query(LedgerQuery::default()).await?;
                let dag_ids = if let Some(dag_id) = dag_id {
                    vec![dag_id]
                } else {
                    collect_dag_ids(&events)
                };
                let active = active_wih_nodes(&events);
                if ready {
                    for dag_id in dag_ids {
                        let dag_events = events_for_dag(&events, &dag_id);
                        let dag = project_dag(&dag_events, &dag_id);
                        for node_id in ready_nodes(&dag) {
                            if active.contains_key(&node_id) {
                                continue;
                            }
                            if let Some(node) = dag.nodes.get(&node_id) {
                                println!("{dag_id} {node_id} {}", node.title);
                            }
                        }
                    }
                } else {
                    for (node_id, wih_id) in active {
                        println!("{wih_id} {node_id}");
                    }
                }
            }
            WihCmd::Pickup {
                dag_id,
                node_id,
                agent_id,
                role,
                fresh,
            } => {
                let wih_id = gate
                    .wih_pickup_with(
                        &dag_id,
                        &node_id,
                        &agent_id,
                        WihPickupOptions { role, fresh },
                    )
                    .await?;
                println!("wih_id: {wih_id}");
            }
            WihCmd::Context { wih_id } => {
                let events = ledger.query(LedgerQuery::default()).await?;
                if let Some(wih) = project_wih_from_events(&events, &wih_id) {
                    if let Some(path) = wih.context_pack_path {
                        let contents = std::fs::read_to_string(path)?;
                        println!("{contents}");
                    } else {
                        println!("context pack not found");
                    }
                } else {
                    println!("wih not found");
                }
            }
            WihCmd::SignOpen { wih_id, signature } => {
                gate.wih_sign_open(&wih_id, &signature).await?;
                println!("signed");
            }
            WihCmd::Close {
                wih_id,
                status,
                evidence,
            } => {
                gate.wih_close(&wih_id, &status, &evidence).await?;
                println!("closed");
            }
        },
        Commands::Lease(cmd) => match cmd {
            LeaseCmd::Request {
                wih_id,
                agent_id,
                paths,
                ttl,
            } => {
                let lease_id = gate.lease_request(&wih_id, &agent_id, paths, ttl).await?;
                println!("lease_id: {lease_id}");
            }
            LeaseCmd::Release { lease_id } => {
                lease_store.release(&lease_id).await?;
                println!("released");
            }
        },
        Commands::Ledger(cmd) => match cmd {
            LedgerCmd::Tail { n } => {
                let events = ledger.tail(n).await?;
                for evt in events {
                    println!("{}", serde_json::to_string(&evt)?);
                }
            }
            LedgerCmd::Trace {
                node_id,
                wih_id,
                prompt_id,
            } => {
                if node_id.is_none() && wih_id.is_none() && prompt_id.is_none() {
                    println!("trace requires --node-id, --wih-id, or --prompt-id");
                } else {
                    let events = ledger.query(LedgerQuery::default()).await?;
                    for evt in events.into_iter().filter(|evt| {
                        matches_trace(
                            evt,
                            node_id.as_deref(),
                            wih_id.as_deref(),
                            prompt_id.as_deref(),
                        )
                    }) {
                        println!("{}", serde_json::to_string_pretty(&evt)?);
                    }
                }
            }
        },
        Commands::Index(cmd) => match cmd {
            IndexCmd::Rebuild => {
                let count = index.rebuild_from_ledger(&ledger).await?;
                println!("indexed {count} events");
            }
        },
        Commands::Mail(cmd) => match cmd {
            MailCmd::EnsureThread { topic } => {
                let thread_id = mail.ensure_thread(&topic).await?;
                println!("thread_id: {thread_id}");
            }
            MailCmd::Send {
                thread_id,
                body_ref,
                attachments,
            } => {
                mail.send_message(&thread_id, &body_ref, attachments.clone())
                    .await?;
                let bus_payload = json!({
                    "thread_id": thread_id,
                    "body_ref": body_ref,
                    "attachments": attachments
                });
                let _ = bus
                    .send_message(NewBusMessage {
                        correlation_id: create_event_id(),
                        to: format!("mail:{}", thread_id),
                        from: "mail".to_string(),
                        kind: "mail_message".to_string(),
                        payload: bus_payload,
                        transport: "mail".to_string(),
                    })
                    .await;
                println!("sent");
            }
            MailCmd::RequestReview {
                thread_id,
                wih_id,
                diff_ref,
            } => {
                mail.request_review(&thread_id, &wih_id, &diff_ref).await?;
                println!("review requested");
            }
            MailCmd::Decide {
                thread_id,
                approve,
                reject,
                notes_ref,
            } => {
                let decision = if approve && !reject {
                    "approve"
                } else if reject && !approve {
                    "reject"
                } else {
                    println!("choose exactly one of --approve or --reject");
                    return Ok(());
                };
                mail.decide_review(&thread_id, decision, notes_ref).await?;
                println!("review decided");
            }
            MailCmd::Inbox { thread_id, limit } => {
                let events = mail.list_messages(thread_id.as_deref(), limit).await?;
                for evt in events {
                    println!("{}", serde_json::to_string_pretty(&evt)?);
                }
            }
            MailCmd::Ack {
                thread_id,
                message_id,
                note,
            } => {
                let ack_id = mail
                    .acknowledge_message(&thread_id, &message_id, note.as_deref())
                    .await?;
                println!("ack_id: {ack_id}");
            }
            MailCmd::Reserve {
                wih_id,
                agent_id,
                paths,
                ttl,
            } => {
                let lease_id = create_lease_id();
                let req = LeaseRequest {
                    lease_id: lease_id.clone(),
                    wih_id: wih_id.clone(),
                    agent_id: agent_id.clone(),
                    paths: paths.clone(),
                    requested_at: Utc::now().to_rfc3339(),
                    ttl_seconds: ttl,
                };
                lease_store.request(req).await?;
                let _ = mail
                    .log_event(
                        "MailLeaseRequested",
                        json!({
                            "lease_id": lease_id,
                            "wih_id": wih_id,
                            "agent_id": agent_id,
                            "paths": paths,
                            "ttl_seconds": ttl
                        }),
                    )
                    .await?;
                println!("lease_id: {lease_id}");
            }
            MailCmd::Release { lease_id } => {
                lease_store.release(&lease_id).await?;
                let _ = mail
                    .log_event("MailLeaseReleased", json!({ "lease_id": lease_id }))
                    .await?;
                println!("released");
            }
            MailCmd::Share {
                thread_id,
                asset_ref,
                note,
            } => {
                let share_id = mail
                    .share_asset(&thread_id, &asset_ref, note.as_deref())
                    .await?;
                println!("share_id: {share_id}");
            }
            MailCmd::Archive {
                thread_id,
                path,
                reason,
            } => {
                let archive_id = mail
                    .archive_thread(&thread_id, &path, reason.as_deref())
                    .await?;
                println!("archive_id: {archive_id}");
            }
            MailCmd::Guard { action, detail } => {
                let guard_id = mail.guard_action(&action, detail.as_deref()).await?;
                println!("guard_id: {guard_id}");
            }
        },
        Commands::Gate(cmd) => match cmd {
            GateCmd::Status => {
                println!("gate: ok");
            }
            GateCmd::Check {
                wih_id,
                tool,
                paths,
            } => {
                let res = gate.pre_tool(&wih_id, &tool, &paths).await?;
                println!("allowed: {}", res.allowed);
                if let Some(reason) = res.reason {
                    println!("reason: {reason}");
                }
            }
            GateCmd::Rules => {
                if let Some(contents) = read_spec("GATE_RULES.md") {
                    println!("{contents}");
                } else {
                    println!("gate rules not found");
                }
            }
            GateCmd::Verify { json } => {
                let events = ledger.query(LedgerQuery::default()).await?;
                let mut ok = true;
                let (chain_ok, chain_issues) = ledger.verify_chain().await?;
                if !chain_ok {
                    ok = false;
                }
                let mut cycle_dags = Vec::new();
                for dag_id in collect_dag_ids(&events) {
                    let dag_events = events_for_dag(&events, &dag_id);
                    let dag = project_dag(&dag_events, &dag_id);
                    if has_cycle_edges(&dag.edges) {
                        ok = false;
                        cycle_dags.push(dag_id);
                    }
                }
                if json {
                    let payload = serde_json::json!({
                        "ok": ok,
                        "ledger_chain_ok": chain_ok,
                        "ledger_chain_issues": chain_issues,
                        "cycle_dags": cycle_dags
                    });
                    println!("{}", serde_json::to_string_pretty(&payload)?);
                } else {
                    if !chain_ok {
                        println!("ledger chain failed: {:?}", chain_issues);
                    }
                    for dag_id in &cycle_dags {
                        println!("cycle detected in dag {dag_id}");
                    }
                    if ok {
                        println!("gate verify ok");
                    } else {
                        println!("gate verify failed");
                    }
                }
            }
            GateCmd::Decision {
                note,
                reason,
                links,
            } => {
                let decision_id = gate.record_agent_decision(&note, reason, links).await?;
                println!("decision_id: {decision_id}");
            }
            GateCmd::Mutate {
                dag_id,
                note,
                reason,
                mutations,
                mutations_json,
            } => {
                let mutations = load_mutations(mutations, mutations_json)?;
                let (decision_id, mutation_ids) = gate
                    .mutate_with_decision(&dag_id, &note, reason, mutations)
                    .await?;
                println!("decision_id: {decision_id}");
                for id in mutation_ids {
                    println!("mutation_id: {id}");
                }
            }
        },
        Commands::Vault(cmd) => match cmd {
            VaultCmd::Archive { wih_id } => {
                let path = vault.archive_wih(&wih_id).await?;
                println!("vaulted: {}", path.display());
            }
            VaultCmd::Status { json } => {
                let events = ledger.query(LedgerQuery::default()).await?;
                let mut created: HashMap<String, String> = HashMap::new();
                let mut completed: HashMap<String, String> = HashMap::new();
                for evt in &events {
                    if evt.r#type == "VaultJobCreated" {
                        if let Some(wih_id) = evt.payload.get("wih_id").and_then(|v| v.as_str()) {
                            created.insert(wih_id.to_string(), evt.ts.clone());
                        }
                    }
                    if evt.r#type == "VaultJobCompleted" {
                        if let Some(wih_id) = evt.payload.get("wih_id").and_then(|v| v.as_str()) {
                            completed.insert(wih_id.to_string(), evt.ts.clone());
                        }
                    }
                }
                if json {
                    let mut jobs = Vec::new();
                    for (wih_id, created_at) in &created {
                        jobs.push(serde_json::json!({
                            "wih_id": wih_id,
                            "created_at": created_at,
                            "completed_at": completed.get(wih_id),
                            "status": if completed.contains_key(wih_id) { "completed" } else { "pending" }
                        }));
                    }
                    for (wih_id, done_at) in &completed {
                        if !created.contains_key(wih_id) {
                            jobs.push(serde_json::json!({
                                "wih_id": wih_id,
                                "created_at": null,
                                "completed_at": done_at,
                                "status": "completed"
                            }));
                        }
                    }
                    let payload = serde_json::json!({ "jobs": jobs });
                    println!("{}", serde_json::to_string_pretty(&payload)?);
                } else {
                    for (wih_id, created_at) in &created {
                        if let Some(done_at) = completed.get(wih_id) {
                            println!("{wih_id} completed {done_at} (created {created_at})");
                        } else {
                            println!("{wih_id} pending (created {created_at})");
                        }
                    }
                    for (wih_id, done_at) in &completed {
                        if !created.contains_key(wih_id) {
                            println!("{wih_id} completed {done_at}");
                        }
                    }
                }
            }
        },
        Commands::Runner(cmd) => match cmd {
            RunnerCmd::Start => {
                start_runner(
                    &root,
                    ledger.clone(),
                    gate.clone(),
                    lease_store.clone(),
                    receipts.clone(),
                    index.clone(),
                    vault.clone(),
                    bus.clone(),
                    true,
                )
                .await?;
            }
            RunnerCmd::Once => {
                start_runner(
                    &root,
                    ledger.clone(),
                    gate.clone(),
                    lease_store.clone(),
                    receipts.clone(),
                    index.clone(),
                    vault.clone(),
                    bus.clone(),
                    false,
                )
                .await?;
            }
        },
        Commands::Bus(cmd) => match cmd {
            BusCmd::Send {
                to,
                from,
                kind,
                payload,
                transport,
                correlation_id,
            } => {
                let correlation = correlation_id.unwrap_or_else(|| create_event_id());
                let payload_value: Value =
                    serde_json::from_str(&payload).unwrap_or_else(|_| json!({ "text": payload }));
                let transport = transport.unwrap_or_else(|| "general".to_string());
                let msg = NewBusMessage {
                    correlation_id: correlation,
                    to,
                    from,
                    kind,
                    payload: payload_value,
                    transport,
                };
                let message_id = bus.send_message(msg).await?;
                println!("message_id: {message_id}");
            }
            BusCmd::Poll { limit } => {
                let entries = bus.poll_pending(limit).await?;
                for entry in entries {
                    println!("{}", serde_json::to_string_pretty(&entry)?);
                }
            }
            BusCmd::Deliver { message_id } => {
                bus.mark_delivered(message_id).await?;
                println!("delivered: {message_id}");
            }
            BusCmd::TmuxSend {
                session,
                command,
                pane,
                iteration,
                correlation_id,
            } => {
                let pane_name = pane.clone().unwrap_or_else(|| session.clone());
                let iteration_id = iteration.unwrap_or_else(|| "default".to_string());
                let mut state = load_transport_state(&root, &pane_name, &iteration_id)?;
                if state.busy {
                    bail!(
                        "tmux pane {} (iteration {}) is busy since {:?}",
                        pane_name,
                        iteration_id,
                        state.busy_since
                    );
                }
                state.busy = true;
                state.busy_since = Some(Utc::now().to_rfc3339());
                state.owner = Some("rails".to_string());
                state.iteration_id = Some(iteration_id.clone());
                persist_transport_state(&root, &pane_name, &iteration_id, &state)?;

                let correlation = correlation_id.unwrap_or_else(|| create_event_id());
                let mut payload = json!({
                    "session": session.clone(),
                    "command": command,
                    "context_iteration": iteration_id.clone(),
                });
                payload["pane"] = json!(pane_name.clone());
                let msg = NewBusMessage {
                    correlation_id: correlation,
                    to: format!("tmux:{}", pane_name),
                    from: "rails".to_string(),
                    kind: "tmux_command".to_string(),
                    payload,
                    transport: "tmux".to_string(),
                };
                let id = bus.send_message(msg).await?;
                println!("tmux message_id: {id}");
            }
            BusCmd::SocketSend {
                socket,
                payload,
                iteration,
                correlation_id,
            } => {
                let correlation = correlation_id.unwrap_or_else(|| create_event_id());
                let mut payload_value: Value = serde_json::from_str(&payload)
                    .unwrap_or_else(|_| json!({ "payload": payload }));
                let iteration_id = iteration
                    .clone()
                    .or_else(|| {
                        payload_value
                            .get("context_iteration")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                    })
                    .unwrap_or_else(|| "default".to_string());
                if let Some(map) = payload_value.as_object_mut() {
                    map.insert("context_iteration".to_string(), json!(iteration_id.clone()));
                }
                let mut state = load_socket_transport_state(&root, &socket, &iteration_id)?;
                if state.busy {
                    bail!(
                        "socket {} (iteration {}) is busy since {:?}",
                        socket,
                        iteration_id,
                        state.busy_since
                    );
                }
                state.busy = true;
                state.busy_since = Some(Utc::now().to_rfc3339());
                state.owner = Some("rails".to_string());
                state.iteration_id = Some(iteration_id.clone());
                persist_socket_transport_state(&root, &socket, &iteration_id, &state)?;
                let msg = NewBusMessage {
                    correlation_id: correlation,
                    to: format!("socket:{}", socket),
                    from: "rails".to_string(),
                    kind: "socket_message".to_string(),
                    payload: payload_value,
                    transport: "socket".to_string(),
                };
                let id = bus.send_message(msg).await?;
                println!("socket message_id: {id}");
            }
            BusCmd::TmuxRunner {
                session,
                pane,
                watch,
            } => {
                let pane_name = pane.unwrap_or_else(|| session.clone());
                run_tmux_transport(transport_root.clone(), bus.clone(), pane_name, watch).await?;
            }
            BusCmd::SocketRunner { socket, watch } => {
                run_socket_transport(
                    transport_root.clone(),
                    bus.clone(),
                    PathBuf::from(socket),
                    watch,
                )
                .await?;
            }
        },
        Commands::Transport(cmd) => match cmd {
            TransportCmd::TmuxInspect { session } => {
                inspect_tmux_transports(&root, session.as_deref())?;
            }
            TransportCmd::SocketInspect { socket } => {
                inspect_socket_transports(&root, socket.as_deref())?;
            }
        },
        Commands::Init => {
            init_system(&root, &ledger, &lease_store, &receipts, &index).await?;
        }
        Commands::Work(cmd) => run_work_command(&work_ctx, cmd).await?,
    }

    Ok(())
}

fn read_spec(name: &str) -> Option<String> {
    let crate_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let path = crate_root.join("spec").join(name);
    std::fs::read_to_string(path).ok()
}

async fn init_system(
    root: &PathBuf,
    _ledger: &Ledger,
    _leases: &Leases,
    _receipts: &ReceiptStore,
    _index: &Index,
) -> Result<()> {
    let dirs = [
        ".a2r/ledger/events",
        ".a2r/leases",
        ".a2r/receipts",
        ".a2r/blobs",
        ".a2r/index",
        ".a2r/mail/threads",
        ".a2r/vault",
        ".a2r/work/dags",
        ".a2r/wih",
        ".a2r/transports/tmux",
        ".a2r/transports/socket",
    ];
    for rel in dirs {
        ensure_dir(&root.join(rel))?;
    }

    println!("Initialized workspace stores:");
    println!(
        "  - Ledger JSONL events: {}",
        root.join(".a2r/ledger/events").display()
    );
    println!(
        "  - Leases SQLite: {}",
        root.join(".a2r/leases/leases.db").display()
    );
    println!(
        "  - Receipt store: {}",
        root.join(".a2r/receipts").display()
    );
    println!("  - Blob store: {}", root.join(".a2r/blobs").display());
    println!("  - Index DB: {}", root.join(".a2r/index").display());
    println!(
        "  - Mail threads: {}",
        root.join(".a2r/mail/threads").display()
    );
    println!("  - Vault root: {}", root.join(".a2r/vault").display());
    println!(
        "Ledger, leases, and receipts will automatically log events when you run the CLI commands."
    );
    Ok(())
}

#[derive(Deserialize, Serialize, Default)]
struct TransportState {
    last_message_id: Option<i64>,
    last_output: String,
    busy: bool,
    owner: Option<String>,
    busy_since: Option<String>,
    iteration_id: Option<String>,
}

async fn run_tmux_transport(
    root: Arc<PathBuf>,
    bus: Arc<Bus>,
    pane_name: String,
    watch: bool,
) -> Result<()> {
    let recipient = format!("tmux:{}", pane_name);
    loop {
        let pending = bus.poll_pending_for(&recipient, Some("tmux"), 5).await?;
        if pending.is_empty() {
            if !watch {
                break;
            }
            sleep(TokioDuration::from_secs(2)).await;
            continue;
        }

        for msg in pending {
            if let Some(command) = msg.payload.get("command").and_then(|v| v.as_str()) {
                let iteration_id = msg
                    .payload
                    .get("context_iteration")
                    .and_then(|v| v.as_str())
                    .unwrap_or("default")
                    .to_string();
                ensure_tmux_pane(&pane_name).await?;
                let root_path = root.as_ref();
                let mut state = load_transport_state(root_path, &pane_name, &iteration_id)?;
                let (status, output) = execute_tmux_command(&pane_name, command)
                    .await
                    .unwrap_or((None, "<tmux execution failed>".to_string()));
                let delta = output
                    .strip_prefix(&state.last_output)
                    .unwrap_or(&output)
                    .to_string();
                state.last_output = output.clone();
                state.busy = false;
                state.iteration_id = Some(iteration_id.clone());
                state.last_message_id = Some(msg.id);
                state.busy_since = None;
                state.owner = Some(msg.from.clone());
                persist_transport_state(root_path, &pane_name, &iteration_id, &state)?;
                let response = NewBusMessage {
                    correlation_id: msg.correlation_id.clone(),
                    to: msg.from.clone(),
                    from: "tmux-transport".to_string(),
                    kind: "tmux_response".to_string(),
                    payload: json!({
                        "session": pane_name.clone(),
                        "command": command,
                        "status": status,
                        "output": output,
                        "delta": delta,
                        "context_iteration": iteration_id,
                    }),
                    transport: "tmux".to_string(),
                };
                let _ = bus.send_message(response).await?;
            }
            bus.mark_delivered(msg.id).await?;
        }

        if !watch {
            break;
        }
    }
    Ok(())
}

async fn execute_tmux_command(session: &str, command: &str) -> Result<(Option<i32>, String)> {
    let status = Command::new("tmux")
        .arg("send-keys")
        .arg("-t")
        .arg(session)
        .arg(command)
        .arg("Enter")
        .status()
        .await?;

    let output = Command::new("tmux")
        .arg("capture-pane")
        .arg("-pt")
        .arg(session)
        .arg("-J")
        .output()
        .await?;

    let result = String::from_utf8_lossy(&output.stdout).to_string();
    Ok((status.code(), result))
}

async fn ensure_tmux_pane(pane: &str) -> Result<()> {
    let output = Command::new("tmux")
        .arg("list-windows")
        .arg("-F")
        .arg("#{window_name}")
        .output()
        .await?;
    let windows = String::from_utf8_lossy(&output.stdout);
    if !windows.lines().any(|line| line == pane) {
        Command::new("tmux")
            .arg("new-window")
            .arg("-n")
            .arg(pane)
            .status()
            .await?;
    }
    Ok(())
}

async fn run_socket_transport(
    root: Arc<PathBuf>,
    bus: Arc<Bus>,
    socket: PathBuf,
    watch: bool,
) -> Result<()> {
    let recipient = format!("socket:{}", socket.display());
    let root_path = root.as_ref();
    let socket_dir = root_path
        .join(".a2r")
        .join("transports")
        .join("socket")
        .join(socket.display().to_string());
    ensure_dir(&socket_dir)?;
    loop {
        let pending = bus.poll_pending_for(&recipient, Some("socket"), 5).await?;
        if pending.is_empty() {
            if !watch {
                break;
            }
            sleep(TokioDuration::from_secs(2)).await;
            continue;
        }

        for msg in pending {
            let iteration_id = msg
                .payload
                .get("context_iteration")
                .and_then(|v| v.as_str())
                .unwrap_or("default")
                .to_string();
            let socket_name = socket.display().to_string();
            let mut stream = UnixStream::connect(&socket).await?;
            let payload_text = serde_json::to_string(&msg.payload)?;
            stream.write_all(payload_text.as_bytes()).await?;
            stream.write_all(b"\n").await?;

            let mut reader = BufReader::new(stream);
            let mut response_text = String::new();
            reader.read_to_string(&mut response_text).await?;

            let response_payload: Value = serde_json::from_str(&response_text)
                .unwrap_or_else(|_| json!({ "raw": response_text }));
            let status = response_payload
                .get("status")
                .cloned()
                .unwrap_or(Value::Null);
            let stdout = response_payload
                .get("stdout")
                .cloned()
                .unwrap_or(Value::Null);
            let stderr = response_payload
                .get("stderr")
                .cloned()
                .unwrap_or(Value::Null);
            let response = NewBusMessage {
                correlation_id: msg.correlation_id.clone(),
                to: msg.from.clone(),
                from: "socket-transport".to_string(),
                kind: "socket_response".to_string(),
                payload: json!({
                    "socket": socket_name.clone(),
                    "context_iteration": iteration_id.clone(),
                    "status": status,
                    "stdout": stdout,
                    "stderr": stderr,
                    "response": response_payload
                }),
                transport: "socket".to_string(),
            };
            let _ = bus.send_message(response).await?;
            let mut state = load_socket_transport_state(root_path, &socket_name, &iteration_id)?;
            state.last_output = response_text.clone();
            state.busy = false;
            state.busy_since = None;
            state.owner = Some(msg.from.clone());
            state.iteration_id = Some(iteration_id.clone());
            state.last_message_id = Some(msg.id);
            persist_socket_transport_state(root_path, &socket_name, &iteration_id, &state)?;
            bus.mark_delivered(msg.id).await?;
        }

        if !watch {
            break;
        }
    }
    Ok(())
}

fn transport_state_dir(root: &Path, pane: &str, iteration: &str) -> PathBuf {
    root.join(".a2r")
        .join("transports")
        .join("tmux")
        .join(pane)
        .join(iteration)
}

fn load_transport_state(root: &Path, pane: &str, iteration: &str) -> Result<TransportState> {
    let dir = transport_state_dir(root, pane, iteration);
    if let Ok(raw) = std::fs::read_to_string(dir.join("state.json")) {
        serde_json::from_str(&raw).map_err(|err| err.into())
    } else {
        Ok(TransportState::default())
    }
}

fn persist_transport_state(
    root: &Path,
    pane: &str,
    iteration: &str,
    state: &TransportState,
) -> Result<()> {
    let dir = transport_state_dir(root, pane, iteration);
    ensure_dir(&dir)?;
    let path = dir.join("state.json");
    write_json_atomic(&path, state)?;
    Ok(())
}

fn socket_transport_state_dir(root: &Path, socket: &str, iteration: &str) -> PathBuf {
    root.join(".a2r")
        .join("transports")
        .join("socket")
        .join(socket)
        .join(iteration)
}

fn load_socket_transport_state(
    root: &Path,
    socket: &str,
    iteration: &str,
) -> Result<TransportState> {
    let dir = socket_transport_state_dir(root, socket, iteration);
    if let Ok(raw) = std::fs::read_to_string(dir.join("state.json")) {
        serde_json::from_str(&raw).map_err(|err| err.into())
    } else {
        Ok(TransportState::default())
    }
}

fn persist_socket_transport_state(
    root: &Path,
    socket: &str,
    iteration: &str,
    state: &TransportState,
) -> Result<()> {
    let dir = socket_transport_state_dir(root, socket, iteration);
    ensure_dir(&dir)?;
    let path = dir.join("state.json");
    write_json_atomic(&path, state)?;
    Ok(())
}

fn inspect_tmux_transports(root: &Path, session: Option<&str>) -> Result<()> {
    let base = root.join(".a2r").join("transports").join("tmux");
    if !base.exists() {
        println!("No tmux transport contexts found.");
        return Ok(());
    }
    for pane_entry in fs::read_dir(&base)? {
        let pane_entry = pane_entry?;
        if !pane_entry.file_type()?.is_dir() {
            continue;
        }
        let pane_name = pane_entry.file_name().to_string_lossy().to_string();
        if let Some(filter) = session {
            if filter != pane_name {
                continue;
            }
        }
        println!("Pane: {}", pane_name);
        for iteration_entry in fs::read_dir(pane_entry.path())? {
            let iteration_entry = iteration_entry?;
            if !iteration_entry.file_type()?.is_dir() {
                continue;
            }
            let iteration_name = iteration_entry.file_name().to_string_lossy().to_string();
            match load_transport_state(root, &pane_name, &iteration_name) {
                Ok(state) => {
                    print_state_summary("  ", &iteration_name, &state);
                }
                Err(err) => {
                    println!(
                        "  Iteration: {} (failed to read state: {})",
                        iteration_name, err
                    );
                }
            }
        }
    }
    Ok(())
}

fn inspect_socket_transports(root: &Path, socket_filter: Option<&str>) -> Result<()> {
    let base = root.join(".a2r").join("transports").join("socket");
    if !base.exists() {
        println!("No socket transport contexts found.");
        return Ok(());
    }
    for socket_entry in fs::read_dir(&base)? {
        let socket_entry = socket_entry?;
        if !socket_entry.file_type()?.is_dir() {
            continue;
        }
        let socket_name = socket_entry.file_name().to_string_lossy().to_string();
        if let Some(filter) = socket_filter {
            if filter != socket_name {
                continue;
            }
        }
        println!("Socket: {}", socket_name);
        for iteration_entry in fs::read_dir(socket_entry.path())? {
            let iteration_entry = iteration_entry?;
            if !iteration_entry.file_type()?.is_dir() {
                continue;
            }
            let iteration_name = iteration_entry.file_name().to_string_lossy().to_string();
            match load_socket_transport_state(root, &socket_name, &iteration_name) {
                Ok(state) => {
                    print_state_summary("  ", &iteration_name, &state);
                }
                Err(err) => {
                    println!(
                        "  Iteration: {} (failed to read state: {})",
                        iteration_name, err
                    );
                }
            }
        }
    }
    Ok(())
}

fn print_state_summary(prefix: &str, iteration: &str, state: &TransportState) {
    println!("{prefix}Iteration: {iteration}");
    println!(
        "{prefix}  busy: {} since {:?}",
        state.busy, state.busy_since
    );
    println!("{prefix}  owner: {:?}", state.owner);
    println!("{prefix}  last_message_id: {:?}", state.last_message_id);
    println!(
        "{prefix}  last_output: {}",
        preview_output(&state.last_output, 80)
    );
}

fn preview_output(text: &str, limit: usize) -> String {
    if text.len() <= limit {
        text.to_string()
    } else {
        format!("{}…", &text[..limit])
    }
}

async fn start_runner(
    root: &PathBuf,
    ledger: Arc<Ledger>,
    gate: Arc<Gate>,
    lease_store: Arc<Leases>,
    _receipts: Arc<ReceiptStore>,
    index: Arc<Index>,
    vault: Arc<Vault>,
    bus: Arc<Bus>,
    persistent: bool,
) -> Result<()> {
    let meta_dir = root.join(".a2r/meta");
    ensure_dir(&meta_dir)?;
    let state_path = meta_dir.join("rails_runner_state.json");
    let mut state = RunnerState::load(&state_path)?;

    loop {
        process_runner_events(
            root,
            &ledger,
            &vault,
            &lease_store,
            &index,
            &gate,
            &bus,
            &mut state,
            &state_path,
        )
        .await?;

        if !persistent {
            break;
        }
        sleep(TokioDuration::from_secs(5)).await;
    }
    Ok(())
}

#[derive(Default, Serialize, Deserialize)]
struct RunnerState {
    #[serde(default)]
    processed: HashSet<String>,
    cursor: Option<String>,
    #[serde(default)]
    loop_progress: HashMap<String, LoopProgress>,
}

#[derive(Clone, Serialize, Deserialize, Default)]
struct LoopProgress {
    last_iteration: u32,
    in_progress: bool,
    last_started_event_id: Option<String>,
    last_started_at: Option<String>,
    last_completed_event_id: Option<String>,
    last_completed_at: Option<String>,
    last_outcome: Option<String>,
    escalated: bool,
    spawn_requests: Vec<u32>,
    last_spawned_at: Option<String>,
}

impl RunnerState {
    fn load(path: &Path) -> Result<Self> {
        if path.exists() {
            let raw = std::fs::read_to_string(path)?;
            Ok(serde_json::from_str(&raw).unwrap_or_default())
        } else {
            Ok(RunnerState::default())
        }
    }

    fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            ensure_dir(parent)?;
        }
        write_json_atomic(path, self)?;
        Ok(())
    }
}

async fn process_runner_events(
    root: &Path,
    ledger: &Ledger,
    vault: &Vault,
    leases: &Leases,
    index: &Index,
    gate: &Gate,
    bus: &Bus,
    state: &mut RunnerState,
    state_path: &Path,
) -> Result<()> {
    let events = ledger.query(LedgerQuery::default()).await?;
    for evt in &events {
        if state.processed.contains(&evt.event_id) {
            continue;
        }
        if evt.r#type == "WIHClosedSigned" {
            if let Some(wih_id) = evt.payload.get("wih_id").and_then(|v| v.as_str()) {
                handle_wih_closed(vault, leases, index, ledger, wih_id).await?;
            }
        }
        state.processed.insert(evt.event_id.clone());
        state.cursor = Some(evt.event_id.clone());
        state.save(state_path)?;
    }
    process_loop_iterations(root, ledger, gate, &events, state, state_path).await?;
    process_bus_queue(ledger, bus).await?;
    Ok(())
}

async fn handle_wih_closed(
    vault: &Vault,
    leases: &Leases,
    index: &Index,
    ledger: &Ledger,
    wih_id: &str,
) -> Result<()> {
    println!("Autopipeline: vaulting {}", wih_id);
    let start_event = A2REvent {
        event_id: create_event_id(),
        ts: Utc::now().to_rfc3339(),
        actor: Actor {
            r#type: ActorType::Gate,
            id: "rails-runner".to_string(),
        },
        scope: None,
        r#type: "VaultArchiveStarted".to_string(),
        payload: json!({ "wih_id": wih_id }),
        provenance: None,
    };
    ledger.append(start_event).await?;
    let path = vault.archive_wih(wih_id).await?;
    println!("Autopipeline: vaulted {} -> {}", wih_id, path.display());
    let completed_event = A2REvent {
        event_id: create_event_id(),
        ts: Utc::now().to_rfc3339(),
        actor: Actor {
            r#type: ActorType::Gate,
            id: "rails-runner".to_string(),
        },
        scope: None,
        r#type: "VaultArchiveCompleted".to_string(),
        payload: json!({ "wih_id": wih_id, "path": path.to_string_lossy() }),
        provenance: None,
    };
    ledger.append(completed_event).await?;
    let released = leases.release_for_wih(wih_id).await?;
    if !released.is_empty() {
        println!("Autopipeline: released leases {:?}", released);
    }
    let count = index.rebuild_from_ledger(ledger).await?;
    println!("Autopipeline: index rebuild touched {count} events");
    Ok(())
}

async fn process_loop_iterations(
    root: &Path,
    ledger: &Ledger,
    gate: &Gate,
    events: &[A2REvent],
    state: &mut RunnerState,
    state_path: &Path,
) -> Result<()> {
    let active_wihs = collect_active_wih_ids(events);
    for wih_id in active_wihs {
        if is_wih_closed(events, &wih_id) {
            state.loop_progress.remove(&wih_id);
            continue;
        }
        let policy = loop_policy_from_events(events, &wih_id);
        let progress = state.loop_progress.entry(wih_id.clone()).or_default();
        if progress.escalated {
            continue;
        }

        if progress.in_progress {
            if let Some(started_at) = &progress.last_started_at {
                let receipts = collect_receipts_after(events, &wih_id, started_at);
                if evidence_satisfied(receipts.len(), &policy)
                    && acceptance_refs_satisfied(events, &wih_id, &policy.acceptance_refs)
                {
                    let completed_event_id = emit_loop_completed(
                        ledger,
                        &wih_id,
                        progress.last_iteration,
                        "accepted",
                        receipts.len(),
                        !policy.acceptance_refs.is_empty(),
                    )
                    .await?;
                    progress.in_progress = false;
                    progress.last_completed_event_id = Some(completed_event_id);
                    progress.last_completed_at = Some(Utc::now().to_rfc3339());
                    progress.last_outcome = Some("accepted".to_string());
                    gate.turn_closeout(&wih_id).await?;
                    state.save(state_path)?;
                }
            }
            continue;
        }

        if progress.last_iteration >= policy.max_iterations {
            if policy.escalate_on_max_iterations && !progress.escalated {
                let _ = emit_loop_escalated(
                    ledger,
                    &wih_id,
                    progress.last_iteration,
                    "max_iterations reached",
                )
                .await?;
                progress.escalated = true;
                progress.last_outcome = Some("max_iterations reached".to_string());
                state.save(state_path)?;
            }
            continue;
        }

        if should_spawn_subagent(&progress, &policy) {
            let next_iter = progress.last_iteration + 1;
            ensure_loop_policy_injected(root, ledger, &wih_id, next_iter).await?;
            let _spawn_event = emit_loop_spawn_requested(ledger, &wih_id, next_iter).await?;
            let event_id = emit_loop_started(ledger, &wih_id, next_iter, &policy).await?;
            progress.spawn_requests.push(next_iter);
            progress.last_spawned_at = Some(Utc::now().to_rfc3339());
            progress.last_iteration = next_iter;
            progress.in_progress = true;
            progress.last_started_event_id = Some(event_id.clone());
            progress.last_started_at = Some(Utc::now().to_rfc3339());
            progress.last_completed_event_id = None;
            progress.last_completed_at = None;
            progress.last_outcome = Some("spawn_requested".to_string());
            state.save(state_path)?;
            continue;
        }

        let next_iter = progress.last_iteration + 1;
        ensure_loop_policy_injected(root, ledger, &wih_id, next_iter).await?;
        let event_id = emit_loop_started(ledger, &wih_id, next_iter, &policy).await?;
        progress.last_iteration = next_iter;
        progress.in_progress = true;
        progress.last_started_event_id = Some(event_id.clone());
        progress.last_started_at = Some(Utc::now().to_rfc3339());
        progress.last_completed_event_id = None;
        progress.last_completed_at = None;
        progress.last_outcome = Some("iteration_started".to_string());
        state.save(state_path)?;
    }
    Ok(())
}

fn collect_active_wih_ids(events: &[A2REvent]) -> Vec<String> {
    let mut created = HashSet::new();
    let mut closed = HashSet::new();
    for evt in events {
        if let Some(wih_id) = evt.payload.get("wih_id").and_then(|v| v.as_str()) {
            match evt.r#type.as_str() {
                "WIHCreated" => {
                    created.insert(wih_id.to_string());
                }
                "WIHClosedSigned" | "WIHArchived" => {
                    closed.insert(wih_id.to_string());
                }
                _ => {}
            }
        }
    }
    created
        .into_iter()
        .filter(|id| !closed.contains(id))
        .collect()
}

fn is_wih_closed(events: &[A2REvent], wih_id: &str) -> bool {
    events.iter().any(|evt| {
        evt.payload.get("wih_id").and_then(|v| v.as_str()) == Some(wih_id)
            && (evt.r#type == "WIHClosedSigned" || evt.r#type == "WIHArchived")
    })
}

fn loop_policy_from_events(events: &[A2REvent], wih_id: &str) -> LoopPolicy {
    for evt in events.iter().rev() {
        if evt.r#type != "WIHCreated" {
            continue;
        }
        if evt.payload.get("wih_id").and_then(|v| v.as_str()) != Some(wih_id) {
            continue;
        }
        if let Some(policy_value) = evt.payload.get("policy").and_then(|p| p.get("loop_policy")) {
            if let Ok(policy) = serde_json::from_value::<LoopPolicy>(policy_value.clone()) {
                return policy;
            }
        }
    }
    LoopPolicy::default()
}

async fn emit_loop_started(
    ledger: &Ledger,
    wih_id: &str,
    iteration: u32,
    policy: &LoopPolicy,
) -> Result<String> {
    let payload = json!({
        "wih_id": wih_id,
        "iteration": iteration,
        "started_at": Utc::now().to_rfc3339(),
        "policy": serde_json::to_value(policy).unwrap_or_else(|_| json!({}))
    });
    let event = A2REvent {
        event_id: create_event_id(),
        ts: Utc::now().to_rfc3339(),
        actor: Actor {
            r#type: ActorType::Gate,
            id: "rails-runner".to_string(),
        },
        scope: Some(EventScope {
            wih_id: Some(wih_id.to_string()),
            ..Default::default()
        }),
        r#type: "RailsLoopIterationStarted".to_string(),
        payload,
        provenance: None,
    };
    ledger.append(event).await
}

async fn emit_loop_completed(
    ledger: &Ledger,
    wih_id: &str,
    iteration: u32,
    outcome: &str,
    evidence_count: usize,
    acceptance_triggered: bool,
) -> Result<String> {
    let payload = json!({
        "wih_id": wih_id,
        "iteration": iteration,
        "completed_at": Utc::now().to_rfc3339(),
        "outcome": outcome,
        "evidence_count": evidence_count,
        "acceptance_refs": acceptance_triggered
    });
    let event = A2REvent {
        event_id: create_event_id(),
        ts: Utc::now().to_rfc3339(),
        actor: Actor {
            r#type: ActorType::Gate,
            id: "rails-runner".to_string(),
        },
        scope: Some(EventScope {
            wih_id: Some(wih_id.to_string()),
            ..Default::default()
        }),
        r#type: "RailsLoopIterationCompleted".to_string(),
        payload,
        provenance: None,
    };
    ledger.append(event).await
}

async fn emit_loop_spawn_requested(
    ledger: &Ledger,
    wih_id: &str,
    iteration: u32,
) -> Result<String> {
    let payload = json!({
        "wih_id": wih_id,
        "iteration": iteration,
        "requested_at": Utc::now().to_rfc3339(),
    });
    let event = A2REvent {
        event_id: create_event_id(),
        ts: Utc::now().to_rfc3339(),
        actor: Actor {
            r#type: ActorType::Gate,
            id: "rails-runner".to_string(),
        },
        scope: Some(EventScope {
            wih_id: Some(wih_id.to_string()),
            ..Default::default()
        }),
        r#type: "RailsLoopIterationSpawnRequested".to_string(),
        payload,
        provenance: None,
    };
    ledger.append(event).await
}

fn collect_receipts_after(events: &[A2REvent], wih_id: &str, since: &str) -> Vec<String> {
    let since_ts = parse_ts(since);
    events
        .iter()
        .filter(|evt| evt.r#type == "ReceiptWritten")
        .filter(|evt| evt.payload.get("wih_id").and_then(|v| v.as_str()) == Some(wih_id))
        .filter(|evt| {
            if let Some(ts) = parse_ts(&evt.ts) {
                if let Some(threshold) = since_ts {
                    return ts > threshold;
                }
            }
            since_ts.is_none()
        })
        .filter_map(|evt| {
            evt.payload
                .get("receipt_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .collect()
}

fn collect_all_receipts_for_wih(events: &[A2REvent], wih_id: &str) -> Vec<String> {
    events
        .iter()
        .filter(|evt| evt.r#type == "ReceiptWritten")
        .filter(|evt| evt.payload.get("wih_id").and_then(|v| v.as_str()) == Some(wih_id))
        .filter_map(|evt| {
            evt.payload
                .get("receipt_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .collect()
}

fn parse_ts(ts: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(ts)
        .map(|dt| dt.with_timezone(&Utc))
        .ok()
}

fn evidence_satisfied(receipts_count: usize, policy: &LoopPolicy) -> bool {
    if policy.required_evidence.is_empty() {
        return true;
    }
    for requirement in &policy.required_evidence {
        match requirement.as_str() {
            "receipt.tool_calls" => {
                if receipts_count == 0 {
                    return false;
                }
            }
            _ => {
                // Unknown evidence requirement is currently treated as satisfied for forward evolution.
            }
        }
    }
    true
}

fn acceptance_refs_satisfied(events: &[A2REvent], wih_id: &str, refs: &[String]) -> bool {
    if refs.is_empty() {
        return true;
    }
    let receipts = collect_all_receipts_for_wih(events, wih_id);
    let available: HashSet<_> = receipts.into_iter().collect();
    refs.iter().all(|r| available.contains(r))
}

async fn ensure_loop_policy_injected(
    root: &Path,
    ledger: &Ledger,
    wih_id: &str,
    iteration: u32,
) -> Result<()> {
    let scope = EventScope {
        wih_id: Some(wih_id.to_string()),
        run_id: Some(format!("{}-iter-{}", wih_id, iteration)),
        ..Default::default()
    };
    policy::ensure_injected(root, ledger, Some(scope), "rails-runner").await
}

async fn process_bus_queue(ledger: &Ledger, bus: &Bus) -> Result<()> {
    let pending = bus.poll_pending(32).await?;
    for entry in pending {
        let _ = log_bus_message(ledger, &entry).await?;
        bus.mark_delivered(entry.id).await?;
    }
    Ok(())
}

async fn log_bus_message(ledger: &Ledger, message: &BusMessage) -> Result<String> {
    let scope = derive_scope_from_payload(&message.payload);
    let payload = json!({
        "message_id": message.id,
        "correlation_id": message.correlation_id,
        "to": message.to,
        "from": message.from,
        "kind": message.kind,
        "transport": message.transport,
        "status": message.status,
        "created_at": message.created_at,
        "payload": message.payload
    });
    let event = A2REvent {
        event_id: create_event_id(),
        ts: Utc::now().to_rfc3339(),
        actor: Actor {
            r#type: ActorType::Gate,
            id: "rails-runner".to_string(),
        },
        scope: Some(scope),
        r#type: "BusMessageProcessed".to_string(),
        payload,
        provenance: None,
    };
    ledger.append(event).await
}

fn derive_scope_from_payload(payload: &Value) -> EventScope {
    let mut scope = EventScope::default();
    if let Some(wih_id) = payload.get("wih_id").and_then(|v| v.as_str()) {
        scope.wih_id = Some(wih_id.to_string());
    }
    if let Some(dag_id) = payload.get("dag_id").and_then(|v| v.as_str()) {
        scope.dag_id = Some(dag_id.to_string());
    }
    scope
}

fn should_spawn_subagent(progress: &LoopProgress, policy: &LoopPolicy) -> bool {
    if policy.spawn_on.is_empty() {
        return false;
    }
    if let Some(spawn_delay) = policy.spawn_delay_secs {
        if let Some(last_spawned) = &progress.last_spawned_at {
            if let Ok(prev) = DateTime::parse_from_rfc3339(last_spawned) {
                if (Utc::now() - prev.with_timezone(&Utc))
                    < ChronoDuration::seconds(spawn_delay as i64)
                {
                    return false;
                }
            }
        }
    }
    progress.spawn_requests.len() < policy.max_iterations as usize
}

async fn emit_loop_escalated(
    ledger: &Ledger,
    wih_id: &str,
    iteration: u32,
    reason: &str,
) -> Result<String> {
    let payload = json!({
        "wih_id": wih_id,
        "iteration": iteration,
        "reason": reason,
        "escalated_at": Utc::now().to_rfc3339()
    });
    let event = A2REvent {
        event_id: create_event_id(),
        ts: Utc::now().to_rfc3339(),
        actor: Actor {
            r#type: ActorType::Gate,
            id: "rails-runner".to_string(),
        },
        scope: Some(EventScope {
            wih_id: Some(wih_id.to_string()),
            ..Default::default()
        }),
        r#type: "RailsLoopIterationEscalated".to_string(),
        payload,
        provenance: None,
    };
    ledger.append(event).await
}

async fn resolve_dag(ledger: &Ledger, root: &Path, dag_id: &str) -> Result<DagState> {
    if let Some(dag) = load_dag_view(root, dag_id) {
        return Ok(dag);
    }
    let events = ledger.query(LedgerQuery::default()).await?;
    let dag_events = events_for_dag(&events, dag_id);
    Ok(project_dag(&dag_events, dag_id))
}

fn load_dag_view(root: &Path, dag_id: &str) -> Option<DagState> {
    let path = root
        .join(".a2r/work/dags")
        .join(dag_id)
        .join("view")
        .join("dag.current.json");
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn render_dag_markdown(dag: &DagState) -> String {
    let mut out = String::new();
    out.push_str(&format!("# DAG {}\n", dag.dag_id));
    out.push_str("Nodes:\n");
    let mut nodes: Vec<_> = dag.nodes.values().collect();
    nodes.sort_by(|a, b| a.node_id.cmp(&b.node_id));
    for node in nodes {
        out.push_str(&format!(
            "- {} [{}] {}\n",
            node.node_id, node.status, node.title
        ));
    }
    out.push_str("Edges (blocked_by):\n");
    for edge in dag.edges.iter().filter(|e| e.edge_type == "blocked_by") {
        out.push_str(&format!("- {} -> {}\n", edge.from_node_id, edge.to_node_id));
    }
    if !dag.relations.is_empty() {
        out.push_str("Relations:\n");
        for rel in &dag.relations {
            if let Some(note) = &rel.note {
                out.push_str(&format!("- {} ~ {} ({})\n", rel.a, rel.b, note));
            } else {
                out.push_str(&format!("- {} ~ {}\n", rel.a, rel.b));
            }
        }
    }
    out
}

fn collect_dag_ids(events: &[A2REvent]) -> Vec<String> {
    let mut dag_ids = HashSet::new();
    for evt in events {
        if let Some(dag_id) = evt.payload.get("dag_id").and_then(|v| v.as_str()) {
            dag_ids.insert(dag_id.to_string());
        }
        if evt.r#type == "DagCreated" {
            if let Some(dag_id) = evt.payload.get("dag_id").and_then(|v| v.as_str()) {
                dag_ids.insert(dag_id.to_string());
            }
        }
    }
    let mut out: Vec<String> = dag_ids.into_iter().collect();
    out.sort();
    out
}

fn events_for_dag(events: &[A2REvent], dag_id: &str) -> Vec<A2REvent> {
    events
        .iter()
        .filter(|evt| evt.payload.get("dag_id").and_then(|v| v.as_str()) == Some(dag_id))
        .cloned()
        .collect()
}

fn active_wih_nodes(events: &[A2REvent]) -> HashMap<String, String> {
    let mut wih_nodes: HashMap<String, String> = HashMap::new();
    let mut closed: HashSet<String> = HashSet::new();
    for evt in events {
        if evt.r#type == "WIHCreated" {
            if let (Some(wih_id), Some(node_id)) = (
                evt.payload.get("wih_id").and_then(|v| v.as_str()),
                evt.payload.get("node_id").and_then(|v| v.as_str()),
            ) {
                wih_nodes.insert(wih_id.to_string(), node_id.to_string());
            }
        }
        if evt.r#type == "WIHClosedSigned" || evt.r#type == "WIHArchived" {
            if let Some(wih_id) = evt.payload.get("wih_id").and_then(|v| v.as_str()) {
                closed.insert(wih_id.to_string());
            }
        }
    }
    let mut active = HashMap::new();
    for (wih_id, node_id) in wih_nodes {
        if !closed.contains(&wih_id) {
            active.insert(node_id, wih_id);
        }
    }
    active
}

fn matches_trace(
    event: &A2REvent,
    node_id: Option<&str>,
    wih_id: Option<&str>,
    prompt_id: Option<&str>,
) -> bool {
    if let Some(node_id) = node_id {
        let payload = &event.payload;
        let hits = [
            payload.get("node_id"),
            payload.get("from_node_id"),
            payload.get("to_node_id"),
            payload.get("parent_node_id"),
            payload.get("a"),
            payload.get("b"),
        ]
        .iter()
        .filter_map(|v| v.and_then(|val| val.as_str()))
        .any(|val| val == node_id);
        if !hits {
            return false;
        }
    }
    if let Some(wih_id) = wih_id {
        let payload = &event.payload;
        let hits = payload.get("wih_id").and_then(|v| v.as_str()) == Some(wih_id);
        if !hits {
            return false;
        }
    }
    if let Some(prompt_id) = prompt_id {
        let payload_match =
            event.payload.get("prompt_id").and_then(|v| v.as_str()) == Some(prompt_id);
        let provenance_match = event
            .provenance
            .as_ref()
            .and_then(|p| p.prompt_id.as_deref())
            == Some(prompt_id);
        if !payload_match && !provenance_match {
            return false;
        }
    }
    true
}

fn project_wih_from_events(
    events: &[A2REvent],
    wih_id: &str,
) -> Option<a2r_agent_system_rails::wih::types::WihState> {
    let filtered: Vec<A2REvent> = events
        .iter()
        .filter(|evt| evt.payload.get("wih_id").and_then(|v| v.as_str()) == Some(wih_id))
        .cloned()
        .collect();
    project_wih(&filtered, wih_id)
}

fn load_mutations(path: Option<PathBuf>, json_inline: Option<String>) -> Result<Vec<DagMutation>> {
    if path.is_some() && json_inline.is_some() {
        anyhow::bail!("use either --mutations or --mutations-json, not both");
    }
    if let Some(path) = path {
        let raw = std::fs::read_to_string(path)?;
        let mutations: Vec<DagMutation> = serde_json::from_str(&raw)?;
        return Ok(mutations);
    }
    if let Some(raw) = json_inline {
        let mutations: Vec<DagMutation> = serde_json::from_str(&raw)?;
        return Ok(mutations);
    }
    Ok(Vec::new())
}

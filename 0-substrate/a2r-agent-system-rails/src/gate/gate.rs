use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{anyhow, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::core::ids::{create_event_id, create_lease_id, create_receipt_id};
use crate::core::io::{ensure_dir, write_json_atomic};
use crate::core::types::{
    A2REvent, Actor, ActorType, EventScope, LeaseRequest, LedgerQuery, ReceiptRecord,
};
use crate::index::Index;
use crate::leases::Leases;
use crate::ledger::Ledger;
use crate::policy;
use crate::projections::views::{write_dag_view, write_prompt_view, write_wih_view};
use crate::prompt::project_prompt;
use crate::receipts::ReceiptStore;
use crate::vault::Vault;
use crate::wih::projection::project_wih;
use crate::wih::types::LoopPolicy;
use crate::work::graph::would_create_cycle;
use crate::work::projection::project_dag;
use crate::work::types::{DagEdge, DagNode, DagRelation, DagState};

#[derive(Clone)]
pub struct GateOptions {
    pub ledger: Arc<Ledger>,
    pub leases: Arc<Leases>,
    pub receipts: Arc<ReceiptStore>,
    pub index: Option<Arc<Index>>,
    pub vault: Option<Arc<Vault>>,
    pub root_dir: Option<PathBuf>,
    pub actor_id: Option<String>,
    pub strict_provenance: Option<bool>,
}

pub struct Gate {
    ledger: Arc<Ledger>,
    leases: Arc<Leases>,
    receipts: Arc<ReceiptStore>,
    index: Option<Arc<Index>>,
    vault: Option<Arc<Vault>>,
    root_dir: PathBuf,
    actor_id: String,
    strict_provenance: bool,
}

#[derive(Debug)]
pub struct GateResult {
    pub allowed: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct WihPickupOptions {
    pub role: Option<String>,
    pub fresh: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MutationProvenance {
    pub prompt_id: Option<String>,
    pub delta_id: Option<String>,
    pub agent_decision_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct DagSlice {
    nodes: Vec<DagNode>,
    edges: Vec<DagEdge>,
    relations: Vec<DagRelation>,
}

#[derive(Debug, Clone, Serialize)]
struct ContextReceipt {
    receipt_id: String,
    wih_id: String,
    node_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct ContextPack {
    version: String,
    generated_at: String,
    wih_id: String,
    dag_id: String,
    node_id: String,
    execution_mode: String,
    prompt: Option<crate::prompt::PromptTimeline>,
    dag_slice: DagSlice,
    dependency_nodes: Vec<String>,
    receipts: Vec<ContextReceipt>,
}

impl Gate {
    pub fn new(opts: GateOptions) -> Self {
        Self {
            ledger: opts.ledger,
            leases: opts.leases,
            receipts: opts.receipts,
            index: opts.index,
            vault: opts.vault,
            root_dir: opts
                .root_dir
                .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR"))),
            actor_id: opts.actor_id.unwrap_or_else(|| "gate".to_string()),
            strict_provenance: opts.strict_provenance.unwrap_or(true),
        }
    }

    pub async fn plan_new(
        &self,
        raw_text: &str,
        project_id: Option<String>,
    ) -> Result<(String, String, String)> {
        self.ensure_policy_scope(&EventScope::default()).await?;
        let prompt_id = format!("p_{}", rand::random::<u32>() % 1_000_000);
        let dag_id = format!("dag_{}", rand::random::<u32>() % 1_000_000);
        let node_id = format!("n_{}", rand::random::<u32>() % 10_000);
        let delta_id = format!("d_{}", rand::random::<u32>() % 1_000_000);

        let prompt_event = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: project_id
                .clone()
                .map(|pid| crate::core::types::EventScope {
                    project_id: Some(pid),
                    ..Default::default()
                }),
            r#type: "PromptCreated".to_string(),
            payload: json!({
                "prompt_id": prompt_id,
                "source": "cli",
                "raw_text": raw_text
            }),
            provenance: None,
        };
        self.emit(prompt_event).await?;

        let mutation_prov = MutationProvenance {
            prompt_id: Some(prompt_id.clone()),
            delta_id: Some(delta_id.clone()),
            agent_decision_id: None,
        };
        self.ensure_mutation_provenance(&mutation_prov)?;
        let dag_created = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "DagCreated".to_string(),
            payload: json!({ "dag_id": dag_id }),
            provenance: Some(self.provenance_from(&mutation_prov)),
        };
        let dag_created_id = dag_created.event_id.clone();
        self.emit(dag_created).await?;

        let node_created = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "DagNodeCreated".to_string(),
            payload: json!({
                "node_id": node_id,
                "dag_id": dag_id,
                "node_kind": "task",
                "title": raw_text.chars().take(120).collect::<String>(),
                "execution_mode": "shared"
            }),
            provenance: Some(self.provenance_from(&mutation_prov)),
        };
        let node_created_id = node_created.event_id.clone();
        self.emit(node_created).await?;

        let delta_event = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "PromptDeltaAppended".to_string(),
            payload: json!({
                "prompt_id": prompt_id,
                "delta_id": delta_id,
                "author": "user",
                "category": "initial",
                "delta_text": raw_text,
                "valid_at": Utc::now().to_rfc3339(),
                "links": { "mutations": [dag_created_id, node_created_id] }
            }),
            provenance: None,
        };
        self.emit(delta_event).await?;

        let link = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "PromptLinkedToWork".to_string(),
            payload: json!({ "prompt_id": prompt_id, "dag_id": dag_id }),
            provenance: None,
        };
        self.emit(link).await?;

        self.refresh_dag_view(&dag_id).await?;
        self.refresh_prompt_view(&prompt_id).await?;

        Ok((prompt_id, dag_id, node_id))
    }

    pub async fn plan_refine(
        &self,
        dag_id: &str,
        delta_text: &str,
        author: &str,
        mutations: Vec<DagMutation>,
    ) -> Result<String> {
        let dag_scope = EventScope {
            dag_id: Some(dag_id.to_string()),
            ..Default::default()
        };
        self.ensure_policy_scope(&dag_scope).await?;
        let prompt_id = self.resolve_prompt_id(dag_id).await?;
        let delta_id = format!("d_{}", rand::random::<u32>() % 1_000_000);
        let mut mutation_ids = Vec::new();
        let mutation_prov = MutationProvenance {
            prompt_id: Some(prompt_id.clone()),
            delta_id: Some(delta_id.clone()),
            agent_decision_id: None,
        };
        self.ensure_mutation_provenance(&mutation_prov)?;

        for mutation in mutations {
            let event = match mutation {
                DagMutation::CreateNode {
                    node_id,
                    node_kind,
                    title,
                    parent_node_id,
                    execution_mode,
                } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "DagNodeCreated".to_string(),
                    payload: json!({
                        "node_id": node_id,
                        "dag_id": dag_id,
                        "node_kind": node_kind,
                        "title": title,
                        "parent_node_id": parent_node_id,
                        "execution_mode": execution_mode
                    }),
                    provenance: Some(self.provenance_from(&mutation_prov)),
                },
                DagMutation::UpdateNode { node_id, patch } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "DagNodeUpdated".to_string(),
                    payload: json!({
                        "node_id": node_id,
                        "patch": patch
                    }),
                    provenance: Some(self.provenance_from(&mutation_prov)),
                },
                DagMutation::AddBlockedBy {
                    from_node_id,
                    to_node_id,
                } => {
                    self.ensure_no_cycle(dag_id, &from_node_id, &to_node_id)
                        .await?;
                    A2REvent {
                        event_id: create_event_id(),
                        ts: Utc::now().to_rfc3339(),
                        actor: gate_actor(&self.actor_id),
                        scope: None,
                        r#type: "DagEdgeAdded".to_string(),
                        payload: json!({
                            "dag_id": dag_id,
                            "from_node_id": from_node_id,
                            "to_node_id": to_node_id,
                            "edge_type": "blocked_by"
                        }),
                        provenance: Some(self.provenance_from(&mutation_prov)),
                    }
                }
                DagMutation::AddRelation {
                    a,
                    b,
                    note,
                    context_share,
                } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "DagRelationAdded".to_string(),
                    payload: json!({
                        "dag_id": dag_id,
                        "a": a,
                        "b": b,
                        "note": note,
                        "context_share": context_share.unwrap_or(false)
                    }),
                    provenance: Some(self.provenance_from(&mutation_prov)),
                },
                DagMutation::AddLabel { node_id, label } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "LabelAdded".to_string(),
                    payload: json!({
                        "dag_id": dag_id,
                        "node_id": node_id,
                        "label": label
                    }),
                    provenance: Some(self.provenance_from(&mutation_prov)),
                },
                DagMutation::RemoveLabel { node_id, label } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "LabelRemoved".to_string(),
                    payload: json!({
                        "dag_id": dag_id,
                        "node_id": node_id,
                        "label": label
                    }),
                    provenance: Some(self.provenance_from(&mutation_prov)),
                },
                DagMutation::SetState {
                    node_id,
                    dimension,
                    value,
                    reason,
                } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "StateSet".to_string(),
                    payload: json!({
                        "dag_id": dag_id,
                        "node_id": node_id,
                        "dimension": dimension,
                        "value": value,
                        "reason": reason
                    }),
                    provenance: Some(self.provenance_from(&mutation_prov)),
                },
                DagMutation::AddComment {
                    node_id,
                    body_ref,
                    author,
                } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "CommentAdded".to_string(),
                    payload: json!({
                        "dag_id": dag_id,
                        "node_id": node_id,
                        "comment_id": create_event_id(),
                        "author": author,
                        "body_ref": body_ref
                    }),
                    provenance: Some(self.provenance_from(&mutation_prov)),
                },
                DagMutation::ChangeStatus {
                    node_id,
                    from,
                    to,
                    reason,
                } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "DagNodeStatusChanged".to_string(),
                    payload: json!({
                        "dag_id": dag_id,
                        "node_id": node_id,
                        "from": from,
                        "to": to,
                        "reason": reason
                    }),
                    provenance: Some(self.provenance_from(&mutation_prov)),
                },
            };
            let event_id = event.event_id.clone();
            self.emit(event).await?;
            mutation_ids.push(event_id);
        }

        let links = mutation_ids.clone();
        let delta_event = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "PromptDeltaAppended".to_string(),
            payload: json!({
                "prompt_id": prompt_id,
                "delta_id": delta_id,
                "author": author,
                "category": "refine",
                "delta_text": delta_text,
                "valid_at": Utc::now().to_rfc3339(),
                "links": { "mutations": links },
                "linked_mutations": mutation_ids
            }),
            provenance: None,
        };
        if self.strict_provenance && mutation_ids.is_empty() {
            return Err(anyhow!(
                "prompt delta requires linked mutations in strict mode"
            ));
        }
        self.emit(delta_event).await?;

        self.refresh_dag_view(dag_id).await?;
        self.refresh_prompt_view(&prompt_id).await?;

        Ok(delta_id)
    }

    pub async fn add_blocked_by(
        &self,
        dag_id: &str,
        from_node_id: &str,
        to_node_id: &str,
    ) -> Result<()> {
        self.add_blocked_by_with(
            dag_id,
            from_node_id,
            to_node_id,
            MutationProvenance::default(),
        )
        .await
    }

    pub async fn add_blocked_by_with(
        &self,
        dag_id: &str,
        from_node_id: &str,
        to_node_id: &str,
        provenance: MutationProvenance,
    ) -> Result<()> {
        self.ensure_mutation_provenance(&provenance)?;
        self.ensure_no_cycle(dag_id, from_node_id, to_node_id)
            .await?;
        let evt = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "DagEdgeAdded".to_string(),
            payload: json!({
                "dag_id": dag_id,
                "from_node_id": from_node_id,
                "to_node_id": to_node_id,
                "edge_type": "blocked_by"
            }),
            provenance: Some(self.provenance_from(&provenance)),
        };
        if let Some(decision_id) = &provenance.agent_decision_id {
            if self.strict_provenance {
                self.ensure_agent_decision_links(decision_id, &evt.event_id)
                    .await?;
            }
        }
        self.emit(evt).await?;
        self.refresh_dag_view(dag_id).await?;
        Ok(())
    }

    pub async fn add_relation(
        &self,
        dag_id: &str,
        a: &str,
        b: &str,
        note: Option<String>,
    ) -> Result<()> {
        self.add_relation_with(dag_id, a, b, note, None, MutationProvenance::default())
            .await
    }

    pub async fn add_relation_with(
        &self,
        dag_id: &str,
        a: &str,
        b: &str,
        note: Option<String>,
        context_share: Option<bool>,
        provenance: MutationProvenance,
    ) -> Result<()> {
        self.ensure_mutation_provenance(&provenance)?;
        let evt = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "DagRelationAdded".to_string(),
            payload: json!({
                "dag_id": dag_id,
                "a": a,
                "b": b,
                "note": note,
                "context_share": context_share.unwrap_or(false)
            }),
            provenance: Some(self.provenance_from(&provenance)),
        };
        if let Some(decision_id) = &provenance.agent_decision_id {
            if self.strict_provenance {
                self.ensure_agent_decision_links(decision_id, &evt.event_id)
                    .await?;
            }
        }
        self.emit(evt).await?;
        self.refresh_dag_view(dag_id).await?;
        Ok(())
    }

    pub async fn wih_pickup(&self, dag_id: &str, node_id: &str, agent_id: &str) -> Result<String> {
        self.wih_pickup_with(dag_id, node_id, agent_id, WihPickupOptions::default())
            .await
    }

    pub async fn wih_pickup_with(
        &self,
        dag_id: &str,
        node_id: &str,
        agent_id: &str,
        opts: WihPickupOptions,
    ) -> Result<String> {
        let scope = EventScope {
            dag_id: Some(dag_id.to_string()),
            node_id: Some(node_id.to_string()),
            ..Default::default()
        };
        self.ensure_policy_scope(&scope).await?;
        let dag_events = self.events_for_dag(dag_id).await?;
        let dag = project_dag(&dag_events, dag_id);
        let node = dag
            .nodes
            .get(node_id)
            .ok_or_else(|| anyhow!("node not found"))?;
        if let Some(owner_role) = &node.owner_role {
            if opts.role.as_deref() != Some(owner_role.as_str()) {
                return Err(anyhow!("role does not match owner_role"));
            }
        }
        if node.status != "READY" && node.status != "NEW" {
            return Err(anyhow!("node not ready"));
        }
        if let Some(active) = self.active_wih_for_node(node_id).await? {
            return Err(anyhow!("node already has active wih {}", active));
        }

        let execution_mode = if opts.fresh {
            "fresh".to_string()
        } else {
            node.execution_mode.clone()
        };
        let wih_id = format!("wih_{}", rand::random::<u32>() % 10_000);
        let context_pack_path = if execution_mode == "fresh" {
            Some(
                context_pack_path(&self.root_dir, dag_id, &wih_id)
                    .to_string_lossy()
                    .to_string(),
            )
        } else {
            None
        };
        let loop_policy = LoopPolicy::default();
        let created = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "WIHCreated".to_string(),
            payload: json!({
                "wih_id": wih_id,
                "dag_id": dag_id,
                "node_id": node_id,
                "execution_mode": execution_mode,
                "context_pack_path": context_pack_path,
                "policy": {
                    "requires_lease_for_write": true,
                    "loop_policy": serde_json::to_value(&loop_policy).unwrap_or(json!({}))
                }
            }),
            provenance: None,
        };
        self.emit(created).await?;

        let picked = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "WIHPickedUp".to_string(),
            payload: json!({
                "wih_id": wih_id,
                "agent_id": agent_id,
                "role": opts.role,
                "picked_up_at": Utc::now().to_rfc3339()
            }),
            provenance: None,
        };
        self.emit(picked).await?;

        if execution_mode == "fresh" {
            let _ = self.write_context_pack(&wih_id, dag_id, node_id).await;
        }

        self.refresh_wih_view(&wih_id).await?;

        Ok(wih_id)
    }

    pub async fn wih_sign_open(&self, wih_id: &str, signature: &str) -> Result<()> {
        let scope = EventScope {
            wih_id: Some(wih_id.to_string()),
            ..Default::default()
        };
        self.ensure_policy_scope(&scope).await?;
        let evt = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "WIHOpenSigned".to_string(),
            payload: json!({ "wih_id": wih_id, "signature": signature }),
            provenance: None,
        };
        self.emit(evt).await?;
        self.refresh_wih_view(wih_id).await?;
        Ok(())
    }

    pub async fn turn_closeout(&self, wih_id: &str) -> Result<()> {
        let scope = EventScope {
            wih_id: Some(wih_id.to_string()),
            ..Default::default()
        };
        self.ensure_policy_scope(&scope).await?;
        let events = self.events_for_wih(wih_id).await?;
        let receipt_ids: Vec<String> = events
            .iter()
            .filter(|evt| evt.r#type == "ReceiptWritten")
            .filter_map(|evt| {
                evt.payload
                    .get("receipt_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            })
            .collect();
        let receipts_count = receipt_ids.len();
        let active_paths = self.leases.active_paths_for_wih(wih_id).await?;
        let released = self.leases.release_for_wih(wih_id).await?;
        let heartbeat = Utc::now().to_rfc3339();
        let event = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "GateTurnCloseout".to_string(),
            payload: json!({
                "wih_id": wih_id,
                "receipts": receipts_count,
                "receipt_ids": receipt_ids,
                "leases_released": released.len(),
                "released_ids": released,
                "active_paths": active_paths,
                "last_heartbeat": heartbeat
            }),
            provenance: None,
        };
        self.emit(event).await?;
        self.refresh_wih_view(wih_id).await?;
        Ok(())
    }

    pub async fn pre_tool(
        &self,
        wih_id: &str,
        tool: &str,
        paths_touched: &[String],
    ) -> Result<GateResult> {
        let scope = EventScope {
            wih_id: Some(wih_id.to_string()),
            ..Default::default()
        };
        self.ensure_policy_scope(&scope).await?;
        let wih_events = self.events_for_wih(wih_id).await?;
        let wih = project_wih(&wih_events, wih_id).ok_or_else(|| anyhow!("wih not found"))?;
        if !wih.open_signed {
            return Ok(GateResult {
                allowed: false,
                reason: Some("WIHOpenSigned required".to_string()),
            });
        }

        if let Some(allowed) = self.allowed_tools_for_wih(wih_id, &wih_events) {
            if !allowed.contains(&tool.to_string()) {
                return Ok(GateResult {
                    allowed: false,
                    reason: Some("tool not allowed by WIH policy".to_string()),
                });
            }
        }

        if !paths_touched.is_empty() {
            let now = Utc::now().to_rfc3339();
            let (ok, missing) = self.leases.check_coverage(paths_touched, &now).await?;
            if !ok {
                return Ok(GateResult {
                    allowed: false,
                    reason: Some(format!("missing lease coverage: {:?}", missing)),
                });
            }
        }

        Ok(GateResult {
            allowed: true,
            reason: Some(format!("allowed tool {}", tool)),
        })
    }

    pub async fn post_tool(
        &self,
        wih_id: &str,
        tool: &str,
        receipt_payload: serde_json::Value,
    ) -> Result<String> {
        let receipt_id = create_receipt_id();
        let receipt = ReceiptRecord {
            receipt_id: receipt_id.clone(),
            run_id: format!("run_{}", wih_id),
            step: None,
            tool: tool.to_string(),
            tool_version: None,
            inputs_ref: None,
            outputs_ref: None,
            exit: None,
        };
        let _ = self.receipts.write_receipt(&receipt)?;

        let evt = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "ReceiptWritten".to_string(),
            payload: json!({
                "wih_id": wih_id,
                "receipt_id": receipt_id,
                "tool": tool,
                "payload": receipt_payload
            }),
            provenance: None,
        };
        self.emit(evt).await?;
        self.turn_closeout(wih_id).await?;
        self.refresh_wih_view(wih_id).await?;
        Ok(receipt_id)
    }

    pub async fn wih_close(
        &self,
        wih_id: &str,
        status: &str,
        evidence_refs: &[String],
    ) -> Result<()> {
        let scope = EventScope {
            wih_id: Some(wih_id.to_string()),
            ..Default::default()
        };
        self.ensure_policy_scope(&scope).await?;
        if evidence_refs.is_empty() {
            return Err(anyhow!("evidence required to close WIH"));
        }
        let wih_events = self.events_for_wih(wih_id).await?;
        let wih_state = project_wih(&wih_events, wih_id).ok_or_else(|| anyhow!("wih not found"))?;
        let dag_id = wih_state.dag_id.clone();
        let node_id = wih_state.node_id.clone();

        let close_req = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "WIHCloseRequested".to_string(),
            payload: json!({ "wih_id": wih_id, "status": status, "evidence_refs": evidence_refs }),
            provenance: None,
        };
        self.emit(close_req).await?;

        let closed = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "WIHClosedSigned".to_string(),
            payload: json!({ "wih_id": wih_id, "final_status": status, "closed_at": Utc::now().to_rfc3339() }),
            provenance: None,
        };
        self.emit(closed).await?;

        let status_evt = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "DagNodeStatusChanged".to_string(),
            payload: json!({ "dag_id": dag_id, "node_id": node_id, "to": status }),
            provenance: None,
        };
        self.emit(status_evt).await?;

        let archived = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "WIHArchived".to_string(),
            payload: json!({ "wih_id": wih_id }),
            provenance: None,
        };
        self.emit(archived).await?;

        let vault_job = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "VaultJobCreated".to_string(),
            payload: json!({ "wih_id": wih_id }),
            provenance: None,
        };
        self.emit(vault_job).await?;

        if let Some(vault) = &self.vault {
            let _ = vault.archive_wih(wih_id).await;
        }

        self.refresh_wih_view(wih_id).await?;
        self.refresh_dag_view(&dag_id).await?;

        Ok(())
    }

    pub async fn lease_request(
        &self,
        wih_id: &str,
        agent_id: &str,
        paths: Vec<String>,
        ttl_seconds: Option<i64>,
    ) -> Result<String> {
        let lease_id = create_lease_id();
        let req = LeaseRequest {
            lease_id: lease_id.clone(),
            wih_id: wih_id.to_string(),
            agent_id: agent_id.to_string(),
            paths,
            requested_at: Utc::now().to_rfc3339(),
            ttl_seconds,
        };
        self.leases.request(req).await?;
        Ok(lease_id)
    }

    async fn events_for_dag(&self, dag_id: &str) -> Result<Vec<A2REvent>> {
        let all = self.ledger.query(LedgerQuery::default()).await?;
        Ok(all
            .into_iter()
            .filter(|evt| match evt.payload.get("dag_id") {
                Some(v) => v.as_str() == Some(dag_id),
                None => false,
            })
            .collect())
    }

    async fn events_for_wih(&self, wih_id: &str) -> Result<Vec<A2REvent>> {
        let all = self.ledger.query(LedgerQuery::default()).await?;
        Ok(all
            .into_iter()
            .filter(|evt| match evt.payload.get("wih_id") {
                Some(v) => v.as_str() == Some(wih_id),
                None => false,
            })
            .collect())
    }

    async fn emit(&self, event: A2REvent) -> Result<()> {
        self.ledger.append(event.clone()).await?;
        if let Some(index) = &self.index {
            let _ = index.index_event(&event).await;
        }
        Ok(())
    }

    async fn refresh_dag_view(&self, dag_id: &str) -> Result<()> {
        let events = self.events_for_dag(dag_id).await?;
        let dag = project_dag(&events, dag_id);
        let _ = write_dag_view(&self.root_dir, &dag)?;
        Ok(())
    }

    async fn refresh_wih_view(&self, wih_id: &str) -> Result<()> {
        let events = self.events_for_wih(wih_id).await?;
        if let Some(wih) = project_wih(&events, wih_id) {
            let _ = write_wih_view(&self.root_dir, &wih.dag_id, &wih)?;
        }
        Ok(())
    }

    async fn refresh_prompt_view(&self, prompt_id: &str) -> Result<()> {
        let events = self.ledger.query(LedgerQuery::default()).await?;
        if let Some(prompt) = project_prompt(&events, prompt_id) {
            let _ = write_prompt_view(&self.root_dir, &prompt)?;
        }
        Ok(())
    }

    async fn ensure_policy_scope(&self, scope: &EventScope) -> Result<()> {
        policy::ensure_injected(&self.root_dir, &self.ledger, Some(scope.clone()), "gate")
            .await
            .map_err(|err| anyhow!("policy injection required for scope {:?}: {}", scope, err))
    }

    pub async fn record_agent_decision(
        &self,
        note: &str,
        reason: Option<String>,
        linked_event_ids: Vec<String>,
    ) -> Result<String> {
        if self.strict_provenance && linked_event_ids.is_empty() {
            return Err(anyhow!(
                "agent decision requires linked mutations in strict mode"
            ));
        }
        let decision_id = format!("dec_{}", rand::random::<u32>() % 1_000_000);
        let evt = A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: gate_actor(&self.actor_id),
            scope: None,
            r#type: "AgentDecisionRecorded".to_string(),
            payload: json!({
                "decision_id": decision_id,
                "note": note,
                "reason": reason,
                "linked_event_ids": linked_event_ids
            }),
            provenance: None,
        };
        self.emit(evt).await?;
        Ok(decision_id)
    }

    pub async fn mutate_with_decision(
        &self,
        dag_id: &str,
        note: &str,
        reason: Option<String>,
        mutations: Vec<DagMutation>,
    ) -> Result<(String, Vec<String>)> {
        let scope = EventScope {
            dag_id: Some(dag_id.to_string()),
            ..Default::default()
        };
        self.ensure_policy_scope(&scope).await?;
        if mutations.is_empty() {
            return Err(anyhow!("mutations required"));
        }
        let mut events = Vec::new();
        for mutation in mutations {
            let event = match mutation {
                DagMutation::CreateNode {
                    node_id,
                    node_kind,
                    title,
                    parent_node_id,
                    execution_mode,
                } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "DagNodeCreated".to_string(),
                    payload: json!({
                        "node_id": node_id,
                        "dag_id": dag_id,
                        "node_kind": node_kind,
                        "title": title,
                        "parent_node_id": parent_node_id,
                        "execution_mode": execution_mode
                    }),
                    provenance: None,
                },
                DagMutation::UpdateNode { node_id, patch } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "DagNodeUpdated".to_string(),
                    payload: json!({
                        "node_id": node_id,
                        "patch": patch
                    }),
                    provenance: None,
                },
                DagMutation::AddBlockedBy {
                    from_node_id,
                    to_node_id,
                } => {
                    self.ensure_no_cycle(dag_id, &from_node_id, &to_node_id)
                        .await?;
                    A2REvent {
                        event_id: create_event_id(),
                        ts: Utc::now().to_rfc3339(),
                        actor: gate_actor(&self.actor_id),
                        scope: None,
                        r#type: "DagEdgeAdded".to_string(),
                        payload: json!({
                            "dag_id": dag_id,
                            "from_node_id": from_node_id,
                            "to_node_id": to_node_id,
                            "edge_type": "blocked_by"
                        }),
                        provenance: None,
                    }
                }
                DagMutation::AddRelation {
                    a,
                    b,
                    note,
                    context_share,
                } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "DagRelationAdded".to_string(),
                    payload: json!({
                        "dag_id": dag_id,
                        "a": a,
                        "b": b,
                        "note": note,
                        "context_share": context_share.unwrap_or(false)
                    }),
                    provenance: None,
                },
                DagMutation::AddLabel { node_id, label } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "LabelAdded".to_string(),
                    payload: json!({
                        "dag_id": dag_id,
                        "node_id": node_id,
                        "label": label
                    }),
                    provenance: None,
                },
                DagMutation::RemoveLabel { node_id, label } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "LabelRemoved".to_string(),
                    payload: json!({
                        "dag_id": dag_id,
                        "node_id": node_id,
                        "label": label
                    }),
                    provenance: None,
                },
                DagMutation::SetState {
                    node_id,
                    dimension,
                    value,
                    reason,
                } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "StateSet".to_string(),
                    payload: json!({
                        "dag_id": dag_id,
                        "node_id": node_id,
                        "dimension": dimension,
                        "value": value,
                        "reason": reason
                    }),
                    provenance: None,
                },
                DagMutation::AddComment {
                    node_id,
                    body_ref,
                    author,
                } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "CommentAdded".to_string(),
                    payload: json!({
                        "dag_id": dag_id,
                        "node_id": node_id,
                        "comment_id": create_event_id(),
                        "author": author,
                        "body_ref": body_ref
                    }),
                    provenance: None,
                },
                DagMutation::ChangeStatus {
                    node_id,
                    from,
                    to,
                    reason,
                } => A2REvent {
                    event_id: create_event_id(),
                    ts: Utc::now().to_rfc3339(),
                    actor: gate_actor(&self.actor_id),
                    scope: None,
                    r#type: "DagNodeStatusChanged".to_string(),
                    payload: json!({
                        "dag_id": dag_id,
                        "node_id": node_id,
                        "from": from,
                        "to": to,
                        "reason": reason
                    }),
                    provenance: None,
                },
            };
            if self.strict_provenance && event.r#type == "DagRelationAdded" {
                // Enforce that related_to context_share is explicit in strict mode
                let explicit = event
                    .payload
                    .get("context_share")
                    .and_then(|v| v.as_bool())
                    .is_some();
                if !explicit {
                    return Err(anyhow!("context_share must be explicit in strict mode"));
                }
            }
            events.push(event);
        }

        let mutation_ids: Vec<String> = events.iter().map(|e| e.event_id.clone()).collect();
        let decision_id = self
            .record_agent_decision(note, reason, mutation_ids.clone())
            .await?;
        let provenance = MutationProvenance {
            prompt_id: None,
            delta_id: None,
            agent_decision_id: Some(decision_id.clone()),
        };
        for mut evt in events {
            evt.provenance = Some(self.provenance_from(&provenance));
            if let Some(decision_id) = &provenance.agent_decision_id {
                if self.strict_provenance {
                    self.ensure_agent_decision_links(decision_id, &evt.event_id)
                        .await?;
                }
            }
            self.emit(evt).await?;
        }

        self.refresh_dag_view(dag_id).await?;
        Ok((decision_id, mutation_ids))
    }

    async fn resolve_prompt_id(&self, dag_id: &str) -> Result<String> {
        let events = self.ledger.query(LedgerQuery::default()).await?;
        for evt in events {
            if evt.r#type == "PromptLinkedToWork" {
                if evt.payload.get("dag_id").and_then(|v| v.as_str()) == Some(dag_id) {
                    if let Some(prompt_id) = evt.payload.get("prompt_id").and_then(|v| v.as_str()) {
                        return Ok(prompt_id.to_string());
                    }
                }
            }
        }
        Err(anyhow!("prompt not linked to dag"))
    }

    async fn ensure_no_cycle(&self, dag_id: &str, from: &str, to: &str) -> Result<()> {
        let events = self.events_for_dag(dag_id).await?;
        let dag = project_dag(&events, dag_id);
        if would_create_cycle(&dag.edges, from, to) {
            return Err(anyhow!("blocked_by edge would create cycle"));
        }
        Ok(())
    }

    fn ensure_mutation_provenance(&self, provenance: &MutationProvenance) -> Result<()> {
        if !self.strict_provenance {
            return Ok(());
        }
        let has_prompt = provenance.prompt_id.is_some() && provenance.delta_id.is_some();
        let has_decision = provenance.agent_decision_id.is_some();
        if !has_prompt && !has_decision {
            return Err(anyhow!("mutation requires prompt delta or agent decision"));
        }
        Ok(())
    }

    fn provenance_from(
        &self,
        provenance: &MutationProvenance,
    ) -> crate::core::types::EventProvenance {
        crate::core::types::EventProvenance {
            prompt_id: provenance.prompt_id.clone(),
            delta_id: provenance.delta_id.clone(),
            agent_decision_id: provenance.agent_decision_id.clone(),
            parent_event_id: None,
        }
    }

    async fn ensure_agent_decision_links(&self, decision_id: &str, event_id: &str) -> Result<()> {
        let events = self.ledger.query(LedgerQuery::default()).await?;
        for evt in events {
            if evt.r#type == "AgentDecisionRecorded" {
                if evt.payload.get("decision_id").and_then(|v| v.as_str()) == Some(decision_id) {
                    let linked = evt
                        .payload
                        .get("linked_event_ids")
                        .and_then(|v| v.as_array())
                        .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
                        .unwrap_or_default();
                    if linked.iter().any(|id| *id == event_id) {
                        return Ok(());
                    }
                    return Err(anyhow!("agent decision missing linked event id"));
                }
            }
        }
        Err(anyhow!("agent decision not found"))
    }

    async fn active_wih_for_node(&self, node_id: &str) -> Result<Option<String>> {
        let events = self.ledger.query(LedgerQuery::default()).await?;
        let mut node_map = std::collections::HashMap::new();
        let mut closed = std::collections::HashSet::new();
        for evt in &events {
            if evt.r#type == "WIHCreated" {
                if let Some(wih_id) = evt.payload.get("wih_id").and_then(|v| v.as_str()) {
                    if let Some(nid) = evt.payload.get("node_id").and_then(|v| v.as_str()) {
                        node_map.insert(wih_id.to_string(), nid.to_string());
                    }
                }
            }
            if evt.r#type == "WIHClosedSigned" {
                if let Some(wih_id) = evt.payload.get("wih_id").and_then(|v| v.as_str()) {
                    closed.insert(wih_id.to_string());
                }
            }
        }
        for (wih_id, nid) in node_map {
            if nid == node_id && !closed.contains(&wih_id) {
                return Ok(Some(wih_id));
            }
        }
        Ok(None)
    }

    fn allowed_tools_for_wih(&self, wih_id: &str, events: &[A2REvent]) -> Option<Vec<String>> {
        for evt in events {
            if evt.r#type == "WIHCreated" {
                if evt.payload.get("wih_id").and_then(|v| v.as_str()) == Some(wih_id) {
                    if let Some(policy) = evt.payload.get("policy") {
                        if let Some(tools) = policy.get("allowed_tools").and_then(|v| v.as_array())
                        {
                            return Some(
                                tools
                                    .iter()
                                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                    .collect(),
                            );
                        }
                    }
                }
            }
        }
        None
    }

    async fn write_context_pack(&self, wih_id: &str, dag_id: &str, node_id: &str) -> Result<()> {
        let events = self.ledger.query(LedgerQuery::default()).await?;
        let dag_events = events_for_dag(&events, dag_id);
        let dag = project_dag(&dag_events, dag_id);

        let ancestors = collect_ancestor_chain(&dag, node_id);
        let deps = collect_blocked_by_predecessors(&dag, node_id);
        let mut nodeset = std::collections::HashSet::new();
        nodeset.insert(node_id.to_string());
        nodeset.extend(ancestors.iter().cloned());
        nodeset.extend(deps.iter().cloned());

        for rel in dag.relations.iter().filter(|r| r.context_share) {
            if nodeset.contains(&rel.a) && !nodeset.contains(&rel.b) {
                nodeset.insert(rel.b.clone());
            } else if nodeset.contains(&rel.b) && !nodeset.contains(&rel.a) {
                nodeset.insert(rel.a.clone());
            }
        }

        let nodes: Vec<DagNode> = dag
            .nodes
            .values()
            .filter(|n| nodeset.contains(&n.node_id))
            .cloned()
            .collect();
        let edges: Vec<DagEdge> = dag
            .edges
            .iter()
            .filter(|e| nodeset.contains(&e.from_node_id) && nodeset.contains(&e.to_node_id))
            .cloned()
            .collect();
        let relations: Vec<DagRelation> = dag
            .relations
            .iter()
            .filter(|r| nodeset.contains(&r.a) && nodeset.contains(&r.b))
            .cloned()
            .collect();

        let prompt_id = self.resolve_prompt_id(dag_id).await.ok();
        let prompt = prompt_id
            .as_deref()
            .and_then(|pid| project_prompt(&events, pid));

        let receipt_refs = collect_receipts_for_nodes(&events, dag_id, &deps);
        let dag_slice = DagSlice {
            nodes,
            edges,
            relations,
        };
        let pack = ContextPack {
            version: "v1".to_string(),
            generated_at: Utc::now().to_rfc3339(),
            wih_id: wih_id.to_string(),
            dag_id: dag_id.to_string(),
            node_id: node_id.to_string(),
            execution_mode: "fresh".to_string(),
            prompt,
            dag_slice,
            dependency_nodes: deps.into_iter().collect(),
            receipts: receipt_refs,
        };

        let path = context_pack_path(&self.root_dir, dag_id, wih_id);
        if let Some(parent) = path.parent() {
            ensure_dir(parent)?;
        }
        write_json_atomic(&path, &pack)?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum DagMutation {
    CreateNode {
        node_id: String,
        node_kind: String,
        title: String,
        parent_node_id: Option<String>,
        execution_mode: String,
    },
    UpdateNode {
        node_id: String,
        patch: serde_json::Value,
    },
    AddBlockedBy {
        from_node_id: String,
        to_node_id: String,
    },
    AddRelation {
        a: String,
        b: String,
        note: Option<String>,
        context_share: Option<bool>,
    },
    AddLabel {
        node_id: String,
        label: String,
    },
    RemoveLabel {
        node_id: String,
        label: String,
    },
    SetState {
        node_id: String,
        dimension: String,
        value: String,
        reason: Option<String>,
    },
    AddComment {
        node_id: String,
        body_ref: String,
        author: String,
    },
    ChangeStatus {
        node_id: String,
        from: String,
        to: String,
        reason: Option<String>,
    },
}

fn context_pack_path(root: &PathBuf, dag_id: &str, wih_id: &str) -> PathBuf {
    root.join(".a2r/work/dags")
        .join(dag_id)
        .join("wih")
        .join("context")
        .join(format!("{wih_id}.context.json"))
}

fn events_for_dag(events: &[A2REvent], dag_id: &str) -> Vec<A2REvent> {
    events
        .iter()
        .filter(|evt| evt.payload.get("dag_id").and_then(|v| v.as_str()) == Some(dag_id))
        .cloned()
        .collect()
}

fn collect_ancestor_chain(dag: &DagState, node_id: &str) -> std::collections::HashSet<String> {
    let mut out = std::collections::HashSet::new();
    let mut current = node_id.to_string();
    while let Some(node) = dag.nodes.get(&current) {
        if let Some(parent) = &node.parent_node_id {
            if out.insert(parent.clone()) {
                current = parent.clone();
                continue;
            }
        }
        break;
    }
    out
}

fn collect_blocked_by_predecessors(
    dag: &DagState,
    node_id: &str,
) -> std::collections::HashSet<String> {
    let mut out = std::collections::HashSet::new();
    let mut stack = vec![node_id.to_string()];
    while let Some(target) = stack.pop() {
        for edge in dag
            .edges
            .iter()
            .filter(|e| e.edge_type == "blocked_by" && e.to_node_id == target)
        {
            if out.insert(edge.from_node_id.clone()) {
                stack.push(edge.from_node_id.clone());
            }
        }
    }
    out
}

fn collect_receipts_for_nodes(
    events: &[A2REvent],
    dag_id: &str,
    node_ids: &std::collections::HashSet<String>,
) -> Vec<ContextReceipt> {
    let mut wih_to_node = std::collections::HashMap::new();
    for evt in events {
        if evt.r#type == "WIHCreated" {
            if evt.payload.get("dag_id").and_then(|v| v.as_str()) != Some(dag_id) {
                continue;
            }
            if let (Some(wih_id), Some(node_id)) = (
                evt.payload.get("wih_id").and_then(|v| v.as_str()),
                evt.payload.get("node_id").and_then(|v| v.as_str()),
            ) {
                wih_to_node.insert(wih_id.to_string(), node_id.to_string());
            }
        }
    }
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for evt in events {
        if evt.r#type != "ReceiptWritten" {
            continue;
        }
        let wih_id = match evt.payload.get("wih_id").and_then(|v| v.as_str()) {
            Some(value) => value,
            None => continue,
        };
        let node_id = wih_to_node.get(wih_id).cloned();
        if let Some(node_id) = &node_id {
            if !node_ids.contains(node_id) {
                continue;
            }
        } else {
            continue;
        }
        let receipt_id = match evt.payload.get("receipt_id").and_then(|v| v.as_str()) {
            Some(value) => value,
            None => continue,
        };
        if seen.insert(receipt_id.to_string()) {
            out.push(ContextReceipt {
                receipt_id: receipt_id.to_string(),
                wih_id: wih_id.to_string(),
                node_id,
            });
        }
    }
    out
}

fn gate_actor(actor_id: &str) -> Actor {
    Actor {
        r#type: ActorType::Gate,
        id: actor_id.to_string(),
    }
}

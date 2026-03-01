use crate::context_manager::ContextManager;
use crate::directive_compiler::DirectiveCompiler;
use crate::frameworks::Framework;
use crate::intent_graph::{IntentGraphKernel, NodeType};
use crate::orchestrator::OrchestratorService;
use crate::patterns::PatternRegistry;
use crate::situation_resolver::SituationResolver;
use crate::types::{
    Artifact, CanvasInstance, CapsuleInstance, DispatchResponse, JournalEvent, ToolDefinition,
};
use crate::brain::types::SessionStatus;
use a2rchitech_tools_gateway::{run_scoped_write_scope, ToolExecutionRequest, ToolGateway};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::contract_verifier::{ContractVerifier, ViolationSeverity};
use crate::llm::gateway::ProviderManager;
use capsule_compiler::{CapsuleCompiler, CompilerConfig};
use crate::brain::BrainManager;
use uuid::Uuid;

pub struct IntentDispatcher {
    frameworks: HashMap<String, Framework>,
    capsules: HashMap<String, CapsuleInstance>,
    directive_compiler: Arc<DirectiveCompiler>,
    context_manager: Arc<ContextManager>,
    intent_graph: Arc<RwLock<IntentGraphKernel>>,
    pattern_registry: Arc<PatternRegistry>,
    pub tool_gateway: Arc<ToolGateway>,
    pub provider_manager: Arc<RwLock<ProviderManager>>,
    pub contract_verifier: Arc<ContractVerifier>,
    pub capsule_compiler: Arc<CapsuleCompiler>,
    pub orchestrator_service: Arc<OrchestratorService>,
    pub brain_manager: Arc<BrainManager>,
}

impl IntentDispatcher {
    pub fn new(
        directive_compiler: Arc<DirectiveCompiler>,
        context_manager: Arc<ContextManager>,
        intent_graph: Arc<RwLock<IntentGraphKernel>>,
        pattern_registry: Arc<PatternRegistry>,
        tool_gateway: Arc<ToolGateway>,
        provider_manager: Arc<RwLock<ProviderManager>>,
        contract_verifier: Arc<ContractVerifier>,
        capsule_compiler: Arc<CapsuleCompiler>,
        orchestrator_service: Arc<OrchestratorService>,
        brain_manager: Arc<BrainManager>,
    ) -> Self {
        Self {
            frameworks: HashMap::new(),
            capsules: HashMap::new(),
            directive_compiler,
            context_manager,
            intent_graph,
            pattern_registry,
            tool_gateway,
            provider_manager,
            contract_verifier,
            capsule_compiler,
            orchestrator_service,
            brain_manager,
        }
    }

    pub fn register_framework(&mut self, framework: Framework) {
        self.frameworks
            .insert(framework.framework_id.clone(), framework);
    }

    async fn dispatch_to_brain_session(&self, intent_text: String, agent_id: &str) -> Result<DispatchResponse, anyhow::Error> {
        // Find active brain session matching the requested agent_id
        let sessions = self.brain_manager.list_sessions().await;
        let active_session = sessions.iter()
            .find(|s| matches!(s.status, SessionStatus::Running) &&
                s.profile_id.as_ref().map_or(false, |p| p == agent_id))
            .or_else(|| {
                // Fallback: find any active brain session if exact match not found
                sessions.iter()
                    .find(|s| matches!(s.status, SessionStatus::Running) &&
                        s.profile_id.as_ref().map_or(false, |p|
                            p.ends_with("-acp") || p.ends_with("-cli")
                        ))
            })
            .ok_or_else(|| anyhow::anyhow!("No active brain session found for agent: {}", agent_id))?;

        let profile_id = active_session.profile_id.as_ref().map_or("unknown", |p| p.as_str());
        println!("[Dispatcher] Sending to brain session: {} (profile: {})", active_session.id, profile_id);

        // Get the runtime for this session and send input
        let runtime = self.brain_manager.get_runtime(&active_session.id).await
            .ok_or_else(|| anyhow::anyhow!("Brain session runtime not found"))?;

        // Send the intent as input to the brain session
        runtime.write().await.send_input(&intent_text).await
            .map_err(|e| anyhow::anyhow!("Failed to send to brain session: {}", e))?;

        // Return response with brain session info
        let capsule = CapsuleInstance {
            capsule_id: format!("brain-{}", active_session.id),
            framework_id: "fwk_brain".to_string(),
            title: format!("Brain Session: {}", profile_id),
            created_at: chrono::Utc::now().timestamp_millis(),
            state: serde_json::json!({"session_id": active_session.id}),
            active_canvas_id: None,
            persistence_mode: "ephemeral".to_string(),
            sandbox_policy: None,
            tool_scope: None,
        };

        Ok(DispatchResponse {
            capsule,
            canvases: vec![],
            events: vec![],
            artifacts: vec![],
            pattern_id: None,
            confidence: 1.0,
            situation: None,
        })
    }

    pub async fn dispatch_intent(
        &mut self,
        intent_text: String,
        agent_id: Option<String>,
        execution_mode: Option<String>,
    ) -> Result<DispatchResponse, anyhow::Error> {
        println!("[Dispatcher] Dispatching intent: {}", intent_text);

        // Phase 6 Protection Layer
        let protection = crate::protection::ProtectionGate::scan_intent(&intent_text);
        if protection.recommendation == crate::protection::ProtectionAction::Block {
            return Err(anyhow::anyhow!(
                "Protection Blocked: {:?} (Risk: {})",
                protection.flagged_patterns,
                protection.risk_score
            ));
        }

        let framework_id = self.select_framework(&intent_text).await?;
        println!("[Dispatcher] Selected framework: {}", framework_id);

        // Special handling for brain framework - route to active brain session
        if framework_id == "fwk_brain" {
            if let Some(aid) = &agent_id {
                return self.dispatch_to_brain_session(intent_text, aid).await;
            } else {
                return self.dispatch_to_brain_session(intent_text, "unknown").await;
            }
        }

        let framework = self
            .frameworks
            .get(&framework_id)
            .ok_or_else(|| anyhow::anyhow!("Framework not found: {}", framework_id))?;

        let capsule_id = uuid::Uuid::new_v4().to_string();

        // Create initial capsule with default policies
        let mut capsule = CapsuleInstance {
            capsule_id: capsule_id.clone(),
            framework_id: framework.framework_id.clone(),
            title: format!("{} Capsule", framework.framework_id),
            created_at: chrono::Utc::now().timestamp_millis(),
            state: serde_json::json!({}),
            active_canvas_id: None,
            persistence_mode: "ephemeral".to_string(),
            sandbox_policy: Some(serde_json::json!({
                "allow_network": framework_id == "fwk_search",
                "allow_filesystem": framework_id == "fwk_note",
                "max_memory_mb": 512
            })),
            tool_scope: Some(serde_json::json!({
                "allowed_tools": framework.required_tools.clone(),
                "denied_tools": ["exec.run"],
                "requires_confirmation": ["fs.write", "web.search"]
            })),
        };

        self.capsules.insert(capsule_id.clone(), capsule.clone());

        // Update Intent Graph
        let mut graph = self.intent_graph.write().await;
        let int_id = graph.add_node(
            NodeType::Intent,
            "Human Intent".to_string(),
            serde_json::json!({ "text": intent_text }),
        );
        let tsk_id = graph.add_node(
            NodeType::Task,
            format!("Process {}", framework_id),
            serde_json::json!({ "framework": framework_id }),
        );
        graph.add_edge(&int_id, &tsk_id, "PART_OF");
        let _ = graph.save_to_disk();
        println!("[Dispatcher] Graph Updated: {} -> {}", int_id, tsk_id);

        let canvases: Vec<CanvasInstance> = framework
            .default_canvases
            .iter()
            .map(|template| CanvasInstance {
                canvas_id: uuid::Uuid::new_v4().to_string(),
                capsule_id: capsule_id.clone(),
                view_type: template.view_type.clone(),
                title: template.title.clone(),
                state: template
                    .initial_state
                    .clone()
                    .unwrap_or(serde_json::json!({})),
                columns: template.columns.clone(),
                actions: template.actions.clone(),
                layout: template.layout.clone(),
            })
            .collect();

        let intent_event_id = uuid::Uuid::new_v4().to_string();
        let mut events = vec![JournalEvent {
            event_id: intent_event_id.clone(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            kind: "intent_received".to_string(),
            capsule_id: Some(capsule_id.clone()),
            payload: serde_json::json!({
                "intent_text": intent_text,
                "framework_id": framework_id,
            }),
            parent_ids: vec![],
            root_id: Some(intent_event_id.clone()),
        }];

        // Compile Directive
        let task_spec = crate::types::TaskSpec {
            id: uuid::Uuid::new_v4().to_string(),
            intent_type: framework_id.clone(),
            user_goal: intent_text.clone(),
            inputs: vec![],
            constraints: vec!["no system corruption".to_string()],
            success_criteria: vec!["task resolved".to_string()],
            output_contract: crate::types::OutputContract {
                format: "markdown".to_string(),
                schema_ref: None,
                constraints: vec![],
            },
        };
        let directive = self.directive_compiler.compile(&task_spec);
        println!("[Dispatcher] Compiled Directive:\n{}", directive);

        let mut artifacts = Vec::new();

        // Run DCD Assembly with verification - with proper error handling
        let (bundle, context_map, budget_report, verify_artifact) = match self
            .context_manager
            .assemble_with_verification(&intent_text, &capsule_id, &capsule_id)
        {
            (bundle, context_map, budget_report, verify_artifact) => {
                println!(
                    "[Dispatcher] DCD Assembled with Verification. Total tokens: {}",
                    budget_report.total_tokens
                );
                (bundle, context_map, budget_report, verify_artifact)
            }
            _ => {
                // Add error event if context assembly fails
                events.push(JournalEvent {
                    event_id: uuid::Uuid::new_v4().to_string(),
                    timestamp: chrono::Utc::now().timestamp_millis(),
                    kind: "context_assembly_failed".to_string(),
                    capsule_id: Some(capsule_id.clone()),
                    payload: serde_json::json!({
                        "error": "Context assembly failed, using fallback context",
                        "intent_text": &intent_text,
                        "framework_id": &framework_id,
                    }),
                    parent_ids: vec![intent_event_id.clone()],
                    root_id: Some(intent_event_id.clone()),
                });

                // Use a fallback context bundle
                let fallback_inputs = a2rchitech_kernel_contracts::ContextInputs {
                    user_inputs: serde_json::json!({ "intent": &intent_text }),
                    system_inputs: serde_json::json!({ "session_id": &capsule_id, "framework_id": &framework_id }),
                    previous_outputs: vec![],
                };

                let fallback_bundle = a2rchitech_kernel_contracts::ContextBundle {
                    bundle_hash: format!("fallback_{}", uuid::Uuid::new_v4()),
                    inputs: fallback_inputs,
                    memory_refs: vec![],
                    budgets: a2rchitech_kernel_contracts::ContextBudgets {
                        max_tokens: Some(1000),
                        max_execution_time_ms: Some(5000),
                        max_tool_calls: Some(5),
                        max_memory_refs: Some(3),
                    },
                    redactions: vec![],
                    timestamp: chrono::Utc::now().timestamp() as u64,
                    metadata: std::collections::HashMap::new(),
                };

                let fallback_verify_artifact = a2rchitech_kernel_contracts::VerifyArtifact::new(
                    capsule_id.clone(),
                    "context_assembly".to_string(),
                    format!("fallback_{}", uuid::Uuid::new_v4()),
                    a2rchitech_kernel_contracts::VerificationResults {
                        passed: false,
                        details: serde_json::json!({
                            "warning": "Using fallback context due to assembly failure",
                            "original_intent": &intent_text,
                        }),
                        confidence: 0.3,
                        issues: vec![a2rchitech_kernel_contracts::VerificationIssue {
                            issue_type: "context_assembly_failure".to_string(),
                            description: "Context assembly failed, using fallback".to_string(),
                            severity: a2rchitech_kernel_contracts::VerificationSeverity::Warning,
                            location: None,
                        }],
                    },
                    "context_manager".to_string(),
                );

                (
                    fallback_bundle,
                    a2rchitech_kernel_contracts::ContextMap {
                        included_ids: vec![],
                        excluded_ids: vec![],
                        reasons: std::collections::HashMap::new(),
                    },
                    a2rchitech_kernel_contracts::BudgetReport {
                        token_usage: std::collections::HashMap::new(),
                        total_tokens: 0,
                        budget_limit: 1000,
                    },
                    fallback_verify_artifact,
                )
            }
        };

        // Use the capsule compiler with context bundle to generate the actual CapsuleSpec
        let evidence_objects: Vec<capsule_spec::EvidenceObject> = vec![]; // In a real implementation, this would come from evidence store
        let capsule_spec = self
            .capsule_compiler
            .compile_with_context(&intent_text, &evidence_objects, Some(&bundle))
            .await
            .map_err(|e| anyhow::anyhow!("Failed to compile capsule with context: {}", e))?;

        // Generate verification artifact for the capsule compilation
        let compile_verify_artifact = self
            .capsule_compiler
            .generate_verification_artifact(&capsule_spec, &capsule_id);
        artifacts.push(Artifact {
            artifact_id: compile_verify_artifact.verify_id.clone(),
            capsule_id: capsule_id.clone(),
            artifact_type: "CapsuleCompileVerification".to_string(),
            content: serde_json::to_value(&compile_verify_artifact).unwrap(),
        });

        // Check verification results from capsule compilation before proceeding
        if !compile_verify_artifact.results.passed {
            // If verification failed, add warning event and potentially restrict operations
            events.push(JournalEvent {
                event_id: uuid::Uuid::new_v4().to_string(),
                timestamp: chrono::Utc::now().timestamp_millis(),
                kind: "capsule_compilation_verification_failed".to_string(),
                capsule_id: Some(capsule_id.clone()),
                payload: serde_json::json!({
                    "verify_artifact_id": compile_verify_artifact.verify_id,
                    "confidence": compile_verify_artifact.results.confidence,
                    "issues": compile_verify_artifact.results.issues,
                    "warning": "Capsule compilation verification failed, proceeding with restricted capabilities"
                }),
                parent_ids: vec![intent_event_id.clone()],
                root_id: Some(intent_event_id.clone()),
            });

            // Apply more restrictive policies based on verification failure
            if compile_verify_artifact.results.confidence < 0.5 {
                capsule.sandbox_policy = Some(serde_json::json!({
                    "allow_network": false,
                    "allow_filesystem": false,
                    "max_memory_mb": 16
                }));

                capsule.tool_scope = Some(serde_json::json!({
                    "allowed_tools": [],
                    "denied_tools": ["*"],
                    "requires_confirmation": []
                }));
            } else {
                capsule.sandbox_policy = Some(serde_json::json!({
                    "allow_network": false,
                    "allow_filesystem": false,
                    "max_memory_mb": 256
                }));

                capsule.tool_scope = Some(serde_json::json!({
                    "allowed_tools": ["read_only.tools"],
                    "denied_tools": ["fs.write", "web.search", "exec.run"],
                    "requires_confirmation": []
                }));
            }
        }

        // Add verification artifact to artifacts list
        artifacts.push(Artifact {
            artifact_id: verify_artifact.verify_id.clone(),
            capsule_id: capsule_id.clone(),
            artifact_type: "ContextVerification".to_string(),
            content: serde_json::to_value(&verify_artifact).unwrap(),
        });

        // Propagate context through the system by adding it to the capsule state
        if let Some(ref mut state) = capsule.state.as_object_mut() {
            state.insert(
                "context_bundle_hash".to_string(),
                serde_json::Value::String(bundle.bundle_hash.clone()),
            );
            state.insert(
                "context_timestamp".to_string(),
                serde_json::Value::Number(serde_json::Number::from(bundle.timestamp)),
            );
        } else {
            capsule.state = serde_json::json!({
                "context_bundle_hash": bundle.bundle_hash,
                "context_timestamp": bundle.timestamp,
                "context_included_ids": context_map.included_ids,
                "context_excluded_ids": context_map.excluded_ids,
            });
        }

        // Perform contract compliance verification on the assembled context bundle
        let compliance_results = self.contract_verifier.verify_contracts(
            Some(&bundle),
            None, // No event envelope yet
            None, // No run model yet
            Some(&verify_artifact),
            None, // No tool ABI to verify at this stage
            None, // No tool request to verify at this stage
        );

        // Check for critical compliance violations
        for (contract_type, result) in compliance_results {
            if !result.is_compliant {
                // Add compliance violation events
                for violation in &result.violations {
                    if matches!(violation.severity, ViolationSeverity::Error) {
                        events.push(JournalEvent {
                            event_id: uuid::Uuid::new_v4().to_string(),
                            timestamp: chrono::Utc::now().timestamp_millis(),
                            kind: "contract_violation".to_string(),
                            capsule_id: Some(capsule_id.clone()),
                            payload: serde_json::json!({
                                "contract_type": contract_type,
                                "element": violation.element,
                                "severity": format!("{:?}", violation.severity),
                                "description": violation.description,
                                "action_taken": "logged_and_proceeded_with_restrictions"
                            }),
                            parent_ids: vec![intent_event_id.clone()],
                            root_id: Some(intent_event_id.clone()),
                        });

                        // Apply more restrictive policies due to contract violations
                        capsule.sandbox_policy = Some(serde_json::json!({
                            "allow_network": false,
                            "allow_filesystem": false,
                            "max_memory_mb": 128
                        }));

                        capsule.tool_scope = Some(serde_json::json!({
                            "allowed_tools": ["read_only.tools"],
                            "denied_tools": ["*"],
                            "requires_confirmation": []
                        }));
                    }
                }
            }
        }

        // CRITICAL SECURITY CHECK: Verify verification artifacts before proceeding
        // This ensures all operations are properly validated before execution
        if !verify_artifact.results.passed {
            // Verification failed - add security event and block operation
            events.push(JournalEvent {
                event_id: uuid::Uuid::new_v4().to_string(),
                timestamp: chrono::Utc::now().timestamp_millis(),
                kind: "security_violation".to_string(),
                capsule_id: Some(capsule_id.clone()),
                payload: serde_json::json!({
                    "verify_artifact_id": verify_artifact.verify_id,
                    "confidence": verify_artifact.results.confidence,
                    "issues": verify_artifact.results.issues,
                    "violation_type": "verification_failed",
                    "action_taken": "execution_blocked"
                }),
                parent_ids: vec![intent_event_id.clone()],
                root_id: Some(intent_event_id.clone()),
            });

            // Block operation entirely if verification failed
            events.push(JournalEvent {
                event_id: uuid::Uuid::new_v4().to_string(),
                timestamp: chrono::Utc::now().timestamp_millis(),
                kind: "operation_blocked".to_string(),
                capsule_id: Some(capsule_id.clone()),
                payload: serde_json::json!({
                    "reason": "Verification failed",
                    "confidence": verify_artifact.results.confidence,
                    "verify_artifact_id": verify_artifact.verify_id,
                    "action_taken": "operation_blocked"
                }),
                parent_ids: vec![intent_event_id.clone()],
                root_id: Some(intent_event_id.clone()),
            });

            // Return early with blocked response - CRITICAL: Do not proceed with unverified operations
            return Ok(DispatchResponse {
                capsule: CapsuleInstance {
                    capsule_id: capsule_id.clone(),
                    framework_id: framework.framework_id.clone(),
                    title: format!("BLOCKED: {}", format!("{} Capsule", framework.framework_id)),
                    created_at: chrono::Utc::now().timestamp_millis(),
                    state: serde_json::json!({"status": "blocked", "reason": "verification_failed", "verify_artifact_id": verify_artifact.verify_id}),
                    active_canvas_id: None,
                    persistence_mode: "ephemeral".to_string(),
                    sandbox_policy: Some(serde_json::json!({
                        "allow_network": false,
                        "allow_filesystem": false,
                        "max_memory_mb": 16
                    })),
                    tool_scope: Some(serde_json::json!({
                        "allowed_tools": [],
                        "denied_tools": ["*"],
                        "requires_confirmation": []
                    })),
                },
                canvases: vec![],
                events,
                artifacts,
                pattern_id: Some("verification_blocked".to_string()),
                confidence: verify_artifact.results.confidence,
                situation: None,
            });
        }

        // Additional verification: Check for critical issues even if overall verification passed
        let critical_issues: Vec<_> = verify_artifact
            .results
            .issues
            .iter()
            .filter(|issue| {
                matches!(
                    issue.severity,
                    a2rchitech_kernel_contracts::VerificationSeverity::Critical
                )
            })
            .collect();

        if !critical_issues.is_empty() {
            // Even if verification passed, critical issues should block execution
            events.push(JournalEvent {
                event_id: uuid::Uuid::new_v4().to_string(),
                timestamp: chrono::Utc::now().timestamp_millis(),
                kind: "security_violation".to_string(),
                capsule_id: Some(capsule_id.clone()),
                payload: serde_json::json!({
                    "verify_artifact_id": verify_artifact.verify_id,
                    "critical_issues_count": critical_issues.len(),
                    "critical_issues": critical_issues,
                    "violation_type": "critical_verification_issues",
                    "action_taken": "execution_blocked"
                }),
                parent_ids: vec![intent_event_id.clone()],
                root_id: Some(intent_event_id.clone()),
            });

            return Ok(DispatchResponse {
                capsule: CapsuleInstance {
                    capsule_id: capsule_id.clone(),
                    framework_id: framework.framework_id.clone(),
                    title: format!(
                        "BLOCKED: Critical Issues - {} Capsule",
                        framework.framework_id
                    ),
                    created_at: chrono::Utc::now().timestamp_millis(),
                    state: serde_json::json!({"status": "blocked", "reason": "critical_verification_issues", "verify_artifact_id": verify_artifact.verify_id}),
                    active_canvas_id: None,
                    persistence_mode: "ephemeral".to_string(),
                    sandbox_policy: Some(serde_json::json!({
                        "allow_network": false,
                        "allow_filesystem": false,
                        "max_memory_mb": 16
                    })),
                    tool_scope: Some(serde_json::json!({
                        "allowed_tools": [],
                        "denied_tools": ["*"],
                        "requires_confirmation": []
                    })),
                },
                canvases: vec![],
                events,
                artifacts,
                pattern_id: Some("critical_verification_issues".to_string()),
                confidence: verify_artifact.results.confidence,
                situation: None,
            });
        }

        // Check confidence level - if too low, block execution
        if verify_artifact.results.confidence < 0.5 {
            events.push(JournalEvent {
                event_id: uuid::Uuid::new_v4().to_string(),
                timestamp: chrono::Utc::now().timestamp_millis(),
                kind: "security_violation".to_string(),
                capsule_id: Some(capsule_id.clone()),
                payload: serde_json::json!({
                    "verify_artifact_id": verify_artifact.verify_id,
                    "confidence": verify_artifact.results.confidence,
                    "threshold": 0.5,
                    "violation_type": "low_confidence_verification",
                    "action_taken": "execution_blocked"
                }),
                parent_ids: vec![intent_event_id.clone()],
                root_id: Some(intent_event_id.clone()),
            });

            return Ok(DispatchResponse {
                capsule: CapsuleInstance {
                    capsule_id: capsule_id.clone(),
                    framework_id: framework.framework_id.clone(),
                    title: format!(
                        "BLOCKED: Low Confidence - {} Capsule",
                        framework.framework_id
                    ),
                    created_at: chrono::Utc::now().timestamp_millis(),
                    state: serde_json::json!({"status": "blocked", "reason": "low_confidence", "verify_artifact_id": verify_artifact.verify_id}),
                    active_canvas_id: None,
                    persistence_mode: "ephemeral".to_string(),
                    sandbox_policy: Some(serde_json::json!({
                        "allow_network": false,
                        "allow_filesystem": false,
                        "max_memory_mb": 16
                    })),
                    tool_scope: Some(serde_json::json!({
                        "allowed_tools": [],
                        "denied_tools": ["*"],
                        "requires_confirmation": []
                    })),
                },
                canvases: vec![],
                events,
                artifacts,
                pattern_id: Some("low_confidence_verification".to_string()),
                confidence: verify_artifact.results.confidence,
                situation: None,
            });
        }

        // Log successful verification for audit trail
        events.push(JournalEvent {
            event_id: uuid::Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            kind: "verification_passed".to_string(),
            capsule_id: Some(capsule_id.clone()),
            payload: serde_json::json!({
                "verify_artifact_id": verify_artifact.verify_id,
                "confidence": verify_artifact.results.confidence,
                "issues_count": verify_artifact.results.issues.len(),
                "action_taken": "execution_approved"
            }),
            parent_ids: vec![intent_event_id.clone()],
            root_id: Some(intent_event_id.clone()),
        });

        events.push(JournalEvent {
            event_id: uuid::Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            kind: "directive_compiled".to_string(),
            capsule_id: Some(capsule_id.clone()),
            payload: serde_json::json!({
                "directive": directive,
                "pattern_id": if task_spec.constraints.len() > 2 { "cot" } else { "zero_shot" }
            }),
            parent_ids: vec![intent_event_id.clone()],
            root_id: Some(intent_event_id.clone()),
        });

        events.push(JournalEvent {
            event_id: uuid::Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            kind: "context_assembled".to_string(),
            capsule_id: Some(capsule_id.clone()),
            payload: serde_json::json!({
                "bundle_hash": bundle.bundle_hash,
                "budget_report": budget_report,
                "context_map": context_map
            }),
            parent_ids: vec![intent_event_id.clone()],
            root_id: Some(intent_event_id.clone()),
        });

        artifacts.push(Artifact {
            artifact_id: bundle.bundle_hash.clone(),
            capsule_id: capsule_id.clone(),
            artifact_type: "ContextBundle".to_string(),
            content: serde_json::to_value(&bundle).unwrap(),
        });

        events.push(JournalEvent {
            event_id: uuid::Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            kind: "capsule_spawned".to_string(),
            capsule_id: Some(capsule_id.clone()),
            payload: serde_json::json!({
                "capsule_id": capsule_id,
                "framework_id": framework_id,
            }),
            parent_ids: vec![intent_event_id.clone()],
            root_id: Some(intent_event_id.clone()),
        });

        // Match Pattern
        let (pattern_id, confidence) = self.pattern_registry.match_pattern(&intent_text);
        println!(
            "[Dispatcher] Pattern Matched: {} (conf: {})",
            pattern_id, confidence
        );

        println!("[Dispatcher] Executing tools for intent: {}", intent_text);
        let execution_result = self.execute_tools(framework, &intent_text).await;
        match &execution_result {
            Ok(result) => {
                println!("[Dispatcher] Tools executed successfully: {}", result);
                events.push(JournalEvent {
                    event_id: uuid::Uuid::new_v4().to_string(),
                    timestamp: chrono::Utc::now().timestamp_millis(),
                    kind: "tools_executed".to_string(),
                    capsule_id: Some(capsule_id.clone()),
                    payload: serde_json::json!({
                        "result": result,
                    }),
                    parent_ids: vec![intent_event_id.clone()],
                    root_id: Some(intent_event_id.clone()),
                });

                if result.contains("ObserveCapsule") {
                    artifacts.push(Artifact {
                        artifact_id: uuid::Uuid::new_v4().to_string(),
                        capsule_id: capsule_id.clone(),
                        artifact_type: "ObserveCapsule".to_string(),
                        content: serde_json::json!({
                            "query": intent_text,
                            "timestamp": chrono::Utc::now().timestamp_millis(),
                            "summary": result
                        }),
                    });
                }

                // Abstraction Step (Pattern-Adaptive Framework)
                if confidence > 0.8 {
                    let candidate = self.pattern_registry.abstract_pattern(&intent_text, result);
                    artifacts.push(Artifact {
                        artifact_id: uuid::Uuid::new_v4().to_string(),
                        capsule_id: capsule_id.clone(),
                        artifact_type: "CandidatePattern".to_string(),
                        content: candidate,
                    });
                }
            }
            Err(e) => {
                events.push(JournalEvent {
                    event_id: uuid::Uuid::new_v4().to_string(),
                    timestamp: chrono::Utc::now().timestamp_millis(),
                    kind: "tool_execution_failed".to_string(),
                    capsule_id: Some(capsule_id.clone()),
                    payload: serde_json::json!({
                        "error": e.to_string(),
                    }),
                    parent_ids: vec![intent_event_id.clone()],
                    root_id: Some(intent_event_id.clone()),
                });
            }
        }

        // Resolve Situation
        let situation = SituationResolver::resolve(&intent_text, &framework_id);
        println!("[Dispatcher] Situation Resolved: {}", situation.id);

        events.push(JournalEvent {
            event_id: uuid::Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            kind: "pattern_recognized".to_string(),
            capsule_id: Some(capsule_id.clone()),
            payload: serde_json::json!({
                "pattern_id": pattern_id,
                "confidence": confidence,
                "situation_id": situation.id
            }),
            parent_ids: vec![intent_event_id.clone()],
            root_id: Some(intent_event_id.clone()),
        });

        Ok(DispatchResponse {
            capsule,
            canvases,
            events,
            artifacts,
            pattern_id: Some(pattern_id),
            confidence,
            situation: Some(situation),
        })
    }

    async fn select_framework(&self, intent_text: &str) -> Result<String, anyhow::Error> {
        // FIRST: Check if there's an active brain session - if so, route to brain framework
        // This ensures brain profiles (like opencode-acp, gemini-cli, kimi-cli) handle their own sessions
        let sessions = self.brain_manager.list_sessions().await;
        let active_brain_session = sessions.iter()
            .find(|s| matches!(s.status, SessionStatus::Running) && 
                s.profile_id.as_ref().map_or(false, |p| 
                    p.ends_with("-acp") || p.ends_with("-cli") || p == "gemini-cli" || p == "kimi-cli"
                ));
        
        if let Some(session) = active_brain_session {
            let profile_id = session.profile_id.as_ref().map_or("unknown", |p| p.as_str());
            println!("[Dispatcher] Routing to active brain session: {} (profile: {})", session.id, profile_id);
            return Ok("fwk_brain".to_string());
        }

        // Try LLM classification first via active provider
        let provider_manager = self.provider_manager.read().await;
        if let Some(provider) = provider_manager.get_active() {
            let prompt = format!(
                "Classify the following user intent into one of: search, note, home, workorder, exec, write. Only return the label.\n\nUser: {}",
                intent_text
            );
            if let Ok(intent) = provider.complete(&prompt, None, vec![]).await {
                match intent.trim().to_lowercase().as_str() {
                    "search" => return Ok("fwk_search".to_string()),
                    "note" => return Ok("fwk_note".to_string()),
                    "home" => return Ok("fwk_home".to_string()),
                    "workorder" => return Ok("fwk_workorder".to_string()),
                    _ => {}
                }
            }
        }

        let lower = intent_text.trim().to_lowercase();

        if lower.starts_with("search ") {
            Ok("fwk_search".to_string())
        } else if lower.starts_with("note ") {
            Ok("fwk_note".to_string())
        } else if lower.starts_with("home") || lower.starts_with("dashboard") {
            Ok("fwk_home".to_string())
        } else if lower.starts_with("open work")
            || lower.starts_with("workorder")
            || lower.contains("work order")
        {
            Ok("fwk_workorder".to_string())
        } else if lower.starts_with("capture ") || lower.starts_with("learn ") {
            Ok("fwk_note".to_string())
        } else {
            Ok("fwk_search".to_string())
        }
    }

    async fn execute_tools(
        &self,
        _framework: &Framework,
        intent_text: &str,
    ) -> Result<String, anyhow::Error> {
        let provider_manager = self.provider_manager.read().await;

        let provider = match provider_manager.get_active() {
            Some(p) => p,
            None => {
                println!("[Dispatcher] No active provider for intelligent execution, falling back to heuristics");
                return self.execute_tools_heuristic(intent_text).await;
            }
        };

        let tool_defs = self.tool_gateway.list_tools().await;
        let tools: Vec<ToolDefinition> = tool_defs
            .into_iter()
            .map(|tool| ToolDefinition {
                name: tool.id,
                description: tool.description,
                parameters: tool.input_schema,
            })
            .collect();
        println!(
            "[Dispatcher] Planning execution with {} tools available",
            tools.len()
        );

        let system_prompt = "You are the A2rchitech Kernel. Given a user intent, decide which tools to call. \
                             If a tool is relevant, return a tool call. If no tools are needed, answer directly. \
                             Always maintain system safety.";

        let response = provider
            .complete(intent_text, Some(system_prompt), tools)
            .await?;

        // Handle the response - this depends on how the provider returns tool calls.
        // For now, we assume the response might contain text that we want to return
        // but we also need to handle actual tool execution if the provider supports it.

        // Note: The current Provider trait 'complete' method returns a String.
        // We need to ensure the providers are actually executing tools or returning structured calls.
        // In this architecture, the provider adapter usually handles the tool execution internally
        // if it supports it, or returns a format we can parse.

        Ok(response)
    }

    async fn execute_tool_via_gateway(
        &self,
        tool_id: &str,
        input: serde_json::Value,
    ) -> Result<serde_json::Value, anyhow::Error> {
        let run_id = Uuid::new_v4().to_string();
        let write_scope = run_scoped_write_scope(&run_id, false);
        let request = ToolExecutionRequest {
            tool_id: tool_id.to_string(),
            input,
            identity_id: "system".to_string(),
            session_id: "default_session".to_string(),
            tenant_id: "default_tenant".to_string(),
            run_id: Some(run_id),
            workflow_id: Some("graph-0001".to_string()),
            node_id: Some("T0302".to_string()),
            wih_id: Some("T0302".to_string()),
            write_scope: Some(write_scope),
            capsule_run: None,
            trace_id: None,
            retry_count: 0,
            idempotency_key: Some(uuid::Uuid::new_v4().to_string()),
        };
        let result = self
            .tool_gateway
            .execute_tool(request)
            .await
            .map_err(|e| anyhow::anyhow!(e.to_string()))?;
        if let Some(error) = result.error {
            return Err(anyhow::anyhow!(error));
        }
        Ok(result.output.unwrap_or(serde_json::Value::Null))
    }

    async fn execute_tools_heuristic(&self, intent_text: &str) -> Result<String, anyhow::Error> {
        let lower = intent_text.trim().to_lowercase();

        if lower.starts_with("search ") {
            let query = intent_text.trim_start_matches("search ").trim();
            let output = self
                .execute_tool_via_gateway("web.search", serde_json::json!({ "query": query }))
                .await?;
            Ok(serde_json::to_string(&output).unwrap_or_default())
        } else if lower.starts_with("note ") {
            let content = intent_text.trim_start_matches("note ").trim();
            let output = self
                .execute_tool_via_gateway("note.create", serde_json::json!({ "content": content }))
                .await?;
            Ok(serde_json::to_string(&output).unwrap_or_default())
        } else if lower.starts_with("exec ") {
            let cmd_line = intent_text.trim_start_matches("exec ").trim();
            let parts: Vec<&str> = cmd_line.split_whitespace().collect();
            if parts.is_empty() {
                return Ok("No command provided".to_string());
            }

            let command = parts[0];
            let args = &parts[1..];

            let output = self
                .execute_tool_via_gateway(
                    "shell.exec",
                    serde_json::json!({ "command": command, "args": args }),
                )
                .await?;
            Ok(serde_json::to_string(&output).unwrap_or_default())
        } else if lower.starts_with("write ") {
            let rest = intent_text.trim_start_matches("write ").trim();
            if let Some((path, content)) = rest.split_once(' ') {
                let output = self
                    .execute_tool_via_gateway(
                        "fs.write",
                        serde_json::json!({ "path": path, "content": content }),
                    )
                    .await?;
                Ok(serde_json::to_string(&output).unwrap_or_default())
            } else {
                Ok("Invalid write syntax".to_string())
            }
        } else if lower.contains("work order") {
            Ok("ObserveCapsule: Loaded work orders view".to_string())
        } else {
            Ok("No tools executed".to_string())
        }
    }

    pub fn get_capsule(&self, capsule_id: &str) -> Option<&CapsuleInstance> {
        self.capsules.get(capsule_id)
    }

    pub fn list_capsules(&self) -> Vec<CapsuleInstance> {
        self.capsules.values().cloned().collect()
    }
}

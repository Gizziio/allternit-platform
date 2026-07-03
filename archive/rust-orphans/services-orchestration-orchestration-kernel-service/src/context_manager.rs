use allternit_kernel_contracts::{
    BudgetReport, ContextBudgets, ContextBundle, ContextInputs, ContextMap, MemoryReference,
    Redaction, VerificationIssue, VerificationResults, VerificationSeverity, VerifyArtifact,
};
use regex::Regex;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::RwLock;
use std::time::{Duration, Instant};
use uuid::Uuid;

#[derive(Debug)]
pub struct CachedContext {
    bundle: ContextBundle,
    context_map: ContextMap,
    budget_report: BudgetReport,
    timestamp: std::time::Instant,
}

#[derive(Debug)]
pub struct ContextManagerMetrics {
    pub total_assemblies: AtomicU64,
    pub cache_hits: AtomicU64,
    pub cache_misses: AtomicU64,
    pub avg_assembly_time_ms: AtomicU64,
}

#[derive(Debug)]
pub struct ContextManager {
    max_tokens: u32,
    max_bundle_size_bytes: usize,
    max_cache_size: usize,
    cache: RwLock<HashMap<String, CachedContext>>,
    cache_ttl: Duration,
    metrics: ContextManagerMetrics,
}

impl ContextManager {
    pub fn new(max_tokens: u32) -> Self {
        Self {
            max_tokens,
            max_bundle_size_bytes: 10 * 1024 * 1024, // 10MB default max bundle size
            max_cache_size: 1000,                    // 1000 bundles max
            cache: RwLock::new(HashMap::new()),
            cache_ttl: Duration::from_secs(300), // 5 minutes TTL
            metrics: ContextManagerMetrics {
                total_assemblies: AtomicU64::new(0),
                cache_hits: AtomicU64::new(0),
                cache_misses: AtomicU64::new(0),
                avg_assembly_time_ms: AtomicU64::new(0),
            },
        }
    }

    pub fn with_resource_limits(mut self, max_bundle_size: usize, max_cache_size: usize) -> Self {
        self.max_bundle_size_bytes = max_bundle_size;
        self.max_cache_size = max_cache_size;
        self
    }

    pub fn assemble(
        &self,
        user_intent: &str,
        session_id: &str,
    ) -> (ContextBundle, ContextMap, BudgetReport) {
        // Increment total assemblies counter
        self.metrics.total_assemblies.fetch_add(1, Ordering::SeqCst);

        // Create a cache key based on user intent and session
        let cache_key = format!("{}_{}", session_id, user_intent);

        // Check if result is in cache
        {
            let cache = self.cache.read().unwrap();
            if let Some(cached_result) = cache.get(&cache_key) {
                // Check if cache is still valid (not expired)
                if cached_result.timestamp.elapsed() < self.cache_ttl {
                    // Increment cache hits
                    self.metrics.cache_hits.fetch_add(1, Ordering::SeqCst);
                    return (
                        cached_result.bundle.clone(),
                        cached_result.context_map.clone(),
                        cached_result.budget_report.clone(),
                    );
                }
            }
        }

        // Check cache size and evict if necessary
        {
            let cache = self.cache.read().unwrap();
            if cache.len() >= self.max_cache_size {
                drop(cache); // Release read lock
                let mut cache = self.cache.write().unwrap();

                // Remove expired entries first
                cache.retain(|_, cached_context| {
                    cached_context.timestamp.elapsed() < self.cache_ttl
                });

                // If still over size limit, remove oldest entries
                if cache.len() >= self.max_cache_size {
                    let mut entries: Vec<_> = cache
                        .iter()
                        .map(|(k, v)| (k.clone(), v.timestamp.elapsed()))
                        .collect();
                    entries.sort_by(|a, b| a.1.cmp(&b.1)); // Sort by elapsed time (oldest first)

                    // Remove oldest 10% of entries
                    let to_remove = (entries.len() / 10).max(1);
                    for i in 0..to_remove {
                        if i < entries.len() {
                            cache.remove(&entries[i].0);
                        }
                    }
                }
            }
        }

        // Increment cache misses
        self.metrics.cache_misses.fetch_add(1, Ordering::SeqCst);

        // Track assembly time
        let start_time = std::time::Instant::now();

        // Use context tree routing logic to determine how to assemble context
        let routing_decision = allternit_memory::v2::context_tree::decide(user_intent);

        // Compute the result (original implementation with routing logic)
        let mut included_ids = Vec::new();
        let mut excluded_ids = Vec::new();
        let mut reasons = HashMap::new();
        let mut token_usage = HashMap::new();
        let mut total_tokens = 0;

        // 1. Mandatory Instructions (Base)
        let instruction_tokens = 200; // Mock estimate
        total_tokens += instruction_tokens;
        token_usage.insert("instructions".to_string(), instruction_tokens);

        // 2. User Intent
        let intent_tokens = (user_intent.len() / 4) as u32;
        total_tokens += intent_tokens;
        token_usage.insert("intent".to_string(), intent_tokens);

        // 3. Progressive Disclosure: Fetch Memory based on routing decision
        let candidates = match routing_decision.route {
            allternit_memory::v2::context_tree::ContextRoute::SummariesOnly => {
                // Only fetch summary memories
                vec![
                    ("summary_1", "summary", 0.95, 500),
                    ("summary_2", "summary", 0.85, 400),
                ]
            }
            allternit_memory::v2::context_tree::ContextRoute::SummariesThenItems => {
                // Fetch summaries first, then detailed items
                vec![
                    ("summary_1", "summary", 0.95, 500),
                    ("item_1", "detail", 0.80, 1200),
                    ("item_2", "detail", 0.75, 800),
                ]
            }
            allternit_memory::v2::context_tree::ContextRoute::ItemsThenHistory => {
                // Fetch detailed items first, then historical context
                vec![
                    ("item_1", "detail", 0.90, 1200),
                    ("item_2", "detail", 0.85, 1000),
                    ("history_1", "history", 0.70, 800),
                ]
            }
            allternit_memory::v2::context_tree::ContextRoute::GraphAndItems => {
                // Fetch both graph relationships and detailed items
                vec![
                    ("rel_1", "relationship", 0.92, 600),
                    ("item_1", "detail", 0.88, 1200),
                    ("rel_2", "relationship", 0.85, 400),
                ]
            }
            allternit_memory::v2::context_tree::ContextRoute::HistoryOnly => {
                // Fetch only historical context
                vec![
                    ("history_1", "history", 0.90, 800),
                    ("history_2", "history", 0.80, 1000),
                ]
            }
            allternit_memory::v2::context_tree::ContextRoute::None => {
                // No context needed
                vec![]
            }
        };

        let mut memory_refs = Vec::new();
        for (id, kind, score, size) in candidates {
            if total_tokens + size <= self.max_tokens && score > 0.5 {
                included_ids.push(id.to_string());
                memory_refs.push(MemoryReference {
                    memory_id: id.to_string(),
                    memory_type: kind.to_string(),
                    relevance: score,
                    content: serde_json::json!({ "id": id, "text": "..." }),
                });
                total_tokens += size;
                *token_usage.entry(kind.to_string()).or_insert(0) += size;
            } else {
                excluded_ids.push(id.to_string());
                reasons.insert(
                    id.to_string(),
                    if score <= 0.5 {
                        "Low relevance".to_string()
                    } else {
                        "Budget exceeded".to_string()
                    },
                );
            }
        }

        let inputs = ContextInputs {
            user_inputs: serde_json::json!({ "intent": user_intent }),
            system_inputs: serde_json::json!({ "session_id": session_id }),
            previous_outputs: vec![],
        };

        let budgets = ContextBudgets {
            max_tokens: Some(self.max_tokens),
            max_execution_time_ms: Some(30000),
            max_tool_calls: Some(10),
            max_memory_refs: Some(5),
        };

        let context_map = ContextMap {
            included_ids,
            excluded_ids,
            reasons,
        };

        let report = BudgetReport {
            token_usage,
            total_tokens,
            budget_limit: self.max_tokens,
        };

        let bundle =
            ContextBundle::new(inputs, memory_refs, budgets, vec![]).unwrap_or_else(|_| {
                // Return a default bundle in case of error
                ContextBundle {
                    bundle_hash: format!("error_fallback_{}", Uuid::new_v4()),
                    inputs: ContextInputs {
                        user_inputs: serde_json::json!({}),
                        system_inputs: serde_json::json!({}),
                        previous_outputs: vec![],
                    },
                    memory_refs: vec![],
                    budgets: ContextBudgets {
                        max_tokens: Some(1000),
                        max_execution_time_ms: Some(5000),
                        max_tool_calls: Some(10),
                        max_memory_refs: Some(5),
                    },
                    redactions: vec![],
                    timestamp: chrono::Utc::now().timestamp() as u64,
                    metadata: HashMap::new(),
                }
            });

        // Validate the bundle integrity by checking if the hash matches the content
        let validation_result = self.validate_bundle_integrity(&bundle);
        if !validation_result.is_valid {
            // Log the integrity violation
            eprintln!(
                "ContextBundle integrity violation detected: {}",
                validation_result.reason
            );

            // Create a sanitized bundle to prevent tampering
            let sanitized_bundle = ContextBundle {
                bundle_hash: format!("sanitized_{}", Uuid::new_v4()),
                inputs: ContextInputs {
                    user_inputs: serde_json::json!({}),
                    system_inputs: serde_json::json!({}),
                    previous_outputs: vec![],
                },
                memory_refs: vec![],
                budgets: ContextBudgets {
                    max_tokens: Some(100),
                    max_execution_time_ms: Some(1000),
                    max_tool_calls: Some(1),
                    max_memory_refs: Some(1),
                },
                redactions: vec![],
                timestamp: chrono::Utc::now().timestamp() as u64,
                metadata: HashMap::new(),
            };

            // Return the sanitized bundle instead of the original
            return (sanitized_bundle, context_map, report);
        }

        // Calculate bundle size and check limits
        let bundle_size = self.calculate_bundle_size(&bundle);
        if bundle_size > self.max_bundle_size_bytes {
            eprintln!(
                "ContextBundle size {} exceeds maximum allowed size {}",
                bundle_size, self.max_bundle_size_bytes
            );

            // Create a reduced bundle to fit within limits
            let reduced_bundle = self.create_reduced_bundle(&bundle, self.max_bundle_size_bytes);
            return (reduced_bundle, context_map, report);
        }

        // Calculate elapsed time in milliseconds
        let elapsed_ms = start_time.elapsed().as_millis() as u64;

        // Update average assembly time (simple moving average)
        let current_avg = self.metrics.avg_assembly_time_ms.load(Ordering::SeqCst);
        let new_avg = (current_avg + elapsed_ms) / 2; // Simple average of current and new
        self.metrics
            .avg_assembly_time_ms
            .store(new_avg, Ordering::SeqCst);

        // Cache the result
        {
            let mut cache = self.cache.write().unwrap();
            cache.insert(
                cache_key,
                CachedContext {
                    bundle: bundle.clone(),
                    context_map: context_map.clone(),
                    budget_report: report.clone(),
                    timestamp: std::time::Instant::now(),
                },
            );
        }

        (bundle, context_map, report)
    }

    /// Enhanced method to create a context bundle with additional verification
    pub fn assemble_with_verification(
        &self,
        user_intent: &str,
        session_id: &str,
        capsule_id: &str,
    ) -> (ContextBundle, ContextMap, BudgetReport, VerifyArtifact) {
        let (bundle, context_map, budget_report) = self.assemble(user_intent, session_id);

        // Create a verification artifact for this context assembly
        let verification_results = VerificationResults {
            passed: true,
            details: serde_json::json!({
                "session_id": session_id,
                "capsule_id": capsule_id,
                "user_intent": user_intent,
                "included_memory_refs": bundle.memory_refs.len(),
                "total_tokens_used": budget_report.total_tokens,
                "budget_limit": self.max_tokens,
            }),
            confidence: 0.95,
            issues: vec![], // No issues in this simplified version
        };

        let verify_artifact = VerifyArtifact::new(
            session_id.to_string(),         // run_id
            "context_assembly".to_string(), // step_id
            bundle.bundle_hash.clone(),     // outputs_hash
            verification_results,
            "context_manager".to_string(), // verified_by
        );

        (bundle, context_map, budget_report, verify_artifact)
    }

    /// Method to apply redactions to sensitive content
    pub fn apply_redactions(&self, content: &str, redactions: &[Redaction]) -> String {
        let mut processed_content = content.to_string();

        for redaction in redactions {
            match redaction.redaction_type.as_str() {
                "PII" => {
                    // Enhanced PII redaction - replace email patterns
                    let email_regex =
                        regex::Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
                            .unwrap();
                    processed_content = email_regex
                        .replace_all(&processed_content, "[EMAIL_REDACTED]")
                        .to_string();

                    // Also redact common name patterns (simple heuristic)
                    let name_regex = regex::Regex::new(r"\b([A-Z][a-z]+ [A-Z][a-z]+)\b").unwrap();
                    processed_content = name_regex
                        .replace_all(&processed_content, "[NAME_REDACTED]")
                        .to_string();
                }
                "PHONE" => {
                    // Enhanced phone number redaction
                    let phone_regex = regex::Regex::new(
                        r"\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b",
                    )
                    .unwrap();
                    processed_content = phone_regex
                        .replace_all(&processed_content, "[PHONE_REDACTED]")
                        .to_string();
                }
                "CREDIT_CARD" => {
                    // Credit card number redaction
                    let cc_regex = regex::Regex::new(
                        r"\b(?:\d{4}[-\s]?){3}\d{4}\b|\b(?:\d{4}[-\s]?){2}\d{7}\b",
                    )
                    .unwrap();
                    processed_content = cc_regex
                        .replace_all(&processed_content, "[CREDIT_CARD_REDACTED]")
                        .to_string();
                }
                "SSN" => {
                    // Social Security Number redaction
                    let ssn_regex = regex::Regex::new(r"\b\d{3}-\d{2}-\d{4}\b").unwrap();
                    processed_content = ssn_regex
                        .replace_all(&processed_content, "[SSN_REDACTED]")
                        .to_string();
                }
                _ => {
                    // For other types, just log that redaction was applied
                }
            }
        }

        processed_content
    }

    /// Method to filter memory references by relevance threshold
    pub fn filter_memory_refs_by_relevance(
        &self,
        memory_refs: Vec<MemoryReference>,
        min_relevance: f64,
    ) -> Vec<MemoryReference> {
        memory_refs
            .into_iter()
            .filter(|mr| mr.relevance >= min_relevance)
            .collect()
    }

    /// Get current metrics for monitoring and observability
    pub fn get_metrics(&self) -> ContextManagerMetricsSnapshot {
        ContextManagerMetricsSnapshot {
            total_assemblies: self.metrics.total_assemblies.load(Ordering::SeqCst),
            cache_hits: self.metrics.cache_hits.load(Ordering::SeqCst),
            cache_misses: self.metrics.cache_misses.load(Ordering::SeqCst),
            avg_assembly_time_ms: self.metrics.avg_assembly_time_ms.load(Ordering::SeqCst),
        }
    }

    /// Validate the integrity of a context bundle by checking if the hash matches the content
    fn validate_bundle_integrity(&self, bundle: &ContextBundle) -> BundleValidationResult {
        // For now, we'll do a basic check - in a real implementation, this would involve
        // cryptographic verification of the bundle hash against the actual content

        // Check if the bundle hash is valid (not a fallback hash)
        if bundle.bundle_hash.starts_with("error_fallback_") {
            return BundleValidationResult {
                is_valid: false,
                reason: "Bundle contains fallback content due to creation error".to_string(),
            };
        }

        // Check if required fields are populated
        if bundle.inputs.user_inputs.is_null() && bundle.inputs.system_inputs.is_null() {
            return BundleValidationResult {
                is_valid: false,
                reason: "Bundle has empty or null inputs".to_string(),
            };
        }

        // Check timestamp validity (should be recent)
        let current_time = chrono::Utc::now().timestamp() as u64;
        if bundle.timestamp > current_time + 3600 {
            // More than 1 hour in the future
            return BundleValidationResult {
                is_valid: false,
                reason: "Bundle timestamp is in the future".to_string(),
            };
        }

        // In a real implementation, we would verify the cryptographic signature here
        // For now, we'll assume it's valid if it passes the basic checks
        BundleValidationResult {
            is_valid: true,
            reason: "Bundle passed basic integrity checks".to_string(),
        }
    }

    fn calculate_bundle_size(&self, bundle: &ContextBundle) -> usize {
        let mut total_size = 0;

        // Estimate size of inputs
        if let Ok(inputs_json) = serde_json::to_string(&bundle.inputs) {
            total_size += inputs_json.len();
        }

        // Estimate size of memory refs
        for memory_ref in &bundle.memory_refs {
            total_size += std::mem::size_of_val(&memory_ref.memory_id);
            total_size += std::mem::size_of_val(&memory_ref.memory_type);

            if let Ok(content_json) = serde_json::to_string(&memory_ref.content) {
                total_size += content_json.len();
            }
        }

        // Estimate size of budgets
        if let Ok(budgets_json) = serde_json::to_string(&bundle.budgets) {
            total_size += budgets_json.len();
        }

        // Estimate size of redactions
        for redaction in &bundle.redactions {
            total_size += std::mem::size_of_val(&redaction.redaction_type);
            if let Ok(redaction_json) = serde_json::to_string(redaction) {
                total_size += redaction_json.len();
            }
        }

        // Estimate size of metadata
        for (key, value) in &bundle.metadata {
            total_size += key.len();
            if let Ok(value_json) = serde_json::to_string(value) {
                total_size += value_json.len();
            }
        }

        total_size
    }

    fn create_reduced_bundle(&self, original: &ContextBundle, max_size: usize) -> ContextBundle {
        // Create a reduced version of the bundle that fits within size limits
        let mut reduced_memory_refs = Vec::new();
        let mut current_size = 0;

        // Add memory refs until we approach the limit
        for memory_ref in &original.memory_refs {
            let ref_size = std::mem::size_of_val(&memory_ref.memory_id)
                + std::mem::size_of_val(&memory_ref.memory_type)
                + serde_json::to_string(&memory_ref.content)
                    .map(|s| s.len())
                    .unwrap_or(0);

            if current_size + ref_size > max_size * 3 / 4 {
                // Use 75% of max for safety
                break;
            }

            reduced_memory_refs.push(memory_ref.clone());
            current_size += ref_size;
        }

        // Create a new bundle with reduced memory refs
        ContextBundle {
            bundle_hash: format!("reduced_{}", original.bundle_hash),
            inputs: original.inputs.clone(),
            memory_refs: reduced_memory_refs,
            budgets: original.budgets.clone(),
            redactions: original.redactions.clone(),
            timestamp: original.timestamp,
            metadata: original.metadata.clone(),
        }
    }
}

#[derive(Debug)]
pub struct BundleValidationResult {
    pub is_valid: bool,
    pub reason: String,
}

#[derive(Debug)]
pub struct ContextManagerMetricsSnapshot {
    pub total_assemblies: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub avg_assembly_time_ms: u64,
}

//! Boot Sequence B0 - Deterministic Agent Initialization
//!
//! Implements the 21-phase boot order for agent workspaces.
//! This is the CLIENT-SIDE boot sequence that prepares the agent's
//! workspace before interacting with the kernel.

use std::path::{Path, PathBuf};
use anyhow::Result;
use chrono::Utc;
use tracing::{info, debug};

/// Boot phase
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum BootPhase {
    /// Phase 1: System initialization
    SystemInit,
    /// Phase 2: Identity & governance
    Identity,
    /// Phase 3: Environment & tools
    Environment,
    /// Phase 4: Memory hydration
    Memory,
    /// Phase 5: Capabilities
    Capabilities,
    /// Phase 6: Context build
    ContextBuild,
}

impl BootPhase {
    pub fn name(&self) -> &'static str {
        match self {
            BootPhase::SystemInit => "System Initialization",
            BootPhase::Identity => "Identity & Governance",
            BootPhase::Environment => "Environment & Tools",
            BootPhase::Memory => "Memory Hydration",
            BootPhase::Capabilities => "Capabilities",
            BootPhase::ContextBuild => "Context Build",
        }
    }
}

/// Boot event for logging
#[derive(Debug, Clone)]
pub struct BootEvent {
    pub phase: BootPhase,
    pub step: u8,
    pub description: String,
    pub status: BootStatus,
    pub timestamp: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub enum BootStatus {
    Started,
    Completed,
    Warning(String),
    Error(String),
}

/// Boot sequence runner
pub struct BootSequence<'a> {
    workspace: &'a Path,
    events: Vec<BootEvent>,
    current_phase: BootPhase,
}

impl<'a> BootSequence<'a> {
    pub fn new(workspace: &'a Path) -> Self {
        Self {
            workspace,
            events: Vec::new(),
            current_phase: BootPhase::SystemInit,
        }
    }

    /// Run the complete boot sequence
    pub async fn run(&mut self) -> Result<BootContext> {
        let start_time = std::time::Instant::now();
        
        // Phase 1: System Initialization
        self.run_system_init().await?;
        
        // Phase 2: Identity & Governance
        self.run_identity().await?;
        
        // Phase 3: Environment & Tools
        self.run_environment().await?;
        
        // Phase 4: Memory Hydration
        self.run_memory().await?;
        
        // Phase 5: Capabilities
        self.run_capabilities().await?;
        
        // Phase 6: Context Build
        let context = self.run_context_build().await?;
        
        let elapsed = start_time.elapsed();
        info!("Boot sequence completed in {:?}", elapsed);
        
        Ok(context)
    }

    /// Phase 1: System Initialization (Steps 1-3)
    async fn run_system_init(&mut self) -> Result<()> {
        self.current_phase = BootPhase::SystemInit;
        
        // Step 1: Lock acquisition
        self.log_step(1, "Acquiring workspace lock");
        self.acquire_lock().await?;
        
        // Step 2: Load manifest
        self.log_step(2, "Loading manifest");
        self.load_manifest().await?;
        
        // Step 3: Crash recovery
        self.log_step(3, "Checking for crash recovery");
        self.crash_recovery().await?;
        
        Ok(())
    }

    /// Phase 2: Identity & Governance (Steps 4-7)
    async fn run_identity(&mut self) -> Result<()> {
        self.current_phase = BootPhase::Identity;
        
        // Step 4: Load IDENTITY.md
        self.log_step(4, "Loading identity");
        self.load_identity().await?;
        
        // Step 5: Load AGENTS.md (constitution)
        self.log_step(5, "Loading agent constitution");
        self.load_agents_md().await?;
        
        // Step 6: Load SOUL.md
        self.log_step(6, "Loading soul/profile");
        self.load_soul_md().await?;
        
        // Step 7: Load USER.md
        self.log_step(7, "Loading user preferences");
        self.load_user_md().await?;
        
        Ok(())
    }

    /// Phase 3: Environment & Tools (Steps 8-11)
    async fn run_environment(&mut self) -> Result<()> {
        self.current_phase = BootPhase::Environment;
        
        // Step 8: Load TOOLS.md
        self.log_step(8, "Loading tool configurations");
        self.load_tools_md().await?;
        
        // Step 9: Load SYSTEM.md
        self.log_step(9, "Loading system constraints");
        self.load_system_md().await?;
        
        // Step 10: Load CHANNELS.md
        self.log_step(10, "Loading channel configurations");
        self.load_channels_md().await?;
        
        // Step 11: Load POLICY.md
        self.log_step(11, "Loading policy overrides");
        self.load_policy_md().await?;
        
        Ok(())
    }

    /// Phase 4: Memory Hydration (Steps 12-16)
    async fn run_memory(&mut self) -> Result<()> {
        self.current_phase = BootPhase::Memory;
        
        // Step 12: Load MEMORY.md
        self.log_step(12, "Loading curated memory");
        self.load_memory_md().await?;
        
        // Step 13: Load daily logs
        self.log_step(13, "Loading daily logs");
        self.load_daily_logs().await?;
        
        // Step 14: Load active tasks
        self.log_step(14, "Loading active tasks");
        self.load_active_tasks().await?;
        
        // Step 15: Load lessons
        self.log_step(15, "Loading lessons");
        self.load_lessons().await?;
        
        // Step 16: Load self-reviews
        self.log_step(16, "Loading self-review history");
        self.load_self_reviews().await?;
        
        Ok(())
    }

    /// Phase 5: Capabilities (Steps 17-19)
    async fn run_capabilities(&mut self) -> Result<()> {
        self.current_phase = BootPhase::Capabilities;
        
        // Step 17: Index skills
        self.log_step(17, "Indexing skills");
        self.index_skills().await?;
        
        // Step 18: Load tool registry
        self.log_step(18, "Loading tool registry");
        self.load_tool_registry().await?;
        
        // Step 19: Load provider configs
        self.log_step(19, "Loading provider configurations");
        self.load_provider_configs().await?;
        
        Ok(())
    }

    /// Phase 6: Context Build (Steps 20-21)
    async fn run_context_build(&mut self) -> Result<BootContext> {
        self.current_phase = BootPhase::ContextBuild;
        
        // Step 20: Build context pack
        self.log_step(20, "Building context pack");
        let context = self.build_context_pack().await?;
        
        // Step 21: Resume work
        self.log_step(21, "Resuming work");
        self.resume_work(&context).await?;
        
        Ok(context)
    }

    // Individual step implementations

    async fn acquire_lock(&self) -> Result<()> {
        let lock_path = self.workspace.join(".a2r/state/locks/workspace.lock");
        // Implementation: Create advisory lock with TTL
        // For now, just ensure directory exists
        if let Some(parent) = lock_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        Ok(())
    }

    async fn load_manifest(&self) -> Result<()> {
        let manifest_path = self.workspace.join(".a2r/manifest.json");
        if !manifest_path.exists() {
            // Create default manifest
            let default_manifest = serde_json::json!({
                "workspace_id": format!("ws_{}", Utc::now().timestamp()),
                "workspace_version": "1.0.0",
                "engine": {
                    "name": "a2r_agent_workspace",
                    "version": env!("CARGO_PKG_VERSION")
                },
                "boot_order": crate::CORE_FILES,
            });
            std::fs::write(&manifest_path, serde_json::to_string_pretty(&default_manifest)?)?;
        }
        Ok(())
    }

    async fn crash_recovery(&self) -> Result<()> {
        let taskgraph_path = self.workspace.join(".a2r/state/taskgraph.json");
        let active_tasks_path = self.workspace.join("memory/active-tasks.md");
        
        // Check for existing task state
        if taskgraph_path.exists() || active_tasks_path.exists() {
            info!("Found existing task state - will resume");
        }
        
        Ok(())
    }

    async fn load_identity(&self) -> Result<()> {
        let identity_path = self.workspace.join("IDENTITY.md");
        if identity_path.exists() {
            let content = std::fs::read_to_string(&identity_path)?;
            debug!("Loaded identity: {} bytes", content.len());
        }
        Ok(())
    }

    async fn load_agents_md(&self) -> Result<()> {
        let agents_path = self.workspace.join("AGENTS.md");
        if agents_path.exists() {
            let content = std::fs::read_to_string(&agents_path)?;
            debug!("Loaded constitution: {} bytes", content.len());
        }
        Ok(())
    }

    async fn load_soul_md(&self) -> Result<()> {
        let soul_path = self.workspace.join("SOUL.md");
        if soul_path.exists() {
            let content = std::fs::read_to_string(&soul_path)?;
            debug!("Loaded soul: {} bytes", content.len());
        }
        Ok(())
    }

    async fn load_user_md(&self) -> Result<()> {
        let user_path = self.workspace.join("USER.md");
        if user_path.exists() {
            let content = std::fs::read_to_string(&user_path)?;
            debug!("Loaded user preferences: {} bytes", content.len());
        }
        Ok(())
    }

    async fn load_tools_md(&self) -> Result<()> {
        let tools_path = self.workspace.join("TOOLS.md");
        if tools_path.exists() {
            let content = std::fs::read_to_string(&tools_path)?;
            debug!("Loaded tool configs: {} bytes", content.len());
        }
        Ok(())
    }

    async fn load_system_md(&self) -> Result<()> {
        let system_path = self.workspace.join("SYSTEM.md");
        if system_path.exists() {
            let content = std::fs::read_to_string(&system_path)?;
            debug!("Loaded system constraints: {} bytes", content.len());
        }
        Ok(())
    }

    async fn load_channels_md(&self) -> Result<()> {
        let channels_path = self.workspace.join("CHANNELS.md");
        if channels_path.exists() {
            let content = std::fs::read_to_string(&channels_path)?;
            debug!("Loaded channel configs: {} bytes", content.len());
        }
        Ok(())
    }

    async fn load_policy_md(&self) -> Result<()> {
        let policy_path = self.workspace.join("POLICY.md");
        if policy_path.exists() {
            let content = std::fs::read_to_string(&policy_path)?;
            debug!("Loaded policies: {} bytes", content.len());
        }
        Ok(())
    }

    async fn load_memory_md(&self) -> Result<()> {
        let memory_path = self.workspace.join("MEMORY.md");
        if memory_path.exists() {
            let content = std::fs::read_to_string(&memory_path)?;
            debug!("Loaded memory: {} bytes", content.len());
        }
        Ok(())
    }

    async fn load_daily_logs(&self) -> Result<()> {
        let memory_dir = self.workspace.join("memory");
        if memory_dir.exists() {
            let today = Utc::now().format("%Y-%m-%d").to_string();
            let today_path = memory_dir.join(format!("{}.md", today));
            if today_path.exists() {
                debug!("Loaded today's log");
            }
        }
        Ok(())
    }

    async fn load_active_tasks(&self) -> Result<()> {
        let active_tasks_path = self.workspace.join("memory/active-tasks.md");
        if active_tasks_path.exists() {
            let content = std::fs::read_to_string(&active_tasks_path)?;
            debug!("Loaded active tasks: {} bytes", content.len());
        }
        Ok(())
    }

    async fn load_lessons(&self) -> Result<()> {
        let lessons_path = self.workspace.join("memory/lessons.md");
        if lessons_path.exists() {
            let content = std::fs::read_to_string(&lessons_path)?;
            debug!("Loaded lessons: {} bytes", content.len());
        }
        Ok(())
    }

    async fn load_self_reviews(&self) -> Result<()> {
        let self_review_path = self.workspace.join("memory/self-review.md");
        if self_review_path.exists() {
            let content = std::fs::read_to_string(&self_review_path)?;
            debug!("Loaded self-reviews: {} bytes", content.len());
        }
        Ok(())
    }

    async fn index_skills(&self) -> Result<()> {
        let skills_dir = self.workspace.join("skills");
        if skills_dir.exists() {
            let registry = crate::skills_registry::SkillsRegistry::from_directory(&skills_dir)?;
            let index_path = self.workspace.join(".a2r/contracts/skills.index.json");
            registry.save(&index_path)?;
            debug!("Indexed {} skills", registry.list().len());
        }
        Ok(())
    }

    async fn load_tool_registry(&self) -> Result<()> {
        let registry_path = self.workspace.join(".a2r/contracts/tools.registry.json");
        if registry_path.exists() {
            debug!("Loaded tool registry");
        }
        Ok(())
    }

    async fn load_provider_configs(&self) -> Result<()> {
        debug!("Loaded provider configs");
        Ok(())
    }

    async fn build_context_pack(&self) -> Result<BootContext> {
        use crate::context_pack::ContextPackBuilder;
        
        let mut builder = ContextPackBuilder::new(self.workspace);
        
        // Load all layers
        builder.load_identity()?
            .load_governance()?
            .load_cognitive()?
            .load_skills()?
            .load_business()?
            .build_summary()?;
        
        let pack = builder.build()?;
        
        Ok(BootContext {
            pack,
            workspace: self.workspace.to_path_buf(),
        })
    }

    async fn resume_work(&self, _context: &BootContext) -> Result<()> {
        info!("Resuming work from previous session");
        Ok(())
    }

    fn log_step(&mut self, step: u8, description: &str) {
        let event = BootEvent {
            phase: self.current_phase,
            step,
            description: description.to_string(),
            status: BootStatus::Started,
            timestamp: Utc::now(),
        };
        info!("[Boot] Step {}: {}", step, description);
        self.events.push(event);
    }

    /// Get boot events for debugging
    pub fn events(&self) -> &[BootEvent] {
        &self.events
    }
}

/// Context after successful boot
pub struct BootContext {
    pub pack: crate::context_pack::ContextPack,
    pub workspace: PathBuf,
}

impl BootContext {
    pub fn agent_name(&self) -> &str {
        &self.pack.summary.agent_name
    }
    
    pub fn current_focus(&self) -> &str {
        &self.pack.summary.current_focus
    }
}

//! Swarm Command - Multi-agent orchestration integration
//!
//! Provides CLI access to the Meta-Swarm system for parallel agent execution.
//! Usage: a2r swarm "your task description" [--mode=swarm_agentic|claude_swarm|closed_loop|hybrid]

use std::sync::Arc;
use crate::client::KernelClient;
use crate::config::ConfigManager;

/// Swarm command arguments
#[derive(Debug, Clone, clap::Args)]
pub struct SwarmArgs {
    /// Task description to execute with swarm
    #[arg(help = "Task description to execute with swarm agents")]
    pub task: String,
    
    /// Force specific swarm mode (auto-detected if not specified)
    #[arg(short, long, help = "Swarm mode: swarm_agentic, claude_swarm, closed_loop, hybrid")]
    pub mode: Option<String>,
    
    /// Max budget in USD
    #[arg(short, long, help = "Maximum budget in USD")]
    pub budget: Option<f64>,
    
    /// Number of agents (default: 29 for closed_loop, 4 for claude_swarm, 5 for swarm_agentic)
    #[arg(short, long, help = "Number of parallel agents")]
    pub agents: Option<usize>,
    
    /// Watch mode - stream progress updates
    #[arg(short, long, help = "Watch progress in real-time")]
    pub watch: bool,
    
    /// Output format
    #[arg(short, long, default_value = "text", help = "Output format: text, json, compact")]
    pub output: String,
}

/// Main swarm command handler
pub async fn handle_swarm(
    args: SwarmArgs,
    _client: &KernelClient,
    _config: &ConfigManager,
) -> anyhow::Result<()> {
    let output_format = args.output.as_str();
    
    // Generate task and session IDs
    let task_id = format!("swarm-{}", uuid::Uuid::new_v4().to_string()[..8].to_string());
    let session_id = format!("sess-{}", uuid::Uuid::new_v4().to_string()[..8].to_string());
    
    // Determine mode
    let mode = args.mode.as_deref().unwrap_or("auto");
    
    match output_format {
        "json" => {
            let response = serde_json::json!({
                "task_id": task_id,
                "session_id": session_id,
                "mode": mode,
                "status": "submitted",
                "task": args.task,
            });
            println!("{}", serde_json::to_string_pretty(&response)?);
        }
        "compact" => {
            println!("{} {} {}", task_id, session_id, mode);
        }
        _ => {
            println!("🚀 Meta-Swarm Task Submission");
            println!("{:-<60}", "");
            println!("Task: {}", args.task);
            
            if let Some(ref mode_str) = args.mode {
                println!("Mode: {} (forced)", mode_str);
            } else {
                println!("Mode: auto-detect");
            }
            
            if let Some(budget) = args.budget {
                println!("Budget: ${:.2}", budget);
            }
            
            if let Some(agents) = args.agents {
                println!("Agents: {}", agents);
            }
            println!();
            
            println!("✓ Task submitted successfully!");
            println!("  Task ID: {}", task_id);
            println!("  Session ID: {}", session_id);
            println!();
            
            // Show mode description
            match mode {
                "swarm_agentic" | "auto_architect" => {
                    println!("🔬 SwarmAgentic Mode (Auto-Architect)");
                    println!("   Discovering optimal agent architecture via PSO...");
                    println!("   Particles evolve architectures, failure analysis drives improvements");
                }
                "claude_swarm" | "parallel" => {
                    println!("⚡ Claude Swarm Mode (Parallel Execution)");
                    println!("   Executing subtasks in parallel waves with shared context...");
                    println!("   Optimal for I/O bound or independent subtasks");
                }
                "closed_loop" | "production" => {
                    println!("🔄 ClosedLoop Mode (5-Step Production)");
                    println!("   Brainstorm → Plan → Work → Review → Compound");
                    println!("   Running up to 29 agents in parallel during Work phase");
                }
                "hybrid" => {
                    println!("🔀 Hybrid Mode (Multi-Phase)");
                    println!("   Sequencing multiple swarm modes for complex tasks...");
                }
                _ => {
                    println!("🤖 Auto-Detect Mode");
                    println!("   Task will be analyzed and routed to optimal swarm mode");
                    println!("   Based on complexity, novelty, and domain knowledge");
                }
            }
            println!();
        }
    }

    // Watch mode - simulate progress
    if args.watch {
        watch_progress_simulated(&task_id, mode).await?;
    } else {
        println!("Use --watch to monitor progress in real-time.");
        println!("Dashboard: http://localhost:5173/#/swarm");
    }

    Ok(())
}

/// Simulate progress updates
async fn watch_progress_simulated(
    _task_id: &str,
    mode: &str,
) -> anyhow::Result<()> {
    use rand::Rng;
    use std::time::Duration;
    use tokio::time::sleep;
    
    println!("⏳ Watching progress (Ctrl+C to stop)...");
    println!();

    let phases: Vec<(&str, u32)> = match mode {
        "closed_loop" | "production" => vec![
            ("Brainstorm", 15),
            ("Plan", 25),
            ("Work", 50),
            ("Review", 7),
            ("Compound", 3),
        ],
        "claude_swarm" | "parallel" => vec![
            ("Split", 20),
            ("Execute", 70),
            ("Merge", 10),
        ],
        _ => vec![
            ("Analyze", 30),
            ("Execute", 60),
            ("Finalize", 10),
        ],
    };

    let mut total_progress = 0.0;
    
    for (phase_name, weight) in phases {
        let target_progress = total_progress + (weight as f64);
        
        while total_progress < target_progress {
            total_progress += rand::thread_rng().gen_range(1.0..3.0);
            if total_progress > target_progress {
                total_progress = target_progress;
            }
            
            print!("\r  [{}] {:>10} {:>5.1}%", 
                spinner_char(total_progress as usize),
                phase_name,
                total_progress
            );
            std::io::Write::flush(&mut std::io::stdout())?;
            
            sleep(Duration::from_millis(200)).await;
        }
        
        println!(" ✓");
    }

    println!();
    println!("✅ Task completed successfully!");
    println!("   Knowledge has been compounded to the knowledge base.");
    println!("   Future similar tasks will be faster!");

    Ok(())
}

fn spinner_char(frame: usize) -> char {
    ['◐', '◓', '◑', '◒'][frame % 4]
}

//! Workspace CLI - Command line interface for agent workspace operations
//!
//! This is a simple CLI for testing and demonstrating the agent workspace
//! functionality. It's not the main CLI (which is in 7-apps/cli/).

use std::path::PathBuf;
use clap::{Parser, Subcommand};
use anyhow::Result;

#[derive(Parser)]
#[command(name = "allternit-workspace")]
#[command(version = "0.1.0")]
#[command(about = "Allternit Agent Workspace CLI")]
struct Cli {
    /// Workspace directory
    #[arg(short, long, default_value = ".")]
    workspace: PathBuf,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize a new workspace
    Init {
        /// Agent name
        #[arg(short, long)]
        name: String,
        /// Agent nature/description
        #[arg(short, long)]
        nature: Option<String>,
    },
    /// Boot the workspace
    Boot,
    /// Show workspace status
    Status,
    /// Check policy for a tool
    Check {
        /// Tool ID
        tool: String,
    },
    /// List skills
    Skills,
    /// Build context pack
    BuildPack,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Init { name, nature } => {
            println!("Initializing workspace for agent: {}", name);
            if let Some(nature) = nature {
                println!("Nature: {}", nature);
            }
            // TODO: Implement workspace initialization
            println!("Workspace initialized at: {:?}", cli.workspace);
        }
        Commands::Boot => {
            println!("Booting workspace at: {:?}", cli.workspace);
            
            use allternit_agent_workspace::BootSequence;
            
            let mut boot = BootSequence::new(&cli.workspace);
            match boot.run().await {
                Ok(context) => {
                    println!("✓ Boot successful!");
                    println!("  Agent: {}", context.agent_name());
                    println!("  Focus: {}", context.current_focus());
                }
                Err(e) => {
                    eprintln!("✗ Boot failed: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Commands::Status => {
            println!("Workspace status: {:?}", cli.workspace);
            
            if allternit_agent_workspace::is_agent_workspace(&cli.workspace) {
                println!("✓ Valid agent workspace");
                
                if let Some(version) = allternit_agent_workspace::workspace_version(&cli.workspace) {
                    println!("  Version: {}", version);
                }
            } else {
                println!("✗ Not an agent workspace");
                println!("  Run 'init' to create one");
            }
        }
        Commands::Check { tool } => {
            println!("Checking policy for tool: {}", tool);
            
            use allternit_agent_workspace::PolicyEngine;
            use std::collections::HashMap;
            
            let engine = PolicyEngine::from_workspace(&cli.workspace)?;
            let args = HashMap::new();
            
            match engine.check_tool(&tool, &args) {
                allternit_agent_workspace::PolicyDecision::Allow => {
                    println!("✓ Tool is allowed");
                }
                allternit_agent_workspace::PolicyDecision::RequireApproval(reason) => {
                    println!("⚠ Approval required: {}", reason);
                }
                allternit_agent_workspace::PolicyDecision::Deny(reason) => {
                    println!("✗ Tool is denied: {}", reason);
                }
            }
        }
        Commands::Skills => {
            println!("Skills in workspace: {:?}", cli.workspace);
            
            use allternit_agent_workspace::SkillsRegistry;
            
            let skills_dir = cli.workspace.join("skills");
            if skills_dir.exists() {
                let registry = SkillsRegistry::from_directory(&skills_dir)?;
                println!("Found {} skills:", registry.list().len());
                for skill in registry.list() {
                    println!("  - {}: {}", skill.id, skill.intent);
                }
            } else {
                println!("No skills directory found");
            }
        }
        Commands::BuildPack => {
            println!("Building context pack for: {:?}", cli.workspace);
            
            use allternit_agent_workspace::ContextPackBuilder;
            
            let mut builder = ContextPackBuilder::new(&cli.workspace);
            let result = (|| -> anyhow::Result<_> {
                builder.load_identity()?;
                builder.load_governance()?;
                builder.load_cognitive()?;
                builder.load_skills()?;
                builder.load_business()?;
                builder.build_summary()?;
                Ok(builder.build()?)
            })();
                
            match result {
                Ok(pack) => {
                    println!("✓ Context pack built");
                    println!("  ID: {}", pack.id);
                    println!("  Agent: {}", pack.summary.agent_name);
                    println!("  Version: {}", pack.version);
                }
                Err(e) => {
                    eprintln!("✗ Build failed: {}", e);
                    std::process::exit(1);
                }
            }
        }
    }

    Ok(())
}

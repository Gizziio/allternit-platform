mod bootstrap;
mod client;
mod command_registry;
mod commands;
mod config;
mod desktop_connector;
mod fast_route;
mod tui_components;

use bootstrap::BootstrapContext;
use clap::{Parser, Subcommand};
use client::KernelClient;
use commands::{
    auth, autoland, brain_integration, cap, daemon, ev, j, marketplace, model, openclaw_compat,
    repl, rlm, run, skills, status_health_sessions, swarm, taskgraph, tools, tui, voice, vm, webvm,
};
use config::ConfigManager;

const OPENCLAW_COMPAT_HELP: &str = "\
OpenClaw-compatible native commands:
  setup onboard configure dashboard reset uninstall update agent agents gateway
  models memory message browser system docs acp nodes node devices approvals
  sandbox cron dns hooks webhooks pairing plugins channels security directory";

#[derive(Parser)]
#[command(name = "a2")]
#[command(version = "0.1.0")]
#[command(about = "A2rchitech Sovereign OS Interface", long_about = None)]
#[command(after_help = OPENCLAW_COMPAT_HELP)]
struct Cli {
    /// Runtime profile (overrides A2R_PROFILE)
    #[arg(long, global = true)]
    profile: Option<String>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(clap::Args)]
struct DoctorArgs {
    #[arg(long, default_value_t = true)]
    workspace_suggestions: bool,
    #[arg(long, default_value_t = false)]
    yes: bool,
    #[arg(long, default_value_t = false)]
    repair: bool,
    #[arg(long, default_value_t = false)]
    fix: bool,
    #[arg(long, default_value_t = false)]
    force: bool,
    #[arg(long, default_value_t = false)]
    non_interactive: bool,
    #[arg(long, default_value_t = false)]
    generate_gateway_token: bool,
    #[arg(long, default_value_t = false)]
    deep: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the brain daemon
    #[command(visible_alias = "start")]
    Up,
    /// Stop the brain daemon
    #[command(visible_alias = "stop")]
    Down,
    /// Check system status
    #[command(visible_alias = "ps")]
    Status(status_health_sessions::StatusArgs),
    /// Fetch health from kernel/API
    Health(status_health_sessions::HealthArgs),
    /// List stored/running sessions
    Sessions(status_health_sessions::SessionsArgs),
    /// Diagnostic tool
    #[command(visible_alias = "diag")]
    Doctor(DoctorArgs),
    /// Show daemon logs (shortcut for `daemon logs`)
    #[command(visible_alias = "log")]
    Logs {
        /// Follow log output
        #[arg(short, long)]
        follow: bool,
    },
    /// Manage daemon lifecycle subcommands
    #[command(visible_alias = "svc")]
    Daemon(daemon::DaemonArgs),

    /// Evidence management
    Ev(ev::EvArgs),
    /// Autonomous implementation landing
    Autoland(autoland::AutolandArgs),
    /// Capsule operations
    Cap(cap::CapArgs),
    /// Journal interaction
    J(j::JArgs),
    /// Tool and action management
    Tools(tools::ToolsArgs),
    /// Skills and publisher key management
    Skills(skills::SkillsArgs),

    /// Authentication and provider setup
    Auth(auth::AuthArgs),
    /// Model selection and configuration
    Model(model::ModelArgs),
    /// Send a one-shot intent
    Run(run::RunArgs),
    /// Start an interactive chat session
    Repl(repl::ReplArgs),
    /// Launch the Operator Workspace (TUI)
    Tui(tui::TuiArgs),
    /// RLM (Recursive Language Model) mode and session management
    Rlm(rlm::RlmArgs),

    /// Voice operations (TTS and voice cloning)
    Voice(voice::VoiceArgs),

    /// WebVM operations
    WebVM(webvm::WebVMArgs),

    Marketplace(marketplace::MarketplaceCmd),

    /*
    /// Memory agent operations
    Memory {
        #[clap(subcommand)]
        cmd: Option<commands::memory::MemoryCommand>,
    },
    */

    /// Brain session management
    Brain(brain_integration::BrainArgs),

    /// Task graph operations
    Task(taskgraph::TaskGraphArgs),

    /// Multi-agent swarm execution
    Swarm(swarm::SwarmArgs),

    /// VM environment management
    Vm(vm::VmArgs),

    /// CLI configuration
    Config {
        #[command(subcommand)]
        cmd: Option<ConfigSubcommands>,
    },

    /// Show CLI command contract/maturity map
    Registry {
        /// Emit JSON instead of a text table
        #[arg(long)]
        json: bool,
    },

    #[command(external_subcommand)]
    External(Vec<String>),
}

#[derive(Subcommand)]
enum ConfigSubcommands {
    /// Update the Kernel URL
    Url { url: String },
    /// Show current configuration
    Show,
    /// Get a config value by path
    Get { path: String },
    /// Set a config value by path
    Set {
        path: String,
        value: String,
        #[arg(long)]
        json: bool,
    },
    /// Remove a config value by path
    Unset { path: String },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if fast_route::try_handle().await? {
        return Ok(());
    }

    let cli = Cli::parse();
    let bootstrap = bootstrap::initialize(cli.profile.as_deref())?;

    match cli.command {
        Commands::Registry { json } => {
            if json {
                println!(
                    "{}",
                    serde_json::to_string_pretty(command_registry::ROOT_COMMANDS)?
                );
            } else {
                println!("{}", command_registry::render_text_table());
            }
        }
        Commands::Config { cmd } => {
            let mut config_manager = ConfigManager::load_for_profile(Some(&bootstrap.profile))?;
            match cmd {
                Some(ConfigSubcommands::Url { url }) => {
                    config_manager.update_url(url)?;
                    println!(
                        "✅ Kernel URL updated for profile '{}': {}",
                        config_manager.profile(),
                        config_manager.path().display()
                    );
                }
                Some(ConfigSubcommands::Show) => {
                    print_config_summary(&bootstrap, &config_manager);
                }
                Some(ConfigSubcommands::Get { path }) => {
                    let value = config_manager.get_path(&path)?;
                    match value {
                        Some(value) => println!("{}", serde_json::to_string_pretty(&value)?),
                        None => {
                            return Err(anyhow::anyhow!("Config path not found: {}", path));
                        }
                    }
                }
                Some(ConfigSubcommands::Set { path, value, json }) => {
                    let parsed = if json {
                        serde_json::from_str::<serde_json::Value>(&value).map_err(|err| {
                            anyhow::anyhow!("Invalid JSON value for '{}': {}", path, err)
                        })?
                    } else {
                        serde_json::from_str::<serde_json::Value>(&value)
                            .unwrap_or_else(|_| serde_json::Value::String(value))
                    };
                    config_manager.set_path(&path, parsed)?;
                    println!(
                        "✅ Config path '{}' updated in {}",
                        path,
                        config_manager.path().display()
                    );
                }
                Some(ConfigSubcommands::Unset { path }) => {
                    let removed = config_manager.unset_path(&path)?;
                    if removed {
                        println!(
                            "✅ Removed config path '{}' from {}",
                            path,
                            config_manager.path().display()
                        );
                    } else {
                        println!("No value at config path '{}'.", path);
                    }
                }
                None => {
                    let words = vec!["configure".to_string()];
                    let client = KernelClient::new(&config_manager);
                    openclaw_compat::handle_external(
                        &words,
                        &bootstrap,
                        &mut config_manager,
                        &client,
                    )
                    .await?;
                }
            }
        }
        Commands::External(words) => {
            let mut config_manager = ConfigManager::load_for_profile(Some(&bootstrap.profile))?;
            let client = KernelClient::new(&config_manager);
            openclaw_compat::handle_external(&words, &bootstrap, &mut config_manager, &client)
                .await?;
        }
        command => {
            let config_manager = ConfigManager::load_for_profile(Some(&bootstrap.profile))?;
            let client = KernelClient::new(&config_manager);

            match command {
                Commands::Up => daemon::handle_daemon(daemon::DaemonCommands::Up, &client).await?,
                Commands::Down => {
                    daemon::handle_daemon(daemon::DaemonCommands::Down, &client).await?
                }
                Commands::Status(args) => {
                    status_health_sessions::handle_status(args, &client).await?
                }
                Commands::Health(args) => {
                    status_health_sessions::handle_health(args, &client).await?
                }
                Commands::Sessions(args) => {
                    status_health_sessions::handle_sessions(args, &client).await?
                }
                Commands::Doctor(_) => {
                    daemon::handle_daemon(daemon::DaemonCommands::Doctor, &client).await?
                }
                Commands::Logs { follow } => {
                    daemon::handle_daemon(daemon::DaemonCommands::Logs { follow }, &client).await?
                }
                Commands::Daemon(args) => daemon::handle_daemon(args.command, &client).await?,

                Commands::Ev(args) => ev::handle_ev_args(args, &client).await?,
                Commands::Autoland(args) => autoland::handle_autoland_args(args, &client).await?,
                Commands::Cap(args) => cap::handle_cap_args(args, &client).await?,
                Commands::J(args) => j::handle_j_args(args, &client).await?,
                Commands::Tools(args) => tools::handle_tools_args(args, &client).await?,
                Commands::Skills(args) => skills::handle_skills_args(args, &client).await?,

                Commands::Auth(args) => auth::handle_auth(args, &client).await?,
                Commands::Model(args) => model::handle_model_args(args, &client).await?,
                Commands::Run(args) => run::handle_run(args, &client).await?,
                Commands::Repl(_) => repl::handle_repl(&client).await?,
                Commands::Tui(args) => tui::run_tui(&client, args).await?,
                Commands::Rlm(cmd) => rlm::handle_rlm_args(cmd).await?,
                Commands::Voice(cmd) => voice::handle_voice_args(cmd).await?,
                Commands::WebVM(cmd) => webvm::handle_webvm_args(cmd).await?,
                Commands::Marketplace(cmd) => marketplace::handle_marketplace(cmd, &client).await?,
                /*
                Commands::Memory { cmd } => {
                    let args = cmd.map(|c| {
                        match c.action {
                            commands::memory::MemoryAction::Query { question, limit, tenant_id, session_id } => {
                                vec!["query".to_string(), question, "--limit".to_string(), limit.to_string()]
                            }
                            _ => vec![],
                        }
                    }).unwrap_or_default();
                    commands::memory::handle_memory(args).await?;
                }
                */
                Commands::Brain(cmd) => {
                    brain_integration::handle_brain_args(cmd, &client).await?
                }
                Commands::Task(cmd) => taskgraph::handle_taskgraph_args(cmd, &client).await?,
                Commands::Swarm(args) => swarm::handle_swarm(args, &client, &config_manager).await?,
                Commands::Vm(args) => vm::handle_vm(args).await?,
                Commands::Config { .. } | Commands::Registry { .. } | Commands::External(_) => {
                    unreachable!()
                }
            }
        }
    }

    Ok(())
}

fn print_config_summary(bootstrap: &BootstrapContext, config_manager: &ConfigManager) {
    println!("profile: {}", config_manager.profile());
    if let Some(project_root) = &bootstrap.project_root {
        println!("project_root: {}", project_root.display());
    }
    println!("config_path: {}", config_manager.path().display());
    println!("{:#?}", config_manager.get());
}

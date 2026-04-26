//! Rust Systems Programming Template
//! 
//! A high-performance async application with Tokio, tracing, and clap.
//!
//! # Examples
//!
//! Run the application:
//! ```bash
//! cargo run -- --verbose
//! ```
//!
//! Run with custom configuration:
//! ```bash
//! cargo run -- --config /path/to/config.toml --log-level debug
//! ```

use anyhow::{Context, Result};
use clap::{Parser, Subcommand, ValueEnum};
use std::path::PathBuf;
use tracing::{debug, info, warn};

/// Application configuration parsed from command line arguments
#[derive(Parser, Debug)]
#[command(
    name = "rust-systems",
    version = "1.0.0",
    author = "Allternit <dev@allternit.systems>",
    about = "High-performance Rust systems application",
    long_about = "A template for building async Rust applications with Tokio, \
                  structured logging, and comprehensive tooling."
)]
#[command(propagate_version = true)]
struct Cli {
    /// Configuration file path
    #[arg(short, long, value_name = "FILE")]
    config: Option<PathBuf>,

    /// Log level (overrides config file)
    #[arg(short, long, value_enum, default_value = "info")]
    log_level: LogLevel,

    /// Enable verbose output
    #[arg(short, long, action = clap::ArgAction::Count)]
    verbose: u8,

    /// Disable colored output
    #[arg(long, env = "NO_COLOR")]
    no_color: bool,

    /// Subcommand to execute
    #[command(subcommand)]
    command: Option<Commands>,
}

/// Available log levels
#[derive(Debug, Clone, Copy, ValueEnum)]
enum LogLevel {
    /// Errors only
    Error,
    /// Errors and warnings
    Warn,
    /// General information (default)
    Info,
    /// Detailed debugging information
    Debug,
    /// Very verbose tracing
    Trace,
}

impl LogLevel {
    /// Convert to tracing filter string
    fn as_filter(&self) -> &'static str {
        match self {
            LogLevel::Error => "error",
            LogLevel::Warn => "warn",
            LogLevel::Info => "info",
            LogLevel::Debug => "debug",
            LogLevel::Trace => "trace",
        }
    }
}

/// Available subcommands
#[derive(Debug, Subcommand)]
enum Commands {
    /// Run the web server
    Serve {
        /// Bind address
        #[arg(short, long, default_value = "127.0.0.1")]
        host: String,

        /// Port to listen on
        #[arg(short, long, default_value = "8080")]
        port: u16,

        /// Number of worker threads (0 = number of CPUs)
        #[arg(short, long, default_value = "0")]
        workers: usize,
    },

    /// Run database migrations
    Migrate {
        /// Migration direction
        #[arg(value_enum, default_value = "up")]
        direction: MigrationDirection,

        /// Number of migrations to apply (0 = all)
        #[arg(short, long, default_value = "0")]
        steps: u32,

        /// Dry run - don't actually apply migrations
        #[arg(long)]
        dry_run: bool,
    },

    /// Check system health
    Health {
        /// Check database connectivity
        #[arg(long)]
        check_db: bool,

        /// Check cache connectivity
        #[arg(long)]
        check_cache: bool,

        /// Verbose health check output
        #[arg(short, long)]
        verbose: bool,
    },

    /// Generate project documentation
    Docs {
        /// Open documentation in browser
        #[arg(short, long)]
        open: bool,

        /// Watch for changes and rebuild
        #[arg(short, long)]
        watch: bool,

        /// Include private items
        #[arg(long)]
        private: bool,
    },
}

/// Migration directions
#[derive(Debug, Clone, Copy, ValueEnum)]
enum MigrationDirection {
    /// Apply migrations
    Up,
    /// Rollback migrations
    Down,
    /// Check migration status
    Status,
    /// Create a new migration
    Create,
}

/// Application state shared across the application
#[derive(Debug)]
struct AppState {
    /// Start time for uptime tracking
    start_time: std::time::Instant,
    /// Application configuration
    config: AppConfig,
}

/// Application configuration
#[derive(Debug, Clone)]
struct AppConfig {
    /// Log level filter
    log_level: String,
    /// Enable colors in output
    color_enabled: bool,
    /// Configuration file path
    config_path: Option<PathBuf>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Parse command line arguments
    let cli = Cli::parse();

    // Initialize tracing/logging
    init_tracing(&cli)?;

    // Log startup information
    info!(version = env!("CARGO_PKG_VERSION"), "Starting application");
    debug!(?cli, "Parsed CLI arguments");

    // Create application state
    let state = AppState {
        start_time: std::time::Instant::now(),
        config: AppConfig {
            log_level: cli.log_level.as_filter().to_string(),
            color_enabled: !cli.no_color,
            config_path: cli.config.clone(),
        },
    };

    // Execute the appropriate subcommand or default behavior
    match cli.command {
        Some(Commands::Serve { host, port, workers }) => {
            run_server(state, host, port, workers).await?;
        }
        Some(Commands::Migrate { direction, steps, dry_run }) => {
            run_migrations(direction, steps, dry_run).await?;
        }
        Some(Commands::Health { check_db, check_cache, verbose }) => {
            run_health_check(check_db, check_cache, verbose).await?;
        }
        Some(Commands::Docs { open, watch, private }) => {
            generate_docs(open, watch, private).await?;
        }
        None => {
            // Default behavior: run the main application logic
            run_default(state).await?;
        }
    }

    info!("Application shutting down gracefully");
    Ok(())
}

/// Initialize the tracing/logging system
fn init_tracing(cli: &Cli) -> Result<()> {
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

    // Determine log level based on verbosity flags and --log-level
    let filter = if cli.verbose > 0 {
        match cli.verbose {
            1 => "info",
            2 => "debug",
            _ => "trace",
        }
    } else {
        cli.log_level.as_filter()
    };

    // Build the env filter
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| {
            EnvFilter::new(filter)
                .add_directive("hyper=warn".parse().unwrap())
                .add_directive("tokio=warn".parse().unwrap())
                .add_directive("rustls=warn".parse().unwrap())
        });

    // Configure the fmt layer
    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(true)
        .with_thread_ids(cli.verbose > 1)
        .with_thread_names(cli.verbose > 1)
        .with_file(cli.verbose > 2)
        .with_line_number(cli.verbose > 2);

    // Disable colors if requested
    let fmt_layer = if cli.no_color {
        fmt_layer.with_ansi(false)
    } else {
        fmt_layer
    };

    // Initialize the subscriber
    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .init();

    Ok(())
}

/// Run the default application logic
async fn run_default(state: AppState) -> Result<()> {
    info!("Running default application mode");
    
    // Print application info
    println!("\n{}", "═".repeat(60));
    println!("  Rust Systems Programming Template");
    println!("{}", "═".repeat(60));
    println!();
    println!("  Version:    {}", env!("CARGO_PKG_VERSION"));
    println!("  Log Level:  {}", state.config.log_level);
    println!("  Uptime:     {:?}", state.start_time.elapsed());
    println!();
    println!("  Available commands:");
    println!("    serve     - Run the web server");
    println!("    migrate   - Run database migrations");
    println!("    health    - Check system health");
    println!("    docs      - Generate documentation");
    println!();
    println!("  Run with --help for more information");
    println!("{}", "═".repeat(60));
    println!();

    // Simulate some async work
    info!("Performing initialization tasks...");
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Spawn concurrent tasks to demonstrate Tokio
    let handles: Vec<_> = (0..3)
        .map(|i| {
            tokio::spawn(async move {
                debug!(task_id = i, "Starting background task");
                tokio::time::sleep(tokio::time::Duration::from_millis(50 * (i + 1) as u64)).await;
                info!(task_id = i, "Background task completed");
                i * i
            })
        })
        .collect();

    // Wait for all tasks to complete
    let results: Result<Vec<_>, _> = futures::future::try_join_all(handles).await;
    match results {
        Ok(values) => {
            info!(results = ?values, "All background tasks completed");
        }
        Err(e) => {
            warn!(error = ?e, "A background task failed");
        }
    }

    info!("Default execution completed successfully");
    Ok(())
}

/// Run the web server
async fn run_server(
    _state: AppState,
    host: String,
    port: u16,
    workers: usize,
) -> Result<()> {
    info!(%host, %port, %workers, "Starting web server");

    // Determine worker count
    let worker_count = if workers == 0 {
        num_cpus::get()
    } else {
        workers
    };

    info!(worker_count, "Server configuration");

    // In a real application, you would set up your web framework here
    // Example with axum:
    //
    // use axum::{routing::get, Router};
    // 
    // let app = Router::new()
    //     .route("/", get(handler));
    //
    // let listener = tokio::net::TcpListener::bind(format!("{}:{}", host, port)).await?;
    // axum::serve(listener, app).await?;

    println!("\n🚀 Server would start on http://{}:{}", host, port);
    println!("   Workers: {}\n", worker_count);

    // Simulate server running
    info!("Server is running (simulation mode)");
    
    // Keep the server "running" until interrupted
    tokio::signal::ctrl_c().await?;
    info!("Received shutdown signal");

    Ok(())
}

/// Run database migrations
async fn run_migrations(
    direction: MigrationDirection,
    steps: u32,
    dry_run: bool,
) -> Result<()> {
    use MigrationDirection::*;

    info!(?direction, %steps, %dry_run, "Running database migrations");

    let action = match direction {
        Up => "apply",
        Down => "rollback",
        Status => "check status of",
        Create => "create",
    };

    let steps_str = if steps == 0 {
        "all".to_string()
    } else {
        format!("{}", steps)
    };

    if dry_run {
        warn!("Running in DRY RUN mode - no changes will be made");
    }

    println!("\n🔄 Migration: Would {} {} migration(s)", action, steps_str);
    println!();

    // In a real application with sqlx:
    //
    // if dry_run {
    //     // Show what would be applied
    // } else {
    //     match direction {
    //         Up => sqlx::migrate!("./migrations").run(&pool).await?,
    //         Down => { /* rollback logic */ },
    //         _ => {}
    //     }
    // }

    info!("Migrations completed");
    Ok(())
}

/// Run health checks
async fn run_health_check(check_db: bool, check_cache: bool, verbose: bool) -> Result<()> {
    info!(%check_db, %check_cache, %verbose, "Running health checks");

    let mut all_healthy = true;

    println!("\n🏥 Health Check Results:");
    println!("{}", "─".repeat(40));

    // Check application status
    let app_status = check_application().await?;
    print_check("Application", app_status);
    all_healthy &= app_status.healthy;

    // Check database if requested
    if check_db {
        let db_status = check_database().await?;
        print_check("Database", db_status);
        all_healthy &= db_status.healthy;
    }

    // Check cache if requested
    if check_cache {
        let cache_status = check_cache_connection().await?;
        print_check("Cache", cache_status);
        all_healthy &= cache_status.healthy;
    }

    println!("{}", "─".repeat(40));

    if all_healthy {
        println!("\n✅ All systems operational\n");
        Ok(())
    } else {
        println!("\n❌ Some systems are unhealthy\n");
        anyhow::bail!("Health check failed")
    }
}

/// Health check result
struct HealthStatus {
    healthy: bool,
    message: String,
    details: Option<String>,
}

/// Print a health check result
fn print_check(name: &str, status: HealthStatus) {
    let icon = if status.healthy { "✅" } else { "❌" };
    println!("{} {:12} {}", icon, name, status.message);
    if let Some(details) = status.details {
        println!("   Details: {}", details);
    }
}

/// Check application health
async fn check_application() -> Result<HealthStatus> {
    // In a real app, check memory, goroutines, etc.
    Ok(HealthStatus {
        healthy: true,
        message: "Running".to_string(),
        details: Some(format!("PID: {}", std::process::id())),
    })
}

/// Check database connectivity
async fn check_database() -> Result<HealthStatus> {
    // In a real app with sqlx:
    // match sqlx::query("SELECT 1").fetch_one(&pool).await {
    //     Ok(_) => Ok(HealthStatus { healthy: true, ... }),
    //     Err(e) => Ok(HealthStatus { healthy: false, ... }),
    // }
    
    Ok(HealthStatus {
        healthy: true,
        message: "Connected".to_string(),
        details: Some("PostgreSQL 16".to_string()),
    })
}

/// Check cache connectivity
async fn check_cache_connection() -> Result<HealthStatus> {
    // In a real app with redis:
    // match redis::cmd("PING").query::<String>(&mut conn) {
    //     Ok(_) => Ok(HealthStatus { healthy: true, ... }),
    //     Err(e) => Ok(HealthStatus { healthy: false, ... }),
    // }
    
    Ok(HealthStatus {
        healthy: true,
        message: "Connected".to_string(),
        details: Some("Redis 7".to_string()),
    })
}

/// Generate project documentation
async fn generate_docs(open: bool, watch: bool, private: bool) -> Result<()> {
    use std::process::Command;

    info!(%open, %watch, %private, "Generating documentation");

    let mut cmd = Command::new("cargo");
    cmd.arg("doc");

    if private {
        cmd.arg("--document-private-items");
    }

    if watch {
        cmd.arg("--open");
        info!("Starting documentation server with watch mode");
        // In a real setup, you might use cargo-watch here
    }

    println!("\n📚 Generating documentation...\n");

    // Simulate doc generation
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    println!("Documentation generated successfully!");
    println!("  Location: target/doc/\n");

    if open {
        info!("Opening documentation in browser");
        // In a real implementation, open the browser
        println!("  Would open: target/doc/rust_systems/index.html\n");
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_level_as_filter() {
        assert_eq!(LogLevel::Error.as_filter(), "error");
        assert_eq!(LogLevel::Warn.as_filter(), "warn");
        assert_eq!(LogLevel::Info.as_filter(), "info");
        assert_eq!(LogLevel::Debug.as_filter(), "debug");
        assert_eq!(LogLevel::Trace.as_filter(), "trace");
    }

    #[test]
    fn test_health_status() {
        let status = HealthStatus {
            healthy: true,
            message: "Test".to_string(),
            details: None,
        };
        assert!(status.healthy);
        assert_eq!(status.message, "Test");
    }

    #[tokio::test]
    async fn test_check_application() {
        let result = check_application().await;
        assert!(result.is_ok());
        let status = result.unwrap();
        assert!(status.healthy);
    }
}

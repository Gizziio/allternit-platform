//! A2rchitech Platform Orchestrator
//!
//! Starts all platform services from `.a2r/services.json`.

use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::fs::File;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

#[derive(Debug, Deserialize)]
struct HostsConfig {
    internal: String,
    public: String,
}

#[derive(Debug, Deserialize)]
struct ServicesConfig {
    version: String,
    hosts: HostsConfig,
    ports: HashMap<String, u16>,
    tasks: Option<Vec<ServiceSpec>>,
    services: Vec<ServiceSpec>,
}

#[derive(Debug, Deserialize, Clone)]
struct ServiceSpec {
    id: String,
    label: Option<String>,
    order: Option<i32>,
    command: String,
    args: Option<Vec<String>>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
    log: Option<String>,
    enabled: Option<bool>,
}

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(3)
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")))
}

fn logs_dir(root: &Path) -> PathBuf {
    let dir = root.join(".logs");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn services_config_path(root: &Path) -> PathBuf {
    if let Ok(path) = std::env::var("A2R_SERVICES_FILE") {
        return PathBuf::from(path);
    }
    root.join(".a2r/services.json")
}

fn load_services_config(path: &Path) -> ServicesConfig {
    let content = fs::read_to_string(path)
        .unwrap_or_else(|e| panic!("Failed to read services config {}: {}", path.display(), e));
    serde_json::from_str(&content)
        .unwrap_or_else(|e| panic!("Failed to parse services config {}: {}", path.display(), e))
}

fn build_template_vars(root: &Path, config: &ServicesConfig) -> HashMap<String, String> {
    let mut vars = HashMap::new();
    vars.insert("root".to_string(), root.display().to_string());
    vars.insert("hosts.internal".to_string(), config.hosts.internal.clone());
    vars.insert("hosts.public".to_string(), config.hosts.public.clone());
    for (key, value) in &config.ports {
        vars.insert(format!("ports.{key}"), value.to_string());
    }
    vars
}

fn expand_template(value: &str, vars: &HashMap<String, String>) -> String {
    let mut out = value.to_string();
    for (key, val) in vars {
        let needle = format!("${{{}}}", key);
        if out.contains(&needle) {
            out = out.replace(&needle, val);
        }
    }
    out
}

fn expand_args(args: &[String], vars: &HashMap<String, String>) -> Vec<String> {
    args.iter().map(|arg| expand_template(arg, vars)).collect()
}

fn expand_env(env: &HashMap<String, String>, vars: &HashMap<String, String>) -> HashMap<String, String> {
    let mut expanded = HashMap::new();
    for (key, value) in env {
        expanded.insert(key.clone(), expand_template(value, vars));
    }
    expanded
}

fn detect_port_conflicts(config: &ServicesConfig) -> Vec<u16> {
    let mut conflicts = Vec::new();
    for port in config.ports.values() {
        if TcpStream::connect(("127.0.0.1", *port)).is_ok() {
            conflicts.push(*port);
        }
    }
    conflicts.sort_unstable();
    conflicts.dedup();
    conflicts
}

fn spawn_logged_command(
    cmd: &str,
    args: &[String],
    cwd: &Path,
    log_path: &Path,
    env: &HashMap<String, String>,
) -> std::io::Result<std::process::Child> {
    let mut command = Command::new(cmd);
    command.args(args).current_dir(cwd);
    command.envs(env);

    match File::create(log_path) {
        Ok(file) => {
            let err_file = file.try_clone().ok();
            command.stdout(Stdio::from(file));
            if let Some(err) = err_file {
                command.stderr(Stdio::from(err));
            } else {
                command.stderr(Stdio::null());
            }
        }
        Err(_) => {
            command.stdout(Stdio::null()).stderr(Stdio::null());
        }
    }

    command.spawn()
}

fn run_task(spec: &ServiceSpec, root: &Path, log_dir: &Path, vars: &HashMap<String, String>) -> bool {
    let label = spec.label.clone().unwrap_or_else(|| spec.id.clone());
    println!("🛠️  Running task: {}", label);

    let cwd = spec
        .cwd
        .as_ref()
        .map(|p| root.join(expand_template(p, vars)))
        .unwrap_or_else(|| root.to_path_buf());

    let log_name = spec
        .log
        .clone()
        .unwrap_or_else(|| format!("{}.log", spec.id));
    let log_path = log_dir.join(log_name);

    let args = expand_args(&spec.args.clone().unwrap_or_default(), vars);
    let env = spec.env.as_ref().map(|e| expand_env(e, vars)).unwrap_or_default();

    match spawn_logged_command(&spec.command, &args, &cwd, &log_path, &env) {
        Ok(mut child) => {
            let pid = child.id();
            println!("✅ Task started: {} (pid {}, log {})", label, pid, log_path.display());
            match child.wait() {
                Ok(status) => {
                    println!("🏁 Task finished: {} ({})", label, status);
                    status.success()
                }
                Err(err) => {
                    println!("⚠️  Task error: {} ({})", label, err);
                    false
                }
            }
        }
        Err(err) => {
            println!("❌ Failed to start task {}: {}", label, err);
            false
        }
    }
}

fn spawn_service(spec: ServiceSpec, root: PathBuf, log_dir: PathBuf, vars: HashMap<String, String>) {
    let label = spec.label.clone().unwrap_or_else(|| spec.id.clone());
    println!("🧩 Starting {}...", label);

    thread::spawn(move || {
        let cwd = spec
            .cwd
            .as_ref()
            .map(|p| root.join(expand_template(p, &vars)))
            .unwrap_or_else(|| root.clone());
        let log_name = spec
            .log
            .clone()
            .unwrap_or_else(|| format!("{}.log", spec.id));
        let log_path = log_dir.join(log_name);
        let args = expand_args(&spec.args.clone().unwrap_or_default(), &vars);
        let env = spec.env.as_ref().map(|e| expand_env(e, &vars)).unwrap_or_default();

        match spawn_logged_command(&spec.command, &args, &cwd, &log_path, &env) {
            Ok(mut child) => {
                let pid = child.id();
                println!(
                    "✅ Started {} (pid {}, log {})",
                    label,
                    pid,
                    log_path.display()
                );
                match child.wait() {
                    Ok(status) => println!("🛑 {} exited ({})", label, status),
                    Err(err) => println!("⚠️  {} wait error: {}", label, err),
                }
            }
            Err(err) => println!("❌ Failed to start {}: {}", label, err),
        }
    });
}

#[tokio::main]
async fn main() {
    let root = workspace_root();
    let log_dir = logs_dir(&root);
    let config_path = services_config_path(&root);
    let config = load_services_config(&config_path);
    let vars = build_template_vars(&root, &config);

    println!("🚀 Starting A2rchitech Platform");
    println!("===========================================");
    println!("Using services config: {}", config_path.display());
    println!("Config version: {}", config.version);

    if std::env::var("A2R_IGNORE_PORT_CONFLICTS").is_err() {
        let conflicts = detect_port_conflicts(&config);
        if !conflicts.is_empty() {
            eprintln!("❌ Port conflicts detected: {:?}", conflicts);
            eprintln!("   Stop existing services or run scripts/cleanup-a2r-ports.sh (sudo may be required).");
            eprintln!("   Set A2R_IGNORE_PORT_CONFLICTS=1 to bypass this check.");
            std::process::exit(1);
        }
    }

    if let Some(tasks) = &config.tasks {
        for task in tasks.iter().filter(|t| t.enabled.unwrap_or(true)) {
            let ok = run_task(task, &root, &log_dir, &vars);
            if !ok {
                eprintln!("❌ Startup task '{}' failed. Aborting orchestrator startup.", task.id);
                std::process::exit(1);
            }
        }
    }

    let mut services = config
        .services
        .into_iter()
        .filter(|s| s.enabled.unwrap_or(true))
        .collect::<Vec<_>>();
    services.sort_by_key(|s| s.order.unwrap_or(100));

    for spec in services.into_iter() {
        spawn_service(spec, root.clone(), log_dir.clone(), vars.clone());
        thread::sleep(Duration::from_millis(300));
    }

    println!("\n✅ Platform services launched.");
    println!("💡 Logs are in {}", log_dir.display());
    println!("💡 Press Ctrl+C to stop the platform.");

    ctrlc::set_handler(move || {
        println!("\n🛑 Stopping A2rchitech Platform...");
        std::process::exit(0);
    })
    .expect("Error setting Ctrl+C handler");

    tokio::signal::ctrl_c()
        .await
        .expect("Failed to listen for ctrl+c");
}

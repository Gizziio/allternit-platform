//! ao — Allternit agent-orchestrator contract over the ao engine socket.
//!
//! Implements `ao spawn|send|watch|status|kill|doctor` with byte-level parity
//! to the bash scripts in `~/.claude/skills/agent-orchestrator/scripts/`
//! (same arguments, exit codes, stdout formats, semantics). The engine runs
//! as named session `ao`; the tmux script path remains the fallback.
//!
//! Design notes (P1 spike, docs/ALLTERNIT_RUNTIME_P1_NOTES.md):
//! - Dead panes/workspaces are removed engine-side, so liveness is a presence
//!   probe (workspace listed + pane present). A small registry at
//!   `~/.agent-orchestrator/state.json` is the tmux remain-on-exit analog that
//!   keeps DEAD sessions observable to `ao status`.
//! - Transcripts come from the additive PTY tee (`src/ao/transcript.rs`),
//!   requested via the `HERDR_AO_TRANSCRIPT` launch-env marker on the
//!   layout.apply pane node.
//! - Worktree add/remove shell out to git with the script's exact commands.

use std::collections::BTreeMap;
use std::io::Read as _;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::api::client::{ApiClient, ApiClientError};
use crate::api::schema::{
    EmptyParams, LayoutApplyParams, LayoutNode, LayoutPane, Method, PaneListParams,
    PaneReadParams, PaneSendInputParams, PingParams, ReadFormat, ReadSource, Request,
    WorkspaceCloseParams, WorkspaceCreateParams,
};

const USAGE_SPAWN: &str = "usage: ao spawn [--worktree] <slug> <repo-dir> <agent-cmd...>";
const USAGE_SEND: &str = "usage: ao send <slug> <prompt...> | ao send <slug> -f <file>";
const USAGE_WATCH: &str = "usage: ao watch <slug> <sentinel-file> [timeout] [interval]";
const USAGE_STATUS: &str = "usage: ao status [slug] [lines=25]";
const USAGE_KILL: &str = "usage: ao kill <slug> [--rm-worktree]";

const AO_DIR: &str = ".agent-orchestrator";
const LOGS_DIR: &str = "logs";
const STATE_FILE: &str = "state.json";

pub(super) fn run_ao_command(args: &[String]) -> std::io::Result<i32> {
    ensure_ao_session();
    let Some(action) = args.first().map(String::as_str) else {
        print_ao_help();
        return Ok(2);
    };
    let rest = &args[1..];
    match action {
        "spawn" => spawn(rest),
        "send" => send(rest),
        "watch" => watch(rest),
        "status" => status(rest),
        "kill" => kill(rest),
        "doctor" => doctor(rest),
        "--help" | "-h" | "help" => {
            print_ao_help();
            Ok(0)
        }
        _ => {
            eprintln!("{USAGE_SPAWN}\n{USAGE_SEND}\n{USAGE_WATCH}\n{USAGE_STATUS}\n{USAGE_KILL}\nusage: ao doctor");
            Ok(2)
        }
    }
}

fn print_ao_help() {
    println!(
        "ao — Allternit agent orchestrator (engine session \"ao\")\n\
         \n\
         {USAGE_SPAWN}\n\
         {USAGE_SEND}\n\
         {USAGE_WATCH}\n\
         {USAGE_STATUS}\n\
         {USAGE_KILL}\n\
         usage: ao doctor\n\
         \n\
         Contract-compatible with the ao-* bash scripts; byte-level parity is\n\
         proven by tests/ao_parity/run.sh (golden side-by-side test)."
    );
}

/// Default the engine session to `ao` unless the user explicitly selected one
/// (`--session`, `HERDR_SOCKET_PATH`, or a pre-set `HERDR_SESSION` win).
fn ensure_ao_session() {
    if crate::session::explicit_session_requested() {
        return;
    }
    if std::env::var_os(crate::api::SOCKET_PATH_ENV_VAR).is_some() {
        return;
    }
    if std::env::var_os(crate::session::SESSION_ENV_VAR).is_none() {
        std::env::set_var(crate::session::SESSION_ENV_VAR, "ao");
    }
}

// ---------------------------------------------------------------------------
// RPC helpers
// ---------------------------------------------------------------------------

enum CallError {
    EngineDown,
    Rpc { code: String, message: String },
    Io(std::io::Error),
}

impl CallError {
    fn exit_already_reported(&self) -> i32 {
        match self {
            CallError::EngineDown => {
                eprintln!(
                    "error: ao engine is not running (socket {})",
                    crate::api::socket_path().display()
                );
                1
            }
            CallError::Rpc { message, .. } => {
                eprintln!("error: {message}");
                1
            }
            CallError::Io(err) => {
                eprintln!("error: {err}");
                1
            }
        }
    }
}

fn map_client_error(err: ApiClientError) -> CallError {
    match err {
        ApiClientError::Io(io_err)
            if matches!(
                io_err.kind(),
                std::io::ErrorKind::NotFound | std::io::ErrorKind::ConnectionRefused
            ) =>
        {
            CallError::EngineDown
        }
        ApiClientError::Io(io_err) => CallError::Io(io_err),
        other => CallError::Io(std::io::Error::other(other)),
    }
}

fn call(client: &ApiClient, method: Method) -> Result<serde_json::Value, CallError> {
    let request = Request {
        id: "ao".into(),
        method,
    };
    let value = client.request_value(&request).map_err(map_client_error)?;
    if let Some(error) = value.get("error") {
        return Err(CallError::Rpc {
            code: error
                .get("code")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("unknown")
                .to_string(),
            message: error
                .get("message")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("unknown engine error")
                .to_string(),
        });
    }
    Ok(value["result"].clone())
}

fn workspaces(client: &ApiClient) -> Result<Vec<serde_json::Value>, CallError> {
    let result = call(client, Method::WorkspaceList(EmptyParams {}))?;
    Ok(result["workspaces"].as_array().cloned().unwrap_or_default())
}

fn find_workspace(client: &ApiClient, label: &str) -> Result<Option<serde_json::Value>, CallError> {
    Ok(workspaces(client)?
        .into_iter()
        .find(|ws| ws["label"].as_str() == Some(label)))
}

/// Presence probe: the engine removes dead panes and their workspace, so
/// liveness is exactly "the workspace is listed".
fn session_alive(client: &ApiClient, session: &str) -> Result<bool, CallError> {
    Ok(find_workspace(client, session)?.is_some())
}

fn first_pane_cwd(client: &ApiClient, workspace_id: &str) -> Result<Option<String>, CallError> {
    let result = call(
        client,
        Method::PaneList(PaneListParams {
            workspace_id: Some(workspace_id.to_string()),
        }),
    )?;
    Ok(result["panes"]
        .as_array()
        .and_then(|panes| panes.first())
        .and_then(|pane| pane["cwd"].as_str())
        .map(str::to_string))
}

fn pane_read_text(client: &ApiClient, pane_id: &str, lines: u32) -> Result<String, CallError> {
    let result = call(
        client,
        Method::PaneRead(PaneReadParams {
            pane_id: pane_id.to_string(),
            source: ReadSource::Recent,
            lines: Some(lines),
            format: ReadFormat::Text,
            strip_ansi: true,
            intent: Default::default(),
        }),
    )?;
    Ok(result["read"]["text"].as_str().unwrap_or_default().to_string())
}

fn ensure_engine_running() -> std::io::Result<()> {
    let client = ApiClient::local();
    let request = Request {
        id: "ao:ping".into(),
        method: Method::Ping(PingParams::default()),
    };
    if client.request_value(&request).is_ok() {
        return Ok(());
    }
    crate::server::autodetect::spawn_server_daemon()?;
    crate::server::autodetect::wait_for_server_socket(
        &client.socket_path(),
        Duration::from_secs(15),
    )
}

// ---------------------------------------------------------------------------
// Registry (tmux remain-on-exit analog — keeps DEAD sessions observable)
// ---------------------------------------------------------------------------

#[derive(Default, Serialize, Deserialize)]
struct AoState {
    sessions: BTreeMap<String, AoSession>,
}

#[derive(Clone, Serialize, Deserialize)]
struct AoSession {
    cwd: String,
    #[serde(default)]
    log: Option<String>,
    #[serde(default)]
    dead: bool,
}

fn ao_home() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/"))
        .join(AO_DIR)
}

fn state_path() -> PathBuf {
    ao_home().join(STATE_FILE)
}

fn load_state() -> AoState {
    let Ok(file) = std::fs::File::open(state_path()) else {
        return AoState::default();
    };
    serde_json::from_reader(std::io::BufReader::new(file)).unwrap_or_default()
}

fn save_state(state: &AoState) {
    let path = state_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let Ok(file) = std::fs::File::create(path) else {
        return;
    };
    let _ = serde_json::to_writer_pretty(std::io::BufWriter::new(file), state);
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

fn session_of(slug: &str) -> String {
    format!("ao-{slug}")
}

fn alnum(text: &str) -> String {
    text.bytes()
        .filter(u8::is_ascii_alphanumeric)
        .map(char::from)
        .collect()
}

fn timestamp_now() -> String {
    use time::OffsetDateTime;
    let now = OffsetDateTime::now_local().unwrap_or_else(|_| OffsetDateTime::now_utc());
    format!(
        "{:04}{:02}{:02}-{:02}{:02}{:02}",
        now.year(),
        u8::from(now.month()),
        now.day(),
        now.hour(),
        now.minute(),
        now.second()
    )
}

fn command_path(binary: &str) -> Option<String> {
    if binary.contains(std::path::MAIN_SEPARATOR) {
        let path = Path::new(binary);
        return is_executable(path).then(|| binary.to_string());
    }
    let paths = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&paths) {
        let candidate = dir.join(binary);
        if is_executable(&candidate) {
            return Some(candidate.display().to_string());
        }
    }
    None
}

#[cfg(unix)]
fn is_executable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    std::fs::metadata(path)
        .map(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(not(unix))]
fn is_executable(path: &Path) -> bool {
    std::fs::metadata(path)
        .map(|meta| meta.is_file())
        .unwrap_or(false)
}

/// `command -v`-style lookup honoring PATH, used for the tmux-world guard.
fn run_quiet(command: &mut Command) -> bool {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn eprintln_engine(err: &CallError) -> i32 {
    err.exit_already_reported()
}

// ---------------------------------------------------------------------------
// ao spawn
// ---------------------------------------------------------------------------

fn spawn(args: &[String]) -> std::io::Result<i32> {
    let mut args = args;
    let mut worktree = false;
    if args.first().map(String::as_str) == Some("--worktree") {
        worktree = true;
        args = &args[1..];
    }
    if args.len() < 3 {
        eprintln!("{USAGE_SPAWN}");
        return Ok(2);
    }
    let slug = &args[0];
    let mut dir = args[1].clone();
    let agent_cmd = &args[2..];
    let session = session_of(slug);

    let logs_dir = ao_home().join(LOGS_DIR);
    if let Err(err) = std::fs::create_dir_all(&logs_dir) {
        eprintln!("error: mkdir {}: {err}", logs_dir.display());
        return Ok(1);
    }
    let log = logs_dir.join(format!("{session}-{}.log", timestamp_now()));
    let runner = logs_dir.join(format!("{session}.cmd.sh"));

    // Duplicate guard, tmux world first (script-world collision) then engine.
    if command_path("tmux").is_some() {
        let mut check = Command::new("tmux");
        check
            .arg("has-session")
            .arg("-t")
            .arg(format!("={session}:"));
        if run_quiet(&mut check) {
            eprintln!(
                "error: session {session} already exists (ao status {slug} to inspect)"
            );
            return Ok(1);
        }
    }
    if ensure_engine_running().is_err() {
        eprintln!(
            "error: could not start the ao engine (session ao, socket {})",
            crate::api::socket_path().display()
        );
        return Ok(1);
    }
    let client = ApiClient::local();
    match find_workspace(&client, &session) {
        Ok(Some(_)) => {
            eprintln!("error: session {session} already exists (ao status {slug} to inspect)");
            return Ok(1);
        }
        Ok(None) => {}
        Err(err) => return Ok(eprintln_engine(&err)),
    }

    if worktree {
        // `ROOT=$(git -C "$DIR" rev-parse --show-toplevel)` — git's stderr and
        // exit code propagate exactly like the script's set -e.
        let output = Command::new("git")
            .arg("-C")
            .arg(&dir)
            .arg("rev-parse")
            .arg("--show-toplevel")
            .stderr(Stdio::inherit())
            .output()?;
        if !output.status.success() {
            return Ok(output.status.code().unwrap_or(1));
        }
        let root = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let home = std::env::var("HOME").unwrap_or_default();
        if root == home {
            eprintln!("error: git root is $HOME — a worktree would checkout your whole home dir. Rerun without --worktree.");
            return Ok(1);
        }
        let root_path = PathBuf::from(&root);
        let wt = root_path
            .parent()
            .map(|parent| parent.join(format!("{}-ao-{slug}", root_path.file_name().unwrap_or_default().to_string_lossy())))
            .unwrap_or_else(|| PathBuf::from(format!("{root}-ao-{slug}")));
        // stderr discarded to match the golden script's `>/dev/null 2>&1`
        // (the script stopped forwarding git's worktree noise 2026-09-09).
        let status = Command::new("git")
            .arg("-C")
            .arg(&root)
            .arg("worktree")
            .arg("add")
            .arg(&wt)
            .arg("-b")
            .arg(format!("ao/{slug}"))
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()?;
        if !status.success() {
            return Ok(status.code().unwrap_or(1));
        }
        dir = wt.display().to_string();
    }

    // Runner file sidesteps quoting issues (kept for parity with the script's
    // artifacts, even though the engine execs argv directly).
    let _ = std::fs::write(&runner, format!("{}\n", agent_cmd.join(" ")));

    let created = match call(
        &client,
        Method::WorkspaceCreate(WorkspaceCreateParams {
            source_workspace_id: None,
            cwd: Some(dir.clone()),
            focus: false,
            label: Some(session.clone()),
            env: Default::default(),
        }),
    ) {
        Ok(result) => result,
        Err(err) => return Ok(eprintln_engine(&err)),
    };
    let workspace_id = created["workspace"]["workspace_id"].as_str().unwrap_or_default();
    let tab_id = created["tab"]["tab_id"].as_str().unwrap_or_default();

    let mut env = std::collections::HashMap::new();
    env.insert(
        crate::ao::transcript::TRANSCRIPT_ENV_VAR.to_string(),
        log.display().to_string(),
    );
    let applied = call(
        &client,
        Method::LayoutApply(LayoutApplyParams {
            workspace_id: None,
            tab_id: Some(tab_id.to_string()),
            tab_label: None,
            focus: false,
            root: LayoutNode::Pane {
                pane: LayoutPane {
                    pane_id: None,
                    label: None,
                    cwd: Some(dir.clone()),
                    command: Some(agent_cmd.to_vec()),
                    env,
                },
            },
        }),
    );
    if let Err(err) = applied {
        let _ = call(
            &client,
            Method::WorkspaceClose(WorkspaceCloseParams {
                workspace_id: workspace_id.to_string(),
                close_group: true,
            }),
        );
        return Ok(eprintln_engine(&err));
    }

    std::thread::sleep(Duration::from_millis(500));
    if !session_alive(&client, &session).unwrap_or(false) {
        eprintln!("error: agent exited immediately — transcript tail:");
        if let Ok(content) = std::fs::read_to_string(&log) {
            // tail -5 semantics: split on \n only, keep any \r bytes.
            let mut tail: Vec<&str> = content.split('\n').collect();
            if tail.last().is_some_and(|line| line.is_empty()) {
                tail.pop();
            }
            let start = tail.len().saturating_sub(5);
            for line in &tail[start..] {
                eprintln!("{line}");
            }
        }
        let mut state = load_state();
        state.sessions.insert(
            session.clone(),
            AoSession {
                cwd: dir.clone(),
                log: Some(log.display().to_string()),
                dead: true,
            },
        );
        save_state(&state);
        return Ok(1);
    }

    let mut state = load_state();
    state.sessions.insert(
        session.clone(),
        AoSession {
            cwd: dir.clone(),
            log: Some(log.display().to_string()),
            dead: false,
        },
    );
    save_state(&state);

    println!("{session} {dir} {}", log.display());
    Ok(0)
}

// ---------------------------------------------------------------------------
// ao send
// ---------------------------------------------------------------------------

fn send(args: &[String]) -> std::io::Result<i32> {
    if args.len() < 2 {
        eprintln!("{USAGE_SEND}");
        return Ok(2);
    }
    let slug = &args[0];
    let session = session_of(slug);
    let prompt = if args[1] == "-f" {
        let Some(file) = args.get(2) else {
            eprintln!("{USAGE_SEND}");
            return Ok(2);
        };
        // PROMPT=$(cat "$2") — cat's stderr propagates; trailing newlines
        // are stripped like command substitution does.
        let output = Command::new("cat").arg(file).stderr(Stdio::inherit()).output()?;
        if !output.status.success() {
            return Ok(output.status.code().unwrap_or(1));
        }
        let mut text = String::from_utf8_lossy(&output.stdout).into_owned();
        while text.ends_with('\n') {
            text.pop();
        }
        text
    } else {
        args[1..].join(" ")
    };

    let client = ApiClient::local();
    let workspace = match find_workspace(&client, &session) {
        Ok(Some(workspace)) => workspace,
        Ok(None) => {
            eprintln!("error: no session {session}");
            return Ok(1);
        }
        Err(err) => return Ok(eprintln_engine(&err)),
    };
    let workspace_id = workspace["workspace_id"].as_str().unwrap_or_default();

    let stripped = alnum(&prompt);
    let marker: String = stripped
        .chars()
        .skip(stripped.chars().count().saturating_sub(40))
        .collect();
    if marker.is_empty() {
        eprintln!("error: prompt has no alphanumeric content");
        return Ok(2);
    }

    let pane = match call(
        &client,
        Method::PaneList(PaneListParams {
            workspace_id: Some(workspace_id.to_string()),
        }),
    ) {
        Ok(result) => match result["panes"].as_array().and_then(|panes| panes.first()) {
            Some(pane) => pane["pane_id"].as_str().unwrap_or_default().to_string(),
            None => {
                eprintln!("error: no session {session}");
                return Ok(1);
            }
        },
        Err(err) => return Ok(eprintln_engine(&err)),
    };

    let send = |text: &str, keys: &[&str]| {
        call(
            &client,
            Method::PaneSendInput(PaneSendInputParams {
                pane_id: pane.clone(),
                text: text.to_string(),
                keys: keys.iter().map(|key| (*key).to_string()).collect(),
            }),
        )
    };

    // Bracketed paste; the engine wraps text server-side (never send raw).
    if let Err(err) = send(&prompt, &[]) {
        let _ = send("", &["ctrl+u"]);
        return Ok(send_failure_exit(&session, &err));
    }

    // Marker loop, verbatim from ao-send: last-40-alnum marker, two
    // consecutive captures, 5s deadline, Enter only after verified landing.
    let deadline = std::time::SystemTime::now() + Duration::from_secs(5);
    let mut seen = false;
    let mut last: String;
    loop {
        last = match pane_read_text(&client, &pane, 80) {
            Ok(text) => alnum(&text),
            Err(_) => String::new(),
        };
        if last.contains(&marker) {
            if seen {
                break;
            }
            seen = true;
        } else {
            seen = false;
        }
        if std::time::SystemTime::now() >= deadline {
            break;
        }
        std::thread::sleep(Duration::from_millis(200));
    }

    if last.contains(&marker) {
        let _ = send("", &["enter"]);
        println!("submitted to {session}");
        Ok(0)
    } else {
        let _ = send("", &["ctrl+u"]);
        eprintln!("error: prompt not found in {session} pane after paste — cleared line with C-u, NOT submitted. Inspect with: tmux capture-pane -p -t {session}");
        Ok(1)
    }
}

fn send_failure_exit(session: &str, err: &CallError) -> i32 {
    match err {
        CallError::Rpc { code, .. } if code == "pane_not_found" => {
            eprintln!("error: no session {session}");
            1
        }
        other => eprintln_engine(other),
    }
}

// ---------------------------------------------------------------------------
// ao watch
// ---------------------------------------------------------------------------

fn watch(args: &[String]) -> std::io::Result<i32> {
    if args.len() < 2 {
        eprintln!("{USAGE_WATCH}");
        return Ok(2);
    }
    let slug = &args[0];
    let session = session_of(slug);
    let sentinel = &args[1];
    let timeout = match parse_u64_arg(args.get(2), 3600) {
        Some(value) => value,
        None => return Ok(2),
    };
    let interval = match parse_u64_arg(args.get(3), 20) {
        Some(value) => value,
        None => return Ok(2),
    };
    let client = ApiClient::local();
    let mut elapsed: u64 = 0;
    loop {
        if Path::new(sentinel).exists() {
            println!("DONE {sentinel}");
            return Ok(0);
        }
        match session_alive(&client, &session) {
            Ok(true) => {}
            // Engine unreachable is indistinguishable from "session gone".
            Ok(false) | Err(_) => {
                println!("PANE-DEAD {session} (agent exited or session gone; check log in ~/.agent-orchestrator/logs)");
                mark_dead(&session);
                return Ok(3);
            }
        }
        if elapsed >= timeout {
            println!("TIMEOUT after {timeout}s; sentinel absent, pane alive");
            return Ok(4);
        }
        std::thread::sleep(Duration::from_secs(interval));
        elapsed += interval;
    }
}

fn parse_u64_arg(arg: Option<&String>, default: u64) -> Option<u64> {
    match arg {
        None => Some(default),
        Some(raw) => match raw.parse::<u64>() {
            Ok(value) => Some(value),
            Err(_) => {
                eprintln!("error: '{raw}' is not a number");
                None
            }
        },
    }
}

fn mark_dead(session: &str) {
    let mut state = load_state();
    if let Some(entry) = state.sessions.get_mut(session) {
        entry.dead = true;
        save_state(&state);
    }
}

// ---------------------------------------------------------------------------
// ao status
// ---------------------------------------------------------------------------

fn status(args: &[String]) -> std::io::Result<i32> {
    // The ao contract shadows the engine's `status` word at the dispatcher
    // (see cli.rs). Engine status forms are rehomed here so both vocabularies
    // work: `ao status --json`, `ao status server [--json]`,
    // `ao status client [--json]`, and `ao status help`. Everything else
    // stays on the ao contract (`ao status [slug] [lines]`). The remote
    // machine machinery probes `status server --json`, so without this
    // rehome `ao machine add` cannot inspect a remote server.
    match args.first().map(String::as_str) {
        Some("--json") | Some("server") | Some("client") | Some("help") | Some("--help")
        | Some("-h") => return super::status::run_status_command(args),
        _ => {}
    }
    let client = ApiClient::local();
    if args.is_empty() {
        let mut rows: Vec<(String, String, String)> = Vec::new();
        let mut seen = std::collections::BTreeSet::new();
        match workspaces(&client) {
            Ok(list) => {
                for ws in list {
                    let Some(label) = ws["label"].as_str() else {
                        continue;
                    };
                    if !label.starts_with("ao-") {
                        continue;
                    }
                    seen.insert(label.to_string());
                    let workspace_id = ws["workspace_id"].as_str().unwrap_or_default();
                    let cwd = first_pane_cwd(&client, workspace_id)
                        .ok()
                        .flatten()
                        .unwrap_or_else(|| "-".to_string());
                    rows.push((label.to_string(), "alive".to_string(), cwd));
                }
            }
            Err(CallError::EngineDown) => {}
            Err(err) => return Ok(eprintln_engine(&err)),
        }
        let state = load_state();
        for (session, entry) in &state.sessions {
            if seen.contains(session) {
                continue;
            }
            if !session.starts_with("ao-") {
                continue;
            }
            rows.push((session.clone(), "DEAD".to_string(), entry.cwd.clone()));
        }
        if rows.is_empty() {
            println!("no ao-* sessions");
        } else {
            for (name, state_label, cwd) in rows {
                println!("{name}  {state_label}  {cwd}");
            }
        }
        return Ok(0);
    }

    let slug = &args[0];
    let session = session_of(slug);
    let lines = match parse_u64_arg(args.get(1), 25) {
        Some(value) => value as u32,
        None => return Ok(2),
    };
    let workspace = match find_workspace(&client, &session) {
        Ok(Some(workspace)) => workspace,
        Ok(None) => {
            eprintln!("no session {session}");
            return Ok(1);
        }
        Err(err) => return Ok(eprintln_engine(&err)),
    };
    println!("== {session} (alive) — last {lines} lines ==");
    let workspace_id = workspace["workspace_id"].as_str().unwrap_or_default();
    let panes = call(
        &client,
        Method::PaneList(PaneListParams {
            workspace_id: Some(workspace_id.to_string()),
        }),
    );
    let Some(pane) = panes.ok().and_then(|result| {
        result["panes"]
            .as_array()
            .and_then(|panes| panes.first())
            .cloned()
    }) else {
        eprintln!("no session {session}");
        return Ok(1);
    };
    let pane_id = pane["pane_id"].as_str().unwrap_or_default();
    match pane_read_text(&client, pane_id, lines) {
        Ok(text) => print!("{text}"),
        Err(err) => return Ok(eprintln_engine(&err)),
    }
    Ok(0)
}

// ---------------------------------------------------------------------------
// ao kill
// ---------------------------------------------------------------------------

fn kill(args: &[String]) -> std::io::Result<i32> {
    if args.is_empty() {
        eprintln!("{USAGE_KILL}");
        return Ok(2);
    }
    let slug = &args[0];
    let session = session_of(slug);
    let rm_wt = args.get(1).map(String::as_str).unwrap_or("");

    let client = ApiClient::local();
    let mut wt_dir = String::new();
    match find_workspace(&client, &session) {
        Ok(Some(workspace)) => {
            let workspace_id = workspace["workspace_id"].as_str().unwrap_or_default();
            if let Ok(cwd) = first_pane_cwd(&client, workspace_id) {
                wt_dir = cwd.unwrap_or_default();
            }
            let close = |group: bool| {
                call(
                    &client,
                    Method::WorkspaceClose(WorkspaceCloseParams {
                        workspace_id: workspace_id.to_string(),
                        close_group: group,
                    }),
                )
            };
            match close(false) {
                Ok(_) => {}
                Err(CallError::Rpc { code, .. }) if code == "workspace_group_close_required" => {
                    if let Err(err) = close(true) {
                        return Ok(eprintln_engine(&err));
                    }
                }
                Err(err) => return Ok(eprintln_engine(&err)),
            }
            println!("killed {session}");
        }
        Ok(None) => {
            println!("no session {session} (already gone)");
        }
        Err(err) => return Ok(eprintln_engine(&err)),
    }

    let mut state = load_state();
    if state.sessions.remove(&session).is_some() {
        save_state(&state);
    }

    if rm_wt == "--rm-worktree" {
        if !wt_dir.is_empty() && wt_dir.ends_with(&format!("-ao-{slug}")) {
            let removed = Command::new("git")
                .arg("-C")
                .arg(&wt_dir)
                .arg("worktree")
                .arg("remove")
                .arg("--force")
                .arg(&wt_dir)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map(|status| status.success())
                .unwrap_or(false)
                || Command::new("git")
                    .arg("worktree")
                    .arg("remove")
                    .arg("--force")
                    .arg(&wt_dir)
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .status()
                    .map(|status| status.success())
                    .unwrap_or(false);
            if !removed {
                eprintln!("warn: could not remove worktree {wt_dir} — remove manually");
            }
            println!("removed worktree {wt_dir}");
        } else {
            eprintln!("warn: pane dir '{wt_dir}' does not look like an ao worktree — not removing");
        }
    }
    Ok(0)
}

// ---------------------------------------------------------------------------
// ao doctor
// ---------------------------------------------------------------------------

fn doctor(_args: &[String]) -> std::io::Result<i32> {
    let mut transport_ok = true;
    let mut usable = false;

    println!("ao-doctor: transport");
    match engine_status_line() {
        Ok(line) => println!("{line}"),
        Err(line) => {
            println!("{line}");
            transport_ok = false;
        }
    }
    for tool in ["tmux", "script", "git"] {
        match command_path(tool) {
            Some(path) => println!("  {tool}: OK ({path})"),
            None => {
                println!("  {tool}: MISSING — delegation cannot run without it");
                transport_ok = false;
            }
        }
    }

    println!("ao-doctor: executors");
    probe_executor("kimi", "kimi", &["--yolo"], None, "no headless: -p refuses --yolo/--auto", &mut usable);
    probe_executor(
        "codex",
        "codex",
        &["--dangerously-bypass-approvals-and-sandbox"],
        Some(&["exec"]),
        "",
        &mut usable,
    );
    probe_executor(
        "claude",
        "claude",
        &["--dangerously-skip-permissions"],
        Some(&["-p", "--dangerously-skip-permissions"]),
        "",
        &mut usable,
    );
    probe_executor("agy", "agy", &["--dangerously-skip-permissions"], None, "", &mut usable);

    // P7 harness section (spec binding 7): managed-dir health, per-tool
    // binary+pin match, license acceptance state, sync reachability. The
    // ao_parity harness strips everything from this header to the next
    // `ao-doctor: ` section (or EOF) — it is additive surface, not part of
    // the P1 parity contract. Exit codes are unchanged when the section is
    // green, including the "nothing installed yet" case.
    let harness = harness_doctor_section();

    if !transport_ok {
        println!("ao-doctor: TRANSPORT BROKEN");
        return Ok(2);
    }
    if usable {
        if !harness {
            println!("ao-doctor: HARNESS PROBLEMS");
            return Ok(3);
        }
        println!("ao-doctor: OK — at least one executor is usable");
        return Ok(0);
    }
    println!("ao-doctor: NO USABLE EXECUTORS");
    Ok(1)
}

/// Print the `ao-doctor: harness` section; true when green. Loading the
/// manifest can fail (corrupt AO_HARNESS_MANIFEST override) — reported as a
/// problem rather than panicking inside doctor.
fn harness_doctor_section() -> bool {
    println!("ao-doctor: harness");
    let manifest = match crate::ao::harness::load_manifest_for_doctor() {
        Ok(manifest) => manifest,
        Err(err) => {
            println!("  manifest: UNREADABLE ({err})");
            return false;
        }
    };
    let report = crate::ao::harness::doctor_for_cli(&manifest);
    println!("  managed dir: {} [{}]", report.root.display(), if report.root.exists() { "exists" } else { "absent" });
    for row in &report.rows {
        if row.detail.is_empty() {
            println!("  {}: {}", row.tool, row.status);
        } else {
            println!("  {}: {} — {}", row.tool, row.status, row.detail);
        }
    }
    report.ok
}

fn engine_status_line() -> Result<String, String> {
    let client = ApiClient::local();
    let socket = client.socket_path().display().to_string();
    let request = Request {
        id: "ao:doctor".into(),
        method: Method::Ping(PingParams::default()),
    };
    match client.request_value(&request) {
        Ok(value) => {
            let result = &value["result"];
            let protocol = result["protocol"].as_u64().unwrap_or(0);
            let version = result["version"].as_str().unwrap_or("unknown");
            Ok(format!("  ao-engine: OK (socket {socket}, protocol {protocol}, {version})"))
        }
        Err(ApiClientError::Io(err))
            if matches!(
                err.kind(),
                std::io::ErrorKind::NotFound | std::io::ErrorKind::ConnectionRefused
            ) =>
        {
            Err(format!(
                "  ao-engine: MISSING — start it with: ao spawn <slug> <dir> <cmd...> (or: ao --session ao server) [{socket}]"
            ))
        }
        Err(err) => Err(format!(
            "  ao-engine: STALE (socket present but ping failed: {err}) [{socket}]"
        )),
    }
}

/// Verbatim port of the script's probe(): --help substring flag checks plus a
/// --version line, byte-identical output formatting.
#[allow(clippy::too_many_arguments)]
fn probe_executor(
    vendor: &str,
    binary: &str,
    interactive_flags: &[&str],
    headless_flags: Option<&[&str]>,
    note: &str,
    usable: &mut bool,
) {
    let Some(_path) = command_path(binary) else {
        println!("  {vendor} ({binary}): not installed");
        return;
    };
    let help = {
        let mut child = match Command::new(binary)
            .arg("--help")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(child) => child,
            Err(_) => {
                println!("  {vendor} ({binary}): installed interactive=no headless=n/a");
                return;
            }
        };
        let mut output = Vec::new();
        if let Some(mut stdout) = child.stdout.take() {
            let _ = stdout.read_to_end(&mut output);
        }
        let mut stderr = Vec::new();
        if let Some(mut err_pipe) = child.stderr.take() {
            let _ = err_pipe.read_to_end(&mut stderr);
        }
        let _ = child.wait();
        output.extend_from_slice(&stderr);
        String::from_utf8_lossy(&output[..output.len().min(200_000)]).into_owned()
    };
    let missing = |flags: &[&str]| -> String {
        flags
            .iter()
            .filter(|flag| !help.contains(**flag))
            .fold(String::new(), |mut acc, flag| {
                acc.push(' ');
                acc.push_str(flag);
                acc
            })
    };
    let missing_i = missing(interactive_flags);
    let missing_h = headless_flags.map(missing).unwrap_or_default();

    let i_ok = missing_i.is_empty();
    let h_ok = match headless_flags {
        None => "n/a",
        Some(_) if missing_h.is_empty() => "yes",
        Some(_) => "no",
    };
    if i_ok {
        *usable = true;
    }
    if h_ok == "yes" {
        *usable = true;
    }

    let mut line = format!(
        "  {vendor} ({binary}): installed interactive={} headless={h_ok}",
        if i_ok { "yes" } else { "no" }
    );
    let version = Command::new(binary)
        .arg("--version")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .ok()
        .and_then(|output| {
            String::from_utf8(output.stdout)
                .ok()
                .and_then(|text| text.lines().next().map(str::to_string))
        })
        .filter(|text| !text.is_empty());
    if let Some(version) = version {
        line.push_str(&format!(" version={version}"));
    }
    if !missing_i.is_empty() {
        line.push_str(&format!(" missing-interactive:{missing_i}"));
    }
    if !missing_h.is_empty() {
        line.push_str(&format!(" missing-headless:{missing_h}"));
    }
    if !note.is_empty() {
        line.push_str(&format!(" ({note})"));
    }
    println!("{line}");
}

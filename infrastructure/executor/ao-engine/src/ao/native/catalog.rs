//! Port of `packages/@allternit/native-sessions/src/catalog.ts` (list half).
//!
//! One walker per non-sqlite harness, mirroring the TS layout logic exactly
//! (directory shapes, id derivation, updatedAt sources, fingerprint inputs).
//! Sqlite/cli-export harnesses are deferred by binding decision and return no
//! rows (see `mod.rs` module docs).

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use super::fingerprint::{fingerprint_path, fingerprint_paths};
use super::{
    encode_claude_cwd, encode_grok_cwd, harness_home, NativeSession, ReaderKind, HARNESSES,
};

/// Per-harness listing metadata (`catalog.ts` listHarnesses).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HarnessListing {
    pub id: String,
    pub label: String,
    pub reader: ReaderKind,
    pub projectable: bool,
    pub resume_hint: String,
    pub home: String,
    pub present: bool,
}

fn mtime_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .ok()
        .and_then(|st| st.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn list_files(dir: &Path, predicate: impl Fn(&str) -> bool) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .map(|n| predicate(&n.to_string_lossy()))
                .unwrap_or(false)
        })
        .collect()
}

fn read_dir_dirs(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
        .map(|e| e.path())
        .collect()
}

/// Port of `walkDirs`: depth-limited directory walk, skipping dot-directories.
fn walk_dirs(dir: &Path, max_depth: i32) -> Vec<PathBuf> {
    if max_depth < 0 || !dir.exists() {
        return Vec::new();
    }
    let mut out = vec![dir.to_path_buf()];
    for child in read_dir_dirs(dir) {
        if child
            .file_name()
            .map(|n| n.to_string_lossy().starts_with('.'))
            .unwrap_or(false)
        {
            continue;
        }
        out.extend(walk_dirs(&child, max_depth - 1));
    }
    out
}

fn basename(path: &Path) -> String {
    path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()
}

fn session(partial: NativeSession) -> NativeSession {
    NativeSession {
        installed: true,
        ..partial
    }
}

/// claude/gizzi/qwen layout (`catalog.ts` listClaudeLike):
/// `<root>/<subdir>/<project-dir>[/chats]/*.jsonl`.
fn list_claude_like(harness: &str, root: &Path, subdir: &str, reader: ReaderKind, nested_chats: bool) -> Vec<NativeSession> {
    let projects = root.join(subdir);
    if !projects.exists() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for project in read_dir_dirs(&projects) {
        let project_name = basename(&project);
        let dir = if nested_chats {
            project.join("chats")
        } else {
            project.clone()
        };
        if !dir.exists() {
            continue;
        }
        for file in list_files(&dir, |n| n.ends_with(".jsonl") && !n.contains(".runtime.")) {
            let id = file
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            out.push(session(NativeSession {
                harness: harness.to_string(),
                session_id: id.clone(),
                path: file.to_string_lossy().to_string(),
                cwd: (!project_name.starts_with('-')).then_some(project_name.clone()),
                title: None,
                updated_at: mtime_ms(&file),
                created_at: None,
                fingerprint: fingerprint_path(&file),
                last_event_id: Some(id),
                installed: false,
                reader,
                projectable: true,
            }));
        }
    }
    out
}

/// codex layout (`catalog.ts` listCodex): rollout files under
/// `sessions/` and `archived_sessions/`, depth 4.
fn list_codex(root: &Path) -> Vec<NativeSession> {
    let rollout_id = |name: &str| -> Option<String> {
        // /^rollout-.*-([0-9a-fA-F-]{36})\.jsonl(?:\.zst)?$/ — the greedy
        // `.*-` backtracks so the capture is always the LAST 36 characters
        // of the stem (uuid dashes included).
        let stem = name.strip_suffix(".zst").unwrap_or(name);
        let stem = stem.strip_suffix(".jsonl")?;
        if stem.len() < "rollout-".len() + 36 {
            return None;
        }
        let (head, tail) = stem.split_at(stem.len() - 36);
        if !head.starts_with("rollout-") {
            return None;
        }
        if tail.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
            Some(tail.to_string())
        } else {
            None
        }
    };
    let mut out = Vec::new();
    for base in ["sessions", "archived_sessions"] {
        let base_dir = root.join(base);
        if !base_dir.exists() {
            continue;
        }
        for dir in walk_dirs(&base_dir, 4) {
            for file in list_files(&dir, |n| rollout_id(n).is_some()) {
                let Some(id) = rollout_id(&basename(&file)) else { continue };
                out.push(session(NativeSession {
                    harness: "codex".to_string(),
                    session_id: id.clone(),
                    path: file.to_string_lossy().to_string(),
                    cwd: None,
                    title: (base == "archived_sessions").then(|| "(archived)".to_string()),
                    updated_at: mtime_ms(&file),
                    created_at: None,
                    fingerprint: fingerprint_path(&file),
                    last_event_id: if base == "sessions" { Some(id) } else { None },
                    installed: false,
                    reader: ReaderKind::Jsonl,
                    projectable: true,
                }));
            }
        }
    }
    out
}

/// grok layout (`catalog.ts` listGrok):
/// `sessions/<cwdEnc>/<session>/updates.jsonl` + optional `summary.json`.
fn list_grok(root: &Path) -> Vec<NativeSession> {
    let sessions = root.join("sessions");
    if !sessions.exists() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for cwd_dir in read_dir_dirs(&sessions) {
        for dir in read_dir_dirs(&cwd_dir) {
            let updates = dir.join("updates.jsonl");
            if !updates.exists() {
                continue;
            }
            let summary = dir.join("summary.json");
            let mut title = None;
            let mut cwd = None;
            if summary.exists() {
                if let Ok(parsed) = serde_json::from_slice::<serde_json::Value>(
                    &fs::read(&summary).unwrap_or_default(),
                ) {
                    cwd = parsed
                        .get("info")
                        .and_then(|i| i.get("cwd"))
                        .and_then(|c| c.as_str())
                        .map(|s| s.to_string());
                    title = parsed
                        .get("session_summary")
                        .and_then(|s| s.as_str())
                        .map(|s| s.chars().take(120).collect());
                }
            }
            let id = basename(&dir);
            let cwd = cwd.or_else(|| {
                percent_decode(&basename(&cwd_dir))
            });
            let fp_targets: Vec<&Path> = [&summary, &updates]
                .iter()
                .filter(|p| p.exists())
                .map(|p| p.as_path())
                .collect();
            out.push(session(NativeSession {
                harness: "grok".to_string(),
                session_id: id.clone(),
                path: dir.to_string_lossy().to_string(),
                cwd,
                title,
                updated_at: mtime_ms(&updates),
                created_at: None,
                fingerprint: fingerprint_paths(&fp_targets),
                last_event_id: Some(id),
                installed: false,
                reader: ReaderKind::Directory,
                projectable: true,
            }));
        }
    }
    out
}

fn percent_decode(s: &str) -> Option<String> {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(out).ok()
}

/// Kimi Code layout (`catalog.ts` listKimiCode):
/// `sessions/wd_*/session_*/` with `state.json` + `agents/main/wire.jsonl`.
fn list_kimi_code(root: &Path) -> Vec<NativeSession> {
    let sessions = root.join("sessions");
    if !sessions.exists() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for wd in read_dir_dirs(&sessions) {
        if !basename(&wd).starts_with("wd_") {
            continue;
        }
        for dir in read_dir_dirs(&wd) {
            if !basename(&dir).starts_with("session_") {
                continue;
            }
            let state_path = dir.join("state.json");
            let wire = dir.join("agents").join("main").join("wire.jsonl");
            let mut cwd = None;
            let mut updated_at = mtime_ms(&dir);
            let mut id = basename(&dir).trim_start_matches("session_").to_string();
            if state_path.exists() {
                if let Ok(state) = serde_json::from_slice::<serde_json::Value>(
                    &fs::read(&state_path).unwrap_or_default(),
                ) {
                    cwd = state
                        .get("cwd")
                        .and_then(|c| c.as_str())
                        .map(|s| s.to_string());
                    if let Some(state_id) = state.get("id").and_then(|v| v.as_str()) {
                        id = state_id
                            .strip_prefix("session_")
                            .unwrap_or(state_id)
                            .to_string();
                    }
                    if let Some(ms) = state.get("updatedAt").and_then(|v| v.as_u64()) {
                        updated_at = ms;
                    }
                }
            }
            let fp_targets: Vec<&Path> = [&state_path, &wire]
                .iter()
                .filter(|p| p.exists())
                .map(|p| p.as_path())
                .collect();
            out.push(session(NativeSession {
                harness: "kimi".to_string(),
                session_id: id.clone(),
                path: dir.to_string_lossy().to_string(),
                cwd,
                title: None,
                updated_at,
                created_at: None,
                fingerprint: fingerprint_paths(&fp_targets),
                last_event_id: Some(id),
                installed: false,
                reader: ReaderKind::Directory,
                projectable: true,
            }));
        }
    }
    out
}

/// Kimi CLI layout (`catalog.ts` listKimiCli):
/// `sessions/<hash>/<session>/context.jsonl`.
fn list_kimi_cli(root: &Path) -> Vec<NativeSession> {
    let sessions = root.join("sessions");
    if !sessions.exists() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for hash_dir in read_dir_dirs(&sessions) {
        for dir in read_dir_dirs(&hash_dir) {
            let ctx = dir.join("context.jsonl");
            if !ctx.exists() {
                continue;
            }
            let id = basename(&dir);
            out.push(session(NativeSession {
                harness: "kimi-cli".to_string(),
                session_id: id.clone(),
                path: ctx.to_string_lossy().to_string(),
                cwd: None,
                title: None,
                updated_at: mtime_ms(&ctx),
                created_at: None,
                fingerprint: fingerprint_path(&ctx),
                last_event_id: None,
                installed: false,
                reader: ReaderKind::Jsonl,
                projectable: true,
            }));
        }
    }
    out
}

/// copilot layout (`catalog.ts` listCopilot):
/// `session-state/<id>[/events.jsonl]` or flat `*.jsonl`.
fn list_copilot(root: &Path) -> Vec<NativeSession> {
    let dir = root.join("session-state");
    if !dir.exists() {
        return Vec::new();
    }
    let Ok(entries) = fs::read_dir(&dir) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for entry in entries.filter_map(|e| e.ok()) {
        let (events, id) = if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            let events = entry.path().join("events.jsonl");
            (events, entry.file_name().to_string_lossy().to_string())
        } else {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".jsonl") {
                continue;
            }
            (
                entry.path(),
                name.strip_suffix(".jsonl").unwrap_or(&name).to_string(),
            )
        };
        if !events.exists() {
            continue;
        }
        out.push(session(NativeSession {
            harness: "copilot".to_string(),
            session_id: id.clone(),
            path: events.to_string_lossy().to_string(),
            cwd: None,
            title: None,
            updated_at: mtime_ms(&events),
            created_at: None,
            fingerprint: fingerprint_path(&events),
            last_event_id: None,
            installed: false,
            reader: ReaderKind::Jsonl,
            projectable: true,
        }));
    }
    out
}

/// pi/omp layout (`catalog.ts` listPiLike): `sessions/**.jsonl`, depth 5,
/// id = final `_`-separated segment.
fn list_pi_like(harness: &str, root: &Path) -> Vec<NativeSession> {
    let sessions = root.join("sessions");
    if !sessions.exists() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for dir in walk_dirs(&sessions, 5) {
        for file in list_files(&dir, |n| n.ends_with(".jsonl")) {
            let stem = file
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let id = stem.rsplit('_').next().unwrap_or(&stem).to_string();
            out.push(session(NativeSession {
                harness: harness.to_string(),
                session_id: id.clone(),
                path: file.to_string_lossy().to_string(),
                cwd: None,
                title: None,
                updated_at: mtime_ms(&file),
                created_at: None,
                fingerprint: fingerprint_path(&file),
                last_event_id: None,
                installed: false,
                reader: ReaderKind::Jsonl,
                projectable: true,
            }));
        }
    }
    out
}

/// cursor layout (`catalog.ts` listCursor):
/// `projects/<proj>/agent-transcripts/<id>[.jsonl]`.
fn list_cursor(root: &Path) -> Vec<NativeSession> {
    let projects = root.join("projects");
    if !projects.exists() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for project in read_dir_dirs(&projects) {
        let transcripts = project.join("agent-transcripts");
        if !transcripts.exists() {
            continue;
        }
        let Ok(entries) = fs::read_dir(&transcripts) else {
            continue;
        };
        for entry in entries.filter_map(|e| e.ok()) {
            let (file, id) = if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let name = entry.file_name().to_string_lossy().to_string();
                (entry.path().join(format!("{}.jsonl", name)), name)
            } else {
                let name = entry.file_name().to_string_lossy().to_string();
                if !name.ends_with(".jsonl") {
                    continue;
                }
                (entry.path(), name.strip_suffix(".jsonl").unwrap_or(&name).to_string())
            };
            if !file.ends_with(".jsonl") || !file.exists() {
                continue;
            }
            out.push(session(NativeSession {
                harness: "cursor".to_string(),
                session_id: id.clone(),
                path: file.to_string_lossy().to_string(),
                cwd: None,
                title: None,
                updated_at: mtime_ms(&file),
                created_at: None,
                fingerprint: fingerprint_path(&file),
                last_event_id: None,
                installed: false,
                reader: ReaderKind::Jsonl,
                projectable: true,
            }));
        }
    }
    out
}

/// openhands layout (`catalog.ts` listOpenHands): one directory per session.
fn list_openhands(root: &Path) -> Vec<NativeSession> {
    if !root.exists() {
        return Vec::new();
    }
    read_dir_dirs(root)
        .into_iter()
        .map(|dir| {
            let id = basename(&dir);
            session(NativeSession {
                harness: "openhands".to_string(),
                session_id: id.clone(),
                path: dir.to_string_lossy().to_string(),
                cwd: None,
                title: None,
                updated_at: mtime_ms(&dir),
                created_at: None,
                fingerprint: fingerprint_path(&dir),
                last_event_id: None,
                installed: false,
                reader: ReaderKind::Directory,
                projectable: true,
            })
        })
        .collect()
}

/// muse layout (`catalog.ts` listMuse): `sessions/**/session.jsonl`, depth 4,
/// id = directory name.
fn list_muse(root: &Path) -> Vec<NativeSession> {
    let sessions = root.join("sessions");
    if !sessions.exists() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for dir in walk_dirs(&sessions, 4) {
        let file = dir.join("session.jsonl");
        if !file.exists() {
            continue;
        }
        let id = basename(&dir);
        out.push(session(NativeSession {
            harness: "muse".to_string(),
            session_id: id.clone(),
            path: file.to_string_lossy().to_string(),
            cwd: None,
            title: None,
            updated_at: mtime_ms(&file),
            created_at: None,
            fingerprint: fingerprint_path(&file),
            last_event_id: None,
            installed: false,
            reader: ReaderKind::Jsonl,
            projectable: true,
        }));
    }
    out
}

/// vibe layout (`catalog.ts` listVibe): `logs/session/<dir>/messages.jsonl`.
fn list_vibe(root: &Path) -> Vec<NativeSession> {
    let dir = root.join("logs").join("session");
    if !dir.exists() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for ses in read_dir_dirs(&dir) {
        let messages = ses.join("messages.jsonl");
        if !messages.exists() {
            continue;
        }
        let name = basename(&ses);
        let id = name
            .trim_start_matches("session_")
            .rsplit('_')
            .next()
            .unwrap_or(&name)
            .to_string();
        out.push(session(NativeSession {
            harness: "vibe".to_string(),
            session_id: id.clone(),
            path: ses.to_string_lossy().to_string(),
            cwd: None,
            title: None,
            updated_at: mtime_ms(&messages),
            created_at: None,
            fingerprint: fingerprint_path(&ses),
            last_event_id: None,
            installed: false,
            reader: ReaderKind::Directory,
            projectable: true,
        }));
    }
    out
}

/// gemini layout (`catalog.ts` listGemini): `tmp/**/chats/*.{json,jsonl}`, depth 3.
fn list_gemini(root: &Path) -> Vec<NativeSession> {
    let tmp = root.join("tmp");
    if !tmp.exists() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for dir in walk_dirs(&tmp, 3) {
        let chats = dir.join("chats");
        if !chats.exists() {
            continue;
        }
        for file in list_files(&chats, |n| n.ends_with(".json") || n.ends_with(".jsonl")) {
            let name = basename(&file);
            let id = name
                .strip_suffix(".jsonl")
                .or_else(|| name.strip_suffix(".json"))
                .unwrap_or(&name)
                .to_string();
            out.push(session(NativeSession {
                harness: "gemini".to_string(),
                session_id: id.clone(),
                path: file.to_string_lossy().to_string(),
                cwd: None,
                title: None,
                updated_at: mtime_ms(&file),
                created_at: None,
                fingerprint: fingerprint_path(&file),
                last_event_id: None,
                installed: false,
                reader: ReaderKind::Jsonl,
                projectable: true,
            }));
        }
    }
    out
}

/// factory droid layout (`catalog.ts` listFactory): flat `sessions/*.{jsonl,json}`.
fn list_factory(root: &Path) -> Vec<NativeSession> {
    let sessions = root.join("sessions");
    if !sessions.exists() {
        return Vec::new();
    }
    list_files(&sessions, |n| n.ends_with(".jsonl") || n.ends_with(".json"))
        .into_iter()
        .map(|file| {
            let name = basename(&file);
            let id = name
                .strip_suffix(".jsonl")
                .or_else(|| name.strip_suffix(".json"))
                .unwrap_or(&name)
                .to_string();
            session(NativeSession {
                harness: "droid".to_string(),
                session_id: id.clone(),
                path: file.to_string_lossy().to_string(),
                cwd: None,
                title: None,
                updated_at: mtime_ms(&file),
                created_at: None,
                fingerprint: fingerprint_path(&file),
                last_event_id: None,
                installed: false,
                reader: ReaderKind::Jsonl,
                projectable: true,
            })
        })
        .collect()
}

/// cline layout (`catalog.ts` listCline):
/// `tasks/<taskId>/api_conversation_history.json` + optional `ui_messages.json`.
fn list_cline(root: &Path) -> Vec<NativeSession> {
    let tasks = root.join("tasks");
    if !tasks.exists() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for task in read_dir_dirs(&tasks) {
        let history = task.join("api_conversation_history.json");
        if !history.exists() {
            continue;
        }
        let ui = task.join("ui_messages.json");
        let mut title = None;
        if let Ok(parsed) =
            serde_json::from_slice::<serde_json::Value>(&fs::read(&history).unwrap_or_default())
        {
            if let Some(first) = parsed.as_array().and_then(|msgs| {
                msgs.iter().find(|m| {
                    m.get("role").and_then(|r| r.as_str()) == Some("user")
                        && m.get("content").and_then(|c| c.as_str()).is_some()
                })
            }) {
                title = first
                    .get("content")
                    .and_then(|c| c.as_str())
                    .map(|s| s.chars().take(120).collect());
            }
        }
        let id = basename(&task);
        let fp_targets: Vec<&Path> = [&history, &ui]
            .iter()
            .filter(|p| p.exists())
            .map(|p| p.as_path())
            .collect();
        out.push(session(NativeSession {
            harness: "cline".to_string(),
            session_id: id.clone(),
            path: task.to_string_lossy().to_string(),
            cwd: None,
            title,
            updated_at: mtime_ms(&history),
            created_at: None,
            fingerprint: fingerprint_paths(&fp_targets),
            last_event_id: Some(id),
            installed: false,
            reader: ReaderKind::Directory,
            projectable: true,
        }));
    }
    out
}

/// amp layout (`catalog.ts` listAmp): `threads/T-*.json` with title + createdAt
/// from the JSON document.
fn list_amp(root: &Path) -> Vec<NativeSession> {
    let threads = root.join("threads");
    if !threads.exists() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for file in list_files(&threads, |n| n.starts_with("T-") && n.ends_with(".json")) {
        let id = basename(&file).strip_suffix(".json").unwrap_or(&basename(&file)).to_string();
        let mut title = None;
        let mut created_at = None;
        if let Ok(parsed) =
            serde_json::from_slice::<serde_json::Value>(&fs::read(&file).unwrap_or_default())
        {
            if let Some(created) = parsed.get("created_at").and_then(|c| c.as_str()) {
                if let Some(t) = parse_rfc3339_ms(created) {
                    created_at = Some(t);
                }
            }
            if let Some(first) = parsed.get("messages").and_then(|m| m.as_array()).and_then(
                |msgs| {
                    msgs.iter()
                        .find(|m| m.get("role").and_then(|r| r.as_str()) == Some("user"))
                },
            ) {
                title = content_text(first.get("content")).map(|s| s.chars().take(120).collect());
            }
        }
        out.push(session(NativeSession {
            harness: "amp".to_string(),
            session_id: id.clone(),
            path: file.to_string_lossy().to_string(),
            cwd: None,
            title,
            updated_at: mtime_ms(&file),
            created_at,
            fingerprint: fingerprint_path(&file),
            last_event_id: Some(id),
            installed: false,
            reader: ReaderKind::Directory,
            projectable: true,
        }));
    }
    out
}

/// Extract text from an Anthropic-style `content` field (string or block array)
/// — the subset of `jsonl.ts` contentText the amp walker needs.
fn content_text(content: Option<&serde_json::Value>) -> Option<String> {
    match content {
        Some(serde_json::Value::String(s)) => Some(s.clone()),
        Some(serde_json::Value::Array(blocks)) => {
            let mut out = String::new();
            for block in blocks {
                if block.get("type").and_then(|t| t.as_str()) == Some("text") {
                    if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                        out.push_str(text);
                    }
                }
            }
            Some(out)
        }
        _ => None,
    }
}

/// Parse an RFC 3339 timestamp into truncated milliseconds, mirroring
/// `Date.parse` (which returns NaN → `undefined` for garbage input).
fn parse_rfc3339_ms(s: &str) -> Option<u64> {
    time::OffsetDateTime::parse(s, &time::format_description::well_known::Rfc3339)
        .ok()
        .map(|d| {
            let millis = (d.unix_timestamp_nanos() / 1_000_000).max(0);
            millis as u64
        })
}

/// `catalog.ts` listHarnesses.
pub fn list_harnesses(home: &Path) -> Vec<HarnessListing> {
    HARNESSES
        .iter()
        .map(|h| {
            let home_path = harness_home(h.id, home).unwrap_or_else(|| PathBuf::from(""));
            HarnessListing {
                id: h.id.to_string(),
                label: h.label.to_string(),
                reader: h.reader,
                projectable: h.projectable,
                resume_hint: h.resume_hint.to_string(),
                home: home_path.to_string_lossy().to_string(),
                present: home_path.exists(),
            }
        })
        .collect()
}

/// `catalog.ts` listNativeSessions. `home` defaults are left to the caller
/// (the panel passes the real home dir; tests pass a fixture home).
///
/// Deferred readers (sqlite/cli-export: opencode, antigravity, hermes,
/// mastracode, devin, crush, kilo) return no rows by binding decision.
pub fn list_native_sessions(home: &Path, harnesses: Option<&[&str]>, cwd: Option<&str>) -> Vec<NativeSession> {
    let wanted: Vec<&str> = match harnesses {
        Some(ids) => ids.to_vec(),
        None => HARNESSES.iter().map(|h| h.id).collect(),
    };
    let mut out: Vec<NativeSession> = Vec::new();
    for id in wanted {
        let Some(root) = harness_home(id, home) else { continue };
        if !root.exists() {
            continue;
        }
        match id {
            "claude" => out.extend(list_claude_like("claude", &root, "projects", ReaderKind::Jsonl, false)),
            "gizzi" => out.extend(list_claude_like("gizzi", &root, "projects", ReaderKind::Jsonl, false)),
            "qwen" => out.extend(list_claude_like("qwen", &root, "projects", ReaderKind::Jsonl, true)),
            "codex" => out.extend(list_codex(&root)),
            "grok" => out.extend(list_grok(&root)),
            "kimi" => out.extend(list_kimi_code(&root)),
            "kimi-cli" => out.extend(list_kimi_cli(&root)),
            "copilot" => out.extend(list_copilot(&root)),
            "pi" => out.extend(list_pi_like("pi", &root)),
            "omp" => out.extend(list_pi_like("omp", &root)),
            "cursor" => out.extend(list_cursor(&root)),
            "openhands" => out.extend(list_openhands(&root)),
            "muse" => out.extend(list_muse(&root)),
            "vibe" => out.extend(list_vibe(&root)),
            "gemini" => out.extend(list_gemini(&root)),
            "droid" => out.extend(list_factory(&root)),
            "cline" => out.extend(list_cline(&root)),
            "amp" => out.extend(list_amp(&root)),
            // sqlite/cli-export readers deferred (binding decision 3).
            _ => {}
        }
    }
    if let Some(cwd) = cwd {
        let encoded = encode_claude_cwd(cwd);
        let grok_enc = encode_grok_cwd(cwd);
        return out
            .into_iter()
            .filter(|s| {
                if let Some(scwd) = &s.cwd {
                    if scwd == cwd || scwd.contains(cwd) {
                        return true;
                    }
                }
                s.path.contains(&encoded) || s.path.contains(&grok_enc)
            })
            .collect();
    }
    out.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_home() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn kimi_walker_reads_state_json() {
        let home = fixture_home();
        let dir = home
            .path()
            .join(".kimi-code")
            .join("sessions")
            .join("wd_abc123")
            .join("session_def456");
        std::fs::create_dir_all(dir.join("agents").join("main")).unwrap();
        std::fs::write(
            dir.join("state.json"),
            r#"{"id":"session_aaa-bbb-ccc","cwd":"/tmp/demo","updatedAt":1725974400000}"#,
        )
        .unwrap();
        std::fs::write(dir.join("agents").join("main").join("wire.jsonl"), "{}\n").unwrap();

        let rows = list_native_sessions(
            home.path(),
            Some(&["kimi"]),
            None,
        );
        assert_eq!(rows.len(), 1);
        let row = &rows[0];
        assert_eq!(row.harness, "kimi");
        // state.json id wins, "session_" prefix stripped (catalog.ts:184).
        assert_eq!(row.session_id, "aaa-bbb-ccc");
        assert_eq!(row.cwd.as_deref(), Some("/tmp/demo"));
        assert_eq!(row.updated_at, 1725974400000);
        assert_eq!(row.reader, ReaderKind::Directory);
        assert!(row.projectable);
        assert!(row.path.ends_with("session_def456"));
        assert_eq!(row.fingerprint.len(), 64);
    }

    #[test]
    fn kimi_walker_falls_back_to_dir_name() {
        let home = fixture_home();
        let dir = home
            .path()
            .join(".kimi-code")
            .join("sessions")
            .join("wd_x")
            .join("session_fallback-id");
        std::fs::create_dir_all(&dir).unwrap();

        let rows = list_native_sessions(home.path(), Some(&["kimi"]), None);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].session_id, "fallback-id");
        assert!(rows[0].cwd.is_none());
    }

    #[test]
    fn claude_walker_skips_runtime_files_and_dash_projects() {
        let home = fixture_home();
        let proj = home.path().join(".claude").join("projects").join("-Users-joe-demo");
        std::fs::create_dir_all(&proj).unwrap();
        std::fs::write(proj.join("11111111-2222-3333-4444-555555555555.jsonl"), "{}\n").unwrap();
        std::fs::write(proj.join("66666666-2222-3333-4444-555555555555.runtime.jsonl"), "{}\n").unwrap();

        let rows = list_native_sessions(home.path(), Some(&["claude"]), None);
        assert_eq!(rows.len(), 1, ".runtime. files must be excluded");
        assert_eq!(rows[0].session_id, "11111111-2222-3333-4444-555555555555");
        // Project dirs are dash-encoded cwd paths; the TS catalog leaves
        // cwd undefined for them (catalog.ts:62) — the cwd filter matches
        // via the encoded path component instead.
        assert!(rows[0].cwd.is_none());

        // Project dirs whose name starts with "-" have no cwd (catalog.ts:62).
        let dash = home.path().join(".claude").join("projects").join("-tmp-dash");
        std::fs::create_dir_all(&dash).unwrap();
        std::fs::write(dash.join("abc.jsonl"), "{}\n").unwrap();
        let rows = list_native_sessions(home.path(), Some(&["claude"]), None);
        assert_eq!(rows.len(), 2);
        let dash_row = rows.iter().find(|r| r.session_id == "abc").unwrap();
        assert!(dash_row.cwd.is_none());
    }

    #[test]
    fn codex_walker_extracts_uuid_and_marks_archived() {
        let home = fixture_home();
        let codex = home.path().join(".codex");
        let live = codex.join("sessions").join("2026").join("09").join("10");
        std::fs::create_dir_all(&live).unwrap();
        let uuid = "123e4567-e89b-42d3-a456-426614174000";
        std::fs::write(live.join(format!("rollout-2026-09-10T00-00-00-{}.jsonl", uuid)), "{}\n").unwrap();
        let archived = codex.join("archived_sessions");
        std::fs::create_dir_all(&archived).unwrap();
        std::fs::write(archived.join(format!("rollout-old-{}.jsonl.zst", uuid)), "zst").unwrap();

        let rows = list_native_sessions(home.path(), Some(&["codex"]), None);
        assert_eq!(rows.len(), 2);
        let live_row = rows.iter().find(|r| r.title.is_none()).unwrap();
        assert_eq!(live_row.session_id, uuid);
        assert_eq!(live_row.last_event_id.as_deref(), Some(uuid));
        let archived_row = rows.iter().find(|r| r.title.is_some()).unwrap();
        assert_eq!(archived_row.title.as_deref(), Some("(archived)"));
        assert!(archived_row.last_event_id.is_none());
    }

    #[test]
    fn sessions_sorted_by_updated_at_descending() {
        let home = fixture_home();
        let proj = home.path().join(".claude").join("projects").join("p");
        std::fs::create_dir_all(&proj).unwrap();
        std::fs::write(proj.join("a.jsonl"), "{}\n").unwrap();
        std::fs::write(proj.join("b.jsonl"), "{}\n{}\n{}\n").unwrap();

        let rows = list_native_sessions(home.path(), Some(&["claude"]), None);
        assert_eq!(rows.len(), 2);
        assert!(rows[0].updated_at >= rows[1].updated_at);
    }

    #[test]
    fn cwd_filter_matches_claude_encoding_and_row_cwd() {
        let home = fixture_home();
        let proj = home
            .path()
            .join(".claude")
            .join("projects")
            .join("-Users-joe-demo");
        std::fs::create_dir_all(&proj).unwrap();
        std::fs::write(proj.join("s1.jsonl"), "{}\n").unwrap();
        let other = home.path().join(".claude").join("projects").join("-tmp-other");
        std::fs::create_dir_all(&other).unwrap();
        std::fs::write(other.join("s2.jsonl"), "{}\n").unwrap();

        let rows = list_native_sessions(home.path(), Some(&["claude"]), Some("/Users/joe/demo"));
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].session_id, "s1");
    }

    #[test]
    fn deferred_sqlite_harnesses_return_no_rows() {
        let home = fixture_home();
        // Even with on-disk state, deferred readers must not enumerate.
        std::fs::create_dir_all(home.path().join(".opencode")).unwrap();
        std::fs::write(home.path().join(".opencode").join("opencode.db"), "").unwrap();
        let rows = list_native_sessions(home.path(), Some(&["opencode"]), None);
        assert!(rows.is_empty(), "sqlite readers are deferred by binding decision");
    }

    #[test]
    fn unknown_or_absent_harness_returns_nothing() {
        let home = fixture_home();
        assert!(list_native_sessions(home.path(), Some(&["kimi"]), None).is_empty());
        assert!(list_native_sessions(home.path(), Some(&["nope"]), None).is_empty());
    }

    #[test]
    fn join_key_format_matches_spec() {
        let home = fixture_home();
        let dir = home
            .path()
            .join(".kimi-code")
            .join("sessions")
            .join("wd_a")
            .join("session_x1");
        std::fs::create_dir_all(&dir).unwrap();
        let rows = list_native_sessions(home.path(), Some(&["kimi"]), None);
        assert_eq!(rows[0].join_key(), "kimi+x1");
    }
}

//! Environment allowlist for spawned child processes.
//!
//! Spawning local CLIs or shell commands must never inherit the full API
//! process environment, which can contain database credentials, encryption
//! keys, cloud tokens, and session secrets. This module provides a small
//! allowlist of harmless, required variables plus an explicit override map.

use std::collections::HashMap;

/// Variables that are safe to forward to local child processes.
const ALLOWLIST: &[&str] = &[
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "SHELL",
    "TMPDIR",
    "TMP",
    "TEMP",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "GIZZI_CONFIG_HOME",
    "ALLTERNIT_DATA_DIR",
];

/// Build a sanitized environment map for a child process.
///
/// Starts with the allowlisted variables from the current process, then applies
/// the caller-supplied overrides. The overrides can add new variables or
/// replace allowlisted ones, but they cannot resurrect secret variables that
/// were not explicitly provided.
pub fn minimal_child_env(overrides: Option<HashMap<String, String>>) -> HashMap<String, String> {
    let mut env = HashMap::new();
    for key in ALLOWLIST {
        if let Ok(value) = std::env::var(key) {
            if !value.is_empty() {
                env.insert((*key).to_string(), value);
            }
        }
    }
    if let Some(overrides) = overrides {
        env.extend(overrides);
    }
    env
}

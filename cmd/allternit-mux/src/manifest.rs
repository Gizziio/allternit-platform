//! TOML detection manifests: per-agent process names and blocked-prompt rules.
//!
//! Modeled on Herdr's manifest idea (local overrides win over bundled defaults)
//! but loaded from Allternit paths and never fetched remotely.
//!
//! File format (`<state_dir>/agent-detection/<agent>.toml` or
//! `~/.config/allternit-mux/agent-detection/<agent>.toml`):
//!
//! ```toml
//! agent = "kimi"
//! processes = ["kimi", "kimi-cli"]
//! blocked_patterns = ["(?i)allow\\??\\s*$", "(?i)\\(y/n\\)\\s*$"]
//! ```

use regex::Regex;
use serde::Deserialize;
use std::path::Path;
use tracing::warn;

#[derive(Debug, Clone)]
pub struct AgentManifest {
    pub agent: String,
    pub processes: Vec<String>,
    pub blocked_patterns: Vec<Regex>,
}

#[derive(Debug, Deserialize)]
struct ManifestFile {
    agent: String,
    #[serde(default)]
    processes: Vec<String>,
    #[serde(default)]
    blocked_patterns: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ManifestSet {
    manifests: Vec<AgentManifest>,
}

/// Bundled defaults, used when no local file overrides them.
fn builtin_manifests() -> Vec<AgentManifest> {
    let common_blocked = vec![
        r"(?i)\ballow\??\s*$",
        r"(?i)\(y/n\)\s*$",
        r"(?i)\[y/n\]\s*$",
        r"(?i)do you want to proceed",
        r"(?i)permission (required|needed|to)",
        r"(?i)approve\??\s*$",
        r"(?i)waiting for (input|approval|confirmation)",
        r"(?i)press enter to (confirm|continue)",
        r"(?i)are you sure",
    ];
    let mk = |agent: &str, procs: &[&str], extra: &[&str]| AgentManifest {
        agent: agent.to_string(),
        processes: procs.iter().map(|s| s.to_string()).collect(),
        blocked_patterns: common_blocked
            .iter()
            .chain(extra.iter())
            .map(|p| Regex::new(p).unwrap())
            .collect(),
    };
    vec![
        mk("kimi", &["kimi", "kimi-cli"], &[]),
        mk(
            "claude",
            &["claude", "claude-code"],
            &[r"(?i)do you want to (allow|run)", r"(?i)yes,?\s*(i)?\s*(allow|trust)"],
        ),
        mk("codex", &["codex"], &[r"(?i)\[a\]llow", r"(?i)approve (command|patch)"]),
        mk("agy", &["agy"], &[]),
        mk("gizzi", &["gizzi", "gizzi-code"], &[]),
        mk("pi", &["pi"], &[]),
        mk("amp", &["amp"], &[]),
        // Fallback for any known-looking agent process matched by path.
        mk("agent", &[], &[]),
    ]
}

impl ManifestSet {
    /// Load manifests: bundled defaults, then file overrides from
    /// `<state_dir>/agent-detection/*.toml` and
    /// `~/.config/allternit-mux/agent-detection/*.toml`. Files override by
    /// agent name; invalid files are skipped with a warning.
    pub fn load(state_dir: &Path) -> Self {
        let mut manifests = builtin_manifests();
        let mut dirs = vec![state_dir.join("agent-detection")];
        if let Ok(home) = std::env::var("HOME") {
            dirs.push(
                Path::new(&home)
                    .join(".config")
                    .join("allternit-mux")
                    .join("agent-detection"),
            );
        }
        for dir in dirs {
            let Ok(entries) = std::fs::read_dir(&dir) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("toml") {
                    continue;
                }
                match Self::parse_file(&path) {
                    Ok(m) => {
                        manifests.retain(|x| x.agent != m.agent);
                        manifests.push(m);
                    }
                    Err(e) => warn!("ignoring invalid manifest {}: {e:#}", path.display()),
                }
            }
        }
        Self { manifests }
    }

    fn parse_file(path: &Path) -> anyhow::Result<AgentManifest> {
        let raw = std::fs::read_to_string(path)?;
        let f: ManifestFile = toml::from_str(&raw)?;
        let mut blocked_patterns = Vec::new();
        for p in &f.blocked_patterns {
            blocked_patterns.push(Regex::new(p)?);
        }
        Ok(AgentManifest {
            agent: f.agent,
            processes: f.processes,
            blocked_patterns,
        })
    }

    /// Find a manifest whose process list matches a command line's first word
    /// (basename) or an `exec -a <name>` wrapper.
    pub fn match_command(&self, command_line: &str) -> Option<&AgentManifest> {
        let first_word = command_line
            .split_whitespace()
            .next()
            .unwrap_or("")
            .rsplit('/')
            .next()
            .unwrap_or("")
            .to_lowercase();
        let lower = command_line.to_lowercase();
        self.manifests.iter().find(|m| {
            m.processes.iter().any(|p| {
                first_word == *p
                    || lower.contains(&format!("exec -a {p}"))
                    || lower.contains(&format!("/{p} "))
                    || lower.ends_with(&format!("/{p}"))
            })
        })
    }

    /// Manifest by agent name.
    pub fn by_agent(&self, agent: &str) -> Option<&AgentManifest> {
        self.manifests.iter().find(|m| m.agent == agent)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_matches_agents() {
        let set = ManifestSet {
            manifests: builtin_manifests(),
        };
        assert_eq!(set.match_command("kimi --yolo").unwrap().agent, "kimi");
        assert_eq!(
            set.match_command("/usr/local/bin/claude").unwrap().agent,
            "claude"
        );
        assert!(set.match_command("vim file").is_none());
    }

    #[test]
    fn file_override_wins() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("agent-detection");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("kimi.toml"),
            "agent = \"kimi\"\nprocesses = [\"kimi\"]\nblocked_patterns = [\"CUSTOMBLOCK\"]\n",
        )
        .unwrap();
        let set = ManifestSet::load(tmp.path());
        let m = set.by_agent("kimi").unwrap();
        assert_eq!(m.blocked_patterns.len(), 1);
        assert!(m.blocked_patterns[0].is_match("CUSTOMBLOCK"));
        assert!(!m.blocked_patterns[0].is_match("(y/n)"));
    }
}

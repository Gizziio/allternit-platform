//! Parse `.steering/checkpoint.md` into a structured checkpoint.

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

use crate::steer::types::SteeringCheckpoint;

pub fn checkpoint_path(root_dir: &Path) -> PathBuf {
    root_dir.join(".steering").join("checkpoint.md")
}

/// Read and parse the checkpoint file if it exists; return a default empty
/// checkpoint otherwise.
pub async fn load_checkpoint(root_dir: &Path) -> Result<SteeringCheckpoint> {
    let path = checkpoint_path(root_dir);
    if !path.exists() {
        return Ok(SteeringCheckpoint::default());
    }
    let raw = tokio::fs::read_to_string(&path)
        .await
        .with_context(|| format!("reading {:?}", path))?;
    Ok(parse_checkpoint(&raw))
}

pub fn parse_checkpoint(raw: &str) -> SteeringCheckpoint {
    let mut goal = String::new();
    let mut just_did = String::new();
    let mut next_steps = String::new();
    let mut open_questions = String::new();

    let mut current_section: Option<&mut String> = None;
    let mut in_section = false;

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("## Goal") {
            current_section = Some(&mut goal);
            in_section = true;
            continue;
        }
        if trimmed.starts_with("## Just did") || trimmed.starts_with("## Just Did") {
            current_section = Some(&mut just_did);
            in_section = true;
            continue;
        }
        if trimmed.starts_with("## Next") {
            current_section = Some(&mut next_steps);
            in_section = true;
            continue;
        }
        if trimmed.starts_with("## Open questions") || trimmed.starts_with("## Open Questions") {
            current_section = Some(&mut open_questions);
            in_section = true;
            continue;
        }
        if trimmed.starts_with("## ") && !trimmed.starts_with("## Goal")
            && !trimmed.starts_with("## Just")
            && !trimmed.starts_with("## Next")
            && !trimmed.starts_with("## Open")
        {
            // Unknown section; stop accumulating known sections.
            current_section = None;
            in_section = false;
            continue;
        }
        if let Some(section) = current_section.as_deref_mut() {
            if in_section {
                section.push_str(line);
                section.push('\n');
            }
        }
    }

    SteeringCheckpoint {
        goal: goal.trim().to_string(),
        just_did: just_did.trim().to_string(),
        next_steps: next_steps.trim().to_string(),
        open_questions: open_questions.trim().to_string(),
        raw: raw.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_checkpoint() {
        let raw = r#"# Steering checkpoint

## Goal

Finish the thing.

## Just did

Did part A.

## Next

Do part B.

## Open questions

Is this right?
"#;
        let cp = parse_checkpoint(raw);
        assert!(cp.goal.contains("Finish the thing"));
        assert!(cp.just_did.contains("Did part A"));
        assert!(cp.next_steps.contains("Do part B"));
        assert!(cp.open_questions.contains("Is this right"));
    }
}

//! Working-copy lifecycle: scratch-copy a target repo, apply an ordered
//! patch chain, and produce a diff back out with protected paths force-reset
//! and — impossible by construction — stripped from the result.
//!
//! "Protected" paths are things a generation must never be able to modify:
//! the eval harness, its golden data, whatever else scores it. They're
//! excluded from the working copy on creation, force-reset to their
//! original state before a diff is produced, and the diff itself is passed
//! through [`filter_patch_by_paths`], which filters *and re-verifies* —
//! see that function's docs for the exact guarantee.

use std::path::{Path, PathBuf};
use std::process::Command;
use walkdir::WalkDir;

/// Errors returned by working-copy operations.
#[derive(Debug, thiserror::Error)]
pub enum WorkingCopyError {
    #[error("source path does not exist: {0}")]
    SourceNotFound(PathBuf),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("git apply failed for {patch}: {stderr}")]
    ApplyFailed { patch: PathBuf, stderr: String },
    #[error("git command failed: {0}")]
    Git(String),
    #[error("protected path survived filtering, refusing to return the diff: {0}")]
    ProtectedPathLeak(String),
}

pub type Result<T> = std::result::Result<T, WorkingCopyError>;

/// A scratch copy of a target repository.
#[derive(Debug)]
pub struct WorkingCopy {
    /// The original, untouched repo this working copy was created from —
    /// the pristine baseline `finalize_diff` restores protected paths from
    /// and diffs against.
    source: PathBuf,
    path: PathBuf,
    /// Paths relative to the repo root that must never be modified by a
    /// generation, e.g. the eval harness directory.
    protected: Vec<PathBuf>,
}

impl WorkingCopy {
    /// Copy `source` into `dest` (created if it doesn't exist), excluding
    /// `protected` paths from the copy entirely. Symlinks are skipped, so
    /// the resulting working copy is fully self-contained under `dest`.
    pub fn create(source: &Path, dest: &Path, protected: &[PathBuf]) -> Result<Self> {
        if !source.exists() {
            return Err(WorkingCopyError::SourceNotFound(source.to_path_buf()));
        }
        std::fs::create_dir_all(dest)?;

        for entry in WalkDir::new(source)
            .into_iter()
            .filter_entry(|entry| {
                // Skip descending into protected directories entirely, rather than
                // walking them and excluding every entry one at a time below.
                match entry.path().strip_prefix(source) {
                    Ok(relative) if !relative.as_os_str().is_empty() => !is_excluded(relative, protected),
                    _ => true, // the root entry itself
                }
            })
            .filter_map(|entry| entry.ok())
        {
            let relative = match entry.path().strip_prefix(source) {
                Ok(relative) if !relative.as_os_str().is_empty() => relative,
                _ => continue, // the root entry itself
            };
            if is_excluded(relative, protected) {
                continue;
            }
            let target = dest.join(relative);
            let file_type = entry.file_type();
            if file_type.is_dir() {
                std::fs::create_dir_all(&target)?;
            } else if file_type.is_file() {
                if let Some(parent) = target.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                std::fs::copy(entry.path(), &target)?;
            }
            // Symlinks are intentionally skipped.
        }

        Ok(Self { source: source.to_path_buf(), path: dest.to_path_buf(), protected: protected.to_vec() })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Apply an ordered chain of patch files (e.g. from
    /// `lineage::LineageArchive::patch_chain`) with `git apply`. Stops at
    /// and surfaces the first failure — never silently skips a patch or
    /// continues past one that didn't apply.
    pub fn apply_patches(&self, patches: &[PathBuf]) -> Result<()> {
        for patch in patches {
            let output = Command::new("git")
                .arg("-C")
                .arg(&self.path)
                .args(["apply", "--whitespace=nowarn"])
                .arg(patch)
                .output()
                .map_err(|e| WorkingCopyError::Git(e.to_string()))?;
            if !output.status.success() {
                return Err(WorkingCopyError::ApplyFailed {
                    patch: patch.clone(),
                    stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
                });
            }
        }
        Ok(())
    }

    /// After a run: force-reset protected paths back to `source`'s original
    /// state, then produce a diff of the working copy against `source` with
    /// protected paths filtered out and verified absent.
    pub fn finalize_diff(&self) -> Result<String> {
        self.restore_protected()?;

        let output = Command::new("git")
            .args(["diff", "--no-index", "--no-color"])
            .arg(&self.source)
            .arg(&self.path)
            .output()
            .map_err(|e| WorkingCopyError::Git(e.to_string()))?;
        // `git diff --no-index` exits 1 when the two trees differ; that's
        // the expected case here, not a failure — only a spawn failure
        // (handled above) counts as an error.
        let raw = String::from_utf8_lossy(&output.stdout).into_owned();

        filter_patch_by_paths(&raw, &self.protected)
    }

    fn restore_protected(&self) -> Result<()> {
        for relative in &self.protected {
            let original = self.source.join(relative);
            let current = self.path.join(relative);
            if current.exists() {
                remove_path(&current)?;
            }
            if original.exists() {
                copy_recursive(&original, &current)?;
            }
        }
        Ok(())
    }
}

fn is_excluded(relative: &Path, protected: &[PathBuf]) -> bool {
    protected.iter().any(|protected| relative == protected.as_path() || relative.starts_with(protected))
}

fn remove_path(path: &Path) -> Result<()> {
    if path.is_dir() {
        std::fs::remove_dir_all(path)?;
    } else {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

fn copy_recursive(source: &Path, dest: &Path) -> Result<()> {
    if source.is_dir() {
        std::fs::create_dir_all(dest)?;
        for entry in std::fs::read_dir(source)? {
            let entry = entry?;
            copy_recursive(&entry.path(), &dest.join(entry.file_name()))?;
        }
    } else {
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::copy(source, dest)?;
    }
    Ok(())
}

/// Drops every per-file block of a unified diff whose *header* (its
/// `diff --git`/`---`/`+++` lines) names a protected path, then re-verifies
/// none of the protected path strings
/// survived anywhere in the result, headers or hunk bodies alike. This two-
/// step shape is the impossible-by-construction guarantee: the header-only
/// drop is not trusted on its own to have caught everything — if a
/// protected path string is still present after filtering (including one
/// that only ever appeared in some other file's hunk body, never a header),
/// this returns `ProtectedPathLeak` instead of the diff, rather than ever
/// handing back text that might expose a protected change.
pub fn filter_patch_by_paths(diff: &str, protected: &[PathBuf]) -> Result<String> {
    if protected.is_empty() {
        return Ok(diff.to_string());
    }

    let blocks = split_diff_blocks(diff);
    let filtered: String = blocks.into_iter().filter(|block| !block_touches_protected(block, protected)).collect();

    for path in protected {
        let needle = path.to_string_lossy();
        if filtered.contains(needle.as_ref()) {
            return Err(WorkingCopyError::ProtectedPathLeak(needle.into_owned()));
        }
    }
    Ok(filtered)
}

/// Splits unified-diff text into per-file blocks, each starting at a
/// `diff --git` line (or, for text with no such line, the whole input as a
/// single block).
fn split_diff_blocks(diff: &str) -> Vec<String> {
    let mut blocks: Vec<String> = Vec::new();
    for line in diff.lines() {
        if line.starts_with("diff --git ") || blocks.is_empty() {
            blocks.push(String::new());
        }
        let block = blocks.last_mut().expect("just pushed");
        block.push_str(line);
        block.push('\n');
    }
    blocks
}

/// Checks only a block's diff-header lines (the `diff --git a/... b/...`
/// line and the `--- a/...` / `+++ b/...` lines, i.e. everything before the
/// first `@@` hunk marker) against `protected` — NOT the hunk bodies. A
/// protected path string appearing incidentally in an unrelated file's
/// changed content must not drop that unrelated file's whole block; the
/// real fail-closed guard is `filter_patch_by_paths`'s re-verify scan over
/// the *filtered* output, which does look at body text and errors instead
/// of returning a diff if anything protected survived.
fn block_touches_protected(block: &str, protected: &[PathBuf]) -> bool {
    block
        .lines()
        .take_while(|line| !line.starts_with("@@"))
        .filter(|line| line.starts_with("diff --git ") || line.starts_with("--- ") || line.starts_with("+++ "))
        .any(|line| protected.iter().any(|path| line.contains(path.to_string_lossy().as_ref())))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_excludes_protected_paths() {
        let source = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(source.path().join("src")).unwrap();
        std::fs::write(source.path().join("src/main.rs"), "fn main() {}").unwrap();
        std::fs::create_dir_all(source.path().join("eval_harness/golden")).unwrap();
        std::fs::write(source.path().join("eval_harness/golden/case1.json"), "{}").unwrap();

        let dest = tempfile::tempdir().unwrap();
        let protected = vec![PathBuf::from("eval_harness")];
        let working_copy = WorkingCopy::create(source.path(), dest.path(), &protected).unwrap();

        assert!(working_copy.path().join("src/main.rs").exists());
        assert!(!working_copy.path().join("eval_harness").exists());
    }

    #[test]
    fn create_prunes_protected_subtree_without_descending() {
        let source = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(source.path().join("eval_harness/nested/deep")).unwrap();
        std::fs::write(source.path().join("eval_harness/nested/deep/secret.json"), "{}").unwrap();
        std::fs::create_dir_all(source.path().join("src")).unwrap();
        std::fs::write(source.path().join("src/main.rs"), "fn main() {}").unwrap();

        let dest = tempfile::tempdir().unwrap();
        let protected = vec![PathBuf::from("eval_harness")];
        let working_copy = WorkingCopy::create(source.path(), dest.path(), &protected).unwrap();

        assert!(working_copy.path().join("src/main.rs").exists());
        assert!(!working_copy.path().join("eval_harness").exists());
        assert!(!working_copy.path().join("eval_harness/nested/deep/secret.json").exists());
    }

    #[test]
    fn create_fails_for_missing_source() {
        let dest = tempfile::tempdir().unwrap();
        let missing = dest.path().join("does-not-exist");
        let err = WorkingCopy::create(&missing, dest.path(), &[]).unwrap_err();
        assert!(matches!(err, WorkingCopyError::SourceNotFound(_)));
    }

    #[test]
    fn filter_patch_by_paths_drops_protected_blocks_and_keeps_others() {
        let diff = concat!(
            "diff --git a/src/main.rs b/src/main.rs\n",
            "index 111..222 100644\n",
            "--- a/src/main.rs\n",
            "+++ b/src/main.rs\n",
            "@@ -1 +1 @@\n",
            "-fn main() {}\n",
            "+fn main() { println!(\"hi\"); }\n",
            "diff --git a/eval_harness/scoring.rs b/eval_harness/scoring.rs\n",
            "index 333..444 100644\n",
            "--- a/eval_harness/scoring.rs\n",
            "+++ b/eval_harness/scoring.rs\n",
            "@@ -1 +1 @@\n",
            "-fn score() -> f64 { real_score() }\n",
            "+fn score() -> f64 { 999.0 }\n",
        );

        let filtered = filter_patch_by_paths(diff, &[PathBuf::from("eval_harness")]).unwrap();
        assert!(filtered.contains("src/main.rs"));
        assert!(!filtered.contains("eval_harness"));
        assert!(!filtered.contains("real_score"));
    }

    #[test]
    fn filter_patch_by_paths_is_a_no_op_with_no_protected_paths() {
        let diff = "diff --git a/x b/x\n";
        assert_eq!(filter_patch_by_paths(diff, &[]).unwrap(), diff);
    }

    #[test]
    fn filter_patch_by_paths_errors_if_a_protected_path_would_survive() {
        // The protected path string appears inside a *kept* block's content
        // (not as that block's own file path) — filtering can't remove it
        // without dropping an unrelated file, so this must fail closed
        // rather than hand back a diff that still mentions it.
        let diff = concat!(
            "diff --git a/src/main.rs b/src/main.rs\n",
            "--- a/src/main.rs\n",
            "+++ b/src/main.rs\n",
            "@@ -1 +1 @@\n",
            "-old\n",
            "+// see eval_harness for scoring\n",
        );
        let err = filter_patch_by_paths(diff, &[PathBuf::from("eval_harness")]).unwrap_err();
        assert!(matches!(err, WorkingCopyError::ProtectedPathLeak(_)));
    }
}

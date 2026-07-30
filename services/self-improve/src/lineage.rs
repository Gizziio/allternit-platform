//! Agents-as-diffs lineage archive.
//!
//! Every generation produced by the self-improvement loop is recorded as a
//! [`Generation`]: an id, a parent id (or none, for a root generation), an
//! ordered list of patch files, a validity flag, and an optional score.
//! Reconstructing any historical agent is a pure function: walk the parent
//! chain and concatenate each ancestor's patch files in order — see
//! [`LineageArchive::patch_chain`]. Nothing here executes a patch; see the
//! `working_copy` module for that.

use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{self, Write};
use std::path::PathBuf;

/// Errors returned by the lineage archive.
#[derive(Debug, thiserror::Error)]
pub enum LineageError {
    #[error("generation not found: {0}")]
    NotFound(String),
    #[error("generation already exists: {0}")]
    AlreadyExists(String),
    #[error("cycle detected while walking parent chain at {0}")]
    Cycle(String),
    #[error("io error: {0}")]
    Io(#[from] io::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, LineageError>;

/// Unique id for a generation. Caller-supplied so the archive stays
/// deterministic and doesn't depend on a clock or RNG for identity.
pub type GenerationId = String;

/// A single generation in the lineage: a task-agent's code, expressed as a
/// diff from its parent (or from nothing, for a root generation).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Generation {
    pub id: GenerationId,
    pub parent_id: Option<GenerationId>,
    /// Patch file names, relative to this generation's `patches/` dir,
    /// applied in this order to go from the parent's state to this one.
    pub patches: Vec<String>,
    pub valid: bool,
    pub score: Option<f64>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl Generation {
    /// Convenience constructor for a not-yet-scored generation. `patches` is
    /// left empty; [`LineageArchive::record`] fills it in from the patch
    /// contents given at record time.
    pub fn new(id: impl Into<GenerationId>, parent_id: Option<GenerationId>) -> Self {
        Self {
            id: id.into(),
            parent_id,
            patches: Vec::new(),
            valid: false,
            score: None,
            created_at: chrono::Utc::now(),
        }
    }
}

/// Parent-selection strategy for choosing which existing generation the next
/// generation should be bred from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParentSelection {
    /// The most recently recorded valid generation.
    Latest,
    /// The valid generation with the highest score (ties favor the most
    /// recently recorded).
    Best,
    /// Sigmoid-weighted sampling over valid, scored generations, penalized
    /// for over-use: `w = sigmoid(score) * exp(-(children/8)^3)`.
    ScoreProportional,
}

/// Archive of generations, backed by `<root>/gen_<id>/{metadata.json,
/// patches/}` per generation, plus a flat, append-only `<root>/archive.jsonl`
/// index (one [`Generation`] per line, in insertion order) that `open`
/// replays to rebuild the in-memory index without walking the directory
/// tree.
#[derive(Debug)]
pub struct LineageArchive {
    root: PathBuf,
    generations: HashMap<GenerationId, Generation>,
    /// Insertion order — HashMap iteration order isn't stable across runs,
    /// and parent selection must be deterministic given a seeded RNG.
    order: Vec<GenerationId>,
}

impl LineageArchive {
    /// Open (creating if necessary) the archive rooted at `root`, replaying
    /// `archive.jsonl` if it already exists.
    pub fn open(root: impl Into<PathBuf>) -> Result<Self> {
        let root = root.into();
        fs::create_dir_all(&root)?;
        let mut archive = Self {
            root,
            generations: HashMap::new(),
            order: Vec::new(),
        };
        let archive_path = archive.archive_path();
        if archive_path.exists() {
            let contents = fs::read_to_string(&archive_path)?;
            for line in contents.lines() {
                if line.trim().is_empty() {
                    continue;
                }
                let generation: Generation = serde_json::from_str(line)?;
                if !archive.generations.contains_key(&generation.id) {
                    archive.order.push(generation.id.clone());
                }
                archive.generations.insert(generation.id.clone(), generation);
            }
        }
        Ok(archive)
    }

    fn archive_path(&self) -> PathBuf {
        self.root.join("archive.jsonl")
    }

    fn gen_dir(&self, id: &str) -> PathBuf {
        self.root.join(format!("gen_{id}"))
    }

    fn patches_dir(&self, id: &str) -> PathBuf {
        self.gen_dir(id).join("patches")
    }

    /// Record a new generation. `patch_contents` is `(file_name, contents)`
    /// pairs, applied in the given order; `generation.patches` is derived
    /// from it (any value the caller set is overwritten), so the metadata
    /// and the files on disk can never disagree. Errors if `generation.id`
    /// already exists, or if its `parent_id` doesn't.
    pub fn record(&mut self, mut generation: Generation, patch_contents: &[(&str, &str)]) -> Result<()> {
        if self.generations.contains_key(&generation.id) {
            return Err(LineageError::AlreadyExists(generation.id));
        }
        if let Some(parent_id) = &generation.parent_id {
            if !self.generations.contains_key(parent_id) {
                return Err(LineageError::NotFound(parent_id.clone()));
            }
        }

        let patches_dir = self.patches_dir(&generation.id);
        fs::create_dir_all(&patches_dir)?;
        for (name, contents) in patch_contents {
            fs::write(patches_dir.join(name), contents)?;
        }
        generation.patches = patch_contents.iter().map(|(name, _)| (*name).to_string()).collect();

        let metadata_path = self.gen_dir(&generation.id).join("metadata.json");
        fs::write(&metadata_path, serde_json::to_vec_pretty(&generation)?)?;

        let mut archive_file = fs::OpenOptions::new().create(true).append(true).open(self.archive_path())?;
        writeln!(archive_file, "{}", serde_json::to_string(&generation)?)?;

        self.order.push(generation.id.clone());
        self.generations.insert(generation.id.clone(), generation);
        Ok(())
    }

    pub fn get(&self, id: &str) -> Result<&Generation> {
        self.generations.get(id).ok_or_else(|| LineageError::NotFound(id.to_string()))
    }

    /// The ordered, absolute patch-file paths needed to reconstruct
    /// generation `id` from nothing: the root ancestor's patches first, down
    /// through `id`'s own. Pure function over the in-memory index — doesn't
    /// touch the filesystem beyond path construction, and never applies
    /// anything.
    pub fn patch_chain(&self, id: &str) -> Result<Vec<PathBuf>> {
        let mut chain: Vec<&Generation> = Vec::new();
        let mut seen = std::collections::HashSet::new();
        let mut current = self.get(id)?;
        loop {
            if !seen.insert(current.id.clone()) {
                return Err(LineageError::Cycle(current.id.clone()));
            }
            chain.push(current);
            match &current.parent_id {
                Some(parent_id) => current = self.get(parent_id)?,
                None => break,
            }
        }
        chain.reverse();

        let mut patches = Vec::new();
        for generation in chain {
            let dir = self.patches_dir(&generation.id);
            for name in &generation.patches {
                patches.push(dir.join(name));
            }
        }
        Ok(patches)
    }

    /// Number of recorded generations that name `id` as their parent.
    pub fn children_count(&self, id: &str) -> usize {
        self.generations.values().filter(|g| g.parent_id.as_deref() == Some(id)).count()
    }

    /// Select a parent generation for the next generation. Only valid
    /// generations are eligible. Deterministic given the same `rng` state —
    /// candidates are walked in insertion order, never HashMap order.
    pub fn select_parent<R: Rng + ?Sized>(&self, strategy: ParentSelection, rng: &mut R) -> Option<GenerationId> {
        let candidates: Vec<&Generation> =
            self.order.iter().filter_map(|id| self.generations.get(id)).filter(|g| g.valid).collect();
        if candidates.is_empty() {
            return None;
        }

        match strategy {
            ParentSelection::Latest => candidates.last().map(|g| g.id.clone()),
            ParentSelection::Best => candidates
                .iter()
                .filter_map(|g| g.score.map(|score| (score, g.id.clone())))
                .max_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal))
                .map(|(_, id)| id)
                .or_else(|| candidates.last().map(|g| g.id.clone())),
            ParentSelection::ScoreProportional => {
                let weights: Vec<(GenerationId, f64)> = candidates
                    .iter()
                    .filter_map(|g| {
                        g.score.map(|score| {
                            let children = self.children_count(&g.id) as f64;
                            let weight = sigmoid(score) * (-(children / 8.0).powi(3)).exp();
                            (g.id.clone(), weight)
                        })
                    })
                    .collect();
                weighted_choice(&weights, rng)
            }
        }
    }
}

fn sigmoid(x: f64) -> f64 {
    1.0 / (1.0 + (-x).exp())
}

/// Deterministic weighted sampling: walks `weights` in the given (stable)
/// order, consuming one `rng.gen::<f64>()` draw.
fn weighted_choice<R: Rng + ?Sized>(weights: &[(GenerationId, f64)], rng: &mut R) -> Option<GenerationId> {
    let total: f64 = weights.iter().map(|(_, w)| w.max(0.0)).sum();
    if weights.is_empty() || total <= 0.0 {
        return None;
    }
    let mut target = rng.gen::<f64>() * total;
    for (id, weight) in weights {
        let weight = weight.max(0.0);
        if target < weight {
            return Some(id.clone());
        }
        target -= weight;
    }
    weights.last().map(|(id, _)| id.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use rand::rngs::StdRng;

    fn make_generation(id: &str, parent: Option<&str>, valid: bool, score: Option<f64>) -> Generation {
        Generation {
            id: id.to_string(),
            parent_id: parent.map(str::to_string),
            patches: Vec::new(),
            valid,
            score,
            created_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn round_trip_reconstructs_middle_generation() {
        let dir = tempfile::tempdir().unwrap();
        let mut archive = LineageArchive::open(dir.path()).unwrap();

        archive.record(make_generation("gen0", None, true, Some(1.0)), &[("0001.patch", "root diff")]).unwrap();
        archive
            .record(make_generation("gen1", Some("gen0"), true, Some(2.0)), &[("0001.patch", "gen1 diff a"), ("0002.patch", "gen1 diff b")])
            .unwrap();
        archive.record(make_generation("gen2", Some("gen1"), true, Some(3.0)), &[("0001.patch", "gen2 diff")]).unwrap();

        // Reconstructing the middle generation must include only its own
        // ancestry (gen0, gen1), not gen2's patches.
        let chain = archive.patch_chain("gen1").unwrap();
        assert_eq!(
            chain,
            vec![
                dir.path().join("gen_gen0/patches/0001.patch"),
                dir.path().join("gen_gen1/patches/0001.patch"),
                dir.path().join("gen_gen1/patches/0002.patch"),
            ]
        );
        for path in &chain {
            assert!(path.exists(), "patch file should exist on disk: {path:?}");
        }

        // Reopening replays archive.jsonl and reproduces the same chain.
        // gen2's chain is root-to-including-gen2: gen0 (1 patch) + gen1 (2
        // patches) + gen2 (1 patch) = 4, not just its immediate ancestry.
        let reopened = LineageArchive::open(dir.path()).unwrap();
        assert_eq!(reopened.patch_chain("gen2").unwrap().len(), 4);
        assert_eq!(reopened.get("gen1").unwrap().score, Some(2.0));
    }

    #[test]
    fn record_rejects_duplicate_id_and_missing_parent() {
        let dir = tempfile::tempdir().unwrap();
        let mut archive = LineageArchive::open(dir.path()).unwrap();
        archive.record(make_generation("gen0", None, true, Some(1.0)), &[]).unwrap();

        assert!(matches!(
            archive.record(make_generation("gen0", None, true, Some(1.0)), &[]),
            Err(LineageError::AlreadyExists(_))
        ));
        assert!(matches!(
            archive.record(make_generation("gen1", Some("missing"), true, Some(1.0)), &[]),
            Err(LineageError::NotFound(_))
        ));
    }

    #[test]
    fn parent_selection_latest_and_best_ignore_invalid() {
        let dir = tempfile::tempdir().unwrap();
        let mut archive = LineageArchive::open(dir.path()).unwrap();
        archive.record(make_generation("low", None, true, Some(0.1)), &[]).unwrap();
        archive.record(make_generation("high", Some("low"), true, Some(9.0)), &[]).unwrap();
        archive.record(make_generation("broken", Some("high"), false, Some(100.0)), &[]).unwrap();

        let mut rng = StdRng::seed_from_u64(1);
        assert_eq!(archive.select_parent(ParentSelection::Latest, &mut rng), Some("high".to_string()));
        assert_eq!(archive.select_parent(ParentSelection::Best, &mut rng), Some("high".to_string()));
    }

    #[test]
    fn parent_selection_is_deterministic_for_a_fixed_seed() {
        let dir = tempfile::tempdir().unwrap();
        let mut archive = LineageArchive::open(dir.path()).unwrap();
        archive.record(make_generation("a", None, true, Some(0.5)), &[]).unwrap();
        archive.record(make_generation("b", Some("a"), true, Some(1.5)), &[]).unwrap();
        archive.record(make_generation("c", Some("b"), true, Some(-0.5)), &[]).unwrap();

        let pick_sequence = |seed: u64| -> Vec<Option<GenerationId>> {
            let mut rng = StdRng::seed_from_u64(seed);
            (0..5).map(|_| archive.select_parent(ParentSelection::ScoreProportional, &mut rng)).collect()
        };

        // Same seed, same sequence of draws — that's the determinism guarantee.
        assert_eq!(pick_sequence(42), pick_sequence(42));
        assert_eq!(pick_sequence(7), pick_sequence(7));
    }

    #[test]
    fn children_count_feeds_the_score_proportional_penalty() {
        let dir = tempfile::tempdir().unwrap();
        let mut archive = LineageArchive::open(dir.path()).unwrap();
        archive.record(make_generation("root", None, true, Some(1.0)), &[]).unwrap();
        assert_eq!(archive.children_count("root"), 0);
        archive.record(make_generation("child-a", Some("root"), true, Some(1.0)), &[]).unwrap();
        archive.record(make_generation("child-b", Some("root"), true, Some(1.0)), &[]).unwrap();
        assert_eq!(archive.children_count("root"), 2);
        assert_eq!(archive.children_count("child-a"), 0);
    }
}

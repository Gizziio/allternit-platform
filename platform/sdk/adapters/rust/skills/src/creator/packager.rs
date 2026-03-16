//! Skill Packager - Package skills into distributable `.skill` files
//!
//! Handles validation, archiving, and creation of distributable skill packages.
//! A `.skill` file is a ZIP archive containing the skill directory contents.

use super::CreatorError;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Packager for creating distributable skill packages
pub struct SkillPackager {
    /// Compression level (0-9, where 9 is best compression)
    compression_level: i32,
    /// Maximum package size in bytes (10MB default)
    max_package_size: u64,
}

impl SkillPackager {
    /// Create a new skill packager with default settings
    pub fn new() -> Self {
        Self {
            compression_level: 6,
            max_package_size: 10 * 1024 * 1024, // 10MB
        }
    }

    /// Create a packager with custom settings
    pub fn with_options(compression_level: i32, max_package_size: u64) -> Self {
        Self {
            compression_level: compression_level.clamp(0, 9),
            max_package_size,
        }
    }

    /// Package a skill directory into a `.skill` file
    ///
    /// # Arguments
    /// * `skill_dir` - Path to the skill directory
    /// * `output_path` - Path for the output `.skill` file
    ///
    /// # Returns
    /// * `Ok(())` if packaging succeeded
    /// * `Err(CreatorError)` if packaging failed
    pub fn package_skill(&self, skill_dir: &Path, output_path: &Path) -> Result<(), CreatorError> {
        use zip::write::FileOptions;

        // Ensure skill directory exists
        if !skill_dir.exists() {
            return Err(CreatorError::Validation(format!(
                "Skill directory does not exist: {}",
                skill_dir.display()
            )));
        }

        if !skill_dir.is_dir() {
            return Err(CreatorError::Validation(format!(
                "Path is not a directory: {}",
                skill_dir.display()
            )));
        }

        // Create output directory if needed
        if let Some(parent) = output_path.parent() {
            std::fs::create_dir_all(parent).map_err(CreatorError::Io)?;
        }

        // Create the ZIP file
        let file = File::create(output_path).map_err(CreatorError::Io)?;
        let mut zip = zip::ZipWriter::new(file);

        let options: FileOptions<()> = FileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .compression_level(Some(self.compression_level));

        // Walk the skill directory and add files to ZIP
        for entry in WalkDir::new(skill_dir) {
            let entry = entry.map_err(|e| {
                CreatorError::Validation(format!("Failed to read directory entry: {}", e))
            })?;

            let path = entry.path();
            let name = path.strip_prefix(skill_dir).map_err(|_| {
                CreatorError::Validation("Failed to strip prefix from path".to_string())
            })?;

            // Skip directories (they're created implicitly)
            if path.is_file() {
                // Check file size
                let metadata = std::fs::metadata(path).map_err(CreatorError::Io)?;
                if metadata.len() > self.max_package_size {
                    return Err(CreatorError::Validation(format!(
                        "File {} exceeds maximum size limit",
                        name.display()
                    )));
                }

                // Read file content
                let mut file_content = Vec::new();
                let mut file = File::open(path).map_err(CreatorError::Io)?;
                file.read_to_end(&mut file_content)
                    .map_err(CreatorError::Io)?;

                // Add to ZIP
                zip.start_file(name.to_string_lossy(), options)
                    .map_err(|e| {
                        CreatorError::Validation(format!("Failed to start file in ZIP: {}", e))
                    })?;
                zip.write_all(&file_content).map_err(|e| {
                    CreatorError::Validation(format!("Failed to write to ZIP: {}", e))
                })?;
            }
        }

        // Finalize the ZIP
        zip.finish()
            .map_err(|e| CreatorError::Validation(format!("Failed to finalize ZIP: {}", e)))?;

        // Verify the output file
        let output_metadata = std::fs::metadata(output_path).map_err(CreatorError::Io)?;
        if output_metadata.len() > self.max_package_size {
            // Remove oversized package
            let _ = std::fs::remove_file(output_path);
            return Err(CreatorError::Validation(
                "Package exceeds maximum size limit".to_string(),
            ));
        }

        Ok(())
    }

    /// Extract a `.skill` file to a directory
    ///
    /// # Arguments
    /// * `skill_file` - Path to the `.skill` file
    /// * `output_dir` - Directory to extract to
    ///
    /// # Returns
    /// * `Ok(PathBuf)` - Path to the extracted skill directory
    /// * `Err(CreatorError)` if extraction failed
    pub fn extract_skill(
        &self,
        skill_file: &Path,
        output_dir: &Path,
    ) -> Result<PathBuf, CreatorError> {
        // Open the ZIP file
        let file = File::open(skill_file).map_err(CreatorError::Io)?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| {
            CreatorError::Validation(format!("Failed to open skill archive: {}", e))
        })?;

        // Create output directory
        std::fs::create_dir_all(output_dir).map_err(CreatorError::Io)?;

        // Get the skill name from the filename
        let skill_name = skill_file
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "extracted_skill".to_string());

        let extract_path = output_dir.join(&skill_name);
        std::fs::create_dir_all(&extract_path).map_err(CreatorError::Io)?;

        // Extract files
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| {
                CreatorError::Validation(format!("Failed to read archive entry: {}", e))
            })?;

            let outpath = extract_path.join(file.name());

            // Security check: ensure the output path is within the extract directory
            if !outpath.starts_with(&extract_path) {
                return Err(CreatorError::Validation(
                    "Archive contains invalid path (path traversal attempt)".to_string(),
                ));
            }

            if file.name().ends_with('/') {
                // Directory
                std::fs::create_dir_all(&outpath).map_err(CreatorError::Io)?;
            } else {
                // File
                if let Some(parent) = outpath.parent() {
                    std::fs::create_dir_all(parent).map_err(CreatorError::Io)?;
                }

                let mut outfile = File::create(&outpath).map_err(CreatorError::Io)?;
                std::io::copy(&mut file, &mut outfile).map_err(CreatorError::Io)?;
            }
        }

        Ok(extract_path)
    }

    /// List contents of a `.skill` file
    ///
    /// # Arguments
    /// * `skill_file` - Path to the `.skill` file
    ///
    /// # Returns
    /// * `Ok(Vec<String>)` - List of file paths in the archive
    /// * `Err(CreatorError)` if listing failed
    pub fn list_contents(&self, skill_file: &Path) -> Result<Vec<String>, CreatorError> {
        let file = File::open(skill_file).map_err(CreatorError::Io)?;
        let archive = zip::ZipArchive::new(file).map_err(|e| {
            CreatorError::Validation(format!("Failed to open skill archive: {}", e))
        })?;

        let mut contents = Vec::new();
        for i in 0..archive.len() {
            let file = archive.by_index(i).map_err(|e| {
                CreatorError::Validation(format!("Failed to read archive entry: {}", e))
            })?;
            contents.push(file.name().to_string());
        }

        Ok(contents)
    }

    /// Get package info for a `.skill` file
    ///
    /// # Arguments
    /// * `skill_file` - Path to the `.skill` file
    ///
    /// # Returns
    /// * `Ok(PackageInfo)` - Information about the package
    /// * `Err(CreatorError)` if reading failed
    pub fn get_package_info(&self, skill_file: &Path) -> Result<PackageInfo, CreatorError> {
        let metadata = std::fs::metadata(skill_file).map_err(CreatorError::Io)?;
        let contents = self.list_contents(skill_file)?;

        // Try to read SKILL.md from the archive
        let mut skill_name = None;
        let mut skill_description = None;

        let file = File::open(skill_file).map_err(CreatorError::Io)?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| {
            CreatorError::Validation(format!("Failed to open skill archive: {}", e))
        })?;

        // Find and read SKILL.md
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| {
                CreatorError::Validation(format!("Failed to read archive entry: {}", e))
            })?;

            if file.name() == "SKILL.md" {
                let mut content = String::new();
                file.read_to_string(&mut content)
                    .map_err(CreatorError::Io)?;

                // Parse frontmatter
                if content.starts_with("---") {
                    if let Some(end) = content[3..].find("---") {
                        let frontmatter = &content[3..end + 3];

                        for line in frontmatter.lines() {
                            if line.starts_with("name:") {
                                skill_name = Some(line[5..].trim().to_string());
                            }
                            if line.starts_with("description:") {
                                skill_description = Some(line[12..].trim().to_string());
                            }
                        }
                    }
                }
                break;
            }
        }

        Ok(PackageInfo {
            file_size: metadata.len(),
            file_count: contents.len(),
            skill_name,
            skill_description,
            contents,
        })
    }

    /// Verify a `.skill` file integrity
    ///
    /// # Arguments
    /// * `skill_file` - Path to the `.skill` file
    ///
    /// # Returns
    /// * `Ok(())` if the package is valid
    /// * `Err(CreatorError)` if the package is corrupted or invalid
    pub fn verify_package(&self, skill_file: &Path) -> Result<(), CreatorError> {
        // Check file exists
        if !skill_file.exists() {
            return Err(CreatorError::Validation(
                "Package file does not exist".to_string(),
            ));
        }

        // Check file size
        let metadata = std::fs::metadata(skill_file).map_err(CreatorError::Io)?;
        if metadata.len() == 0 {
            return Err(CreatorError::Validation(
                "Package file is empty".to_string(),
            ));
        }

        if metadata.len() > self.max_package_size {
            return Err(CreatorError::Validation(
                "Package exceeds maximum size limit".to_string(),
            ));
        }

        // Try to open as ZIP
        let file = File::open(skill_file).map_err(CreatorError::Io)?;
        let archive = zip::ZipArchive::new(file).map_err(|e| {
            CreatorError::Validation(format!("Package is not a valid ZIP archive: {}", e))
        })?;

        // Check for required files
        let has_skill_md = (0..archive.len()).any(|i| {
            archive
                .by_index(i)
                .map(|f| f.name() == "SKILL.md")
                .unwrap_or(false)
        });

        if !has_skill_md {
            return Err(CreatorError::Validation(
                "Package missing required SKILL.md file".to_string(),
            ));
        }

        Ok(())
    }
}

impl Default for SkillPackager {
    fn default() -> Self {
        Self::new()
    }
}

/// Information about a skill package
#[derive(Debug, Clone)]
pub struct PackageInfo {
    /// Size of the package file in bytes
    pub file_size: u64,
    /// Number of files in the package
    pub file_count: usize,
    /// Name of the skill (from SKILL.md frontmatter)
    pub skill_name: Option<String>,
    /// Description of the skill (from SKILL.md frontmatter)
    pub skill_description: Option<String>,
    /// List of file paths in the package
    pub contents: Vec<String>,
}

/// Utility functions for skill packaging
pub mod utils {
    use super::*;

    /// Calculate a hash of the skill directory contents
    ///
    /// This can be used to verify skill integrity and detect changes.
    pub fn compute_skill_hash(skill_dir: &Path) -> Result<String, CreatorError> {
        use sha2::{Digest, Sha256};

        let mut hasher = Sha256::new();

        // Walk directory and hash file contents
        for entry in WalkDir::new(skill_dir).sort_by_file_name() {
            let entry = entry.map_err(|e| {
                CreatorError::Validation(format!("Failed to read directory entry: {}", e))
            })?;

            let path = entry.path();

            if path.is_file() {
                // Hash relative path
                let rel_path = path
                    .strip_prefix(skill_dir)
                    .map_err(|_| CreatorError::Validation("Failed to strip prefix".to_string()))?;
                hasher.update(rel_path.to_string_lossy().as_bytes());

                // Hash file content
                let content = std::fs::read(path).map_err(CreatorError::Io)?;
                hasher.update(&content);
            }
        }

        let result = hasher.finalize();
        Ok(format!("sha256:{:x}", result))
    }

    /// Compare two skill directories for equality
    pub fn skills_equal(skill_dir1: &Path, skill_dir2: &Path) -> Result<bool, CreatorError> {
        let hash1 = compute_skill_hash(skill_dir1)?;
        let hash2 = compute_skill_hash(skill_dir2)?;
        Ok(hash1 == hash2)
    }

    /// Get the total size of a skill directory
    pub fn get_skill_size(skill_dir: &Path) -> Result<u64, CreatorError> {
        let mut total_size = 0u64;

        for entry in WalkDir::new(skill_dir) {
            let entry = entry.map_err(|e| {
                CreatorError::Validation(format!("Failed to read directory entry: {}", e))
            })?;

            if entry.path().is_file() {
                let metadata = entry.metadata().map_err(|e| {
                    CreatorError::Validation(format!("Failed to read metadata: {}", e))
                })?;
                total_size += metadata.len();
            }
        }

        Ok(total_size)
    }
}

#[cfg(test)]
mod tests {
    use super::utils::*;
    use super::*;
    use tempfile::TempDir;

    fn create_test_skill(temp_dir: &TempDir) -> PathBuf {
        let skill_dir = temp_dir.path().join("test-skill");
        std::fs::create_dir_all(&skill_dir).unwrap();

        // Create SKILL.md
        std::fs::write(
            skill_dir.join("SKILL.md"),
            r#"---
name: test-skill
description: A test skill
---

# Test Skill

This is a test skill.
"#,
        )
        .unwrap();

        // Create scripts directory
        std::fs::create_dir_all(skill_dir.join("scripts")).unwrap();
        std::fs::write(
            skill_dir.join("scripts").join("test.py"),
            "#!/usr/bin/env python3\nprint('hello')",
        )
        .unwrap();

        skill_dir
    }

    #[test]
    fn test_package_and_extract() {
        let temp_dir = TempDir::new().unwrap();
        let skill_dir = create_test_skill(&temp_dir);
        let output_file = temp_dir.path().join("test-skill.skill");

        let packager = SkillPackager::new();

        // Package the skill
        packager.package_skill(&skill_dir, &output_file).unwrap();
        assert!(output_file.exists());

        // Extract the skill
        let extract_dir = temp_dir.path().join("extracted");
        let extracted_path = packager.extract_skill(&output_file, &extract_dir).unwrap();
        assert!(extracted_path.exists());
        assert!(extracted_path.join("SKILL.md").exists());
        assert!(extracted_path.join("scripts").join("test.py").exists());
    }

    #[test]
    fn test_list_contents() {
        let temp_dir = TempDir::new().unwrap();
        let skill_dir = create_test_skill(&temp_dir);
        let output_file = temp_dir.path().join("test-skill.skill");

        let packager = SkillPackager::new();
        packager.package_skill(&skill_dir, &output_file).unwrap();

        let contents = packager.list_contents(&output_file).unwrap();
        assert!(contents.contains(&"SKILL.md".to_string()));
        assert!(contents.contains(&"scripts/test.py".to_string()));
    }

    #[test]
    fn test_get_package_info() {
        let temp_dir = TempDir::new().unwrap();
        let skill_dir = create_test_skill(&temp_dir);
        let output_file = temp_dir.path().join("test-skill.skill");

        let packager = SkillPackager::new();
        packager.package_skill(&skill_dir, &output_file).unwrap();

        let info = packager.get_package_info(&output_file).unwrap();
        assert_eq!(info.skill_name, Some("test-skill".to_string()));
        assert_eq!(info.skill_description, Some("A test skill".to_string()));
        assert!(info.file_count >= 2);
        assert!(info.file_size > 0);
    }

    #[test]
    fn test_verify_package() {
        let temp_dir = TempDir::new().unwrap();
        let skill_dir = create_test_skill(&temp_dir);
        let output_file = temp_dir.path().join("test-skill.skill");

        let packager = SkillPackager::new();
        packager.package_skill(&skill_dir, &output_file).unwrap();

        // Should pass verification
        assert!(packager.verify_package(&output_file).is_ok());

        // Invalid file should fail
        let invalid_file = temp_dir.path().join("invalid.txt");
        std::fs::write(&invalid_file, "not a skill").unwrap();
        assert!(packager.verify_package(&invalid_file).is_err());
    }

    #[test]
    fn test_compute_skill_hash() {
        let temp_dir = TempDir::new().unwrap();
        let skill_dir = create_test_skill(&temp_dir);

        let hash1 = compute_skill_hash(&skill_dir).unwrap();
        let hash2 = compute_skill_hash(&skill_dir).unwrap();

        // Same directory should produce same hash
        assert_eq!(hash1, hash2);

        // Modify a file
        std::fs::write(
            skill_dir.join("scripts").join("test.py"),
            "#!/usr/bin/env python3\nprint('world')",
        )
        .unwrap();

        let hash3 = compute_skill_hash(&skill_dir).unwrap();

        // Modified directory should produce different hash
        assert_ne!(hash1, hash3);
    }

    #[test]
    fn test_get_skill_size() {
        let temp_dir = TempDir::new().unwrap();
        let skill_dir = create_test_skill(&temp_dir);

        let size = get_skill_size(&skill_dir).unwrap();
        assert!(size > 0);
    }
}

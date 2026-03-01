// OWNER: T1-A3

//! Language Detection
//!
//! Detect programming language from source files and project structure.

use crate::types::*;
use std::path::Path;
use std::fs;

/// Detect programming language from source path
pub fn detect_language(source_path: &Path) -> Result<DetectedLanguage> {
    // Check for package files first (highest confidence)
    if let Some(lang) = detect_from_package_files(source_path) {
        return Ok(lang);
    }

    // Check file extensions
    if let Some(lang) = detect_from_extensions(source_path) {
        return Ok(lang);
    }

    // Check shebang for scripts
    if let Some(lang) = detect_from_shebang(source_path) {
        return Ok(lang);
    }

    Ok(DetectedLanguage::new(Language::Unknown, "none"))
}

/// Detect language from package files (Cargo.toml, package.json, etc.)
fn detect_from_package_files(source_path: &Path) -> Option<DetectedLanguage> {
    let check_file = |path: &Path, file: &str| -> bool {
        path.join(file).exists() || path.parent().map(|p| p.join(file).exists()).unwrap_or(false)
    };

    // Rust
    if check_file(source_path, "Cargo.toml") {
        let version = extract_version_from_toml(source_path, "Cargo.toml");
        return Some(DetectedLanguage::new(Language::Rust, "Cargo.toml")
            .with_version(&version.unwrap_or_else(|| "unknown".to_string())));
    }

    // TypeScript/JavaScript
    if check_file(source_path, "package.json") {
        return detect_ts_or_js(source_path);
    }

    // Python
    if check_file(source_path, "pyproject.toml") {
        return Some(DetectedLanguage::new(Language::Python, "pyproject.toml"));
    }
    if check_file(source_path, "setup.py") {
        return Some(DetectedLanguage::new(Language::Python, "setup.py"));
    }
    if check_file(source_path, "requirements.txt") {
        return Some(DetectedLanguage::new(Language::Python, "requirements.txt"));
    }
    if check_file(source_path, "Pipfile") {
        return Some(DetectedLanguage::new(Language::Python, "Pipfile"));
    }

    // Go
    if check_file(source_path, "go.mod") {
        return Some(DetectedLanguage::new(Language::Go, "go.mod"));
    }
    if check_file(source_path, "go.sum") {
        return Some(DetectedLanguage::new(Language::Go, "go.sum"));
    }

    // Java
    if check_file(source_path, "pom.xml") {
        return Some(DetectedLanguage::new(Language::Java, "pom.xml"));
    }
    if check_file(source_path, "build.gradle") || check_file(source_path, "build.gradle.kts") {
        return Some(DetectedLanguage::new(Language::Java, "gradle"));
    }

    // Ruby
    if check_file(source_path, "Gemfile") {
        return Some(DetectedLanguage::new(Language::Ruby, "Gemfile"));
    }

    // PHP
    if check_file(source_path, "composer.json") {
        return Some(DetectedLanguage::new(Language::PHP, "composer.json"));
    }

    // C#
    if check_file(source_path, ".csproj") || source_path.extension().map(|e| e == "csproj").unwrap_or(false) {
        return Some(DetectedLanguage::new(Language::CSharp, "csproj"));
    }

    None
}

/// Detect TypeScript vs JavaScript
fn detect_ts_or_js(source_path: &Path) -> Option<DetectedLanguage> {
    // Check for tsconfig.json
    if source_path.join("tsconfig.json").exists() 
        || source_path.parent().map(|p| p.join("tsconfig.json").exists()).unwrap_or(false) {
        return Some(DetectedLanguage::new(Language::TypeScript, "tsconfig.json"));
    }

    // Check for .ts files
    if let Ok(entries) = fs::read_dir(source_path) {
        for entry in entries.flatten() {
            if entry.path().extension().map(|e| e == "ts" || e == "tsx").unwrap_or(false) {
                return Some(DetectedLanguage::new(Language::TypeScript, "package.json + .ts files"));
            }
        }
    }

    Some(DetectedLanguage::new(Language::JavaScript, "package.json"))
}

/// Detect language from file extensions
fn detect_from_extensions(source_path: &Path) -> Option<DetectedLanguage> {
    let extensions = [
        ("rs", Language::Rust),
        ("ts", Language::TypeScript),
        ("tsx", Language::TypeScript),
        ("js", Language::JavaScript),
        ("jsx", Language::JavaScript),
        ("py", Language::Python),
        ("go", Language::Go),
        ("java", Language::Java),
        ("cpp", Language::Cpp),
        ("cc", Language::Cpp),
        ("cxx", Language::Cpp),
        ("c", Language::C),
        ("h", Language::C),
        ("hpp", Language::Cpp),
        ("rb", Language::Ruby),
        ("swift", Language::Swift),
        ("kt", Language::Kotlin),
        ("kts", Language::Kotlin),
        ("scala", Language::Scala),
        ("php", Language::PHP),
        ("cs", Language::CSharp),
        ("sh", Language::Shell),
        ("bash", Language::Shell),
        ("zsh", Language::Shell),
    ];

    if source_path.is_file() {
        if let Some(ext) = source_path.extension().and_then(|e| e.to_str()) {
            for (target_ext, lang) in &extensions {
                if ext == *target_ext {
                    return Some(DetectedLanguage::new(*lang, &format!(".{}", ext)));
                }
            }
        }
    } else if source_path.is_dir() {
        // Scan directory for known extensions
        if let Ok(entries) = fs::read_dir(source_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    for (target_ext, lang) in &extensions {
                        if ext == *target_ext {
                            return Some(DetectedLanguage::new(*lang, &format!("directory with .{}", ext)));
                        }
                    }
                }
            }
        }
    }

    None
}

/// Detect language from shebang
fn detect_from_shebang(source_path: &Path) -> Option<DetectedLanguage> {
    if !source_path.is_file() {
        return None;
    }

    let content = fs::read(source_path).ok()?;
    let first_line = content.split(|&b| b == b'\n').next()?;
    let first_line_str = std::str::from_utf8(first_line).ok()?;

    if !first_line_str.starts_with("#!") {
        return None;
    }

    if first_line_str.contains("python") {
        return Some(DetectedLanguage::new(Language::Python, "shebang"));
    }
    if first_line_str.contains("node") {
        return Some(DetectedLanguage::new(Language::JavaScript, "shebang"));
    }
    if first_line_str.contains("bash") || first_line_str.contains("sh") {
        return Some(DetectedLanguage::new(Language::Shell, "shebang"));
    }
    if first_line_str.contains("ruby") {
        return Some(DetectedLanguage::new(Language::Ruby, "shebang"));
    }
    if first_line_str.contains("php") {
        return Some(DetectedLanguage::new(Language::PHP, "shebang"));
    }

    None
}

/// Extract version from Cargo.toml
fn extract_version_from_toml(source_path: &Path, file: &str) -> Option<String> {
    let path = source_path.join(file);
    let path = if !path.exists() {
        source_path.parent()?.join(file)
    } else {
        path
    };

    let content = fs::read_to_string(path).ok()?;
    let parsed: toml::Value = toml::from_str(&content).ok()?;
    
    parsed.get("package")
        .and_then(|p| p.get("version"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// Get all supported languages
pub fn supported_languages() -> Vec<Language> {
    vec![
        Language::Rust,
        Language::TypeScript,
        Language::JavaScript,
        Language::Python,
        Language::Go,
        Language::Java,
        Language::Cpp,
        Language::C,
        Language::Ruby,
        Language::Swift,
        Language::Kotlin,
        Language::Scala,
        Language::PHP,
        Language::CSharp,
        Language::Shell,
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::fs;

    #[test]
    fn test_detect_rust_from_cargo_toml() {
        let temp_dir = TempDir::new().unwrap();
        fs::write(temp_dir.path().join("Cargo.toml"), r#"
[package]
name = "test"
version = "1.0.0"
"#).unwrap();

        let result = detect_language(temp_dir.path()).unwrap();
        assert_eq!(result.language, Language::Rust);
        assert_eq!(result.version, Some("1.0.0".to_string()));
    }

    #[test]
    fn test_detect_python_from_requirements() {
        let temp_dir = TempDir::new().unwrap();
        fs::write(temp_dir.path().join("requirements.txt"), "requests==2.28.0").unwrap();

        let result = detect_language(temp_dir.path()).unwrap();
        assert_eq!(result.language, Language::Python);
    }

    #[test]
    fn test_detect_go_from_mod() {
        let temp_dir = TempDir::new().unwrap();
        fs::write(temp_dir.path().join("go.mod"), "module example.com/test").unwrap();

        let result = detect_language(temp_dir.path()).unwrap();
        assert_eq!(result.language, Language::Go);
    }

    #[test]
    fn test_detect_from_extension() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.py");
        fs::write(&file_path, "print('hello')").unwrap();

        let result = detect_language(&file_path).unwrap();
        assert_eq!(result.language, Language::Python);
    }

    #[test]
    fn test_detect_from_shebang() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("script");
        fs::write(&file_path, "#!/usr/bin/env python3\nprint('hello')").unwrap();

        let result = detect_language(&file_path).unwrap();
        assert_eq!(result.language, Language::Python);
    }

    #[test]
    fn test_detect_unknown() {
        let temp_dir = TempDir::new().unwrap();
        fs::write(temp_dir.path().join("unknown.xyz"), "content").unwrap();

        let result = detect_language(temp_dir.path()).unwrap();
        assert_eq!(result.language, Language::Unknown);
    }
}

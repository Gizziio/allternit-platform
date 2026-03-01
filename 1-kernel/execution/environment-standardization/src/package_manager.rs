// OWNER: T1-A3

//! Package Manager Detection
//!
//! Detect package manager from project files.

use crate::types::*;
use std::path::Path;
use std::fs;

/// Detect package manager from project path
pub fn detect_package_manager(project_path: &Path) -> PackageManagerInfo {
    // Check for lock files and config files
    let lock_files = [
        ("Cargo.lock", PackageManager::Cargo, "Cargo.toml"),
        ("package-lock.json", PackageManager::Npm, "package.json"),
        ("yarn.lock", PackageManager::Yarn, "package.json"),
        ("pnpm-lock.yaml", PackageManager::Pnpm, "package.json"),
        ("Pipfile.lock", PackageManager::Poetry, "Pipfile"),
        ("poetry.lock", PackageManager::Poetry, "pyproject.toml"),
        ("go.sum", PackageManager::GoMod, "go.mod"),
        ("pom.xml", PackageManager::Maven, "pom.xml"),
        ("build.gradle", PackageManager::Gradle, "build.gradle"),
        ("Gemfile.lock", PackageManager::Bundler, "Gemfile"),
        ("composer.lock", PackageManager::Composer, "composer.json"),
    ];

    for (lock_file, manager, config_file) in &lock_files {
        if project_path.join(lock_file).exists() {
            return PackageManagerInfo {
                manager: *manager,
                version: None,
                lock_file: Some(lock_file.to_string()),
                config_file: Some(config_file.to_string()),
            };
        }
    }

    // Check for config files without lock files
    let config_files = [
        ("Cargo.toml", PackageManager::Cargo),
        ("package.json", PackageManager::Npm),
        ("requirements.txt", PackageManager::Pip),
        ("setup.py", PackageManager::Pip),
        ("pyproject.toml", PackageManager::Poetry),
        ("Pipfile", PackageManager::Poetry),
        ("go.mod", PackageManager::GoMod),
        ("pom.xml", PackageManager::Maven),
        ("build.gradle", PackageManager::Gradle),
        ("build.gradle.kts", PackageManager::Gradle),
        ("Gemfile", PackageManager::Bundler),
        ("composer.json", PackageManager::Composer),
        (".csproj", PackageManager::NuGet),
    ];

    for (config_file, manager) in &config_files {
        if project_path.join(config_file).exists() 
            || has_extension(project_path, config_file) {
            return PackageManagerInfo {
                manager: *manager,
                version: None,
                lock_file: None,
                config_file: Some(config_file.to_string()),
            };
        }
    }

    // Check for system package managers
    if Path::new("/etc/apt/sources.list").exists() || Path::new("/usr/bin/apt").exists() {
        return PackageManagerInfo {
            manager: PackageManager::Apt,
            version: None,
            lock_file: None,
            config_file: Some("/etc/apt/sources.list".to_string()),
        };
    }

    if Path::new("/etc/yum.repos.d").exists() {
        return PackageManagerInfo {
            manager: PackageManager::Yum,
            version: None,
            lock_file: None,
            config_file: Some("/etc/yum.repos.d".to_string()),
        };
    }

    if Path::new("/usr/bin/brew").exists() {
        return PackageManagerInfo {
            manager: PackageManager::Brew,
            version: None,
            lock_file: None,
            config_file: Some("/usr/bin/brew".to_string()),
        };
    }

    PackageManagerInfo {
        manager: PackageManager::Unknown,
        version: None,
        lock_file: None,
        config_file: None,
    }
}

/// Check if any file in directory has extension
fn has_extension(dir: &Path, ext: &str) -> bool {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.path().extension().map(|e| e.to_str() == Some(ext.trim_start_matches('.'))).unwrap_or(false) {
                return true;
            }
        }
    }
    false
}

/// Get install command for package manager
pub fn get_install_command(manager: PackageManager, packages: &[&str]) -> Option<String> {
    match manager {
        PackageManager::Cargo => Some(format!("cargo install {}", packages.join(" "))),
        PackageManager::Npm => Some(format!("npm install {}", packages.join(" "))),
        PackageManager::Yarn => Some(format!("yarn add {}", packages.join(" "))),
        PackageManager::Pnpm => Some(format!("pnpm add {}", packages.join(" "))),
        PackageManager::Pip | PackageManager::Pip3 => Some(format!("pip install {}", packages.join(" "))),
        PackageManager::Poetry => Some(format!("poetry add {}", packages.join(" "))),
        PackageManager::GoMod => Some(format!("go get {}", packages.join(" "))),
        PackageManager::Maven => None, // Maven uses pom.xml
        PackageManager::Gradle => None, // Gradle uses build.gradle
        PackageManager::Bundler => Some(format!("bundle add {}", packages.join(" "))),
        PackageManager::Composer => Some(format!("composer require {}", packages.join(" "))),
        PackageManager::Apt => Some(format!("apt install -y {}", packages.join(" "))),
        PackageManager::Yum => Some(format!("yum install -y {}", packages.join(" "))),
        PackageManager::Dnf => Some(format!("dnf install -y {}", packages.join(" "))),
        PackageManager::Brew => Some(format!("brew install {}", packages.join(" "))),
        PackageManager::NuGet => Some(format!("nuget install {}", packages.join(" "))),
        PackageManager::Unknown => None,
    }
}

/// Get build command for package manager
pub fn get_build_command(manager: PackageManager) -> Option<String> {
    match manager {
        PackageManager::Cargo => Some("cargo build --release".to_string()),
        PackageManager::Npm | PackageManager::Yarn | PackageManager::Pnpm => Some("npm run build".to_string()),
        PackageManager::GoMod => Some("go build".to_string()),
        PackageManager::Maven => Some("mvn package".to_string()),
        PackageManager::Gradle => Some("gradle build".to_string()),
        _ => None,
    }
}

/// Get test command for package manager
pub fn get_test_command(manager: PackageManager) -> Option<String> {
    match manager {
        PackageManager::Cargo => Some("cargo test".to_string()),
        PackageManager::Npm | PackageManager::Yarn | PackageManager::Pnpm => Some("npm test".to_string()),
        PackageManager::GoMod => Some("go test ./...".to_string()),
        PackageManager::Maven => Some("mvn test".to_string()),
        PackageManager::Gradle => Some("gradle test".to_string()),
        PackageManager::Pip | PackageManager::Pip3 | PackageManager::Poetry => Some("pytest".to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::fs;

    #[test]
    fn test_detect_cargo() {
        let temp_dir = TempDir::new().unwrap();
        fs::write(temp_dir.path().join("Cargo.toml"), "[package]").unwrap();
        fs::write(temp_dir.path().join("Cargo.lock"), "").unwrap();

        let result = detect_package_manager(temp_dir.path());
        assert_eq!(result.manager, PackageManager::Cargo);
        assert_eq!(result.lock_file, Some("Cargo.lock".to_string()));
    }

    #[test]
    fn test_detect_npm() {
        let temp_dir = TempDir::new().unwrap();
        fs::write(temp_dir.path().join("package.json"), "{}").unwrap();
        fs::write(temp_dir.path().join("package-lock.json"), "").unwrap();

        let result = detect_package_manager(temp_dir.path());
        assert_eq!(result.manager, PackageManager::Npm);
    }

    #[test]
    fn test_detect_yarn() {
        let temp_dir = TempDir::new().unwrap();
        fs::write(temp_dir.path().join("package.json"), "{}").unwrap();
        fs::write(temp_dir.path().join("yarn.lock"), "").unwrap();

        let result = detect_package_manager(temp_dir.path());
        assert_eq!(result.manager, PackageManager::Yarn);
    }

    #[test]
    fn test_detect_pip() {
        let temp_dir = TempDir::new().unwrap();
        fs::write(temp_dir.path().join("requirements.txt"), "requests").unwrap();

        let result = detect_package_manager(temp_dir.path());
        assert_eq!(result.manager, PackageManager::Pip);
    }

    #[test]
    fn test_get_install_command() {
        assert_eq!(
            get_install_command(PackageManager::Cargo, &["serde", "tokio"]),
            Some("cargo install serde tokio".to_string())
        );
        assert_eq!(
            get_install_command(PackageManager::Npm, &["react", "lodash"]),
            Some("npm install react lodash".to_string())
        );
    }

    #[test]
    fn test_get_build_command() {
        assert_eq!(
            get_build_command(PackageManager::Cargo),
            Some("cargo build --release".to_string())
        );
        assert_eq!(
            get_build_command(PackageManager::Npm),
            Some("npm run build".to_string())
        );
    }

    #[test]
    fn test_get_test_command() {
        assert_eq!(
            get_test_command(PackageManager::Cargo),
            Some("cargo test".to_string())
        );
        assert_eq!(
            get_test_command(PackageManager::Npm),
            Some("npm test".to_string())
        );
    }
}

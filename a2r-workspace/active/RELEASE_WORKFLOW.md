# A2rchitech Release Workflow

This document describes the release process for the A2rchitech platform.

## Release Process

### Prerequisites
- All tests must pass in CI
- All documentation is up to date
- All dependencies are properly versioned
- Security scans have been performed

### Versioning Strategy
A2rchitech follows Semantic Versioning (SemVer): MAJOR.MINOR.PATCH

- **MAJOR** version: Breaking changes that affect API compatibility
- **MINOR** version: New features that are backward compatible
- **PATCH** version: Bug fixes that are backward compatible

### Release Steps

1. **Pre-Release Checklist**
   - [ ] All tests pass in CI
   - [ ] Documentation is updated
   - [ ] Changelog is updated
   - [ ] Security scan completed
   - [ ] Performance benchmarks validated

2. **Prepare Release**
   ```bash
   # Update version in workspace Cargo.toml
   # Update changelog with release notes
   # Run final test suite
   cargo test --workspace
   ```

3. **Tag Release**
   ```bash
   git tag -a v0.x.y -m "Release v0.x.y"
   git push origin v0.x.y
   ```

4. **Build Artifacts**
   - CI automatically builds for all supported platforms
   - Container images are built and pushed to registry
   - Binary artifacts are attached to GitHub release

5. **Publish Release**
   - GitHub Actions creates release on tag push
   - Container images published to GHCR
   - Release notes published with changelog

### CI/CD Pipeline

The CI/CD pipeline performs the following checks:

1. **Linting Stage**
   - Code formatting check (`cargo fmt --check`)
   - Clippy static analysis (`cargo clippy`)
   - Security scanning

2. **Testing Stage**
   - Unit tests (`cargo test`)
   - Integration tests
   - End-to-end tests
   - Database connectivity tests

3. **Build Stage**
   - Cross-platform builds for:
     - x86_64-unknown-linux-gnu
     - aarch64-unknown-linux-gnu
     - x86_64-apple-darwin
     - aarch64-apple-darwin
   - Container image builds for services

4. **Release Stage** (only for tagged releases)
   - Create GitHub release
   - Publish container images
   - Generate release artifacts

### Rollback Procedure

In case of a problematic release:

1. Identify the issue and severity
2. Tag a hotfix branch from the previous stable release
3. Apply critical fixes
4. Test the hotfix thoroughly
5. Release as patch version
6. Document the rollback in the changelog

### Security Considerations

- All dependencies are scanned for known vulnerabilities
- Container images are built with minimal base images
- Secrets are encrypted and accessed through CI/CD variables
- Audit logs are maintained for all release activities

### Container Build Jobs

The CI/CD pipeline includes container build jobs for:
- `a2rchitech-api` - Main API service
- `a2rchitech-cli` - Command-line interface
- `a2rchitech-python-gateway` - Python execution gateway

Each service has its own Dockerfile optimized for production deployment.
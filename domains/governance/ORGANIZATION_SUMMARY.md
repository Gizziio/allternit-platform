# 2-Governance Directory Organization

This document summarizes the organized structure of the 2-governance layer with clear, descriptive directory names that reflect their actual purposes.

## Organized Structure

### Identity & Access Control
- `identity-access-control/core-policy/` - Core policy engine and evaluation system
- `identity-access-control/policy-engine/` - Advanced policy evaluation and management

### Audit & Logging Systems
- `audit-logging/core-audit/` - Persistent, append-only audit logging system

### Governance Workflows
- `governance-workflows/core-governance/` - Core governance decision-making engine
- `governance-workflows/workflow-engine/` - Governance workflow and decision engine (TypeScript)
- `governance-workflows/rust-governor/` - Rust-based governance engine

### Legal & Compliance
- `legal-compliance/regulatory-framework/` - Legal compliance and regulatory framework

### Evidence Management
- `evidence-management/core-evidence/` - Evidence storage and management system

### Security Controls
- `security-network/` - Network security and federation controls
- `security-policy-controls/` - Security policy implementation
- `security-quality-assurance/` - Security quality and assurance measures

### Utilities
- `utilities/testing-stubs/` - Mock implementations for testing and development

## Previous Structure Mapping

The previous confusing structure has been reorganized as follows:

- `policy/` → `identity-access-control/core-policy/`
- `policy-engine/` → `identity-access-control/policy-engine/`
- `a2r-audit-log/` → `audit-logging/core-audit/`
- `security-governance/` → `governance-workflows/core-governance/`
- `a2r-governor/` → `governance-workflows/workflow-engine/`
- `a2r-lawlayer/` → `legal-compliance/regulatory-framework/`
- `rust/evidence_store/` → `evidence-management/core-evidence/`
- `security/federation/` → `security-network/`
- `security/policy/` → `security-policy-controls/`
- `security/quality/` → `security-quality-assurance/`
- `rust-governor/` → `governance-workflows/rust-governor/`
- `stubs/` → `utilities/testing-stubs/`

## Benefits of New Structure

1. **Clear Naming**: Directory names clearly indicate their purpose
2. **Logical Grouping**: Related components are grouped together
3. **Reduced Confusion**: Eliminated duplicate and misleading names
4. **Scalability**: Structure allows for easy addition of new components
5. **Maintainability**: Clear organization improves long-term maintenance

## Architecture Alignment

This structure aligns with the documented architecture in README.md and ARCHITECTURE.md, providing a clean, organized foundation for the governance layer that clearly separates concerns and responsibilities.
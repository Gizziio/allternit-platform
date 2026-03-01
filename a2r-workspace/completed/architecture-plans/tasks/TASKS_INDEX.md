# Archive Tasks Index

This file contains actionable items extracted from archived specifications and roadmaps during the comprehensive workspace cleanup.

## Extracted Tasks

### From A2rchitech_Current_State.md
- [ ] Implement service-registry service (port 5100)
- [ ] Update kernel to use environment variables instead of hardcoded URLs
- [ ] Add health checks to all services
- [ ] Create standardized docker-compose.yml
- [ ] Add centralized logging configuration
- [ ] Implement metrics collection via service-registry

### From META-ORCHESTRATED SPEC-DRIVEN AGENTIC FRAMEWORK.md
- [ ] Create /SOT.md file for each project
- [ ] Implement role-based agent architecture
- [ ] Establish baseline documentation structure:
  - [ ] spec/Baseline/Vision.md
  - [ ] spec/Baseline/Requirements.md
  - [ ] spec/Baseline/Architecture.md
  - [ ] spec/Baseline/Invariants.md
  - [ ] spec/Baseline/Glossary.md
- [ ] Create delta system:
  - [ ] spec/Deltas/CHANGELOG.md
  - [ ] spec/Deltas/ADRs/ (Architecture Decision Records)
  - [ ] spec/Deltas/RFCs/ (Requests for Comments)
  - [ ] spec/Deltas/Pivots/ (Major direction changes)
- [ ] Define acceptance and verification:
  - [ ] spec/Acceptance/AcceptanceTests.md
  - [ ] spec/Acceptance/ContractTests.md

### From MARKETPLACE_TUI_DEMO.md
- [ ] Implement TUI marketplace interface
- [ ] Optimize for SSH/remote access
- [ ] Integrate with existing marketplace API
- [ ] Add terminal-based navigation
- [ ] Ensure performance parity with web interface

## Priority Mapping

### High Priority (Immediate)
1. Service registry implementation
2. Environment variable migration
3. Health check standardization
4. Docker compose completion

### Medium Priority (This Week)
1. SOT.md creation for projects
2. Baseline documentation
3. Centralized logging
4. TUI marketplace prototyping

### Low Priority (Next Sprint)
1. Delta system implementation
2. Acceptance test framework
3. Metrics collection
4. Advanced TUI features

## Dependencies

### Technical Dependencies
- Service registry required before environment variable migration
- Health checks needed for observability
- Docker compose for deployment standardization

### Documentation Dependencies
- Baseline required before delta system
- SOT.md needed for agent coordination
- Acceptance tests depend on architecture spec

## Status

**Total Tasks Extracted:** 24
**High Priority:** 4
**Medium Priority:** 8
**Low Priority:** 4
**Dependencies Identified:** 6
**Ready for Implementation:** ✅
# BRAIN.md

## Current Focus
Initial workspace setup and skill configuration

## Active Tasks

### High Priority
- [ ] Review initial workspace structure
- [ ] Verify all core files are in place
- [ ] Test filesystem skill permissions
- [ ] Validate policy rules

### Medium Priority
- [ ] Configure code analysis preferences
- [ ] Set up git integration
- [ ] Customize review criteria

### Low Priority
- [ ] Add custom snippets
- [ ] Configure IDE integrations

## Task Graph

```
[Initialize Workspace] → [Verify Skills] → [Test Operations]
       ↓
[Configure Policies] → [Customize Identity]
       ↓
[Ready for Use]
```

## Review Criteria

### Security (Critical)
- SQL injection vulnerabilities
- XSS vulnerabilities  
- Hardcoded secrets/credentials
- Unsafe deserialization
- Path traversal risks

### Performance (High)
- N+1 queries
- Unnecessary memory allocations
- Blocking operations in async contexts
- Memory leaks
- Inefficient algorithms

### Maintainability (Medium)
- Code duplication (DRY violations)
- Missing or outdated documentation
- Functions that are too long or complex
- Unclear variable/function naming
- Tight coupling

### Style (Low)
- Consistent formatting
- Idiomatic patterns
- Import organization
- Comment quality

## Completed Tasks
- [x] Created workspace structure
- [x] Defined identity and purpose
- [x] Set up basic policy rules
- [x] Installed core skills

## Notes
- Workspace initialized with 5-layer architecture
- Focus on code quality and security
- Customizable for team conventions

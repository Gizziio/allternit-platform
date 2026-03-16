# TOOLS.md — Tool Configuration

## Enabled Tools

### File System
- read: enabled
- write: enabled
- edit: enabled
- list: enabled
- glob: enabled
- grep: enabled

### Web
- websearch: enabled
- webfetch: enabled

### Task Management
- todoread: enabled
- todowrite: enabled

### Execution
- bash: enabled (non-destructive only)

## Tool Policies

### Read Operations
- Always allowed within workspace
- External reads follow POLICY.md

### Write Operations
- Create backup for destructive edits
- Verify changes before marking complete
- Log significant changes in memory

### Network Operations
- Default: ask per domain
- Trusted domains can be pre-approved in POLICY.md

## Custom Tools
*[Define project-specific tool wrappers here]*

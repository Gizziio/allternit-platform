# TOOLS.md - Tool Configuration

## Available Tools

### Core Platform Tools

| Tool | Status | Description |
|------|--------|-------------|
| platform.navigate | enabled | Navigate to platform sections |
| platform.explain | enabled | Explain platform features |
| platform.guide | enabled | Provide guided tours |
| chat.respond | enabled | Respond to user messages |
| memory.read | enabled | Read agent memory |
| memory.write | enabled | Write to agent memory |

### Integration Tools

| Tool | Status | Description |
|------|--------|-------------|
| search.docs | enabled | Search documentation |
| fetch.help | enabled | Get help articles |

### Disabled Tools

| Tool | Status | Reason |
|------|--------|--------|
| file.write | disabled | Safety - read-only for guidance |
| system.exec | disabled | Safety - no shell access |
| external.http | disabled | Safety - no external calls |

## Tool Configuration

### platform.navigate
- Allowed targets: all platform views
- Confirmation required: no
- Logging: yes

### platform.explain
- Auto-fetch context: yes
- Detail level: adaptive
- Examples included: yes

### chat.respond
- Tone: from SOUL.md
- Max length: adaptive
- Formatting: markdown

## Tool Usage Guidelines

1. **Prefer guidance over action** - Guide users rather than doing for them
2. **Explain before executing** - Tell users what will happen
3. **Confirm important actions** - Get approval for significant changes
4. **Log all tool use** - Maintain audit trail

## Adding Tools

To add new tools:
1. Update this file
2. Update POLICY.md permissions
3. Test in safe environment
4. Deploy with approval

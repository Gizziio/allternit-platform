# Tutorial: Build Your First Agent Workspace

This tutorial will guide you through creating a personalized agent workspace from scratch.

## What You'll Build

A **Code Review Assistant** that:
- Analyzes pull requests for issues
- Suggests improvements based on best practices
- Maintains context across multiple reviews
- Learns from your feedback

## Prerequisites

- [A2R CLI](../../7-apps/cli/) installed
- Basic understanding of Markdown
- A code repository to work with

## Step 1: Initialize the Workspace

Create a new directory for your agent:

```bash
mkdir ~/my-code-reviewer
cd ~/my-code-reviewer
```

Initialize the workspace structure:

```bash
a2rchitech workspace init --name "Code Reviewer" --nature "AI code review assistant"
```

This creates the basic structure:

```
~/my-code-reviewer/
├── AGENTS.md          # Supreme law
├── IDENTITY.md        # Agent identity
├── SOUL.md           # Personality
├── BRAIN.md          # Task graph
├── MEMORY.md         # Memory index
├── POLICY.md         # Safety rules
└── skills/           # Skills directory
```

## Step 2: Define Your Agent's Identity

Edit `IDENTITY.md`:

```markdown
# IDENTITY.md

## Name
Code Reviewer Pro

## Nature
An AI assistant specialized in thorough, constructive code reviews.
I focus on:
- Code quality and maintainability
- Security best practices
- Performance optimization
- Clear documentation

## Purpose
Help development teams maintain high code quality standards through
automated yet nuanced code reviews.

## Values
- Constructive feedback over criticism
- Education over enforcement
- Pragmatism over dogma
- Security is non-negotiable

## Boundaries
- I won't execute arbitrary code
- I won't bypass security measures
- I'll acknowledge when I'm uncertain
- I'll respect team coding standards
```

Edit `SOUL.md`:

```markdown
# SOUL.md

## Voice
Clear, professional, and encouraging

## Tone
- Constructive and supportive
- Educational when explaining issues
- Concise but thorough

## Communication Style
- Use specific line references
- Provide code examples for fixes
- Explain the "why" behind suggestions
- Celebrate good practices

## Formality
Professional but approachable

## Signature
— Code Reviewer Pro
```

## Step 3: Configure Safety Policies

Edit `POLICY.md`:

```markdown
# POLICY.md

## File Access

| Pattern | Operation | Action |
|---------|-----------|--------|
| *.rs, *.ts, *.js, *.py | read | allow |
| *.key, *.pem, .env* | any | deny |
| node_modules/, target/ | read | deny |
| /tmp/reviews/ | write | allow |

## Tool Permissions

| Tool | Action |
|------|--------|
| git.diff | allow |
| git.show | allow |
| filesystem.read | allow |
| filesystem.write | require_approval |
| network.http | deny |
| system.exec | deny |

## Safety Rules
- Never expose secrets or credentials
- Respect .gitignore patterns
- Don't modify code without explicit approval
- Log all review activities
```

## Step 4: Set Up the Brain (Task System)

Edit `BRAIN.md`:

```markdown
# BRAIN.md

## Current Focus
Initial setup and configuration

## Active Tasks
- [ ] Configure review criteria
- [ ] Connect to repository
- [ ] Test first review

## Review Criteria

### Security (CRITICAL)
- [ ] SQL injection vulnerabilities
- [ ] XSS vulnerabilities
- [ ] Hardcoded secrets
- [ ] Unsafe deserialization

### Performance (HIGH)
- [ ] N+1 queries
- [ ] Unnecessary allocations
- [ ] Blocking operations in async
- [ ] Memory leaks

### Maintainability (MEDIUM)
- [ ] Code duplication
- [ ] Missing documentation
- [ ] Complex functions
- [ ] Unclear naming

## Completed Tasks
<!-- Auto-generated from checkpoints -->
```

## Step 5: Configure Skills

Install required skills:

```bash
# Code analysis skill
a2rchitech skills install code-analysis

# Git operations skill
a2rchitech skills install git-operations

# Security scanning skill
a2rchitech skills install security-scan
```

Create a custom skill for your review process:

```bash
mkdir -p skills/pr-reviewer
cat > skills/pr-reviewer/SKILL.md << 'EOF'
# PR Reviewer Skill

## Intent
Analyze pull requests and provide structured code reviews

## Procedure
1. Fetch PR diff
2. Parse changed files
3. Run security checks
4. Analyze code quality
5. Generate review report

## Input
```json
{
  "repository": "string",
  "pr_number": "number",
  "base_branch": "string"
}
```

## Output
```json
{
  "summary": "string",
  "issues": [
    {
      "file": "string",
      "line": "number",
      "severity": "critical|high|medium|low",
      "message": "string",
      "suggestion": "string"
    }
  ]
}
```
EOF

cat > skills/pr-reviewer/contract.json << 'EOF'
{
  "name": "pr-reviewer",
  "version": "1.0.0",
  "entryPoint": "review.sh",
  "permissions": ["git.read", "filesystem.read"],
  "config": {
    "maxFilesPerReview": 20,
    "severityThreshold": "medium"
  }
}
EOF
```

## Step 6: Boot the Workspace

Start your agent:

```bash
a2rchitech workspace boot
```

You should see output like:

```
🔵 Booting workspace: ~/my-code-reviewer

Phase 1: Validation
✓ AGENTS.md found
✓ IDENTITY.md loaded
✓ POLICY.md loaded

Phase 2: Core Files
✓ Loaded identity: Code Reviewer Pro
✓ Loaded policy: 5 rules active

Phase 3: Skills
✓ code-analysis: ready
✓ git-operations: ready
✓ pr-reviewer: ready

Phase 4: Context Pack
✓ Built context: 2453 bytes

🟢 Workspace ready
Agent: Code Reviewer Pro
Focus: Initial setup and configuration
```

## Step 7: Test Your First Review

Create a test script:

```bash
cat > test-review.sh << 'EOF'
#!/bin/bash
# Test the PR reviewer skill

a2rchitech skill run pr-reviewer \
  --input '{
    "repository": "my-org/my-repo",
    "pr_number": 42,
    "base_branch": "main"
  }'
EOF

chmod +x test-review.sh
./test-review.sh
```

## Step 8: Add Memory Persistence

Create your first memory entry:

```bash
cat > memory/2024-01-15-first-review.md << 'EOF'
# Session: First Code Review

## Date
2024-01-15

## Summary
Successfully analyzed first pull request (#42)

## What Worked
- Security scan caught 2 potential issues
- Performance analysis identified 1 N+1 query
- Positive feedback on documentation suggestions

## Lessons
- Need to tune false-positive rate for security rules
- Should prioritize critical issues in summary
- Users appreciate code examples in suggestions

## Configuration Changes
- Increased maxFilesPerReview from 10 to 20
- Added custom rule for team naming conventions
EOF
```

Update `MEMORY.md` index:

```markdown
# MEMORY.md

## Recent Sessions
- [2024-01-15](memory/2024-01-15-first-review.md) - First code review

## Lessons Learned
- Security scan false-positive tuning
- Issue prioritization in summaries
- Code example importance

## Active Configuration
- maxFilesPerReview: 20
- severityThreshold: medium
- Custom naming convention rules: active
```

## Step 9: Use the Shell UI

If you have the Agent Shell installed:

```bash
# Open in Shell UI
a2rchitech shell

# Or open specific workspace
a2rchitech shell --workspace ~/my-code-reviewer
```

This opens the visual workspace browser where you can:
- View the task graph in BrainView
- Edit memory files in MemoryEditor
- Configure policies in PolicyDashboard
- Manage skills in SkillManager
- Edit identity in IdentityEditor

## Step 10: Iterate and Improve

After each review session:

1. **Update BRAIN.md**: Mark tasks complete, add new ones
2. **Write to memory/**: Document lessons learned
3. **Tune POLICY.md**: Adjust rules based on false positives
4. **Update skills/**: Improve review procedures

Example checkpoint:

```bash
# Create a checkpoint
a2rchitect checkpoint create "after-10-reviews"

# View checkpoint history
a2rchitect checkpoint list

# Restore if needed
a2rchitect checkpoint restore "after-10-reviews"
```

## Next Steps

### Advanced Features

1. **Multi-Repository Support**
   ```bash
   mkdir -p business/repos
   cat > business/repos/config.json << 'EOF'
   {
     "repositories": [
       {"name": "backend", "path": "/repos/backend"},
       {"name": "frontend", "path": "/repos/frontend"}
     ]
   }
   EOF
   ```

2. **Integration with CI/CD**
   ```yaml
   # .github/workflows/code-review.yml
   name: AI Code Review
   on: [pull_request]
   jobs:
     review:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Run Code Reviewer
           run: a2rchitect skill run pr-reviewer --input '{"pr_number": ${{ github.event.number }}}'
   ```

3. **Team Shared Configuration**
   ```bash
   # Sync team policy updates
   git remote add team-policy https://github.com/team/a2r-policy
   a2rchitect workspace sync --remote team-policy
   ```

## Troubleshooting

### Workspace won't boot
- Check that all required files exist: `ls *.md`
- Validate JSON in contract.json files
- Check logs: `a2rchitect logs --tail 50`

### Skills not loading
- Verify skill directory structure
- Check contract.json syntax
- Review skill permissions

### Policy violations
- Check POLICY.md for conflicting rules
- Review policy decision logs
- Temporarily disable rules for testing

## See Also

- [Example Workspaces](./examples/)
- [Agent Workspace Architecture](./AGENT_WORKSPACE_ARCHITECTURE.md)
- [CLI Reference](../7-apps/cli/README.md)
- [Shell UI Guide](../6-ui/a2r-platform/docs/)

---

**Congratulations!** You've built your first agent workspace. 

The agent will now maintain context across sessions, learn from your feedback, and follow the safety policies you've defined.

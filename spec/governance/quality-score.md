# Quality Score System Specification

**Version:** 1.0.0  
**Status:** Draft  
**Related:** LAW-QLT, P4.14

---

## 1. Overview

This specification defines the quality scoring system for A2R domains, providing:
- Agent-visible quality metrics
- Automated grade updates
- Trend tracking and visualization

---

## 2. Domain Grades

### 2.1 Score Categories

| Category | Weight | Metrics |
|----------|--------|---------|
| Architecture Adherence | 30% | Layer violations, dependency direction |
| Test Coverage | 25% | Line coverage, branch coverage |
| Observability | 20% | Logging, tracing, metrics |
| Boundary Enforcement | 15% | Module isolation, interface contracts |
| Drift Frequency | 10% | Spec drift, doc drift |

### 2.2 Grade Scale

| Score | Grade | Status |
|-------|-------|--------|
| 90-100 | A+ | Excellent |
| 80-89 | A | Good |
| 70-79 | B | Acceptable |
| 60-69 | C | Needs Improvement |
| < 60 | D | Critical |

### 2.3 Storage

```
/quality/
├── domain-grades.md      # Human-readable report
├── domain-scores.json    # Machine-readable scores
└── history/
    ├── 2026-02.md
    ├── 2026-01.md
    └── ...
```

---

## 3. Agent Integration

### 3.1 Agent-Visible Metrics

```typescript
interface QualityMetrics {
  domain: string;
  grade: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  topIssues: QualityIssue[];
}

interface QualityIssue {
  category: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  fix: string; // Suggested fix
}
```

### 3.2 Agent Optimization

Agents optimize for grade improvement:

```typescript
async function optimizeForQuality(task: AgentTask): Promise<void> {
  const currentMetrics = await getQualityMetrics(task.domain);
  
  // Prioritize high-impact fixes
  const highImpactIssues = currentMetrics.topIssues
    .filter(i => i.severity === 'high')
    .sort((a, b) => b.impact - a.impact);
  
  for (const issue of highImpactIssues) {
    await agent.applyFix(issue.fix);
  }
  
  // Re-run tests to verify
  const newMetrics = await getQualityMetrics(task.domain);
  if (newMetrics.score > currentMetrics.score) {
    await logImprovement(currentMetrics, newMetrics);
  }
}
```

---

## 4. Automated Grade Updates

### 4.1 GC Agent Integration

```typescript
interface GCQualityIntegration {
  onGCComplete(report: GCReport): Promise<void>;
  updateScores(report: GCReport): Promise<QualityDelta>;
}

interface QualityDelta {
  previousScore: number;
  newScore: number;
  change: number;
  contributor: string; // GC agent name
}
```

### 4.2 Trend Tracking

```markdown
## Quality Trend: @a2r/platform

| Week | Score | Change | Notes |
|------|-------|--------|-------|
| 2026-W08 | 87 | +2 | Fixed boundary violations |
| 2026-W07 | 85 | -1 | Test coverage dropped |
| 2026-W06 | 86 | +3 | Added observability |
```

---

## 5. Quality Dashboard

### 5.1 UI Components

```
/quality/dashboard
├── DomainOverview    # All domains with grades
├── TrendChart        # Score over time
├── IssueBreakdown    # Issues by category
└── ImprovementTips   # Agent suggestions
```

### 5.2 Real-Time Updates

```typescript
// SSE endpoint for quality updates
GET /quality/stream

// Event format
data: {
  "type": "score_update",
  "domain": "@a2r/platform",
  "previous": 85,
  "current": 86,
  "timestamp": "2026-02-24T12:00:00Z"
}
```

---

## 6. Related Documents

- [LAW-QLT](../../SYSTEM_LAW.md#law-qlt-quality-law)
- [Garbage Collection Agents](./gc-agents.md)
- [Evolution Layer](./evolution-layer.md)

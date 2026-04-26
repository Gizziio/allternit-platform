# A://AGENTS-OPS-320 — Build an Incident Triage Assistant

**Outcome:** Automated log analysis system that summarizes failures and proposes actions  
**Artifact:** Deployed triage assistant with Slack/email integration  
**Prerequisites:** A://OPS-WORKFLOWS-201, basic Python  
**Time:** 5-7 hours  
**Difficulty:** Intermediate

---

## Problem

Incidents are chaotic:
- Logs scattered across systems
- Alert fatigue from noise
- Slow root cause identification
- Action items unclear

---

## What You're Building

A triage assistant that:
1. Ingests logs and alerts
2. Identifies failure patterns
3. Summarizes impact
4. Suggests next actions
5. Routes to appropriate team

**System Flow:**
```
Alert → Ingest → Parse → Analyze → Summarize → Recommend → Route
```

---

## Stack

| Component | Recommendation | Alternative |
|-----------|---------------|-------------|
| Log Ingest | Webhook API | Kafka, SQS |
| Log Storage | SQLite/Postgres | ELK stack |
| Analysis | GPT-4 | Claude, local |
| Routing | Slack API | Email, PagerDuty |
| Backend | Python/FastAPI | Node.js |

---

## Implementation

### Step 1: Log Ingestion

```python
from fastapi import FastAPI, Request
from pydantic import BaseModel
from datetime import datetime
import json

app = FastAPI()

class LogEntry(BaseModel):
    timestamp: str
    service: str
    level: str  # ERROR, WARN, INFO
    message: str
    metadata: dict = {}

class LogStore:
    def __init__(self):
        self.logs = []
    
    def add(self, entry: LogEntry):
        self.logs.append(entry.dict())
        # Keep last 10000 logs
        self.logs = self.logs[-10000:]
    
    def get_recent(self, service: str = None, level: str = None, minutes: int = 30):
        """Get recent logs with optional filters."""
        cutoff = datetime.now().timestamp() - (minutes * 60)
        filtered = [
            log for log in self.logs
            if log['timestamp'] >= cutoff
            and (service is None or log['service'] == service)
            and (level is None or log['level'] == level)
        ]
        return filtered
    
    def get_pattern(self, message_pattern: str, minutes: int = 60):
        """Find logs matching pattern."""
        cutoff = datetime.now().timestamp() - (minutes * 60)
        return [
            log for log in self.logs
            if log['timestamp'] >= cutoff
            and message_pattern.lower() in log['message'].lower()
        ]

log_store = LogStore()

@app.post("/ingest")
async def ingest_log(entry: LogEntry):
    """Receive log entry."""
    log_store.add(entry)
    return {"status": "received"}

@app.post("/ingest/batch")
async def ingest_batch(entries: list[LogEntry]):
    """Receive batch of logs."""
    for entry in entries:
        log_store.add(entry)
    return {"status": "received", "count": len(entries)}
```

### Step 2: Alert Handler

```python
import openai
from typing import List, Dict

class TriageAnalyzer:
    def __init__(self):
        openai.api_key = os.getenv("OPENAI_API_KEY")
    
    def analyze_incident(self, logs: List[Dict], alert_context: Dict) -> Dict:
        """Analyze logs and generate triage report."""
        
        # Format logs for analysis
        log_text = "\n".join([
            f"[{log['timestamp']}] {log['service']} {log['level']}: {log['message']}"
            for log in logs[:100]  # Limit context
        ])
        
        prompt = f"""Analyze the following incident logs and provide a triage report.

Alert Context:
- Service: {alert_context.get('service', 'unknown')}
- Alert: {alert_context.get('alert_name', 'unknown')}
- Triggered: {alert_context.get('timestamp', 'unknown')}

Recent Logs:
{log_text}

Provide your analysis in this JSON format:
{{
    "summary": "One sentence description of the incident",
    "severity": "critical|high|medium|low",
    "affected_services": ["list"],
    "root_cause_guess": "Probable cause based on logs",
    "impact_assessment": "What user/system impact",
    "recommended_actions": ["action 1", "action 2"],
    "escalation_required": true/false,
    "team_to_notify": "team name"
}}"""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an incident response assistant. Analyze logs objectively and suggest concrete actions."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)

analyzer = TriageAnalyzer()

@app.post("/alert")
async def handle_alert(alert: dict):
    """Handle incoming alert."""
    service = alert.get('service')
    
    # Get recent logs for context
    recent_logs = log_store.get_recent(
        service=service,
        minutes=30
    )
    
    # Also get error logs
    error_logs = log_store.get_recent(
        service=service,
        level='ERROR',
        minutes=60
    )
    
    all_logs = recent_logs + error_logs
    
    # Analyze
    triage = analyzer.analyze_incident(all_logs, alert)
    
    # Route
    await route_alert(triage, alert)
    
    return triage
```

### Step 3: Routing

```python
import requests
import os

class AlertRouter:
    def __init__(self):
        self.slack_webhook = os.getenv("SLACK_WEBHOOK_URL")
        self.team_mapping = {
            "api": "#alerts-backend",
            "database": "#alerts-infra",
            "frontend": "#alerts-frontend",
            "default": "#alerts-general"
        }
    
    async def route_to_slack(self, triage: Dict, original_alert: Dict):
        """Send triage report to Slack."""
        
        severity_emoji = {
            "critical": "🔴",
            "high": "🟠",
            "medium": "🟡",
            "low": "🟢"
        }
        
        team_channel = self.team_mapping.get(
            original_alert.get('service', 'default'),
            self.team_mapping['default']
        )
        
        message = {
            "channel": team_channel,
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"{severity_emoji.get(triage['severity'], '⚪')} Incident: {triage['summary'][:100]}"
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Severity:*\n{triage['severity']}"},
                        {"type": "mrkdwn", "text": f"*Service:*\n{original_alert.get('service', 'N/A')}"},
                        {"type": "mrkdwn", "text": f"*Escalate:*\n{'Yes' if triage['escalation_required'] else 'No'}"},
                        {"type": "mrkdwn", "text": f"*Team:*\n{triage['team_to_notify']}"}
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Impact:*\n{triage['impact_assessment']}"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Root Cause Guess:*\n{triage['root_cause_guess']}"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Recommended Actions:*\n" + "\n".join(f"• {action}" for action in triage['recommended_actions'])
                    }
                }
            ]
        }
        
        response = requests.post(
            self.slack_webhook,
            json=message,
            headers={"Content-Type": "application/json"}
        )
        
        return response.status_code == 200

router = AlertRouter()

async def route_alert(triage: Dict, alert: Dict):
    """Route alert to appropriate channel."""
    return await router.route_to_slack(triage, alert)
```

---

## Failure Modes

| Problem | Cause | Solution |
|---------|-------|----------|
| False positives | Noisy alerts | Add filtering; require error threshold |
| Missed context | Short log window | Increase lookback; correlate alerts |
| Wrong routing | Ambiguous service | Add service tags; manual override |
| Alert fatigue | Too many notifications | Batch similar alerts; severity filtering |

---

## Capstone

Submit:
1. Working triage API
2. Slack integration demo
3. Sample incident analysis
4. Routing accuracy metrics

---

**Build this. Deploy it. Respond faster.**

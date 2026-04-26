# A://AGENTS-SALES-330 — Build a Lead Qualification Assistant

**Outcome:** Automated lead scoring system from CRM data, emails, and calls  
**Artifact:** Deployed qualification pipeline with CRM integration  
**Prerequisites:** A://OPS-WORKFLOWS-201, API integration basics  
**Time:** 6-8 hours  
**Difficulty:** Intermediate

---

## Problem

Sales teams waste time on:
- Unqualified leads
- Manual research on prospects
- Inconsistent qualification criteria
- Delayed follow-up

---

## What You're Building

A qualification assistant that:
1. Ingests lead data from CRM
2. Analyzes emails and call transcripts
3. Scores against ICP criteria
4. Enriches with external data
5. Routes qualified leads to reps

**System Flow:**
```
Lead → Enrich → Analyze → Score → Route → Notify
```

---

## Stack

| Component | Recommendation | Alternative |
|-----------|---------------|-------------|
| CRM | HubSpot API | Salesforce, Pipedrive |
| Email Analysis | OpenAI GPT-4 | Claude, local |
| Transcription | Deepgram | Whisper API |
| Data Enrichment | Clearbit | Apollo, ZoomInfo |
| Backend | Python/FastAPI | Node.js |

---

## Implementation

### Step 1: Lead Ingestion

```python
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, List
import requests
import os

app = FastAPI()

class Lead(BaseModel):
    email: str
    company: Optional[str] = None
    title: Optional[str] = None
    source: Optional[str] = None
    crm_id: Optional[str] = None

class LeadEnricher:
    def __init__(self):
        self.clearbit_key = os.getenv("CLEARBIT_API_KEY")
        self.hubspot_key = os.getenv("HUBSPOT_API_KEY")
    
    def enrich(self, lead: Lead) -> dict:
        """Enrich lead with external data."""
        enriched = {
            "original": lead.dict(),
            "company_data": {},
            "person_data": {},
            "engagement_history": []
        }
        
        # Clearbit enrichment
        if self.clearbit_key:
            try:
                response = requests.get(
                    f"https://person.clearbit.com/v2/combined/find",
                    params={"email": lead.email},
                    auth=(self.clearbit_key, '')
                )
                if response.status_code == 200:
                    data = response.json()
                    enriched["company_data"] = data.get("company", {})
                    enriched["person_data"] = data.get("person", {})
            except Exception as e:
                print(f"Enrichment error: {e}")
        
        # HubSpot engagement history
        if self.hubspot_key and lead.crm_id:
            try:
                response = requests.get(
                    f"https://api.hubapi.com/crm/v3/objects/contacts/{lead.crm_id}/associations/engagements",
                    headers={"Authorization": f"Bearer {self.hubspot_key}"}
                )
                if response.status_code == 200:
                    enriched["engagement_history"] = response.json().get("results", [])
            except Exception as e:
                print(f"CRM error: {e}")
        
        return enriched

enricher = LeadEnricher()

@app.post("/leads")
async def ingest_lead(lead: Lead):
    """Ingest and enrich a new lead."""
    enriched = enricher.enrich(lead)
    
    # Store for processing
    # TODO: Add to queue
    
    return {"status": "enriched", "data": enriched}
```

### Step 2: Qualification Scoring

```python
import openai
from typing import Dict, List

class QualificationScorer:
    def __init__(self):
        openai.api_key = os.getenv("OPENAI_API_KEY")
        
        # ICP criteria
        self.icp_criteria = {
            "company_size": ["50-200", "200-1000", "1000+"],
            "industries": ["SaaS", "Technology", "Financial Services"],
            "titles": ["VP", "Director", "Head of", "CTO", "CEO"],
            "signals": ["hiring", "funding", "growth"]
        }
    
    def score_lead(self, enriched_lead: dict) -> Dict:
        """Score lead against ICP."""
        
        company = enriched_lead.get("company_data", {})
        person = enriched_lead.get("person_data", {})
        
        # Build scoring context
        context = f"""
Company: {company.get('name', 'Unknown')}
Industry: {company.get('industry', 'Unknown')}
Employees: {company.get('employees', 'Unknown')}
Revenue: {company.get('metrics', {}).get('estimatedAnnualRevenue', 'Unknown')}

Contact: {person.get('name', {}).get('fullName', 'Unknown')}
Title: {person.get('employment', {}).get('title', 'Unknown')}
Seniority: {person.get('employment', {}).get('seniority', 'Unknown')}

Engagement History: {len(enriched_lead.get('engagement_history', []))} interactions
"""
        
        prompt = f"""Score this lead against our Ideal Customer Profile.

ICP Criteria:
- Company size: 50+ employees
- Industries: SaaS, Technology, Financial Services
- Contact seniority: Manager level or above
- Growth signals: Hiring, funding, or expansion

Lead Data:
{context}

Provide scoring in JSON format:
{{
    "overall_score": 0-100,
    "fit_category": "excellent|good|fair|poor",
    "criteria_scores": {{
        "company_fit": 0-100,
        "contact_authority": 0-100,
        "engagement_level": 0-100,
        "timing": 0-100
    }},
    "reasoning": "brief explanation",
    "recommended_action": "immediate_outreach|nurture|disqualify",
    "talking_points": ["point 1", "point 2"]
}}"""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a sales qualification expert. Score leads objectively against criteria."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)

scorer = QualificationScorer()

@app.post("/leads/{lead_id}/score")
async def score_lead(lead_id: str):
    """Score a lead."""
    # Retrieve enriched lead
    # lead = get_lead(lead_id)
    
    # Score
    # score = scorer.score_lead(lead)
    
    # Update CRM
    # update_crm_score(lead_id, score)
    
    return {"status": "scored"}
```

### Step 3: Communication Analysis

```python
class CommunicationAnalyzer:
    def __init__(self):
        openai.api_key = os.getenv("OPENAI_API_KEY")
    
    def analyze_email_thread(self, emails: List[Dict]) -> Dict:
        """Analyze email thread for buying signals."""
        
        # Format thread
        thread_text = "\n\n---\n\n".join([
            f"From: {e['from']}\nSubject: {e['subject']}\n\n{e['body'][:500]}"
            for e in emails[-5:]  # Last 5 emails
        ])
        
        prompt = f"""Analyze this email thread for sales qualification signals.

Email Thread:
{thread_text}

Analyze for:
1. Buying intent level (hot/warm/cold)
2. Budget indicators
3. Timeline urgency
4. Decision maker involvement
5. Objections or concerns
6. Next steps suggested

Return JSON:
{{
    "intent_level": "hot|warm|cold",
    "budget_indicated": true/false,
    "timeline": "immediate|1-3 months|3-6 months|future",
    "decision_maker_involved": true/false,
    "objections": ["list"],
    "suggested_next_step": "specific action",
    "risk_factors": ["list"]
}}"""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
    
    def transcribe_and_analyze_call(self, audio_url: str) -> Dict:
        """Transcribe call and analyze."""
        # TODO: Implement with Deepgram/Whisper
        # For now, placeholder
        return {
            "transcript": "Call transcription...",
            "sentiment": "positive",
            "key_points": ["point 1", "point 2"],
            "action_items": ["action 1"]
        }
```

### Step 4: Routing

```python
class LeadRouter:
    def __init__(self):
        self.sdr_queue = []
        self.ae_queue = []
    
    def route(self, lead: dict, score: dict) -> str:
        """Route lead to appropriate queue."""
        
        overall_score = score.get("overall_score", 0)
        fit_category = score.get("fit_category", "poor")
        
        if overall_score >= 80 and fit_category == "excellent":
            # Hot lead → AE immediately
            self.ae_queue.append({
                "lead": lead,
                "score": score,
                "priority": "high",
                "sla": "2 hours"
            })
            return "ae_priority"
        
        elif overall_score >= 60:
            # Qualified → SDR queue
            self.sdr_queue.append({
                "lead": lead,
                "score": score,
                "priority": "normal",
                "sla": "24 hours"
            })
            return "sdr_queue"
        
        else:
            # Nurture or disqualify
            return "nurture"
    
    def notify_rep(self, lead: dict, score: dict, channel: str = "slack"):
        """Send notification to sales rep."""
        # TODO: Implement Slack/email notification
        pass

router = LeadRouter()
```

---

## Capstone

Submit:
1. Working qualification API
2. Sample lead scoring output
3. CRM integration demo
4. Routing logic documentation

---

**Build this. Deploy it. Close faster.**

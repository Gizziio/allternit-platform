# Business Workflow Patterns

**Course:** ALABS-OPS-N8N — Orchestrate Agents & Automations with n8n  
**Tier:** OPS

## Module Overview

This module applies n8n architecture to real business scenarios: lead generation, email automation, CRM updates, and approval chains. You will learn the patterns that make business workflows reliable and maintainable.

## Learning Objectives

- [ ] Design a lead-capture workflow that validates, enriches, and routes data.
- [ ] Implement an approval workflow with conditional branching and notifications.
- [ ] Build a multi-step email sequence triggered by user actions.

## Lecture Guide

**Source:** N8N for Beginners: Lead Generation, Automation & AI Agents + Bonus n8n courses

1. **Lead Generation Pattern** — Form capture → validation → enrichment → CRM entry.
2. **Email Automation** — Trigger → delay → personalized email → open/click tracking.
3. **CRM Synchronization** — Bi-directional sync between n8n and HubSpot/Salesforce.
4. **Approval Workflows** — Request → manager notification → approve/reject branch.
5. **Notification Patterns** — Slack, email, and SMS alerts based on workflow events.
6. **Data Enrichment** — Calling Clearbit/Hunter APIs to augment lead records.
7. **Deduplication** — Checking for existing records before creating new ones.
8. **Conditional Logic** — Using IF and Switch nodes for complex routing.
9. **Looping Constructs** — Processing lists of items with Split In Batches.
10. **Error Recovery** — Handling API rate limits and transient failures.
11. **File Processing** — Receiving attachments, parsing CSVs, and storing results.
12. **Calendar Integration** — Creating events and checking availability.
13. **Survey/Form Processing** — Aggregating responses and generating reports.
14. **Customer Onboarding** — Multi-step welcome sequences across channels.
15. **Workflow Documentation** — Maintaining runbooks and node descriptions.

## Demo Outline (10 min)

1. Build a lead-capture workflow: Typeform webhook → validation → Slack alert → Google Sheets row.
2. Add an approval branch: if deal size > $10K, notify manager before CRM entry.
3. Show the execution log for a complete run.

## Challenge (5 min)

> **The Support Escalator:** Build a workflow that receives a support ticket. If priority is \"high\" AND it has been open > 2 hours, send a Slack DM to the team lead and create a PagerDuty incident.

## Allternit Connection

- **Internal system:** Customer success workflows are orchestrated in n8n.
- **Reference repo/file:** \"workflows/support_escalation.json\"
- **Key difference from standard approach:** Allternit never stores PII in n8n execution logs. Sensitive fields are hashed or redacted at the entry node.

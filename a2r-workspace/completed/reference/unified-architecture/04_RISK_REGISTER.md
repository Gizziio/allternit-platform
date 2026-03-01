# A2rchitech Risk Register

> **Version:** 1.0.0
> **Last Updated:** January 2026

---

## Risk Matrix

| Probability | Impact: Low | Impact: Medium | Impact: High | Impact: Critical |
|-------------|-------------|----------------|--------------|------------------|
| High | Monitor | Mitigate | Mitigate | Prevent |
| Medium | Accept | Monitor | Mitigate | Mitigate |
| Low | Accept | Accept | Monitor | Mitigate |

---

## 1. Platform & Infrastructure Risks

### RISK-001: Apple Rate-Limits iMessage
**Category:** Platform
**Probability:** Medium | **Impact:** High
**Risk Score:** Mitigate

**Description:** Apple may rate-limit or block accounts sending high volumes of iMessages, especially if patterns look automated.

**Indicators:**
- Increased message delivery failures
- Account warnings from Apple
- Messages marked as spam

**Mitigation Strategies:**
1. **Identity Pool:** Use multiple iCloud accounts (10+ for production)
2. **Rate Limiting:** Max 1 message/second per account, max 100/hour
3. **Natural Patterns:** Randomize timing, avoid identical messages
4. **User Segmentation:** Assign users to specific accounts for consistency
5. **Fallback:** Graceful degradation to SMS if iMessage fails

**Contingency:** If rate-limited, immediately switch affected users to SMS gateway.

---

### RISK-002: chat.db Schema Changes
**Category:** Technical
**Probability:** Low | **Impact:** Medium
**Risk Score:** Monitor

**Description:** Apple may change the Messages database schema in macOS updates, breaking our reader.

**Indicators:**
- Message polling returns errors after macOS update
- SQL queries fail

**Mitigation Strategies:**
1. **Version Detection:** Check chat.db schema version on startup
2. **Schema Abstraction:** Abstract queries behind version-aware layer
3. **Monitoring:** Alert on query failures
4. **Rapid Response:** Maintain test suite against multiple macOS versions

**Contingency:** Fall back to AppleScript-based message reading (slower but stable API).

---

### RISK-003: Full Disk Access Revoked
**Category:** Platform
**Probability:** Low | **Impact:** High
**Risk Score:** Monitor

**Description:** User revokes Full Disk Access permission, breaking chat.db reading.

**Indicators:**
- Permission denied errors on database access
- Polling stops returning messages

**Mitigation Strategies:**
1. **Health Checks:** Periodic permission verification
2. **User Notification:** Clear messaging when permission lost
3. **Graceful Degradation:** Queue messages, alert user

**Contingency:** Prompt user to re-grant permission with clear instructions.

---

### RISK-004: SMS Provider Outage
**Category:** Infrastructure
**Probability:** Medium | **Impact:** Medium
**Risk Score:** Monitor

**Description:** Primary SMS provider (Telnyx) experiences outage.

**Indicators:**
- API errors from provider
- Increased message latency
- Delivery failures

**Mitigation Strategies:**
1. **Multi-Provider:** Support Telnyx + Twilio + Plivo
2. **Automatic Failover:** Switch providers on error thresholds
3. **Queue Persistence:** Store undelivered messages for retry
4. **SLA Monitoring:** Track provider performance

**Contingency:** Automatic switch to secondary provider within 30 seconds.

---

## 2. Security Risks

### RISK-005: Unauthorized Function Execution
**Category:** Security
**Probability:** Low | **Impact:** Critical
**Risk Score:** Mitigate

**Description:** Malicious user or prompt injection causes unauthorized system actions.

**Indicators:**
- Functions executed without user intent
- Unusual function call patterns
- User reports of unexpected actions

**Mitigation Strategies:**
1. **Permission Gates:** Every function requires explicit permission grant
2. **Confirmation Flows:** High-risk actions require explicit confirmation
3. **Rate Limiting:** Max function calls per time window
4. **Audit Logging:** Every execution logged immutably
5. **Input Sanitization:** Strict input validation
6. **Function Allowlists:** Users explicitly enable function categories

**Contingency:** Kill switch to disable all function execution immediately.

---

### RISK-006: Prompt Injection
**Category:** Security
**Probability:** Medium | **Impact:** High
**Risk Score:** Mitigate

**Description:** User crafts message that causes LLM to bypass safety guardrails.

**Indicators:**
- Model outputs unexpected function calls
- System prompt leakage
- Unusual response patterns

**Mitigation Strategies:**
1. **System Prompt Hardening:** Clear boundaries in prompt
2. **Output Validation:** Validate LLM output matches expected schema
3. **Dual-LLM Check:** Secondary model validates suspicious outputs
4. **Confidence Thresholds:** Reject low-confidence function calls
5. **User History Analysis:** Flag anomalous request patterns

**Contingency:** Fallback to hardcoded responses for security-sensitive functions.

---

### RISK-007: Data Breach
**Category:** Security
**Probability:** Low | **Impact:** Critical
**Risk Score:** Mitigate

**Description:** Unauthorized access to user data or conversation history.

**Indicators:**
- Unauthorized database access
- Data exfiltration detected
- User reports of data exposure

**Mitigation Strategies:**
1. **Encryption at Rest:** All user data encrypted (AES-256)
2. **Encryption in Transit:** TLS 1.3 for all connections
3. **Minimal Storage:** Store only what's necessary
4. **Access Controls:** Role-based access, audit logs
5. **Regular Audits:** Quarterly security reviews
6. **Penetration Testing:** Annual third-party testing

**Contingency:** Incident response plan with 24-hour breach notification.

---

### RISK-008: API Key Exposure
**Category:** Security
**Probability:** Medium | **Impact:** High
**Risk Score:** Mitigate

**Description:** LLM or SMS provider API keys exposed.

**Indicators:**
- Unexpected API usage spikes
- Keys found in public repositories
- Provider alerts

**Mitigation Strategies:**
1. **Secret Management:** Use HashiCorp Vault or AWS Secrets Manager
2. **Environment Variables:** Never hardcode keys
3. **Key Rotation:** Rotate keys monthly
4. **Usage Monitoring:** Alert on anomalous API usage
5. **Git Hooks:** Prevent accidental commits of secrets

**Contingency:** Immediate key rotation with provider notification.

---

## 3. Technical Risks

### RISK-009: LLM Latency
**Category:** Performance
**Probability:** Medium | **Impact:** Medium
**Risk Score:** Monitor

**Description:** LLM response times degrade user experience.

**Indicators:**
- Response times >5 seconds
- User complaints about slowness
- Timeout errors

**Mitigation Strategies:**
1. **Streaming Responses:** Show partial responses as they arrive
2. **Model Selection:** Use faster models for simple tasks
3. **Local Fallback:** Local model for basic intent detection
4. **Caching:** Cache common responses
5. **Async Processing:** Return acknowledgment immediately, deliver result later

**Contingency:** "I'm thinking..." message while processing long requests.

---

### RISK-010: State Synchronization Issues
**Category:** Technical
**Probability:** Medium | **Impact:** Medium
**Risk Score:** Monitor

**Description:** Session state becomes inconsistent across components.

**Indicators:**
- Lost conversation context
- Duplicate message processing
- Inconsistent user preferences

**Mitigation Strategies:**
1. **Idempotency Keys:** Every message has unique ID
2. **Event Sourcing:** Append-only log as source of truth
3. **Transaction Guarantees:** Database transactions for state changes
4. **Health Checks:** Regular state validation
5. **Reconciliation:** Periodic state consistency checks

**Contingency:** State reset option for affected users.

---

### RISK-011: Function Execution Failures
**Category:** Technical
**Probability:** Medium | **Impact:** Medium
**Risk Score:** Monitor

**Description:** System functions fail to execute properly.

**Indicators:**
- Function call errors in logs
- User reports of failed actions
- Inconsistent execution results

**Mitigation Strategies:**
1. **Retry Logic:** Exponential backoff for transient failures
2. **Fallback Actions:** Alternative paths for critical functions
3. **User Notification:** Clear error messages
4. **Rollback Capability:** Undo actions where possible
5. **Circuit Breakers:** Disable failing functions temporarily

**Contingency:** Manual intervention queue for failed critical actions.

---

## 4. Business Risks

### RISK-012: Slow User Adoption
**Category:** Business
**Probability:** Medium | **Impact:** High
**Risk Score:** Mitigate

**Description:** Users don't adopt the platform as quickly as projected.

**Indicators:**
- Below-target signups
- High churn rate
- Low engagement metrics

**Mitigation Strategies:**
1. **Free Tier:** Low barrier to entry
2. **Referral Program:** Incentivize word-of-mouth
3. **Content Marketing:** Demonstrate value through examples
4. **Feature Prioritization:** Focus on highest-value use cases
5. **User Feedback:** Rapid iteration based on feedback

**Contingency:** Pivot to B2B focus if consumer adoption is slow.

---

### RISK-013: Competition
**Category:** Business
**Probability:** High | **Impact:** High
**Risk Score:** Mitigate

**Description:** Apple, OpenAI, or others launch competing products.

**Indicators:**
- Competitor product announcements
- Feature parity announcements
- Market share decline

**Mitigation Strategies:**
1. **Execution Layer Moat:** Focus on unique capability (actual function execution)
2. **Speed to Market:** Launch before competitors
3. **Niche Focus:** Own specific verticals deeply
4. **Enterprise Features:** Build compliance/security moat
5. **Community Building:** Strong developer ecosystem

**Contingency:** Acquisition discussions if market becomes untenable.

---

### RISK-014: Regulatory Changes
**Category:** Compliance
**Probability:** Medium | **Impact:** Medium
**Risk Score:** Monitor

**Description:** New AI or privacy regulations affect operations.

**Indicators:**
- Legislative announcements
- Industry guidance changes
- Competitor compliance issues

**Mitigation Strategies:**
1. **Compliance-First Design:** Build for GDPR/CCPA from start
2. **Regulatory Monitoring:** Track legislative developments
3. **Flexible Architecture:** Ability to add compliance features
4. **Legal Counsel:** Ongoing regulatory guidance
5. **Documentation:** Clear audit trails

**Contingency:** Feature restrictions in specific jurisdictions if required.

---

## 5. Apple-Specific Risks

### RISK-015: Apple Blocks Approach
**Category:** Platform
**Probability:** Low | **Impact:** Critical
**Risk Score:** Mitigate

**Description:** Apple explicitly blocks or discourages iMessage automation.

**Indicators:**
- Terms of service changes
- Account terminations
- Public statements against automation

**Mitigation Strategies:**
1. **SMS First Fallback:** Full functionality via SMS
2. **Compliance Posture:** Operate within reasonable use
3. **User Value:** Ensure users genuinely benefit
4. **Legal Review:** Ensure ToS compliance
5. **Relationship Building:** Engage with Apple developer relations

**Contingency:** Pivot to SMS-only if iMessage becomes untenable.

---

### RISK-016: Apple ID Account Issues
**Category:** Platform
**Probability:** Low | **Impact:** High
**Risk Score:** Monitor

**Description:** Apple IDs used for agents get locked or require verification.

**Indicators:**
- 2FA prompts on agent accounts
- Account lock warnings
- Verification requirements

**Mitigation Strategies:**
1. **Account Hygiene:** Proper account setup with recovery options
2. **Identity Pool:** Multiple accounts reduce single-point failure
3. **Monitoring:** Health checks on all accounts
4. **Documentation:** Clear account ownership records

**Contingency:** Rapid account replacement from pool.

---

## Risk Register Summary

| Risk ID | Risk | Probability | Impact | Strategy |
|---------|------|-------------|--------|----------|
| RISK-001 | Apple Rate-Limits iMessage | Medium | High | Mitigate |
| RISK-002 | chat.db Schema Changes | Low | Medium | Monitor |
| RISK-003 | Full Disk Access Revoked | Low | High | Monitor |
| RISK-004 | SMS Provider Outage | Medium | Medium | Monitor |
| RISK-005 | Unauthorized Function Execution | Low | Critical | Mitigate |
| RISK-006 | Prompt Injection | Medium | High | Mitigate |
| RISK-007 | Data Breach | Low | Critical | Mitigate |
| RISK-008 | API Key Exposure | Medium | High | Mitigate |
| RISK-009 | LLM Latency | Medium | Medium | Monitor |
| RISK-010 | State Sync Issues | Medium | Medium | Monitor |
| RISK-011 | Function Execution Failures | Medium | Medium | Monitor |
| RISK-012 | Slow User Adoption | Medium | High | Mitigate |
| RISK-013 | Competition | High | High | Mitigate |
| RISK-014 | Regulatory Changes | Medium | Medium | Monitor |
| RISK-015 | Apple Blocks Approach | Low | Critical | Mitigate |
| RISK-016 | Apple ID Account Issues | Low | High | Monitor |

---

## Risk Review Schedule

| Frequency | Action |
|-----------|--------|
| Weekly | Review active mitigations, update indicators |
| Monthly | Full risk register review, probability reassessment |
| Quarterly | Strategic risk review, new risk identification |
| Annually | Third-party security audit, penetration testing |

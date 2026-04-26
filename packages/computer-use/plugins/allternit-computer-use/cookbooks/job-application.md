# Cookbook: Job Application Automation

**Use case:** Fill and submit job applications across ATS portals — Greenhouse, Lever, Workday, Ashby, direct forms.

---

## Overview

```
navigate to application → detect ATS type → map fields → fill → attach resume → review → submit
```

---

## ATS Detection

After navigating to the job listing:
```
url_patterns = {
    "greenhouse": "greenhouse.io/",
    "lever":      "jobs.lever.co/",
    "workday":    "myworkday.com/",
    "ashby":      "ashbyhq.com/",
    "smartrecruiters": "smartrecruiters.com/",
}
# Match against current URL → load ATS-specific field mapping
```

---

## Applicant Data Schema

Expected input (from user or ~~credentials vault):
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone": "+1 555 000 0000",
  "location": "San Francisco, CA",
  "linkedin_url": "https://linkedin.com/in/janedoe",
  "github_url": "https://github.com/janedoe",
  "portfolio_url": "https://janedoe.dev",
  "resume_path": "/documents/resume.pdf",
  "cover_letter": "Dear Hiring Manager, ..."
}
```

---

## Field Mapping by ATS

### Greenhouse
```
"First Name"    → first_name
"Last Name"     → last_name
"Email"         → email
"Phone"         → phone
"Resume/CV"     → resume file upload
"LinkedIn"      → linkedin_url
"Website"       → portfolio_url
"Cover Letter"  → cover_letter (textarea or upload)
```

### Workday (complex)
```
# Workday uses dynamic IDs — use a11y labels
find_element("First Name", strategy="accessibility")
find_element("Last Name", strategy="accessibility")
# Multi-page flow: Personal Info → Work Experience → Education → Questions → Submit
```

### Custom Questions

For free-text questions ("Why do you want to work here?"):
- Check if user provided a pre-written answer
- If not: **pause and ask user** — never auto-generate answers to custom questions

---

## File Upload (Resume)

```
find_element("Upload resume", strategy="accessibility")
# Playwright file chooser interception
page.set_input_files(selector, resume_path)
# OR: click upload button → OS file dialog → set path
```

For OS file dialog:
```
click(upload_button)
# Dialog opens
type(resume_path)      ← type full path
key("Enter")           ← confirm
```

---

## Pre-Submit Review

**Always show before submitting:**
```
📋 Application ready to submit for: {job_title} at {company}

  Name:       Jane Doe
  Email:      jane@example.com
  Phone:      +1 555 000 0000
  Resume:     resume.pdf ✓ uploaded
  LinkedIn:   linkedin.com/in/janedoe ✓

  Custom Q1:  [your provided answer]

⚠️ This will submit your application. Confirm? (yes / no)
```

---

## Post-Submit

```
screenshot()          ← capture confirmation page
look for:
  - Confirmation number / Application ID
  - "Application submitted" message
  - Email confirmation notice

output: {
  "status": "submitted",
  "confirmation_id": "APP-123456",
  "screenshot": "<base64>",
  "submitted_at": "2026-04-22T09:00:00Z"
}
```

---

## Policy

- Never submit an application without explicit user confirmation
- Never auto-generate cover letters or custom question answers
- Never share or store applicant data beyond the current session without consent

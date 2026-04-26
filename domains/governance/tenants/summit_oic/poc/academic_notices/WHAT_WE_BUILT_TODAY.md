# Academic Notice Demo - What We Built Today (2024-04-10)

## Summary

Built a complete end-to-end live demo for the Summit Academy Academic Notice workflow. The demo generates fresh random students, creates institutional PDF notices, and uploads everything to a live Canvas course in ~21 seconds.

---

## Files Created/Modified

### Core Demo Scripts

| File | Purpose |
|------|---------|
| `generate_demo_data.mjs` | Generates 4 random students with grades/attendance, creates academic notice PDFs using SAOIC template |
| `run_canvas_e2e_demo.py` | Orchestrates full flow: generate → upload to Canvas → open browser |
| `fill_notice_pdf.py` | Fills the SAOIC Academic Status Notification PDF template |
| `run_demo.mjs` | Original script (replaced by generate_demo_data.mjs) |

### Configuration & Data

| File | Purpose |
|------|---------|
| `sample_data.json` | Generated student data (fresh each run) |
| `~/.config/allternit/canvas_academic_notice_demo.env` | Canvas credentials (email, password, course ID) |

### Output Files (Generated Each Run)

| File | Purpose |
|------|---------|
| `output/notices/<student>/academic_notice.pdf` | Filled SAOIC template PDF |
| `output/notices/<student>/missing_assignments.md` | Missing assignments report with email recipients |
| `output/notices/<student>/notice_payload.json` | Data passed to PDF filler |
| `output/canvas_e2e_demo_result.json` | Log of Canvas uploads (module ID, file IDs, URLs) |
| `output/audit_log.json` | Audit trail of generation |

### Documentation

| File | Purpose |
|------|---------|
| `DEMO_SCRIPT.md` | Quick reference for running the demo |
| `WHAT_WE_BUILT_TODAY.md` | This file - complete project documentation |

### Skill Files

| File | Purpose |
|------|---------|
| `../../skills/canvas/academic_notice_demo.skill.md` | Allternit skill documentation for LLM agents |
| `../../forms/academic_notice_demo.form.json` | Form schema for programmatic invocation |

---

## Demo Flow (What Happens)

### Phase 1: Student Generation (~2 seconds)
- Generates 4 random students with unique names
- Random grades (some passing, some failing)
- Random attendance percentages
- Random missing assignments
- Identifies students below 70% threshold

**Example Output:**
```
[12:45:07 PM] Generated student 1: Jordan Anderson
  → Grade: 60.9% | Attendance: 81% | Missing: 4 | ⚠️ AT RISK
[12:45:07 PM] Generated student 2: Remy Donovan
  → Grade: 79.6% | Attendance: 96% | Missing: 4 | ✓ PASSING
```

### Phase 2: Notice Creation (~3 seconds)
- For each at-risk student:
  - Fills SAOIC Academic Status Notification PDF template
  - Creates missing assignments report
  - Includes email recipients (Student + PM + Advisor + Registrar)
- Shows live progress in terminal

### Phase 3: Canvas Upload (~15 seconds)
- Authenticates with Canvas
- Creates new module: "Allternit Academic Notice Demo <timestamp>"
- Creates Queue Summary wiki page
- Uploads PDFs and MD files
- Adds all items to module

### Phase 4: Browser Open (~1 second)
- Opens Chrome to Canvas modules page
- Opens Preview with all academic notice PDFs
- Demo ready for presentation

---

## Academic Notice Parameters (Per Requirements)

| Parameter | Value |
|-----------|-------|
| **Program** | IT Support Specialist |
| **Course** | IT Fundamentals Phase 1 |
| **Term** | 20 weeks, 2 phases |
| **Week Milestone** | Week 3 (can extend to 5, 7) |
| **Passing Threshold** | 70% |
| **Template** | SAOIC Academic Status Notification (Fillable PDF) |
| **Email Recipients** | Student, Program Manager, Advisor, Registrar |
| **Status Checked** | "is at risk of failing" |

### PDF Fields Filled

- Student Name
- Term Start Date
- Department (Technology)
- Course Name
- Notice Date
- Grade & Attendance
- Required Actions (3 recovery steps)
- Course Instructor
- Risk Status Checkbox

---

## How to Run the Demo

### Quick Command

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/domains/governance/tenants/summit_oic/poc/academic_notices
rm -rf output/* canvas_demo_profile 2>/dev/null
python3 run_canvas_e2e_demo.py --headed
```

### What You'll See

1. Terminal shows live student generation
2. Shows notice creation progress
3. Shows Canvas upload progress
4. Chrome opens to Canvas modules
5. Preview opens with PDF notices

### Runtime

- **Total:** ~21 seconds
- **Student generation:** ~2 seconds
- **PDF creation:** ~3 seconds
- **Canvas upload:** ~15 seconds
- **Browser open:** ~1 second

---

## Key Features

### Fresh Data Every Run
- Random student names (Jordan, Avery, Peyton, etc.)
- Random grades (some above 70%, some below)
- Different missing assignments each time
- Looks live and authentic

### Intelligent Error Handling
- Retries on transient Canvas failures
- Clear error messages with recovery hints
- Session refresh on auth expiration
- Graceful degradation if browser fails

### Zero-Hang Browser
- `--headed` opens browser but doesn't block
- `--keep-open` only used for actual recording
- Script completes and returns control

### Canvas Integration
- Creates actual modules in course 14389375
- Uploads real files
- Creates wiki pages
- Faculty can access immediately

---

## Requirements Met

From `RELEVANT PARAMETERS.md`:

✅ **Data Privacy**: No PII stored locally, generated data is mock
✅ **Week 3 Milestone**: Demo set for week 3 (configurable to 5, 7)
✅ **70% Threshold**: Students below 70% get notices
✅ **SAOIC Template**: Uses institutional fillable PDF
✅ **Email Recipients**: Lists Student + PM + Advisor + Registrar
✅ **Missing Assignments**: Generated and listed in reports
✅ **Actions Required**: 3 specific recovery steps included
✅ **Canvas LMS**: Live integration with Instructure Canvas

---

## Demo Talking Points

1. **"Fresh students every time"** - Show the random generation
2. **"Smart filtering"** - Only at-risk students flagged
3. **"Real institutional PDF"** - SAOIC template with live data
4. **"Live Canvas"** - Actually creates content in the course
5. **"21 seconds end-to-end"** - Fast and repeatable

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Browser won't open | `open https://canvas.instructure.com/courses/14389375/modules` |
| PDFs won't open | `open output/notices/*/academic_notice.pdf` |
| Canvas timeout | Kill processes, retry |
| Wrong credentials | Check `~/.config/allternit/canvas_academic_notice_demo.env` |

---

## Next Steps / Future Enhancements

1. **Week 5 & 7 Milestones**: Extend to support all milestone weeks
2. **Recovery Tracking**: Show students who recovered from at-risk
3. **Email Integration**: Actually send emails via SMTP/API
4. **Student Acknowledgment**: Track signature/acknowledgment
5. **Anonymized Reports**: Generate instructor summary reports
6. **Weekly Reminders**: Automated follow-up notifications

---

## Files to Keep

Essential for demo:
- `generate_demo_data.mjs`
- `run_canvas_e2e_demo.py`
- `fill_notice_pdf.py`
- `DEMO_SCRIPT.md`
- `WHAT_WE_BUILT_TODAY.md` (this file)
- `../../skills/canvas/academic_notice_demo.skill.md`

Safe to delete (regenerated each run):
- `output/` directory
- `sample_data.json`
- `canvas_demo_profile/` directory
- `run_demo.mjs` (old version)

---

## Credits

Built for Summit Academy OIC Academic Notice PoC
Date: April 10, 2024
Purpose: Faculty demo of automated academic notice workflow

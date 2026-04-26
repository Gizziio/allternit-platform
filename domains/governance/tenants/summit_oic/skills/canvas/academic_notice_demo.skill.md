# summit.canvas.academic_notice_demo

Run the Summit Academy Academic Notice proof-of-concept end-to-end in live Canvas.

## Quick Demo Command

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/domains/governance/tenants/summit_oic/poc/academic_notices
rm -rf output/* canvas_demo_profile 2>/dev/null
python3 run_canvas_e2e_demo.py --headed
```

**Runtime:** ~21 seconds

## What the Demo Shows

### Phase 1: Live Student Generation (~2s)
```
[12:45:07 PM] Generated student 1: Jordan Anderson
  → Grade: 60.9% | Attendance: 81% | Missing: 4 | ⚠️ AT RISK
[12:45:07 PM] Generated student 2: Remy Donovan
  → Grade: 79.6% | Attendance: 96% | Missing: 4 | ✓ PASSING
...
```

### Phase 2: Notice Creation (~3s)
```
Generating notice for: Jordan Anderson
  → Current Grade: 60.9% (Threshold: 70%)
  → Filling SAOIC PDF template...
  ✓ Academic Notice PDF created
```

### Phase 3: Canvas Upload (~15s)
```
[12:45:12] Creating Canvas module
[12:45:12] Module created: Allternit Academic Notice Demo 1775843112
...
```

### Phase 4: Results Open
- Chrome: Canvas modules page
- Preview: Academic notice PDFs

## Demo Parameters

| Parameter | Value |
|-----------|-------|
| Program | IT Support Specialist |
| Course | IT Fundamentals Phase 1 |
| Week Milestone | Week 3 |
| Passing Threshold | 70% |
| Template | SAOIC Academic Status Notification |
| Email Recipients | Student + Program Manager + Advisor + Registrar |

## Key Features

- **Fresh data every run** - New random students generated live
- **Smart filtering** - Only at-risk students (below 70%) get notices
- **Real PDFs** - Institutional SAOIC template populated with data
- **Live Canvas** - Actually creates modules, uploads files
- **No hang** - `--headed` opens browser but completes immediately

## Prerequisites

Credential file at:
```
~/.config/allternit/canvas_academic_notice_demo.env
```

Contents:
```
CANVAS_LOGIN_EMAIL=cartlidge.joseph@proton.me
CANVAS_LOGIN_PASSWORD=Finesse1
CANVAS_COURSE_ID=14389375
CANVAS_BASE_URL=https://canvas.instructure.com
```

## Documentation

- `DEMO_SCRIPT.md` - Quick reference
- `WHAT_WE_BUILT_TODAY.md` - Complete project documentation
- `CANVAS_ACADEMIC_NOTICE_FLOW.md` - Feature spec pointer

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Browser won't open | `open https://canvas.instructure.com/courses/14389375/modules` |
| PDFs won't open | `open output/notices/*/academic_notice.pdf` |
| Script timeout | Kill processes: `pkill -9 -f "Chrome for Testing"` |

## LLM Agent Instructions

When user says "run the academic notice flow":

1. Execute the quick demo command above
2. Wait for completion (~21 seconds)
3. Open PDFs if not auto-opened
4. Report the students generated and their status

**Do NOT use `--keep-open`** (causes hang). Use `--headed` only.

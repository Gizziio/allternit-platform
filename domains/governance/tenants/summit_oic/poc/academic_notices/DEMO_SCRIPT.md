# Academic Notice Demo - Quick Run Guide

## What This Demo Shows

1. **Generates 4 random students** with different grades/attendance (LIVE)
2. **Identifies at-risk students** below 70% threshold (LIVE)
3. **Creates academic notice PDFs** from institutional template (LIVE)
4. **Uploads everything to Canvas** module + summary page + PDFs
5. **Opens browser + PDFs** for presentation

## Quick Start (For Demo Recording)

```bash
# Clean run - generates NEW students every time
cd /Users/macbook/Desktop/allternit-workspace/allternit/domains/governance/tenants/summit_oic/poc/academic_notices
rm -rf output/* canvas_demo_profile 2>/dev/null
python3 run_canvas_e2e_demo.py --headed

# Open the PDFs after (if not auto-opened)
open output/notices/*/academic_notice.pdf
```

## Demo Flow (What Audience Sees)

### Phase 1: Live Generation (~10 seconds)
```
[11:24:48 AM] Generated student 1: Quinn Grayson
  → Grade: 92.4% | Attendance: 85% | Missing: 2 | ✓ PASSING

[11:24:48 AM] Generated student 2: Riley Morrison
  → Grade: 55% | Attendance: 79% | Missing: 4 | ⚠️ AT RISK
...

Generating notice for: Riley Morrison
  → Grade: 55% (below 70%)
  → Filling PDF template...
  ✓ Created: .../academic_notice.pdf
```

### Phase 2: Canvas Upload (~15 seconds)
```
[11:24:53] Authenticating with Canvas
[11:24:53] Creating Canvas module
[11:24:54] Module created: Allternit Academic Notice Demo 1775838293
...
✓ Demo completed successfully!
```

### Phase 3: Browser Opens
- Chrome: Canvas modules page (new demo module visible)
- Preview: Both academic notice PDFs (filled with student data)

## Key Talking Points

1. **"These are FRESH students generated just now"**
   - Different names every run
   - Random grades/attendance
   - Shows system flexibility

2. **"Only at-risk students get notices"**
   - Passing threshold: 70%
   - System automatically filters
   - Missing assignments tracked

3. **"Real institutional PDF template"**
   - Fillable PDF populated with student data
   - Professional format for faculty
   - Downloadable/printable

4. **"Live Canvas integration"**
   - Creates module automatically
   - Uploads files to course
   - Faculty can access immediately

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Browser doesn't open | Run: `open https://canvas.instructure.com/courses/14389375/modules` |
| PDFs don't open | Run: `open output/notices/*/academic_notice.pdf` |
| Script hangs | Cancel (Ctrl+C), kill Chrome, re-run |
| Canvas login fails | Check `~/.config/allternit/canvas_academic_notice_demo.env` |

## Demo Credentials (Already Configured)

File: `~/.config/allternit/canvas_academic_notice_demo.env`
- Email: cartlidge.joseph@proton.me
- Password: Finesse1
- Course: 14389375

## Expected Runtime

- Total: ~25 seconds
- Student generation: ~2 seconds
- PDF creation: ~3 seconds  
- Canvas upload: ~15 seconds
- Browser open: ~5 seconds

## Post-Demo Cleanup (Optional)

```bash
# Delete old demo modules from Canvas (manual via UI)
# Or leave them - course is for testing
```

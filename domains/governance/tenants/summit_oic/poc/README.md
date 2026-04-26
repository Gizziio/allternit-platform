# Summit OIC PoC Bundle

This folder contains meeting-ready proof-of-concept materials for the Summit Academy OIC tenant.

## Priority for today's meeting

1. `academic_notices`
2. `new_term_course_prep`

## What is included

- runnable demo scripts with safe sample data
- generated output artifacts
- meeting prep notes
- a lightweight demo video generated from the demo logs

## Run the demos

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/domains/governance/tenants/summit_oic/poc
node academic_notices/run_demo.mjs
node new_term_course_prep/run_demo.mjs
python3 render_demo_video.py
```

## Output locations

- `academic_notices/output/`
- `new_term_course_prep/output/`
- `meeting/TODAYS_MEETING_PREP.md`
- `meeting/ACCOMPLISHMENTS_AND_NEXT_STEPS.md`
- `demo_video/todays_poc_demo.mp4`

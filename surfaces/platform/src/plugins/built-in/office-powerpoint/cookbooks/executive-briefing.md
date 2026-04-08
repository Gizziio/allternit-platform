# Cookbook: Executive Briefing Deck

## Prerequisites
- A topic or situation you need to brief leadership on
- Key data points or decisions to communicate

---

## What Is an Executive Briefing Deck?

A 5–7 slide deck designed for a 10-minute leadership briefing. Structure is fixed:
1. **Title + Agenda** — topic and what will be covered
2. **Situation** — current state, context, why this matters now
3. **Key Metrics** — the numbers that tell the story
4. **Analysis / Findings** — what the data means, root causes
5. **Recommendations** — 2-3 actionable next steps
6. **Decision Required** — specific ask from leadership
7. **(Optional) Appendix** — supporting detail for questions

---

## Step 1: Generate the Structure

**Command**: `ppt:outline` → "Create a 6-slide executive briefing on [topic]"

Specify the topic with enough context:
```
"Create a 6-slide executive briefing on Q3 churn spike:
- Churn increased from 3% to 7% in Q3
- Primary cause: enterprise segment price increase in August
- Need approval for a 3-month retention credit program ($450K cost)"
```

---

## Step 2: Populate Metrics Slide

**Command**: `ppt:slide` → "update slide 3 with these key metrics"

```
Title: Key Metrics
- Monthly churn rate: 7.2% (was 3.1% in Q2)
- Customers at risk: 47 enterprise accounts ($2.1M ARR)
- Churn to date in Q3: 12 accounts ($380K ARR lost)
- If unaddressed (projected): $1.8M ARR at risk by Q4 end
```

Format metrics as large numbers with labels (not bullet points) using the data slide layout from `slide-from-data` cookbook.

---

## Step 3: Build Analysis Slide

**Command**: `ppt:rewrite` → "make slide 4 (Analysis) lead with the root cause"

Structure for analysis:
```
Title: What Happened
• Root cause: 18% price increase in August affected enterprise tier
• Compound factor: Competing solution launched at 30% lower price point
• Customer feedback: 34 of 47 at-risk accounts cited "value perception"
• Timeline: Churn accelerated in weeks 6-8 post-price change
```

---

## Step 4: Recommendations Slide

**Command**: `ppt:rewrite` → "make slide 5 more direct — lead with each recommendation as an action verb"

Best practice for recommendations:
```
Title: Recommended Actions
1. APPROVE 3-month retention credit (25% of ARR) for at-risk accounts → $450K cost, protects $2.1M ARR
2. DELAY enterprise price increase for renewals due in Q4 → 90-day reprieve while redesigning value prop
3. LAUNCH win-back campaign for churned accounts → 30-day window while accounts evaluate alternatives
```

---

## Step 5: Generate Speaker Notes

**Command**: `ppt:notes` → "generate speaker notes for executive audience"

AI generates notes with:
- Pre-read: what to say before showing each slide
- Key numbers to emphasize verbally
- Likely questions from leadership and suggested responses
- Time allocation (target: 2 min/slide for a 10-min briefing)

Example notes for Metrics slide:
```
"Start with the headline: 'We have 47 enterprise accounts — $2.1M in ARR — that are actively considering leaving.' 
Pause. Let that land. Then walk through the four numbers left-to-right.
Expected question: 'How many have already churned?' → Answer: 12, representing $380K.
Time: ~2 minutes. Do NOT go to appendix unless asked."
```

---

## Step 6: Apply Branding

**Command**: `ppt:design` → "apply executive briefing style — minimal, professional"

For executive briefings:
- Cover slide: dark background (`#2A1F16`), white title
- Content slides: white background or very light sand (`#FDF8F3`)
- No decorative shapes — data and text only
- Large font sizes (32pt titles, 20pt body minimum)

---

## Step 7: Final Review

**Command**: `ppt:summarize`

Verify:
- [ ] One clear message per slide
- [ ] Recommendations are specific and actionable (have a verb + number + outcome)
- [ ] Slide 6 has a clear decision request: "We need a Yes/No on X by [date]"
- [ ] Appendix (if included) is separate from the main 6 slides
- [ ] Speaker notes cover likely objections

---

## Executive Communication Principles
- **Bottom line up front**: Put the conclusion on slide 1, not slide 6
- **Numbers before text**: Lead bullets with the metric, then explain
- **One ask**: End with a single, specific decision request
- **No slides with >7 bullets**: If you have more, split into two slides

# A://labs Integration Guide

## Overview

This guide provides step-by-step instructions for integrating the **Agentic Intelligence & ML** course into the A://labs platform.

---

## Prerequisites

- [ ] Administrator access to A://labs
- [ ] Course shell created with code `A://AI-101`
- [ ] allternit branding assets available
- [ ] Student enrollment configured

---

## Integration Steps

### Step 1: Create Course Shell

```
A://labs Admin Panel → Courses → Create New
```

**Course Settings:**
- **Course Code:** `A://AI-101`
- **Course Name:** `Agentic Intelligence & Machine Learning`
- **Category:** `AI & Agentic Systems`
- **Visibility:** `Published`
- **Enrollment:** `Open` or `Invite-only`

### Step 2: Configure Home Page

1. Navigate to **Pages → Home**
2. Switch to **HTML Editor** mode
3. Copy content from `home-page.html`
4. Replace `[COURSE_ID]` with actual course ID
5. Save and publish

**Home Page Features:**
- allternit branded hero section
- Course overview with module preview
- Quick navigation to Syllabus, Modules, Protocol Forum
- allternit gradient CTA section

### Step 3: Set Up Syllabus

1. Navigate to **Assignments → Syllabus**
2. Create new page with HTML content from `syllabus.html`
3. Configure assessment weights (see table below)
4. Link to course policies

**Assessment Weights:**
| Component | Weight |
|-----------|--------|
| Module Quizzes | 20% |
| Hands-on Labs | 20% |
| Assignments | 20% |
| Protocol Forum | 15% |
| Agentic Capstone | 25% |

### Step 4: Create Resources Page

1. Navigate to **Pages → Resources**
2. Copy content from `resources.html`
3. Update any platform-specific links
4. Add allternit protocol resources section

### Step 5: Build Modules

For each of the 6 modules:

#### Module 1: Foundations of AI
```
Module Name: Module 1: Foundations of AI
Prerequisites: None
Time Estimate: 4-5 hours
Color Code: #00d4ff (Cyan)
```

**Items to add:**
1. Page: "Module 1 Overview" (copy from `module-01-overview.html`)
2. Page: "1.1 What is AI?" (copy from `module-01-full.html`)
3. Page: "1.2 History of AI" (copy from `module-01-full.html`)
4. Page: "1.3 Types of AI" (copy from `module-01-full.html`)
5. Page: "1.4 Environment Setup" (custom for A://labs)
6. Discussion: "Protocol Introductions"
7. Quiz: "Module 1 Quiz" (10 questions from `module-01-quiz.md`)

#### Module 2: Machine Learning Basics
```
Module Name: Module 2: Machine Learning Basics
Prerequisites: Module 1
Time Estimate: 5-6 hours
Color Code: #8338ec (Purple)
```

**Items to add:**
1. Page: "Module 2 Overview"
2. Page: "2.1 The ML Workflow"
3. Page: "2.2 Data Preparation"
4. Page: "2.3 Evaluation Metrics"
5. Discussion: "Real-World ML Applications"
6. Assignment: "Lab: Iris Dataset" (Jupyter notebook)
7. Quiz: "Module 2 Quiz" (10 questions)

#### Module 3: Supervised Learning
```
Module Name: Module 3: Supervised Learning
Prerequisites: Module 2
Time Estimate: 6-7 hours
Color Code: #ff006e (Magenta)
```

**Items to add:**
1. Page: "Module 3 Overview"
2. Page: "3.1 Linear Regression"
3. Page: "3.2 Logistic Regression"
4. Page: "3.3 Decision Trees"
5. Page: "3.4 Ensemble Methods"
6. Discussion: "Interpretability vs Performance"
7. Assignment: "Housing Price Prediction" (100 pts)
8. Quiz: "Module 3 Quiz" (12 questions)

#### Module 4: Neural Networks
```
Module Name: Module 4: Neural Networks
Prerequisites: Module 3
Time Estimate: 7-8 hours
Color Code: #ffbe0b (Yellow)
```

**Items to add:**
1. Page: "Module 4 Overview"
2. Page: "4.1 Biological Inspiration"
3. Page: "4.2 The Perceptron"
4. Page: "4.3 Multi-Layer Networks"
5. Page: "4.4 Backpropagation"
6. Page: "4.5 Activation Functions"
7. Page: "4.6 TensorFlow & Keras"
8. Discussion: "The Black Box Problem"
9. Assignment: "Lab: NN from Scratch" (75 pts)
10. Assignment: "Digit Recognition" (100 pts)
11. Quiz: "Module 4 Quiz" (15 questions)

#### Module 5: Deep Learning
```
Module Name: Module 5: Deep Learning
Prerequisites: Module 4
Time Estimate: 8-9 hours
Color Code: #06ffa5 (Green)
```

**Items to add:**
1. Page: "Module 5 Overview"
2. Page: "5.1 The Deep Learning Revolution"
3. Page: "5.2 CNNs for Computer Vision"
4. Page: "5.3 RNNs for Sequences"
5. Page: "5.4 Regularization"
6. Page: "5.5 Transfer Learning"
7. Page: "5.6 PyTorch"
8. Discussion: "Deep Learning Applications"
9. Assignment: "Lab: CNN Image Classification" (100 pts)
10. Assignment: "Sentiment with RNNs" (100 pts)
11. Quiz: "Module 5 Quiz" (15 questions)

#### Module 6: NLP & Transformers
```
Module Name: Module 6: NLP & Transformers
Prerequisites: Module 5
Time Estimate: 8-10 hours
Color Code: #ffffff (White)
```

**Items to add:**
1. Page: "Module 6 Overview"
2. Page: "6.1 NLP Fundamentals"
3. Page: "6.2 Word Embeddings"
4. Page: "6.3 Attention Mechanisms"
5. Page: "6.4 The Transformer"
6. Page: "6.5 BERT & Modern NLP"
7. Page: "6.6 Generative AI & Ethics"
8. Discussion: "AI Ethics & Responsibility"
9. Assignment: "Lab: Fine-tuning BERT" (100 pts)
10. Assignment: "Agentic Capstone Project" (250 pts)
11. Quiz: "Module 6 Quiz" (15 questions)

### Step 6: Configure Discussions

Create 6 discussion topics:

1. **Module 1:** "Protocol Introductions"
   - Prompt: Share your background and AI interests
   
2. **Module 2:** "Real-World ML Applications"
   - Prompt: Share ML examples you encounter daily
   
3. **Module 3:** "Interpretability vs Performance"
   - Prompt: When to choose simple vs complex models
   
4. **Module 4:** "The Black Box Problem"
   - Prompt: How much should we care about interpretability?
   
5. **Module 5:** "Deep Learning Applications"
   - Prompt: Share interesting use cases you've found
   
6. **Module 6:** "AI Ethics & Responsibility"
   - Prompt: Discuss bias, safety, and responsible AI

**Discussion Settings:**
- Require initial post before viewing replies
- Minimum word count: 150 words
- Require 2 replies to classmates
- Grade: Complete/Incomplete

### Step 7: Set Up Quizzes

For each module quiz:

**Settings:**
- Time limit: 20-30 minutes
- Attempts allowed: 2
- Passing score: 70%
- Shuffle questions: Yes
- Show correct answers: After last attempt

**Question Distribution:**
| Module | Questions | Time |
|--------|-----------|------|
| 1 | 10 | 20 min |
| 2 | 10 | 20 min |
| 3 | 12 | 25 min |
| 4 | 15 | 30 min |
| 5 | 15 | 30 min |
| 6 | 15 | 30 min |

### Step 8: Configure Assignments

**Lab Assignments:**
- Lab: Iris Dataset (Module 2) - 50 pts
- Lab: NN from Scratch (Module 4) - 75 pts
- Lab: CNN Image Classification (Module 5) - 100 pts
- Lab: Fine-tuning BERT (Module 6) - 100 pts
- Lab: Additional (Module 5) - 100 pts

**Project Assignments:**
- Housing Price Prediction (Module 3) - 100 pts
- Digit Recognition (Module 4) - 100 pts
- Sentiment with RNNs (Module 5) - 100 pts
- Agentic Capstone (Module 6) - 250 pts

**Submission Types:**
- Jupyter notebooks (.ipynb)
- Python scripts (.py)
- Project reports (PDF)
- Demo videos (optional)

### Step 9: Configure Gradebook

Set up assignment groups:

```
Quizzes (20%)
├── Module 1 Quiz
├── Module 2 Quiz
├── Module 3 Quiz
├── Module 4 Quiz
├── Module 5 Quiz
└── Module 6 Quiz

Labs (20%)
├── Iris Dataset Lab
├── NN from Scratch Lab
├── CNN Lab
├── BERT Lab
└── Additional Lab

Projects (20%)
├── Housing Prices
├── Digit Recognition
└── Sentiment Analysis

Forum (15%)
└── Discussion Participation

Capstone (25%)
└── Agentic System Project
```

### Step 10: Test & Launch

**Pre-Launch Checklist:**
- [ ] All pages load correctly
- [ ] HTML renders properly
- [ ] All links work
- [ ] Quizzes function correctly
- [ ] File uploads work
- [ ] Gradebook calculates correctly
- [ ] Mobile view tested
- [ ] allternit branding consistent

**Soft Launch:**
1. Enroll test users
2. Have them complete Module 1
3. Gather feedback
4. Make adjustments

**Full Launch:**
1. Open enrollment
2. Send announcement
3. Monitor forum activity
4. Track completion rates

---

## Brand Compliance Checklist

### Visual Elements
- [ ] Primary color: `#00d4ff` (cyan)
- [ ] Secondary color: `#8338ec` (purple)
- [ ] Accent color: `#ff006e` (magenta)
- [ ] Success color: `#06ffa5` (green)
- [ ] Background: `#0a0a0f` or `#12121a`
- [ ] Text: `#ffffff` (primary), `#a0a0b0` (secondary)
- [ ] Borders: `#2a2a3e`

### Content Standards
- [ ] Platform referred to as "A://labs"
- [ ] Protocol referred to as "allternit protocol"
- [ ] Course code: "A://AI-101"
- [ ] "Agentic systems" terminology used
- [ ] "Protocol Forum" for discussions
- [ ] "A:// messaging" for private communication

### UI Components
- [ ] Buttons use cyan gradient or transparent with cyan border
- [ ] Cards use `#12121a` background
- [ ] Code blocks use dark theme
- [ ] Module badges are color-coded
- [ ] Gradients follow brand specs

---

## Automation Script

Use the included script for bulk import:

```bash
# Install dependencies
npm install @playwright/test

# Run import
node canvas-import.js \
  --email admin@allternit.protocol \
  --password YOUR_PASSWORD \
  --courseId 12345 \
  --baseUrl https://labs.allternit.protocol
```

**Environment Variables:**
```bash
export CANVAS_EMAIL=admin@allternit.protocol
export CANVAS_PASSWORD=your_password
export CANVAS_COURSE_ID=12345
```

---

## Post-Integration

### Week 1 Monitoring
- Monitor student enrollment
- Check for technical issues
- Respond to forum posts
- Verify quiz functionality

### Ongoing Maintenance
- Update content quarterly
- Refresh external links
- Add new resources
- Review assessment analytics

---

## Support Contacts

**Technical Issues:** A://labs Support
**Content Questions:** Course Forum
**Brand Guidelines:** ALLTERNIT_BRAND.md

---

*Last updated: 2026-04-12*
*Version: 1.0.0*
*Protocol: allternit v1.0*

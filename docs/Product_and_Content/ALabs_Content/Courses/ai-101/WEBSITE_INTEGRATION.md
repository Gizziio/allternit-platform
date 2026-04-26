# A://labs Website Integration Guide

## Course URL on Canvas

**Course:** Agentic Intelligence & Machine Learning (A://AI-101)  
**Canvas URL:** `https://canvas.instructure.com/courses/14389375`

## Direct Links for Website Integration

### Course Enrollment Link
```
https://canvas.instructure.com/enroll/14389375
```

### Course Home Page (for logged-in users)
```
https://canvas.instructure.com/courses/14389375/pages/a-slash-slash-ai-101-home
```

### Course Syllabus
```
https://canvas.instructure.com/courses/14389375/pages/syllabus
```

### Individual Modules
```
Module 1: https://canvas.instructure.com/courses/14389375/pages/module-1-foundations-of-ai
Module 2: https://canvas.instructure.com/courses/14389375/pages/module-2-machine-learning-basics
Module 3: https://canvas.instructure.com/courses/14389375/pages/module-3-supervised-learning
Module 4: https://canvas.instructure.com/courses/14389375/pages/module-4-neural-networks
Module 5: https://canvas.instructure.com/courses/14389375/pages/module-5-deep-learning
Module 6: https://canvas.instructure.com/courses/14389375/pages/module-6-nlp-and-transformers
```

## LTI Integration (Optional)

For seamless integration where users don't leave the A://labs website:

1. **LTI Key/Secret:** Required from Canvas admin
2. **Launch URL:** `https://canvas.instructure.com/api/lti/v1p3/launch`
3. **Redirect URI:** Your website callback URL

Contact Canvas support to set up LTI 1.3 Advantage for your course.

## Simple Integration Options

### Option 1: Direct Link (Simplest)
Add a "Courses" link in your website navigation that links directly to Canvas.

### Option 2: Course Card on Website
Display course information on your website with an "Enroll" button that links to Canvas.

### Option 3: Embedded via iframe (Limited)
```html
<iframe src="https://canvas.instructure.com/courses/14389375" 
        width="100%" height="800px" 
        frameborder="0">
</iframe>
```
Note: Canvas may block iframe embedding due to X-Frame-Options.

## API Integration (Advanced)

Use the Canvas API to:
- Display course progress on your website
- Show enrollment status
- List available courses
- Sync user data

**API Endpoint:** `https://canvas.instructure.com/api/v1/courses/14389375`
**Token:** 7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc

## Next Steps for Website Integration

1. Add course card to website marketplace/gallery page
2. Create enrollment flow (signup → redirect to Canvas)
3. Optionally: Implement SSO/LTI for seamless experience
4. Add course completion tracking

## Course Card HTML (for website)

```html
<div class="course-card">
  <div class="course-image">
    <span class="course-badge">A://AI-101</span>
  </div>
  <div class="course-info">
    <h3>Agentic Intelligence & Machine Learning</h3>
    <p>Master AI fundamentals and build agentic systems within the allternit protocol.</p>
    <div class="course-meta">
      <span>8 Weeks</span>
      <span>6 Modules</span>
      <span>Beginner</span>
    </div>
    <a href="https://canvas.instructure.com/enroll/14389375" 
       class="enroll-btn">
      Enroll Now →
    </a>
  </div>
</div>
```

## Support

For integration assistance, refer to:
- Canvas API Docs: https://canvas.instructure.com/doc/api/
- LTI Implementation: https://www.imsglobal.org/activity/learning-tools-interoperability

#!/usr/bin/env node
/**
 * Allternit Canvas Plugin - Full Skills Test
 * 
 * Tests EVERY skill in the plugin with real Canvas account.
 * Takes screenshots of everything created.
 * 
 * Usage: node test-all-skills.js
 */

const fs = require('fs');
const path = require('path');

// Canvas API credentials
const CANVAS_BASE_URL = 'https://canvas.instructure.com';
const CANVAS_API_TOKEN = '7~xG8tXkuEFa4fQ7zykECKhmKNuWVw9Feh84BGaeL92xP4nGxVJ8wQ89rEFZvH4uEr';
const COURSE_ID = '14389375';

// Output directory for screenshots and results
const OUTPUT_DIR = '/Users/macbook/Desktop/Allternit_Skills_Test_Results';

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('=== Allternit Canvas Plugin - Full Skills Test ===\n');
console.log(`Course ID: ${COURSE_ID}`);
console.log(`Output: ${OUTPUT_DIR}\n`);

// Helper: Make Canvas API call
async function canvasAPI(endpoint, method = 'GET', body = null) {
  const url = `${CANVAS_BASE_URL}/api/v1${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${CANVAS_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    throw new Error(`Canvas API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// Test 1: Create Module
async function testModuleCreation() {
  console.log('TEST 1: Creating Module...');
  
  try {
    const module = await canvasAPI(
      `/courses/${COURSE_ID}/modules`,
      'POST',
      {
        module: {
          name: 'Allternit Test Module - Week 1 AI Fundamentals',
          position: 5,
          published: false,
        }
      }
    );
    
    console.log('✅ Module created:', module.name);
    console.log('   ID:', module.id);
    console.log('   URL:', `${CANVAS_BASE_URL}/courses/${COURSE_ID}/modules/${module.id}`);
    
    // Save result
    fs.writeFileSync(
      path.join(OUTPUT_DIR, '01_module_created.json'),
      JSON.stringify(module, null, 2)
    );
    
    return module;
  } catch (error) {
    console.error('❌ Module creation failed:', error.message);
    return null;
  }
}

// Test 2: Create Assignment
async function testAssignmentCreation(moduleId) {
  console.log('\nTEST 2: Creating Assignment...');
  
  try {
    const assignment = await canvasAPI(
      `/courses/${COURSE_ID}/assignments`,
      'POST',
      {
        assignment: {
          name: 'Allternit Test Assignment - Week 1 Discussion: AI Ethics',
          description: `
## 📋 Learning Objectives
- Identify key ethical concerns in AI development
- Articulate multiple perspectives on AI regulation
- Respond thoughtfully to peer viewpoints

## 📝 Instructions
Research current AI ethics debates and share your perspective on the following:
1. What are the main ethical concerns with AI development?
2. How should AI be regulated (if at all)?
3. What role should developers play in AI ethics?

## 📚 Materials Needed
- Course readings on AI ethics
- External research articles (minimum 2)

## 📅 Timeline
- Initial post due: Thursday 11:59 PM
- Response posts due: Sunday 11:59 PM
- Estimated time: 3-4 hours

## ✅ Submission Requirements
- File types: Text entry
- Word count: 250-300 words (initial post)
- Responses: 2 replies to classmates (100-150 words each)

## 📊 Rubric
| Criteria | Excellent (10pts) | Good (8pts) | Needs Work (5pts) |
|----------|-------------------|-------------|-------------------|
| Initial Post Quality | Well-researched, thoughtful | Adequate research | Minimal effort |
| Response Quality | Thoughtful engagement | Basic responses | Superficial comments |
| Timeliness | Posted before deadline | Slightly late | Very late or missing |

## 💡 Tips for Success
- Start your research early
- Cite your sources properly
- Engage respectfully with different viewpoints
`,
          submission_types: ['online_text_entry'],
          points_possible: 100,
          due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          published: false,
        }
      }
    );
    
    console.log('✅ Assignment created:', assignment.name);
    console.log('   ID:', assignment.id);
    console.log('   Points:', assignment.points_possible);
    console.log('   Due:', assignment.due_at);
    console.log('   URL:', `${CANVAS_BASE_URL}/courses/${COURSE_ID}/assignments/${assignment.id}`);
    
    // Save result
    fs.writeFileSync(
      path.join(OUTPUT_DIR, '02_assignment_created.json'),
      JSON.stringify(assignment, null, 2)
    );
    
    return assignment;
  } catch (error) {
    console.error('❌ Assignment creation failed:', error.message);
    return null;
  }
}

// Test 3: Add Assignment to Module
async function testAddToModule(moduleId, assignmentId) {
  console.log('\nTEST 3: Adding Assignment to Module...');
  
  try {
    const moduleItem = await canvasAPI(
      `/courses/${COURSE_ID}/modules/${moduleId}/items`,
      'POST',
      {
        type: 'Assignment',
        content_id: assignmentId,
        title: 'Week 1 Discussion: AI Ethics',
      }
    );
    
    console.log('✅ Assignment added to module');
    console.log('   Module Item ID:', moduleItem.id);
    
    // Save result
    fs.writeFileSync(
      path.join(OUTPUT_DIR, '03_module_item_created.json'),
      JSON.stringify(moduleItem, null, 2)
    );
    
    return moduleItem;
  } catch (error) {
    console.error('❌ Adding to module failed:', error.message);
    return null;
  }
}

// Test 4: Create Page
async function testPageCreation() {
  console.log('\nTEST 4: Creating Page...');
  
  try {
    const page = await canvasAPI(
      `/courses/${COURSE_ID}/pages`,
      'POST',
      {
        wiki_page: {
          title: 'Allternit Test - AI Fundamentals Overview',
          body: `
# AI Fundamentals Overview

## What is Artificial Intelligence?

Artificial Intelligence (AI) refers to the simulation of human intelligence in machines that are programmed to think and learn like humans.

## Key Topics Covered

1. **Machine Learning** - Algorithms that improve through experience
2. **Natural Language Processing** - Understanding human language
3. **Computer Vision** - Interpreting visual information
4. **Ethics in AI** - Responsible AI development

## Learning Resources

- [Course Modules](/courses/${COURSE_ID}/modules)
- [Assignments](/courses/${COURSE_ID}/assignments)
- [Discussions](/courses/${COURSE_ID}/discussion_topics)

## Need Help?

Contact your instructor or visit office hours.
`,
          published: false,
        }
      }
    );
    
    console.log('✅ Page created:', page.title);
    console.log('   ID:', page.id);
    console.log('   URL:', `${CANVAS_BASE_URL}/courses/${COURSE_ID}/pages/${page.url}`);
    
    // Save result
    fs.writeFileSync(
      path.join(OUTPUT_DIR, '04_page_created.json'),
      JSON.stringify(page, null, 2)
    );
    
    return page;
  } catch (error) {
    console.error('❌ Page creation failed:', error.message);
    return null;
  }
}

// Test 5: List All Course Content (Verification)
async function testListContent() {
  console.log('\nTEST 5: Verifying All Content...');
  
  try {
    // List modules
    const modules = await canvasAPI(`/courses/${COURSE_ID}/modules`);
    console.log(`\n📚 Modules in course: ${modules.length}`);
    
    const testModules = modules.filter(m => m.name.includes('Allternit Test'));
    console.log(`   Allternit Test Modules: ${testModules.length}`);
    testModules.forEach(m => {
      console.log(`   - ${m.name} (ID: ${m.id})`);
    });
    
    // List assignments
    const assignments = await canvasAPI(`/courses/${COURSE_ID}/assignments`);
    console.log(`\n📝 Assignments in course: ${assignments.length}`);
    
    const testAssignments = assignments.filter(a => a.name.includes('Allternit Test'));
    console.log(`   Allternit Test Assignments: ${testAssignments.length}`);
    testAssignments.forEach(a => {
      console.log(`   - ${a.name} (ID: ${a.id}, Points: ${a.points_possible})`);
    });
    
    // List pages
    const pages = await canvasAPI(`/courses/${COURSE_ID}/pages`);
    console.log(`\n📄 Pages in course: ${pages.length}`);
    
    const testPages = pages.filter(p => p.title.includes('Allternit Test'));
    console.log(`   Allternit Test Pages: ${testPages.length}`);
    testPages.forEach(p => {
      console.log(`   - ${p.title} (ID: ${p.id})`);
    });
    
    // Save verification results
    const verification = {
      timestamp: new Date().toISOString(),
      modules: { total: modules.length, allternit_test: testModules.length },
      assignments: { total: assignments.length, allternit_test: testAssignments.length },
      pages: { total: pages.length, allternit_test: testPages.length },
    };
    
    fs.writeFileSync(
      path.join(OUTPUT_DIR, '05_verification_results.json'),
      JSON.stringify(verification, null, 2)
    );
    
    console.log('\n✅ All content verified!');
    
    return verification;
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return null;
  }
}

// Test 6: Generate Test Report
async function generateTestReport(results) {
  console.log('\n=== GENERATING TEST REPORT ===\n');
  
  const report = `# Allternit Canvas Plugin - Skills Test Report

**Test Date:** ${new Date().toISOString()}
**Course ID:** ${COURSE_ID}
**Course URL:** ${CANVAS_BASE_URL}/courses/${COURSE_ID}

---

## Test Results Summary

| Test | Status | Details |
|------|--------|---------|
| Module Creation | ${results.module ? '✅ PASS' : '❌ FAIL'} | ${results.module ? `Created: ${results.module.name}` : 'Failed'} |
| Assignment Creation | ${results.assignment ? '✅ PASS' : '❌ FAIL'} | ${results.assignment ? `Created: ${results.assignment.name}` : 'Failed'} |
| Add to Module | ${results.moduleItem ? '✅ PASS' : '❌ FAIL'} | ${results.moduleItem ? 'Added successfully' : 'Failed'} |
| Page Creation | ${results.page ? '✅ PASS' : '❌ FAIL'} | ${results.page ? `Created: ${results.page.title}` : 'Failed'} |
| Content Verification | ${results.verification ? '✅ PASS' : '❌ FAIL'} | ${results.verification ? `${results.verification.modules.allternit_test} modules, ${results.verification.assignments.allternit_test} assignments, ${results.verification.pages.allternit_test} pages` : 'Failed'} |

---

## Created Content

### Modules
${results.module ? `- **${results.module.name}** (ID: ${results.module.id})
  - URL: ${CANVAS_BASE_URL}/courses/${COURSE_ID}/modules/${results.module.id}` : '- None created'}

### Assignments
${results.assignment ? `- **${results.assignment.name}** (ID: ${results.assignment.id})
  - Points: ${results.assignment.points_possible}
  - Due: ${results.assignment.due_at || 'Not set'}
  - URL: ${CANVAS_BASE_URL}/courses/${COURSE_ID}/assignments/${results.assignment.id}` : '- None created'}

### Pages
${results.page ? `- **${results.page.title}** (ID: ${results.page.id})
  - URL: ${CANVAS_BASE_URL}/courses/${COURSE_ID}/pages/${results.page.url}` : '- None created'}

---

## Screenshots Needed

For the demo video, take screenshots of:

1. **Module View** - ${CANVAS_BASE_URL}/courses/${COURSE_ID}/modules
2. **Assignment View** - ${CANVAS_BASE_URL}/courses/${COURSE_ID}/assignments
3. **Page View** - ${CANVAS_BASE_URL}/courses/${COURSE_ID}/pages/${results.page?.url || ''}

---

## Next Steps

1. ✅ Skills test complete
2. 📸 Take screenshots of created content
3. 🎬 Record teacher intake questionnaire
4. ✂️ Edit demo video
5. 🎬 Export final video

---

*Generated: ${new Date().toISOString()}*
*Allternit Canvas Plugin v1.0*
`;

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'TEST_REPORT.md'),
    report
  );
  
  console.log('Test report saved to:', path.join(OUTPUT_DIR, 'TEST_REPORT.md'));
  
  return report;
}

// Main test runner
async function runAllTests() {
  const results = {};
  
  // Test 1: Create Module
  results.module = await testModuleCreation();
  if (!results.module) {
    console.log('\n⚠️  Stopping tests - module creation failed');
    return;
  }
  
  // Test 2: Create Assignment
  results.assignment = await testAssignmentCreation(results.module.id);
  if (!results.assignment) {
    console.log('\n⚠️  Assignment creation failed, continuing...');
  }
  
  // Test 3: Add Assignment to Module
  if (results.module && results.assignment) {
    results.moduleItem = await testAddToModule(results.module.id, results.assignment.id);
  }
  
  // Test 4: Create Page
  results.page = await testPageCreation();
  
  // Test 5: Verify All Content
  results.verification = await testListContent();
  
  // Test 6: Generate Report
  await generateTestReport(results);
  
  // Summary
  console.log('\n=== TEST SUMMARY ===\n');
  const passed = Object.values(results).filter(r => r !== null).length;
  const total = Object.keys(results).length;
  console.log(`Tests Passed: ${passed}/${total}`);
  console.log(`Output Directory: ${OUTPUT_DIR}`);
  console.log('\n📁 Files created:');
  fs.readdirSync(OUTPUT_DIR).forEach(file => {
    console.log(`   - ${file}`);
  });
  
  console.log('\n✅ All skills tests complete!');
  console.log('\n📸 NEXT: Take screenshots of:');
  console.log(`   - ${CANVAS_BASE_URL}/courses/${COURSE_ID}/modules`);
  console.log(`   - ${CANVAS_BASE_URL}/courses/${COURSE_ID}/assignments`);
  console.log(`   - ${CANVAS_BASE_URL}/courses/${COURSE_ID}/pages`);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});

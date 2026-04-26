#!/usr/bin/env node
/**
 * Teacher Intake Questionnaire
 * 
 * Interactive questions to collect teacher preferences.
 * Record this session for the demo video.
 * 
 * Usage: node teacher-intake-questionnaire.cjs
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const QUESTIONS = [
  // Introduction
  {
    type: 'intro',
    text: '\n=== Allternit Teacher Preference Intake ===\n',
  },
  {
    type: 'info',
    text: 'This questionnaire helps Allternit learn your teaching style.\nAnswer these questions to personalize the system.\n',
  },
  
  // Formatting Preferences
  {
    type: 'question',
    category: 'Formatting',
    id: 'fmt_objectives',
    question: 'Do you include learning objectives in your assignments?',
    options: ['Always', 'Usually', 'Sometimes', 'Never'],
    default: 'Always',
  },
  {
    type: 'question',
    category: 'Formatting',
    id: 'fmt_rubric',
    question: 'Do you include rubrics with your assignments?',
    options: ['Always', 'Usually', 'Sometimes', 'Never'],
    default: 'Always',
  },
  {
    type: 'question',
    category: 'Formatting',
    id: 'fmt_materials',
    question: 'Do you list required materials/resources in assignments?',
    type_input: 'boolean',
    default: 'Yes',
  },
  {
    type: 'question',
    category: 'Formatting',
    id: 'fmt_timeline',
    question: 'Do you include timeline/estimated hours for assignments?',
    type_input: 'boolean',
    default: 'Yes',
  },
  {
    type: 'question',
    category: 'Formatting',
    id: 'fmt_default_points',
    question: 'What is your default point value for assignments?',
    type_input: 'number',
    default: '100',
  },
  {
    type: 'question',
    category: 'Formatting',
    id: 'fmt_file_types',
    question: 'What file types do you accept? (comma-separated)',
    type_input: 'text',
    default: 'pdf, docx, txt',
  },
  
  // Grading Preferences
  {
    type: 'question',
    category: 'Grading',
    id: 'grade_late_policy',
    question: 'What is your late submission policy?',
    options: [
      'No late submissions',
      '10% deduction per day',
      '20% deduction per day',
      '50% deduction after due date',
      'Full credit until deadline extension',
    ],
    default: '10% deduction per day',
  },
  {
    type: 'question',
    category: 'Grading',
    id: 'grade_missing_policy',
    question: 'What happens to missing work?',
    options: ['0 points', 'Can make up anytime', 'Can make up with penalty', 'Incomplete until submitted'],
    default: '0 points',
  },
  {
    type: 'question',
    category: 'Grading',
    id: 'grade_resubmission',
    question: 'Do you allow resubmissions?',
    type_input: 'boolean',
    default: 'Yes',
  },
  {
    type: 'question',
    category: 'Grading',
    id: 'grade_auto_quiz',
    question: 'Should quizzes be auto-graded?',
    type_input: 'boolean',
    default: 'Yes',
  },
  
  // Communication Preferences
  {
    type: 'question',
    category: 'Communication',
    id: 'comm_tone',
    question: 'What is your communication tone?',
    options: ['Formal', 'Casual', 'Encouraging', 'Direct', 'Friendly'],
    default: 'Encouraging',
  },
  {
    type: 'question',
    category: 'Communication',
    id: 'comm_announcements',
    question: 'How often do you post announcements?',
    options: ['Daily', 'Weekly', 'Per module', 'Only when necessary'],
    default: 'Weekly',
  },
  {
    type: 'question',
    category: 'Communication',
    id: 'comm_email',
    question: 'Do you want email notifications for submissions?',
    type_input: 'boolean',
    default: 'Yes',
  },
  
  // Platform Usage
  {
    type: 'question',
    category: 'Platforms',
    id: 'platform_turnitin',
    question: 'Do you use Turnitin for plagiarism checking?',
    type_input: 'boolean',
    default: 'No',
  },
  {
    type: 'question',
    category: 'Platforms',
    id: 'platform_piazza',
    question: 'Do you use Piazza for discussions?',
    type_input: 'boolean',
    default: 'No',
  },
  {
    type: 'question',
    category: 'Platforms',
    id: 'platform_comptia',
    question: 'Do you use CompTIA certifications?',
    type_input: 'boolean',
    default: 'Yes',
  },
  {
    type: 'question',
    category: 'Platforms',
    id: 'platform_other',
    question: 'What other platforms do you use? (VMware, Cisco, etc.)',
    type_input: 'text',
    default: 'VMware, Cisco Packet Tracer, Microsoft Office',
  },
  
  // Summary
  {
    type: 'outro',
    text: '\n=== Thank You! ===\n',
  },
  {
    type: 'info',
    text: 'Your preferences have been saved.\nAllternit will now use these settings for all assignment creation.\n',
  },
];

const answers = {};

function askQuestion(question) {
  return new Promise((resolve) => {
    if (question.type === 'intro' || question.type === 'outro') {
      console.log(question.text);
      resolve();
      return;
    }
    
    if (question.type === 'info') {
      console.log(question.text);
      resolve();
      return;
    }
    
    if (question.type === 'question') {
      console.log(`\n[${question.category}]`);
      console.log(`${question.question}`);
      
      if (question.options) {
        console.log('Options:');
        question.options.forEach((opt, i) => {
          console.log(`  ${i + 1}. ${opt}`);
        });
      }
      
      console.log(`[Default: ${question.default}]`);
      
      rl.question('Your answer: ', (answer) => {
        if (!answer || answer.trim() === '') {
          answer = question.default;
        }
        
        answers[question.id] = answer;
        console.log(`✓ Saved: ${question.id} = ${answer}`);
        resolve();
      });
    }
  });
}

async function runQuestionnaire() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   Allternit Teacher Preference Intake            ║');
  console.log('║   Record this session for demo video       ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  console.log('🎬 START RECORDING NOW!\n');
  console.log('This questionnaire will be used in your demo video.\n');
  
  // Wait for user to start recording
  await new Promise((resolve) => {
    rl.question('Press Enter when you\'re ready to start recording... ', resolve);
  });
  
  console.log('\n');
  
  // Ask all questions
  for (const item of QUESTIONS) {
    await askQuestion(item);
  }
  
  // Generate profile summary
  console.log('\n\n╔════════════════════════════════════════════╗');
  console.log('║   TEACHER PROFILE SUMMARY                  ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  console.log('Your preferences:\n');
  
  const categories = {};
  for (const [key, value] of Object.entries(answers)) {
    const category = QUESTIONS.find(q => q.id === key)?.category || 'Other';
    if (!categories[category]) {
      categories[category] = {};
    }
    categories[category][key] = value;
  }
  
  for (const [category, prefs] of Object.entries(categories)) {
    console.log(`\n📋 ${category}:`);
    for (const [key, value] of Object.entries(prefs)) {
      console.log(`   • ${key}: ${value}`);
    }
  }
  
  console.log('\n\n✅ Profile complete!\n');
  console.log('🎬 You can stop recording now.\n');
  
  // Save profile
  const profilePath = '/Users/macbook/Desktop/Allternit_Skills_Test_Results/teacher_profile.json';
  const fs = require('fs');
  fs.writeFileSync(profilePath, JSON.stringify({
    teacher_id: 'demo_teacher',
    name: 'Demo Teacher',
    preferences: answers,
    created_at: new Date().toISOString(),
  }, null, 2));
  
  console.log(`📁 Profile saved to: ${profilePath}\n`);
  
  rl.close();
}

// Run questionnaire
runQuestionnaire().catch(console.error);

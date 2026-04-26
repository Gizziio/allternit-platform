#!/usr/bin/env node
/**
 * Generate fresh demo students on the fly for live demo
 * Shows the generation process so it looks real-time
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const root = path.dirname(new URL(import.meta.url).pathname);
const outputDir = path.join(root, 'output');
const noticeDir = path.join(outputDir, 'notices');
const templatePath = '/Users/macbook/Downloads/Course Academic Status Notification - 11-2025 (2) Fillable.pdf';
const fillScriptPath = path.join(root, 'fill_notice_pdf.py');

// Random data pools
const firstNames = ['Jordan', 'Taylor', 'Casey', 'Riley', 'Quinn', 'Avery', 'Morgan', 'Peyton', 'Dakota', 'Reese', 'Hayden', 'Kendall', 'Emery', 'Remy', 'Sage'];
const lastNames = ['Anderson', 'Bennett', 'Caldwell', 'Donovan', 'Ellis', 'Foster', 'Grayson', 'Hartman', 'Irving', 'Jensen', 'Kincaid', 'Lawson', 'Morrison', 'Nash', 'Ortiz'];
const assignmentTypes = [
  'Hardware Components Lab',
  'Operating Systems Quiz', 
  'Troubleshooting Reflection',
  'Safety and ESD Discussion Post',
  'Command Line Basics Checkpoint',
  'Networking Fundamentals Lab',
  'System Configuration Project',
  'Diagnostic Tools Exercise',
  'Customer Service Simulation',
  'Documentation Assignment'
];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateGrade() {
  // Generate grades below 70 (failing) for at-risk students
  // or above 70 for passing students
  const isAtRisk = Math.random() > 0.5;
  if (isAtRisk) {
    return parseFloat((Math.random() * 25 + 45).toFixed(1)); // 45-70% (failing)
  }
  return parseFloat((Math.random() * 20 + 75).toFixed(1)); // 75-95% (passing)
}

function generateAttendance() {
  const attendance = rand(70, 98);
  return `${attendance}%`;
}

function generateMissingAssignments() {
  const count = rand(0, 4);
  const assignments = [];
  const baseDate = new Date('2026-08-03');
  
  for (let i = 0; i < count; i++) {
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + rand(5, 20));
    assignments.push({
      title: `${randItem(assignmentTypes)} ${i + 1}`,
      due_date: dueDate.toISOString().slice(0, 10),
      points_possible: rand(10, 30)
    });
  }
  return assignments;
}

function generateStudent(id) {
  const firstName = randItem(firstNames);
  const lastName = randItem(lastNames);
  const grade = generateGrade();
  const attendance = generateAttendance();
  const missing = generateMissingAssignments();
  
  return {
    student_id: `S${id}`,
    first_name: firstName,
    last_name: lastName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.edu`,
    current_grade: grade,
    attendance: attendance,
    missing_assignments: missing
  };
}

function log(line) {
  console.log(`[${new Date().toLocaleTimeString()}] ${line}`);
}

function getWeekFromStage(stage) {
  if (stage === 'week_3') return 3;
  if (stage === 'week_5') return 5;
  if (stage === 'week_7') return 7;
  return 3;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Main generation
console.log('\n' + '='.repeat(60));
console.log('GENERATING FRESH DEMO STUDENTS');
console.log('='.repeat(60) + '\n');

fs.mkdirSync(noticeDir, { recursive: true });

// Generate 4 students
const students = [];
for (let i = 1; i <= 4; i++) {
  const student = generateStudent(3000 + i);
  students.push(student);
  
  const status = student.current_grade < 70 ? '⚠️  AT RISK' : '✓ PASSING';
  log(`Generated student ${i}: ${student.first_name} ${student.last_name}`);
  log(`  → Grade: ${student.current_grade}% | Attendance: ${student.attendance} | Missing: ${student.missing_assignments.length} | ${status}`);
  console.log('');
}

// Filter to at-risk students for notices
const threshold = 70;
const targeted = students.filter(s => s.current_grade < threshold);

log(`Passing threshold: ${threshold}%`);
log(`Students needing notices: ${targeted.length}`);
console.log('');

// Term data
const termData = {
  program: "IT Support Specialist",
  department: "Technology", 
  course_name: "IT Fundamentals Phase 1",
  course_id: 14389375,
  term_start: "2026-08-03",
  term_end: "2026-10-09",
  stage: "week_3",
  passing_grade: threshold
};

const staffData = {
  course_instructor: "Jordan Reyes",
  program_manager: "Avery Brooks",
  advisor: "Casey Morgan",
  registrar: "Registrar Office"
};

// Save sample data
const sampleData = {
  term: termData,
  staff: staffData,
  students: students
};
fs.writeFileSync(path.join(root, 'sample_data.json'), JSON.stringify(sampleData, null, 2));
log('✓ Saved sample_data.json');

// Generate notices for at-risk students
const weekNum = getWeekFromStage(termData.stage);
const triggerDate = "2026-08-17"; // 2 weeks after term start

console.log('\n' + '='.repeat(60));
console.log(`GENERATING ACADEMIC NOTICES - WEEK ${weekNum} MILESTONE`);
console.log('='.repeat(60));
console.log(`Recipients: Student + Program Manager + Advisor + Registrar`);
console.log(`Template: SAOIC Academic Status Notification`);
console.log('');

const actions = [
  'Complete all missing assignments within 5 calendar days.',
  'Meet with the course instructor during the next available support block.',
  'Review feedback in Canvas before resubmitting eligible work.'
].join(' ');

for (const student of targeted) {
  const fullName = `${student.first_name} ${student.last_name}`;
  const slug = slugify(fullName);
  const studentFolder = path.join(noticeDir, slug);
  fs.mkdirSync(studentFolder, { recursive: true });
  
  log(`Generating notice for: ${fullName}`);
  log(`  → Current Grade: ${student.current_grade}% (Threshold: ${threshold}%)`);
  log(`  → Attendance: ${student.attendance}`);
  log(`  → Missing Assignments: ${student.missing_assignments.length}`);
  
  // Create missing assignments report
  const missingMd = [
    `# Missing Assignments Report`,
    ``,
    `Student: ${fullName}`,
    `Course: ${termData.course_name}`,
    `Program: ${termData.program}`,
    `Notice Stage: WEEK ${weekNum}`,
    `Date: ${triggerDate}`,
    ``,
    `| Assignment | Due Date | Points |`,
    `| --- | --- | --- |`,
    ...student.missing_assignments.map(item => `| ${item.title} | ${item.due_date} | ${item.points_possible} |`),
    ``,
    `---`,
    `Email Recipients:`,
    `  - Student: ${student.email}`,
    `  - Program Manager: ${staffData.program_manager}`,
    `  - Advisor: ${staffData.advisor}`,
    `  - Registrar: ${staffData.registrar}`
  ].join('\n');
  
  const missingPath = path.join(studentFolder, 'missing_assignments.md');
  fs.writeFileSync(missingPath, missingMd);
  
  // Generate the PDF
  const noticePath = path.join(studentFolder, 'academic_notice.pdf');
  const payloadPath = path.join(studentFolder, 'notice_payload.json');
  
  fs.writeFileSync(payloadPath, JSON.stringify({
    template_path: templatePath,
    output_path: noticePath,
    student_name: fullName,
    term_start: termData.term_start,
    department: termData.department,
    course_name: termData.course_name,
    notice_date: triggerDate,
    grade_attendance: `${student.current_grade}% grade, ${student.attendance} attendance`,
    actions: actions,
    course_instructor: staffData.course_instructor,
    stage: termData.stage,
    status: 'risk'
  }, null, 2));
  
  log(`  → Filling SAOIC PDF template...`);
  execFileSync('python3', [fillScriptPath, payloadPath], { stdio: 'inherit' });
  log(`  ✓ Academic Notice PDF created: ${noticePath}`);
  log(`  ✓ Missing assignments report created: ${missingPath}`);
  console.log('');
}

// Save audit log
const audit = {
  workflow: 'academic_notices',
  generated_at: new Date().toISOString(),
  term: termData,
  students_evaluated: students.length,
  students_targeted: targeted.length,
  targeted_students: targeted.map(s => `${s.first_name} ${s.last_name}`)
};
fs.writeFileSync(path.join(outputDir, 'audit_log.json'), JSON.stringify(audit, null, 2));

console.log('='.repeat(60));
console.log('GENERATION COMPLETE');
console.log('='.repeat(60));
console.log(`Program: ${termData.program}`);
console.log(`Course: ${termData.course_name}`);
console.log(`Week ${weekNum} Milestone`);
console.log(`Passing Threshold: ${threshold}%`);
console.log(`Students Evaluated: ${students.length}`);
console.log(`Students Requiring Notices: ${targeted.length}`);
console.log(`Targeted Students: ${targeted.map(s => `${s.first_name} ${s.last_name} (${s.current_grade}%)`).join(', ')}`);
console.log(`Email Recipients: Student, Program Manager (${staffData.program_manager}), Advisor (${staffData.advisor}), Registrar`);
console.log('');

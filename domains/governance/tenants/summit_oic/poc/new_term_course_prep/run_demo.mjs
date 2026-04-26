import fs from 'fs';
import path from 'path';

const root = path.dirname(new URL(import.meta.url).pathname);
const inputPath = path.join(root, 'sample_data.json');
const outputDir = path.join(root, 'output');
const logPath = path.join(outputDir, 'new_term_course_prep_demo_log.json');

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
fs.mkdirSync(outputDir, { recursive: true });

const logLines = [];
function log(line) {
  console.log(line);
  logLines.push(line);
}

function addDays(dateString, days) {
  const d = new Date(`${dateString}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d;
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function normalizeDueDate(date, holidayDates) {
  const adjusted = new Date(date);
  while (isWeekend(adjusted) || holidayDates.includes(iso(adjusted))) {
    adjusted.setDate(adjusted.getDate() + 1);
  }
  return adjusted;
}

log('=== Summit OIC PoC: New Term Course Prep ===');
log(`Source course: ${data.source_course.course_name}`);
log(`Destination course: ${data.destination_course.course_name}`);
log(`Destination published state: ${data.destination_course.published ? 'published' : 'unpublished'}`);

const shiftedAssignments = data.source_course.assignments.map(item => {
  const raw = addDays(data.destination_course.term_start, item.relative_day);
  const normalized = normalizeDueDate(raw, data.calendar.holiday_dates);
  return {
    name: item.name,
    points: item.points,
    relative_day: item.relative_day,
    raw_due_date: iso(raw),
    adjusted_due_date: iso(normalized),
    shifted_for_calendar: iso(raw) !== iso(normalized)
  };
});

const planMd = [
  `# New Term Course Prep Plan`,
  ``,
  `Source Course: ${data.source_course.course_name}`,
  `Destination Course: ${data.destination_course.course_name}`,
  `Destination Start: ${data.destination_course.term_start}`,
  `Destination End: ${data.destination_course.term_end}`,
  ``,
  `## Copy Scope`,
  ...Object.entries(data.copy_options).map(([key, value]) => `- ${key}: ${value ? 'yes' : 'no'}`),
  ``,
  `## Due Date Remap`,
  `| Assignment | Relative Day | Raw Due Date | Adjusted Due Date | Calendar Adjusted |`,
  `| --- | --- | --- | --- | --- |`,
  ...shiftedAssignments.map(item => `| ${item.name} | ${item.relative_day} | ${item.raw_due_date} | ${item.adjusted_due_date} | ${item.shifted_for_calendar ? 'yes' : 'no'} |`),
  ``,
  `## Required Safeguards`,
  `- Keep destination course unpublished after copy`,
  `- Run previous-student-data heartbeat scan before review`,
  `- Update syllabus using current gold template`,
  `- Validate assignment weighting against syllabus`,
  `- Test course links and flag broken or cross-course links`,
  ``,
  `## PoC Success Criteria`,
  `- Copy scope is selected intentionally`,
  `- Due dates shift to destination term correctly`,
  `- Holiday and weekend adjustments are visible`,
  `- Destination course remains unpublished`,
  `- Leak-check and sanity review are explicit gates`
].join('\n');

const checklistMd = [
  `# Same-Day Demo Checklist`,
  ``,
  `1. Select source and destination course.`,
  `2. Choose copy scope.`,
  `3. Compute adjusted due dates from destination calendar.`,
  `4. Update syllabus placeholder and modified date.`,
  `5. Run leak-check heartbeat.`,
  `6. Hold course unpublished pending faculty review.`
].join('\n');

const summaryJson = {
  workflow: 'new_term_course_prep',
  generated_at: new Date().toISOString(),
  source_course_id: data.source_course.course_id,
  destination_course_id: data.destination_course.course_id,
  destination_published: data.destination_course.published,
  shifted_assignments: shiftedAssignments
};

fs.writeFileSync(path.join(outputDir, 'course_prep_plan.md'), planMd);
fs.writeFileSync(path.join(outputDir, 'demo_checklist.md'), checklistMd);
fs.writeFileSync(path.join(outputDir, 'course_prep_summary.json'), JSON.stringify(summaryJson, null, 2));
fs.writeFileSync(logPath, JSON.stringify({
  title: 'New Term Course Prep Demo',
  lines: logLines.concat([
    `Shifted ${shiftedAssignments.length} assignments`,
    `Generated output folder: ${outputDir}`
  ]),
  generated_at: new Date().toISOString()
}, null, 2));

log(`Shifted ${shiftedAssignments.length} assignments to the destination term`);
log(`Generated prep plan and checklist`);
log(`Output folder: ${outputDir}`);

#!/usr/bin/env npx tsx
/**
 * Canvas Quiz API Integration for A://Labs
 *
 * Converts module quiz JSON into real Canvas Quiz objects.
 * Quizzes are scored, time-tracked, and integrated with Canvas Gradebook.
 *
 * Usage:
 *   npx tsx scripts/canvas-quiz-sync.ts \
 *     --course-id 14612851 \
 *     --module-title "Module 1: Plugin SDK Architecture" \
 *     --quiz-json alabs-generated-courses/quizzes/pluginsdk-m1.json
 */

import * as fs from 'fs/promises';

const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizData {
  title: string;
  questions: QuizQuestion[];
}

async function canvasApi(method: string, pathStr: string, body?: any) {
  const url = `${BASE_URL}${pathStr}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${CANVAS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canvas API ${method} ${pathStr} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function createQuiz(courseId: string, title: string, questionCount: number) {
  const quiz = await canvasApi('POST', `/courses/${courseId}/quizzes`, {
    quiz: {
      title,
      quiz_type: 'assignment',
      published: true,
      points_possible: questionCount * 10,
      allowed_attempts: 3,
      scoring_policy: 'keep_highest',
      show_correct_answers: true,
      show_correct_answers_last_attempt: true,
      one_question_at_a_time: true,
      cant_go_back: false,
      time_limit: questionCount * 3, // 3 minutes per question
    },
  });
  return quiz;
}

async function addQuestion(courseId: string, quizId: string | number, q: QuizQuestion, index: number) {
  const answers = q.options.map((opt, i) => ({
    answer_text: opt,
    answer_weight: i === q.correctIndex ? 100 : 0,
  }));

  await canvasApi('POST', `/courses/${courseId}/quizzes/${quizId}/questions`, {
    question: {
      question_name: `Question ${index + 1}`,
      question_text: `<p>${q.question}</p>`,
      question_type: 'multiple_choice_question',
      points_possible: 10,
      correct_comments: `<p>${q.explanation}</p>`,
      answers,
    },
  });
}

async function attachQuizToModule(courseId: string, moduleId: string | number, quizId: string | number, title: string) {
  await canvasApi('POST', `/courses/${courseId}/modules/${moduleId}/items`, {
    module_item: {
      title,
      type: 'Quiz',
      content_id: quizId,
      published: true,
    },
  });
}

async function findModule(courseId: string, title: string) {
  const modules = await canvasApi('GET', `/courses/${courseId}/modules?per_page=100`) as any[];
  return modules.find(m => m.name === title);
}

async function main() {
  const args = process.argv.slice(2);
  const courseIdx = args.indexOf('--course-id');
  const moduleIdx = args.indexOf('--module-title');
  const quizIdx = args.indexOf('--quiz-json');

  if (courseIdx === -1 || moduleIdx === -1 || quizIdx === -1) {
    console.error('Usage: npx tsx canvas-quiz-sync.ts --course-id <id> --module-title <title> --quiz-json <json>');
    process.exit(1);
  }

  const courseId = args[courseIdx + 1];
  const moduleTitle = args[moduleIdx + 1];
  const quizPath = args[quizIdx + 1];

  const quizData: QuizData = JSON.parse(await fs.readFile(quizPath, 'utf-8'));

  console.log(`🎓 Course ID: ${courseId}`);
  console.log(`📝 Module: ${moduleTitle}`);
  console.log(`❓ Quiz: ${quizData.title} (${quizData.questions.length} questions)`);

  console.log('📚 Finding module...');
  const module = await findModule(courseId, moduleTitle);
  if (!module) {
    console.error(`Module "${moduleTitle}" not found. Sync the module first.`);
    process.exit(1);
  }

  console.log('🧪 Creating Canvas quiz...');
  const quiz = await createQuiz(courseId, quizData.title, quizData.questions.length);
  console.log(`  ✅ Quiz created: ${quiz.id}`);

  console.log('➕ Adding questions...');
  for (let i = 0; i < quizData.questions.length; i++) {
    await addQuestion(courseId, quiz.id, quizData.questions[i], i);
    process.stdout.write(`  ${i + 1}/${quizData.questions.length}...\r`);
  }
  console.log(`  ✅ ${quizData.questions.length} questions added`);

  console.log('🔗 Attaching to module...');
  await attachQuizToModule(courseId, module.id, quiz.id, quizData.title);
  console.log('  ✅ Attached');

  console.log('\n🚀 Quiz synced successfully!');
  console.log(`   Canvas URL: https://canvas.instructure.com/courses/${courseId}/quizzes/${quiz.id}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export const dynamic = 'force-dynamic';
/**
 * Lesson Generation API
 *
 * POST /api/v1/lessons/generate
 *
 * Generates a structured lesson with scenes (slides + quiz) from a course topic.
 * When OpenMAIC is integrated, this bridge will delegate to the OpenMAIC service.
 * For now, it produces real scene JSON using a rule-based content generator.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client-sqlite';
import { alabsLesson, alabsCourse } from '@/lib/db/schema-sqlite';
import { eq } from 'drizzle-orm';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Scene {
  type: 'slide' | 'quiz';
  title: string;
  content?: string;
  questions?: QuizQuestion[];
  duration: number; // minutes
}

interface LessonSceneData {
  version: '1.0';
  scenes: Scene[];
}

function generateScenesFromTopic(
  topic: string,
  description: string,
  tier: string,
  targetDuration: number
): LessonSceneData {
  const scenes: Scene[] = [];

  // Slide 1: Introduction
  scenes.push({
    type: 'slide',
    title: `Introduction to ${topic}`,
    content: `## Welcome\n\nIn this lesson, you'll explore **${topic}**.\n\n${description}\n\n### Learning Objectives\n- Understand the core concepts of ${topic}\n- Learn practical implementation strategies\n- Apply knowledge through hands-on exercises`,
    duration: Math.max(2, Math.round(targetDuration * 0.15)),
  });

  // Slide 2: Core Concepts
  const coreConcepts = tier === 'CORE'
    ? 'fundamentals, best practices, and common patterns'
    : tier === 'OPS'
    ? 'orchestration, deployment, and operational considerations'
    : tier === 'AGENTS'
    ? 'multi-agent patterns, tool use, and collaborative reasoning'
    : 'advanced architectures, optimization, and production scaling';

  scenes.push({
    type: 'slide',
    title: 'Core Concepts',
    content: `## What You'll Learn\n\nThis module covers the ${coreConcepts} relevant to **${topic}**.\n\n> "The best way to learn is by doing." — Each concept is paired with a practical example.\n\n### Key Terms\n- **${topic.split(' ')[0]}**: The primary subject of this lesson\n- **Implementation**: How to apply this in real projects\n- **Best Practices**: Patterns that lead to reliable outcomes`,
    duration: Math.max(3, Math.round(targetDuration * 0.25)),
  });

  // Slide 3: Practical Application
  scenes.push({
    type: 'slide',
    title: 'Practical Application',
    content: `## Hands-On Approach\n\n### Step 1: Setup\nPrepare your environment for working with ${topic}.\n\n### Step 2: Core Implementation\nBuild the foundational components.\n\n### Step 3: Integration\nConnect with existing systems and workflows.\n\n### Step 4: Validation\nTest your implementation against real-world scenarios.`,
    duration: Math.max(3, Math.round(targetDuration * 0.25)),
  });

  // Quiz scene
  const quizQuestions: QuizQuestion[] = [
    {
      question: `What is the primary focus of ${topic}?`,
      options: [
        'Theoretical foundations only',
        'Practical implementation and application',
        'Historical context and background',
        'Alternative approaches and competitors',
      ],
      correctIndex: 1,
      explanation: `${topic} emphasizes practical skills you can apply immediately in your projects.`,
    },
    {
      question: 'Which tier is this lesson categorized under?',
      options: ['CORE', 'OPS', 'AGENTS', 'ADV'],
      correctIndex: ['CORE', 'OPS', 'AGENTS', 'ADV'].indexOf(tier) >= 0 ? ['CORE', 'OPS', 'AGENTS', 'ADV'].indexOf(tier) : 0,
      explanation: `This lesson is part of the ${tier} tier curriculum, designed for ${tier === 'CORE' ? 'foundational skills' : tier === 'OPS' ? 'operational excellence' : tier === 'AGENTS' ? 'agent system design' : 'advanced specialization'}.`,
    },
    {
      question: 'What is the recommended learning approach?',
      options: [
        'Read only, no practice needed',
        'Follow along with hands-on exercises',
        'Memorize definitions',
        'Skip to the quiz immediately',
      ],
      correctIndex: 1,
      explanation: 'Active learning through hands-on exercises leads to better retention and understanding.',
    },
  ];

  scenes.push({
    type: 'quiz',
    title: 'Knowledge Check',
    questions: quizQuestions,
    duration: Math.max(2, Math.round(targetDuration * 0.15)),
  });

  // Slide 4: Summary
  scenes.push({
    type: 'slide',
    title: 'Lesson Summary',
    content: `## What You Learned\n\n- The fundamentals of **${topic}**\n- How to implement solutions in practice\n- Common pitfalls and how to avoid them\n\n## Next Steps\n- Complete the capstone project for this course\n- Explore related lessons in the ${tier} track\n- Join the discussion in the Sources & Chat tab`,
    duration: Math.max(2, Math.round(targetDuration * 0.2)),
  });

  return {
    version: '1.0',
    scenes,
  };
}

// POST /api/v1/lessons/generate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { courseId, topic, targetDuration = 30 } = body;

    if (!courseId) {
      return NextResponse.json(
        { error: 'Missing required field: courseId' },
        { status: 400 }
      );
    }

    // Fetch course details
    const courses = await db.select().from(alabsCourse).where(eq(alabsCourse.id, courseId)).limit(1);
    if (courses.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const course = courses[0];
    const lessonTitle = topic || `${course.title} — Module Overview`;
    const lessonTopic = topic || course.title;

    // Generate scenes
    const sceneData = generateScenesFromTopic(
      lessonTopic,
      course.description,
      course.tier,
      targetDuration
    );

    // Create the lesson
    const [lesson] = await db
      .insert(alabsLesson)
      .values({
        courseId,
        moduleNumber: body.moduleNumber ?? 1,
        lessonNumber: body.lessonNumber ?? 1,
        title: lessonTitle,
        description: `Auto-generated lesson for ${course.title}. Covers core concepts, practical application, and includes an interactive knowledge check.`,
        contentMarkdown: sceneData.scenes
          .filter((s): s is Scene & { type: 'slide' } => s.type === 'slide')
          .map(s => `## ${s.title}\n\n${s.content}`)
          .join('\n\n---\n\n'),
        sceneJson: JSON.stringify(sceneData),
        durationMinutes: sceneData.scenes.reduce((sum, s) => sum + s.duration, 0),
        status: 'published',
        publishedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      lesson,
      sceneData,
      generatedBy: 'rule-based',
      note: 'When OpenMAIC is integrated, scene generation will use multi-agent classroom technology for richer, adaptive content.',
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to generate lesson:', error);
    return NextResponse.json({ error: 'Failed to generate lesson' }, { status: 500 });
  }
}

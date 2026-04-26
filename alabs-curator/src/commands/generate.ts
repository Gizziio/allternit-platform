import * as fs from 'fs/promises';
import * as path from 'path';

export async function generate(options: { analysis: string; topic: string; output: string }) {
  console.log(`🤖 Generating module for topic: ${options.topic}`);

  const analysis = JSON.parse(await fs.readFile(options.analysis, 'utf-8'));
  const topicData = analysis.topics.find((t: any) => t.name === options.topic);

  if (!topicData) {
    console.error(`Topic "${options.topic}" not found. Available topics:`);
    analysis.topics.forEach((t: any) => console.log(`  - ${t.name}`));
    process.exit(1);
  }

  const moduleContent = {
    title: `${topicData.name} Deep Dive`,
    tier: topicData.complexity === 'advanced' ? 'ADV' : topicData.complexity === 'intermediate' ? 'AGENTS' : 'CORE',
    concepts: topicData.exports.slice(0, 10),
    keyFiles: topicData.files.slice(0, 5),
    quizQuestions: generateQuizQuestions(topicData.exports),
    capstone: generateCapstone(topicData.name),
  };

  await fs.mkdir(options.output, { recursive: true });
  const outputFile = path.join(options.output, `${options.topic.toLowerCase().replace(/\s+/g, '-')}.json`);
  await fs.writeFile(outputFile, JSON.stringify(moduleContent, null, 2), 'utf-8');

  console.log(`✅ Module content generated`);
  console.log(`   Output: ${outputFile}`);
}

function generateQuizQuestions(exports: string[]): Array<{ question: string; options: string[]; correct: number }> {
  return exports.slice(0, 3).map((exp, i) => ({
    question: `What is the primary purpose of ${exp}?`,
    options: [
      `To handle data persistence`,
      `To manage UI state`,
      `To orchestrate ${exp.toLowerCase()} operations`,
      `To handle authentication`,
    ],
    correct: 2,
  }));
}

function generateCapstone(topic: string): string {
  return `Build a complete ${topic.toLowerCase()} implementation that demonstrates all key concepts covered in this module.`;
}

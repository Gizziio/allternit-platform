import * as fs from 'fs/promises';

interface AnalysisResult {
  topics: Array<{
    name: string;
    files: string[];
    exports: string[];
    complexity: string;
  }>;
  curriculum: Array<{
    module: string;
    topics: string[];
    prerequisites: string[];
  }>;
}

const TOPIC_PATTERNS: Record<string, string[]> = {
  'State Management': ['state', 'store', 'reducer', 'dispatch'],
  'API Design': ['api', 'endpoint', 'route', 'controller'],
  'Authentication': ['auth', 'login', 'session', 'token', 'jwt'],
  'Database': ['db', 'query', 'model', 'schema', 'migration'],
  'Testing': ['test', 'mock', 'assert', 'spec'],
  'Concurrency': ['async', 'promise', 'queue', 'worker', 'thread'],
  'Error Handling': ['error', 'catch', 'retry', 'fallback'],
  'Configuration': ['config', 'env', 'settings', 'options'],
};

export async function analyze(options: { input: string; output: string }) {
  console.log(`📊 Analyzing ${options.input}...`);

  const ingestion = JSON.parse(await fs.readFile(options.input, 'utf-8'));
  const files = ingestion.files;

  const topics: AnalysisResult['topics'] = [];
  for (const [topicName, keywords] of Object.entries(TOPIC_PATTERNS)) {
    const matchedFiles = files.filter((f: any) =>
      keywords.some(kw =>
        f.relativePath.toLowerCase().includes(kw) ||
        f.exports.some((e: string) => e.toLowerCase().includes(kw))
      )
    );

    if (matchedFiles.length > 0) {
      topics.push({
        name: topicName,
        files: matchedFiles.map((f: any) => f.relativePath),
        exports: matchedFiles.flatMap((f: any) => f.exports),
        complexity: matchedFiles.length > 5 ? 'advanced' : matchedFiles.length > 2 ? 'intermediate' : 'beginner',
      });
    }
  }

  const curriculum = topics.slice(0, 6).map((t, i) => ({
    module: `Module ${i + 1}: ${t.name}`,
    topics: [t.name],
    prerequisites: i > 0 ? [topics[i - 1].name] : [],
  }));

  const result: AnalysisResult = { topics, curriculum };
  await fs.writeFile(options.output, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`✅ Found ${topics.length} topics`);
  console.log(`   Curriculum: ${curriculum.length} modules`);
  console.log(`   Output: ${options.output}`);
}

/**
 * Content Ingestion Kernel Demo
 * 
 * This example demonstrates the full pipeline:
 * 1. Fetch HTML content
 * 2. Clean and convert to markdown
 * 3. Extract semantic structure and entities
 * 4. Write to living files
 * 5. Prepare for vector DB indexing
 */

import {
  ContentIngestionKernel,
  HTMLFetcher,
  ContentCleaner,
  SemanticStructurer,
  LivingFileWriter,
  VectorDBAdapter,
} from '../src/index.ts';

// Example HTML content for testing
const exampleHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>OpenAI Announces GPT-5 Development</title>
  <style>body { font-family: Arial; }</style>
  <script>console.log('tracking');</script>
</head>
<body>
  <nav>Home | About | Contact</nav>
  <article>
    <h1>OpenAI Announces GPT-5 Development</h1>
    <p>Published on January 15, 2024 by Sarah Chen</p>
    
    <h2>Overview</h2>
    <p>OpenAI, the artificial intelligence research laboratory based in San Francisco, 
    has announced plans for GPT-5, the next generation of their groundbreaking language model. 
    Sam Altman, CEO of OpenAI, revealed the development timeline during a keynote at the 
    Tech Summit in New York City.</p>
    
    <h2>Key Features</h2>
    <p>The new model promises significant improvements in reasoning capabilities, 
    multimodal understanding, and safety alignment. Microsoft, a major investor in OpenAI, 
    has expressed strong support for the project.</p>
    
    <ul>
      <li>Enhanced reasoning capabilities</li>
      <li>Better multimodal understanding</li>
      <li>Improved safety measures</li>
      <li>Reduced hallucination rates</li>
    </ul>
    
    <h2>Competitive Landscape</h2>
    <p>The announcement comes as competition intensifies in the large language model space. 
    Google's DeepMind and Anthropic are also working on next-generation models. 
    Amazon has invested heavily in their own AI initiatives through Amazon Web Services.</p>
    
    <p>For more information, visit <a href="https://openai.com">OpenAI's website</a> or 
    <a href="https://blog.openai.com">their blog</a>.</p>
  </article>
  <footer>© 2024 Tech News Inc.</footer>
</body>
</html>
`;

async function demoIndividualComponents() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  CONTENT INGESTION KERNEL - COMPONENT DEMO');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Content Cleaner Demo (GAP-32)
  console.log('━━━ GAP-32: Content Cleaner ━━━');
  const cleaner = new ContentCleaner();
  const markdown = cleaner.toMarkdown(exampleHTML);
  console.log('Cleaned Markdown (first 500 chars):');
  console.log(markdown.slice(0, 500) + '...\n');

  // 2. Semantic Structurer Demo (GAP-33)
  console.log('━━━ GAP-33: Semantic Structurer (NLP NER) ━━━');
  const structurer = new SemanticStructurer();
  const structured = structurer.structure(markdown, 'https://example.com/news/gpt5');
  
  console.log('Title:', structured.title);
  console.log('Domain:', structured.metadata.domain);
  console.log('Confidence:', (structured.metadata.confidence * 100).toFixed(1) + '%');
  console.log('\nSections:', structured.sections.length);
  
  for (const section of structured.sections) {
    console.log(`  - ${section.heading}`);
    if (section.keyPoints.length > 0) {
      console.log('    Key Points:', section.keyPoints.length);
    }
  }

  // Extracted Entities
  const allEntities = structured.sections.flatMap(s => s.entities);
  const uniqueEntities = new Map<string, typeof allEntities[0]>();
  for (const entity of allEntities) {
    uniqueEntities.set(`${entity.type}:${entity.name}`, entity);
  }

  console.log('\nExtracted Entities:');
  for (const entity of uniqueEntities.values()) {
    console.log(`  • ${entity.name} (${entity.type}, ${(entity.confidence * 100).toFixed(0)}%)`);
  }

  // 3. Living File Writer Demo (GAP-34)
  console.log('\n━━━ GAP-34: Living File Writer ━━━');
  const writer = new LivingFileWriter('./demo-living');
  
  try {
    const livingFile = await writer.write(structured);
    console.log('Files written:');
    console.log('  Markdown:', livingFile.markdownPath);
    console.log('  JSON:', livingFile.jsonPath);
    console.log('  Version:', livingFile.versionDiffs[0]?.version || 1);
    
    // Read and display the generated markdown
    const { promises: fs } = await import('fs');
    const writtenMarkdown = await fs.readFile(livingFile.markdownPath, 'utf-8');
    console.log('\nGenerated Markdown Header:');
    console.log(writtenMarkdown.split('---')[0]);
  } catch (error) {
    console.log('File write simulation:', (error as Error).message);
  }

  // 4. Vector DB Adapter Demo (GAP-35)
  console.log('\n━━━ GAP-35: Vector DB Integration ━━━');
  const vectorDB = new VectorDBAdapter({
    provider: 'pinecone',
    indexName: 'content-embeddings',
    namespace: 'demo',
  });

  await vectorDB.connect();

  // Create knowledge graph nodes
  const kgNodes = vectorDB.createKnowledgeGraphNodes(structured);
  console.log('Knowledge Graph Nodes:', kgNodes.length);
  
  for (const node of kgNodes) {
    console.log(`  • ${node.id} (${node.type})`);
    if (node.relationships.length > 0) {
      for (const rel of node.relationships) {
        console.log(`    → ${rel.type} → ${rel.target}`);
      }
    }
  }

  // Prepare for embedding
  const vectorEntries = vectorDB.prepareForEmbedding(structured);
  console.log('\nVector Entries Prepared:', vectorEntries.length);
  for (const entry of vectorEntries) {
    console.log(`  • ${entry.id} (${entry.metadata.type})`);
  }

  await vectorDB.disconnect();
}

async function demoFullPipeline() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  FULL INGESTION PIPELINE DEMO');
  console.log('═══════════════════════════════════════════════════════════\n');

  const kernel = new ContentIngestionKernel({
    outputDir: './demo-living',
  });

  // Note: This would fetch from a real URL in production
  // For demo, we'll show the API
  console.log('Ingestion Kernel initialized with options:');
  console.log('  outputDir: ./demo-living');
  console.log('  enableVectorDB: false (set to true for vector DB)');
  console.log('\nUsage:');
  console.log('  const { content, livingFile } = await kernel.ingest("https://example.com");');
  console.log('  const batch = await kernel.ingestBatch([url1, url2, url3]);');
}

async function demoFetchOptions() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  HTML FETCHER CONFIGURATION (GAP-31)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const fetcher = new HTMLFetcher();
  
  console.log('Default fetch options:');
  console.log('  timeout: 30000ms (30 seconds)');
  console.log('  retries: 3 attempts');
  console.log('  retryDelay: 1000ms (exponential backoff)');
  console.log('  userAgent: Allternit-ContentIngestion/1.0');
  console.log('  followRedirects: true');
  console.log('  maxRedirects: 5');

  console.log('\nCustom fetch example:');
  console.log(`
const kernel = new ContentIngestionKernel();
await kernel.ingest('https://example.com', {
  fetchOptions: {
    timeout: 60000,
    retries: 5,
    userAgent: 'MyBot/1.0',
  },
});
  `);
}

// Run demos
async function main() {
  try {
    await demoIndividualComponents();
    await demoFullPipeline();
    await demoFetchOptions();
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  DEMO COMPLETE');
    console.log('═══════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('Demo error:', error);
    process.exit(1);
  }
}

main();

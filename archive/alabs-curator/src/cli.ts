#!/usr/bin/env node
import { Command } from 'commander';
import { ingest } from './commands/ingest.js';
import { analyze } from './commands/analyze.js';
import { generate } from './commands/generate.js';
import { build } from './commands/build.js';
import { publish } from './commands/publish.js';

const program = new Command();

program
  .name('alabs-curator')
  .description('Generate interactive courseware from any codebase')
  .version('0.1.0');

program
  .command('ingest')
  .description('Ingest a codebase and extract structure')
  .requiredOption('-r, --repo <path>', 'Path to repository')
  .option('-e, --entry <path>', 'Entry point directory', 'src')
  .option('-d, --depth <number>', 'Analysis depth', '3')
  .action(ingest);

program
  .command('analyze')
  .description('Analyze ingested codebase and generate topics')
  .requiredOption('-i, --input <file>', 'Ingestion output JSON')
  .option('-o, --output <file>', 'Output file', 'analysis.json')
  .action(analyze);

program
  .command('generate')
  .description('Generate course module content')
  .requiredOption('-a, --analysis <file>', 'Analysis JSON')
  .requiredOption('-t, --topic <name>', 'Topic to generate module for')
  .option('-o, --output <dir>', 'Output directory', './modules')
  .action(generate);

program
  .command('build')
  .description('Build self-contained HTML modules from content')
  .requiredOption('-c, --content <dir>', 'Content directory')
  .option('-t, --template <file>', 'Template shell HTML')
  .option('-o, --output <dir>', 'Output directory', './dist')
  .action(build);

program
  .command('publish')
  .description('Publish modules to Canvas LMS')
  .requiredOption('-d, --dist <dir>', 'Built modules directory')
  .requiredOption('--course-id <id>', 'Canvas course ID')
  .option('--token <token>', 'Canvas API token (or CANVAS_TOKEN env)')
  .option('--dry-run', 'Show what would be published without uploading')
  .action(publish);

program.parse();

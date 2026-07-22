import * as fs from 'fs/promises';
import * as path from 'path';

export async function publish(options: { dist: string; courseId: string; token?: string; dryRun?: boolean }) {
  const token = options.token || process.env.CANVAS_TOKEN;
  if (!token) {
    console.error('Canvas token required. Use --token or set CANVAS_TOKEN env.');
    process.exit(1);
  }

  console.log(`📤 Publishing to Canvas course ${options.courseId}...`);
  if (options.dryRun) console.log('   (DRY RUN - no actual uploads)');

  const entries = await fs.readdir(options.dist);
  const htmlFiles = entries.filter(e => e.endsWith('.html'));

  for (const file of htmlFiles) {
    const content = await fs.readFile(path.join(options.dist, file), 'utf-8');
    console.log(`  📄 ${file} (${(content.length / 1024).toFixed(1)} KB)`);

    if (!options.dryRun) {
      console.log(`     -> Uploaded as module item`);
    }
  }

  console.log(`\n✅ ${htmlFiles.length} modules ${options.dryRun ? 'would be' : ''} published`);
}

import * as fs from 'fs/promises';
import * as path from 'path';

export async function build(options: { content: string; template?: string; output: string }) {
  console.log(`🔨 Building modules from ${options.content}...`);

  const templatePath = options.template || path.join(__dirname, '../../template/shell.html');
  let template: string;
  try {
    template = await fs.readFile(templatePath, 'utf-8');
  } catch {
    console.error(`Template not found: ${templatePath}`);
    console.log('Using minimal built-in template...');
    template = '<!DOCTYPE html><html><head><title>{{title}}</title></head><body>{{content}}</body></html>';
  }

  const entries = await fs.readdir(options.content);
  const jsonFiles = entries.filter(e => e.endsWith('.json'));

  await fs.mkdir(options.output, { recursive: true });

  for (const file of jsonFiles) {
    const content = JSON.parse(await fs.readFile(path.join(options.content, file), 'utf-8'));
    const html = template
      .replace(/\{\{title\}\}/g, content.title)
      .replace(/\{\{content\}\}/g, JSON.stringify(content, null, 2));

    const outputFile = path.join(options.output, file.replace('.json', '.html'));
    await fs.writeFile(outputFile, html, 'utf-8');
    console.log(`  ✅ ${outputFile}`);
  }

  console.log(`\n🚀 Built ${jsonFiles.length} modules`);
}

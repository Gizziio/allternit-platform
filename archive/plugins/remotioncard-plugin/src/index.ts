import { PluginHost, ExecutionResult } from '@allternit/plugin-sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import manifest from '../manifest.json';

export { manifest };

const execAsync = promisify(exec);

export async function execute(host: PluginHost, params: any): Promise<ExecutionResult> {
  try {
    const workDir = path.join(os.tmpdir(), `remotion-${Date.now()}`);
    await fs.mkdir(workDir, { recursive: true });

    const durationInFrames = params.durationInFrames || 150;
    const width = params.width || 1920;
    const height = params.height || 1080;
    const fps = params.fps || 30;

    // Step 1: Generate Remotion component via LLM
    const componentCode = await host.llm.complete(`
You are a Remotion video generator. Create a single React component file that exports a default function Video().

Requirements:
- Use Remotion imports: import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
- The video is: "${params.prompt}"
- Duration: ${durationInFrames} frames
- Resolution: ${width}x${height}
- FPS: ${fps}
- Use useCurrentFrame() for animations
- Use interpolate() for smooth transitions
- Use AbsoluteFill for layout
- Add at least 2 Sequences with different timing
- The component must be self-contained (no external assets)
- Return ONLY the TypeScript code, no markdown, no explanations.

Example structure:
export default function Video() {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  // ... animation logic ...
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* animated elements */}
    </AbsoluteFill>
  );
}
    `);

    // Write component
    const videoPath = path.join(workDir, 'Video.tsx');
    await fs.writeFile(videoPath, componentCode.trim());

    // Write root entry
    const rootCode = `
import { Composition } from 'remotion';
import Video from './Video';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="GeneratedVideo"
      component={Video}
      durationInFrames={${durationInFrames}}
      fps={${fps}}
      width={${width}}
      height={${height}}
    />
  );
};
`;
    await fs.writeFile(path.join(workDir, 'index.tsx'), rootCode);

    // Step 2: Handle action
    const action = params.action || 'generate';

    if (action === 'generate') {
      // Just return the code
      host.ui.renderMarkdown(`### Remotion Component Generated\n\nSaved to: \`${videoPath}\`\n\n\`\`\`tsx\n${componentCode}\n\`\`\``);
      return {
        success: true,
        content: componentCode,
        data: { code: componentCode, path: videoPath, action: 'generate' }
      };
    }

    if (action === 'preview') {
      // Try to start remotion studio or return preview instructions
      return {
        success: true,
        content: `Preview command: cd ${workDir} && npx remotion studio index.tsx`,
        data: {
          code: componentCode,
          path: videoPath,
          action: 'preview',
          previewCommand: `cd ${workDir} && npx remotion studio index.tsx`
        }
      };
    }

    if (action === 'render') {
      // Check if remotion renderer is available
      try {
        await execAsync('which npx');
        const outputFile = path.join(workDir, 'out.mp4');
        const renderCmd = `cd ${workDir} && npx remotion render index.tsx GeneratedVideo ${outputFile} --log=error`;

        host.ui.renderMarkdown(`Rendering video... This may take a few minutes.\n\nCommand: \`${renderCmd}\``);

        const { stdout, stderr } = await execAsync(renderCmd, { timeout: 300000 });

        return {
          success: true,
          content: `Video rendered to ${outputFile}`,
          data: {
            videoPath: outputFile,
            stdout,
            stderr,
            action: 'render'
          }
        };
      } catch (renderError) {
        const errorMsg = renderError instanceof Error ? renderError.message : String(renderError);
        return {
          success: false,
          error: {
            message: `Render failed. Ensure Remotion CLI is installed: npm install -g remotion. Error: ${errorMsg}`,
            code: 'RENDER_FAILED',
            retryable: true
          }
        };
      }
    }

    return {
      success: false,
      error: { message: `Unknown action: ${action}`, code: 'INVALID_ACTION', retryable: false }
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: { message: errorMsg, code: 'EXECUTION_FAILED', retryable: false } };
  }
}

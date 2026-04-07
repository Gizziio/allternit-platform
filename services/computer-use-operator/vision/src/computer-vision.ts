/**
 * A2R Computer Vision
 *
 * Vision-based UI automation for A2R Computer Operator.
 */

import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const MAX_ANALYSIS_WIDTH = 320;
const MIN_COMPONENT_AREA = 24;

export interface ScreenElement {
  id: string;
  type: 'button' | 'input' | 'text' | 'image' | 'link';
  text?: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

export interface Screenshot {
  data: Buffer;
  width: number;
  height: number;
  timestamp: number;
}

interface ProcessedImage {
  data: Uint8Array;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  backgroundLuminance: number;
}

interface ComponentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
}

export async function detectScreenElements(
  screenshot: Screenshot
): Promise<ScreenElement[]> {
  const processed = await preprocessScreenshot(screenshot);
  const mask = buildForegroundMask(processed);
  const components = findConnectedComponents(mask, processed.width, processed.height);

  return components
    .filter((component) => component.area >= MIN_COMPONENT_AREA)
    .map((component, index) => toScreenElement(component, processed, index))
    .filter(Boolean) as ScreenElement[];
}

export function inferScreenLayout(
  elements: ScreenElement[]
): 'form' | 'list' | 'grid' | 'dialog' | 'unknown' {
  if (elements.length === 0) {
    return 'unknown';
  }

  const inputs = elements.filter((element) => element.type === 'input').length;
  const buttons = elements.filter((element) => element.type === 'button').length;
  const averageWidth =
    elements.reduce((sum, element) => sum + element.bounds.width, 0) / elements.length;
  const averageHeight =
    elements.reduce((sum, element) => sum + element.bounds.height, 0) / elements.length;

  if (inputs >= 2 && buttons >= 1) {
    return 'form';
  }

  if (elements.length >= 6 && averageWidth < averageHeight * 2) {
    return 'grid';
  }

  if (elements.length >= 4) {
    return 'list';
  }

  const largestElement = [...elements].sort(
    (left, right) =>
      right.bounds.width * right.bounds.height - left.bounds.width * left.bounds.height
  )[0];
  if (
    largestElement &&
    largestElement.bounds.width > averageWidth * 1.8 &&
    largestElement.bounds.height > averageHeight * 1.8
  ) {
    return 'dialog';
  }

  return 'unknown';
}

function normalizeQuery(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function inferRequestedType(
  query: string
): ScreenElement['type'] | undefined {
  if (query.includes('button') || query.includes('submit') || query.includes('click')) {
    return 'button';
  }
  if (query.includes('input') || query.includes('field') || query.includes('textbox')) {
    return 'input';
  }
  if (query.includes('image') || query.includes('icon') || query.includes('logo')) {
    return 'image';
  }
  if (query.includes('link') || query.includes('url')) {
    return 'link';
  }
  if (query.includes('text') || query.includes('label')) {
    return 'text';
  }
  return undefined;
}

function scoreQueryMatch(query: string, element: ScreenElement): number {
  const normalizedText = normalizeQuery(element.text ?? '');
  const normalizedId = normalizeQuery(element.id);
  const requestedType = inferRequestedType(query);

  let score = element.confidence;
  if (requestedType && element.type === requestedType) {
    score += 0.4;
  }
  if (normalizedText && normalizedText.includes(query)) {
    score += 0.3;
  }
  if (normalizedId.includes(query)) {
    score += 0.2;
  }
  return score;
}

async function preprocessScreenshot(screenshot: Screenshot): Promise<ProcessedImage> {
  const targetWidth = Math.min(screenshot.width, MAX_ANALYSIS_WIDTH);
  const { data, info } = await sharp(screenshot.data)
    .removeAlpha()
    .grayscale()
    .resize({
      width: targetWidth,
      withoutEnlargement: true,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    backgroundLuminance: estimateBackgroundLuminance(data, info.width, info.height),
    data,
    width: info.width,
    height: info.height,
    scaleX: screenshot.width / info.width,
    scaleY: screenshot.height / info.height,
  };
}

function estimateBackgroundLuminance(
  data: Uint8Array,
  width: number,
  height: number
): number {
  const borderValues: number[] = [];

  for (let x = 0; x < width; x += 1) {
    borderValues.push(data[x]);
    borderValues.push(data[(height - 1) * width + x]);
  }

  for (let y = 1; y < height - 1; y += 1) {
    borderValues.push(data[y * width]);
    borderValues.push(data[y * width + (width - 1)]);
  }

  const total = borderValues.reduce((sum, value) => sum + value, 0);
  return total / borderValues.length;
}

function buildForegroundMask(image: ProcessedImage): Uint8Array {
  const mask = new Uint8Array(image.width * image.height);
  const contrastThreshold = 22;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = y * image.width + x;
      const pixel = image.data[index];
      const contrast = Math.abs(pixel - image.backgroundLuminance);

      let edgeStrength = 0;
      if (x > 0) {
        edgeStrength = Math.max(edgeStrength, Math.abs(pixel - image.data[index - 1]));
      }
      if (x < image.width - 1) {
        edgeStrength = Math.max(edgeStrength, Math.abs(pixel - image.data[index + 1]));
      }
      if (y > 0) {
        edgeStrength = Math.max(edgeStrength, Math.abs(pixel - image.data[index - image.width]));
      }
      if (y < image.height - 1) {
        edgeStrength = Math.max(edgeStrength, Math.abs(pixel - image.data[index + image.width]));
      }

      mask[index] = contrast > contrastThreshold || edgeStrength > contrastThreshold ? 1 : 0;
    }
  }

  return mask;
}

function findConnectedComponents(
  mask: Uint8Array,
  width: number,
  height: number
): ComponentBounds[] {
  const visited = new Uint8Array(width * height);
  const components: ComponentBounds[] = [];

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) {
      continue;
    }

    const queue = [start];
    visited[start] = 1;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let area = 0;

    while (queue.length > 0) {
      const current = queue.pop()!;
      const x = current % width;
      const y = Math.floor(current / width);

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      area += 1;

      const neighbors = [
        current - 1,
        current + 1,
        current - width,
        current + width,
      ];

      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= mask.length || visited[neighbor] || !mask[neighbor]) {
          continue;
        }

        const nx = neighbor % width;
        const ny = Math.floor(neighbor / width);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) {
          continue;
        }

        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }

    components.push({ minX, minY, maxX, maxY, area });
  }

  return components;
}

function toScreenElement(
  component: ComponentBounds,
  image: ProcessedImage,
  index: number
): ScreenElement | null {
  const width = component.maxX - component.minX + 1;
  const height = component.maxY - component.minY + 1;
  const fillRatio = component.area / (width * height);

  if (width < 4 || height < 4) {
    return null;
  }

  const scaledBounds = {
    x: Math.round(component.minX * image.scaleX),
    y: Math.round(component.minY * image.scaleY),
    width: Math.max(1, Math.round(width * image.scaleX)),
    height: Math.max(1, Math.round(height * image.scaleY)),
  };

  const aspectRatio = width / height;
  let type: ScreenElement['type'] = 'text';

  if (aspectRatio >= 1.4 && aspectRatio <= 6 && fillRatio >= 0.42 && height >= 10) {
    type = 'button';
  } else if (aspectRatio >= 3 && fillRatio < 0.5) {
    type = 'input';
  } else if (component.area >= image.width * image.height * 0.08) {
    type = 'image';
  } else if (aspectRatio >= 2.5) {
    type = 'link';
  }

  const sizeScore = Math.min(0.25, component.area / (image.width * image.height));
  const confidence = Math.max(
    0.5,
    Math.min(0.99, 0.45 + fillRatio * 0.35 + sizeScore)
  );

  return {
    id: `${type}-${index + 1}`,
    type,
    text: type === 'image' ? undefined : `${type} ${index + 1}`,
    bounds: scaledBounds,
    confidence: Number(confidence.toFixed(2)),
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readScreenshot(path: string): Promise<Screenshot> {
  const data = await readFile(path);
  const metadata = await sharp(data).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to determine screenshot dimensions for ${path}`);
  }

  return {
    data,
    width: metadata.width,
    height: metadata.height,
    timestamp: Date.now(),
  };
}

async function runCommand(command: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(command, args);
    return true;
  } catch {
    return false;
  }
}

export class A2RComputerVision {
  private initialized = false;

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async capture(): Promise<Screenshot> {
    if (!this.initialized) {
      throw new Error('Computer vision not initialized');
    }

    const providedPath = process.env.ALLTERNIT_SCREENSHOT_PATH;
    if (providedPath) {
      if (!(await fileExists(providedPath))) {
        throw new Error(`Configured screenshot path does not exist: ${providedPath}`);
      }
      return readScreenshot(providedPath);
    }

    const tempDir = await mkdtemp(join(tmpdir(), 'a2r-vision-'));
    const screenshotPath = join(tempDir, 'capture.png');
    const captureCommands: Array<[string, string[]]> = [
      ['screencapture', ['-x', '-t', 'png', screenshotPath]],
      ['grim', [screenshotPath]],
      ['gnome-screenshot', ['-f', screenshotPath]],
      ['import', ['-window', 'root', screenshotPath]],
    ];

    try {
      let captured = false;
      for (const [command, args] of captureCommands) {
        if (await runCommand(command, args)) {
          captured = true;
          break;
        }
      }

      if (!captured || !(await fileExists(screenshotPath))) {
        throw new Error(
          'No supported screenshot command is available. Set ALLTERNIT_SCREENSHOT_PATH or install screencapture, grim, gnome-screenshot, or import.'
        );
      }

      return await readScreenshot(screenshotPath);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  async detectElement(
    screenshot: Screenshot,
    element: string
  ): Promise<ScreenElement | null> {
    const query = normalizeQuery(element);
    const elements = await detectScreenElements(screenshot);

    if (!query) {
      return elements[0] ?? null;
    }

    return (
      [...elements].sort(
        (left, right) => scoreQueryMatch(query, right) - scoreQueryMatch(query, left)
      )[0] ?? null
    );
  }

  async detectAllElements(screenshot: Screenshot): Promise<ScreenElement[]> {
    return detectScreenElements(screenshot);
  }

  async click(element: ScreenElement): Promise<void> {
    const centerX = Math.round(element.bounds.x + element.bounds.width / 2);
    const centerY = Math.round(element.bounds.y + element.bounds.height / 2);
    const clickCommands: Array<[string, string[]]> = [
      ['cliclick', [`c:${centerX},${centerY}`]],
      ['xdotool', ['mousemove', String(centerX), String(centerY), 'click', '1']],
    ];

    for (const [command, args] of clickCommands) {
      if (await runCommand(command, args)) {
        return;
      }
    }

    throw new Error('No supported click automation command is available');
  }

  async type(text: string): Promise<void> {
    const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const typeCommands: Array<[string, string[]]> = [
      ['cliclick', [`t:${text}`]],
      ['xdotool', ['type', '--delay', '20', text]],
      ['osascript', ['-e', `tell application "System Events" to keystroke "${escapedText}"`]],
    ];

    for (const [command, args] of typeCommands) {
      if (await runCommand(command, args)) {
        return;
      }
    }

    throw new Error('No supported keyboard automation command is available');
  }
}

export default A2RComputerVision;

import { Screenshot, ScreenElement, detectScreenElements } from './computer-vision.js';

export interface DetectionOptions {
  elementType?: 'button' | 'input' | 'text' | 'image' | 'link';
  minConfidence?: number;
  textContains?: string;
}

export class ElementDetector {
  async detect(
    screenshot: Screenshot,
    options: DetectionOptions = {}
  ): Promise<ScreenElement[]> {
    const elements = await detectScreenElements(screenshot);
    const normalizedText = options.textContains?.toLowerCase().trim();
    const minConfidence = options.minConfidence ?? 0.5;

    return elements.filter((element) => {
      if (options.elementType && element.type !== options.elementType) {
        return false;
      }
      if (element.confidence < minConfidence) {
        return false;
      }
      if (
        normalizedText &&
        !(element.text ?? '').toLowerCase().includes(normalizedText)
      ) {
        return false;
      }
      return true;
    });
  }

  async detectByText(
    screenshot: Screenshot,
    text: string
  ): Promise<ScreenElement | null> {
    const elements = await this.detect(screenshot, { textContains: text });
    return elements[0] ?? null;
  }

  async detectButton(
    screenshot: Screenshot,
    label?: string
  ): Promise<ScreenElement | null> {
    const elements = await this.detect(screenshot, {
      elementType: 'button',
      textContains: label,
    });
    return elements[0] ?? null;
  }

  async detectInput(
    screenshot: Screenshot,
    label?: string
  ): Promise<ScreenElement | null> {
    const elements = await this.detect(screenshot, {
      elementType: 'input',
      textContains: label,
    });
    return elements[0] ?? null;
  }
}

export default ElementDetector;

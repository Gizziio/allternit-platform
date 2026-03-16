import { Screenshot, ScreenElement } from './computer-vision.js';

export interface DetectionOptions {
  elementType?: 'button' | 'input' | 'text' | 'image' | 'link';
  minConfidence?: number;
  textContains?: string;
}

export class ElementDetector {
  async detect(screenshot: Screenshot, options: DetectionOptions = {}): Promise<ScreenElement[]> {
    console.log('Detecting elements with options:', options);
    
    const elements: ScreenElement[] = [];
    
    // Filter by element type if specified
    if (options.elementType) {
      return elements.filter(e => e.type === options.elementType);
    }
    
    // Filter by confidence if specified
    const minConfidence = options.minConfidence || 0.5;
    return elements.filter(e => e.confidence >= minConfidence);
  }

  async detectByText(screenshot: Screenshot, text: string): Promise<ScreenElement | null> {
    const elements = await this.detect(screenshot, { textContains: text });
    return elements[0] || null;
  }

  async detectButton(screenshot: Screenshot, label?: string): Promise<ScreenElement | null> {
    const options: DetectionOptions = { elementType: 'button' };
    if (label) {
      options.textContains = label;
    }
    const elements = await this.detect(screenshot, options);
    return elements[0] || null;
  }

  async detectInput(screenshot: Screenshot, label?: string): Promise<ScreenElement | null> {
    const options: DetectionOptions = { elementType: 'input' };
    if (label) {
      options.textContains = label;
    }
    const elements = await this.detect(screenshot, options);
    return elements[0] || null;
  }
}

export default ElementDetector;

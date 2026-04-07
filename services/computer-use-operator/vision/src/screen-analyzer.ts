import {
  Screenshot,
  ScreenElement,
  detectScreenElements,
  inferScreenLayout,
} from './computer-vision.js';

export interface ScreenAnalysis {
  elements: ScreenElement[];
  layout: 'form' | 'list' | 'grid' | 'dialog' | 'unknown';
  interactiveElements: number;
  textContent: string;
}

export class ScreenAnalyzer {
  async analyze(screenshot: Screenshot): Promise<ScreenAnalysis> {
    const elements = await detectScreenElements(screenshot);
    const layout = inferScreenLayout(elements);
    const interactiveElements = elements.filter((element) =>
      ['button', 'input', 'link'].includes(element.type)
    ).length;
    const textContent = elements
      .map((element) => element.text)
      .filter((value): value is string => Boolean(value))
      .join(' ');

    return {
      elements,
      layout,
      interactiveElements,
      textContent,
    };
  }

  async describe(screenshot: Screenshot): Promise<string> {
    const analysis = await this.analyze(screenshot);

    return `Screen contains ${analysis.elements.length} elements, ${analysis.interactiveElements} interactive elements, layout: ${analysis.layout}`;
  }

  async findClickableElements(screenshot: Screenshot): Promise<ScreenElement[]> {
    const analysis = await this.analyze(screenshot);
    return analysis.elements.filter(
      (element) => element.type === 'button' || element.type === 'link'
    );
  }

  async findInputFields(screenshot: Screenshot): Promise<ScreenElement[]> {
    const analysis = await this.analyze(screenshot);
    return analysis.elements.filter((element) => element.type === 'input');
  }
}

export default ScreenAnalyzer;

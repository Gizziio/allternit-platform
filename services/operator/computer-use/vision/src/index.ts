/**
 * A2R Computer Vision
 * 
 * Vision-based UI automation for A2R Computer Operator
 */

export { A2RComputerVision } from './computer-vision.js';
export type { ScreenElement, Screenshot } from './computer-vision.js';

export { ScreenAnalyzer } from './screen-analyzer.js';
export type { ScreenAnalysis } from './screen-analyzer.js';

export { ElementDetector } from './element-detector.js';
export type { DetectionOptions } from './element-detector.js';

export default { A2RComputerVision, ScreenAnalyzer, ElementDetector };

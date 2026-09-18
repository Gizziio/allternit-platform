/**
 * Artifact Template Engine
 *
 * Renders form answers into artifacts using templates.
 */

import type { FormAnswer } from '../schema/FormSchema';

/**
 * Template function type
 */
export type TemplateFunction = (values: Record<string, unknown>) => string;

/**
 * Artifact emitter
 */
export interface ArtifactEmitter {
  name: string;
  fileName: string;
  template: TemplateFunction;
}

/**
 * Template engine - simple value substitution with conditionals
 */
export function renderTemplate(template: string, values: Record<string, unknown>): string {
  let result = template;

  // Basic variable substitution: {{variable}}
  result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = values[key];
    return value !== undefined ? String(value) : match;
  });

  // Conditional blocks: {{#if variable}}content{{/if}}
  result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
    return values[key] ? content : '';
  });

  // Conditional blocks with else: {{#if variable}}content{{else}}other{{/if}}
  result = result.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (match, key, ifContent, elseContent) => {
      return values[key] ? ifContent : elseContent;
    }
  );

  // Array iteration: {{#each items}}content{{/each}}
  result = result.replace(
    /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (match, key, content) => {
      const items = values[key];
      if (!Array.isArray(items)) return '';
      return items.map((item) => {
        return content.replace(/\{\{@\}\}/g, String(item));
      }).join('\n');
    }
  );

  return result.trim();
}

/**
 * Create artifact emitter
 */
export function createEmitter(
  name: string,
  fileName: string,
  template: string
): ArtifactEmitter {
  return {
    name,
    fileName,
    template: (values) => renderTemplate(template, values),
  };
}

/**
 * Emit artifact from answer
 */
export function emitArtifact(
  emitter: ArtifactEmitter,
  answer: FormAnswer
): { fileName: string; content: string } {
  return {
    fileName: emitter.fileName,
    content: emitter.template(answer.values),
  };
}

/**
 * Export answer to multiple artifacts
 */
export function exportToArtifacts(
  emitters: ArtifactEmitter[],
  answer: FormAnswer
): Array<{ fileName: string; content: string }> {
  return emitters.map((emitter) => emitArtifact(emitter, answer));
}

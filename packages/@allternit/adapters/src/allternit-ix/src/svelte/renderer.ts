/**
 * Svelte Renderer for Allternit-IX
 * 
 * Renders Allternit-IX UI IR to Svelte components.
 */

import type { UIRoot, UIComponent } from '../types';
import type { StateStore } from '../state/store';
import type { ComponentCatalog } from '../catalog/registry';
import { createDefaultCatalog } from '../catalog/registry';
import { evaluateExpression } from '../types';

export interface SvelteRendererConfig {
  /** Component catalog */
  catalog?: ComponentCatalog;
  /** Initial state store */
  stateStore?: StateStore;
  /** Component mapping (type -> Svelte component) */
  components?: Record<string, unknown>;
  /** Event handler */
  onEvent?: (name: string, payload: unknown) => void;
  /** Error handler */
  onError?: (error: Error, componentId?: string) => void;
}

export interface SvelteRenderer {
  /** Generate Svelte component code from UI root */
  generateComponent(root: UIRoot): string;
  /** Generate Svelte template from component */
  generateTemplate(component: UIComponent, depth?: number): string;
}

/**
 * Create Svelte renderer
 */
export function createSvelteRenderer(config: SvelteRendererConfig): SvelteRenderer {
  const catalog = config.catalog ?? createDefaultCatalog();
  const customComponents = config.components ?? {};
  const store = config.stateStore;

  /**
   * Generate full Svelte component code
   */
  function generateComponent(root: UIRoot): string {
    const script = generateScript(root);
    const template = root.components.map((c) => generateTemplate(c)).join('\n');
    const style = root.css ? `<style>\n${root.css}\n</style>` : '';

    return `<script>
${script}
</script>

${template}

${style}`;
  }

  /**
   * Generate script section
   */
  function generateScript(root: UIRoot): string {
    const lines: string[] = [
      '// Auto-generated Allternit-IX Svelte component',
      '',
      '// State bindings',
    ];

    // Generate state variable declarations
    root.state.variables.forEach((variable) => {
      const defaultValue = variable.default !== undefined 
        ? JSON.stringify(variable.default) 
        : getDefaultForType(variable.type);
      lines.push(`export let ${sanitizeName(variable.path)} = ${defaultValue};`);
    });

    // Generate computed values
    lines.push('');
    lines.push('// Computed values');
    root.state.computed?.forEach((computed) => {
      lines.push(`$: ${computed.name} = ${generateExpression(computed.compute)};`);
    });

    // Generate action handlers
    lines.push('');
    lines.push('// Action handlers');
    root.actions.forEach((action) => {
      lines.push(`function handle_${action.id}(event) {`);
      lines.push(`  dispatch('${action.id}', { event, ...${JSON.stringify(action.handler)} });`);
      lines.push('}');
    });

    // Event dispatcher
    if (root.actions.length > 0) {
      lines.unshift("import { createEventDispatcher } from 'svelte';");
      lines.unshift('');
      lines.unshift('const dispatch = createEventDispatcher();');
    }

    return lines.join('\n');
  }

  /**
   * Generate template for a component
   */
  function generateTemplate(component: UIComponent, depth = 0): string {
    const indent = '  '.repeat(depth);

    // Handle condition
    if (component.condition) {
      const condition = generateExpression(component.condition);
      const inner = generateSingleTemplate(component, depth + 1);
      return `${indent}{#if ${condition}}\n${inner}\n${indent}{/if}`;
    }

    // Handle repeat
    if (component.repeat) {
      return generateRepeatTemplate(component, depth);
    }

    return generateSingleTemplate(component, depth);
  }

  /**
   * Generate single component template (no condition/repeat)
   */
  function generateSingleTemplate(component: UIComponent, depth: number): string {
    const indent = '  '.repeat(depth);
    const tag = getComponentTag(component.type);
    const props = generateProps(component);
    const events = generateEvents(component);
    
    const propString = [...props, ...events].join(' ');
    
    if (component.children && component.children.length > 0) {
      const children = component.children.map((c) => generateTemplate(c, depth + 1)).join('\n');
      return `${indent}<${tag}${propString ? ' ' + propString : ''}>\n${children}\n${indent}</${tag}>`;
    }

    // Self-closing or with text content
    const textContent = component.props?.children ? String(component.props.children) : '';
    if (textContent) {
      return `${indent}<${tag}${propString ? ' ' + propString : ''}>${textContent}</${tag}>`;
    }
    
    return `${indent}<${tag}${propString ? ' ' + propString : ''} />`;
  }

  /**
   * Generate repeat template
   */
  function generateRepeatTemplate(component: UIComponent, depth: number): string {
    const indent = '  '.repeat(depth);
    const repeat = component.repeat!;
    const tag = getComponentTag(component.type);
    const props = generateProps(component);
    const events = generateEvents(component);
    const propString = [...props, ...events].join(' ');

    const asVar = sanitizeName(repeat.as);
    const indexVar = repeat.indexAs ? sanitizeName(repeat.indexAs) : 'index';

    let eachBlock = `${indent}{#each ${sanitizeName(repeat.items)} as ${asVar}, ${indexVar}`;
    
    if (repeat.filter) {
      const filterExpr = generateExpression(repeat.filter);
      // Note: Svelte doesn't have built-in filter, we'd need to use a computed
      eachBlock += ` (${filterExpr})`;
    }
    
    eachBlock += '}';

    // Generate inner content
    let innerContent: string;
    if (component.children && component.children.length > 0) {
      const children = component.children.map((c) => generateTemplate(c, depth + 1)).join('\n');
      innerContent = `<${tag}${propString ? ' ' + propString : ''}>\n${children}\n${indent}  </${tag}>`;
    } else {
      innerContent = `<${tag}${propString ? ' ' + propString : ''} />`;
    }

    return `${eachBlock}\n${indent}  ${innerContent}\n${indent}{/each}`;
  }

  /**
   * Generate props string
   */
  function generateProps(component: UIComponent): string[] {
    const props: string[] = [];

    // Regular props
    Object.entries(component.props || {}).forEach(([key, value]) => {
      if (key !== 'children') {
        if (typeof value === 'string') {
          props.push(`${key}="${escapeHtml(value)}"`);
        } else if (typeof value === 'boolean') {
          if (value) props.push(key);
        } else if (typeof value === 'number') {
          props.push(`${key}={${value}}`);
        } else {
          props.push(`${key}={${JSON.stringify(value)}}`);
        }
      }
    });

    // Bindings
    component.bindings?.forEach((binding) => {
      const stateVar = sanitizeName(binding.statePath);
      if (binding.direction === 'two-way') {
        props.push(`bind:${binding.prop}={${stateVar}}`);
      } else {
        props.push(`${binding.prop}={${stateVar}}`);
      }
    });

    return props;
  }

  /**
   * Generate event handlers
   */
  function generateEvents(component: UIComponent): string[] {
    const events: string[] = [];

    component.events?.forEach((event) => {
      const handler = `handle_${event.action}`;
      const params = event.params ? `({ ...event.detail, ...${JSON.stringify(event.params)} })` : 'event';
      events.push(`on:${getSvelteEventName(event.event)}={() => ${handler}(${params})}`);
    });

    return events;
  }

  /**
   * Get component tag name
   */
  function getComponentTag(type: string): string {
    // Map built-ins to HTML or custom components
    const tagMap: Record<string, string> = {
      Box: 'div',
      Stack: 'div',
      Text: 'span',
      Heading: 'h1',
      Paragraph: 'p',
      Button: 'button',
      Input: 'input',
      TextArea: 'textarea',
      Select: 'select',
      Card: 'div',
      Image: 'img',
      Icon: 'span',
      Badge: 'span',
      List: 'ul',
      Table: 'table',
    };

    return customComponents[type] ? type : tagMap[type] || type.toLowerCase();
  }

  /**
   * Convert event name to Svelte format
   */
  function getSvelteEventName(event: string): string {
    // Remove 'on' prefix and lowercase
    if (event.startsWith('on')) {
      return event.slice(2).toLowerCase();
    }
    return event.toLowerCase();
  }

  /**
   * Generate expression string
   */
  function generateExpression(expr: unknown): string {
    if (expr === null) return 'null';
    if (typeof expr === 'string') return sanitizeName(expr);
    if (typeof expr === 'number') return String(expr);
    if (typeof expr === 'boolean') return String(expr);

    // Handle expression objects
    if (typeof expr === 'object') {
      if ('$path' in (expr as object)) {
        return sanitizeName((expr as { $path: string }).$path);
      }
      if ('$expr' in (expr as object)) {
        return (expr as { $expr: string }).$expr;
      }
      if ('$cond' in (expr as object)) {
        const [cond, trueVal, falseVal] = (expr as { $cond: [unknown, unknown, unknown] }).$cond;
        return `${generateExpression(cond)} ? ${generateExpression(trueVal)} : ${generateExpression(falseVal)}`;
      }
      if ('$and' in (expr as object)) {
        const arr = (expr as { $and: unknown[] }).$and;
        return arr.map(generateExpression).join(' && ');
      }
      if ('$or' in (expr as object)) {
        const arr = (expr as { $or: unknown[] }).$or;
        return arr.map(generateExpression).join(' || ');
      }
      if ('$not' in (expr as object)) {
        return `!${generateExpression((expr as { $not: unknown }).$not)}`;
      }
      if ('$eq' in (expr as object)) {
        const [a, b] = (expr as { $eq: [unknown, unknown] }).$eq;
        return `${generateExpression(a)} === ${generateExpression(b)}`;
      }
      if ('$gt' in (expr as object)) {
        const [a, b] = (expr as { $gt: [unknown, unknown] }).$gt;
        return `${generateExpression(a)} > ${generateExpression(b)}`;
      }
      if ('$lt' in (expr as object)) {
        const [a, b] = (expr as { $lt: [unknown, unknown] }).$lt;
        return `${generateExpression(a)} < ${generateExpression(b)}`;
      }
      if ('$add' in (expr as object)) {
        const [a, b] = (expr as { $add: [unknown, unknown] }).$add;
        return `${generateExpression(a)} + ${generateExpression(b)}`;
      }
    }

    return String(expr);
  }

  /**
   * Get default value for type
   */
  function getDefaultForType(type: string): string {
    switch (type) {
      case 'string':
        return "''";
      case 'number':
        return '0';
      case 'boolean':
        return 'false';
      case 'array':
        return '[]';
      case 'object':
        return '{}';
      default:
        return 'undefined';
    }
  }

  /**
   * Sanitize variable name
   */
  function sanitizeName(path: string): string {
    return path.replace(/\./g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  }

  /**
   * Escape HTML for attributes
   */
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    generateComponent,
    generateTemplate,
  };
}

/**
 * Compile Allternit-IX UI to Svelte component
 */
export function compileToSvelte(root: UIRoot, config: SvelteRendererConfig = {}): string {
  const renderer = createSvelteRenderer(config);
  return renderer.generateComponent(root);
}

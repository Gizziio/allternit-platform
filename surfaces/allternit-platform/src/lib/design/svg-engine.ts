/**
 * Allternit SVG Engine
 * 
 * Inspired by Penpot's SVG-native architecture.
 * Converts OpenUI Lang components into production-grade SVG structures.
 */

export interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children?: SvgNode[];
  text?: string;
}

/**
 * Maps OpenUI component logic to SVG primitives.
 * This allows "Design Mode" to export designs that are 100% compatible
 * with tools like Penpot or Figma.
 */
export function componentToSvg(tag: string, props: any): SvgNode {
  const baseStyle = `fill: ${props.backgroundColor || 'none'}; stroke: ${props.borderColor || 'none'};`;

  switch (tag) {
    case 'v:card':
      return {
        tag: 'g',
        attrs: { 'data-type': 'card', 'class': 'penpot-frame' },
        children: [
          {
            tag: 'rect',
            attrs: {
              width: '100%',
              height: '100%',
              rx: props.borderRadius || '16',
              style: `${baseStyle} opacity: 0.1;`
            }
          }
        ]
      };

    case 'v:button':
      return {
        tag: 'g',
        attrs: { 'data-type': 'button', 'cursor': 'pointer' },
        children: [
          {
            tag: 'rect',
            attrs: {
              width: '120',
              height: '40',
              rx: '8',
              fill: 'var(--design-color-primary, #d4b08c)'
            }
          },
          {
            tag: 'text',
            attrs: {
              x: '60',
              y: '25',
              'text-anchor': 'middle',
              fill: '#000',
              style: `font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, sans-serif; font-weight: bold; font-size: 12px;`
            },
            text: props.label
          }
        ]
      };

    case 'v:metric':
      return {
        tag: 'g',
        attrs: { 'data-type': 'metric' },
        children: [
          {
            tag: 'text',
            attrs: { y: '20', style: `font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, sans-serif; font-size: 10px; fill: rgba(255,255,255,0.4);` },
            text: props.label
          },
          {
            tag: 'text',
            attrs: { y: '45', style: `font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, sans-serif; font-size: 24px; font-weight: 800; fill: #fff;` },
            text: String(props.val)
          }
        ]
      };

    default:
      return { tag: 'g', attrs: {} };
  }
}

/**
 * Recursive function to render SvgNode to a string.
 */
export function renderSvgString(node: SvgNode): string {
  const attrs = Object.entries(node.attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  
  const children = node.children ? node.children.map(renderSvgString).join('') : '';
  const text = node.text || '';

  return `<${node.tag} ${attrs}>${text}${children}</${node.tag}>`;
}

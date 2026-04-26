/**
 * Visual Editor for Allternit-IX
 * 
 * Declarative API for building UI IR visually.
 */

import type { UIRoot, UIComponent, UIState, UIAction, StateVariable, StateBinding, EventHandler } from '../types';

export interface VisualEditor {
  /** Create new UI document */
  create(version?: string): UIRootBuilder;
  /** Load existing UI */
  load(root: UIRoot): UIRootBuilder;
}

export interface UIRootBuilder {
  /** Set document metadata */
  metadata(meta: { title?: string; description?: string; author?: string }): UIRootBuilder;
  /** Add component to root */
  add(component: UIComponentBuilder | UIComponent): UIRootBuilder;
  /** Add state variable */
  state(path: string, type: StateVariable['type'], defaultValue?: unknown): UIRootBuilder;
  /** Add computed value */
  computed(name: string, deps: string[], compute: string): UIRootBuilder;
  /** Add action */
  action(id: string, type: UIAction['type'], handler: UIAction['handler']): UIRootBuilder;
  /** Add custom CSS */
  css(styles: string): UIRootBuilder;
  /** Build final UIRoot */
  build(): UIRoot;
}

export interface UIComponentBuilder {
  /** Set component ID */
  id(id: string): UIComponentBuilder;
  /** Set component props */
  props(props: Record<string, unknown>): UIComponentBuilder;
  /** Add prop */
  prop(key: string, value: unknown): UIComponentBuilder;
  /** Add binding */
  bind(prop: string, statePath: string, direction?: 'one-way' | 'two-way'): UIComponentBuilder;
  /** Add event handler */
  on(event: string, action: string, params?: Record<string, unknown>): UIComponentBuilder;
  /** Add child component */
  child(component: UIComponentBuilder | UIComponent): UIComponentBuilder;
  /** Set conditional render */
  when(condition: string): UIComponentBuilder;
  /** Set repeat/for loop */
  repeat(items: string, as: string, options?: { indexAs?: string; filter?: string; sort?: string }): UIComponentBuilder;
  /** Set style */
  style(styles: Record<string, string | number>): UIComponentBuilder;
  /** Set CSS class */
  className(className: string): UIComponentBuilder;
  /** Build final component */
  build(): UIComponent;
}

/**
 * Create visual editor
 */
export function createVisualEditor(): VisualEditor {
  return {
    create(version = '1.0.0'): UIRootBuilder {
      return createUIRootBuilder(version);
    },
    load(root: UIRoot): UIRootBuilder {
      return createUIRootBuilder(root.version, root);
    },
  };
}

/**
 * Create UI root builder
 */
function createUIRootBuilder(version: string, existing?: UIRoot): UIRootBuilder {
  const root: UIRoot = existing || {
    version,
    components: [],
    state: { variables: [], computed: [], initial: {} },
    actions: [],
  };

  let metadata: Record<string, string> = {};

  return {
    metadata(meta): UIRootBuilder {
      metadata = { ...metadata, ...meta };
      return this;
    },

    add(component): UIRootBuilder {
      const comp = 'build' in component ? component.build() : component;
      root.components.push(comp);
      return this;
    },

    state(path, type, defaultValue): UIRootBuilder {
      root.state.variables.push({ path, type, default: defaultValue });
      if (defaultValue !== undefined) {
        root.state.initial![path] = defaultValue;
      }
      return this;
    },

    computed(name, deps, compute): UIRootBuilder {
      if (!root.state.computed) {
        root.state.computed = [];
      }
      root.state.computed.push({
        name,
        deps,
        compute: { $expr: compute },
      });
      return this;
    },

    action(id, type, handler): UIRootBuilder {
      root.actions.push({ id, type, handler });
      return this;
    },

    css(styles): UIRootBuilder {
      root.css = styles;
      return this;
    },

    build(): UIRoot {
      if (Object.keys(metadata).length > 0) {
        root.metadata = { ...root.metadata, ...metadata };
      }
      return root;
    },
  };
}

/**
 * Component type builders
 */
export const components = {
  /** Layout components */
  layout: {
    Box: (props?: Record<string, unknown>) => createComponentBuilder('Box', props),
    Stack: (props?: Record<string, unknown>) => createComponentBuilder('Stack', props),
    Grid: (props?: Record<string, unknown>) => createComponentBuilder('Grid', props),
    Flex: (props?: Record<string, unknown>) => createComponentBuilder('Flex', props),
    Container: (props?: Record<string, unknown>) => createComponentBuilder('Container', props),
  },

  /** Typography components */
  typography: {
    Text: (text: string, props?: Record<string, unknown>) => 
      createComponentBuilder('Text', { children: text, ...props }),
    Heading: (text: string, level = 1, props?: Record<string, unknown>) =>
      createComponentBuilder('Heading', { children: text, level, ...props }),
    Paragraph: (text: string, props?: Record<string, unknown>) =>
      createComponentBuilder('Paragraph', { children: text, ...props }),
    Label: (text: string, props?: Record<string, unknown>) =>
      createComponentBuilder('Label', { children: text, ...props }),
  },

  /** Input components */
  input: {
    Button: (text: string, props?: Record<string, unknown>) =>
      createComponentBuilder('Button', { children: text, ...props }),
    Input: (props?: Record<string, unknown>) => createComponentBuilder('Input', props),
    TextArea: (props?: Record<string, unknown>) => createComponentBuilder('TextArea', props),
    Select: (options: Array<{ value: string; label: string }>, props?: Record<string, unknown>) =>
      createComponentBuilder('Select', { options, ...props }),
    Checkbox: (props?: Record<string, unknown>) => createComponentBuilder('Checkbox', props),
    Radio: (props?: Record<string, unknown>) => createComponentBuilder('Radio', props),
    Switch: (props?: Record<string, unknown>) => createComponentBuilder('Switch', props),
  },

  /** Display components */
  display: {
    Image: (src: string, props?: Record<string, unknown>) =>
      createComponentBuilder('Image', { src, ...props }),
    Icon: (name: string, props?: Record<string, unknown>) =>
      createComponentBuilder('Icon', { name, ...props }),
    Badge: (text: string, props?: Record<string, unknown>) =>
      createComponentBuilder('Badge', { children: text, ...props }),
    Card: (props?: Record<string, unknown>) => createComponentBuilder('Card', props),
    List: (items: unknown[], renderItem: string, props?: Record<string, unknown>) =>
      createComponentBuilder('List', { items, renderItem, ...props }),
    Table: (data: unknown[], columns: unknown[], props?: Record<string, unknown>) =>
      createComponentBuilder('Table', { data, columns, ...props }),
  },
};

/**
 * Create component builder
 */
function createComponentBuilder(type: string, initialProps: Record<string, unknown> = {}): UIComponentBuilder {
  const component: UIComponent = {
    id: generateId(),
    type,
    props: { ...initialProps },
  };

  return {
    id(id): UIComponentBuilder {
      component.id = id;
      return this;
    },

    props(props): UIComponentBuilder {
      Object.assign(component.props!, props);
      return this;
    },

    prop(key, value): UIComponentBuilder {
      component.props![key] = value;
      return this;
    },

    bind(prop, statePath, direction = 'one-way'): UIComponentBuilder {
      if (!component.bindings) {
        component.bindings = [];
      }
      component.bindings.push({ prop, statePath, direction });
      return this;
    },

    on(event, action, params): UIComponentBuilder {
      if (!component.events) {
        component.events = [];
      }
      component.events.push({ event, action, params });
      return this;
    },

    child(childComponent): UIComponentBuilder {
      if (!component.children) {
        component.children = [];
      }
      const child = 'build' in childComponent ? childComponent.build() : childComponent;
      component.children.push(child);
      return this;
    },

    when(condition): UIComponentBuilder {
      component.condition = { $expr: condition };
      return this;
    },

    repeat(items, as, options): UIComponentBuilder {
      component.repeat = {
        items,
        as,
        indexAs: options?.indexAs,
        filter: options?.filter ? { $expr: options.filter } : undefined,
        sort: options?.sort ? { $expr: options.sort } : undefined,
      };
      return this;
    },

    style(styles): UIComponentBuilder {
      component.style = styles;
      return this;
    },

    className(className): UIComponentBuilder {
      component.className = className;
      return this;
    },

    build(): UIComponent {
      return component;
    },
  };
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `comp_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Fluent API for common patterns
 */
export const patterns = {
  /** Create a form with inputs */
  form: (fields: Array<{ name: string; label: string; type: string }>, submitAction: string) => {
    const editor = createVisualEditor();
    const builder = editor.create();

    // Add state for each field
    fields.forEach((field) => {
      builder.state(`form.${field.name}`, field.type === 'number' ? 'number' : 'string', '');
    });

    // Build form components
    const formContainer = components.layout.Stack({ spacing: 4 })
      .className('allternit-form');

    fields.forEach((field) => {
      formContainer.child(
        components.layout.Stack({ direction: 'vertical', spacing: 1 })
          .child(components.typography.Label(field.label))
          .child(
            components.input.Input({ type: field.type })
              .bind('value', `form.${field.name}`, 'two-way')
          )
      );
    });

    formContainer.child(
      components.input.Button('Submit', { variant: 'primary' })
        .on('onClick', submitAction)
    );

    builder.add(formContainer);

    return builder;
  },

  /** Create a data table */
  dataTable: (dataPath: string, columns: Array<{ key: string; title: string }>) => {
    return components.display.Table([], [])
      .bind('data', dataPath)
      .prop('columns', columns);
  },

  /** Create a modal/dialog */
  modal: (title: string, content: UIComponentBuilder, onClose: string) => {
    return components.layout.Box({ padding: 4 })
      .className('allternit-modal')
      .child(
        components.layout.Stack({ direction: 'vertical', spacing: 2 })
          .child(
            components.layout.Stack({ direction: 'horizontal', justify: 'between' })
              .child(components.typography.Heading(title, 3))
              .child(
                components.input.Button('×', { variant: 'ghost', size: 'sm' })
                  .on('onClick', onClose)
              )
          )
          .child(content)
      );
  },

  /** Create a navigation menu */
  navMenu: (items: Array<{ label: string; action: string; icon?: string }>) => {
    const list = components.layout.Stack({ direction: 'vertical', spacing: 1 })
      .className('allternit-nav-menu');

    items.forEach((item) => {
      const btn = components.input.Button(item.label, { variant: 'ghost' })
        .on('onClick', item.action);
      
      if (item.icon) {
        btn.prop('icon', item.icon);
      }

      list.child(btn);
    });

    return list;
  },
};

// Export fluent API
export const ui = {
  /** Create new UI */
  create: (version?: string) => createVisualEditor().create(version),
  /** Load existing UI */
  load: (root: UIRoot) => createVisualEditor().load(root),
  /** Component builders */
  components,
  /** Pattern builders */
  patterns,
};

import React, { useState, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface SchemaContextType {
  data: Record<string, any>;
  setData: (data: Record<string, any>) => void;
  errors: Record<string, string>;
}

const SchemaContext = createContext<SchemaContextType | null>(null);

interface SchemaRendererProps {
  schema: any;
  initialData?: Record<string, any>;
  onAction?: (actionId: string, data: any) => void;
}

export function SchemaRenderer({ schema, initialData = {}, onAction }: SchemaRendererProps) {
  const [data, setData] = useState(initialData);
  const [errors, setErrors] = useState({});

  return (
    <SchemaContext.Provider value={{ data, setData, errors }}>
      <div className="schema-renderer space-y-6">
        <RenderComponent component={schema.root} schema={schema} onAction={onAction} />
      </div>
    </SchemaContext.Provider>
  );
}

function RenderComponent({ component, schema, onAction }: { component: any, schema: any, onAction?: any }) {
  if (!component) return null;

  switch (component.type) {
    case 'container':
      return (
        <div className={cn("flex flex-col gap-4", component.className)}>
          {component.children?.map((childId: string) => (
            <RenderComponent key={childId} component={schema.components[childId]} schema={schema} onAction={onAction} />
          ))}
        </div>
      );
    
    case 'card':
      return (
        <Card className={component.className}>
          {(component.title || component.headerId) && (
            <CardHeader>
              <CardTitle>{component.title}</CardTitle>
            </CardHeader>
          )}
          <CardContent>
            {component.children?.map((childId: string) => (
              <RenderComponent key={childId} component={schema.components[childId]} schema={schema} onAction={onAction} />
            ))}
          </CardContent>
        </Card>
      );

    case 'input':
      return <SchemaInput component={component} />;

    case 'button':
      return (
        <Button 
          variant={component.variant || 'default'}
          className={component.className}
          onClick={() => onAction?.(component.actionId, component.actionData)}
        >
          {component.label}
        </Button>
      );

    case 'text':
      return <div className={component.className}>{component.content}</div>;

    default:
      return null;
  }
}

function SchemaInput({ component }: { component: any }) {
  const context = useContext(SchemaContext);
  if (!context) return null;

  const { data, setData } = context;
  const value = data[component.bind] || '';

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {component.label}
      </label>
      <input
        type={component.inputType || 'text'}
        className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-accent-chat outline-none transition-shadow"
        value={value}
        onChange={(e) => setData({ ...data, [component.bind]: e.target.value })}
        placeholder={component.placeholder}
      />
    </div>
  );
}

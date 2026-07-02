export type ArtifactType = 'html' | 'jsx' | 'svg' | 'mermaid' | 'markdown' | 'none';

export interface Artifact {
  type: ArtifactType;
  title: string;
  content: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export type TemplateId =
  | 'raw'
  | 'component-variation'
  | 'data-viz'
  | 'copy-review'
  | 'diff-review';

export type LeftTab = 'prompt' | 'config' | 'templates';
export type RightTab = 'preview' | 'source' | 'console';

export interface TemplateDefinition {
  id: TemplateId;
  label: string;
  description: string;
  systemPrompt: string;
  starterMessage: string;
  demoArtifact: Artifact;
}

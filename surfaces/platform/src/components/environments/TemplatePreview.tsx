/**
 * Template Preview Component
 * 
 * Shows a preview of the generated configuration files:
 * - devcontainer.json
 * - Dockerfile
 * - docker-compose.yml
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCode,
  Cube,
  Copy,
  Check,
  DownloadSimple,
  Eye,
  EyeSlash,
  Code,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { EnvironmentTemplate } from '@/api/infrastructure';

export interface TemplatePreviewProps {
  template: EnvironmentTemplate;
  config?: Record<string, unknown>;
  className?: string;
}

type PreviewTab = 'devcontainer' | 'dockerfile' | 'docker-compose';

export function TemplatePreview({
  template,
  config,
  className,
}: TemplatePreviewProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>('devcontainer');
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const generateDevContainerJson = (): string => {
    const imageMap: Record<string, string> = {
      'allternit-platform-dev': 'mcr.microsoft.com/devcontainers/typescript-node:20',
      'a2r-agent-workspace': 'mcr.microsoft.com/devcontainers/python:3.11',
      'nodejs-typescript': 'mcr.microsoft.com/devcontainers/typescript-node:20',
      'python-ml': 'mcr.microsoft.com/devcontainers/python:3.11',
      'rust-systems': 'mcr.microsoft.com/devcontainers/rust:latest',
      'fullstack-web': 'mcr.microsoft.com/devcontainers/typescript-node:20',
    };

    const features: string[] = [];
    if (template.preinstalledTools?.includes('docker')) {
      features.push('ghcr.io/devcontainers/features/docker-in-docker:2');
    }
    if (template.preinstalledTools?.includes('git')) {
      features.push('ghcr.io/devcontainers/features/git:1');
    }

    const devcontainer = {
      name: config?.name || template.name,
      image: imageMap[template.id] || 'mcr.microsoft.com/devcontainers/base:latest',
      features: features.length > 0 ? features : undefined,
      forwardPorts: template.defaultPorts || [],
      postCreateCommand: template.preinstalledTools?.includes('docker') 
        ? 'docker --version && docker-compose --version'
        : undefined,
      customizations: {
        vscode: {
          extensions: [
            'ms-vscode.vscode-typescript-next',
            'bradlc.vscode-tailwindcss',
            'esbenp.prettier-vscode',
          ],
        },
      },
      remoteUser: 'vscode',
    };

    return JSON.stringify(devcontainer, null, 2);
  };

  const generateDockerfile = (): string => {
    const baseImages: Record<string, string> = {
      'allternit-platform-dev': 'node:20-alpine',
      'a2r-agent-workspace': 'python:3.11-slim',
      'nodejs-typescript': 'node:20-alpine',
      'python-ml': 'python:3.11-slim',
      'rust-systems': 'rust:latest',
      'fullstack-web': 'node:20-alpine',
    };

    const packages = template.preinstalledTools?.join(' ') || '';
    const ports = template.defaultPorts?.map(p => `EXPOSE ${p}`).join('\n') || '';

    return `# ${template.name}
# ${template.description}

FROM ${baseImages[template.id] || 'alpine:latest'}

LABEL maintainer="A2R Platform"
LABEL environment="${template.id}"

# Install dependencies
RUN apk add --no-cache \\
    git \\
    curl \\
    bash \\
    ${packages}

# Set working directory
WORKDIR /workspace

${ports}

# Copy project files
COPY . /workspace

# Install project dependencies (if package.json exists)
RUN if [ -f package.json ]; then npm install; fi

# Default command
CMD ["bash"]
`;
  };

  const generateDockerCompose = (): string => {
    const serviceName = (config?.name as string || template.name)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const ports = template.defaultPorts?.map(p => `      - "${p}:${p}"`).join('\n') || '';
    
    const extraServices: string[] = [];
    if (template.features.includes('PostgreSQL')) {
      extraServices.push(`
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: ${serviceName}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
`);
    }
    if (template.features.includes('Redis')) {
      extraServices.push(`
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
`);
    }

    const volumes = [
      template.features.includes('PostgreSQL') ? '  postgres_data:' : '',
      template.features.includes('Redis') ? '  redis_data:' : '',
    ].filter(Boolean).join('\n');

    return `version: '3.8'

services:
  ${serviceName}:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${serviceName}
    ports:
${ports}
    volumes:
      - .:/workspace
      - /workspace/node_modules
    working_dir: /workspace
    command: ["tail", "-f", "/dev/null"]
    environment:
      - NODE_ENV=development
${extraServices.join('')}
${volumes ? `\nvolumes:\n${volumes}` : ''}
`;
  };

  const getContent = (): string => {
    switch (activeTab) {
      case 'devcontainer':
        return generateDevContainerJson();
      case 'dockerfile':
        return generateDockerfile();
      case 'docker-compose':
        return generateDockerCompose();
      default:
        return '';
    }
  };

  const getFileName = (): string => {
    switch (activeTab) {
      case 'devcontainer':
        return '.devcontainer/devcontainer.json';
      case 'dockerfile':
        return 'Dockerfile';
      case 'docker-compose':
        return 'docker-compose.yml';
      default:
        return '';
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getContent());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadFile = () => {
    const content = getContent();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getFileName().split('/').pop() || 'file.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const content = getContent();

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">Configuration Preview</h4>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-1"
          >
            {showPreview ? (
              <>
                <EyeSlash size={12} />
                <span className="text-xs">Hide</span>
              </>
            ) : (
              <>
                <Eye size={12} />
                <span className="text-xs">Show</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PreviewTab)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="devcontainer" className="gap-1 text-xs">
                  <FileCode size={12} />
                  devcontainer.json
                </TabsTrigger>
                <TabsTrigger value="dockerfile" className="gap-1 text-xs">
                  <Cube size={12} />
                  Dockerfile
                </TabsTrigger>
                <TabsTrigger value="docker-compose" className="gap-1 text-xs">
                  <FileCode size={12} />
                  docker-compose.yml
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-3">
                <div className="rounded-lg border bg-muted/50">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-muted">
                    <code className="text-xs text-muted-foreground">{getFileName()}</code>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={copyToClipboard}
                        className="h-7 w-7 p-0"
                      >
                        {copied ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={downloadFile}
                        className="h-7 w-7 p-0"
                      >
                        <DownloadSimple size={12} />
                      </Button>
                    </div>
                  </div>
                  <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed max-h-[400px] overflow-y-auto">
                    <code>{content}</code>
                  </pre>
                </div>
              </TabsContent>
            </Tabs>

            <p className="text-xs text-muted-foreground">
              These configuration files will be generated based on your selected template and settings.
              You can download them to customize further before deployment.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

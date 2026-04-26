/**
 * Environment Actions Component
 * 
 * Provides advanced actions for environments:
 * - Clone environment
 * - Export configuration
 * - Backup/Restore
 * - Sync files
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy,
  DownloadSimple,
  UploadSimple,
  Archive,
  ArrowCounterClockwise,
  GitBranch,
  FileCode,
  Cube,
  Check,
  X,
  CircleNotch,
  CaretDown,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { environmentApi } from '@/api/infrastructure';
import type { Environment, EnvironmentTemplate } from '@/api/infrastructure';

export interface EnvironmentActionsProps {
  environment: Environment;
  template?: EnvironmentTemplate;
  onClone?: (newEnv: Environment) => void;
  onExport?: (format: string, content: string) => void;
  className?: string;
}

type ExportFormat = 'json' | 'yaml' | 'docker-compose' | 'devcontainer';

export function EnvironmentActions({
  environment,
  template,
  onClone,
  onExport,
  className,
}: EnvironmentActionsProps) {
  const [isCloning, setIsCloning] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneName, setCloneName] = useState(`${environment.name}-clone`);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [copied, setCopied] = useState(false);

  const handleClone = async () => {
    setIsCloning(true);
    try {
      // Clone the environment with a new name
      const templateId = environment.templateId || environment.template_id;
      if (!templateId) {
        throw new Error('No template ID available');
      }
      const cloned = await environmentApi.provisionFromTemplate(
        templateId,
        cloneName,
        environment.targetVpsId
      );
      
      // Copy over configuration
      if (environment.envVars) {
        await environmentApi.update(cloned.id, {
          envVars: environment.envVars,
        });
      }
      
      onClone?.(cloned);
      setCloneDialogOpen(false);
    } catch (err) {
      console.error('Failed to clone environment:', err);
    } finally {
      setIsCloning(false);
    }
  };

  const generateExportContent = (format: ExportFormat): string => {
    switch (format) {
      case 'json':
        return JSON.stringify({
          name: environment.name,
          template_id: environment.templateId,
          type: environment.type,
          ports: environment.ports,
          resources: environment.resources,
          env_vars: environment.envVars,
          created_at: environment.createdAt,
        }, null, 2);

      case 'yaml':
        const yamlPorts = environment.ports || {};
        return `# Environment Configuration
# Name: ${environment.name}
# Created: ${environment.createdAt || environment.created_at}

name: ${environment.name}
template_id: ${environment.templateId || environment.template_id}
type: ${environment.type}
status: ${environment.status}

ports:
${Object.entries(yamlPorts).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

resources:
  memory: ${environment.resources?.memory || 'default'}
  cpu: ${environment.resources?.cpu || environment.resources?.cpus || 'default'}
  disk: ${environment.resources?.disk || 'default'}

environment_variables:
${Object.entries(environment.envVars || {}).map(([k, v]) => `  ${k}: ${v}`).join('\n')}
`;

      case 'docker-compose':
        const dcServiceName = environment.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const dcTemplateId = environment.templateId || environment.template_id || '';
        const dcPorts = environment.ports || {};
        return `version: '3.8'

# Environment: ${environment.name}
# Template: ${dcTemplateId}
# Exported: ${new Date().toISOString()}

services:
  ${dcServiceName}:
    image: ${getImageForTemplate(dcTemplateId)}
    container_name: ${dcServiceName}
    ports:
${Object.entries(dcPorts).map(([_, port]) => `      - "${port}:${port}"`).join('\n')}
    environment:
${Object.entries(environment.envVars || {}).map(([k, v]) => `      ${k}: "${v}"`).join('\n')}
    volumes:
      - ${dcServiceName}_data:/data
    restart: unless-stopped
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '${environment.resources?.cpu || environment.resources?.cpus || 1}'
          memory: ${environment.resources?.memory || '1G'}

volumes:
  ${dcServiceName}_data:
    driver: local
`;

      case 'devcontainer':
        const dcTemplateId2 = environment.templateId || environment.template_id || '';
        const dcPorts2 = environment.ports || {};
        return JSON.stringify({
          name: environment.name,
          image: getImageForTemplate(dcTemplateId2),
          forwardPorts: Object.values(dcPorts2),
          containerEnv: environment.envVars,
          runArgs: [
            '--cpus',
            String(environment.resources?.cpu || environment.resources?.cpus || 1),
            '--memory',
            environment.resources?.memory || '1g',
          ],
          postCreateCommand: 'echo "Environment ready"',
          customizations: {
            vscode: {
              settings: {
                'terminal.integrated.defaultProfile.linux': 'bash',
              },
            },
          },
        }, null, 2);

      default:
        return '';
    }
  };

  const getImageForTemplate = (templateId: string): string => {
    const images: Record<string, string> = {
      'allternit-platform-dev': 'mcr.microsoft.com/devcontainers/typescript-node:20',
      'allternit-agent-workspace': 'mcr.microsoft.com/devcontainers/python:3.11',
      'nodejs-typescript': 'mcr.microsoft.com/devcontainers/typescript-node:20',
      'python-ml': 'mcr.microsoft.com/devcontainers/python:3.11',
      'rust-systems': 'mcr.microsoft.com/devcontainers/rust:latest',
      'fullstack-web': 'mcr.microsoft.com/devcontainers/typescript-node:20',
    };
    return images[templateId] || 'mcr.microsoft.com/devcontainers/base:latest';
  };

  const getFileExtension = (format: ExportFormat): string => {
    switch (format) {
      case 'json':
      case 'devcontainer':
        return '.json';
      case 'yaml':
        return '.yaml';
      case 'docker-compose':
        return '.yml';
      default:
        return '.txt';
    }
  };

  const getFileName = (format: ExportFormat): string => {
    const baseName = environment.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    switch (format) {
      case 'devcontainer':
        return '.devcontainer/devcontainer.json';
      case 'docker-compose':
        return `docker-compose${getFileExtension(format)}`;
      default:
        return `${baseName}-environment${getFileExtension(format)}`;
    }
  };

  const handleExport = () => {
    const content = generateExportContent(exportFormat);
    onExport?.(exportFormat, content);
    
    // Download file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getFileName(exportFormat).split('/').pop() || 'export.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateExportContent(exportFormat));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Clone Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <GitBranch size={16} />
            Clone
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clone Environment</DialogTitle>
            <DialogDescription>
              Create a copy of <strong>{environment.name}</strong> with the same configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Environment Name</label>
              <Input
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="my-environment-clone"
              />
            </div>
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p className="font-medium">What will be cloned:</p>
              <ul className="text-muted-foreground space-y-0.5">
                <li>• Template configuration</li>
                <li>• Environment variables</li>
                <li>• Port mappings</li>
                <li>• Resource limits</li>
              </ul>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleClone} disabled={isCloning || !cloneName.trim()}>
              {isCloning ? (
                <>
                  <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
                  Cloning...
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Clone Environment
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <DownloadSimple size={16} />
            Export
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Export Environment</DialogTitle>
            <DialogDescription>
              Export <strong>{environment.name}</strong> configuration in various formats.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              {(['json', 'yaml', 'docker-compose', 'devcontainer'] as ExportFormat[]).map((format) => (
                <Button
                  key={format}
                  variant={exportFormat === format ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExportFormat(format)}
                  className="flex-1 text-xs capitalize"
                >
                  {format === 'json' && <FileCode className="w-3 h-3 mr-1" />}
                  {format === 'yaml' && <FileCode className="w-3 h-3 mr-1" />}
                  {format === 'docker-compose' && <Cube className="w-3 h-3 mr-1" />}
                  {format === 'devcontainer' && <FileCode className="w-3 h-3 mr-1" />}
                  {format.replace('-', ' ')}
                </Button>
              ))}
            </div>

            <div className="rounded-lg border bg-muted">
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <code className="text-xs text-muted-foreground">{getFileName(exportFormat)}</code>
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
                </div>
              </div>
              <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed max-h-[300px] overflow-y-auto">
                <code>{generateExportContent(exportFormat)}</code>
              </pre>
            </div>

            <p className="text-xs text-muted-foreground">
              {exportFormat === 'json' && 'Standard JSON format for environment metadata.'}
              {exportFormat === 'yaml' && 'Human-readable YAML configuration.'}
              {exportFormat === 'docker-compose' && 'Docker Compose file for standalone deployment.'}
              {exportFormat === 'devcontainer' && 'VS Code Dev Container configuration.'}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={handleExport}>
              <DownloadSimple className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* More Actions Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <CaretDown size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => environment.url && window.open(environment.url, '_blank')}
            disabled={!environment.url}
          >
            <ArrowSquareOut className="w-4 h-4 mr-2" />
            Open in Browser
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              // Trigger sync dialog
            }}
          >
            <UploadSimple className="w-4 h-4 mr-2" />
            Sync Files...
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              // Trigger backup dialog
            }}
          >
            <Archive className="w-4 h-4 mr-2" />
            Create Backup...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

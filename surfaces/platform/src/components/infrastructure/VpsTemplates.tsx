/**
 * VPS Templates Component
 * 
 * Save and manage VPS configurations as reusable templates:
 * - Save current VPS config as template
 * - Apply templates to new VPS connections
 * - Template library with categories
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  FloppyDisk,
  Copy,
  Trash,
  PencilSimple,
  HardDrives,
  HardDrive,
  Cpu,
  Globe,
  Check,
  X,
  MagnifyingGlass,
  Folder,
  Tag,
  DotsThreeVertical,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { VPSConnection } from '@/api/infrastructure/vps';

export interface VpsTemplate {
  id: string;
  name: string;
  description: string;
  category: 'development' | 'production' | 'testing' | 'custom';
  tags: string[];
  config: {
    port: number;
    username: string;
    authType: 'key' | 'password';
  };
  resources?: {
    cpu?: number | string;
    memory?: number | string;
    disk?: number | string;
  };
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

export interface VpsTemplatesProps {
  templates: VpsTemplate[];
  onTemplatesChange: (templates: VpsTemplate[]) => void;
  onApplyTemplate?: (template: VpsTemplate) => void;
  className?: string;
}

const CATEGORIES: Record<string, { label: string; color: string }> = {
  development: { label: 'Development', color: 'bg-blue-500/10 text-blue-600' },
  production: { label: 'Production', color: 'bg-green-500/10 text-green-600' },
  testing: { label: 'Testing', color: 'bg-yellow-500/10 text-yellow-600' },
  custom: { label: 'Custom', color: 'bg-purple-500/10 text-purple-600' },
};

export function VpsTemplates({
  templates,
  onTemplatesChange,
  onApplyTemplate,
  className,
}: VpsTemplatesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingTemplate, setEditingTemplate] = useState<VpsTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTag, setNewTag] = useState('');

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((t) =>
        t.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesCategory =
      selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const createTemplate = (
    name: string,
    vpsConnection?: VPSConnection
  ): VpsTemplate => ({
    id: `template-${Date.now()}`,
    name,
    description: '',
    category: 'custom',
    tags: [],
    config: {
      port: vpsConnection?.port || 22,
      username: vpsConnection?.username || 'root',
      authType: 'key',
    },
    resources: vpsConnection?.resources,
    createdAt: new Date(),
    updatedAt: new Date(),
    usageCount: 0,
  });

  const handleSave = () => {
    if (!editingTemplate) return;

    const updatedTemplate = {
      ...editingTemplate,
      updatedAt: new Date(),
    };

    const existingIndex = templates.findIndex((t) => t.id === updatedTemplate.id);
    let newTemplates: VpsTemplate[];

    if (existingIndex >= 0) {
      newTemplates = [...templates];
      newTemplates[existingIndex] = updatedTemplate;
    } else {
      newTemplates = [...templates, updatedTemplate];
    }

    onTemplatesChange(newTemplates);
    setIsDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleDelete = (templateId: string) => {
    onTemplatesChange(templates.filter((t) => t.id !== templateId));
  };

  const handleDuplicate = (template: VpsTemplate) => {
    const duplicated: VpsTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      name: `${template.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    };
    onTemplatesChange([...templates, duplicated]);
  };

  const openNewTemplate = () => {
    setEditingTemplate(createTemplate('New Template'));
    setIsDialogOpen(true);
  };

  const openEditTemplate = (template: VpsTemplate) => {
    setEditingTemplate({ ...template });
    setIsDialogOpen(true);
  };

  const addTag = () => {
    if (!newTag.trim() || !editingTemplate) return;
    if (!editingTemplate.tags.includes(newTag.trim())) {
      setEditingTemplate({
        ...editingTemplate,
        tags: [...editingTemplate.tags, newTag.trim()],
      });
    }
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      tags: editingTemplate.tags.filter((t) => t !== tag),
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Folder size={16} />
            VPS Templates
          </h3>
          <p className="text-xs text-muted-foreground">
            Reusable VPS configuration templates
          </p>
        </div>
        <Button size="sm" onClick={openNewTemplate} className="gap-2">
          <Plus size={16} />
          New Template
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="development">Development</SelectItem>
            <SelectItem value="production">Production</SelectItem>
            <SelectItem value="testing">Testing</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Card className="bg-muted/50">
          <CardContent className="py-8 text-center">
            <Folder className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {templates.length === 0
                ? 'No templates created yet'
                : 'No templates match your search'}
            </p>
            {templates.length === 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={openNewTemplate}
                className="mt-3"
              >
                Create your first template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence>
            {filteredTemplates.map((template) => (
              <motion.div
                key={template.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group p-4 rounded-lg border bg-card hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <HardDrives className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium truncate">
                        {template.name}
                      </span>
                    </div>
                    
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge
                        className={cn(
                          'text-[10px]',
                          CATEGORIES[template.category].color
                        )}
                      >
                        {CATEGORIES[template.category].label}
                      </Badge>
                      
                      {template.tags.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-[10px]"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {template.tags.length > 3 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{template.tags.length - 3}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Globe size={12} />
                        Port {template.config.port}
                      </span>
                      <span className="flex items-center gap-1">
                        <Cpu size={12} />
                        {template.resources?.cpu || '-'} CPUs
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive size={12} />
                        {template.resources?.memory || '-'}GB RAM
                      </span>
                    </div>

                    {template.usageCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Used {template.usageCount} times • Last used:{' '}
                        {new Date(template.updatedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onApplyTemplate?.(template)}
                      className="h-8 text-xs"
                    >
                      Apply
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                        >
                          <DotsThreeVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => openEditTemplate(template)}
                        >
                          <PencilSimple className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(template)}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(template.id)}
                          className="text-red-600"
                        >
                          <Trash className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Template Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate?.id && templates.find((t) => t.id === editingTemplate.id)
                ? 'Edit Template'
                : 'New VPS Template'}
            </DialogTitle>
            <DialogDescription>
              Save VPS configuration as a reusable template.
            </DialogDescription>
          </DialogHeader>

          {editingTemplate && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Template Name</label>
                <Input
                  value={editingTemplate.name}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      name: e.target.value,
                    })
                  }
                  placeholder="e.g., Production Web Server"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={editingTemplate.description}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      description: e.target.value,
                    })
                  }
                  placeholder="What is this template for?"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={editingTemplate.category}
                  onValueChange={(v) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      category: v as VpsTemplate['category'],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="testing">Testing</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tags</label>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag()}
                    placeholder="Add tag..."
                  />
                  <Button size="sm" variant="outline" onClick={addTag}>
                    <Tag size={16} />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {editingTemplate.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-xs cursor-pointer"
                      onClick={() => removeTag(tag)}
                    >
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Configuration</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Port</label>
                    <Input
                      type="number"
                      value={editingTemplate.config.port}
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          config: {
                            ...editingTemplate.config,
                            port: parseInt(e.target.value) || 22,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Username</label>
                    <Input
                      value={editingTemplate.config.username}
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          config: {
                            ...editingTemplate.config,
                            username: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!editingTemplate?.name.trim()}
            >
              <FloppyDisk className="w-4 h-4 mr-2" />
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

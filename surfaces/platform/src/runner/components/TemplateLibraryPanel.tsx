"use client";

import React, { useState } from "react";
import { useDakStore } from "../dak.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileCode,
  MagnifyingGlass,
  Tag,
  Play,
  Copy,
  Check,
  ArrowsClockwise,
  Code,
  User,
  GitBranch,
  FileText,
  Repeat,
  Trash,
  Shield,
  CaretRight,
  Function,
} from '@phosphor-icons/react';
import type { PromptTemplate, TemplateCategory } from "../dak.types";

const CATEGORY_ICONS: Record<TemplateCategory, any> = {
  core: Code,
  roles: User,
  orchestration: GitBranch,
  planning: FileText,
  cleanup: Trash,
  control_flow: Repeat,
  evidence: Shield,
};

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  core: "Core",
  roles: "Roles",
  orchestration: "Orchestration",
  planning: "Planning",
  cleanup: "Cleanup",
  control_flow: "Control Flow",
  evidence: "Evidence",
};

export function TemplateLibraryPanel() {
  const { 
    templates, 
    selectedTemplateId,
    templateVariables,
    isLoading,
    selectTemplate,
    setTemplateVariable,
    executeTemplate 
  } = useDakStore();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | "all">("all");
  const [copied, setCopied] = useState(false);
  
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  
  const filteredTemplates = templates.filter((template) => {
    if (selectedCategory !== "all" && template.category !== selectedCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.tags.some((t) => t.toLowerCase().includes(query))
      );
    }
    return true;
  });
  
  const categories = ["all", ...Array.from(new Set(templates.map((t) => t.category)))] as const;
  
  const handleCopy = () => {
    if (!selectedTemplate) return;
    let text = selectedTemplate.template;
    selectedTemplate.variables.forEach((v) => {
      const value = templateVariables[v.name] || v.defaultValue || `{{${v.name}}}`;
      text = text.replace(new RegExp(`{{${v.name}}}`, 'g'), String(value));
    });
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleExecute = async () => {
    if (!selectedTemplate) return;
    try {
      await executeTemplate({
        templateId: selectedTemplate.id,
        variables: templateVariables,
      });
    } catch (err) {
      // Error handled in store
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b space-y-4">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlass className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates by name, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const Icon = cat === "all" ? FileCode : CATEGORY_ICONS[cat as TemplateCategory];
            return (
              <Badge
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setSelectedCategory(cat)}
              >
                <Icon className="w-3 h-3 mr-1" />
                {cat === "all" ? "All Templates" : CATEGORY_LABELS[cat as TemplateCategory]}
              </Badge>
            );
          })}
        </div>
      </div>
      
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-hidden">
        {/* Template List */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileCode size={16} /> Templates
              </span>
              <Badge variant="secondary">{filteredTemplates.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredTemplates.map((template) => {
                  const Icon = CATEGORY_ICONS[template.category];
                  return (
                    <div
                      key={template.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedTemplateId === template.id 
                          ? 'bg-primary/10 border-primary' 
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => selectTemplate(template.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm flex-1">{template.name}</span>
                        <Badge variant="outline" className="text-xs">v{template.version}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* Template Editor */}
        <Card className="flex flex-col">
          {selectedTemplate ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{selectedTemplate.name}</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCopy}>
                      {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                    <Button size="sm" onClick={handleExecute} disabled={isLoading}>
                      <Play className="w-4 h-4 mr-1" /> Execute
                    </Button>
                  </div>
                </div>
                <CardDescription>{selectedTemplate.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                <div className="space-y-4">
                  {/* Variables */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Function size={16} /> Variables
                    </h4>
                    <div className="space-y-3">
                      {selectedTemplate.variables.map((variable) => (
                        <div key={variable.name}>
                          <label className="text-sm text-muted-foreground flex items-center gap-2">
                            {variable.name}
                            {variable.required && <Badge variant="destructive" className="text-[10px]">Required</Badge>}
                          </label>
                          {variable.type === "string" && variable.name.length > 50 ? (
                            <Textarea
                              value={String(templateVariables[variable.name] || variable.defaultValue || "")}
                              onChange={(e) => setTemplateVariable(variable.name, e.target.value)}
                              placeholder={variable.description}
                              rows={3}
                              className="mt-1"
                            />
                          ) : (
                            <Input
                              value={String(templateVariables[variable.name] || variable.defaultValue || "")}
                              onChange={(e) => setTemplateVariable(variable.name, e.target.value)}
                              placeholder={variable.description}
                              className="mt-1"
                            />
                          )}
                          <p className="text-xs text-muted-foreground mt-1">{variable.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Preview */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Preview</h4>
                    <div className="p-3 bg-muted rounded-lg font-mono text-sm whitespace-pre-wrap">
                      {renderTemplatePreview(selectedTemplate, templateVariables)}
                    </div>
                  </div>
                  
                  {/* Raw Template */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Raw Template</h4>
                    <div className="p-3 bg-muted rounded-lg font-mono text-xs whitespace-pre-wrap">
                      {selectedTemplate.template}
                    </div>
                  </div>
                  
                  {/* Metadata */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>ID: <span className="font-mono">{selectedTemplate.id}</span></span>
                      <span>Version: {selectedTemplate.version}</span>
                      <span>Vars: {selectedTemplate.variables.length}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileCode className="w-16 h-16 mb-4 opacity-30" />
              <p>Select a template to view and edit</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function renderTemplatePreview(template: PromptTemplate, variables: Record<string, unknown>): string {
  let text = template.template;
  template.variables.forEach((v) => {
    const value = variables[v.name] || v.defaultValue || `{{${v.name}}}`;
    text = text.replace(new RegExp(`{{${v.name}}}`, 'g'), String(value));
  });
  return text;
}

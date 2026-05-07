/**
 * IVKGE Panel Component
 * 
 * Visual Knowledge Graph Extraction interface:
 * - Image upload
 * - Entity/relationship extraction
 * - User corrections
 * - Ambiguity resolution
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  UploadSimple,
  Image,
  MagnifyingGlass,
  CheckCircle,
  Warning,
  PencilSimple,
  FloppyDisk,
  X,
} from '@phosphor-icons/react';

// Types
interface Entity {
  entity_id: string;
  name: string;
  entity_type: string;
  confidence: number;
  bounding_box?: { x: number; y: number; width: number; height: number };
  properties: Record<string, string>;
}

interface Relationship {
  relationship_id: string;
  source_entity: string;
  target_entity: string;
  relationship_type: string;
  confidence: number;
  label?: string;
}

interface ExtractionRecord {
  extraction_id: string;
  source_type: string;
  entities: Entity[];
  relationships: Relationship[];
  ocr_text?: string;
  ambiguity_report?: {
    report_id: string;
    ambiguities: Array<{
      ambiguity_id: string;
      ambiguity_type: string;
      description: string;
      options: string[];
    }>;
    overall_confidence: number;
  };
  created_at: string;
}

const API_BASE = '/api/v1/ivkge';

export function IVKGEPanel() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [activeTab, setActiveTab] = useState('upload');

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setError(null);
    }
  };

  // Upload and extract
  const handleExtract = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setError(null);

      // Upload file
      const formData = new FormData();
      formData.append('image', selectedFile);

      const uploadRes = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }

      const uploadData = await uploadRes.json();

      // Extract entities
      setExtracting(true);
      const extractRes = await fetch(`${API_BASE}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_id: uploadData.upload_id,
          extraction_type: 'screenshot',
          options: {
            include_ocr: true,
            detect_ambiguities: true,
          },
        }),
      });

      if (!extractRes.ok) {
        throw new Error('Extraction failed');
      }

      const result = await extractRes.json();
      setExtraction(result);
      setActiveTab('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  };

  // Apply correction
  const handleCorrection = async (entityId: string, changes: Record<string, string>) => {
    try {
      const res = await fetch(`${API_BASE}/corrections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extraction_id: extraction?.extraction_id,
          correction_type: 'modify_entity',
          entity_id: entityId,
          changes,
        }),
      });

      if (res.ok) {
        // Refresh extraction
        if (extraction) {
          try {
            const updated = await fetch(`${API_BASE}/extractions/${extraction.extraction_id}`);
            if (!updated.ok) throw new Error(`Failed to refresh: ${updated.status}`);
            const data = await updated.json();
            setExtraction(data);
          } catch (refreshErr) {
            console.error('Failed to refresh extraction:', refreshErr);
          }
        }
        setEditingEntity(null);
      }
    } catch (err) {
      console.error('Correction failed:', err);
    }
  };

  // Resolve ambiguity
  const handleResolveAmbiguity = async (ambiguityId: string, selectedOption: number) => {
    try {
      const res = await fetch(`${API_BASE}/ambiguities/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extraction_id: extraction?.extraction_id,
          ambiguity_id: ambiguityId,
          selected_option: selectedOption,
        }),
      });

      if (res.ok) {
        // Refresh to show resolved state
        if (extraction) {
          try {
            const updated = await fetch(`${API_BASE}/extractions/${extraction.extraction_id}`);
            if (!updated.ok) throw new Error(`Failed to refresh: ${updated.status}`);
            const data = await updated.json();
            setExtraction(data);
          } catch (refreshErr) {
            console.error('Failed to refresh extraction:', refreshErr);
          }
        }
      }
    } catch (err) {
      console.error('Resolution failed:', err);
    }
  };

  // Cleanup preview URL
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">IVKGE Panel</h1>
          <p className="text-muted-foreground">
            Visual Knowledge Graph Extraction
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-500">
              <Warning size={20} />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          {(TabsTrigger as any)({ value: "results", disabled: !extraction, children: "Results" })}
          {(TabsTrigger as any)({ value: "ambiguities", disabled: !extraction?.ambiguity_report, children: "Ambiguities" })},
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Image for Extraction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Upload Area */}
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <UploadSimple className="h-12 w-12 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {selectedFile ? selectedFile.name : 'Click to upload or drag and drop'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    PNG, JPG, WEBP up to 10MB
                  </span>
                </Label>
              </div>

              {/* Preview */}
              {previewUrl && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="relative rounded-lg overflow-hidden border">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-96 w-auto object-contain mx-auto"
                    />
                  </div>
                </div>
              )}

              {/* Extract Button */}
              <div className="flex gap-2">
                <Button
                  onClick={handleExtract}
                  disabled={!selectedFile || uploading || extracting}
                  className="flex-1"
                >
                  {uploading ? (
                    'Uploading...'
                  ) : extracting ? (
                    'Extracting...'
                  ) : (
                    <>
                      <MagnifyingGlass className="h-4 w-4 mr-2" />
                      Extract Entities
                    </>
                  )}
                </Button>
                {selectedFile && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          {extraction && (
            <>
              {/* Entities */}
              <Card>
                <CardHeader>
                  <CardTitle>Entities ({extraction.entities?.length ?? 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  {(extraction.entities?.length ?? 0) === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Image className="h-12 w-12 mx-auto mb-4" />
                      <p>No entities detected</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {extraction.entities?.map((entity) => (
                        <Card key={entity.entity_id}>
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <CardTitle className="text-lg">{entity.name}</CardTitle>
                              <Badge variant="outline">{entity.entity_type}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="text-sm text-muted-foreground">
                              Confidence: {(entity.confidence * 100).toFixed(0)}%
                            </div>
                            {entity.bounding_box && (
                              <div className="text-xs text-muted-foreground font-mono">
                                [{entity.bounding_box.x}, {entity.bounding_box.y}] 
                                {entity.bounding_box.width}x{entity.bounding_box.height}
                              </div>
                            )}
                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingEntity(entity)}
                              >
                                <PencilSimple className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Relationships */}
              <Card>
                <CardHeader>
                  <CardTitle>Relationships ({extraction.relationships?.length ?? 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  {(extraction.relationships?.length ?? 0) === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No relationships detected</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {extraction.relationships?.map((rel) => (
                        <div
                          key={rel.relationship_id}
                          className="flex items-center gap-2 p-3 border rounded-lg"
                        >
                          <Badge variant="outline">{rel.source_entity}</Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge variant="secondary">{rel.relationship_type}</Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge variant="outline">{rel.target_entity}</Badge>
                          {rel.label && (
                            <Badge>"{rel.label}"</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* OCR Text */}
              {extraction.ocr_text && (
                <Card>
                  <CardHeader>
                    <CardTitle>OCR Text</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={extraction.ocr_text}
                      readOnly
                      className="min-h-32 font-mono text-sm"
                    />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Ambiguities Tab */}
        <TabsContent value="ambiguities" className="space-y-4">
          {extraction?.ambiguity_report && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Ambiguities ({extraction.ambiguity_report.ambiguities?.length ?? 0})
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Overall Confidence: {(extraction.ambiguity_report.overall_confidence * 100).toFixed(0)}%
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {extraction.ambiguity_report.ambiguities?.map((ambiguity) => (
                  <Card key={ambiguity.ambiguity_id}>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Warning className="h-5 w-5 text-yellow-500" />
                        <CardTitle className="text-base">
                          {ambiguity.ambiguity_type}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm">{ambiguity.description}</p>
                      <div className="flex gap-2 flex-wrap">
                        {ambiguity.options.map((option, idx) => (
                          <Button
                            key={idx}
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveAmbiguity(ambiguity.ambiguity_id, idx)}
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Entity Edit Dialog */}
      {editingEntity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit Entity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  defaultValue={editingEntity.name}
                  id="edit-name"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Input
                  defaultValue={editingEntity.entity_type}
                  id="edit-type"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const name = (document.getElementById('edit-name') as HTMLInputElement).value;
                    const type = (document.getElementById('edit-type') as HTMLInputElement).value;
                    handleCorrection(editingEntity.entity_id, { name, entity_type: type });
                  }}
                >
                  <FloppyDisk className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditingEntity(null)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default IVKGEPanel;

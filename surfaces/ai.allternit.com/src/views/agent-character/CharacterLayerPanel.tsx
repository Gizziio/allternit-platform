"use client";

import { useEffect, useMemo, useState } from "react";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { CharacterLayerConfig, RoleHardBan } from "@/lib/agents/character.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Warning,
  CheckCircle,
  Plus,
  Sparkle,
  Trash,
} from '@phosphor-icons/react';

function toMultiline(values: string[]): string {
  return values.join("\n");
}

function fromMultiline(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function toCsv(values: string[]): string {
  return values.join(", ");
}

function fromCsv(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function cloneConfig(config: CharacterLayerConfig): CharacterLayerConfig {
  return JSON.parse(JSON.stringify(config)) as CharacterLayerConfig;
}

function newHardBan(): RoleHardBan {
  return {
    id: crypto.randomUUID(),
    label: "New hard ban",
    category: "other",
    description: "",
    severity: "critical",
    enforcement: "tool-block",
    triggerPhrases: [],
  };
}

export function CharacterLayerPanel({ agentId }: { agentId: string }) {
  const {
    agents,
    character,
    compiledCharacter,
    characterArtifacts,
    characterStats,
    isCompilingCharacter,
    loadCharacterLayer,
    saveCharacterLayer,
    compileCharacterLayer,
  } = useAgentStore();

  const config = character[agentId];
  const compiled = compiledCharacter[agentId];
  const artifacts = characterArtifacts[agentId] || [];
  const stats = characterStats[agentId];

  const [draft, setDraft] = useState<CharacterLayerConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const agentName = useMemo(() => agents.find((a) => a.id === agentId)?.name || agentId, [agents, agentId]);

  useEffect(() => {
    if (!config) {
      loadCharacterLayer(agentId);
    }
  }, [agentId, config, loadCharacterLayer]);

  useEffect(() => {
    if (config) {
      setDraft(cloneConfig(config));
      setDirty(false);
    }
  }, [config]);

  const update = (updater: (prev: CharacterLayerConfig) => CharacterLayerConfig) => {
    setDraft((prev) => {
      if (!prev) return prev;
      setDirty(true);
      return updater(prev);
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    await saveCharacterLayer(agentId, draft);
    setDirty(false);
  };

  const handleCompile = async () => {
    if (!draft) return;
    await saveCharacterLayer(agentId, draft);
    await compileCharacterLayer(agentId);
    setDirty(false);
  };

  if (!draft) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading character layer for {agentName}...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkle className="w-5 h-5 text-primary" />
            Character Layer
          </h3>
          <p className="text-sm text-muted-foreground">
            Compiler-style agent config artifacts: role cards, bans, voice, relationships, progression, avatar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <Badge variant="outline">Unsaved changes</Badge>}
          <Button variant="outline" onClick={handleSave} disabled={!dirty}>
            Save
          </Button>
          <Button onClick={handleCompile} disabled={isCompilingCharacter}>
            {isCompilingCharacter ? "Compiling..." : "Compile"}
          </Button>
        </div>
      </div>

      {compiled && (
        <Card>
          <CardContent className="p-4 space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">hash: {compiled.hash}</Badge>
            <Badge variant="outline">compiled: {new Date(compiled.compiledAt).toLocaleString()}</Badge>
            {stats && (
              <>
                <Badge variant="outline">class: {stats.class}</Badge>
                <Badge variant="outline">level: {stats.level}</Badge>
                {stats.relevantStats.slice(0, 4).map((key) => (
                  <Badge key={key} variant="outline">
                    {key}: {stats.stats[key] ?? 0}
                  </Badge>
                ))}
              </>
            )}
            </div>
            {stats && stats.statDefinitions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {stats.statDefinitions
                  .filter((definition) => stats.relevantStats.includes(definition.key))
                  .slice(0, 4)
                  .map((definition) => (
                    <div key={definition.key} className="rounded border p-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{definition.label}</span>
                        <span>{stats.stats[definition.key] ?? 0}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Signals: {definition.signals.join(", ")}
                      </p>
                    </div>
                  ))}
              </div>
            )}
            {stats && Object.keys(stats.specialtyScores).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {Object.entries(stats.specialtyScores).map(([skill, value]) => (
                  <Badge key={skill} variant="secondary" className="text-[11px]">
                    {skill}: {value}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="role" className="space-y-3">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="role">Role Card</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          <TabsTrigger value="progression">Progression</TabsTrigger>
          <TabsTrigger value="avatar">Avatar</TabsTrigger>
          <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
        </TabsList>

        <TabsContent value="role" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role Card</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Domain</Label>
                <Textarea
                  value={draft.roleCard.domain}
                  onChange={(e) => update((prev) => ({ ...prev, roleCard: { ...prev.roleCard, domain: e.target.value } }))}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Inputs (one per line)</Label>
                  <Textarea
                    value={toMultiline(draft.roleCard.inputs)}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        roleCard: { ...prev.roleCard, inputs: fromMultiline(e.target.value) },
                      }))
                    }
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Outputs (one per line)</Label>
                  <Textarea
                    value={toMultiline(draft.roleCard.outputs)}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        roleCard: { ...prev.roleCard, outputs: fromMultiline(e.target.value) },
                      }))
                    }
                    rows={4}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Definition of Done (one per line)</Label>
                  <Textarea
                    value={toMultiline(draft.roleCard.definitionOfDone)}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        roleCard: { ...prev.roleCard, definitionOfDone: fromMultiline(e.target.value) },
                      }))
                    }
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Escalation triggers (one per line)</Label>
                  <Textarea
                    value={toMultiline(draft.roleCard.escalation)}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        roleCard: { ...prev.roleCard, escalation: fromMultiline(e.target.value) },
                      }))
                    }
                    rows={4}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Metrics (one per line)</Label>
                <Textarea
                  value={toMultiline(draft.roleCard.metrics)}
                  onChange={(e) =>
                    update((prev) => ({
                      ...prev,
                      roleCard: { ...prev.roleCard, metrics: fromMultiline(e.target.value) },
                    }))
                  }
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Hard Bans
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update((prev) => ({
                      ...prev,
                      roleCard: {
                        ...prev.roleCard,
                        hardBans: [...prev.roleCard.hardBans, newHardBan()],
                      },
                    }))
                  }
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Ban
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft.roleCard.hardBans.map((ban, index) => (
                <div key={ban.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={ban.label}
                      onChange={(e) =>
                        update((prev) => {
                          const next = [...prev.roleCard.hardBans];
                          next[index] = { ...next[index], label: e.target.value };
                          return { ...prev, roleCard: { ...prev.roleCard, hardBans: next } };
                        })
                      }
                      placeholder="Ban label"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        update((prev) => ({
                          ...prev,
                          roleCard: {
                            ...prev.roleCard,
                            hardBans: prev.roleCard.hardBans.filter((b) => b.id !== ban.id),
                          },
                        }))
                      }
                    >
                      <Trash size={16} />
                    </Button>
                  </div>
                  <Textarea
                    value={ban.description}
                    onChange={(e) =>
                      update((prev) => {
                        const next = [...prev.roleCard.hardBans];
                        next[index] = { ...next[index], description: e.target.value };
                        return { ...prev, roleCard: { ...prev.roleCard, hardBans: next } };
                      })
                    }
                    placeholder="What is explicitly forbidden?"
                    rows={2}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs">Category</Label>
                      <Select
                        value={ban.category}
                        onValueChange={(value) =>
                          update((prev) => {
                            const next = [...prev.roleCard.hardBans];
                            next[index] = { ...next[index], category: value as RoleHardBan["category"] };
                            return { ...prev, roleCard: { ...prev.roleCard, hardBans: next } };
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="publishing">publishing</SelectItem>
                          <SelectItem value="deploy">deploy</SelectItem>
                          <SelectItem value="data_exfil">data_exfil</SelectItem>
                          <SelectItem value="payments">payments</SelectItem>
                          <SelectItem value="email_send">email_send</SelectItem>
                          <SelectItem value="file_delete">file_delete</SelectItem>
                          <SelectItem value="other">other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Severity</Label>
                      <Select
                        value={ban.severity}
                        onValueChange={(value) =>
                          update((prev) => {
                            const next = [...prev.roleCard.hardBans];
                            next[index] = { ...next[index], severity: value as RoleHardBan["severity"] };
                            return { ...prev, roleCard: { ...prev.roleCard, hardBans: next } };
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="warning">warning</SelectItem>
                          <SelectItem value="critical">critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Enforcement</Label>
                      <Select
                        value={ban.enforcement}
                        onValueChange={(value) =>
                          update((prev) => {
                            const next = [...prev.roleCard.hardBans];
                            next[index] = { ...next[index], enforcement: value as RoleHardBan["enforcement"] };
                            return { ...prev, roleCard: { ...prev.roleCard, hardBans: next } };
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tool-block">tool-block</SelectItem>
                          <SelectItem value="prompt-only">prompt-only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Trigger phrases</Label>
                      <Input
                        value={toCsv(ban.triggerPhrases)}
                        onChange={(e) =>
                          update((prev) => {
                            const next = [...prev.roleCard.hardBans];
                            next[index] = { ...next[index], triggerPhrases: fromCsv(e.target.value) };
                            return { ...prev, roleCard: { ...prev.roleCard, hardBans: next } };
                          })
                        }
                        placeholder="comma,separated"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Voice Directives</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Style</Label>
                <Input
                  value={draft.voice.style}
                  onChange={(e) => update((prev) => ({ ...prev, voice: { ...prev.voice, style: e.target.value } }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Rules (one per line)</Label>
                <Textarea
                  value={toMultiline(draft.voice.rules)}
                  onChange={(e) => update((prev) => ({ ...prev, voice: { ...prev.voice, rules: fromMultiline(e.target.value) } }))}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Micro-bans (one per line)</Label>
                <Textarea
                  value={toMultiline(draft.voice.microBans)}
                  onChange={(e) => update((prev) => ({ ...prev, voice: { ...prev.voice, microBans: fromMultiline(e.target.value) } }))}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Prefer challenge with (comma-separated agent IDs)</Label>
                <Input
                  value={toCsv(draft.voice.conflictBias.prefersChallengeWith)}
                  onChange={(e) =>
                    update((prev) => ({
                      ...prev,
                      voice: {
                        ...prev.voice,
                        conflictBias: { prefersChallengeWith: fromCsv(e.target.value) },
                      },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relationships" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Affinity Matrix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Affinity floor</Label>
                  <Input
                    type="number"
                    min={0.1}
                    max={0.95}
                    step={0.01}
                    value={draft.relationships.defaults.affinityFloor}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        relationships: {
                          ...prev.relationships,
                          defaults: {
                            ...prev.relationships.defaults,
                            affinityFloor: Number(e.target.value),
                          },
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Affinity ceiling</Label>
                  <Input
                    type="number"
                    min={0.1}
                    max={0.95}
                    step={0.01}
                    value={draft.relationships.defaults.affinityCeiling}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        relationships: {
                          ...prev.relationships,
                          defaults: {
                            ...prev.relationships.defaults,
                            affinityCeiling: Number(e.target.value),
                          },
                        },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <Label>Pair overrides</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update((prev) => ({
                      ...prev,
                      relationships: {
                        ...prev.relationships,
                        pairs: [
                          ...prev.relationships.pairs,
                          { agentA: agentId, agentB: agentId, affinity: 0.5 },
                        ],
                      },
                    }))
                  }
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Pair
                </Button>
              </div>

              <div className="space-y-2">
                {draft.relationships.pairs.map((pair, index) => (
                  <div key={`${pair.agentA}-${pair.agentB}-${index}`} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      <Label className="text-xs">Agent A</Label>
                      <Select
                        value={pair.agentA}
                        onValueChange={(value) =>
                          update((prev) => {
                            const next = [...prev.relationships.pairs];
                            next[index] = { ...next[index], agentA: value };
                            return { ...prev, relationships: { ...prev.relationships, pairs: next } };
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {agents.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4">
                      <Label className="text-xs">Agent B</Label>
                      <Select
                        value={pair.agentB}
                        onValueChange={(value) =>
                          update((prev) => {
                            const next = [...prev.relationships.pairs];
                            next[index] = { ...next[index], agentB: value };
                            return { ...prev, relationships: { ...prev.relationships, pairs: next } };
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {agents.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Affinity</Label>
                      <Input
                        type="number"
                        min={0.1}
                        max={0.95}
                        step={0.01}
                        value={pair.affinity}
                        onChange={(e) =>
                          update((prev) => {
                            const next = [...prev.relationships.pairs];
                            next[index] = { ...next[index], affinity: Number(e.target.value) };
                            return { ...prev, relationships: { ...prev.relationships, pairs: next } };
                          })
                        }
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          update((prev) => ({
                            ...prev,
                            relationships: {
                              ...prev.relationships,
                              pairs: prev.relationships.pairs.filter((_, i) => i !== index),
                            },
                          }))
                        }
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progression" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Stats + Level Curve</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Class</Label>
                  <Input
                    value={draft.progression.class}
                    onChange={(e) => update((prev) => ({ ...prev, progression: { ...prev.progression, class: e.target.value } }))}
                  />
                </div>
                <div>
                  <Label>Max level</Label>
                  <Input
                    type="number"
                    min={1}
                    value={draft.progression.level.maxLevel}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        progression: {
                          ...prev.progression,
                          level: { ...prev.progression.level, maxLevel: Number(e.target.value) },
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Relevant stats</Label>
                  <Input
                    value={toCsv(draft.progression.relevantStats)}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        progression: { ...prev.progression, relevantStats: fromCsv(e.target.value) },
                      }))
                    }
                    placeholder="VRL,TRU,SPD"
                  />
                </div>
              </div>
              <div>
                <Label>XP formula</Label>
                <Input
                  value={draft.progression.level.xpFormula}
                  onChange={(e) =>
                    update((prev) => ({
                      ...prev,
                      progression: {
                        ...prev.progression,
                        level: { ...prev.progression.level, xpFormula: e.target.value },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Stat formulas</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      update((prev) => ({
                        ...prev,
                        progression: {
                          ...prev.progression,
                          stats: {
                            ...prev.progression.stats,
                            NEW: { source: "custom", formula: "clamp(x,0,99)" },
                          },
                        },
                      }))
                    }
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Stat
                  </Button>
                </div>
                {Object.entries(
                  draft.progression.stats as Record<string, { source: string; formula: string }>
                ).map(([key, rule]) => (
                  <div key={key} className="grid grid-cols-12 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">Key</Label>
                      <Input
                        value={key}
                        onChange={(e) =>
                          update((prev) => {
                            const next = { ...prev.progression.stats };
                            const value = next[key];
                            delete next[key];
                            next[e.target.value] = value;
                            return { ...prev, progression: { ...prev.progression, stats: next } };
                          })
                        }
                      />
                    </div>
                    <div className="col-span-4">
                      <Label className="text-xs">Source</Label>
                      <Input
                        value={rule.source}
                        onChange={(e) =>
                          update((prev) => ({
                            ...prev,
                            progression: {
                              ...prev.progression,
                              stats: {
                                ...prev.progression.stats,
                                [key]: { ...rule, source: e.target.value },
                              },
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="col-span-5">
                      <Label className="text-xs">Formula</Label>
                      <Input
                        value={rule.formula}
                        onChange={(e) =>
                          update((prev) => ({
                            ...prev,
                            progression: {
                              ...prev.progression,
                              stats: {
                                ...prev.progression.stats,
                                [key]: { ...rule, formula: e.target.value },
                              },
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="col-span-1 self-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          update((prev) => {
                            const next = { ...prev.progression.stats };
                            delete next[key];
                            return { ...prev, progression: { ...prev.progression, stats: next } };
                          })
                        }
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="avatar" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Avatar</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select
                    value={draft.avatar.type}
                    onValueChange={(value) => update((prev) => ({ ...prev, avatar: { ...prev.avatar, type: value as CharacterLayerConfig["avatar"]["type"] } }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="color">color</SelectItem>
                      <SelectItem value="image">image</SelectItem>
                      <SelectItem value="glb">glb</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>URI</Label>
                  <Input
                    value={draft.avatar.uri || ""}
                    onChange={(e) => update((prev) => ({ ...prev, avatar: { ...prev.avatar, uri: e.target.value } }))}
                    placeholder="assets://avatars/agent.glb"
                  />
                </div>
              </div>
              <div>
                <Label>Fallback color</Label>
                <Input
                  value={draft.avatar.fallbackColor}
                  onChange={(e) => update((prev) => ({ ...prev, avatar: { ...prev.avatar, fallbackColor: e.target.value } }))}
                  placeholder="#6B7280"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="artifacts" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compiler output</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!compiled ? (
                <Alert>
                  <Warning size={16} />
                  <AlertDescription>Compile to generate deterministic config artifacts.</AlertDescription>
                </Alert>
              ) : (
                <>
                  {compiled.lint.length === 0 ? (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <AlertDescription className="text-green-700">No lint issues.</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-2">
                      {compiled.lint.map((issue, i) => (
                        <Alert key={`${issue.code}-${i}`} className={issue.level === "error" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}>
                          <Warning size={16} />
                          <AlertDescription>
                            <span className="font-medium">{issue.level.toUpperCase()}</span> {issue.code}: {issue.message}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                  <ScrollArea className="h-[420px] rounded border">
                    <div className="p-3 space-y-3">
                      {artifacts.map((file) => (
                        <details key={file.path} className="rounded border">
                          <summary className="cursor-pointer px-3 py-2 text-sm font-medium bg-muted">{file.path}</summary>
                          <pre className="text-xs p-3 overflow-auto whitespace-pre-wrap">{file.content}</pre>
                        </details>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CharacterLayerPanel;

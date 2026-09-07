import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSkill, deleteSkill, listSkills, runSkill, type Skill } from '@/lib/skills/api';

interface SkillsPanelProps {
  onBack: () => void;
}

export function SkillsPanel({ onBack }: SkillsPanelProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goalTemplate, setGoalTemplate] = useState('');
  const [runParams, setRunParams] = useState<Record<string, string>>({});
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listSkills();
      setSkills(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!name.trim() || !goalTemplate.trim()) return;
    setError(null);
    try {
      await createSkill({
        name: name.trim(),
        description: description.trim() || undefined,
        goal_template: goalTemplate.trim(),
        parameters: {},
      });
      setName('');
      setDescription('');
      setGoalTemplate('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this skill?')) return;
    setError(null);
    try {
      await deleteSkill(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRun = async (skill: Skill) => {
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      for (const key of Object.keys(runParams)) {
        params[key] = runParams[key];
      }
      const result = await runSkill(skill.id, params);
      alert(`Rendered goal:\n${result.goal}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          ←
        </button>
        <span className="text-sm font-medium">Skills</span>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium text-foreground">Task recipes</p>
          <p className="text-[10px] text-muted-foreground">
            Save successful agent runs as reusable templates. Use {'{{parameter}}'} placeholders in
            the goal template.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium">Create skill</p>
          <div>
            <Label className="text-[10px] text-muted-foreground">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Daily newsletter digest"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this skill does"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Goal template</Label>
            <Input
              value={goalTemplate}
              onChange={(e) => setGoalTemplate(e.target.value)}
              placeholder="Go to {{site}} and summarize the top {{count}} posts"
              className="h-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            disabled={!name.trim() || !goalTemplate.trim()}
            onClick={handleSave}
            className="h-8 w-full text-xs"
          >
            Save skill
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium">Saved skills</p>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : skills.length === 0 ? (
            <p className="text-xs text-muted-foreground">No skills saved yet.</p>
          ) : (
            <div className="space-y-1.5">
              {skills.map((skill) => (
                <div key={skill.id} className="rounded-md border bg-muted/20 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium">{skill.name}</p>
                    <button
                      type="button"
                      onClick={() => handleDelete(skill.id)}
                      className="text-[10px] text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{skill.goal_template}</p>
                  {selectedSkill?.id === skill.id ? (
                    <div className="mt-2 space-y-1">
                      <Input
                        placeholder="parameters as JSON, e.g. {\"site\":\"example.com\"}"
                        className="h-7 text-xs"
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value) as Record<string, string>;
                            setRunParams(parsed);
                          } catch {
                            setRunParams({ raw: e.target.value });
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleRun(skill)} className="h-7 text-xs">
                          Run
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSkill(null)}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedSkill(skill)}
                      className="mt-1 text-[10px] text-primary hover:underline"
                    >
                      Run ({skill.run_count} runs)
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

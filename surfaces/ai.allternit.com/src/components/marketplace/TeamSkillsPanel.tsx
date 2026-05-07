import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Package, Plus, Trash2 } from 'lucide-react';

interface TeamSkill {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  version: string;
  installedBy: string;
  installedAt: string;
}

export function TeamSkillsPanel() {
  const { workspaces, activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore();
  const [skills, setSkills] = useState<TeamSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchSkills(activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  const fetchSkills = async (workspaceId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/team-skills?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSkills(data.skills || []);
    } catch (err) {
      console.error('Failed to fetch team skills:', err);
    } finally {
      setLoading(false);
    }
  };

  const installSkill = async () => {
    if (!activeWorkspaceId || !newName.trim()) return;
    try {
      const res = await fetch('/api/v1/team-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          name: newName.trim(),
          description: newDescription.trim(),
          version: '0.0.1',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNewName('');
      setNewDescription('');
      await fetchSkills(activeWorkspaceId);
    } catch (err) {
      console.error('Failed to install skill:', err);
    }
  };

  const uninstallSkill = async (id: string) => {
    try {
      await fetch(`/api/v1/team-skills/${id}`, { method: 'DELETE' });
      setSkills((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Failed to uninstall skill:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace selector */}
      <div className="flex items-center gap-4">
        <select
          value={activeWorkspaceId ?? ''}
          onChange={(e) => setActiveWorkspace(e.target.value || null)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
        >
          <option value="">Select workspace...</option>
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>{ws.name}</option>
          ))}
        </select>
      </div>

      {/* Install form */}
      {activeWorkspaceId && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <h3 className="text-sm font-semibold text-zinc-200">Install Team Skill</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Skill name"
                className="bg-zinc-950 border-zinc-800 text-zinc-200"
              />
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                className="bg-zinc-950 border-zinc-800 text-zinc-200 flex-1"
              />
              <Button onClick={installSkill} size="sm" className="bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skills list */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">Loading team skills...</div>
      ) : skills.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <Package className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
          <p className="text-sm">No team skills installed yet.</p>
          <p className="text-xs mt-1">Select a workspace and add your first skill.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <Card key={skill.id} className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-zinc-100 text-sm">{skill.name}</h4>
                    <p className="text-xs text-zinc-500 mt-1">{skill.description || 'No description'}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                        v{skill.version}
                      </Badge>
                      <span className="text-[10px] text-zinc-600">
                        {new Date(skill.installedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-600 hover:text-red-400"
                    onClick={() => uninstallSkill(skill.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

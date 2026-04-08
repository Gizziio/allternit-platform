"use client";

import React, { useState } from "react";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { Agent } from "@/lib/agents/agent.types";
import { 
  STUDIO_THEME 
} from "../AgentView.constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function EditAgentForm({ agent, onCancel }: { agent: Agent; onCancel: () => void }) {
  const { updateAgent } = useAgentStore();
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateAgent(agent.id, { name, description });
      onCancel();
    } catch (err) {
      console.error("Failed to update agent:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <div className="w-full max-w-md p-8 rounded-2xl border" style={{ background: STUDIO_THEME.bgCard, borderColor: STUDIO_THEME.borderSubtle }}>
        <h2 className="text-2xl font-serif mb-6" style={{ color: STUDIO_THEME.textPrimary }}>Edit Agent</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label style={{ color: STUDIO_THEME.textSecondary }}>Name</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
            />
          </div>
          <div className="space-y-2">
            <Label style={{ color: STUDIO_THEME.textSecondary }}>Description</Label>
            <Textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1" style={{ background: STUDIO_THEME.accent, color: '#1A1612' }}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

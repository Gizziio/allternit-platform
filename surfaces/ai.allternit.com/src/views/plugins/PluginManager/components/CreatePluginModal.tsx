import React, { useState } from 'react';

interface CreatePluginModalProps {
  onClose: () => void;
  onCreate: (plugin: { name: string; description: string }) => void;
}

export const CreatePluginModal: React.FC<CreatePluginModalProps> = ({
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--surface-panel)] rounded-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold mb-4">Create Plugin</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--ui-border-muted)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--ui-border-muted)] h-24 resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--ui-border-muted)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onCreate({ name, description }); onClose(); }}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

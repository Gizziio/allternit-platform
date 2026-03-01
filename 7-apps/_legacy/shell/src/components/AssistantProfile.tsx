import React, { useState } from 'react';
import { AssistantIdentity } from '../../shared/contracts';
import { api } from '../runtime/ApiClient';

interface Props {
  identity: AssistantIdentity | null;
  onUpdate: (identity: AssistantIdentity) => void;
}

export const AssistantProfile: React.FC<Props> = ({ identity, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<AssistantIdentity | null>(null);

  if (!identity) return <div className="assistant-profile loading">Loading...</div>;

  const handleEdit = () => {
    setEditForm({ ...identity });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editForm) {
      try {
        const updated = await api.updateAssistant(editForm);
        onUpdate(updated);
        setIsEditing(false);
      } catch (err) {
        console.error("Failed to save assistant", err);
      }
    }
  };

  return (
    <div className="assistant-profile">
      <div className="profile-header">
        <div className="avatar">🤖</div>
        <div className="info">
          <h3>{identity.name}</h3>
          <span className="role">System Assistant</span>
        </div>
        <button onClick={handleEdit} className="btn-icon">✏️</button>
      </div>
      
      {isEditing && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Edit Assistant</h2>
            <div className="field">
              <label>Name</label>
              <input 
                value={editForm?.name || ''} 
                onChange={e => setEditForm(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
              />
            </div>
            <div className="field">
              <label>Persona</label>
              <textarea 
                value={editForm?.persona || ''} 
                onChange={e => setEditForm(prev => prev ? ({ ...prev, persona: e.target.value }) : null)}
                rows={5}
              />
            </div>
            <div className="actions">
              <button onClick={() => setIsEditing(false)}>Cancel</button>
              <button onClick={handleSave} className="primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

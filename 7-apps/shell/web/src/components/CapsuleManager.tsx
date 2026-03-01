/**
 * CapsuleManager Component
 * 
 * ShellUI component for managing interactive capsules
 * Lists all capsules, allows creation/deletion, and shows event logs
 */

import React, { useState } from 'react';
import {
  AppWindow,
  Plus,
  Trash,
  ArrowsClockwise,
  WarningCircle,
  CheckCircle,
  Clock,
  X,
  Pulse,
  CaretRight,
  Terminal,
} from '@phosphor-icons/react';
import { useCapsules } from '../hooks/useCapsules';
import type { InteractiveCapsule } from '@a2r/mcp-apps-adapter';

interface CapsuleManagerProps {
  /** Called when user wants to view a capsule */
  onViewCapsule?: (capsule: InteractiveCapsule) => void;
  /** Initial tool ID for creating capsules */
  defaultToolId?: string;
  /** Agent ID for filtering */
  agentId?: string;
}

export function CapsuleManager({
  onViewCapsule,
  defaultToolId = 'test-tool',
  agentId,
}: CapsuleManagerProps) {
  const {
    capsules,
    selectedCapsule,
    isLoading,
    error,
    eventLogs,
    loadCapsules,
    createCapsule,
    deleteCapsule,
    selectCapsule,
    clearError,
    clearLogs,
  } = useCapsules();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newToolId, setNewToolId] = useState(defaultToolId);
  const [newCapsuleType, setNewCapsuleType] = useState('test');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await createCapsule({
        capsuleType: newCapsuleType,
        toolId: newToolId,
        agentId,
        surface: {
          html: `<div class="capsule"><h3>${newCapsuleType}</h3><p>Tool: ${newToolId}</p><button onclick="a2r.emitEvent('test', {msg:'hello'})">Test</button></div>`,
          css: '.capsule { padding: 16px; } button { padding: 8px 16px; background: #007acc; color: white; border: none; border-radius: 4px; cursor: pointer; }',
          js: 'console.log("Capsule initialized");',
          permissions: [
            { permission_type: 'tool:invoke', resource: newToolId },
            { permission_type: 'event:emit', resource: '*' },
          ],
        },
      });
      setShowCreateForm(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (capsuleId: string) => {
    if (confirm('Are you sure you want to delete this capsule?')) {
      await deleteCapsule(capsuleId);
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'active':
        return <CheckCircle size={16} className="text-green-500" weight="fill" />;
      case 'pending':
        return <Clock size={16} className="text-yellow-500" weight="fill" />;
      case 'error':
        return <WarningCircle size={16} className="text-red-500" weight="fill" />;
      case 'closed':
        return <X size={16} className="text-gray-500" weight="fill" />;
      default:
        return <Pulse size={16} className="text-blue-500" weight="fill" />;
    }
  };

  const getStateClass = (state: string) => {
    switch (state) {
      case 'active':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'closed':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="capsule-manager">
      {/* Header */}
      <div className="capsule-manager-header">
        <div className="flex items-center gap-2">
          <AppWindow size={20} weight="fill" className="text-blue-500" />
          <h2 className="text-lg font-semibold">Interactive Capsules</h2>
          <span className="capsule-count">{capsules.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadCapsules()}
            className="icon-button"
            title="Refresh"
            disabled={isLoading}
          >
            <ArrowsClockwise size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="primary-button"
            disabled={isLoading}
          >
            <Plus size={18} />
            New Capsule
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="error-banner">
          <WarningCircle size={18} />
          <span>{error}</span>
          <button onClick={clearError} className="ml-auto">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="create-form">
          <div className="form-row">
            <label>Tool ID:</label>
            <input
              type="text"
              value={newToolId}
              onChange={(e) => setNewToolId(e.target.value)}
              placeholder="Enter tool ID"
            />
          </div>
          <div className="form-row">
            <label>Type:</label>
            <input
              type="text"
              value={newCapsuleType}
              onChange={(e) => setNewCapsuleType(e.target.value)}
              placeholder="e.g., test, chart, form"
            />
          </div>
          <div className="form-actions">
            <button
              onClick={() => setShowCreateForm(false)}
              className="secondary-button"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="primary-button"
              disabled={isCreating}
            >
              {isCreating ? (
                <ArrowsClockwise size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Capsule List */}
      <div className="capsule-list">
        {capsules.length === 0 ? (
          <div className="empty-state">
            <AppWindow size={48} className="text-gray-300" />
            <p>No capsules yet</p>
            <p className="text-sm text-gray-500">Create a capsule to get started</p>
          </div>
        ) : (
          capsules.map((capsule) => (
            <div
              key={capsule.id}
              className={`capsule-item ${selectedCapsule?.id === capsule.id ? 'selected' : ''}`}
              onClick={() => selectCapsule(capsule)}
            >
              <div className="capsule-item-header">
                <div className="flex items-center gap-2">
                  {getStateIcon(capsule.state)}
                  <span className="capsule-type">{capsule.type}</span>
                  <span className={`capsule-state-badge ${getStateClass(capsule.state)}`}>
                    {capsule.state}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {onViewCapsule && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewCapsule(capsule);
                      }}
                      className="icon-button small"
                      title="View"
                    >
                      <CaretRight size={16} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(capsule.id);
                    }}
                    className="icon-button small danger"
                    title="Delete"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>
              <div className="capsule-item-meta">
                <span className="text-sm text-gray-500">ID: {capsule.id.slice(0, 8)}...</span>
                <span className="text-sm text-gray-500">Tool: {capsule.toolId}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Event Logs */}
      {selectedCapsule && (
        <div className="event-logs">
          <div className="event-logs-header">
            <div className="flex items-center gap-2">
              <Terminal size={16} />
              <span className="font-medium">Event Logs</span>
              <span className="log-count">{eventLogs.length}</span>
            </div>
            <button onClick={clearLogs} className="text-button">
              Clear
            </button>
          </div>
          <div className="event-logs-content">
            {eventLogs.length === 0 ? (
              <div className="empty-logs">No events yet...</div>
            ) : (
              eventLogs.map((event, index) => (
                <div key={`${event.id}-${index}`} className="event-log-item">
                  <div className="event-log-header">
                    <span className="event-type">{event.type}</span>
                    <span className="event-source">{event.source}</span>
                    <span className="event-time">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="event-payload">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        .capsule-manager {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          max-width: 800px;
          margin: 0 auto;
        }
        
        .capsule-manager-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-subtle, #e5e7eb);
        }
        
        .capsule-count {
          background: var(--bg-secondary, #f3f4f6);
          color: var(--text-secondary, #6b7280);
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .icon-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid var(--border-subtle, #e5e7eb);
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .icon-button:hover {
          background: var(--bg-secondary, #f3f4f6);
        }
        
        .icon-button.small {
          width: 28px;
          height: 28px;
        }
        
        .icon-button.danger:hover {
          background: #fee2e2;
          color: #dc2626;
        }
        
        .primary-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          background: #007acc;
          color: white;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .primary-button:hover {
          background: #005fa3;
        }
        
        .primary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .secondary-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid var(--border-subtle, #e5e7eb);
          background: white;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .secondary-button:hover {
          background: var(--bg-secondary, #f3f4f6);
        }
        
        .text-button {
          padding: 4px 8px;
          border: none;
          background: transparent;
          color: var(--text-secondary, #6b7280);
          font-size: 12px;
          cursor: pointer;
        }
        
        .text-button:hover {
          color: var(--text-primary, #111827);
        }
        
        .error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: #fee2e2;
          color: #991b1b;
          border-radius: 8px;
          border: 1px solid #fecaca;
        }
        
        .create-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          background: var(--bg-secondary, #f9fafb);
          border-radius: 12px;
          border: 1px solid var(--border-subtle, #e5e7eb);
        }
        
        .form-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .form-row label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary, #374151);
        }
        
        .form-row input {
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid var(--border-subtle, #e5e7eb);
          font-size: 14px;
        }
        
        .form-row input:focus {
          outline: none;
          border-color: #007acc;
          box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
        }
        
        .form-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 8px;
        }
        
        .capsule-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 48px;
          color: var(--text-tertiary, #9ca3af);
        }
        
        .capsule-item {
          padding: 12px;
          border-radius: 10px;
          border: 1px solid var(--border-subtle, #e5e7eb);
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .capsule-item:hover {
          border-color: #007acc;
          box-shadow: 0 2px 8px rgba(0, 122, 204, 0.1);
        }
        
        .capsule-item.selected {
          border-color: #007acc;
          background: #f0f9ff;
        }
        
        .capsule-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .capsule-type {
          font-weight: 600;
          color: var(--text-primary, #111827);
        }
        
        .capsule-state-badge {
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 500;
          border: 1px solid;
        }
        
        .capsule-item-meta {
          display: flex;
          gap: 16px;
        }
        
        .event-logs {
          border-top: 1px solid var(--border-subtle, #e5e7eb);
          padding-top: 16px;
        }
        
        .event-logs-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        
        .log-count {
          background: var(--bg-secondary, #f3f4f6);
          color: var(--text-secondary, #6b7280);
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .event-logs-content {
          max-height: 300px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .empty-logs {
          padding: 24px;
          text-align: center;
          color: var(--text-tertiary, #9ca3af);
          font-size: 14px;
        }
        
        .event-log-item {
          padding: 10px;
          background: var(--bg-secondary, #f9fafb);
          border-radius: 8px;
          border: 1px solid var(--border-subtle, #e5e7eb);
        }
        
        .event-log-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        
        .event-type {
          font-weight: 600;
          font-size: 13px;
          color: var(--text-primary, #111827);
        }
        
        .event-source {
          font-size: 11px;
          color: var(--text-tertiary, #9ca3af);
          background: var(--bg-primary, #f3f4f6);
          padding: 2px 6px;
          border-radius: 4px;
        }
        
        .event-time {
          font-size: 11px;
          color: var(--text-tertiary, #9ca3af);
          margin-left: auto;
        }
        
        .event-payload {
          font-size: 12px;
          color: var(--text-secondary, #6b7280);
          background: white;
          padding: 8px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 0;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default CapsuleManager;

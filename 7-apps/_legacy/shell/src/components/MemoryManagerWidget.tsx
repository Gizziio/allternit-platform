import React, { useState, useEffect } from 'react';

// Types for memory entries based on the Rust implementation
interface MemoryProvenance {
  source_session: string | null;
  source_agent: string;
  derivation_chain: string[];
  integrity_hash: string;
  signature: string | null;
}

interface MemoryRetentionPolicy {
  time_to_live: number | null;
  max_accesses: number | null;
  decay_function: any; // Simplified for UI purposes
  consolidation_trigger: any; // Simplified for UI purposes
  deletion_policy: any; // Simplified for UI purposes
}

interface MemoryEntry {
  id: string;
  memory_id: string;
  tenant_id: string;
  session_id: string | null;
  agent_id: string | null;
  memory_type: 'Working' | 'Episodic' | 'Semantic' | 'Procedural' | 'Declarative' | 'Meta';
  content: any;
  metadata: any;
  embedding: number[] | null;
  created_at: number;
  last_accessed: number;
  access_count: number;
  sensitivity_tier: number;
  tags: string[];
  provenance: MemoryProvenance;
  retention_policy: MemoryRetentionPolicy;
  consolidation_state: 'Raw' | 'Candidate' | 'Consolidating' | 'Consolidated' | 'Decayed';
  status: string;
  valid_from: number | null;
  valid_to: number | null;
  confidence: number;
  authority: string;
  supersedes_memory_id: string | null;
}

interface MemoryManagerWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemoryManagerWidget: React.FC<MemoryManagerWidgetProps> = ({ isOpen, onClose }) => {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMemoryType, setSelectedMemoryType] = useState<string>('all');
  const [selectedMemory, setSelectedMemory] = useState<MemoryEntry | null>(null);
  const [showSupersessionChain, setShowSupersessionChain] = useState<boolean>(false);

  // Fetch memories from the API
  useEffect(() => {
    if (!isOpen) return;

    const fetchMemories = async () => {
      try {
        setLoading(true);
        // Using the API endpoint from the kernel service
        const response = await fetch('http://localhost:3004/v1/memory/retrieve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: searchQuery || '',
            top_k: 50,
            tenant_id: 'default',
            memory_types: selectedMemoryType === 'all' ? [] : [selectedMemoryType],
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setMemories(Array.isArray(data) ? data : []);
        setError(null);
      } catch (err) {
        console.error('Error fetching memories:', err);
        setError('Failed to load memories. Please try again later.');
        setMemories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMemories();
  }, [isOpen, searchQuery, selectedMemoryType]);

  // Filter memories based on search and type
  const filteredMemories = memories.filter(memory => {
    const matchesSearch = searchQuery === '' ||
      JSON.stringify(memory.content).toLowerCase().includes(searchQuery.toLowerCase()) ||
      memory.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = selectedMemoryType === 'all' || memory.memory_type === selectedMemoryType;

    return matchesSearch && matchesType;
  });

  // Find supersession chain for a memory entry
  const getSupersessionChain = (memoryId: string): MemoryEntry[] => {
    const chain: MemoryEntry[] = [];
    let currentId: string | null = memoryId;

    while (currentId) {
      const memory = memories.find(m => m.memory_id === currentId);
      if (memory) {
        chain.unshift(memory); // Add to beginning to maintain chronological order
        currentId = memory.supersedes_memory_id;
      } else {
        break;
      }
    }

    return chain;
  };

  // Format timestamp to readable date
  const formatDate = (timestamp: number | null): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Handle memory selection
  const handleSelectMemory = (memory: MemoryEntry) => {
    setSelectedMemory(memory);
    setShowSupersessionChain(false);
  };

  // Close detail view
  const handleCloseDetail = () => {
    setSelectedMemory(null);
    setShowSupersessionChain(false);
  };

  // Render memory type badge with color coding
  const renderMemoryTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      'Working': 'bg-blue-500',
      'Episodic': 'bg-green-500',
      'Semantic': 'bg-purple-500',
      'Procedural': 'bg-yellow-500',
      'Declarative': 'bg-red-500',
      'Meta': 'bg-indigo-500',
    };

    return (
      <span className={`inline-block px-2 py-1 text-xs rounded-full text-white ${colors[type] || 'bg-gray-500'}`}>
        {type}
      </span>
    );
  };

  // Render consolidation state badge
  const renderConsolidationState = (state: string) => {
    const colors: Record<string, string> = {
      'Raw': 'bg-gray-500',
      'Candidate': 'bg-yellow-500',
      'Consolidating': 'bg-orange-500',
      'Consolidated': 'bg-green-500',
      'Decayed': 'bg-red-500',
    };

    return (
      <span className={`inline-block px-2 py-1 text-xs rounded-full text-white ${colors[state] || 'bg-gray-500'}`}>
        {state}
      </span>
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="memory-manager-widget-overlay">
      <div className="memory-manager-widget">
        <div className="widget-header">
          <div className="header-content">
            <h3>Memory Manager</h3>
            <div className="header-actions">
              <button
                onClick={() => setShowSupersessionChain(!showSupersessionChain)}
                disabled={!selectedMemory}
                className="mr-2"
                title="Toggle Supersession Chain View"
              >
                {showSupersessionChain ? 'Hide Chain' : 'Show Chain'}
              </button>
              <button onClick={onClose}>Close</button>
            </div>
          </div>
        </div>

        {!selectedMemory ? (
          <div className="widget-content">
            <div className="controls-section">
              <div className="search-controls">
                <input
                  type="text"
                  placeholder="Search memories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                <select
                  value={selectedMemoryType}
                  onChange={(e) => setSelectedMemoryType(e.target.value)}
                  className="memory-type-select"
                >
                  <option value="all">All Types</option>
                  <option value="Working">Working</option>
                  <option value="Episodic">Episodic</option>
                  <option value="Semantic">Semantic</option>
                  <option value="Procedural">Procedural</option>
                  <option value="Declarative">Declarative</option>
                  <option value="Meta">Meta</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading memories...</p>
              </div>
            ) : error ? (
              <div className="error-container">
                <p className="error-message">{error}</p>
              </div>
            ) : (
              <div className="memories-list">
                <div className="list-header">
                  <span>{filteredMemories.length} memories found</span>
                </div>
                <div className="memory-items">
                  {filteredMemories.length > 0 ? (
                    filteredMemories.map((memory) => (
                      <div
                        key={memory.id}
                        className={`memory-item ${selectedMemory?.id === memory.id ? 'selected' : ''}`}
                        onClick={() => handleSelectMemory(memory)}
                      >
                        <div className="memory-header">
                          <div className="memory-type-badge">
                            {renderMemoryTypeBadge(memory.memory_type)}
                          </div>
                          <div className="memory-status">
                            {renderConsolidationState(memory.consolidation_state)}
                          </div>
                        </div>
                        <div className="memory-content-preview">
                          <div className="memory-title">
                            {memory.content.title || `Memory: ${memory.memory_id.substring(0, 8)}...`}
                          </div>
                          <div className="memory-meta">
                            <span className="confidence">Confidence: {(memory.confidence * 100).toFixed(1)}%</span>
                            <span className="access-count">Accessed: {memory.access_count}</span>
                            <span className="created-at">Created: {formatDate(memory.created_at)}</span>
                          </div>
                          <div className="memory-tags">
                            {memory.tags.slice(0, 3).map((tag, idx) => (
                              <span key={idx} className="tag">{tag}</span>
                            ))}
                            {memory.tags.length > 3 && (
                              <span className="tag">+{memory.tags.length - 3} more</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="no-results">
                      <p>No memories found matching your criteria.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : showSupersessionChain ? (
          <div className="supersession-chain-view">
            <div className="chain-header">
              <h4>Supersession Chain for: {selectedMemory.content.title || selectedMemory.memory_id.substring(0, 8)}</h4>
              <button onClick={handleCloseDetail} className="back-button">Back to List</button>
            </div>

            <div className="chain-diagram">
              {getSupersessionChain(selectedMemory.memory_id).map((memory, index, arr) => (
                <div key={memory.id} className="chain-node">
                  <div className="node-content">
                    <div className="node-header">
                      <span className="node-id">{memory.memory_id.substring(0, 8)}</span>
                      <span className="node-type">{renderMemoryTypeBadge(memory.memory_type)}</span>
                    </div>
                    <div className="node-info">
                      <div className="node-title">{memory.content.title || 'Untitled'}</div>
                      <div className="node-meta">
                        <span>Conf: {(memory.confidence * 100).toFixed(1)}%</span>
                        <span>Created: {formatDate(memory.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  {index < arr.length - 1 && <div className="arrow">→</div>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="memory-detail-view">
            <div className="detail-header">
              <h4>Memory Details</h4>
              <button onClick={handleCloseDetail} className="back-button">Back to List</button>
            </div>

            <div className="detail-content">
              <div className="detail-section">
                <h5>Basic Information</h5>
                <div className="detail-row">
                  <span className="label">ID:</span>
                  <span className="value">{selectedMemory.memory_id}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Type:</span>
                  <span className="value">{renderMemoryTypeBadge(selectedMemory.memory_type)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Status:</span>
                  <span className="value">{renderConsolidationState(selectedMemory.consolidation_state)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Tenant:</span>
                  <span className="value">{selectedMemory.tenant_id}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Session:</span>
                  <span className="value">{selectedMemory.session_id || 'N/A'}</span>
                </div>
              </div>

              <div className="detail-section">
                <h5>Temporal Information</h5>
                <div className="detail-row">
                  <span className="label">Valid From:</span>
                  <span className="value">{formatDate(selectedMemory.valid_from)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Valid To:</span>
                  <span className="value">{formatDate(selectedMemory.valid_to)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Created At:</span>
                  <span className="value">{formatDate(selectedMemory.created_at)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Last Accessed:</span>
                  <span className="value">{formatDate(selectedMemory.last_accessed)}</span>
                </div>
              </div>

              <div className="detail-section">
                <h5>Metrics</h5>
                <div className="detail-row">
                  <span className="label">Confidence:</span>
                  <span className="value">{(selectedMemory.confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="detail-row">
                  <span className="label">Access Count:</span>
                  <span className="value">{selectedMemory.access_count}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Sensitivity Tier:</span>
                  <span className="value">{selectedMemory.sensitivity_tier}</span>
                </div>
              </div>

              <div className="detail-section">
                <h5>Tags</h5>
                <div className="tags-container">
                  {selectedMemory.tags.map((tag, idx) => (
                    <span key={idx} className="tag">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h5>Content</h5>
                <div className="content-container">
                  <pre className="content-json">
                    {JSON.stringify(selectedMemory.content, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="detail-section">
                <h5>Provenance</h5>
                <div className="detail-row">
                  <span className="label">Source Agent:</span>
                  <span className="value">{selectedMemory.provenance.source_agent}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Source Session:</span>
                  <span className="value">{selectedMemory.provenance.source_session || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Integrity Hash:</span>
                  <span className="value hash">{selectedMemory.provenance.integrity_hash.substring(0, 16)}...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Allternit Knowledge View
 * RAG knowledge panel — upload documents and query via vector retrieval.
 * Connects to the Allternit AI backend retrieval API.
 */

import React, { useReducer, useRef, useCallback } from 'react';
import { Brain, Upload, MagnifyingGlass, X, FileText } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';

interface State {
  query: string;
  results: Array<{ source: string; text: string; score?: number }>;
  uploadStatus: string | null;
  searchStatus: string | null;
  uploadedFiles: string[];
  isLoading: boolean;
}

type Action =
  | { type: 'SET_QUERY'; payload: string }
  | { type: 'SET_RESULTS'; payload: State['results'] }
  | { type: 'SET_UPLOAD_STATUS'; payload: string | null }
  | { type: 'SET_SEARCH_STATUS'; payload: string | null }
  | { type: 'ADD_UPLOADED_FILES'; payload: string[] }
  | { type: 'REMOVE_UPLOADED_FILE'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean };

const initialState: State = {
  query: '',
  results: [],
  uploadStatus: null,
  searchStatus: null,
  uploadedFiles: [],
  isLoading: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_QUERY': return { ...state, query: action.payload };
    case 'SET_RESULTS': return { ...state, results: action.payload };
    case 'SET_UPLOAD_STATUS': return { ...state, uploadStatus: action.payload };
    case 'SET_SEARCH_STATUS': return { ...state, searchStatus: action.payload };
    case 'ADD_UPLOADED_FILES': return { ...state, uploadedFiles: [...state.uploadedFiles, ...action.payload] };
    case 'REMOVE_UPLOADED_FILE': return { ...state, uploadedFiles: state.uploadedFiles.filter((_, i) => i !== action.payload) };
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    default: return state;
  }
}

export const KnowledgeView: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    dispatch({ type: 'SET_UPLOAD_STATUS', payload: 'Uploading…' });

    const form = new FormData();
    for (const file of Array.from(files)) {
      form.append('file', file);
    }

    try {
      const res = await fetch('/api/v1/ai/rag/upload', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        dispatch({ type: 'SET_UPLOAD_STATUS', payload: `Uploaded ${files.length} document(s)` });
        dispatch({ type: 'ADD_UPLOADED_FILES', payload: Array.from(files).map((f) => f.name) });
      } else {
        dispatch({ type: 'SET_UPLOAD_STATUS', payload: data.error || 'Upload failed' });
      }
    } catch (err) {
      dispatch({ type: 'SET_UPLOAD_STATUS', payload: err instanceof Error ? err.message : 'Upload failed' });
    }
  };

  const handleSearch = async () => {
    if (!state.query.trim()) return;
    dispatch({ type: 'SET_SEARCH_STATUS', payload: 'Searching…' });
    dispatch({ type: 'SET_RESULTS', payload: [] });

    try {
      const res = await fetch('/api/v1/ai/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: state.query.trim(), collection: 'default' }),
      });
      const data = await res.json();
      if (res.ok && data.documents) {
        const docs = data.documents as Array<{ source?: string; text?: string; score?: number }>;
        dispatch({ type: 'SET_RESULTS', payload: docs.map((d) => ({ source: d.source || 'Unknown', text: d.text || '', score: d.score })) });
        dispatch({ type: 'SET_SEARCH_STATUS', payload: null });
      } else {
        dispatch({ type: 'SET_SEARCH_STATUS', payload: data.error || 'Query failed' });
      }
    } catch (err) {
      dispatch({ type: 'SET_SEARCH_STATUS', payload: err instanceof Error ? err.message : 'Query failed' });
    }
  };

  return (
    <div className="p-[var(--spacing-lg)] flex flex-col gap-[var(--spacing-lg)] h-full">
      <div className="flex items-center gap-[var(--spacing-md)]">
        <Brain size={24} color="#af52de" />
        <h1 className="m-0 text-[var(--text-primary)] text-2xl font-semibold">Knowledge</h1>
      </div>

      <div className="grid grid-cols-2 gap-[var(--spacing-lg)] flex-1 min-h-0">
        {/* Upload Panel */}
        <GlassSurface className="p-[var(--spacing-lg)] flex flex-col gap-[var(--spacing-md)]">
          <div className="text-[var(--text-primary)] text-base font-semibold flex items-center gap-2">
            <Upload size={18} />
            Upload Documents
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void handleUpload(e.dataTransfer.files);
            }}
            className="border-2 border-dashed border-[var(--border-subtle)] rounded-xl p-[var(--spacing-xl)] text-center cursor-pointer text-[var(--text-secondary)] text-sm transition-colors hover:bg-white/5"
          >
            <Upload size={32} className="mx-auto mb-2" />
            <div>Drop files here or click to upload</div>
            <div className="text-xs mt-1 opacity-70">PDF, TXT, MD supported</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />
          {state.uploadStatus && (
            <div className="p-2 px-3 rounded-md bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs">
              {state.uploadStatus}
            </div>
          )}
          {state.uploadedFiles.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-[200px] overflow-auto">
              {state.uploadedFiles.map((name, i) => (
                <div key={i} className="flex items-center gap-2 p-1.5 px-2.5 rounded-md bg-[var(--bg-secondary)]">
                  <FileText size={14} />
                  <span className="text-[13px] text-[var(--text-primary)] flex-1 truncate">{name}</span>
                  <button 
                    onClick={() => dispatch({ type: 'REMOVE_UPLOADED_FILE', payload: i })} 
                    className="bg-transparent border-none cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    aria-label={`Remove ${name}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </GlassSurface>

        {/* Search Panel */}
        <GlassSurface className="p-[var(--spacing-lg)] flex flex-col gap-[var(--spacing-md)]">
          <div className="text-[var(--text-primary)] text-base font-semibold flex items-center gap-2">
            <MagnifyingGlass size={18} />
            Query Knowledge
          </div>
          <div className="flex gap-2">
            <input
              value={state.query}
              onChange={(e) => dispatch({ type: 'SET_QUERY', payload: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
              placeholder="Ask anything about your documents…"
              className="flex-1 p-2.5 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--accent-cowork)] transition-colors"
            />
            <button
              onClick={() => void handleSearch()}
              disabled={!state.query.trim()}
              className={`p-2.5 px-4 rounded-lg border-none text-white text-[13px] font-semibold transition-all ${
                state.query.trim() 
                  ? 'bg-[var(--accent-cowork)] cursor-pointer hover:brightness-110 active:scale-95' 
                  : 'bg-[var(--bg-tertiary)] cursor-not-allowed opacity-50'
              }`}
            >
              Search
            </button>
          </div>
          {state.searchStatus && (
            <div className="p-2 px-3 rounded-md bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs">
              {state.searchStatus}
            </div>
          )}
          <div className="flex-1 overflow-auto flex flex-col gap-2">
            {state.results.map((r, i) => (
              <div key={i} className="p-2.5 px-3 rounded-lg bg-[var(--bg-secondary)]">
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-semibold text-[var(--accent-cowork)]">{r.source}</span>
                  {r.score !== undefined && (
                    <span className="text-[12px] text-[var(--text-tertiary)]">{(r.score * 100).toFixed(1)}% match</span>
                  )}
                </div>
                <div className="text-[13px] text-[var(--text-primary)] leading-relaxed">{r.text}</div>
              </div>
            ))}
            {state.results.length === 0 && !state.searchStatus && (
              <div className="text-center p-[var(--spacing-xl)] text-[var(--text-secondary)] text-sm">
                Upload documents and ask a question to see RAG results
              </div>
            )}
          </div>
        </GlassSurface>
      </div>
    </div>
  );
};

export default KnowledgeView;

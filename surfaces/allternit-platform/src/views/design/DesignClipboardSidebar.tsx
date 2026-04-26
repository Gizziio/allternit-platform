import React, { useState, useEffect } from 'react';
import { Copy, Trash, Plus, MagnifyingGlass, Scissors, Selection } from '@phosphor-icons/react';
import { GlassCard } from '../../design/GlassCard';

interface ClipboardItem {
  id: string;
  title: string;
  content: string;
  type: 'design' | 'ui' | 'code';
  timestamp: number;
}

export function DesignClipboardSidebar({ 
  onPaste,
  activeContent
}: { 
  onPaste: (content: string) => void,
  activeContent?: { design?: string, ui?: string }
}) {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('allternit-design-clipboard');
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load clipboard history');
      }
    }
  }, []);

  // Save to localStorage
  const saveItems = (newItems: ClipboardItem[]) => {
    setItems(newItems);
    localStorage.setItem('allternit-design-clipboard', JSON.stringify(newItems));
  };

  const addItem = (type: 'design' | 'ui') => {
    const content = type === 'design' ? activeContent?.design : activeContent?.ui;
    if (!content) return;

    const newItem: ClipboardItem = {
      id: Date.now().toString(),
      title: `${type === 'design' ? 'Design Spec' : 'UI Block'} ${new Date().toLocaleTimeString()}`,
      content,
      type: type === 'design' ? 'design' : 'ui',
      timestamp: Date.now()
    };

    saveItems([newItem, ...items]);
  };

  const removeItem = (id: string) => {
    saveItems(items.filter(item => item.id !== id));
  };

  const filteredItems = items.filter(i => 
    i.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{
      width: "280px",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: "rgba(15, 13, 12, 0.98)",
      borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
      overflow: "hidden"
    }}>
      {/* Header */}
      <div style={{ padding: "16px", borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Scissors size={18} color="var(--accent-primary)" weight="duotone" />
          <h3 style={{ fontSize: "11px", fontWeight: 900, color: "#fff", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Design Clipboard
          </h3>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          <button 
            onClick={() => addItem('design')}
            disabled={!activeContent?.design}
            style={{ flex: 1, padding: "8px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: "10px", fontWeight: 700, cursor: "pointer", opacity: activeContent?.design ? 1 : 0.3 }}
          >
            Save Design
          </button>
          <button 
             onClick={() => addItem('ui')}
             disabled={!activeContent?.ui}
             style={{ flex: 1, padding: "8px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: "10px", fontWeight: 700, cursor: "pointer", opacity: activeContent?.ui ? 1 : 0.3 }}
          >
            Save UI
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: "12px", borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
         <div style={{ position: "relative" }}>
           <MagnifyingGlass size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", opacity: 0.3 }} />
           <input 
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
             placeholder="Search snippets..." 
             style={{ width: "100%", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "8px 8px 8px 32px", fontSize: "11px", color: "#fff", outline: "none" }} 
           />
         </div>
      </div>

      {/* History List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }} className="custom-scrollbar">
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: "40px", opacity: 0.2 }}>
            <Selection size={32} style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: "11px" }}>History is empty</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filteredItems.map(item => (
              <GlassCard key={item.id} style={{ padding: "12px", background: "rgba(255,255,255,0.01)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--accent-primary)", textTransform: "uppercase" }}>
                    {item.type}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => onPaste(item.content)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", opacity: 0.5 }} title="Paste to Workspace">
                      <Copy size={12} />
                    </button>
                    <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: "#ff4d4d", cursor: "pointer", opacity: 0.5 }}>
                      <Trash size={12} />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", fontWeight: 600, marginBottom: "4px" }}>{item.title}</div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", fontMono: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.content}
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { DotsThree, PencilSimple, Copy, Trash, ArrowsLeftRight, CaretRight } from '@phosphor-icons/react';
import { useChatStore } from '../../views/chat/ChatStore';

export function RailRowMenu({ onRename, onCopy, onDelete, threadId }: any) {
  const { projects, moveThreadToProject } = useChatStore();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button 
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}
          onClick={e => e.stopPropagation()}
        >
          <DotsThree size={18} weight="bold" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content 
          style={{
            minWidth: 180,
            background: 'var(--bg-secondary)',
            borderRadius: 10,
            padding: 4,
            border: '1px solid var(--border-default)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            zIndex: 10000,
          }}
          sideOffset={5}
        >
          <DropdownMenuItem icon={PencilSimple} label="Rename" onClick={onRename} />
          <DropdownMenuItem icon={Copy} label="Duplicate" onClick={onCopy} />
          
          {threadId && projects.length > 0 && (
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger 
                style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', borderRadius: 6,
                  display: 'flex', alignItems: 'center', height: 32, padding: '0 8px', gap: 10,
                  outline: 'none', cursor: 'pointer', position: 'relative'
                }}
                className="dropdown-item-hover"
              >
                <ArrowsLeftRight size={16} />
                Move to Project
                <CaretRight size={14} style={{ marginLeft: 'auto' }} />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  style={{
                    minWidth: 160, background: 'var(--bg-secondary)', borderRadius: 10, padding: 4,
                    border: '1px solid var(--border-default)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', zIndex: 10001,
                  }}
                  sideOffset={2}
                  alignOffset={-5}
                >
                  <DropdownMenuItem 
                    label="No Project" 
                    onClick={() => moveThreadToProject(threadId, null)} 
                  />
                  {projects.map(p => (
                    <DropdownMenuItem 
                      key={p.id} 
                      label={p.title} 
                      onClick={() => moveThreadToProject(threadId, p.id)} 
                    />
                  ))}
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
          )}

          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
          <DropdownMenuItem icon={Trash} label="Delete" onClick={onDelete} color="#ef4444" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function DropdownMenuItem({ icon: Icon, label, onClick, color }: any) {
  return (
    <DropdownMenu.Item 
      onClick={onClick}
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: color || 'var(--text-primary)',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        height: 32,
        padding: '0 8px',
        gap: 10,
        outline: 'none',
        cursor: 'pointer',
      }}
      className="dropdown-item-hover"
    >
      {Icon && <Icon size={16} />}
      {label}
    </DropdownMenu.Item>
  );
}

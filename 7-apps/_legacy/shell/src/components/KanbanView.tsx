import * as React from 'react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  assigneeId?: string;
  createdAt: string;
  updatedAt: string;
}

interface Agent {
  id: string;
  name: string;
  avatar: string;
}

interface KanbanViewProps {
  tasks?: Task[];
  agents?: Agent[];
  onTaskStatusChange?: (taskId: string, newStatus: 'todo' | 'in-progress' | 'review' | 'done') => void;
  onTaskAssign?: (taskId: string, agentId: string) => void;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  tasks = [],
  agents = [],
  onTaskStatusChange,
  onTaskAssign
}) => {
  const [draggedTaskId, setDraggedTaskId] = React.useState<string | null>(null);

  // Use actual data if provided, otherwise empty arrays
  const currentTasks: Task[] = tasks;
  const currentAgents: Agent[] = agents;

  const columns = [
    { id: 'todo', title: 'To Do', color: '#94a3b8' },
    { id: 'in-progress', title: 'In Progress', color: '#60a5fa' },
    { id: 'review', title: 'Review', color: '#fbbf24' },
    { id: 'done', title: 'Done', color: '#4ade80' }
  ];

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: 'todo' | 'in-progress' | 'review' | 'done') => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId && onTaskStatusChange) {
      onTaskStatusChange(taskId, status);
    }
    setDraggedTaskId(null);
  };

  const getAgentName = (agentId?: string) => {
    if (!agentId) return 'Unassigned';
    const agent = currentAgents.find(a => a.id === agentId);
    return agent ? agent.name : 'Unknown';
  };

  const getAgentAvatar = (agentId?: string) => {
    if (!agentId) return '👤';
    const agent = currentAgents.find(a => a.id === agentId);
    return agent ? agent.avatar : '👤';
  };

  return (
    <div className="kanban-view" style={{
      display: 'flex',
      height: '100%',
      backgroundColor: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {columns.map(column => (
        <div
          key={column.id}
          className={`kanban-column column-${column.id}`}
          style={{
            flex: 1,
            minWidth: '250px',
            margin: '0 4px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column'
          }}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, column.id as 'todo' | 'in-progress' | 'review' | 'done')}
        >
          <div
            className="column-header"
            style={{
              padding: '12px',
              borderBottom: `2px solid ${column.color}`,
              fontWeight: 'bold',
              color: '#334155',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>{column.title}</span>
            <span style={{
              backgroundColor: '#e2e8f0',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '12px'
            }}>
              {currentTasks.filter(t => t.status === column.id).length}
            </span>
          </div>

          <div
            className="column-content"
            style={{
              padding: '8px',
              flex: 1,
              overflowY: 'auto'
            }}
          >
            {currentTasks
              .filter(task => task.status === column.id)
              .map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  className={`kanban-task task-${task.status}`}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '12px',
                    marginBottom: '8px',
                    cursor: 'grab',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseDown={(e) => e.currentTarget.style.cursor = 'grabbing'}
                  onMouseUp={(e) => e.currentTarget.style.cursor = 'grab'}
                >
                  <div className="task-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '6px'
                  }}>
                    <h4 style={{
                      margin: 0,
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1e293b'
                    }}>{task.title}</h4>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{ fontSize: '16px' }}>
                        {getAgentAvatar(task.assigneeId)}
                      </span>
                    </div>
                  </div>

                  <p style={{
                    margin: '6px 0',
                    fontSize: '13px',
                    color: '#64748b',
                    lineHeight: '1.4'
                  }}>
                    {task.description}
                  </p>

                  <div className="task-footer" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #e2e8f0'
                  }}>
                    <div style={{
                      fontSize: '11px',
                      color: '#94a3b8'
                    }}>
                      {getAgentName(task.assigneeId)}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#94a3b8'
                    }}>
                      {new Date(task.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            }

            {currentTasks.filter(t => t.status === column.id).length === 0 && (
              <div style={{
                textAlign: 'center',
                color: '#94a3b8',
                fontStyle: 'italic',
                padding: '20px 0'
              }}>
                No tasks
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
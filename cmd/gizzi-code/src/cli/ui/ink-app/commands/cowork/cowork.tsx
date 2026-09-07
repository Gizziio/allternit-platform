// @ts-nocheck
import * as React from 'react'
import { IntelliTaskScreen } from '../../../../../screens/IntelliTaskScreen.js'
import type { LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { ALLTERNIT_GATEWAY_BASE } from '@/shared/constants/allternitGateway'

const API_BASE = ALLTERNIT_GATEWAY_BASE

interface CoworkCommandWrapperProps {
  onDone: LocalJSXCommandOnDone
  context: LocalJSXCommandContext
}

export function CoworkCommandWrapper({
  onDone,
  context,
}: CoworkCommandWrapperProps) {
  const [tasks, setTasks] = React.useState<any[]>([])
  const [comments, setComments] = React.useState<Record<string, any[]>>({})
  const [loading, setLoading] = React.useState(true)

  const fetchTasksAndComments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/tasks`)
      const data = await res.json()
      const mappedTasks = data.map((t: any) => ({
        id: t.id,
        title: t.title,
        priority: Number(t.priority) || 1,
        estimatedMinutes: t.estimated_minutes || t.estimatedMinutes || 60,
        deadline: t.deadline ? new Date(t.deadline).getTime() : undefined,
        dependencies: t.dependencies || [],
        status: t.status || 'todo',
        assignee_id: t.assignee_id || undefined,
        assignee_name: t.assignee_name || undefined,
        assignee_type: t.assignee_type || undefined,
      }))

      const commentsMap: Record<string, any[]> = {}
      await Promise.all(
        mappedTasks.map(async (t: any) => {
          try {
            const cres = await fetch(
              `${API_BASE}/api/v1/tasks/${t.id}/comments`,
            )
            const cdata = await cres.json()
            commentsMap[t.id] = cdata.map((c: any) => ({
              id: c.id || c.comment_id || String(Math.random()),
              author: c.author_name || c.author_id || 'Unknown',
              body: c.body,
              createdAt: c.created_at,
            }))
          } catch {
            commentsMap[t.id] = []
          }
        }),
      )

      setTasks(mappedTasks)
      setComments(commentsMap)
      setLoading(false)
    } catch (e) {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchTasksAndComments()
  }, [])

  const handleStatusChange = (taskId: string, status: string) => {
    fetch(`${API_BASE}/api/v1/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(() => {
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status } : t)))
    })
  }

  const handleAssign = async (taskId: string, currentAssigneeId?: string) => {
    try {
      const meRes = await fetch(`${API_BASE}/api/v1/me`)
      const me = await meRes.json()
      const isAssignedToMe = currentAssigneeId === me.id

      const body = isAssignedToMe
        ? {
            assignee_type: null,
            assignee_id: null,
            assignee_name: null,
          }
        : {
            assignee_type: 'human',
            assignee_id: me.id,
            assignee_name: me.name || me.email || 'You',
          }

      await fetch(`${API_BASE}/api/v1/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      setTasks(prev =>
        prev.map(t =>
          t.id === taskId
            ? {
                ...t,
                assignee_id: body.assignee_id || undefined,
                assignee_name: body.assignee_name || undefined,
                assignee_type: body.assignee_type || undefined,
              }
            : t,
        ),
      )

      return {
        assignee_id: body.assignee_id || undefined,
        assignee_name: body.assignee_name || undefined,
      }
    } catch {
      return { assignee_id: undefined, assignee_name: undefined }
    }
  }

  const handleAddComment = async (taskId: string, body: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/tasks/${taskId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        },
      )
      const newComment = await res.json()
      const mapped = {
        id: newComment.id || newComment.comment_id || String(Math.random()),
        author: newComment.author_name || newComment.author_id || 'You',
        body: newComment.body,
        createdAt: newComment.created_at || new Date().toISOString(),
      }
      setComments(prev => ({
        ...prev,
        [taskId]: [...(prev[taskId] || []), mapped],
      }))
    } catch (e) {
      // Ignore error
    }
  }

  if (loading) {
    return null
  }

  return (
    <IntelliTaskScreen
      tasks={tasks}
      comments={comments}
      onSelect={() => {}}
      onQuit={() => onDone()}
      onStatusChange={handleStatusChange}
      onAssign={handleAssign}
      onAddComment={handleAddComment}
    />
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  return <CoworkCommandWrapper onDone={onDone} context={context} />
}

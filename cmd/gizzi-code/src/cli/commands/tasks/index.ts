/**
 * Tasks Command
 * Production-quality task management
 */

import { log } from '../../utils/log.js'
import { writeFile, readFile, mkdir, access, constants } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Task {
  id: string
  name: string
  description?: string
  status: TaskStatus
  progress: number // 0-100
  createdAt: number
  startedAt?: number
  completedAt?: number
  result?: unknown
  error?: string
  metadata?: Record<string, unknown>
}

export interface TaskList {
  version: string
  tasks: Task[]
  lastId: number
}

const TASKS_FILE = join(homedir(), '.config', 'gizzi', 'tasks.json')

/**
 * Ensure tasks file exists
 */
async function ensureTasksFile(): Promise<void> {
  try {
    await access(TASKS_FILE, constants.F_OK)
  } catch {
    const dir = join(homedir(), '.config', 'gizzi')
    await mkdir(dir, { recursive: true })
    await writeFile(TASKS_FILE, JSON.stringify({ version: '1.0', tasks: [], lastId: 0 }, null, 2))
  }
}

/**
 * Load tasks
 */
async function loadTasks(): Promise<TaskList> {
  await ensureTasksFile()
  const data = await readFile(TASKS_FILE, 'utf8')
  return JSON.parse(data)
}

/**
 * Save tasks
 */
async function saveTasks(taskList: TaskList): Promise<void> {
  await writeFile(TASKS_FILE, JSON.stringify(taskList, null, 2))
}

/**
 * Create a new task
 */
export async function createTask(
  name: string,
  options: { description?: string; metadata?: Record<string, unknown> } = {}
): Promise<Task> {
  const taskList = await loadTasks()
  taskList.lastId++
  
  const task: Task = {
    id: `task_${taskList.lastId}`,
    name,
    description: options.description,
    status: 'pending',
    progress: 0,
    createdAt: Date.now(),
    metadata: options.metadata,
  }
  
  taskList.tasks.push(task)
  await saveTasks(taskList)
  
  return task
}

/**
 * Get task by ID
 */
export async function getTask(id: string): Promise<Task | null> {
  const taskList = await loadTasks()
  return taskList.tasks.find(t => t.id === id) || null
}

/**
 * Update task
 */
export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
  const taskList = await loadTasks()
  const task = taskList.tasks.find(t => t.id === id)
  
  if (!task) return null
  
  Object.assign(task, updates)
  await saveTasks(taskList)
  
  return task
}

/**
 * Start a task
 */
export async function startTask(id: string): Promise<Task | null> {
  return updateTask(id, {
    status: 'running',
    startedAt: Date.now(),
  })
}

/**
 * Update task progress
 */
export async function updateProgress(id: string, progress: number): Promise<Task | null> {
  return updateTask(id, { progress: Math.max(0, Math.min(100, progress)) })
}

/**
 * Complete a task
 */
export async function completeTask(id: string, result?: unknown): Promise<Task | null> {
  return updateTask(id, {
    status: 'completed',
    progress: 100,
    completedAt: Date.now(),
    result,
  })
}

/**
 * Fail a task
 */
export async function failTask(id: string, error: string): Promise<Task | null> {
  return updateTask(id, {
    status: 'failed',
    completedAt: Date.now(),
    error,
  })
}

/**
 * Cancel a task
 */
export async function cancelTask(id: string): Promise<Task | null> {
  return updateTask(id, {
    status: 'cancelled',
    completedAt: Date.now(),
  })
}

/**
 * Delete a task
 */
export async function deleteTask(id: string): Promise<boolean> {
  const taskList = await loadTasks()
  const initialLength = taskList.tasks.length
  taskList.tasks = taskList.tasks.filter(t => t.id !== id)
  
  if (taskList.tasks.length < initialLength) {
    await saveTasks(taskList)
    return true
  }
  
  return false
}

/**
 * List tasks
 */
export async function listTasks(filter?: TaskStatus): Promise<Task[]> {
  const taskList = await loadTasks()
  
  if (filter) {
    return taskList.tasks.filter(t => t.status === filter)
  }
  
  return taskList.tasks.sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Get active (running or pending) tasks
 */
export async function getActiveTasks(): Promise<Task[]> {
  const taskList = await loadTasks()
  return taskList.tasks.filter(t => t.status === 'running' || t.status === 'pending')
}

/**
 * Clean up old completed tasks
 */
export async function cleanupTasks(olderThanDays = 7): Promise<number> {
  const taskList = await loadTasks()
  const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)
  
  const initialLength = taskList.tasks.length
  taskList.tasks = taskList.tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled') {
      return (t.completedAt || 0) > cutoff
    }
    return true
  })
  
  await saveTasks(taskList)
  return initialLength - taskList.tasks.length
}

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

/**
 * Execute tasks command
 */
export default async function tasksCommand(args: string[]): Promise<void> {
  try {
    const subcommand = args[0] || 'list'
    
    switch (subcommand) {
      case 'list':
      case 'ls': {
        const status = args[1] as TaskStatus | undefined
        const tasks = await listTasks(status)
        
        if (tasks.length === 0) {
          log('info', 'No tasks found')
          return
        }
        
        log('info', `Tasks (${tasks.length}):`)
        for (const task of tasks.slice(0, 20)) {
          const statusIcon = {
            pending: '⏸',
            running: '▶',
            completed: '✓',
            failed: '✗',
            cancelled: '⊘',
          }[task.status]
          
          const progress = task.status === 'running' ? ` ${task.progress}%` : ''
          log('info', `  ${statusIcon} ${task.id}: ${task.name}${progress}`)
        }
        break
      }
      
      case 'create': {
        const name = args.slice(1).join(' ')
        if (!name) {
          log('error', 'Please provide a task name')
          return
        }
        const task = await createTask(name)
        log('success', `Created task: ${task.id}`)
        break
      }
      
      case 'show':
      case 'info': {
        const id = args[1]
        if (!id) {
          log('error', 'Please provide a task ID')
          return
        }
        const task = await getTask(id)
        if (!task) {
          log('error', `Task not found: ${id}`)
          return
        }
        log('info', `Task: ${task.id}`)
        log('info', `Name: ${task.name}`)
        log('info', `Status: ${task.status}`)
        log('info', `Progress: ${task.progress}%`)
        if (task.error) log('info', `Error: ${task.error}`)
        break
      }
      
      case 'start': {
        const id = args[1]
        if (!id) {
          log('error', 'Please provide a task ID')
          return
        }
        await startTask(id)
        log('success', `Started task: ${id}`)
        break
      }
      
      case 'cancel': {
        const id = args[1]
        if (!id) {
          log('error', 'Please provide a task ID')
          return
        }
        await cancelTask(id)
        log('success', `Cancelled task: ${id}`)
        break
      }
      
      case 'delete': {
        const id = args[1]
        if (!id) {
          log('error', 'Please provide a task ID')
          return
        }
        const deleted = await deleteTask(id)
        if (deleted) {
          log('success', `Deleted task: ${id}`)
        } else {
          log('error', `Task not found: ${id}`)
        }
        break
      }
      
      case 'cleanup': {
        const days = parseInt(args[1]) || 7
        const removed = await cleanupTasks(days)
        log('success', `Cleaned up ${removed} old tasks`)
        break
      }
      
      default:
        log('error', `Unknown subcommand: ${subcommand}`)
        log('info', 'Available: list, create, show, start, cancel, delete, cleanup')
    }
  } catch (error) {
    if (error instanceof Error) {
      log('error', `Tasks command failed: ${error.message}`)
    } else {
      log('error', 'Tasks command failed with unknown error')
    }
  }
}

export {
  createTask,
  getTask,
  updateTask,
  startTask,
  updateProgress,
  completeTask,
  failTask,
  cancelTask,
  deleteTask,
  listTasks,
  getActiveTasks,
  cleanupTasks,
}

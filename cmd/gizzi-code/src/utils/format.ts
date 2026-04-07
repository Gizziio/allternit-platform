/**
 * Format utilities
 */

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return `${minutes}m ${seconds}s`
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num)
}

export function formatCompact(num: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(num)
}

export function formatPercentage(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${((value / total) * 100).toFixed(1)}%`
}

export function formatDate(date: Date | number | string): string {
  const d = new Date(date)
  return d.toLocaleDateString()
}

export function formatDateTime(date: Date | number | string): string {
  const d = new Date(date)
  return d.toLocaleString()
}

export function formatRelativeTime(date: Date | number | string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = now - then
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return formatDate(date)
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function camelCase(str: string): string {
  return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase())
}

export function kebabCase(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
}

export function snakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
}

export function padLeft(str: string, length: number, char = ' '): string {
  return char.repeat(Math.max(0, length - str.length)) + str
}

export function padRight(str: string, length: number, char = ' '): string {
  return str + char.repeat(Math.max(0, length - str.length))
}

export default {
  formatDuration,
  formatBytes,
  formatNumber,
  formatCompact,
  formatPercentage,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  truncate,
  capitalize,
  camelCase,
  kebabCase,
  snakeCase,
  padLeft,
  padRight,
}

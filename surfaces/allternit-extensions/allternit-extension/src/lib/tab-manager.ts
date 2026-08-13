/**
 * Allternit Extension — Tab Manager Utilities
 *
 * High-level helpers for tab management used by both the background
 * service worker and the page-agent multi-tab orchestration.
 */

export interface TabSnapshot {
  id: number
  url: string
  title: string
  favIconUrl?: string
  active: boolean
  pinned: boolean
  groupId?: number
  windowId: number
}

/** Capture a snapshot of all open tabs across all windows */
export async function snapshotAllTabs(): Promise<TabSnapshot[]> {
  const tabs = await chrome.tabs.query({})
  return tabs
    .filter((t): t is chrome.tabs.Tab & { id: number; url: string } =>
      typeof t.id === 'number' && typeof t.url === 'string',
    )
    .map((t) => ({
      id: t.id,
      url: t.url,
      title: t.title ?? '',
      favIconUrl: t.favIconUrl,
      active: t.active ?? false,
      pinned: t.pinned ?? false,
      groupId: t.groupId !== -1 ? t.groupId : undefined,
      windowId: t.windowId,
    }))
}

/** Find tabs matching a URL pattern (host-based) */
export async function findTabsByHost(host: string): Promise<TabSnapshot[]> {
  const all = await snapshotAllTabs()
  return all.filter((tab) => {
    try {
      return new URL(tab.url).hostname === host
    } catch {
      return false
    }
  })
}

/** Group related tabs using Chrome's tab groups API */
export async function groupTabsByDomain(tabIds: number[]): Promise<number | undefined> {
  if (tabIds.length < 2) return undefined

  try {
    const groupId = await chrome.tabs.group({ tabIds })

    const firstTab = await chrome.tabs.get(tabIds[0])
    const host = firstTab.url ? new URL(firstTab.url).hostname : 'Allternit'

    await chrome.tabGroups.update(groupId, {
      title: host.length > 20 ? host.slice(0, 20) : host,
      color: 'orange',
    })

    return groupId
  } catch {
    return undefined
  }
}

/** Close a set of tabs, returning their snapshots for potential restoration */
export async function closeTabs(tabIds: number[]): Promise<TabSnapshot[]> {
  const snapshots: TabSnapshot[] = []
  for (const id of tabIds) {
    try {
      const tab = await chrome.tabs.get(id)
      if (tab.url) {
        snapshots.push({
          id: tab.id!,
          url: tab.url,
          title: tab.title ?? '',
          active: tab.active ?? false,
          pinned: tab.pinned ?? false,
          windowId: tab.windowId,
        })
      }
      await chrome.tabs.remove(id)
    } catch {
      /* Tab may already be closed */
    }
  }
  return snapshots
}

/** Restore previously closed tabs from snapshots */
export async function restoreTabs(snapshots: TabSnapshot[]): Promise<number[]> {
  const newIds: number[] = []
  for (const snap of snapshots) {
    try {
      const tab = await chrome.tabs.create({ url: snap.url, active: snap.active })
      if (tab.id) newIds.push(tab.id)
    } catch {
      /* URL may no longer be valid */
    }
  }
  return newIds
}

/** Focus a specific tab and its window */
export async function focusTab(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId)
  await chrome.windows.update(tab.windowId, { focused: true })
  await chrome.tabs.update(tabId, { active: true })
}

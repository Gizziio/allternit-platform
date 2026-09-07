import type {
	ExtensionSidepanelActivity,
	ExtensionSidepanelAdapter,
	ExtensionSidepanelHistoricalEvent,
} from '../../../../extension-shared/extension-sidepanel/ExtensionSidepanelShell.types'
import { useEffect, useState } from 'react'
import type { PlatformTaskState } from '../../agent/remote-task-handler'
import { recallMemoryContext } from '@/lib/memory/api'

function formatHost(url?: string): string {
	if (!url) return 'Current tab'

	try {
		return new URL(url).hostname
	} catch {
		return url
	}
}

export function useExtensionSidepanelAdapter() {
	const [platformState, setPlatformState] = useState<PlatformTaskState>({
		requestId: '',
		status: 'idle',
		history: [],
	})
	const [currentTask, setCurrentTask] = useState('')
	const [requestId, setRequestId] = useState<string | null>(null)
	const [language, setLanguage] = useState<'en-US' | 'zh-CN'>('en-US')
	const [pageLabel, setPageLabel] = useState('Sidepanel attached to the current browser tab')
	const [hostLabel, setHostLabel] = useState('Chrome Sidepanel')

	useEffect(() => {
		chrome.tabs.query({ active: true, lastFocusedWindow: true }).then((tabs) => {
			const activeTab = tabs[0]
			const url = activeTab?.url
			const title = activeTab?.title || 'Current tab'
			const host = formatHost(url)

			setHostLabel(host)
			setPageLabel(`${title} · ${host}`)
		})
	}, [])

	useEffect(() => {
		void chrome.runtime.sendMessage({ type: 'PLATFORM_TASK_SUBSCRIBE' })
		const listener = (message: { type?: string; state?: PlatformTaskState }) => {
			if (message.type !== 'PLATFORM_TASK_STATE' || !message.state) return
			setPlatformState(message.state)
		}
		chrome.runtime.onMessage.addListener(listener)
		return () => chrome.runtime.onMessage.removeListener(listener)
	}, [])

	const uiLanguage =
		language === 'zh-CN'
			? 'zh'
			: 'en'

	const adapter: ExtensionSidepanelAdapter = {
		status: platformState.status,
		history: (platformState.history ?? []) as ExtensionSidepanelHistoricalEvent[],
		activity: (platformState.activity ?? null) as ExtensionSidepanelActivity | null,
		currentTask,
		sessions: [],
		pageLabel,
		hostLabel,
		config: {
			permissionMode: 'act',
			language: uiLanguage,
			runtimeLabel: 'Allternit/Gizzi platform brain',
		},
		execute: async (task) => {
			setCurrentTask(task)
			setPlatformState({ requestId: '', task, status: 'running', history: [], activity: { type: 'thinking' } })

			// Recall cross-session memory for this task and current page.
			let enhancedTask = task
			try {
				const memoryContext = await recallMemoryContext(task, hostLabel)
				if (memoryContext) {
					enhancedTask = `${memoryContext}${task}`
				}
			} catch {
				// Best-effort memory recall.
			}

			void chrome.runtime.sendMessage({
				type: 'PLATFORM_TASK_RUN',
				task: enhancedTask,
				config: { language },
			}).then((response) => {
				if (response?.requestId) setRequestId(response.requestId)
				else if (!response?.ok) setPlatformState((state) => ({ ...state, status: 'error', error: response?.error }))
			})
		},
		stop: () => {
			void chrome.runtime.sendMessage({ type: 'PLATFORM_TASK_STOP', requestId })
		},
		configure: (nextConfig) => {
			const nextLanguage =
				nextConfig.language === 'zh'
					? 'zh-CN'
					: 'en-US'
			setLanguage(nextLanguage)
		},
	}

	return {
		status: platformState.status,
		history: platformState.history ?? [],
		activity: platformState.activity ?? null,
		currentTask,
		adapter,
	}
}

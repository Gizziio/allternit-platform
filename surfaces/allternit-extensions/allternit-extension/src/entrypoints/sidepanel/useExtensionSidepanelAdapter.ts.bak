import type {
	ExtensionSidepanelActivity,
	ExtensionSidepanelAdapter,
	ExtensionSidepanelHistoricalEvent,
} from '../../../../shared/extension-sidepanel/ExtensionSidepanelShell.types'
import { useEffect, useState } from 'react'

import { useAgent } from '../../agent/useAgent'

function formatHost(url?: string): string {
	if (!url) return 'Current tab'

	try {
		return new URL(url).hostname
	} catch {
		return url
	}
}

export function useExtensionSidepanelAdapter() {
	const agent = useAgent()
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

	const language =
		agent.config?.language === 'zh-CN'
			? 'zh'
			: agent.config?.language === 'en-US'
				? 'en'
				: 'en'

	const adapter: ExtensionSidepanelAdapter = {
		status: agent.status,
		history: agent.history as ExtensionSidepanelHistoricalEvent[],
		activity: agent.activity as ExtensionSidepanelActivity | null,
		currentTask: agent.currentTask,
		sessions: [],
		pageLabel,
		hostLabel,
		config: {
			permissionMode: 'act',
			language,
			runtimeLabel: 'Chrome extension sidepanel runtime',
		},
		execute: (task) => {
			void agent.execute(task).catch((error) => {
				console.error('[SidePanel] Failed to execute task:', error)
			})
		},
		stop: () => {
			agent.stop()
		},
		configure: (nextConfig) => {
			if (!agent.config) return

			const nextLanguage =
				nextConfig.language === 'zh'
					? 'zh-CN'
					: nextConfig.language === 'en'
						? 'en-US'
						: agent.config.language

			void agent.configure({
				...agent.config,
				language: nextLanguage,
			})
		},
	}

	return {
		...agent,
		adapter,
	}
}

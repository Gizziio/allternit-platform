import {
	ChevronDown,
	Copy,
	CornerUpLeft,
	Eye,
	EyeOff,
	Loader2,
	Palette,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { DEMO_CONFIG } from '@/agent/constants'
import type { ExtConfig, LanguagePreference } from '@/agent/useAgent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

interface ConfigPanelProps {
	config: ExtConfig | null
	onSave: (config: ExtConfig) => Promise<void>
	onClose: () => void
	onOpenHTMLToFigma?: () => void
}

export function ConfigPanel({ config, onSave, onClose, onOpenHTMLToFigma }: ConfigPanelProps) {
	const [language, setLanguage] = useState<LanguagePreference>(config?.language)
	const [maxSteps, setMaxSteps] = useState<number | undefined>(config?.maxSteps)
	const [experimentalLlmsTxt, setExperimentalLlmsTxt] = useState(
		config?.experimentalLlmsTxt ?? false
	)
	const [advancedOpen, setAdvancedOpen] = useState(false)
	const [saving, setSaving] = useState(false)
	const [userAuthToken, setUserAuthToken] = useState<string>('')
	const [copied, setCopied] = useState(false)
	const [showToken, setShowToken] = useState(false)

	useEffect(() => {
		setLanguage(config?.language)
		setMaxSteps(config?.maxSteps)
		setExperimentalLlmsTxt(config?.experimentalLlmsTxt ?? false)
	}, [config])

	// Poll for user auth token every second until found
	useEffect(() => {
		let interval: NodeJS.Timeout | null = null

		const fetchToken = async () => {
			const result = await chrome.storage.local.get('PageAgentExtUserAuthToken')
			const token = result.PageAgentExtUserAuthToken
			if (typeof token === 'string' && token) {
				setUserAuthToken(token)
				if (interval) {
					clearInterval(interval)
					interval = null
				}
			}
		}

		fetchToken()
		interval = setInterval(fetchToken, 1000)

		return () => {
			if (interval) clearInterval(interval)
		}
	}, [])

	const handleCopyToken = async () => {
		if (userAuthToken) {
			await navigator.clipboard.writeText(userAuthToken)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		}
	}

	const handleSave = async () => {
		setSaving(true)
		try {
			const llmConfig = config ?? DEMO_CONFIG
			await onSave({
				apiKey: llmConfig.apiKey,
				baseURL: llmConfig.baseURL,
				model: llmConfig.model,
				language,
				maxSteps: maxSteps || undefined,
				systemInstruction: undefined,
				experimentalLlmsTxt,
			})
		} finally {
			setSaving(false)
		}
	}

	return (
		<div className="flex flex-col gap-4 p-4 relative">
			<div className="flex items-center justify-between">
				<h2 className="text-base font-semibold">Settings</h2>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onClose}
					className="absolute top-2 right-3 cursor-pointer"
				>
					<CornerUpLeft className="size-3.5" />
				</Button>
			</div>

			<div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-md border">
				<div className="flex items-center justify-between gap-2">
					<div>
						<label className="text-xs font-medium text-foreground">Allternit Brain</label>
						<p className="text-[10px] text-muted-foreground">
							Connected through the native host and Allternit/Gizzi harness.
						</p>
					</div>
					<span className="text-[10px] rounded-full px-2 py-0.5 bg-background text-muted-foreground border">
						Managed
					</span>
				</div>
				<p className="text-[10px] text-muted-foreground leading-relaxed">
					Model credentials and system instructions are owned by the Allternit platform brain. This extension attaches the current tab to that runtime instead of maintaining a separate LLM setup.
				</p>
			</div>

			{/* HTML to Figma Section */}
			{onOpenHTMLToFigma && (
				<div className="flex flex-col gap-1.5 p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-md border border-purple-500/20">
					<div className="flex items-center gap-2">
						<Palette className="size-3.5 text-purple-500" />
						<label className="text-xs font-medium text-foreground">HTML to Figma</label>
					</div>
					<p className="text-[10px] text-muted-foreground mb-1">
						Capture any website as editable Figma layers with AI cleanup.
					</p>
					<Button
						variant="outline"
						size="sm"
						onClick={onOpenHTMLToFigma}
						className="w-full h-8 text-xs cursor-pointer border-purple-500/30 hover:bg-purple-500/10"
					>
						Open Capture Tool
					</Button>
				</div>
			)}

			{/* User Auth Token Section */}
			<div className="flex flex-col gap-1.5 p-3 bg-muted/50 rounded-md border">
				<label className="text-xs font-medium text-muted-foreground">User Auth Token</label>
				<p className="text-[10px] text-muted-foreground mb-1">
					Give a website the ability to call this extension.
				</p>
				<div className="flex gap-2 items-center">
					<Input
						readOnly
						value={
							userAuthToken
								? showToken
									? userAuthToken
									: `${userAuthToken.slice(0, 4)}${'•'.repeat(userAuthToken.length - 8)}${userAuthToken.slice(-4)}`
								: 'Loading...'
						}
						className="text-xs h-8 font-mono bg-background"
					/>
					<Button
						variant="outline"
						size="icon"
						className="h-8 w-8 shrink-0 cursor-pointer"
						onClick={() => setShowToken(!showToken)}
						disabled={!userAuthToken}
					>
						{showToken ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
					</Button>
					<Button
						variant="outline"
						size="icon"
						className="h-8 w-8 shrink-0 cursor-pointer"
						onClick={handleCopyToken}
						disabled={!userAuthToken}
					>
						{copied ? <span className="">✓</span> : <Copy className="size-3" />}
					</Button>
				</div>
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-xs text-muted-foreground">Language</label>
				<select
					value={language ?? ''}
					onChange={(e) => setLanguage((e.target.value || undefined) as LanguagePreference)}
					className="h-8 text-xs rounded-md border border-input bg-background px-2 cursor-pointer"
				>
					<option value="">System</option>
					<option value="en-US">English</option>
					<option value="zh-CN">中文</option>
				</select>
			</div>

			{/* Advanced Config */}
			<button
				type="button"
				onClick={() => setAdvancedOpen(!advancedOpen)}
				className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer mt-1 font-bold"
			>
				Advanced
				<ChevronDown
					className="size-3 transition-transform"
					style={{ transform: advancedOpen ? 'rotate(0deg)' : 'rotate(90deg)' }}
				/>
			</button>

			{advancedOpen && (
				<>
					<div className="flex flex-col gap-1.5">
						<label className="text-xs text-muted-foreground">Max Steps</label>
						<Input
							type="number"
							placeholder="40"
							min={1}
							max={200}
							value={maxSteps ?? ''}
							onChange={(e) => setMaxSteps(e.target.value ? Number(e.target.value) : undefined)}
							className="text-xs h-8 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
						/>
					</div>

					<label className="flex items-center justify-between cursor-pointer">
						<span className="text-xs text-muted-foreground">Experimental llms.txt support</span>
						<Switch checked={experimentalLlmsTxt} onCheckedChange={setExperimentalLlmsTxt} />
					</label>
				</>
			)}

			<div className="flex gap-2 mt-2">
				<Button variant="outline" onClick={onClose} className="flex-1 h-8 text-xs cursor-pointer">
					Cancel
				</Button>
				<Button
					onClick={handleSave}
					disabled={saving}
					className="flex-1 h-8 text-xs cursor-pointer"
				>
					{saving ? <Loader2 className="size-3 animate-spin" /> : 'Save'}
				</Button>
			</div>

			{/* Footer */}
			<div className="mt-4 mb-4 pt-4 border-t border-border/50 flex gap-2 justify-between text-[10px] text-muted-foreground">
				<div className="flex flex-col justify-between">
					<span>
						Version <span className="font-mono">v{__VERSION__}</span>
					</span>
					<span>Allternit extension agent</span>
				</div>

				<div className="flex flex-col items-end">
					<span>Native host: com.allternit.desktop</span>
					<span>Brain: Allternit/Gizzi managed</span>
				</div>
			</div>
		</div>
	)
}

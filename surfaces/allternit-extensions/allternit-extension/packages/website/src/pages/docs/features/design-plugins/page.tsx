import { Heading } from '@/components/Heading'
import { useLanguage } from '@/i18n/context'

const plugins = [
	{
		name: 'Frontend',
		summary: 'UI design, structure, accessibility, implementation polish.',
		capabilities: [
			'Generate UI',
			'Audit current screen',
			'Refine layout',
			'Improve accessibility',
			'Create component specs',
		],
		surfaces: ['Design Workspace', 'Canvas', 'Code'],
		bundles: ['frontend-design', 'baseline-ui', 'fixing-accessibility', 'fixing-metadata', 'ui-ux-pro-max', 'design', 'impeccable'],
	},
	{
		name: 'Brand',
		summary: 'Identity systems, logos, assets, visual direction, campaign materials.',
		capabilities: [
			'Generate brand direction',
			'Create logo concepts',
			'Produce asset packs',
			'Create campaign visuals',
			'Expand identity systems',
		],
		surfaces: ['Design Workspace', 'Canvas', 'Assets'],
		bundles: ['canvas-design', 'brand-guidelines', 'theme-factory', 'algorithmic-art', 'brand', 'banner-design'],
	},
	{
		name: 'Motion',
		summary: 'Transitions, microinteractions, animated demos, and motion performance.',
		capabilities: [
			'Add motion pass',
			'Design transition systems',
			'Create microinteractions',
			'Improve motion performance',
			'Generate demo sequences',
		],
		surfaces: ['Design Workspace', 'Canvas', 'Interactive Surfaces'],
		bundles: ['fixing-motion-performance', 'slides', 'pptx', 'slack-gif-creator'],
	},
]

function PluginCard({
	name,
	summary,
	capabilities,
	surfaces,
	bundles,
}: {
	name: string
	summary: string
	capabilities: string[]
	surfaces: string[]
	bundles: string[]
}) {
	return (
		<div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
			<div className="flex items-center justify-between gap-4 mb-4">
				<h3 className="text-2xl font-semibold m-0">{name}</h3>
				<span className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-300">
					Plugin
				</span>
			</div>
			<p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-5">{summary}</p>
			<div className="grid md:grid-cols-2 gap-6">
				<div>
					<div className="text-sm font-semibold mb-2">Capabilities</div>
					<ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
						{capabilities.map((capability) => (
							<li key={capability}>• {capability}</li>
						))}
					</ul>
				</div>
				<div>
					<div className="text-sm font-semibold mb-2">Works With</div>
					<ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
						{surfaces.map((surface) => (
							<li key={surface}>• {surface}</li>
						))}
					</ul>
				</div>
			</div>
			<div className="mt-6">
				<div className="text-sm font-semibold mb-2">Bundled Skills</div>
				<p className="text-sm text-gray-600 dark:text-gray-300 m-0">
					{bundles.join(', ')}
				</p>
			</div>
		</div>
	)
}

export default function DesignPluginsDocs() {
	const { isZh } = useLanguage()

	return (
		<div>
			<h1 className="text-4xl font-bold mb-6">{isZh ? '设计插件' : 'Design Plugins'}</h1>

			<p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
				{isZh
					? 'Allternit 将外部 UI/设计技能打包为三个可安装插件，而不是暴露大量原始技能。市场是唯一的发现入口，技能作为插件内部能力存在。'
					: 'Allternit packages imported UI and design skills into three installable plugins instead of exposing a raw wall of skills. The marketplace stays the only discovery surface, while skills remain internal building blocks.'}
			</p>

			<div className="space-y-8">
				<section>
					<Heading id="model" className="text-2xl font-bold mb-4">
						{isZh ? '产品模型' : 'Product Model'}
					</Heading>
					<p className="text-gray-600 dark:text-gray-300 mb-4">
						{isZh
							? '用户先发现插件，再触发动作，而不是手动挑选技能。'
							: 'Users discover plugins first and trigger actions from them instead of manually selecting raw skills.'}
					</p>
					<div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-950/40">
						Marketplace → Plugin → Actions → Surfaces → Included Skills
					</div>
					<div className="mt-4 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900">
						<div className="font-semibold mb-2">{isZh ? '同步命令' : 'Sync Command'}</div>
						<code>node scripts/design/sync-design-plugins.mjs</code>
					</div>
				</section>

				<section>
					<Heading id="plugins" className="text-2xl font-bold mb-4">
						{isZh ? '三个设计插件' : 'The Three Design Plugins'}
					</Heading>
					<div className="space-y-6">
						{plugins.map((plugin) => (
							<PluginCard key={plugin.name} {...plugin} />
						))}
					</div>
				</section>

				<section>
					<Heading id="workflows" className="text-2xl font-bold mb-4">
						{isZh ? '工作流映射' : 'Workflow Maps'}
					</Heading>
					<div className="space-y-4 text-gray-600 dark:text-gray-300">
						<p>
							<strong>Frontend:</strong> Prompt / Screenshot / Code → Analyze → Refine →
							Validate → Export
						</p>
						<p>
							<strong>Brand:</strong> Brief / References / Existing Assets → Direction →
							Generate → Systemize → Export
						</p>
						<p>
							<strong>Motion:</strong> UI / State / Scene Input → Motion Plan → Animate →
							Tune Performance → Preview / Export
						</p>
					</div>
				</section>

				<section>
					<Heading id="imported-skills" className="text-2xl font-bold mb-4">
						{isZh ? '导入技能如何映射' : 'How Imported Skills Map'}
					</Heading>
					<p className="text-gray-600 dark:text-gray-300 mb-4">
						{isZh
							? 'Allternit 现在会从外部技能仓库同步真实技能目录到本地插件包，再由运行时从 `~/.allternit/plugins/<plugin>/skills/*` 扫描。'
							: 'Allternit now syncs real skill directories from external repositories into local plugin packages, then scans runtime capabilities from `~/.allternit/plugins/<plugin>/skills/*`.'}
					</p>
					<div className="grid md:grid-cols-3 gap-4">
						<div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
							<div className="font-semibold mb-2">Frontend</div>
							<p className="text-sm text-gray-600 dark:text-gray-300 m-0">
								frontend-design, baseline-ui, fixing-accessibility,
								fixing-metadata, ui-ux-pro-max, design, impeccable.
							</p>
						</div>
						<div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
							<div className="font-semibold mb-2">Brand</div>
							<p className="text-sm text-gray-600 dark:text-gray-300 m-0">
								canvas-design, brand-guidelines, theme-factory,
								algorithmic-art, brand, banner-design.
							</p>
						</div>
						<div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
							<div className="font-semibold mb-2">Motion</div>
							<p className="text-sm text-gray-600 dark:text-gray-300 m-0">
								fixing-motion-performance, slides, pptx, slack-gif-creator.
							</p>
						</div>
					</div>
				</section>

				<section>
					<Heading id="design-goals" className="text-2xl font-bold mb-4">
						{isZh ? '设计目标' : 'Design Goals'}
					</Heading>
					<ul className="space-y-2 text-gray-600 dark:text-gray-300">
						<li>• Keep top-level design plugin count capped at three.</li>
						<li>• Make plugin actions clearer than raw skill names.</li>
						<li>• Show installation state and runtime skill count separately.</li>
						<li>• Keep bundled skills as secondary disclosure, not primary discovery.</li>
					</ul>
				</section>
			</div>
		</div>
	)
}

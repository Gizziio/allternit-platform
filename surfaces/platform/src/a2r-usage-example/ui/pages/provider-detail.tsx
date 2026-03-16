import { ProviderCard } from "@/a2r-usage/ui/components/provider-card"
import type { PluginDisplayState } from "@/a2r-usage/ui/lib/plugin-types"
import type { DisplayMode } from "@/a2r-usage/ui/lib/settings"

interface ProviderDetailPageProps {
  plugin: PluginDisplayState | null
  onRetry?: () => void
  displayMode: DisplayMode
}

export function ProviderDetailPage({ plugin, onRetry, displayMode }: ProviderDetailPageProps) {
  if (!plugin) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Provider not found
      </div>
    )
  }

  return (
    <ProviderCard
      name={plugin.meta.name}
      plan={plugin.data?.plan}
      showSeparator={false}
      loading={plugin.loading}
      error={plugin.error}
      lines={plugin.data?.lines ?? []}
      skeletonLines={plugin.meta.lines}
      lastManualRefreshAt={plugin.lastManualRefreshAt}
      onRetry={onRetry}
      scopeFilter="all"
      displayMode={displayMode}
    />
  )
}

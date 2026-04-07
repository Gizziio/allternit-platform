import { createMemo, createSignal, type JSX } from "solid-js"
import { useLocal } from "@/cli/ui/tui/context/local"
import { useSync } from "@/cli/ui/tui/context/sync"
import { map, pipe, flatMap, entries, filter, sortBy, take } from "remeda"
import { DialogSelect, type DialogSelectOption } from "@/cli/ui/tui/ui/dialog-select"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { createDialogProviderOptions, DialogProvider } from "@/cli/ui/tui/component/dialog-provider"
import { useKeybind } from "@/cli/ui/tui/context/keybind"
import * as fuzzysort from "fuzzysort"
import { GIZZICopy } from "@/runtime/brand/brand"
import { blockedModelReason } from "@/runtime/util/model-safety"

interface ModelValue {
  providerID: string
  modelID: string
}

interface FavoriteItem {
  providerID: string
  modelID: string
}

interface ProviderModel {
  id: string
  name: string
  status?: string
  cost?: { input: number; output?: number }
}

interface ProviderInfo {
  id: string
  name: string
  models: Record<string, ProviderModel>
}

export function useConnected() {
  const sync = useSync()
  return createMemo(() =>
    ((sync.data.provider_next as any)?.connected?.length ?? 0) > 0,
  )
}

export function DialogModel(props: { providerID?: string }) {
  const local = useLocal()
  const sync = useSync()
  const dialog = useDialog()
  const keybind = useKeybind()
  const [query, setQuery] = createSignal("")

  const connected = useConnected()
  const providers = createDialogProviderOptions()

  const showExtra = createMemo(() => connected() && !props.providerID)

  const providerNext = createMemo<any>(() => sync.data.provider_next)

  const options = createMemo<DialogSelectOption<ModelValue>[]>(() => {
    const needle = query().trim()
    const showSections = showExtra() && needle.length === 0
    const favorites = connected() ? local.model.favorite() : []
    const recents = local.model.recent()

    function toOptions(items: FavoriteItem[], category: string): DialogSelectOption<ModelValue>[] {
      if (!showSections) return []
      return items.flatMap((item) => {
        const provider = (providerNext()?.all as ProviderInfo[] | undefined)?.find((x) => x.id === item.providerID)
        if (!provider) return []
        const model = provider.models[item.modelID]
        if (!model) return []
        const blockedReason = blockedModelReason({
          providerID: provider.id,
          modelID: model.id,
          name: model.name,
        })
        return [
          {
            key: `${item.providerID}/${item.modelID}`,
            value: { providerID: provider.id, modelID: model.id },
            title: model.name ?? item.modelID,
            description: provider.name,
            category,
            disabled: !!blockedReason,
            footer: blockedReason
              ? GIZZICopy.model.blockedModelHint
              : model.cost?.input === 0 && provider.id === "gizzi"
                ? GIZZICopy.dialog.free
                : undefined,
            onSelect: () => {
              dialog.clear()
              local.model.set({ providerID: provider.id, modelID: model.id }, { recent: true })
            },
          },
        ]
      })
    }

    const favoriteOptions = toOptions(favorites, GIZZICopy.dialog.favorites)
    const recentOptions = toOptions(
      recents.filter(
        (item) => !favorites.some((fav) => fav.providerID === item.providerID && fav.modelID === item.modelID),
      ),
      GIZZICopy.dialog.recent,
    )

    const providerOptions: DialogSelectOption<ModelValue>[] = pipe(
      (providerNext()?.all as ProviderInfo[] | undefined) ?? [],
      sortBy(
        (provider: ProviderInfo) => provider.id !== "gizzi",
        (provider: ProviderInfo) => provider.name,
      ),
      flatMap((provider: ProviderInfo) =>
        pipe(
          provider.models,
          entries(),
          filter(([_, info]) => info.status !== "deprecated"),
          filter(() => (props.providerID ? provider.id === props.providerID : true)),
          map(([model, info]: [string, ProviderModel]) => {
            const blockedReason = blockedModelReason({
              providerID: provider.id,
              modelID: model,
              name: info.name,
            })
            return {
              value: { providerID: provider.id, modelID: model },
              title: info.name ?? model,
              description: favorites.some((item) => item.providerID === provider.id && item.modelID === model)
                ? GIZZICopy.dialog.favoriteTag
                : undefined,
              category: connected() ? provider.name : undefined,
              disabled: !!blockedReason,
              footer: blockedReason
                ? GIZZICopy.model.blockedModelHint
                : info.cost?.input === 0 && provider.id === "gizzi"
                  ? GIZZICopy.dialog.free
                  : undefined,
              onSelect() {
                dialog.clear()
                local.model.set({ providerID: provider.id, modelID: model }, { recent: true })
              },
            }
          }),
          filter((x: DialogSelectOption<ModelValue>) => {
            if (!showSections) return true
            if (favorites.some((item) => item.providerID === x.value.providerID && item.modelID === x.value.modelID))
              return false
            if (recents.some((item) => item.providerID === x.value.providerID && item.modelID === x.value.modelID))
              return false
            return true
          }),
          sortBy(
            (x: DialogSelectOption<ModelValue>) => x.footer !== GIZZICopy.dialog.free,
            (x: DialogSelectOption<ModelValue>) => x.title,
          ),
        ),
      ),
    )

    const popularProviders: DialogSelectOption<string>[] = !connected()
      ? pipe(
          providers(),
          map((option) => ({
            ...option,
            category: GIZZICopy.dialog.popularProviders,
          })),
          take(6),
        )
      : []

    if (needle) {
      return [
        ...fuzzysort.go(needle, providerOptions, { keys: ["title", "category"] }).map((x) => x.obj),
        ...fuzzysort.go(needle, popularProviders as unknown as DialogSelectOption<ModelValue>[], { keys: ["title"] }).map((x) => x.obj),
      ]
    }

    return [...favoriteOptions, ...recentOptions, ...providerOptions, ...(popularProviders as unknown as DialogSelectOption<ModelValue>[])]
  })

  const provider = createMemo(() =>
    props.providerID ? (providerNext()?.all as ProviderInfo[] | undefined)?.find((x) => x.id === props.providerID) : null,
  )

  const title = createMemo(() => provider()?.name ?? GIZZICopy.dialog.selectModel)

  return (
    <DialogSelect<ModelValue>
      options={options()}
      keybind={[
        {
          keybind: keybind.all.model_provider_list?.[0],
          title: connected() ? GIZZICopy.dialog.connectProvider : GIZZICopy.dialog.viewAllProviders,
          onTrigger() {
            dialog.replace(() => <DialogProvider />)
          },
        },
        {
          keybind: keybind.all.model_favorite_toggle?.[0],
          title: GIZZICopy.dialog.favorite,
          disabled: !connected(),
          onTrigger: (option) => {
            local.model.toggleFavorite(option.value)
          },
        },
      ]}
      onFilter={setQuery}
      flat={true}
      skipFilter={true}
      title={title()}
      current={local.model.current()}
    />
  )
}

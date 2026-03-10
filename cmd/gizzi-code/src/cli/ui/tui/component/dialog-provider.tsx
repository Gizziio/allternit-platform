import { createMemo, createSignal, onMount, Show } from "solid-js"
import { useSync } from "@/cli/ui/tui/context/sync"
import { map, pipe, sortBy } from "remeda"
import { DialogSelect } from "@/cli/ui/tui/ui/dialog-select"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { DialogPrompt } from "@/cli/ui/tui/ui/dialog-prompt"
import { Link } from "@/cli/ui/tui/ui/link"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { TextAttributes } from "@opentui/core"
import type { ProviderAuthAuthorization } from "@a2r/sdk/v2"
import { DialogModel } from "@/cli/ui/tui/component/dialog-model"
import { useKeyboard } from "@opentui/solid"
import { Clipboard } from "@/cli/ui/tui/util/clipboard"
import { useToast } from "@/cli/ui/tui/ui/toast"
import { GIZZICopy } from "@/shared/brand"

const PROVIDER_PRIORITY: Record<string, number> = {
  gizzi: 0,
  anthropic: 1,
  openai: 2,
  google: 3,
}

export function createDialogProviderOptions() {
  const sync = useSync()
  const dialog = useDialog()
  const sdk = useSDK()
  const options = createMemo(() => {
    return pipe(
      sync.data.provider_next.all,
      sortBy((x) => PROVIDER_PRIORITY[x.id] ?? 99),
      map((provider) => ({
        title: provider.name,
        value: provider.id,
        description: {
          gizzi: GIZZICopy.dialogs.providerDescriptionGIZZI,
          anthropic: GIZZICopy.dialogs.providerDescriptionAnthropic,
          openai: GIZZICopy.dialogs.providerDescriptionOpenAI,
        }[provider.id],
        category:
          provider.id in PROVIDER_PRIORITY
            ? GIZZICopy.dialogs.providerPopularCategory
            : GIZZICopy.dialogs.providerOtherCategory,
        async onSelect() {
          const methods = sync.data.provider_auth[provider.id] ?? [
            {
              type: "api",
              label: GIZZICopy.dialogs.providerApiKeyLabel,
            },
          ]
          let index: number | null = 0
          if (methods.length > 1) {
            index = await new Promise<number | null>((resolve) => {
              dialog.replace(
                () => (
                  <DialogSelect
                    title={GIZZICopy.dialogs.providerSelectAuthMethodTitle}
                    options={methods.map((x, index) => ({
                      title: x.label,
                      value: index,
                    }))}
                    onSelect={(option) => resolve(option.value)}
                  />
                ),
                () => resolve(null),
              )
            })
          }
          if (index == null) return
          const method = methods[index]
          if (method.type === "oauth") {
            const result = await sdk.client.provider.oauth.authorize({
              providerID: provider.id,
              method: index,
            })
            if (result.data?.method === "code") {
              dialog.replace(() => (
                <CodeMethod providerID={provider.id} title={method.label} index={index} authorization={result.data!} />
              ))
            }
            if (result.data?.method === "auto") {
              dialog.replace(() => (
                <AutoMethod providerID={provider.id} title={method.label} index={index} authorization={result.data!} />
              ))
            }
          }
          if (method.type === "api") {
            return dialog.replace(() => <ApiMethod providerID={provider.id} title={method.label} />)
          }
        },
      })),
    )
  })
  return options
}

export function DialogProvider() {
  const options = createDialogProviderOptions()
  return <DialogSelect title={GIZZICopy.dialogs.providerConnectTitle} options={options()} />
}

interface AutoMethodProps {
  index: number
  providerID: string
  title: string
  authorization: ProviderAuthAuthorization
}
function AutoMethod(props: AutoMethodProps) {
  const { theme } = useTheme()
  const sdk = useSDK()
  const dialog = useDialog()
  const sync = useSync()
  const toast = useToast()

  useKeyboard((evt) => {
    if (evt.name === "c" && !evt.ctrl && !evt.meta) {
      const code = props.authorization.instructions.match(/[A-Z0-9]{4}-[A-Z0-9]{4,5}/)?.[0] ?? props.authorization.url
      Clipboard.copy(code)
        .then(() => toast.show({ message: GIZZICopy.dialogs.providerCopiedToClipboard, variant: "info" }))
        .catch(toast.error)
    }
  })

  onMount(async () => {
    const result = await sdk.client.provider.oauth.callback({
      providerID: props.providerID,
      method: props.index,
    })
    if (result.error) {
      dialog.clear()
      return
    }
    await sdk.client.instance.dispose()
    await sync.bootstrap()
    dialog.replace(() => <DialogModel providerID={props.providerID} />)
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {props.title}
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <box gap={1}>
        <Link href={props.authorization.url} fg={theme.primary} />
        <text fg={theme.textMuted}>{props.authorization.instructions}</text>
      </box>
      <text fg={theme.textMuted}>{GIZZICopy.dialogs.providerWaitingForAuthorization}</text>
      <text fg={theme.text}>
        c <span style={{ fg: theme.textMuted }}>{GIZZICopy.dialogs.providerCopyAction}</span>
      </text>
    </box>
  )
}

interface CodeMethodProps {
  index: number
  title: string
  providerID: string
  authorization: ProviderAuthAuthorization
}
function CodeMethod(props: CodeMethodProps) {
  const { theme } = useTheme()
  const sdk = useSDK()
  const sync = useSync()
  const dialog = useDialog()
  const [error, setError] = createSignal(false)

  return (
    <DialogPrompt
      title={props.title}
      placeholder={GIZZICopy.dialogs.providerAuthorizationCodePlaceholder}
      onConfirm={async (value) => {
        const { error } = await sdk.client.provider.oauth.callback({
          providerID: props.providerID,
          method: props.index,
          code: value,
        })
        if (!error) {
          await sdk.client.instance.dispose()
          await sync.bootstrap()
          dialog.replace(() => <DialogModel providerID={props.providerID} />)
          return
        }
        setError(true)
      }}
      description={() => (
        <box gap={1}>
          <text fg={theme.textMuted}>{props.authorization.instructions}</text>
          <Link href={props.authorization.url} fg={theme.primary} />
          <Show when={error()}>
            <text fg={theme.error}>{GIZZICopy.dialogs.providerInvalidCode}</text>
          </Show>
        </box>
      )}
    />
  )
}

interface ApiMethodProps {
  providerID: string
  title: string
}
function ApiMethod(props: ApiMethodProps) {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const { theme } = useTheme()

  return (
    <DialogPrompt
      title={props.title}
      placeholder={GIZZICopy.dialogs.providerApiKeyPlaceholder}
      description={
        props.providerID === "gizzi" || props.providerID === "gizzi" ? (
          <box gap={1}>
            <text fg={theme.textMuted}>{GIZZICopy.dialogs.providerGIZZIDescription}</text>
            <text fg={theme.text}>
              {GIZZICopy.dialogs.providerGIZZIGetKeyPrefix}{" "}
              <span style={{ fg: theme.primary }}>{GIZZICopy.dialogs.providerGIZZIGetKeyUrl}</span>{" "}
              {GIZZICopy.dialogs.providerGIZZIGetKeySuffix}
            </text>
          </box>
        ) : undefined
      }
      onConfirm={async (value) => {
        if (!value) return
        await sdk.client.auth.set({
          providerID: props.providerID,
          auth: {
            type: "api",
            key: value,
          },
        })
        await sdk.client.instance.dispose()
        await sync.bootstrap()
        dialog.replace(() => <DialogModel providerID={props.providerID} />)
      }}
    />
  )
}

import { createMemo, createSignal, onMount, Show, type JSX } from "solid-js"
import { useSync } from "@/cli/ui/ink-app/context/sync"
import { map, pipe, sortBy } from "remeda"
import { DialogSelect, type DialogSelectOption } from "@/cli/ui/ink-app/ui/dialog-select"
import { useDialog } from "@/cli/ui/ink-app/ui/dialog"
import { useSDK } from "@/cli/ui/ink-app/context/sdk"
import { DialogPrompt } from "@/cli/ui/ink-app/ui/dialog-prompt"
import { Link } from "@/cli/ui/ink-app/ui/link"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { TextAttributes } from "@opentui/core"
import { DialogModel } from "@/cli/ui/ink-app/component/dialog-model"
import { useKeyboard } from "@opentui/solid"
import { Clipboard } from "@/cli/ui/ink-app/util/clipboard"
import { useToast } from "@/cli/ui/ink-app/ui/toast"
import { GIZZICopy } from "@/shared/brand"

// Local type definition since SDK exports as unknown
interface ProviderAuthAuthorization {
  method: "code" | "auto"
  url: string
  instructions: string
}

const PROVIDER_PRIORITY: Record<string, number> = {
  gizzi: 0,
  anthropic: 1,
  openai: 2,
  google: 3,
}

interface ProviderInfo {
  id: string
  name: string
}

interface ProviderAuthMethod {
  type: "api" | "oauth"
  label: string
}

export function createDialogProviderOptions() {
  const sync = useSync()
  const dialog = useDialog()
  const sdk = useSDK()
  const providerNext = createMemo<any>(() => sync.data.provider_next)
  const providerAuth = createMemo<Record<string, any>>(() => 
    (sync.data.provider_auth ?? {}) as Record<string, any>
  )
  
  const options = createMemo<DialogSelectOption<string>[]>(() => {
    return pipe(
      ((providerNext()?.all ?? []) as ProviderInfo[]),
      sortBy((x: ProviderInfo) => PROVIDER_PRIORITY[x.id] ?? 99),
      map((provider: ProviderInfo) => ({
        title: provider.name,
        value: provider.id,
        description: GIZZICopy.dialogs.providerDescriptions[provider.id],
        category:
          provider.id in PROVIDER_PRIORITY
            ? GIZZICopy.dialogs.providerPopularCategory
            : GIZZICopy.dialogs.providerOtherCategory,
        async onSelect() {
          const methods = ((providerAuth()[provider.id] as ProviderAuthMethod[]) ?? [
            {
              type: "api" as const,
              label: GIZZICopy.dialogs.providerApiKeyLabel,
            },
          ])
          let index: number | null = 0
          if (methods.length > 1) {
            index = await new Promise<number | null>((resolve) => {
              dialog.replace(
                () => (
                  <DialogSelect
                    title={GIZZICopy.dialogs.providerSelectAuthMethodTitle}
                    options={methods.map((x: ProviderAuthMethod, idx: number) => ({
                      title: x.label,
                      value: String(idx),
                    }))}
                    onSelect={(option) => resolve(Number(option.value))}
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
              path: { providerID: provider.id },
              body: { method: index },
            } as any)
            const resultData = (result as any).data
            if (resultData?.method === "code") {
              dialog.replace(() => (
                <CodeMethod providerID={provider.id} title={method.label} index={index!} authorization={resultData as ProviderAuthAuthorization} />
              ))
            }
            if (resultData?.method === "auto") {
              dialog.replace(() => (
                <AutoMethod providerID={provider.id} title={method.label} index={index!} authorization={resultData as ProviderAuthAuthorization} />
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
      path: { providerID: props.providerID },
      body: { method: props.index },
    } as any)
    if ((result as any).error) {
      dialog.clear()
      return
    }
    await sdk.client.instance.dispose()
    await (sync as any).bootstrap()
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
        const verifyResult = await sdk.client.provider.oauth.callback({
          path: { providerID: props.providerID },
          body: { method: props.index, code: value },
        } as any)
        if (!(verifyResult as any).error) {
          await sdk.client.instance.dispose()
          await (sync as any).bootstrap()
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
      ) as unknown as JSX.Element}
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
        props.providerID === "gizzi" ? (
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
          path: { providerID: props.providerID },
          body: { type: "api", key: value } as any,
        })
        await sdk.client.instance.dispose()
        await (sync as any).bootstrap()
        dialog.replace(() => <DialogModel providerID={props.providerID} />)
      }}
    />
  )
}

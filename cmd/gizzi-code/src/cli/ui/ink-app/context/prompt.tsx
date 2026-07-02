// @ts-nocheck
import { createSimpleContext } from "./helper.js"
import type { PromptRef } from "@/cli/ui/ink-app/component/prompt"

export const { use: usePromptRef, provider: PromptRefProvider } = createSimpleContext({
  name: "PromptRef",
  init: () => {
    let current: PromptRef | undefined

    return {
      get current() {
        return current
      },
      set(ref: PromptRef | undefined) {
        current = ref
      },
    }
  },
})

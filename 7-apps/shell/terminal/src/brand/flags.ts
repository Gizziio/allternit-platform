import { Flag } from "@/flag/flag"

export const A2RFlag = {
  get EXPERIMENTAL_MARKDOWN() {
    return Flag.A2R_EXPERIMENTAL_MARKDOWN
  },
  get DISABLE_TERMINAL_TITLE() {
    return Flag.A2R_DISABLE_TERMINAL_TITLE
  },
  get EXPERIMENTAL_DISABLE_COPY_ON_SELECT() {
    return Flag.A2R_EXPERIMENTAL_DISABLE_COPY_ON_SELECT
  },
  get SERVER_PASSWORD() {
    return Flag.A2R_SERVER_PASSWORD
  },
  get SERVER_USERNAME() {
    return Flag.A2R_SERVER_USERNAME
  },
} as const

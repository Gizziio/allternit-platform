# @allternit/gizzi-sdk

Allternit AI SDK for gizzi-code. Talks to `https://api.allternit.com` by default.

```ts
import { AllternitHarness } from "@allternit/gizzi-sdk"

const harness = new AllternitHarness({
  mode: "cloud",
  cloud: {
    baseURL: "https://api.allternit.com",
    accessToken: process.env.ALLTERNIT_API_KEY!,
  },
})

for await (const chunk of harness.stream({
  provider: "allternit",
  model: "claude-sonnet-4-6",
  messages: [{ role: "user", content: "Hello" }],
})) {
  if (chunk.type === "text") process.stdout.write(chunk.text)
}
```

The Messages client is also available as `AllternitAI` from `@allternit/gizzi-sdk/providers/allternit`.

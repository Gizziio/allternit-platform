// P2 demo mock v2: slow (3s) completions; fs_write until the artifact exists,
// then final text. Exercises mid-run kill -> sweeper requeue -> recovery.
const REAL = "http://127.0.0.1:18013"
const ARTIFACT = "/tmp/p2-demo/granted/organized.txt"
const fs = require("node:fs")
const server = Bun.serve({
  port: 18014,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      await new Promise((r) => setTimeout(r, 3000))
      const needsWrite = !fs.existsSync(ARTIFACT)
      const body = needsWrite
        ? { choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "call-1", type: "function", function: { name: "fs_write", arguments: JSON.stringify({ path: ARTIFACT, content: "organized by the agentic worker\n" }) } }] }, finish_reason: "tool_calls" }], usage: { total_tokens: 12 } }
        : { choices: [{ message: { role: "assistant", content: "Done — wrote organized.txt inside the granted folder and nothing outside it." }, finish_reason: "stop" }], usage: { total_tokens: 9 } }
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })
    }
    return fetch(REAL + url.pathname + url.search, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body })
  },
})
console.log(`mock v2 on :${server.port}`)

import { LSP } from "@/runtime/integrations/lsp"
import { bootstrap } from "@/cli/bootstrap/bootstrap"
import { cmd } from "@/cli/commands/cmd"
import { Log } from "@/runtime/util/log"
import { EOL } from "os"

// TODO(types): the runtime/util/log Log class has no Default timer; the
// debug commands expect the shared/util/log Logger shape (Log.Default.time).
const { Default } = Log as unknown as {
  Default: {
    time: (message: string) => { stop(): void; [Symbol.dispose](): void }
  }
}

export const LSPCommand = cmd({
  command: "lsp",
  describe: "LSP debugging utilities",
  builder: (yargs) =>
    yargs.command(DiagnosticsCommand).command(SymbolsCommand).command(DocumentSymbolsCommand).demandCommand(),
  async handler() {},
})

const DiagnosticsCommand = cmd({
  command: "diagnostics <file>",
  describe: "get diagnostics for a file",
  builder: (yargs) => yargs.positional("file", { type: "string", demandOption: true }),
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      await LSP.touchFile(args.file, true)
      await Bun.sleep(1000)
      process.stdout.write(JSON.stringify(await LSP.diagnostics(), null, 2) + EOL)
    })
  },
})

export const SymbolsCommand = cmd({
  command: "symbols <query>",
  describe: "search workspace symbols",
  builder: (yargs) => yargs.positional("query", { type: "string", demandOption: true }),
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      using _ = Default.time("symbols")
      const results = await LSP.workspaceSymbol(args.query)
      process.stdout.write(JSON.stringify(results, null, 2) + EOL)
    })
  },
})

export const DocumentSymbolsCommand = cmd({
  command: "document-symbols <uri>",
  describe: "get symbols from a document",
  builder: (yargs) => yargs.positional("uri", { type: "string", demandOption: true }),
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      using _ = Default.time("document-symbols")
      const results = await LSP.documentSymbol(args.uri)
      process.stdout.write(JSON.stringify(results, null, 2) + EOL)
    })
  },
})

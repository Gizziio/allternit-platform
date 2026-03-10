import { Log } from "@/shared/util/log";
import { Filesystem } from "@/shared/util/filesystem";
import { Instance } from "@/runtime/context/project/instance";
import { ToolRegistry } from "@/runtime/tools/builtins/registry";
import { Session } from "@/runtime/session"; 
import { Git } from "@/shared/util/git";
import { BudgetSnapshot } from "@/runtime/loop/budget";
import path from "path";

export interface PromptContext {
  instructions: string;
  recentMessages: any[];
  workingFiles: string[];
  toolInventory: string[];
  budget: BudgetSnapshot;
  repoSnapshot: string;
}

export namespace ContextPacker {
  const log = Log.create({ service: "context.packer" });

  export async function pack(sessionId: string, budget: BudgetSnapshot): Promise<PromptContext> {
    const root = Instance.directory || process.cwd();

    // 1. GATHER: Repo Instructions
    const instructionFiles = ["AGENTS.md", "GIZZI.md", ".claude/CLAUDE.md", "SYSTEM_LAW.md"];
    const instructions = (await Promise.all(
      instructionFiles.map(async (file) => {
        const fullPath = path.join(root, file);
        if (await Filesystem.exists(fullPath)) {
          return `--- ${file} ---\n${await Filesystem.read(fullPath)}`;
        }
        return null;
      })
    )).filter(Boolean).join("\n\n");

    // 2. GATHER: Real Recent Messages
    const history = await Session.messages({ sessionID: sessionId, limit: 10 });
    const recentMessages = history.map(msg => ({
      role: msg.info.role,
      content: msg.parts.map(p => {
        if ('text' in p.data) return p.data.text;
        if ('call' in p.data) return `Tool Call: ${p.data.call.toolID}(${JSON.stringify(p.data.call.input)})`;
        if ('response' in p.data) return `Tool Response: ${JSON.stringify(p.data.response.output)}`;
        return "";
      }).join("\n")
    }));

    // 3. GATHER: Working Files
    let workingFiles: string[] = [];
    try {
      const status = await Git.status(root);
      workingFiles = [...status.modified, ...status.untracked, ...status.staged];
    } catch (e) {
      log.warn("Git status failed", { error: e });
    }

    // 4. GATHER: Tool Inventory
    const tools = await ToolRegistry.ids();

    // 5. GATHER: Repo Map Snapshot
    const repoSnapshot = await Filesystem.tree(root, { 
      maxDepth: 3, 
      exclude: ["node_modules", ".git", "dist", "build", ".gizzi"] 
    });

    return {
      instructions,
      recentMessages,
      workingFiles: Array.from(new Set(workingFiles)),
      toolInventory: tools,
      budget,
      repoSnapshot
    };
  }
}

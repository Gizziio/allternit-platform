import fs from 'fs';
import path from 'path';

export const skillGraphTool: any = {
  name: "skill_graph_ops",
  description: "Synchronize, manifest, and deploy content nodes using the local /content-skill-graph folder.",
  parameters: {
    type: "object",
    properties: {
      action: { 
        type: "string", 
        enum: ["sync", "manifest", "ship", "read_node", "get_graph_data"],
        description: "The operation to perform on the skill graph. Use 'get_graph_data' to retrieve the full node/link network for visualization."
      },
      nodeId: { type: "string", description: "The ID of the platform node or file path." },
      content: { type: "string", description: "The content to manifest or ship." },
    },
    required: ["action"],
  },
  execute: async ({ action, nodeId, content }: any) => {
    console.log(`[SkillGraph Tool] Executing ${action}`);
    
    const graphDir = '/Users/macbook/Desktop/content-skill-graph';
    
    try {
      if (!fs.existsSync(graphDir)) {
        return { error: "Skill graph directory not found." };
      }

      switch(action) {
        case 'get_graph_data': {
          const files = fs.readdirSync(graphDir, { recursive: true })
            .filter((f: any) => f.endsWith('.md'));
          
          const nodes = files.map((f: any) => ({
             id: f.replace('.md', ''),
             label: path.basename(f).replace('.md', ''),
             type: f.includes('/') ? f.split('/')[0] : 'root'
          }));

          const links: { from: string, to: string }[] = [];
          
          files.forEach((f: any) => {
             const fullPath = path.join(graphDir, f);
             const text = fs.readFileSync(fullPath, 'utf8');
             const matches = text.match(/\[\[(.*?)\]\]/g);
             if (matches) {
                matches.forEach(m => {
                   const target = m.replace('[[', '').replace(']]', '');
                   links.push({ from: f.replace('.md', ''), to: target });
                });
             }
          });

          return { nodes, links };
        }
        case 'sync': {
          const files = fs.readdirSync(graphDir, { recursive: true })
            .filter((f: any) => f.endsWith('.md'));
          return { result: `Synced ${files.length} nodes.`, files };
        }
        case 'manifest': {
          const outDir = path.join(graphDir, 'outputs');
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
          const outFile = path.join(outDir, `${nodeId.replace(/[\/\\]/g, '_')}_draft.md`);
          fs.writeFileSync(outFile, content || '', 'utf8');
          return { result: `Node ${nodeId} manifested.`, path: outFile };
        }
        case 'ship': {
          const outDir = path.join(graphDir, 'outputs');
          const draftFile = path.join(outDir, `${nodeId.replace(/[\/\\]/g, '_')}_draft.md`);
          const pubFile = path.join(outDir, `${nodeId.replace(/[\/\\]/g, '_')}_published.md`);
          if (fs.existsSync(draftFile)) fs.renameSync(draftFile, pubFile);
          return { result: `Node ${nodeId} published.`, path: pubFile };
        }
        default:
          return { error: "Unknown action" };
      }
    } catch (e: any) {
      return { error: e.message };
    }
  }
};

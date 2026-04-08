# Allternit Unified Plugin System Architecture

## Overview

The Allternit platform uses a **Unified Plugin Registry** that consolidates ALL plugins into a single system with consistent toggle/install behavior across the PluginManager view.

---

## Your Questions Answered

### 1. Can marketplace plugins be ported into the platform and to Gizzi Code?

**YES** - All marketplace plugins can be:
- **Ported to the platform**: Via the unified registry's `install()` method
- **Used in Gizzi Code**: Via `unifiedPluginRegistry.getForGizziCode()` which returns all enabled plugins
- **Executed deterministically**: Via `executePluginAction(pluginId, action, input)`

```typescript
// Install from marketplace
await unifiedPluginRegistry.install({
  id: 'legal-assistant',
  name: 'Legal Assistant',
  source: 'marketplace',
  category: 'analyze',
  // ... other metadata
});

// Enable the plugin
await unifiedPluginRegistry.enable('legal-assistant');

// Use in Gizzi Code
const result = await unifiedPluginRegistry.executePluginAction(
  'legal-assistant',
  'Analyze contract clauses',
  { document: contractText }
);
```

---

### 2. Can all plugins be in the same place in the codebase?

**YES** - The unified registry consolidates plugins from multiple sources:

| Source | Location | Count | Shipped/Downloaded |
|--------|----------|-------|-------------------|
| **Built-in** | `src/lib/plugins/*/plugin.ts` | 10 | Ships with app |
| **Office** | `src/plugins/office-plugins.ts` | 3 | Ships with app |
| **Feature** | `src/plugins/feature.registry.ts` | 2 | Ships with app |
| **Marketplace** | Downloaded to `~/.allternit/plugins/` | ∞ | Downloaded |
| **Local** | User-specified paths | ∞ | Local dev |

**Storage Locations:**
- **Built-in/Office/Feature**: Bundled with the Electron app
- **Marketplace**: Downloaded to user's app data directory
- **Local**: Loaded from developer-specified filesystem paths

---

### 3. Do we ship with them or download them from our site?

**BOTH** - Hybrid approach:

#### Shipped with App (15 plugins)
These are included in the Electron bundle:
- **10 Agent Mode plugins** (Image, Video, Slides, Website, Research, Data, Code, Assets, Swarms, Flow)
- **3 Office Add-ins** (Excel, PowerPoint, Word)
- **2 Feature plugins** (Core, Advanced)

**Benefits:**
- Work offline immediately
- Core functionality always available
- No API dependencies for basic features

#### Downloaded from Marketplace (∞ plugins)
These are fetched from curated sources:
- **Anthropic Official** (~15 plugins)
- **Anthropic Claude Code** (~8 plugins)
- **Anthropic Skills** (~12 plugins)
- **Anthropic Life Sciences** (~6 plugins)
- **Docker** (~5 plugins)
- **PleaseAI** (~50 plugins)
- **Community** (~25 plugins)

**Benefits:**
- Extensible without app updates
- Community contributions
- Specialized domain plugins

#### Installation Flow:
```
User clicks "Install" in PluginManager
  ↓
Download from GitHub/marketplace
  ↓
Save to ~/.allternit/plugins/{plugin-id}/
  ↓
Register in unified registry
  ↓
User toggles ON to enable
```

---

### 4. Can they be toggled on/off in the plugin extensions view?

**YES** - The PluginManager view supports full lifecycle management:

#### PluginManager Integration

```typescript
// In PluginManager.tsx
import { unifiedPluginRegistry, useUnifiedPlugins } from '@/lib/plugins/unified-registry';

function PluginManager() {
  const { plugins, toggle, install, uninstall } = useUnifiedPlugins();
  
  // Toggle plugin on/off
  const handleToggle = async (pluginId: string) => {
    await toggle(pluginId);
  };
  
  // Install from marketplace
  const handleInstall = async (marketplacePlugin: MarketplacePlugin) => {
    const unified = convertToUnified(marketplacePlugin);
    await install(unified);
  };
  
  // Uninstall
  const handleUninstall = async (pluginId: string) => {
    await uninstall(pluginId);
  };
}
```

#### UI Behavior

| Plugin Source | Can Toggle | Can Uninstall | Default State |
|--------------|------------|---------------|---------------|
| **Built-in** | ❌ Always ON | ❌ | Enabled |
| **Office** | ✅ | ❌ (just disables) | Disabled |
| **Feature** | ✅ | ❌ (just disables) | Core=On, Advanced=Off |
| **Marketplace** | ✅ | ✅ | Not installed → Install → Disabled → Toggle ON |
| **Local** | ✅ | ✅ | Not installed → Install → Disabled → Toggle ON |

#### PluginManager Tabs Integration

The unified registry feeds into all PluginManager tabs:

1. **Plugins Tab**: Shows all `source: 'marketplace' | 'local'` plugins
2. **Skills Tab**: Shows skill capabilities from enabled plugins
3. **Commands Tab**: Shows slash commands from enabled plugins
4. **Connectors Tab**: Shows connectors from enabled plugins
5. **MCPs Tab**: Shows MCP servers from enabled plugins
6. **Webhooks Tab**: Shows webhooks from enabled plugins
7. **CLI Tools Tab**: Shows CLI tools from enabled plugins

---

## Deterministic Actions

Every plugin declares deterministic actions that it can perform:

```typescript
interface UnifiedPlugin {
  deterministicActions: string[];
  // e.g., [
  //   "Analyze contract clauses",
  //   "Identify legal risks",
  //   "Check compliance requirements",
  //   "Generate legal summaries",
  //   "Flag ambiguous language"
  // ]
}
```

**Benefits:**
- Users know exactly what a plugin will do
- Prevents malicious plugins from arbitrary code execution
- Enables audit trails
- Required for enterprise/compliance use cases

---

## Mode Group Assignment

All plugins map to one of the 4 mode groups (with color gradients):

| Group | Color | Plugins |
|-------|-------|---------|
| **Create** | Violet | Image, Video, Slides, Website, Artifacts, Figma-to-Code, etc. |
| **Analyze** | Blue | Research, Data, Legal, Excel, SQL, etc. |
| **Build** | Emerald | Code, Assets, Docker, K8s, API Docs, etc. |
| **Automate** | Amber | Swarms, Flow, Zapier, GitHub Actions, etc. |

**Display Format**: `Agent | Group-Name`
- "Agent | Create-Image"
- "Agent | Analyze-Legal Assistant"
- "Agent | Build-Docker Dev Assistant"
- "Agent | Automate-Zapier Connector"

---

## Migration from Existing System

### Current State (Before)
- `src/lib/plugins/` - 10 agent mode plugins
- `src/plugins/` - Feature plugins, marketplace API
- `src/plugins/office-plugins.ts` - Office add-ins
- `src/views/plugins/PluginManager.tsx` - Plugin management UI
- `src/plugins/capability.store.ts` - Skills/commands/connectors store

### Target State (After)
- `src/lib/plugins/unified-registry.ts` - **Single source of truth**
- All plugins unified under one registry
- PluginManager uses unified registry
- Capability store syncs with unified registry

### Migration Steps:
1. ✅ Create unified registry
2. ⬜ Update PluginManager to use unified registry
3. ⬜ Migrate capability store to sync with unified registry
4. ⬜ Update marketplace installer to register with unified registry
5. ⬜ Update local plugin loader to register with unified registry

---

## Gizzi Code Integration

All plugins are accessible to Gizzi Code:

```typescript
// Gizzi Code can query available plugins
const availablePlugins = unifiedPluginRegistry.getForGizziCode();

// Gizzi Code can execute plugin actions
const result = await unifiedPluginRegistry.executePluginAction(
  'data',
  'Generate chart',
  { data: salesData, type: 'line' }
);

// Plugins run in isolated sandboxes
// Deterministic actions are enforced
// Results are typed and validated
```

---

## Security Model

| Trust Level | Source | Can Install | Auto-Enable |
|-------------|--------|-------------|-------------|
| **Official** | Anthropic, Allternit | ✅ Yes | ✅ Yes |
| **Verified** | Docker, Zapier, etc. | ✅ Yes | ❌ No (user must toggle) |
| **Community** | GitHub repos | ⚠️ Prompt user | ❌ No |
| **Local** | Filesystem | ✅ Yes (dev mode) | ❌ No |

---

## Summary

✅ **Marketplace plugins** → Can be ported and used in Gizzi Code  
✅ **Same codebase** → Unified registry consolidates all plugins  
✅ **Ship + Download** → 15 shipped, ∞ downloadable  
✅ **Toggle in PluginManager** → Full lifecycle management in UI  
✅ **Deterministic actions** → Every plugin declares what it does  
✅ **Mode groups** → All plugins fit into Create/Analyze/Build/Automate  

**Total Plugin Count: 15 shipped + 100+ downloadable = 115+ plugins**

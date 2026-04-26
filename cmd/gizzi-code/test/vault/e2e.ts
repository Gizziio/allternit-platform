#!/usr/bin/env bun
/**
 * Vault Subsystem E2E Test
 *
 * Tests the complete vault pipeline without external API dependencies:
 * 1. Settings persistence
 * 2. Vault initialization and I/O
 * 3. Connector registry
 * 4. Note CRUD and search (FTS5)
 * 5. Graph building
 * 6. Live notes
 */

import { VaultManager } from "@/vault"
import { ensureVaultStructure } from "@/vault/io"
import {
  loadSettings,
  saveSettings,
  setSourceEnabled,
  setGoogleCredentials,
  setFirefliesApiKey,
  setVoiceConfig,
} from "@/vault/settings"
import { listConnectors, getConnector, listConnectorIds, runConnectorSync } from "@/vault/connector"
import { runSync, runAllSyncs } from "@/vault/sync"
import { updateAllLiveNotes } from "@/vault/notes/live"
import { Global } from "@/runtime/context/global"
import path from "path"
import { rm } from "fs/promises"

// Use a test data directory to avoid polluting the real vault
const TEST_DATA_DIR = path.join(Global.Path.data, "test-vault-e2e")
const TEST_VAULT_DIR = path.join(TEST_DATA_DIR, "vault")
const TEST_SETTINGS_FILE = path.join(Global.Path.config, "vault-settings.json")

let failures = 0
let tests = 0

function assert(condition: boolean | undefined, message: string): void {
  tests++
  if (!condition) {
    failures++
    console.error(`  ❌ FAIL: ${message}`)
  } else {
    console.log(`  ✓ ${message}`)
  }
}

async function cleanup(): Promise<void> {
  try {
    await rm(TEST_DATA_DIR, { recursive: true, force: true })
    await rm(TEST_SETTINGS_FILE, { force: true })
  } catch {
    // ignore
  }
}

// ============================================================================
// Test Suite
// ============================================================================

async function runTests(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════════════════╗")
  console.log("║         Vault Subsystem E2E Test Suite                   ║")
  console.log("╚══════════════════════════════════════════════════════════╝\n")

  await cleanup()

  // --------------------------------------------------------------------------
  // 1. Settings
  // --------------------------------------------------------------------------
  console.log("\n📋 Settings Persistence")
  {
    const settings = await loadSettings()
    assert(settings.version === 1, "Default settings have version 1")
    assert(settings.sources.gmail.enabled === false, "Gmail defaults to disabled")
    assert(settings.sources.calendar.enabled === false, "Calendar defaults to disabled")
    assert(settings.sources.fireflies.enabled === false, "Fireflies defaults to disabled")
    assert(settings.liveNotes.enabled === true, "Live notes default to enabled")
    assert(settings.liveNotes.trigger === "@allternit", "Live notes trigger defaults to @allternit")

    await setSourceEnabled("gmail", true)
    const s2 = await loadSettings()
    assert(s2.sources.gmail.enabled === true, "Gmail can be enabled")

    await setGoogleCredentials("test-client-id", "test-client-secret")
    const s3 = await loadSettings()
    assert(s3.sources.gmail.clientId === "test-client-id", "Google client ID is stored")
    assert(s3.sources.gmail.clientSecret === "test-client-secret", "Google client secret is stored")

    await setFirefliesApiKey("test-fireflies-key")
    const s4 = await loadSettings()
    assert(s4.sources.fireflies.apiKey === "test-fireflies-key", "Fireflies API key is stored")

    await setVoiceConfig({ enabled: true, deepgramApiKey: "dg-key" })
    const s5 = await loadSettings()
    assert(s5.voice.enabled === true, "Voice can be enabled")
    assert(s5.voice.deepgramApiKey === "dg-key", "Deepgram key is stored")

    // Reset for downstream tests
    await saveSettings({
      version: 1,
      sources: { gmail: { enabled: false }, calendar: { enabled: false }, fireflies: { enabled: false } },
      voice: { enabled: false },
      liveNotes: { enabled: true, trigger: "@allternit", updateIntervalMinutes: 360 },
    })
  }

  // --------------------------------------------------------------------------
  // 2. Vault Initialization
  // --------------------------------------------------------------------------
  console.log("\n🏛 Vault Initialization")
  {
    await ensureVaultStructure(TEST_VAULT_DIR)
    const vault = new VaultManager({ vaultPath: TEST_VAULT_DIR })
    await vault.initialize()

    assert(vault.rootPath === TEST_VAULT_DIR, "Vault root path matches")

    const all = await vault.query({})
    assert(all.total === 0, "New vault is empty")
    assert(all.notes.length === 0, "New vault has no notes")

    vault.close()
  }

  // --------------------------------------------------------------------------
  // 3. Note CRUD
  // --------------------------------------------------------------------------
  console.log("\n📝 Note CRUD")
  {
    const vault = new VaultManager({ vaultPath: TEST_VAULT_DIR })
    await vault.initialize()

    const note = await vault.createNote("Daily", "2024-01-15", "## Morning standup\n\n- Task A done\n- Task B in progress", {
      tags: ["daily", "work"],
    })
    assert(note.relPath.includes("Daily"), "Note is in Daily folder")
    assert(note.title === "2024-01-15", "Note title is correct")

    const retrieved = await vault.getNote(note.relPath)
    assert(retrieved !== null, "Note can be retrieved")
    assert(retrieved!.content.includes("Morning standup"), "Note content is preserved")
    assert(retrieved!.frontmatter.tags?.includes("daily"), "Note tags are preserved")

    const search = await vault.query({ text: "standup" })
    assert(search.total >= 1, "FTS5 finds note by content")
    assert(search.notes.some(n => n.relPath === note.relPath), "Found note matches created note")

    const folderSearch = await vault.query({ folder: "Daily" })
    assert(folderSearch.total >= 1, "Query by folder works")

    vault.close()
  }

  // --------------------------------------------------------------------------
  // 4. Connector Registry
  // --------------------------------------------------------------------------
  console.log("\n🔌 Connector Registry")
  {
    // Import side-effect registers connectors
    await import("@/vault/connectors")

    const ids = listConnectorIds()
    assert(ids.includes("gmail"), "Gmail connector is registered")
    assert(ids.includes("calendar"), "Calendar connector is registered")
    assert(ids.includes("fireflies"), "Fireflies connector is registered")

    const gmail = getConnector("gmail")
    assert(gmail !== undefined, "Gmail connector can be retrieved")
    assert(gmail!.meta.id === "gmail", "Gmail connector has correct ID")
    assert(gmail!.meta.authType === "oauth", "Gmail uses OAuth")

    const calendar = getConnector("calendar")
    assert(calendar !== undefined, "Calendar connector can be retrieved")
    assert(calendar!.meta.authProviderId === "google", "Calendar shares Google auth")

    const fireflies = getConnector("fireflies")
    assert(fireflies !== undefined, "Fireflies connector can be retrieved")
    assert(fireflies!.meta.authType === "apikey", "Fireflies uses API key")

    const status = await gmail!.status()
    assert(status.authenticated === false, "Gmail connector reports not authenticated without creds")
    assert(status.connected === false, "Gmail connector reports not connected without creds")
  }

  // --------------------------------------------------------------------------
  // 5. Sync Orchestrator (without credentials — should fail gracefully)
  // --------------------------------------------------------------------------
  console.log("\n🔄 Sync Orchestrator")
  {
    const vault = new VaultManager({ vaultPath: TEST_VAULT_DIR })
    await vault.initialize()

    // Enable sources so auth checks run (not just "disabled" skip)
    await setSourceEnabled("gmail", true)
    await setSourceEnabled("calendar", true)
    await setSourceEnabled("fireflies", true)

    const result = await runSync(vault, "gmail")
    assert(result.source === "gmail", "Sync result reports correct source")
    assert(result.success === false, "Gmail sync fails without credentials")
    assert(result.errors.some(e => e.includes("Not authenticated")), "Error message guides user to auth")

    const allResults = await runAllSyncs(vault)
    assert(allResults.length === 3, "runAllSyncs runs all 3 connectors")
    assert(allResults.every(r => !r.success), "All syncs fail gracefully without credentials")

    vault.close()
  }

  // --------------------------------------------------------------------------
  // 6. Live Notes
  // --------------------------------------------------------------------------
  console.log("\n✨ Live Notes")
  {
    const vault = new VaultManager({ vaultPath: TEST_VAULT_DIR })
    await vault.initialize()

    // Create a note with the trigger
    await vault.createNote("Daily", "Live Test", "This is a test with @allternit in the content", {
      tags: ["test"],
    })

    const updated = await updateAllLiveNotes(vault)
    assert(typeof updated === "number", "updateAllLiveNotes returns a number")

    vault.close()
  }

  // --------------------------------------------------------------------------
  // 7. Graph Building
  // --------------------------------------------------------------------------
  console.log("\n🕸 Entity Graph")
  {
    const vault = new VaultManager({ vaultPath: TEST_VAULT_DIR })
    await vault.initialize()

    // Create interlinked notes
    await vault.createNote("People", "Alice Smith", "Alice works with [[Bob Jones]] on [[Project X]].")
    await vault.createNote("People", "Bob Jones", "Bob is the lead on [[Project X]] and reports to [[Alice Smith]].")
    await vault.createNote("Projects", "Project X", "Led by [[Alice Smith]] and [[Bob Jones]].")

    const { buildGraph, ensureEntityNotes } = await import("@/vault/graph/build")
    const notes = (await vault.query({})).notes
    const graph = buildGraph(notes)

    assert(graph.nodes.has("People/Alice Smith.md"), "Graph contains Alice Smith note")
    assert(graph.nodes.has("People/Bob Jones.md"), "Graph contains Bob Jones note")
    assert(graph.nodes.has("Projects/Project X.md"), "Graph contains Project X note")
    assert(graph.edges.length >= 3, "Graph has edges between entities")

    await ensureEntityNotes(vault.rootPath, notes)
    const peopleNotes = await vault.query({ folder: "People" })
    assert(peopleNotes.total >= 2, "Entity notes exist in People folder")

    vault.close()
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log("\n╔══════════════════════════════════════════════════════════╗")
  console.log(`║  Results: ${tests - failures}/${tests} passed${failures > 0 ? `, ${failures} failed` : ""}                          ║`)
  console.log("╚══════════════════════════════════════════════════════════╝\n")

  await cleanup()

  if (failures > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error("Test suite crashed:", err)
  process.exit(1)
})

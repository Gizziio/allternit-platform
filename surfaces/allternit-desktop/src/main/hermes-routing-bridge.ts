/**
 * ACI → Hermes config.yaml export bridge.
 *
 * Renders an Allternit Cloud provider-routing policy (fetched by the renderer
 * from `GET /api/v1/gateway/provider-routing/export/hermes` on the gateway)
 * into the locally installed Hermes mini-app's `~/.hermes/config.yaml`, so
 * routing defined in Allternit Cloud is enforced by Hermes CLI/gateway mode
 * (Allternit Brain `Products/ProviderRouting.md`, "ACI" surface).
 *
 * Merge strategy: replace the top-level `provider_routing:` block if one
 * exists, otherwise append. Everything else in the user's config.yaml is left
 * byte-identical. The previous file is backed up to
 * `config.yaml.allternit-bak` before writing.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

export const HERMES_CONFIG_PATH = path.join(os.homedir(), '.hermes', 'config.yaml');
const BACKUP_SUFFIX = '.allternit-bak';

/**
 * True when the line opens a top-level (column 0) `provider_routing:` mapping
 * key. Nested occurrences (indented) belong to other sections and are ignored.
 */
function isTopLevelRoutingKey(line: string): boolean {
  return /^provider_routing\s*:\s*$/.test(line) || /^provider_routing\s*:\s*\{/.test(line);
}

/**
 * Replace or append the top-level `provider_routing:` block of an existing
 * config.yaml with the generated section. Returns the merged document.
 */
export function spliceHermesRouting(existingYaml: string, routingYaml: string): string {
  const section = routingYaml.replace(/\n+$/, '\n');
  const lines = existingYaml.split('\n');
  const start = lines.findIndex(isTopLevelRoutingKey);
  if (start === -1) {
    const base = existingYaml.replace(/\n*$/, '');
    return base.length > 0 ? `${base}\n\n${section}` : section;
  }

  // The block spans until the next non-empty, non-comment line at column 0.
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      end = i;
      break;
    }
  }
  const head = lines.slice(0, start).join('\n').replace(/\n*$/, '');
  const tail = lines.slice(end).join('\n').replace(/^\n*/, '');
  const merged = [head, section.replace(/\n$/, ''), tail].filter((part) => part.length > 0).join('\n\n');
  return merged.endsWith('\n') ? merged : `${merged}\n`;
}

export interface HermesRoutingExportResult {
  success: boolean;
  path: string;
  backupPath?: string;
  replaced: boolean;
  error?: string;
}

/**
 * Write the generated `provider_routing` YAML section into
 * `~/.hermes/config.yaml`, backing up any existing file first. Creates
 * `~/.hermes/` when missing.
 */
export function exportHermesRouting(routingYaml: string, configPath: string = HERMES_CONFIG_PATH): HermesRoutingExportResult {
  if (!/^provider_routing\s*:/m.test(routingYaml)) {
    return { success: false, path: configPath, replaced: false, error: 'generated YAML is not a provider_routing section' };
  }
  try {
    const existing = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
    const replaced = existing.trim().length > 0 && isTopLevelRoutingKeyPresent(existing);
    let backupPath: string | undefined;
    if (existing.trim().length > 0) {
      backupPath = configPath + BACKUP_SUFFIX;
      fs.writeFileSync(backupPath, existing);
    }
    const merged = existing.trim().length > 0 ? spliceHermesRouting(existing, routingYaml) : routingYaml;
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, merged);
    return { success: true, path: configPath, backupPath, replaced };
  } catch (err) {
    return { success: false, path: configPath, replaced: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function isTopLevelRoutingKeyPresent(yaml: string): boolean {
  return yaml.split('\n').some(isTopLevelRoutingKey);
}

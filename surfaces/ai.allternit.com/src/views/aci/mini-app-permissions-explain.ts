/**
 * Plain-language rendering of a miniapp's declared permissions. Pure and
 * React-free so it can be exercised with plain node.
 *
 * The marketplace listing and the publish dialog both show these lines so
 * users and publishers read the same description of what an app can do.
 */

import type { MiniAppOAuthProviderContract } from "./mini-app.types";

export type MiniAppPermissionIcon =
  | "network"
  | "filesystem"
  | "secrets"
  | "processes"
  | "oauth";

export interface MiniAppPermissionExplanation {
  icon: MiniAppPermissionIcon;
  title: string;
  detail: string;
}

/** Structural subset shared by MiniAppManifest and InstalledMiniApp. */
export interface MiniAppPermissionSource {
  permissions?: {
    network?: string[];
    filesystem?: string[];
    secrets?: string[];
    processes?: boolean;
  } | null;
  lifecycle?: {
    install?: { command: string };
    start?: { command: string };
  } | null;
  oauth?: Record<string, MiniAppOAuthProviderContract> | null;
}

const KNOWN_PROVIDER_NAMES: Record<string, string> = {
  anthropic: "Anthropic",
  atlassian: "Atlassian",
  discord: "Discord",
  figma: "Figma",
  github: "GitHub",
  gitlab: "GitLab",
  google: "Google",
  linear: "Linear",
  microsoft: "Microsoft",
  notion: "Notion",
  openai: "OpenAI",
  slack: "Slack",
  spotify: "Spotify",
  stripe: "Stripe",
  supabase: "Supabase",
  vercel: "Vercel",
};

/** Human label for an OAuth provider id ("github" → "GitHub"). */
export function oauthProviderDisplayName(providerId: string): string {
  const known = KNOWN_PROVIDER_NAMES[providerId.toLowerCase()];
  if (known) return known;
  return providerId.charAt(0).toUpperCase() + providerId.slice(1);
}

function otherSuffix(count: number, singular: string): string {
  return count === 1
    ? ` and 1 other ${singular}`
    : ` and ${count} other ${singular}s`;
}

/** Plain-language explanation of one declared OAuth provider. */
export function explainOAuthProvider(
  providerId: string,
  provider: MiniAppOAuthProviderContract,
): MiniAppPermissionExplanation {
  const name = oauthProviderDisplayName(providerId);
  const scopes = provider.scopes ?? [];
  return {
    icon: "oauth",
    title: `${name} account`,
    detail: scopes.length
      ? `Connects your ${name} account (scopes: ${scopes.join(", ")})`
      : `Connects your ${name} account`,
  };
}

/**
 * Explain everything a miniapp declares, in a stable order: network,
 * filesystem, secrets, processes, then OAuth providers. Returns an empty
 * array when nothing is declared.
 */
export function explainMiniAppPermissions(
  app: MiniAppPermissionSource,
): MiniAppPermissionExplanation[] {
  const explanations: MiniAppPermissionExplanation[] = [];
  const permissions = app.permissions;

  const hosts = (permissions?.network ?? []).filter(Boolean);
  if (hosts.length) {
    explanations.push({
      icon: "network",
      title: "Network access",
      detail: `Connects to ${hosts[0]}${hosts.length > 1 ? otherSuffix(hosts.length - 1, "host") : ""}`,
    });
  }

  const paths = (permissions?.filesystem ?? []).filter(Boolean);
  if (paths.length) {
    explanations.push({
      icon: "filesystem",
      title: "File access",
      detail: `Accesses files at ${paths[0]}${paths.length > 1 ? otherSuffix(paths.length - 1, "location") : ""}`,
    });
  }

  const secrets = (permissions?.secrets ?? []).filter(Boolean);
  if (secrets.length) {
    explanations.push({
      icon: "secrets",
      title: "Secrets",
      detail:
        secrets.length === 1
          ? `Uses the ${secrets[0]} secret stored on this computer`
          : `Uses secrets stored on this computer: ${secrets.join(", ")}`,
    });
  }

  if (permissions?.processes) {
    const commands = [
      app.lifecycle?.install?.command,
      app.lifecycle?.start?.command,
    ].filter((command): command is string => Boolean(command?.trim()));
    explanations.push({
      icon: "processes",
      title: "Local processes",
      detail: commands.length
        ? `Runs local commands on this computer (e.g. ${commands
            .map((command) => `"${command}"`)
            .join(", ")})`
        : "Runs local commands on this computer",
    });
  }

  for (const [providerId, provider] of Object.entries(app.oauth ?? {})) {
    explanations.push(explainOAuthProvider(providerId, provider));
  }

  return explanations;
}

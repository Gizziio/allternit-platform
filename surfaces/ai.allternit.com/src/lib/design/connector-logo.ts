/**
 * Connector brand icons.
 *
 * Uses locally shipped icons from Devicon, Simple Icons, and official
 * brand favicons (all open-source / publicly available assets).
 *
 * Falls back to the site's own high-resolution favicon when a brand icon
 * is not shipped locally, and finally to a branded initial tile.
 */

import { CONNECTOR_ICON_FILES } from "./connector-icon-map";

function localIconUrl(provider: string): string | null {
  const file = CONNECTOR_ICON_FILES[provider.toLowerCase()];
  return file ? `/icons/connectors/${file}` : null;
}

export interface ConnectorLogoResult {
  /** SVG URL (local) or external favicon URL */
  url: string | null;
  /** Human-readable brand title if known */
  title: string | null;
}

/**
 * Resolve a polished connector logo.
 *
 * Priority:
 * 1. Local brand icon shipped from the connector icon manifest (SVG/PNG)
 * 2. High-res favicon from the site's own faviconkit
 */
export function getConnectorLogoUrl(
  baseUrl: string | undefined | null,
  provider?: string,
  _size: number = 64,
): ConnectorLogoResult {
  if (provider) {
    const local = localIconUrl(provider);
    if (local) return { url: local, title: provider };
  }
  if (baseUrl) {
    try {
      const hostname = new URL(baseUrl).hostname.replace(/^www\./, "");
      // Try to guess a local icon from common domains.
      const domainToProvider: Record<string, string> = {
        "github.com": "github",
        "gitlab.com": "gitlab",
        "bitbucket.org": "bitbucket",
        "slack.com": "slack",
        "discord.com": "discord",
        "google.com": "google",
        "drive.google.com": "google",
        "calendar.google.com": "google",
        "gmail.com": "gmail",
        "notion.so": "notion",
        "trello.com": "trello",
        "atlassian.com": "jira",
        "jira.com": "jira",
        "confluence.com": "confluence",
        "azure.microsoft.com": "azure",
        "aws.amazon.com": "aws",
        "mongodb.com": "mongodb",
        "postgresql.org": "postgresql",
        "mysql.com": "mysql",
        "redis.io": "redis",
        "supabase.com": "supabase",
        "cloudflare.com": "cloudflare",
        "netlify.com": "netlify",
        "vercel.com": "vercel",
        "docker.com": "docker",
        "figma.com": "figma",
        "webflow.com": "webflow",
        "linkedin.com": "linkedin",
        "twitter.com": "twitter",
        "x.com": "twitter",
        "twilio.com": "twilio",
        "salesforce.com": "salesforce",
        "zoom.us": "zoom",
        "stripe.com": "stripe",
        "hubspot.com": "hubspot",
        "airtable.com": "airtable",
        "asana.com": "asana",
        "dropbox.com": "dropbox",
        "box.com": "box",
        "shopify.com": "shopify",
        "zapier.com": "zapier",
        "intercom.com": "intercom",
        "zendesk.com": "zendesk",
        "databricks.com": "databricks",
        "snowflake.com": "snowflake",
        "linear.app": "linear",
      };
      const guessed = domainToProvider[hostname];
      if (guessed) {
        const local = localIconUrl(guessed);
        if (local) return { url: local, title: guessed };
      }
      return { url: `https://api.faviconkit.com/${hostname}/${_size}`, title: null };
    } catch {
      return { url: null, title: null };
    }
  }
  return { url: null, title: null };
}

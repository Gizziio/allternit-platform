import React from "react";
import { Key, Plus, Copy } from "@phosphor-icons/react";

export function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
          API Keys
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          Create and manage keys for the Allternit cloud API and platform webhooks.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-8 text-center">
        <div className="size-12 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center mx-auto mb-4">
          <Key size={24} />
        </div>
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-1">
          API key management coming soon
        </h2>
        <p className="text-[13px] text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
          This page will let you issue scoped API keys, rotate secrets, and audit usage.
          Authentication is currently handled through your Clerk session.
        </p>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 rounded-lg text-[13px] font-semibold border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] opacity-60 cursor-not-allowed"
        >
          <Plus size={14} /> Create API key
        </button>
      </div>

      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4">
        <div className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">Example API base URL</div>
        <div className="flex items-center gap-2 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2">
          <code className="flex-1 text-[12px] font-mono text-[var(--text-secondary)] truncate">
            https://api.allternit.com/api/v1
          </code>
          <button
            type="button"
            className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            aria-label="Copy URL"
            onClick={() => void navigator.clipboard.writeText("https://api.allternit.com/api/v1")}
          >
            <Copy size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

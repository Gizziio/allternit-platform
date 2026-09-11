import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowSquareOut, Check, Copy, X } from "@phosphor-icons/react";
import type { ModelCardInfo } from "@/lib/model-showcase";
import { ModelMark } from "@/components/console/ModelMark";

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-solid border-[var(--border-subtle)] py-3">
      <span className="text-[13px] text-[var(--text-secondary)]">{label}</span>
      <span className="text-[13px] font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function FeatureRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-solid border-[var(--border-subtle)] py-3">
      <span className="text-[13px] text-[var(--text-secondary)]">{label}</span>
      <span className="text-[13px] font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

export function ModelCardOverlay({
  model,
  onClose,
}: {
  model: ModelCardInfo;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(model.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — leave the id visible for manual copy.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${model.name} model details`}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-solid border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close model details"
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg border border-solid border-[var(--border-subtle)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        >
          <X size={16} />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: model.banner }}
            >
              <ModelMark kind={model.mark} ink={model.ink} size={40} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[20px] font-semibold tracking-tight text-[var(--text-primary)]">
                  {model.name}
                </h2>
                {model.isNew && (
                  <span className="text-[11px] font-medium text-[#6E9BF0]">New</span>
                )}
              </div>
              <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">{model.tagline}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <a
                  href="https://ai.allternit.com/shell"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-[12px] font-semibold text-[var(--bg-primary)] transition-opacity hover:opacity-85"
                >
                  Try in playground <ArrowSquareOut size={12} />
                </a>
                <button
                  type="button"
                  onClick={copyId}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-3 py-1.5 font-mono text-[12px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                >
                  {model.id}
                  {copied ? <Check size={12} className="text-[var(--status-success)]" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </div>

          {/* Cost | Features */}
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-[13px] font-semibold text-[var(--text-primary)]">Cost</h3>
              <CostRow label="Input" value={`${model.cost.input} / MTok`} />
              <CostRow label="Output" value={`${model.cost.output} / MTok`} />
              <div className="py-2">
                <div className="text-[13px] text-[var(--text-secondary)]">Prompt caching</div>
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-center justify-between pl-3 text-[13px]">
                    <span className="text-[var(--text-secondary)]">Write</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {model.cost.cacheWrite === "—" ? "—" : `${model.cost.cacheWrite} / MTok`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pl-3 text-[13px]">
                    <span className="text-[var(--text-secondary)]">Read</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {model.cost.cacheRead === "—" ? "—" : `${model.cost.cacheRead} / MTok`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="border-t border-solid border-[var(--border-subtle)] py-2">
                <div className="text-[13px] text-[var(--text-secondary)]">Fast mode</div>
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-center justify-between pl-3 text-[13px]">
                    <span className="text-[var(--text-secondary)]">Input</span>
                    <span className="font-medium text-[var(--text-primary)]">{model.cost.fastInput}</span>
                  </div>
                  <div className="flex items-center justify-between pl-3 text-[13px]">
                    <span className="text-[var(--text-secondary)]">Output</span>
                    <span className="font-medium text-[var(--text-primary)]">{model.cost.fastOutput}</span>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h3 className="mb-1 text-[13px] font-semibold text-[var(--text-primary)]">Features</h3>
              <FeatureRow label="Context window" value={model.features.context} />
              <FeatureRow label="Max output" value={model.features.maxOutput} />
              <FeatureRow label="Speed" value={model.features.speed} />
              <div className="flex items-center justify-between border-b border-solid border-[var(--border-subtle)] py-3">
                <span className="text-[13px] text-[var(--text-secondary)]">Fast mode</span>
                <span className="text-[13px] font-medium text-[var(--text-primary)]">—</span>
              </div>
              <FeatureRow label="Provider" value={model.features.provider} />
            </div>
          </div>

          <p className="mt-5 text-[12px] text-[var(--text-tertiary)]">
            Standard list prices.{" "}
            <Link to="/models" onClick={onClose} className="underline hover:text-[var(--text-secondary)]">
              View full pricing
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

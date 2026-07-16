"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle, Key } from "@phosphor-icons/react";
import type { InstalledMiniApp } from "./mini-app.types";

export function MiniAppSecretsPanel({ app }: { app: InstalledMiniApp }) {
  const api =
    typeof window !== "undefined" ? window.allternit?.miniApps : undefined;
  const requested = app.permissions?.secrets || [];
  const [stored, setStored] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    if (api?.listSecrets) void api.listSecrets(app.id).then(setStored);
  }, [api, app.id]);
  if (!requested.length) return null;
  const save = async (name: string) => {
    const value = values[name];
    if (!api?.setSecret || !value) return;
    const result = await api.setSecret(app.id, name, value);
    if (!result.success) {
      setError(result.error || "Secret could not be stored");
      return;
    }
    setStored((current) => [...new Set([...current, name])]);
    setValues((current) => ({ ...current, [name]: "" }));
    setError("");
  };
  return (
    <div className="mt-6 rounded-xl border border-[var(--border-subtle)] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Key size={16} />
        Required secrets
      </div>
      <p className="mt-1 text-xs text-[var(--text-tertiary)]">
        Encrypted by the operating system and isolated to this miniapp.
      </p>
      <div className="mt-4 space-y-3">
        {requested.map((name) => (
          <div key={name}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span>{name}</span>
              {stored.includes(name) && (
                <span className="flex items-center gap-1 text-green-500">
                  <CheckCircle size={13} />
                  Stored
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={values[name] || ""}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [name]: event.target.value,
                  }))
                }
                placeholder={
                  stored.includes(name)
                    ? "Replace stored value"
                    : "Enter secret"
                }
                className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-sm"
              />
              <button
                type="button"
                onClick={() => void save(name)}
                disabled={!api?.setSecret || !values[name]}
                className="h-9 rounded-lg border border-[var(--border-default)] px-3 text-xs disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
    </div>
  );
}

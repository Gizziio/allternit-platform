import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createPasswordCredential,
  deleteVaultCredential,
  listVaultCredentials,
  type StoredCredential,
} from '@/lib/vault/api';
import {
  formatLabel,
  parsePasswordExport,
  type ImportCredential,
  type ImportFormat,
} from '@/lib/vault/import';

interface VaultPanelProps {
  onBack: () => void;
}

export function VaultPanel({ onBack }: VaultPanelProps) {
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [provider, setProvider] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [origin, setOrigin] = useState('');
  const [adding, setAdding] = useState(false);

  const [importText, setImportText] = useState('');
  const [detectedFormat, setDetectedFormat] = useState<ImportFormat>('unknown');
  const [importPreview, setImportPreview] = useState<ImportCredential[]>([]);
  const [importing, setImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listVaultCredentials();
      setCredentials(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const trimmed = importText.trim();
    if (!trimmed) {
      setDetectedFormat('unknown');
      setImportPreview([]);
      return;
    }
    const result = parsePasswordExport(trimmed);
    setDetectedFormat(result.format);
    setImportPreview(result.credentials.slice(0, 5));
  }, [importText]);

  const handleAdd = async () => {
    if (!provider || !username || !password) return;
    setAdding(true);
    setError(null);
    try {
      await createPasswordCredential(provider, username, password, origin || undefined);
      setProvider('');
      setUsername('');
      setPassword('');
      setOrigin('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this credential?')) return;
    setError(null);
    try {
      await deleteVaultCredential(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setImportText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImport = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const result = parsePasswordExport(importText);
      let imported = 0;
      for (const cred of result.credentials) {
        await createPasswordCredential(
          cred.provider,
          cred.username,
          cred.password,
          cred.originPattern || undefined,
        );
        imported++;
      }
      setImportText('');
      await load();
      alert(`Imported ${imported} credential${imported === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          ←
        </button>
        <span className="text-sm font-medium">Password Vault</span>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium text-foreground">Agent-native password manager</p>
          <p className="text-[10px] text-muted-foreground">
            Credentials are encrypted server-side and only decrypted when the extension requests a
            fill. Supports 1Password, Bitwarden, and Chrome CSV exports.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium">Add credential</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-[10px] text-muted-foreground">Site / provider</Label>
              <Input
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g. GitHub"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="user@example.com"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-8 text-xs"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px] text-muted-foreground">Origin (optional)</Label>
              <Input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="github.com"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <Button
            size="sm"
            disabled={!provider || !username || !password || adding}
            onClick={handleAdd}
            className="h-8 w-full text-xs"
          >
            {adding ? 'Saving…' : 'Save credential'}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium">Import from password manager</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 w-full text-xs"
          >
            Choose CSV export…
          </Button>

          {importText && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground">
                Detected format:{' '}
                <span className="font-medium text-foreground">{formatLabel(detectedFormat)}</span>
                {detectedFormat !== 'unknown' && (
                  <>
                    {' '}
                    · {parsePasswordExport(importText).credentials.length} credential
                    {parsePasswordExport(importText).credentials.length === 1 ? '' : 's'}
                  </>
                )}
              </p>
              {importPreview.length > 0 && (
                <div className="rounded-md border bg-muted/20 p-2">
                  <p className="mb-1 text-[10px] text-muted-foreground">Preview</p>
                  {importPreview.map((cred, index) => (
                    <div key={index} className="text-[10px]">
                      <span className="font-medium">{cred.provider}</span>
                      <span className="text-muted-foreground"> · {cred.username}</span>
                    </div>
                  ))}
                </div>
              )}
              <Button
                size="sm"
                disabled={detectedFormat === 'unknown' || importing}
                onClick={handleImport}
                className="h-8 w-full text-xs"
              >
                {importing ? 'Importing…' : 'Import credentials'}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium">Saved credentials</p>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : credentials.length === 0 ? (
            <p className="text-xs text-muted-foreground">No credentials saved yet.</p>
          ) : (
            <div className="space-y-1.5">
              {credentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between rounded-md border bg-muted/20 px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{cred.provider}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {cred.username ?? 'No username'}
                      {cred.origin_pattern ? ` · ${cred.origin_pattern}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(cred.id)}
                    className="ml-2 shrink-0 text-[10px] text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

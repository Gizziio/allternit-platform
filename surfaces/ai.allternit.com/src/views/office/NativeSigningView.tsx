"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CaretLeft,
  CaretRight,
  CheckCircle,
  Download,
  FileArrowUp,
  FloppyDisk,
  PenNib,
  Plus,
  ShareNetwork,
  Signature,
  TextT,
  Trash,
  X,
} from "@phosphor-icons/react";
import {
  buildSignedPdf,
  canvasToPngBytes,
  loadPdfDocument,
  renderPageToCanvas,
  type SignatureField,
  type Signer,
} from "@/lib/native-signing";
import { createArtifact } from "@/services/artifacts-api";

const SIGNER_PALETTE = [
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
];

function makeId(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

interface SignaturePadProps {
  onSave: (pngBytes: Uint8Array, dataUrl: string) => void;
  onCancel: () => void;
  color: string;
}

function SignaturePad({ onSave, onCancel, color }: SignaturePadProps): React.ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;
  }, [color]);

  const getPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    drawingRef.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const bytes = await canvasToPngBytes(canvas);
    onSave(bytes, dataUrl);
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
      <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
        Draw signature
      </p>
      <canvas
        ref={canvasRef}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        className="w-full cursor-crosshair touch-none rounded-lg border border-dashed border-[var(--border-subtle)] bg-white"
        style={{ height: 140 }}
      />
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={clear}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          className="rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--bg-elevated)] hover:opacity-90"
        >
          Save signature
        </button>
      </div>
    </div>
  );
}

interface TypedSignatureProps {
  onSave: (pngBytes: Uint8Array, dataUrl: string) => void;
  color: string;
}

function TypedSignature({ onSave, color }: TypedSignatureProps): React.ReactNode {
  const [name, setName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.font = "italic 600 42px 'Brush Script MT', 'Comic Sans MS', cursive, sans-serif";
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(name || "Your signature", rect.width / 2, rect.height / 2);
  }, [name, color]);

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !name.trim()) return;
    const dataUrl = canvas.toDataURL("image/png");
    const bytes = await canvasToPngBytes(canvas);
    onSave(bytes, dataUrl);
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
      <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
        Type signature
      </p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Type your full name"
        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
      />
      <canvas
        ref={canvasRef}
        className="mt-3 w-full rounded-lg border border-dashed border-[var(--border-subtle)] bg-white"
        style={{ height: 100 }}
      />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => void save()}
          className="rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--bg-elevated)] hover:opacity-90 disabled:opacity-50"
        >
          Save signature
        </button>
      </div>
    </div>
  );
}

export function NativeSigningView(): React.ReactNode {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<import('pdfjs-dist').PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.4);
  const [signers, setSigners] = useState<Signer[]>([
    { id: makeId("signer"), name: "", email: "", color: SIGNER_PALETTE[0] },
  ]);
  const [selectedSignerId, setSelectedSignerId] = useState<string | null>(null);
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [placing, setPlacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<"draw" | "type" | null>(null);
  const [signedOutput, setSignedOutput] = useState<{ bytes: Uint8Array; blob: Blob } | null>(null);
  const [savedArtifactId, setSavedArtifactId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<import('pdfjs-dist').PageViewport | null>(null);

  const selectedSigner = useMemo(
    () => signers.find((s) => s.id === selectedSignerId) ?? signers[0] ?? null,
    [signers, selectedSignerId]
  );

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await loadPdfDocument(file);
      setPdfFile(file);
      setPdfBytes(bytes);
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setPage(1);
      setFields([]);
      setSelectedSignerId(signers[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PDF");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    renderPageToCanvas(pdfDoc, page, canvasRef.current, scale)
      .then(({ viewport }) => {
        if (!cancelled) viewportRef.current = viewport;
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Render failed"));
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, page, scale]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!placing || !selectedSigner || !canvasRef.current || !viewportRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const viewX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const viewY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const [pdfX, pdfY] = viewportRef.current.convertToPdfPoint(viewX, viewY);

    const width = 150;
    const height = 60;
    setFields((prev) => [
      ...prev,
      {
        id: makeId("field"),
        signerId: selectedSigner.id,
        page,
        x: pdfX - width / 2,
        y: pdfY - height / 2,
        width,
        height,
      },
    ]);
  };

  const updateSigner = (id: string, patch: Partial<Signer>) => {
    setSigners((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addSigner = () => {
    const next: Signer = {
      id: makeId("signer"),
      name: "",
      email: "",
      color: SIGNER_PALETTE[signers.length % SIGNER_PALETTE.length],
    };
    setSigners((prev) => [...prev, next]);
    setSelectedSignerId(next.id);
  };

  const removeSigner = (id: string) => {
    setSigners((prev) => prev.filter((s) => s.id !== id));
    setFields((prev) => prev.filter((f) => f.signerId !== id));
    if (selectedSignerId === id) {
      setSelectedSignerId(signers.find((s) => s.id !== id)?.id ?? null);
    }
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSignatureSave = (signerId: string, pngBytes: Uint8Array, dataUrl: string) => {
    updateSigner(signerId, { signaturePng: pngBytes });
    setCaptureMode(null);
  };

  const finalize = async () => {
    if (!pdfBytes || !pdfFile) return;
    const unsigned = fields.filter((f) => {
      const s = signers.find((x) => x.id === f.signerId);
      return !s?.signaturePng;
    });
    if (unsigned.length > 0) {
      setError("Every signer with a placed field must have a signature.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const signed = await buildSignedPdf(pdfBytes, signers, fields);
      const signedBuffer = signed.buffer.slice(
        signed.byteOffset,
        signed.byteOffset + signed.byteLength,
      ) as ArrayBuffer;
      const blob = new Blob([signedBuffer], { type: "application/pdf" });
      setSignedOutput({ bytes: signed, blob });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = pdfFile.name.replace(/\.pdf$/i, "");
      a.download = `${baseName}-signed.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build signed PDF");
    } finally {
      setBusy(false);
    }
  };

  const saveToArtifactLibrary = async () => {
    if (!signedOutput?.blob || !pdfFile) return;
    setSaving(true);
    setSavingError(null);
    try {
      const buffer = await signedOutput.blob.arrayBuffer();
      const dataUrl = `data:application/pdf;base64,${arrayBufferToBase64(buffer)}`;
      const baseName = pdfFile.name.replace(/\.pdf$/i, "");
      const signerNames = signers.map((s) => s.name || "Signer").join(", ");
      const artifact = await createArtifact({
        workspaceId: "ws_allternit",
        title: `${baseName} — signed`,
        type: "document",
        status: "final",
        summary: `Signed by ${signerNames} using Allternit Sign.`,
        tags: ["signed", "pdf", "esign"],
        sections: [
          {
            heading: "Signed PDF",
            kind: "pdf",
            body: dataUrl,
            position: 0,
          },
        ],
      });
      setSavedArtifactId(artifact.id);
    } catch (err) {
      setSavingError(err instanceof Error ? err.message : "Failed to save artifact");
    } finally {
      setSaving(false);
    }
  };

  const shareSignedPdf = async () => {
    if (!signedOutput?.blob || !pdfFile) return;
    const baseName = pdfFile.name.replace(/\.pdf$/i, "");
    const file = new File([signedOutput.blob], `${baseName}-signed.pdf`, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `${baseName} — signed`,
          files: [file],
        });
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setSavingError(err instanceof Error ? err.message : "Failed to share");
        }
      }
    } else {
      const url = URL.createObjectURL(signedOutput.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}-signed.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  };

  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  const pageFields = useMemo(() => fields.filter((f) => f.page === page), [fields, page]);

  return (
    <div className="h-full overflow-auto bg-[var(--surface-canvas)] p-6">
      <div className="mx-auto max-w-6xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-floating)] p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-xl"
              style={{
                background:
                  "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
              }}
            >
              <Signature size={20} weight="fill" color="#fff" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                Allternit Sign
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">
                Native document signing — no cloud service, no API key, no Docker.
              </p>
            </div>
          </div>

          {pdfDoc ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPlacing((p) => !p)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  placing
                    ? "bg-[var(--accent-primary)] text-white"
                    : "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <PenNib size={14} />
                {placing ? "Stop placing" : "Place signature"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => void loadFile(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
              >
                <FileArrowUp size={14} />
                Replace PDF
              </button>
            </div>
          ) : null}
        </div>

        {!pdfDoc ? (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--surface-panel)] p-12 transition-colors hover:border-[var(--accent-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--surface-canvas)]">
                <FileArrowUp size={28} className="text-[var(--accent-primary)]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Upload a PDF to sign
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Click to browse or drop a file here.
                </p>
              </div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => void loadFile(e.target.files?.[0])}
            />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
            {/* Left sidebar */}
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    Signers
                  </span>
                  <button
                    type="button"
                    onClick={addSigner}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--accent-primary)] hover:bg-[var(--surface-hover)]"
                  >
                    <Plus size={13} />
                    Add signer
                  </button>
                </div>
                <div className="space-y-2">
                  {signers.map((signer) => (
                    <div
                      key={signer.id}
                      onClick={() => setSelectedSignerId(signer.id)}
                      className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                        selectedSignerId === signer.id
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                          : "border-[var(--border-subtle)] bg-[var(--surface-floating)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className="mt-0.5 h-3 w-3 rounded-full"
                          style={{ background: signer.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <input
                            type="text"
                            value={signer.name}
                            onChange={(e) => updateSigner(signer.id, { name: e.target.value })}
                            placeholder="Signer name"
                            className="w-full bg-transparent text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <input
                            type="email"
                            value={signer.email}
                            onChange={(e) => updateSigner(signer.id, { email: e.target.value })}
                            placeholder="email@example.com"
                            className="mt-1 w-full bg-transparent text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                          {signer.signaturePng ? (
                            <p className="mt-1.5 text-[11px] font-medium text-[var(--status-success)]">
                              Signature captured
                            </p>
                          ) : (
                            <p className="mt-1.5 text-[11px] text-[var(--status-warning)]">
                              Signature missing
                            </p>
                          )}
                        </div>
                        {signers.length > 1 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSigner(signer.id);
                            }}
                            className="grid h-7 w-7 place-items-center rounded-lg text-[var(--status-error)] hover:bg-[var(--status-error-bg)]"
                          >
                            <Trash size={14} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {selectedSigner ? (
                  <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        Signature for {selectedSigner.name || "signer"}
                      </span>
                    </div>
                    {captureMode === null ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCaptureMode("draw")}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-floating)] py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                        >
                          <PenNib size={14} />
                          Draw
                        </button>
                        <button
                          type="button"
                          onClick={() => setCaptureMode("type")}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-floating)] py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                        >
                          <TextT size={14} />
                          Type
                        </button>
                      </div>
                    ) : captureMode === "draw" ? (
                      <SignaturePad
                        color={selectedSigner.color}
                        onCancel={() => setCaptureMode(null)}
                        onSave={(bytes) =>
                          handleSignatureSave(selectedSigner.id, bytes, "")
                        }
                      />
                    ) : (
                      <TypedSignature
                        color={selectedSigner.color}
                        onSave={(bytes) =>
                          handleSignatureSave(selectedSigner.id, bytes, "")
                        }
                      />
                    )}
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    Placed fields ({fields.length})
                  </span>
                </div>
                {fields.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">
                    Click “Place signature” then click on the page preview to drop a
                    signature field.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {fields.map((field) => {
                      const signer = signers.find((s) => s.id === field.signerId);
                      return (
                        <li
                          key={field.id}
                          className="flex items-center justify-between rounded-lg bg-[var(--surface-floating)] px-2.5 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ background: signer?.color }}
                            />
                            <span className="text-[var(--text-primary)]">
                              {signer?.name || "Signer"} — page {field.page}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeField(field.id)}
                            className="grid h-6 w-6 place-items-center rounded-md text-[var(--status-error)] hover:bg-[var(--status-error-bg)]"
                          >
                            <X size={12} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {error ? (
                <div className="rounded-lg border border-[var(--status-error)]/30 bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error)]">
                  {error}
                </div>
              ) : null}

              {savingError ? (
                <div className="rounded-lg border border-[var(--status-error)]/30 bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error)]">
                  {savingError}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void finalize()}
                disabled={busy || fields.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--text-primary)] py-2.5 text-sm font-semibold text-[var(--bg-elevated)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Download size={16} />
                {busy ? "Building PDF…" : "Download signed PDF"}
              </button>

              {signedOutput ? (
                <div className="space-y-2">
                  <div className="rounded-lg border border-[var(--status-success)]/30 bg-[var(--status-success-bg)] px-3 py-2 text-xs text-[var(--status-success)]">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle size={13} weight="fill" />
                      <span className="font-medium">Signed PDF ready</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void saveToArtifactLibrary()}
                      disabled={saving || !!savedArtifactId}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-floating)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
                    >
                      <FloppyDisk size={14} />
                      {savedArtifactId ? "Saved" : saving ? "Saving…" : "Save to library"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void shareSignedPdf()}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-floating)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      <ShareNetwork size={14} />
                      Share
                    </button>
                  </div>
                  {savedArtifactId ? (
                    <p className="text-[11px] text-[var(--status-success)]">
                      Saved to artifact library.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Preview */}
            <div className="flex min-w-0 flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
                  >
                    <CaretLeft size={14} />
                  </button>
                  <span className="min-w-[5rem] text-center text-xs font-medium text-[var(--text-primary)]">
                    {page} / {numPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= numPages}
                    onClick={() => setPage((p) => Math.min(numPages, p + 1))}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
                  >
                    <CaretRight size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">Zoom</span>
                  <input
                    type="range"
                    min={0.8}
                    max={2.2}
                    step={0.1}
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="w-28 accent-[var(--accent-primary)]"
                  />
                  <span className="w-8 text-right text-xs text-[var(--text-secondary)]">
                    {Math.round(scale * 100)}%
                  </span>
                </div>
              </div>

              <div className="relative flex-1 overflow-auto rounded-lg bg-[var(--surface-canvas)]">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className={`absolute left-0 top-0 origin-top-left ${
                    placing ? "cursor-crosshair" : "cursor-default"
                  }`}
                />
                {viewportRef.current
                  ? pageFields.map((field) => {
                      const signer = signers.find((s) => s.id === field.signerId);
                      const [vx, vy] = viewportRef.current!.convertToViewportPoint(
                        field.x,
                        field.y + field.height
                      );
                      return (
                        <div
                          key={field.id}
                          className="pointer-events-none absolute flex items-center justify-center rounded-md border-2 text-[10px] font-semibold"
                          style={{
                            left: vx,
                            top: vy,
                            width: field.width * viewportRef.current!.scale,
                            height: field.height * viewportRef.current!.scale,
                            borderColor: signer?.color,
                            color: signer?.color,
                            background: `${signer?.color}15`,
                          }}
                        >
                          {signer?.name || "Signature"}
                        </div>
                      );
                    })
                  : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NativeSigningView;

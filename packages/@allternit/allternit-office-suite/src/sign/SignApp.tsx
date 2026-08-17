import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildSignedPdf,
  canvasToPngBytes,
  loadPdfDocument,
  pngBytesToDataUrl,
  renderPageToCanvas,
  type SignatureField,
  type Signer,
} from './pdf-signing';
import { useOfficeHostRequired } from '../bridge/OfficeHostContext';

const SIGNER_PALETTE = [
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#ef4444',
  '#84cc16',
];

function makeId(prefix = 'id'): string {
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
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;
  }, [color]);

  const getPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
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
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const bytes = await canvasToPngBytes(canvas);
    onSave(bytes, dataUrl);
  };

  return (
    <div className="aos-sign-pad-panel">
      <p className="aos-sign-section-label">Draw signature</p>
      <canvas
        ref={canvasRef}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        className="aos-sign-pad"
      />
      <div className="aos-sign-actions">
        <button type="button" onClick={clear} className="aos-sign-btn">
          Clear
        </button>
        <button type="button" onClick={onCancel} className="aos-sign-btn">
          Cancel
        </button>
        <button type="button" onClick={() => void save()} className="aos-sign-btn primary">
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
  const [name, setName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.font = "italic 600 42px 'Brush Script MT', 'Comic Sans MS', cursive, sans-serif";
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(name || 'Your signature', rect.width / 2, rect.height / 2);
  }, [name, color]);

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !name.trim()) return;
    const dataUrl = canvas.toDataURL('image/png');
    const bytes = await canvasToPngBytes(canvas);
    onSave(bytes, dataUrl);
  };

  return (
    <div className="aos-sign-pad-panel">
      <p className="aos-sign-section-label">Type signature</p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Type your full name"
        className="aos-sign-text-input"
      />
      <canvas ref={canvasRef} className="aos-sign-preview-canvas" />
      <div className="aos-sign-actions justify-end">
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => void save()}
          className="aos-sign-btn primary"
        >
          Save signature
        </button>
      </div>
    </div>
  );
}

export interface SignAppProps {
  /** Optional PDF file to open on boot. */
  file?: File | null;
}

/**
 * Allternit Sign — host-aware native document signing.
 *
 * Renders PDF pages with pdfjs-dist, lets users draw/type signatures and drop
 * signature fields onto the page, then builds and saves the signed PDF through
 * the host's `saveFile` contract.
 */
export function SignApp({ file: initialFile }: SignAppProps): React.ReactNode {
  const host = useOfficeHostRequired();

  const [pdfFile, setPdfFile] = useState<File | null>(initialFile ?? null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<import('pdfjs-dist').PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.4);
  const [signers, setSigners] = useState<Signer[]>([
    { id: makeId('signer'), name: '', email: '', color: SIGNER_PALETTE[0] },
  ]);
  const [selectedSignerId, setSelectedSignerId] = useState<string | null>(null);
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [placing, setPlacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<'draw' | 'type' | null>(null);
  const [signedOutput, setSignedOutput] = useState<{ bytes: Uint8Array; blob: Blob } | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<import('pdfjs-dist').PageViewport | null>(null);

  const selectedSigner = useMemo(
    () => signers.find((s) => s.id === selectedSignerId) ?? signers[0] ?? null,
    [signers, selectedSignerId],
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
      setSignedOutput(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PDF');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialFile && !pdfFile) {
      void loadFile(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    renderPageToCanvas(pdfDoc, page, canvasRef.current, scale)
      .then(({ viewport }) => {
        if (!cancelled) viewportRef.current = viewport;
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Render failed'));
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
        id: makeId('field'),
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
      id: makeId('signer'),
      name: '',
      email: '',
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

  const handleSignatureSave = (signerId: string, pngBytes: Uint8Array) => {
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
      setError('Every signer with a placed field must have a signature.');
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
      const blob = new Blob([signedBuffer], { type: 'application/pdf' });
      setSignedOutput({ bytes: signed, blob });

      const baseName = pdfFile.name.replace(/\.pdf$/i, '');
      const name = `${baseName}-signed.pdf`;
      await host.saveFile(signed, name, { suggestedName: name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build signed PDF');
    } finally {
      setBusy(false);
    }
  };

  const pageFields = useMemo(() => fields.filter((f) => f.page === page), [fields, page]);

  return (
    <div className="aos-sign-root">
      <div className="aos-sign-card">
        <div className="aos-sign-header">
          <div className="aos-sign-title-row">
            <div className="aos-sign-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 17c3.3-1.3 6-5 7-8.5.8-2.6 1.5-5 3-5s2.5 2 2 4c-.5 2.5-2 5.5-3 7.5-1.5 3-4 5-6 5s-3-2-3-3Z" />
                <path d="M3 21h18" />
              </svg>
            </div>
            <div>
              <h1 className="aos-sign-title">Allternit Sign</h1>
              <p className="aos-sign-subtitle">
                Native document signing — no cloud service, no API key, no Docker.
              </p>
            </div>
          </div>

          {pdfDoc ? (
            <div className="aos-sign-header-actions">
              <button
                type="button"
                onClick={() => setPlacing((p) => !p)}
                className={`aos-sign-btn ${placing ? 'primary' : ''}`}
              >
                {placing ? 'Stop placing' : 'Place signature'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="aos-sign-hidden-input"
                onChange={(e) => void loadFile(e.target.files?.[0])}
              />
              <button type="button" onClick={() => fileRef.current?.click()} className="aos-sign-btn">
                Replace PDF
              </button>
            </div>
          ) : null}
        </div>

        {!pdfDoc ? (
          <div className="aos-sign-upload">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="aos-sign-upload-button"
            >
              <div className="aos-sign-upload-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M17 8l-5-5-5 5" />
                  <path d="M12 3v12" />
                </svg>
              </div>
              <div>
                <p className="aos-sign-upload-title">Upload a PDF to sign</p>
                <p className="aos-sign-upload-hint">Click to browse or drop a file here.</p>
              </div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="aos-sign-hidden-input"
              onChange={(e) => void loadFile(e.target.files?.[0])}
            />
          </div>
        ) : (
          <div className="aos-sign-workspace">
            <div className="aos-sign-sidebar">
              <div className="aos-sign-panel">
                <div className="aos-sign-panel-header">
                  <span className="aos-sign-section-label">Signers</span>
                  <button type="button" onClick={addSigner} className="aos-sign-text-btn">
                    Add signer
                  </button>
                </div>
                <div className="aos-sign-signer-list">
                  {signers.map((signer) => (
                    <div
                      key={signer.id}
                      onClick={() => setSelectedSignerId(signer.id)}
                      className={`aos-sign-signer ${selectedSignerId === signer.id ? 'selected' : ''}`}
                    >
                      <div className="aos-sign-signer-row">
                        <div className="aos-sign-color-dot" style={{ background: signer.color }} />
                        <div className="aos-sign-signer-fields">
                          <input
                            type="text"
                            value={signer.name}
                            onChange={(e) => updateSigner(signer.id, { name: e.target.value })}
                            placeholder="Signer name"
                            className="aos-sign-inline-input"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <input
                            type="email"
                            value={signer.email}
                            onChange={(e) => updateSigner(signer.id, { email: e.target.value })}
                            placeholder="email@example.com"
                            className="aos-sign-inline-input small"
                            onClick={(e) => e.stopPropagation()}
                          />
                          {signer.signaturePng ? (
                            <p className="aos-sign-status success">Signature captured</p>
                          ) : (
                            <p className="aos-sign-status warning">Signature missing</p>
                          )}
                        </div>
                        {signers.length > 1 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSigner(signer.id);
                            }}
                            className="aos-sign-icon-btn danger"
                            aria-label="Remove signer"
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {selectedSigner ? (
                  <div className="aos-sign-signature-capture">
                    <div className="aos-sign-section-label">
                      Signature for {selectedSigner.name || 'signer'}
                    </div>
                    {captureMode === null ? (
                      <div className="aos-sign-capture-choices">
                        <button type="button" onClick={() => setCaptureMode('draw')} className="aos-sign-btn">
                          Draw
                        </button>
                        <button type="button" onClick={() => setCaptureMode('type')} className="aos-sign-btn">
                          Type
                        </button>
                      </div>
                    ) : captureMode === 'draw' ? (
                      <SignaturePad
                        color={selectedSigner.color}
                        onCancel={() => setCaptureMode(null)}
                        onSave={(bytes) => handleSignatureSave(selectedSigner.id, bytes)}
                      />
                    ) : (
                      <TypedSignature
                        color={selectedSigner.color}
                        onSave={(bytes) => handleSignatureSave(selectedSigner.id, bytes)}
                      />
                    )}
                  </div>
                ) : null}
              </div>

              <div className="aos-sign-panel">
                <div className="aos-sign-panel-header">
                  <span className="aos-sign-section-label">Placed fields ({fields.length})</span>
                </div>
                {fields.length === 0 ? (
                  <p className="aos-sign-hint">
                    Click “Place signature” then click on the page preview to drop a signature field.
                  </p>
                ) : (
                  <ul className="aos-sign-field-list">
                    {fields.map((field) => {
                      const signer = signers.find((s) => s.id === field.signerId);
                      return (
                        <li key={field.id} className="aos-sign-field">
                          <div className="aos-sign-field-info">
                            <div className="aos-sign-color-dot" style={{ background: signer?.color }} />
                            <span>
                              {signer?.name || 'Signer'} — page {field.page}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeField(field.id)}
                            className="aos-sign-icon-btn danger"
                            aria-label="Remove field"
                          >
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {error ? <div className="aos-sign-alert error">{error}</div> : null}

              <button
                type="button"
                onClick={() => void finalize()}
                disabled={busy || fields.length === 0}
                className="aos-sign-btn primary block"
              >
                {busy ? 'Building PDF…' : 'Save signed PDF'}
              </button>

              {signedOutput ? (
                <div className="aos-sign-alert success">Signed PDF saved via host.</div>
              ) : null}
            </div>

            <div className="aos-sign-preview-panel">
              <div className="aos-sign-preview-toolbar">
                <div className="aos-sign-pagination">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="aos-sign-icon-btn"
                    aria-label="Previous page"
                  >
                    ‹
                  </button>
                  <span className="aos-sign-page-number">
                    {page} / {numPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= numPages}
                    onClick={() => setPage((p) => Math.min(numPages, p + 1))}
                    className="aos-sign-icon-btn"
                    aria-label="Next page"
                  >
                    ›
                  </button>
                </div>
                <div className="aos-sign-zoom">
                  <span className="aos-sign-hint">Zoom</span>
                  <input
                    type="range"
                    min={0.8}
                    max={2.2}
                    step={0.1}
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="aos-sign-zoom-slider"
                  />
                  <span className="aos-sign-zoom-value">{Math.round(scale * 100)}%</span>
                </div>
              </div>

              <div className="aos-sign-canvas-wrap">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className={`aos-sign-canvas ${placing ? 'placing' : ''}`}
                />
                {viewportRef.current
                  ? pageFields.map((field) => {
                      const signer = signers.find((s) => s.id === field.signerId);
                      const [vx, vy] = viewportRef.current!.convertToViewportPoint(
                        field.x,
                        field.y + field.height,
                      );
                      return (
                        <div
                          key={field.id}
                          className="aos-sign-field-overlay"
                          style={{
                            left: vx,
                            top: vy,
                            width: field.width * viewportRef.current!.scale,
                            height: field.height * viewportRef.current!.scale,
                            borderColor: signer?.color,
                            color: signer?.color,
                            background: signer?.signaturePng ? undefined : `${signer?.color}15`,
                          }}
                        >
                          {signer?.signaturePng ? (
                            <img
                              src={pngBytesToDataUrl(signer.signaturePng)}
                              alt="Signature preview"
                              className="aos-sign-field-image"
                            />
                          ) : (
                            signer?.name || 'Signature'
                          )}
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

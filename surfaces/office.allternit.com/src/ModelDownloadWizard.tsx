import type { NeedleProgress } from './ai/needleLoader'

export interface ModelDownloadWizardProps {
  progress: NeedleProgress
  onCancel?: () => void
}

export function ModelDownloadWizard({ progress, onCancel }: ModelDownloadWizardProps) {
  const percent =
    progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 12, 10, 0.92)',
        zIndex: 1000,
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          padding: 32,
          borderRadius: 16,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 20, color: 'var(--accent)' }}>
          Loading local AI model
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.5, color: 'var(--muted)' }}>
          Allternit Office can run a tiny AI model directly in your browser so your documents never
          leave your device. The model downloads once and is cached for future visits.
        </p>

        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: 'rgba(200, 168, 140, 0.12)',
            overflow: 'hidden',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: `${Math.min(percent, 100)}%`,
              height: '100%',
              background: 'var(--accent)',
              transition: 'width 200ms ease',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 13,
            color: 'var(--muted)',
          }}
        >
          <span>{progress.message}</span>
          {progress.total > 0 && (
            <span>
              {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
            </span>
          )}
        </div>

        <div
          style={{
            marginTop: 20,
            padding: 12,
            borderRadius: 8,
            background: 'rgba(200, 168, 140, 0.06)',
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--muted)',
          }}
        >
          <strong style={{ color: 'var(--text)' }}>Limitation:</strong> The local model is great for
          quick actions like reading cells, inserting slides, or simple edits. For complex,
          multi-step reasoning, sign in to Allternit Cloud to use a larger backend model.
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              marginTop: 20,
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / k ** i).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`
}

import React, { useState, useEffect } from 'react'
import { X, Play, CheckCircle2, AlertTriangle, Layers, Clock, Zap } from 'lucide-react'
import { compareModels } from '../api'
import { MultiModelComparisonResponse, DiagnosticClass } from '../types'

interface MultiModelComparisonModalProps {
  signal: number[][] | null
  onClose: () => void
  onSelectModel?: (model: string) => void
}

const AVAILABLE_MODELS = [
  { id: 'seq', label: 'Seq (ResNet+BiGRU+Attn)' },
  { id: 'cnn', label: 'CNN (ResNet1D)' },
  { id: 'hybrid', label: 'Hybrid (Deep + Wavelets)' },
  { id: 'gated', label: 'Gated Fusion' },
  { id: 'multiscale_current', label: 'MultiScale ResNet' },
]

export const MultiModelComparisonModal: React.FC<MultiModelComparisonModalProps> = ({
  signal,
  onClose,
  onSelectModel,
}) => {
  const [selectedModels, setSelectedModels] = useState<string[]>(['seq', 'cnn', 'gated', 'hybrid'])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [result, setResult] = useState<MultiModelComparisonResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (signal) {
      runComparison()
    }
  }, [signal])

  const runComparison = async () => {
    if (!signal) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await compareModels(signal, selectedModels)
      setResult(res)
    } catch (err: any) {
      setError(err.message || 'Comparison failed')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleModel = (id: string) => {
    if (selectedModels.includes(id)) {
      if (selectedModels.length > 1) {
        setSelectedModels(selectedModels.filter((m) => m !== id))
      }
    } else {
      setSelectedModels([...selectedModels, id])
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-elevated)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} color="var(--accent-burgundy)" />
              Multi-Model Prediction Comparison &amp; Agreement
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Evaluates the exact same 12-lead ECG tensor simultaneously across deep neural network architectures.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Controls */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Models:</span>
            {AVAILABLE_MODELS.map((m) => {
              const active = selectedModels.includes(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => toggleModel(m.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: active ? '1px solid var(--accent-burgundy)' : '1px solid var(--border-light)',
                    backgroundColor: active ? 'var(--accent-subtle)' : 'var(--bg-primary)',
                    color: active ? 'var(--accent-burgundy)' : 'var(--text-primary)',
                  }}
                >
                  {m.label}
                </button>
              )
            })}
            <button
              onClick={runComparison}
              disabled={isLoading}
              className="btn btn-primary"
              style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: '0.82rem' }}
            >
              <Play size={14} /> {isLoading ? 'Evaluating...' : 'Re-Evaluate'}
            </button>
          </div>

          {error && (
            <div style={{ padding: '12px', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {result && (
            <div>
              {/* Agreement Matrix */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Multi-Model Consensus &amp; Agreement Summary
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                  {result.classes.map((cls) => {
                    const ag = result.agreement[cls]
                    if (!ag) return null
                    return (
                      <div
                        key={cls}
                        style={{
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-light)',
                          backgroundColor: ag.consensus_detected ? 'var(--accent-subtle)' : 'var(--bg-primary)',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-burgundy)' }}>{cls}</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: ag.consensus_detected ? 'var(--accent-burgundy)' : 'var(--text-secondary)', marginTop: '2px' }}>
                          {ag.consensus_detected ? 'CONSENSUS DETECTED' : 'CONSENSUS NEGATIVE'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                          Agreement: <b>{Math.round(ag.agreement_ratio * 100)}%</b> ({ag.positive_count}/{ag.total_models})
                        </div>
                        {ag.unanimous && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-success)', fontWeight: 600, marginTop: '4px' }}>
                            ✓ Unanimous
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Side-by-Side Model Outputs */}
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Per-Model Numerical Outputs &amp; Decision Status
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-light)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px 10px' }}>Architecture</th>
                      <th style={{ padding: '8px 10px' }}>Latency</th>
                      {result.classes.map((c) => (
                        <th key={c} style={{ padding: '8px 10px' }}>{c}</th>
                      ))}
                      <th style={{ padding: '8px 10px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.models).map(([mKey, mData]) => {
                      return (
                        <tr key={mKey} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {mData.display_name || mKey}
                          </td>
                          <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                            {mData.latency_ms} ms
                          </td>
                          {result.classes.map((c) => {
                            const p = mData.probabilities ? mData.probabilities[c] : null
                            const pred = mData.predictions ? mData.predictions.find((x) => x.class === c) : null
                            const isDet = pred?.detected
                            return (
                              <td key={c} style={{ padding: '10px' }}>
                                {p !== null && p !== undefined ? (
                                  <div>
                                    <span style={{ fontWeight: isDet ? 700 : 500, color: isDet ? 'var(--accent-burgundy)' : 'var(--text-primary)' }}>
                                      {(p * 100).toFixed(1)}%
                                    </span>
                                    {isDet && (
                                      <span style={{ marginLeft: '4px', fontSize: '0.65rem', padding: '1px 4px', borderRadius: '3px', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', fontWeight: 700 }}>
                                        +
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  '—'
                                )}
                              </td>
                            )
                          })}
                          <td style={{ padding: '10px' }}>
                            <button
                              onClick={() => {
                                onSelectModel?.(mKey)
                                onClose()
                              }}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-light)',
                                background: 'var(--bg-surface)',
                                cursor: 'pointer',
                              }}
                            >
                              Activate
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-primary)' }}>
          <button onClick={onClose} className="btn" style={{ fontSize: '0.82rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

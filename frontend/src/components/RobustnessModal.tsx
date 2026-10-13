import React, { useState, useEffect } from 'react'
import { X, ShieldAlert, Play, CheckCircle2, AlertTriangle, Activity } from 'lucide-react'
import { testRobustness } from '../api'
import { RobustnessResponse } from '../types'

interface RobustnessModalProps {
  signal: number[][] | null
  activeModel: string
  onClose: () => void
}

const LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6']

export const RobustnessModal: React.FC<RobustnessModalProps> = ({
  signal,
  activeModel,
  onClose,
}) => {
  const [experimentType, setExperimentType] = useState<string>('gaussian_noise')
  const [intensity, setIntensity] = useState<number>(0.05)
  const [leadIdx, setLeadIdx] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [result, setResult] = useState<RobustnessResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (signal) {
      runTest()
    }
  }, [signal])

  const runTest = async () => {
    if (!signal) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await testRobustness(signal, activeModel, experimentType, intensity, leadIdx)
      setResult(res)
    } catch (err: any) {
      setError(err.message || 'Robustness test failed')
    } finally {
      setIsLoading(false)
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
          maxWidth: '840px',
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
              <ShieldAlert size={20} color="var(--accent-burgundy)" />
              Controlled Robustness &amp; Perturbation Analysis
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Evaluates model prediction stability against simulated clinical noise, respiration baseline wander, and lead dropouts.
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px', backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Perturbation Type
              </label>
              <select
                value={experimentType}
                onChange={(e) => setExperimentType(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', fontSize: '0.82rem', background: '#FFF' }}
              >
                <option value="gaussian_noise">Additive Gaussian Noise</option>
                <option value="baseline_drift">Respiration Baseline Wander</option>
                <option value="lead_dropout">Electrode / Lead Dropout</option>
                <option value="temporal_burst">Transient Artifact Burst</option>
              </select>
            </div>

            {experimentType !== 'lead_dropout' ? (
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Intensity / Amplitude: {intensity.toFixed(2)} mV
                </label>
                <input
                  type="range"
                  min="0.01"
                  max="0.25"
                  step="0.01"
                  value={intensity}
                  onChange={(e) => setIntensity(parseFloat(e.target.value))}
                  style={{ width: '100%', marginTop: '6px' }}
                />
              </div>
            ) : (
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Target Lead to Drop
                </label>
                <select
                  value={leadIdx}
                  onChange={(e) => setLeadIdx(parseInt(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', fontSize: '0.82rem', background: '#FFF' }}
                >
                  {LEADS.map((l, i) => (
                    <option key={l} value={i}>Lead {l}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={runTest}
                disabled={isLoading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '8px 14px', fontSize: '0.82rem' }}
              >
                <Play size={14} /> {isLoading ? 'Perturbing...' : 'Run Perturbation'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '12px', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {result && (
            <div>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <div style={{ padding: '14px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Stability Score</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: result.stability_score >= 0.9 ? 'var(--color-success)' : 'var(--accent-burgundy)', marginTop: '2px' }}>
                    {(result.stability_score * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    1.0 - Mean Absolute Delta
                  </div>
                </div>

                <div style={{ padding: '14px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Mean Absolute Shift (ΔP)</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {result.mean_abs_delta.toFixed(4)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Across all 5 superclasses
                  </div>
                </div>

                <div style={{ padding: '14px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Model</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-burgundy)', marginTop: '2px' }}>
                    {result.model.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {result.description}
                  </div>
                </div>
              </div>

              {/* Class Shift Table */}
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Superclass Output Shift Breakdown (ΔP)
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-light)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px 10px' }}>Class</th>
                      <th style={{ padding: '8px 10px' }}>Original Score</th>
                      <th style={{ padding: '8px 10px' }}>Perturbed Score</th>
                      <th style={{ padding: '8px 10px' }}>Absolute Shift (ΔP)</th>
                      <th style={{ padding: '8px 10px' }}>Relative Shift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.shifts).map(([c, s]) => {
                      const isNegative = s.delta < 0
                      return (
                        <tr key={c} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px', fontWeight: 700, color: 'var(--accent-burgundy)' }}>{c}</td>
                          <td style={{ padding: '10px' }}>{(s.original * 100).toFixed(2)}%</td>
                          <td style={{ padding: '10px', fontWeight: 600 }}>{(s.perturbed * 100).toFixed(2)}%</td>
                          <td style={{ padding: '10px', fontWeight: 700, color: isNegative ? 'var(--color-error)' : 'var(--color-success)' }}>
                            {s.delta > 0 ? `+${s.delta.toFixed(4)}` : s.delta.toFixed(4)}
                          </td>
                          <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                            {s.percent_change > 0 ? `+${s.percent_change.toFixed(1)}%` : `${s.percent_change.toFixed(1)}%`}
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

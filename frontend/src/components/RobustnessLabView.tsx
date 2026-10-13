import React, { useState, useEffect } from 'react'
import {
  Sliders,
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Info,
  Activity,
  Layers,
} from 'lucide-react'
import { DiagnosticClass, LEADS, RobustnessResponse } from '../types'
import { useAnalysis } from '../context/AnalysisContext'

const EXPERIMENT_TYPES = [
  { id: 'gaussian_noise', label: 'Gaussian Noise Addition (Electrode Jitter)', defaultIntensity: 0.05, unit: 'mV std' },
  { id: 'baseline_drift', label: 'Low-Frequency Baseline Wander (Respiration)', defaultIntensity: 0.15, unit: 'mV amplitude' },
  { id: 'lead_dropout', label: 'Single Lead Disconnection / Dropout', defaultIntensity: 1.0, unit: 'lead index' },
  { id: 'temporal_burst', label: 'Transient High-Frequency Burst (Myoelectric)', defaultIntensity: 0.20, unit: 'mV spike' },
]

export const RobustnessLabView: React.FC = () => {
  const {
    currentSignal,
    activeModel,
    robustnessResult,
    runRobustness,
    isExperimenting,
  } = useAnalysis()

  const [selectedExpType, setSelectedExpType] = useState<string>('gaussian_noise')
  const [intensity, setIntensity] = useState<number>(0.05)
  const [selectedLeadIdx, setSelectedLeadIdx] = useState<number>(0)
  const [activeTab, setActiveTab] = useState<'shifts' | 'waveform' | 'sensitivity'>('shifts')

  useEffect(() => {
    if (currentSignal && !robustnessResult && !isExperimenting) {
      runRobustness(selectedExpType, intensity, selectedLeadIdx)
    }
  }, [currentSignal])

  const handleRun = async () => {
    await runRobustness(selectedExpType, intensity, selectedLeadIdx)
  }

  if (!currentSignal) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <Sliders size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
        <h3>No Signal Loaded</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          Please upload an ECG recording or select a preloaded sample in ECG Analysis to run perturbation experiments.
        </p>
      </div>
    )
  }

  const expMeta = EXPERIMENT_TYPES.find((e) => e.id === selectedExpType)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Configuration Toolbar */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Controlled Perturbation & Stability Studio
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Systematic stress-testing of model predictions against controlled noise, wander, and artifacts
          </span>
        </div>

        <button
          className="btn-primary"
          onClick={handleRun}
          disabled={isExperimenting || !currentSignal}
          style={{ fontSize: '0.8rem', padding: '6px 16px' }}
        >
          {isExperimenting ? 'Simulating Perturbation...' : 'Execute Perturbation Experiment'}
        </button>
      </div>

      {/* Experiment Controls */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Perturbation Type
            </label>
            <select
              value={selectedExpType}
              onChange={(e) => {
                const newT = e.target.value
                setSelectedExpType(newT)
                const def = EXPERIMENT_TYPES.find((x) => x.id === newT)?.defaultIntensity || 0.05
                setIntensity(def)
              }}
              style={{ width: '100%', marginTop: '4px', padding: '6px 10px', fontSize: '0.82rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            >
              {EXPERIMENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {selectedExpType === 'lead_dropout' ? (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Target Disconnected Lead
              </label>
              <select
                value={selectedLeadIdx}
                onChange={(e) => setSelectedLeadIdx(Number(e.target.value))}
                style={{ width: '100%', marginTop: '4px', padding: '6px 10px', fontSize: '0.82rem', borderRadius: '4px', border: '1px solid var(--border)' }}
              >
                {LEADS.map((l, idx) => (
                  <option key={l} value={idx}>
                    Lead {l}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Perturbation Amplitude: {intensity.toFixed(2)} {expMeta?.unit}
              </label>
              <input
                type="range"
                min={0.01}
                max={selectedExpType === 'baseline_drift' ? 0.5 : 0.3}
                step={0.01}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                style={{ width: '100%', marginTop: '8px' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      {robustnessResult ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Stability Metric Banner */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prediction Stability Score</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: robustnessResult.stability_score >= 80 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {robustnessResult.stability_score.toFixed(1)} / 100
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mean Absolute Probability Shift (&Delta;P)</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-burgundy)' }}>
                {(robustnessResult.mean_abs_delta * 100).toFixed(2)}%
              </div>
            </div>

            <div style={{ maxWidth: '320px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {robustnessResult.description}
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '8px' }}>
            <button
              className={`tab-btn ${activeTab === 'shifts' ? 'active' : ''}`}
              onClick={() => setActiveTab('shifts')}
              style={{
                padding: '10px 16px',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: 'none',
                borderBottom: activeTab === 'shifts' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
                background: 'none',
                color: activeTab === 'shifts' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Class-Wise Probability Shifts
            </button>
            <button
              className={`tab-btn ${activeTab === 'waveform' ? 'active' : ''}`}
              onClick={() => setActiveTab('waveform')}
              style={{
                padding: '10px 16px',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: 'none',
                borderBottom: activeTab === 'waveform' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
                background: 'none',
                color: activeTab === 'waveform' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Original vs. Perturbed Waveform Preview
            </button>
          </div>

          {/* TAB 1: Shifts Table */}
          {activeTab === 'shifts' && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Superclass</th>
                      <th style={{ padding: '10px', fontWeight: 600 }}>Original P</th>
                      <th style={{ padding: '10px', fontWeight: 600 }}>Perturbed P</th>
                      <th style={{ padding: '10px', fontWeight: 600 }}>Absolute Shift (&Delta;P)</th>
                      <th style={{ padding: '10px', fontWeight: 600 }}>Relative Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(robustnessResult.shifts) as DiagnosticClass[]).map((cls) => {
                      const item = robustnessResult.shifts[cls]
                      const delta = item.delta
                      return (
                        <tr key={cls} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px', textAlign: 'left', fontWeight: 700 }}>{cls}</td>
                          <td style={{ padding: '10px', fontWeight: 600 }}>{(item.original * 100).toFixed(1)}%</td>
                          <td style={{ padding: '10px', fontWeight: 600 }}>{(item.perturbed * 100).toFixed(1)}%</td>
                          <td style={{ padding: '10px', fontWeight: 700, color: Math.abs(delta) > 0.1 ? 'var(--color-error)' : 'var(--text-primary)' }}>
                            {delta > 0 ? `+${(delta * 100).toFixed(1)}%` : `${(delta * 100).toFixed(1)}%`}
                          </td>
                          <td style={{ padding: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {item.percent_change.toFixed(1)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Waveform Preview */}
          {activeTab === 'waveform' && (
            <div className="card" style={{ padding: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 600 }}>
                Lead II Overlay: Original (Burgundy) vs Perturbed (Dashed Charcoal)
              </h4>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '220px',
                  backgroundColor: '#FCFCFA',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  overflow: 'hidden',
                }}
              >
                <svg width="100%" height="100%">
                  {/* Original Lead II */}
                  {(() => {
                    const orig = currentSignal.map((r) => r[1])
                    const pert = robustnessResult.perturbed_signal_preview.map((r) => r[1])
                    const min = Math.min(...orig, ...pert) - 0.2
                    const max = Math.max(...orig, ...pert) + 0.2
                    const range = Math.max(max - min, 0.4)

                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke="var(--accent-burgundy)"
                          strokeWidth="1.8"
                          points={orig
                            .map((v, i) => {
                              const x = (i / (orig.length - 1)) * 100
                              const y = ((max - v) / range) * 220
                              return `${x}%,${y}`
                            })
                            .join(' ')}
                        />
                        <polyline
                          fill="none"
                          stroke="#333333"
                          strokeWidth="1.2"
                          strokeDasharray="4 2"
                          points={pert
                            .map((v, i) => {
                              const x = (i / (pert.length - 1)) * 100
                              const y = ((max - v) / range) * 220
                              return `${x}%,${y}`
                            })
                            .join(' ')}
                        />
                      </>
                    )
                  })()}
                </svg>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', gap: '16px', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--accent-burgundy)', fontWeight: 600 }}>&mdash; Original Unperturbed Signal</span>
                <span style={{ color: '#333333', fontWeight: 600 }}>- - - Perturbed Signal Preview</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Click "Execute Perturbation Experiment" above to evaluate prediction stability.
        </div>
      )}

      {/* Scientific Rigor Caveat */}
      <div className="card" style={{ padding: '16px', background: 'var(--bg-subtle)' }}>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          <Info size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
          Robustness testing evaluates sensitivity to synthetic mathematical perturbations. High stability indicates resistance to small input shifts, but does not guarantee clinical accuracy or patient safety.
        </p>
      </div>
    </div>
  )
}

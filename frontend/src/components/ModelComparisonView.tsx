import React, { useState, useEffect } from 'react'
import {
  GitCompare,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react'
import { DiagnosticClass, LEADS, ModelMetadata } from '../types'
import { useAnalysis } from '../context/AnalysisContext'

const CLASSES_LIST: DiagnosticClass[] = ['CD', 'HYP', 'MI', 'NORM', 'STTC']

export const ModelComparisonView: React.FC = () => {
  const {
    currentSignal,
    models,
    activeModel,
    setActiveModel,
    comparisonResult,
    runComparison,
    isExperimenting,
    setSelectedClass,
    setCurrentTab,
  } = useAnalysis()

  const [selectedModelKeys, setSelectedModelKeys] = useState<string[]>([
    'seq',
    'gated',
    'hybrid',
    'cnn',
    'multiscale_current',
  ])
  const [referenceModel, setReferenceModel] = useState<string>('seq')
  const [activeTab, setActiveTab] = useState<'scores' | 'diffs' | 'thresholds' | 'consensus'>('scores')

  // Available inference-ready models
  const readyModels = models.filter((m) => m.inference_ready)

  useEffect(() => {
    if (currentSignal && !comparisonResult && !isExperimenting) {
      runComparison(selectedModelKeys)
    }
  }, [currentSignal])

  const handleRunComparison = async () => {
    await runComparison(selectedModelKeys)
  }

  const toggleModelSelection = (key: string) => {
    if (selectedModelKeys.includes(key)) {
      if (selectedModelKeys.length > 2) {
        setSelectedModelKeys(selectedModelKeys.filter((k) => k !== key))
      }
    } else {
      setSelectedModelKeys([...selectedModelKeys, key])
    }
  }

  if (!currentSignal) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <GitCompare size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
        <h3>No Signal Loaded</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          Please upload an ECG recording or select a preloaded sample in ECG Analysis to compare models.
        </p>
      </div>
    )
  }

  const comparedModelKeys = comparisonResult ? Object.keys(comparisonResult.models) : selectedModelKeys

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Configuration Toolbar */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Multi-Model Evaluation & Agreement Studio
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Simultaneous multi-model inference on identical raw 12-lead ECG input
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn-primary"
            onClick={handleRunComparison}
            disabled={isExperimenting || !currentSignal}
            style={{ fontSize: '0.8rem', padding: '6px 16px' }}
          >
            {isExperimenting ? 'Evaluating Models...' : 'Run Multi-Model Inference'}
          </button>
        </div>
      </div>

      {/* Model Selection Pills */}
      <div className="card" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Include Models in Comparison:
            </span>
            {readyModels.map((m) => {
              const isSelected = selectedModelKeys.includes(m.id)
              return (
                <button
                  key={m.id}
                  className={`btn-tag ${isSelected ? 'active' : ''}`}
                  onClick={() => toggleModelSelection(m.id)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: isSelected ? '1px solid var(--accent-burgundy)' : '1px solid var(--border)',
                    background: isSelected ? 'var(--accent-burgundy)' : 'var(--surface)',
                    color: isSelected ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {m.id}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
            <span>Reference Model:</span>
            <select
              value={referenceModel}
              onChange={(e) => setReferenceModel(e.target.value)}
              style={{ padding: '3px 8px', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            >
              {comparedModelKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '8px' }}>
        <button
          className={`tab-btn ${activeTab === 'scores' ? 'active' : ''}`}
          onClick={() => setActiveTab('scores')}
          style={{
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'scores' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'scores' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Score Comparison Heatmap
        </button>
        <button
          className={`tab-btn ${activeTab === 'diffs' ? 'active' : ''}`}
          onClick={() => setActiveTab('diffs')}
          style={{
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'diffs' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'diffs' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Score Difference Heatmap (&Delta;P vs Ref)
        </button>
        <button
          className={`tab-btn ${activeTab === 'thresholds' ? 'active' : ''}`}
          onClick={() => setActiveTab('thresholds')}
          style={{
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'thresholds' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'thresholds' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Threshold Agreement Matrix
        </button>
        <button
          className={`tab-btn ${activeTab === 'consensus' ? 'active' : ''}`}
          onClick={() => setActiveTab('consensus')}
          style={{
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'consensus' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'consensus' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Consensus & Disagreement Summary
        </button>
      </div>

      {comparisonResult ? (
        <div>
          {/* TAB 1: Score Comparison Heatmap */}
          {activeTab === 'scores' && (
            <div className="card" style={{ padding: '20px' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 600 }}>
                Model Output Sigmoid Scores (Models &times; 5 Classes)
              </h4>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, width: '180px' }}>Model</th>
                      {CLASSES_LIST.map((cls) => (
                        <th key={cls} style={{ padding: '10px', fontWeight: 600 }}>
                          {cls}
                        </th>
                      ))}
                      <th style={{ padding: '10px', fontWeight: 600, width: '110px' }}>Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparedModelKeys.map((mKey) => {
                      const mData = comparisonResult.models[mKey]
                      const isCurActive = mKey === activeModel
                      return (
                        <tr key={mKey} style={{ borderBottom: '1px solid var(--border)', background: isCurActive ? 'var(--accent-subtle)' : 'transparent' }}>
                          <td style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{mData?.display_name || mKey}</span>
                              {isCurActive && <span className="nav-badge success">Active</span>}
                            </div>
                          </td>

                          {CLASSES_LIST.map((cls) => {
                            const p = mData?.probabilities ? mData.probabilities[cls] : 0
                            const intensity = Math.min(1, Math.max(0, p))
                            const bg = `rgba(168, 50, 69, ${0.05 + intensity * 0.85})`
                            const textColor = intensity > 0.45 ? '#fff' : 'var(--text-primary)'

                            return (
                              <td
                                key={cls}
                                style={{
                                  padding: '10px',
                                  background: bg,
                                  color: textColor,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                                onClick={() => {
                                  setActiveModel(mKey)
                                  setSelectedClass(cls)
                                  setCurrentTab('explainability')
                                }}
                                title={`Click to explain ${cls} using model ${mKey}`}
                              >
                                {(p * 100).toFixed(1)}%
                              </td>
                            )
                          })}

                          <td style={{ padding: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {mData?.latency_ms ? `${mData.latency_ms.toFixed(1)} ms` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <Info size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                Click any cell to immediately switch active model, select that class, and open its Integrated Gradients explanation.
              </div>
            </div>
          )}

          {/* TAB 2: Score Difference Heatmap */}
          {activeTab === 'diffs' && (
            <div className="card" style={{ padding: '20px' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 600 }}>
                Score Differences &Delta;P Relative to Reference Model ({referenceModel})
              </h4>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, width: '180px' }}>Model</th>
                      {CLASSES_LIST.map((cls) => (
                        <th key={cls} style={{ padding: '10px', fontWeight: 600 }}>
                          {cls} (&Delta;P)
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparedModelKeys.map((mKey) => {
                      const mData = comparisonResult.models[mKey]
                      const refData = comparisonResult.models[referenceModel]
                      const isRef = mKey === referenceModel

                      return (
                        <tr key={mKey} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>
                            {mData?.display_name || mKey} {isRef && '(Reference)'}
                          </td>

                          {CLASSES_LIST.map((cls) => {
                            const p = mData?.probabilities ? mData.probabilities[cls] : 0
                            const pRef = refData?.probabilities ? refData.probabilities[cls] : 0
                            const delta = p - pRef
                            const absDelta = Math.abs(delta)
                            const intensity = Math.min(1, absDelta * 2.0)

                            let bg = '#FFFFFF'
                            let textColor = 'var(--text-primary)'
                            if (delta > 0) {
                              bg = `rgba(168, 50, 69, ${0.05 + intensity * 0.85})`
                              if (intensity > 0.5) textColor = '#FFFFFF'
                            } else if (delta < 0) {
                              bg = `rgba(40, 85, 150, ${0.05 + intensity * 0.85})`
                              if (intensity > 0.5) textColor = '#FFFFFF'
                            }

                            return (
                              <td key={cls} style={{ padding: '10px', background: bg, color: textColor, fontWeight: 700 }}>
                                {isRef ? '0.00' : (delta > 0 ? `+${(delta * 100).toFixed(1)}%` : `${(delta * 100).toFixed(1)}%`)}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Threshold Agreement Matrix */}
          {activeTab === 'thresholds' && (
            <div className="card" style={{ padding: '20px' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 600 }}>
                Threshold Crossing Agreement Matrix (Positive Flags)
              </h4>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, width: '180px' }}>Model</th>
                      {CLASSES_LIST.map((cls) => (
                        <th key={cls} style={{ padding: '10px', fontWeight: 600 }}>
                          {cls}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparedModelKeys.map((mKey) => {
                      const mData = comparisonResult.models[mKey]
                      return (
                        <tr key={mKey} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>
                            {mData?.display_name || mKey}
                          </td>
                          {CLASSES_LIST.map((cls) => {
                            const pred = mData?.predictions?.find((p) => p.class === cls)
                            const isDetected = pred?.detected || false
                            return (
                              <td
                                key={cls}
                                style={{
                                  padding: '10px',
                                  color: isDetected ? 'var(--color-success)' : 'var(--text-muted)',
                                  fontWeight: 700,
                                }}
                              >
                                {isDetected ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)' }}>
                                    <CheckCircle2 size={15} /> Positive
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>Negative</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Consensus & Disagreement Summary */}
          {activeTab === 'consensus' && (
            <div className="card" style={{ padding: '20px' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 600 }}>
                Inter-Model Agreement & Consensus Statistics
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                {CLASSES_LIST.map((cls) => {
                  const ag = comparisonResult.agreement[cls]
                  return (
                    <div
                      key={cls}
                      style={{
                        padding: '14px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{cls}</span>
                        {ag.unanimous ? (
                          <span className="nav-badge success">Unanimous</span>
                        ) : ag.consensus_detected ? (
                          <span className="nav-badge info">Consensus</span>
                        ) : (
                          <span className="nav-badge warning">Disagreement</span>
                        )}
                      </div>
                      <div style={{ marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Positive: {ag.positive_count} of {ag.total_models} models ({Math.round(ag.agreement_ratio * 100)}%)
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <Info size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                Consensus among neural network architectures indicates consistent feature patterns, but does not substitute for clinical ground truth.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Click "Run Multi-Model Inference" above to evaluate and compare models on this recording.
        </div>
      )}
    </div>
  )
}

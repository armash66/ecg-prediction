import React, { useState } from 'react'
import {
  LineChart,
  BarChart3,
  Trophy,
  Sliders,
  Info,
  CheckCircle2,
  Layers,
  Activity,
} from 'lucide-react'
import { DiagnosticClass, ModelMetadata } from '../types'
import { useAnalysis } from '../context/AnalysisContext'

const CLASSES_LIST: DiagnosticClass[] = ['CD', 'HYP', 'MI', 'NORM', 'STTC']

export const ResearchAnalyticsView: React.FC = () => {
  const { metrics, models, activeModel } = useAnalysis()
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'class_metrics' | 'thresholds' | 'splits'>('leaderboard')
  const [metricSort, setMetricSort] = useState<'macro_auc' | 'macro_auprc' | 'macro_f1'>('macro_auc')

  // Simulated exploratory threshold slider
  const [exploratoryThreshold, setExploratoryThreshold] = useState<number>(0.35)

  if (!metrics) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <LineChart size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
        <h3>Loading Research Analytics...</h3>
        <p style={{ color: 'var(--text-muted)' }}>Retrieving recorded benchmark evaluations from artifacts cache.</p>
      </div>
    )
  }

  const comparisonList = [...metrics.comparison].sort((a, b) => {
    const valA = a[metricSort] ?? 0
    const valB = b[metricSort] ?? 0
    return valB - valA
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Benchmark Overview Header */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Research Benchmark Analytics &amp; Model Leaderboard
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Empirical evaluations on PTB-XL Test Fold 10 (2,163 records &bull; 10-Fold Patient Split)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Sort by:</span>
          <select
            value={metricSort}
            onChange={(e) => setMetricSort(e.target.value as any)}
            style={{ padding: '4px 8px', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--border)' }}
          >
            <option value="macro_auc">Macro AUROC</option>
            <option value="macro_auprc">Macro AUPRC</option>
            <option value="macro_f1">Macro F1 Score</option>
          </select>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '8px' }}>
        <button
          className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
          style={{
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'leaderboard' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'leaderboard' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Model Performance Leaderboard
        </button>
        <button
          className={`tab-btn ${activeTab === 'class_metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('class_metrics')}
          style={{
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'class_metrics' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'class_metrics' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Class-Wise Metric Heatmap
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
          Validation Threshold Explorer
        </button>
        <button
          className={`tab-btn ${activeTab === 'splits' ? 'active' : ''}`}
          onClick={() => setActiveTab('splits')}
          style={{
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'splits' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'splits' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Evaluation Split Protocol
        </button>
      </div>

      {/* TAB 1: Model Performance Leaderboard */}
      {activeTab === 'leaderboard' && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, width: '40px' }}>Rank</th>
                  <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, width: '180px' }}>Model</th>
                  <th style={{ padding: '10px', fontWeight: 600 }}>Macro AUROC</th>
                  <th style={{ padding: '10px', fontWeight: 600 }}>Macro AUPRC</th>
                  <th style={{ padding: '10px', fontWeight: 600 }}>Macro F1</th>
                  <th style={{ padding: '10px', fontWeight: 600 }}>Sensitivity</th>
                  <th style={{ padding: '10px', fontWeight: 600 }}>Specificity</th>
                  <th style={{ padding: '10px', fontWeight: 600 }}>Parameters</th>
                  <th style={{ padding: '10px', fontWeight: 600 }}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {comparisonList.map((item, idx) => {
                  const isTop = idx === 0
                  return (
                    <tr key={item.model} style={{ borderBottom: '1px solid var(--border)', background: isTop ? 'var(--accent-subtle)' : 'transparent' }}>
                      <td style={{ padding: '10px', textAlign: 'left', fontWeight: 700, color: isTop ? 'var(--accent-burgundy)' : 'var(--text-muted)' }}>
                        #{idx + 1}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{item.model}</span>
                          {isTop && <Trophy size={14} style={{ color: 'var(--accent-burgundy)' }} />}
                        </div>
                      </td>
                      <td style={{ padding: '10px', fontWeight: 700, color: 'var(--accent-burgundy)' }}>
                        {item.macro_auc?.toFixed(4) || '—'}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{item.macro_auprc?.toFixed(4) || '—'}</td>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{item.macro_f1?.toFixed(4) || '—'}</td>
                      <td style={{ padding: '10px' }}>{item.macro_sensitivity ? `${(item.macro_sensitivity * 100).toFixed(1)}%` : '—'}</td>
                      <td style={{ padding: '10px' }}>{item.macro_specificity ? `${(item.macro_specificity * 100).toFixed(1)}%` : '—'}</td>
                      <td style={{ padding: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {item.param_count ? `${(item.param_count / 1e6).toFixed(2)}M` : '—'}
                      </td>
                      <td style={{ padding: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {item.inference_latency_ms ? `${item.inference_latency_ms.toFixed(1)} ms` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Class-Wise Metric Heatmap */}
      {activeTab === 'class_metrics' && (
        <div className="card" style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 600 }}>
            Diagnostic Superclass AUROC Breakdown Across Models
          </h4>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, width: '160px' }}>Model</th>
                  {CLASSES_LIST.map((cls) => (
                    <th key={cls} style={{ padding: '10px', fontWeight: 600 }}>
                      {cls}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(metrics.per_class).map((mKey) => {
                  const mData = metrics.per_class[mKey]
                  return (
                    <tr key={mKey} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>{mKey}</td>
                      {CLASSES_LIST.map((cls) => {
                        const auc = mData?.auc ? mData.auc[cls] : null
                        const intensity = auc ? Math.min(1, Math.max(0, (auc - 0.7) / 0.3)) : 0
                        const bg = auc ? `rgba(168, 50, 69, ${0.05 + intensity * 0.85})` : '#fff'
                        const textColor = intensity > 0.5 ? '#fff' : 'var(--text-primary)'
                        return (
                          <td key={cls} style={{ padding: '10px', background: bg, color: textColor, fontWeight: 700 }}>
                            {auc ? auc.toFixed(4) : '—'}
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

      {/* TAB 3: Validation Threshold Explorer */}
      {activeTab === 'thresholds' && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
                Exploratory Operating Threshold Simulator
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Simulate F1 trade-offs against saved validation fold statistics (Exploratory Only)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.78rem' }}>Simulated Cutoff: {exploratoryThreshold.toFixed(2)}</span>
              <input
                type="range"
                min={0.1}
                max={0.8}
                step={0.02}
                value={exploratoryThreshold}
                onChange={(e) => setExploratoryThreshold(Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {CLASSES_LIST.map((cls) => (
              <div key={cls} style={{ padding: '14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{cls}</div>
                <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Production Threshold: <strong>0.34</strong>
                </div>
                <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--accent-burgundy)' }}>
                  Simulated Cutoff: <strong>{exploratoryThreshold.toFixed(2)}</strong>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '14px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <Info size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
            Note: Changing the exploratory slider does not overwrite the calibrated validation thresholds stored in artifacts/cache/gated_thresholds_validation.csv.
          </div>
        </div>
      )}

      {/* TAB 4: Evaluation Split Protocol */}
      {activeTab === 'splits' && (
        <div className="card" style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 600 }}>
            PTB-XL Rigorous Evaluation Split Contract
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Training Folds</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>Folds 1 &ndash; 8 (80%)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                17,441 records &bull; Patient-disjoint isolation
              </div>
            </div>
            <div style={{ padding: '14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Validation Fold</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>Fold 9 (10%)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                2,183 records &bull; Used for threshold tuning
              </div>
            </div>
            <div style={{ padding: '14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Held-Out Test Fold</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-burgundy)' }}>Fold 10 (10%)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                2,163 records &bull; Final benchmark reporting
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

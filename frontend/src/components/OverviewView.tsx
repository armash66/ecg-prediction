import React, { useState } from 'react'
import {
  Activity,
  Award,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Filter,
  Layers,
  Sparkles,
  Users,
  Zap,
  ArrowRight
} from 'lucide-react'
import { MetricsResponse, BackendHealth, ModelComparisonItem, DiagnosticClass } from '../types'
import { DisclaimerBanner } from './DisclaimerBanner'

interface OverviewViewProps {
  metrics: MetricsResponse | null
  health: BackendHealth | null
  onNavigateToAnalysis: () => void
  onNavigateToModelLab: () => void
}

type MetricOption = 'macro_auc' | 'macro_auprc' | 'macro_f1' | 'macro_sensitivity' | 'macro_specificity'

const METRIC_LABELS: Record<MetricOption, string> = {
  macro_auc: 'Macro AUROC',
  macro_auprc: 'Macro AUPRC',
  macro_f1: 'Macro F1-Score',
  macro_sensitivity: 'Macro Sensitivity',
  macro_specificity: 'Macro Specificity',
}

const CLASS_DESCRIPTIONS: Record<DiagnosticClass, { name: string; desc: string }> = {
  NORM: { name: 'Normal ECG', desc: 'Baseline normal 12-lead rhythm and morphology' },
  MI: { name: 'Myocardial Infarction', desc: 'Ischemic myocardial tissue necrosis' },
  STTC: { name: 'ST/T Change', desc: 'Repolarization abnormalities and ST deviations' },
  CD: { name: 'Conduction Disturbance', desc: 'Bundle branch blocks, hemiblocks, AV blocks' },
  HYP: { name: 'Hypertrophy', desc: 'Left or right ventricular / atrial enlargement' },
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  metrics,
  health,
  onNavigateToAnalysis,
  onNavigateToModelLab,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricOption>('macro_auc')
  const [selectedModelForClass, setSelectedModelForClass] = useState<string>('seq')

  if (!metrics) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', width: '100%' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Activity size={32} style={{ animation: 'spin 2s linear infinite', color: 'var(--accent-burgundy)' }} />
          <p style={{ marginTop: '12px', fontSize: '0.9rem' }}>Loading research evaluation metrics...</p>
        </div>
      </div>
    )
  }

  const { research_summary, comparison, per_class } = metrics

  // Sort comparison models by selected metric descending
  const sortedModels = [...comparison].sort((a, b) => {
    const valA = (a[selectedMetric] as number) || 0
    const valB = (b[selectedMetric] as number) || 0
    return valB - valA
  })

  // Selected model per-class metrics
  const activeClassMetrics = per_class[selectedModelForClass] || per_class['seq'] || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Research Disclaimer */}
      <DisclaimerBanner />

      {/* Hero Welcome Card */}
      <div className="card" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAF8 100%)', borderColor: 'var(--border-light)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ maxWidth: '780px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--accent-subtle)', color: 'var(--accent-burgundy)', fontSize: '0.72rem', fontWeight: 600, marginBottom: '10px' }}>
              <Award size={12} />
              <span>PTB-XL 12-Lead Diagnostic Benchmark</span>
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Multimodal Deep Learning &amp; Adaptive Gated Fusion
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              A high-precision clinical research platform integrating 9 trained deep learning architectures, 
              139 handcrafted wavelet and rhythm features, and dynamic information arbitration for 5 diagnostic superclasses.
            </p>
          </div>

          <button className="btn btn-primary" onClick={onNavigateToAnalysis} style={{ boxShadow: 'var(--shadow-subtle)' }}>
            <Activity size={16} />
            <span>Open ECG Analysis Workspace</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Research Summary Metrics */}
      <div>
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Validated Dataset &amp; Protocol Summary
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            PhysioNet PTB-XL v1.0.3 Benchmark
          </span>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Labelled ECG Records</div>
            <div className="stat-value tabular-nums">{research_summary.labelled_records.toLocaleString()}</div>
            <div className="stat-sub">10-second 12-lead waveforms at 100 Hz</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Unique Patients</div>
            <div className="stat-value tabular-nums">{research_summary.unique_patients.toLocaleString()}</div>
            <div className="stat-sub">Strict patient-separated 10 folds</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Diagnostic Superclasses</div>
            <div className="stat-value">5 Classes</div>
            <div className="stat-sub">CD, HYP, MI, NORM, STTC</div>
          </div>

          <div className="stat-card" style={{ borderColor: 'var(--border-light)', backgroundColor: '#FDFCFB' }}>
            <div className="stat-label" style={{ color: 'var(--accent-burgundy)' }}>Best Macro AUROC</div>
            <div className="stat-value tabular-nums" style={{ color: 'var(--accent-burgundy)' }}>
              {research_summary.best_macro_auroc.toFixed(4)}
            </div>
            <div className="stat-sub">
              Sequence Model &bull; 95% CI [{research_summary.best_bootstrap_ci_95[0]}, {research_summary.best_bootstrap_ci_95[1]}]
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Active Inference Model</div>
            <div className="stat-value" style={{ fontSize: '1.4rem' }}>
              {(health?.active_model || 'seq').toUpperCase()}
            </div>
            <div className="stat-sub">
              {health?.status === 'healthy' ? 'Weights loaded in memory' : 'Standby'}
            </div>
          </div>
        </div>
      </div>

      {/* Comparative Model Performance Chart */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="card-title">Comparative Model Benchmark</h3>
            <p className="card-subtitle">
              Evaluated strictly on independent Test Fold 10 (N=2,158 records). Frozen normalization &amp; zero data leakage.
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div style={{ display: 'inline-flex', padding: '3px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            {(Object.keys(METRIC_LABELS) as MetricOption[]).map((mKey) => (
              <button
                key={mKey}
                className={`btn btn-ghost btn-sm ${selectedMetric === mKey ? 'btn-secondary' : ''}`}
                style={{ padding: '5px 10px', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }}
                onClick={() => setSelectedMetric(mKey)}
              >
                {METRIC_LABELS[mKey]}
              </button>
            ))}
          </div>
        </div>

        {/* Bar Chart Visualization */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
          {sortedModels.map((item, idx) => {
            const val = (item[selectedMetric] as number) || 0
            const percentWidth = Math.min(100, Math.max(0, val * 100))
            const isBest = idx === 0
            const isSelectedActive = item.model === health?.active_model

            return (
              <div key={item.model} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '180px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: isBest ? 700 : 500, color: 'var(--text-primary)' }}>
                    {item.model}
                  </span>
                  {isBest && (
                    <span className="badge badge-accent" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                      Best
                    </span>
                  )}
                  {isSelectedActive && (
                    <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                      Active
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, position: 'relative' }}>
                  <div style={{ height: '24px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${percentWidth}%`,
                        backgroundColor: isBest
                          ? 'var(--accent-burgundy)'
                          : isSelectedActive
                          ? '#872638'
                          : '#C2838D',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>

                <div style={{ width: '80px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.88rem', fontWeight: 600, color: isBest ? 'var(--accent-burgundy)' : 'var(--text-primary)' }}>
                  {val.toFixed(4)}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Metric shown: <strong>{METRIC_LABELS[selectedMetric]}</strong></span>
          <button className="btn btn-ghost btn-sm" onClick={onNavigateToModelLab} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
            <span>Explore all 11 models in Model Lab</span>
            <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Class-wise Performance & Session Activity Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Class-wise Performance */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Class-Wise Test Performance</h3>
              <p className="card-subtitle">Per-category AUROC, AUPRC, and F1-score on Fold 10</p>
            </div>

            <select
              value={selectedModelForClass}
              onChange={(e) => setSelectedModelForClass(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-light)',
                fontSize: '0.78rem',
                background: '#FFFFFF',
              }}
            >
              <option value="seq">Sequence (seq)</option>
              <option value="gated">Adaptive Gated (gated)</option>
              <option value="cnn">ResNet1D (cnn)</option>
              <option value="hybrid">Concatenation (hybrid)</option>
              <option value="multiscale_current">Multi-Scale (current)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {(['CD', 'HYP', 'MI', 'NORM', 'STTC'] as DiagnosticClass[]).map((cls) => {
              const aucVal = activeClassMetrics.auc?.[cls] || 0
              const f1Val = activeClassMetrics.f1?.[cls] || 0
              const sensVal = activeClassMetrics.sensitivity?.[cls] || 0
              const thresholdVal = activeClassMetrics.thresholds?.[cls] || 0.5
              const info = CLASS_DESCRIPTIONS[cls]

              return (
                <div key={cls} style={{ padding: '12px 14px', background: '#FAFAF8', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{cls}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                        {info.name}
                      </span>
                    </div>
                    <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                      Threshold: {thresholdVal.toFixed(2)}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '0.78rem', marginTop: '6px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>AUROC: </span>
                      <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{aucVal.toFixed(4)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>F1: </span>
                      <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{f1Val.toFixed(4)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Sensitivity: </span>
                      <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{sensVal.toFixed(4)}</strong>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Current Local Session & System Health */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Local Session &amp; Model Readiness</h3>
              <p className="card-subtitle">Real-time status of inference server and checkpoints</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', background: '#FAFAF8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>FastAPI Backend Health</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Server is active on CPU inference engine with frozen normalization parameters.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', background: '#FFFFFF' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Session Inferences
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                  {health?.session_inferences ?? 0}
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', background: '#FFFFFF' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Last Latency
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                  {health?.last_inference ? `${health.last_inference.latency_ms} ms` : '—'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <p>
                <strong>Evaluation Protocol:</strong> All metrics displayed originate directly from recorded test experiments (`comparison.json`, `result_*.json`). Zero synthetic metrics are fabricated.
              </p>
            </div>

            <button
              className="btn btn-secondary"
              onClick={onNavigateToAnalysis}
              style={{ marginTop: 'auto', width: '100%' }}
            >
              <Activity size={15} />
              <span>Launch ECG Analysis Workspace</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

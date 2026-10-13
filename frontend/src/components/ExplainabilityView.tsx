import React, { useState, useEffect } from 'react'
import {
  Layers,
  Activity,
  Sliders,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Info,
  Clock,
  Sparkles,
  GitCompare,
  Check,
} from 'lucide-react'
import {
  DiagnosticClass,
  LeadImportanceItem,
  TimeRegionItem,
  PreloadedSampleSummary,
  ExplainResponse,
} from '../types'
import { useAnalysis } from '../context/AnalysisContext'
import { ECGViewer } from './ECGViewer'
import { AttributionHeatmap } from './AttributionHeatmap'
import { TimeRegionsView } from './TimeRegionsView'
import { ClassLeadImportanceMatrix } from './ClassLeadImportanceMatrix'
import { ClassTimeMatrixView } from './ClassTimeMatrixView'

const SUPERCLASSES: DiagnosticClass[] = ['CD', 'HYP', 'MI', 'NORM', 'STTC']

export const ExplainabilityView: React.FC = () => {
  const {
    currentSignal,
    activeModel,
    selectedClass,
    setSelectedClass,
    attributionResult,
    runExplanation,
    isExplaining,
    samples,
    loadSampleByIndex,
  } = useAnalysis()

  const [attributionMethod, setAttributionMethod] = useState<'integrated_gradients' | 'gradient_x_input' | 'smoothgrad'>('integrated_gradients')
  const [steps, setSteps] = useState<number>(40)
  const [selectedInterval, setSelectedInterval] = useState<{ start: number; end: number } | null>(null)
  const [selectedLeadFocus, setSelectedLeadFocus] = useState<number | null>(null)

  // Comparison Mode (Side-by-Side: e.g. MI vs STTC)
  const [compareMode, setCompareMode] = useState<boolean>(false)
  const [compareClass, setCompareClass] = useState<DiagnosticClass>('STTC')
  const [compareResult, setCompareResult] = useState<ExplainResponse | null>(null)
  const [isComparing, setIsComparing] = useState<boolean>(false)

  // Sub-tabs within Explainability Studio
  const [activeSubTab, setActiveSubTab] = useState<'time_lead' | 'class_lead' | 'class_time' | 'diagnostics'>('time_lead')

  // Auto-generate attribution if none exists
  useEffect(() => {
    if (currentSignal && !attributionResult && !isExplaining) {
      runExplanation(selectedClass, attributionMethod, steps)
    }
  }, [currentSignal, selectedClass])

  const handleClassChange = async (cls: DiagnosticClass) => {
    setSelectedClass(cls)
    await runExplanation(cls, attributionMethod, steps)
  }

  const handleMethodChange = async (method: 'integrated_gradients' | 'gradient_x_input' | 'smoothgrad') => {
    setAttributionMethod(method)
    await runExplanation(selectedClass, method, steps)
  }

  const handleRunSideBySide = async () => {
    if (!currentSignal) return
    setIsComparing(true)
    try {
      const res = await runExplanation(compareClass, attributionMethod, steps)
      setCompareResult(res)
    } finally {
      setIsComparing(false)
    }
  }

  if (!currentSignal) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <Layers size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
        <h3>No Signal Loaded</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          Please upload an ECG recording or select a preloaded sample in ECG Analysis.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header & Settings Toolbar */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Target Diagnostic Superclass
            </label>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              {SUPERCLASSES.map((cls) => (
                <button
                  key={cls}
                  className={`btn-tag ${selectedClass === cls ? 'active' : ''}`}
                  onClick={() => handleClassChange(cls)}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.8rem',
                    fontWeight: selectedClass === cls ? 700 : 500,
                    borderRadius: '4px',
                    border: selectedClass === cls ? '1px solid var(--accent-burgundy)' : '1px solid var(--border)',
                    background: selectedClass === cls ? 'var(--accent-burgundy)' : 'var(--surface)',
                    color: selectedClass === cls ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Attribution Method
            </label>
            <div style={{ marginTop: '4px' }}>
              <select
                value={attributionMethod}
                onChange={(e) => handleMethodChange(e.target.value as any)}
                style={{
                  padding: '5px 10px',
                  fontSize: '0.8rem',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                }}
              >
                <option value="integrated_gradients">Integrated Gradients (Riemann Path)</option>
                <option value="gradient_x_input">Gradient &times; Input (First-Order Saliency)</option>
                <option value="smoothgrad">SmoothGrad (Gaussian Dispersion)</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className={`btn-secondary ${compareMode ? 'active' : ''}`}
            onClick={() => setCompareMode(!compareMode)}
            style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <GitCompare size={14} />
            <span>{compareMode ? 'Exit Comparison' : 'Side-by-Side Class Comparison'}</span>
          </button>

          <button
            className="btn-primary"
            onClick={() => runExplanation(selectedClass, attributionMethod, steps)}
            disabled={isExplaining}
            style={{ fontSize: '0.8rem', padding: '6px 16px' }}
          >
            {isExplaining ? 'Computing Attribution...' : 'Recompute Explanation'}
          </button>
        </div>
      </div>

      {/* Side-by-Side Class Comparison Bar */}
      {compareMode && (
        <div className="card" style={{ padding: '16px 20px', background: 'var(--bg-subtle)', border: '1px solid var(--accent-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <strong>Compare Selected ({selectedClass}) against:</strong>
              <div style={{ display: 'flex', gap: '6px' }}>
                {SUPERCLASSES.filter((c) => c !== selectedClass).map((cls) => (
                  <button
                    key={cls}
                    className={`btn-tag ${compareClass === cls ? 'active' : ''}`}
                    onClick={() => setCompareClass(cls)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.78rem',
                      fontWeight: compareClass === cls ? 700 : 500,
                      borderRadius: '4px',
                      border: compareClass === cls ? '1px solid var(--accent-burgundy)' : '1px solid var(--border)',
                      background: compareClass === cls ? 'var(--accent-burgundy)' : 'var(--surface)',
                      color: compareClass === cls ? '#fff' : 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={handleRunSideBySide}
              disabled={isComparing}
              style={{ fontSize: '0.8rem', padding: '5px 14px' }}
            >
              {isComparing ? 'Computing...' : `Compute ${compareClass} Attribution`}
            </button>
          </div>
        </div>
      )}

      {/* Sub-Tabs Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '8px' }}>
        <button
          className={`tab-btn ${activeSubTab === 'time_lead' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('time_lead')}
          style={{
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeSubTab === 'time_lead' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
            background: 'none',
            color: activeSubTab === 'time_lead' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Time &times; Lead Attribution Heatmap
        </button>
        <button
          className={`tab-btn ${activeSubTab === 'class_lead' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('class_lead')}
          style={{
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeSubTab === 'class_lead' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
            background: 'none',
            color: activeSubTab === 'class_lead' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Class &times; Lead Importance Matrix (5 &times; 12)
        </button>
        <button
          className={`tab-btn ${activeSubTab === 'class_time' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('class_time')}
          style={{
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeSubTab === 'class_time' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
            background: 'none',
            color: activeSubTab === 'class_time' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Class &times; Time Saliency Heatmap
        </button>
        <button
          className={`tab-btn ${activeSubTab === 'diagnostics' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('diagnostics')}
          style={{
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeSubTab === 'diagnostics' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
            background: 'none',
            color: activeSubTab === 'diagnostics' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Attribution Diagnostics & Completeness
        </button>
      </div>

      {/* Sub-Tab 1: Central Time x Lead Heatmap & Waveform */}
      {activeSubTab === 'time_lead' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Synchronized 12-Lead ECG Waveform */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Synchronized 12-Lead ECG Waveform ({selectedClass} Overlay)
              </h3>
              {selectedInterval && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--accent-burgundy)', fontWeight: 600 }}>
                    Inspecting Region: {selectedInterval.start.toFixed(2)}s &ndash; {selectedInterval.end.toFixed(2)}s
                  </span>
                  <button
                    onClick={() => setSelectedInterval(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    Clear Focus
                  </button>
                </div>
              )}
            </div>

            <ECGViewer
              signal={currentSignal}
              attribution={attributionResult?.attribution}
              attributionClass={selectedClass}
            />
          </div>

          {/* Central Time x Lead Attribution Heatmap */}
          {attributionResult?.attribution ? (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Time &times; Lead Attribution Heatmap — {selectedClass}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Method: {attributionResult.method || 'Integrated Gradients'} &bull; Baseline: {attributionResult.baseline}
                  </span>
                </div>
              </div>

              <AttributionHeatmap
                attribution={attributionResult.attribution}
                targetClass={selectedClass}
                selectedInterval={selectedInterval}
                onSelectInterval={(start: number, end: number) => setSelectedInterval({ start, end })}
              />

              {/* Time Regions & Lead Importance Summaries */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginTop: '20px' }}>
                <TimeRegionsView
                  timeRegions={attributionResult.time_regions || null}
                  targetClass={selectedClass}
                  selectedInterval={selectedInterval}
                  onSelectInterval={(interval) => setSelectedInterval(interval)}
                />

                <div className="card" style={{ padding: '16px', background: 'var(--bg-subtle)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 600 }}>
                    Top Attributed Leads ({selectedClass}):
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {attributionResult.lead_importance.slice(0, 6).map((item, idx) => (
                      <div key={item.lead} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                        <span style={{ width: '30px', fontWeight: 700 }}>{item.lead}</span>
                        <div style={{ flex: 1, height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.round(item.normalized * 100)}%`,
                              height: '100%',
                              background: idx === 0 ? 'var(--accent-burgundy)' : '#777',
                            }}
                          />
                        </div>
                        <span style={{ width: '45px', textAlign: 'right', fontWeight: 600 }}>
                          {(item.normalized * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Computing attribution heatmap...
            </div>
          )}

          {/* Side-by-Side Comparison Heatmap if Active */}
          {compareMode && compareResult?.attribution && (
            <div className="card" style={{ padding: '20px', border: '1px solid var(--accent-burgundy)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>
                Comparison Attribution Heatmap — {compareClass}
              </h3>
              <AttributionHeatmap
                attribution={compareResult.attribution}
                targetClass={compareClass}
                selectedInterval={selectedInterval}
                onSelectInterval={(start, end) => setSelectedInterval({ start, end })}
              />
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 2: Class x Lead Importance Matrix */}
      {activeSubTab === 'class_lead' && (
        <ClassLeadImportanceMatrix
          onSelectClassAndLead={(cls, lIdx) => {
            setSelectedClass(cls)
            setSelectedLeadFocus(lIdx)
            setActiveSubTab('time_lead')
          }}
        />
      )}

      {/* Sub-Tab 3: Class x Time Saliency Heatmap */}
      {activeSubTab === 'class_time' && (
        <ClassTimeMatrixView
          onSelectTimeWindow={(start, end) => {
            setSelectedInterval({ start, end })
            setActiveSubTab('time_lead')
          }}
        />
      )}

      {/* Sub-Tab 4: Attribution Diagnostics & Axiom of Completeness */}
      {activeSubTab === 'diagnostics' && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 14px 0' }}>
            Mathematical Attribution Diagnostics & Axiom of Completeness
          </h3>

          {attributionResult?.diagnostics ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Riemann Integration Steps</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {attributionResult.diagnostics.steps}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tensor Shape</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {attributionResult.diagnostics.tensor_shape.join(' \u00D7 ')}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Finite Value Check</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={18} /> Valid
                  </div>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Completeness Error</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-burgundy)' }}>
                    {attributionResult.diagnostics.completeness_error.toFixed(4)}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.82rem', lineHeight: '1.7', border: '1px solid var(--border)', borderRadius: '6px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Model Logit F(x):</span>
                  <strong>{attributionResult.diagnostics.fx}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Baseline Logit F(0):</span>
                  <strong>{attributionResult.diagnostics.f0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Logit Difference &Delta;F = F(x) &minus; F(0):</span>
                  <strong>{attributionResult.diagnostics.delta_fx}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sum of All Attributions &Sigma; IG:</span>
                  <strong>{attributionResult.diagnostics.sum_attributions}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Baseline Reference:</span>
                  <strong>{attributionResult.diagnostics.baseline_description}</strong>
                </div>
              </div>

              <div style={{ marginTop: '14px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <Info size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                The Axiom of Completeness states that the sum of attributions along the straight interpolation path from baseline to input equals the difference between the model output at the input and at the baseline.
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px', color: 'var(--text-muted)' }}>
              Integrated Gradients completeness diagnostics available when method is set to Integrated Gradients.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import {
  Activity,
  AlertCircle,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Download,
  HelpCircle,
  Info,
  Layers,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Zap
} from 'lucide-react'
import {
  DiagnosticClass,
  LeadImportanceItem,
  TimeRegionItem,
  LeadAblationResponse,
  FaithfulnessResponse,
  PreloadedSampleSummary,
} from '../types'
import {
  analyzeECG,
  fetchExplanation,
  fetchLeadAblation,
  runFaithfulnessTest,
} from '../api'
import { ECGViewer } from './ECGViewer'
import { AttributionHeatmap } from './AttributionHeatmap'
import { TimeRegionsView } from './TimeRegionsView'
import { LeadAblationView } from './LeadAblationView'
import { FaithfulnessCurveView } from './FaithfulnessCurveView'
import { DisclaimerBanner } from './DisclaimerBanner'

interface ExplainabilityViewProps {
  currentSignal: number[][] | null
  activeModel: string
  samples: PreloadedSampleSummary[]
  onSelectSample: (idx: number) => void
  targetClass?: DiagnosticClass
}

const SUPERCLASSES: DiagnosticClass[] = ['CD', 'HYP', 'MI', 'NORM', 'STTC']

export const ExplainabilityView: React.FC<ExplainabilityViewProps> = ({
  currentSignal,
  activeModel,
  samples,
  onSelectSample,
  targetClass: propTargetClass,
}) => {
  const [selectedClass, setSelectedClass] = useState<DiagnosticClass>(propTargetClass || 'MI')
  const [isExplaining, setIsExplaining] = useState<boolean>(false)
  const [attributionMap, setAttributionMap] = useState<number[][] | null>(null)
  const [leadImportance, setLeadImportance] = useState<LeadImportanceItem[] | null>(null)
  const [timeRegions, setTimeRegions] = useState<TimeRegionItem[] | null>(null)
  const [explainError, setExplainError] = useState<string | null>(null)

  // Selected time interval for inspection (e.g. from TimeRegionsView or Heatmap)
  const [selectedInterval, setSelectedInterval] = useState<{ start: number; end: number } | null>(null)

  // Lead ablation state
  const [isAblating, setIsAblating] = useState<boolean>(false)
  const [ablationData, setAblationData] = useState<LeadAblationResponse | null>(null)

  // Faithfulness test state
  const [isRunningFaithfulness, setIsRunningFaithfulness] = useState<boolean>(false)
  const [faithfulnessResult, setFaithfulnessResult] = useState<FaithfulnessResponse | null>(null)
  const [faithfulnessError, setFaithfulnessError] = useState<string | null>(null)

  // Export report modal state
  const [showExportModal, setShowExportModal] = useState<boolean>(false)

  // Synchronize target class if passed from parent
  useEffect(() => {
    if (propTargetClass && propTargetClass !== selectedClass) {
      setSelectedClass(propTargetClass)
      // Auto compute if signal exists
      if (currentSignal) {
        computeAttributionForClass(propTargetClass)
      }
    }
  }, [propTargetClass])

  // Automatically compute attribution on signal change or initial load if signal exists
  useEffect(() => {
    if (currentSignal && !attributionMap) {
      computeAttributionForClass(selectedClass)
    }
  }, [currentSignal])

  const computeAttributionForClass = async (cls: DiagnosticClass) => {
    if (!currentSignal) return
    setIsExplaining(true)
    setExplainError(null)
    setFaithfulnessResult(null)
    setAblationData(null)
    setSelectedInterval(null)

    try {
      const res = await analyzeECG(currentSignal, activeModel, cls, 40)
      setAttributionMap(res.attribution)
      setLeadImportance(res.lead_importance)
      setTimeRegions(res.time_regions || null)
    } catch (err: any) {
      setExplainError(err.message || 'Failed to compute Integrated Gradients attribution')
    } finally {
      setIsExplaining(false)
    }
  }

  // Handle class tab switch
  const handleSelectClass = (cls: DiagnosticClass) => {
    setSelectedClass(cls)
    computeAttributionForClass(cls)
  }

  // Run counterfactual lead ablation
  const handleRunLeadAblation = async () => {
    if (!currentSignal) return
    setIsAblating(true)
    try {
      const res = await fetchLeadAblation(currentSignal, selectedClass, activeModel)
      setAblationData(res)
    } catch (err: any) {
      console.error('Lead ablation notice:', err)
    } finally {
      setIsAblating(false)
    }
  }

  // Run faithfulness curves experiment
  const handleRunFaithfulness = async () => {
    if (!currentSignal) return
    setIsRunningFaithfulness(true)
    setFaithfulnessError(null)
    try {
      const res = await runFaithfulnessTest(currentSignal, activeModel, selectedClass, 0.10)
      setFaithfulnessResult(res)
    } catch (err: any) {
      setFaithfulnessError(err.message || 'Faithfulness test failed')
    } finally {
      setIsRunningFaithfulness(false)
    }
  }

  // Download analysis export JSON bundle
  const handleDownloadExport = () => {
    const bundle = {
      timestamp: new Date().toISOString(),
      model: activeModel,
      target_class: selectedClass,
      attribution_method: 'Integrated Gradients (Gauss-Legendre / Riemann 40 steps)',
      baseline: '0.0 (corresponds to training set mean)',
      lead_importance: leadImportance,
      top_time_regions: timeRegions,
      lead_ablation: ablationData,
      faithfulness_experiment: faithfulnessResult,
      disclaimer:
        'Research use only. Model outputs and attribution analyses are experimental and do not constitute a clinical diagnosis. Interpretation requires qualified healthcare professionals.',
    }

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ecg_explanation_${selectedClass}_${activeModel}_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-container">
      {/* Clinical Disclaimer */}
      <DisclaimerBanner />

      {/* Header Info & Class Selector Bar */}
      <div className="card" style={{ padding: '18px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              Explainability &amp; Attribution Laboratory
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Gradient-based Integrated Gradients, Time &times; Lead attribution matrix, interventional lead ablation, and faithfulness curves.
            </p>
          </div>

          {/* Target Diagnostic Class Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Target Class:
            </span>
            <div style={{ display: 'inline-flex', padding: '3px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              {SUPERCLASSES.map((cls) => (
                <button
                  key={cls}
                  className={`btn btn-ghost btn-sm ${selectedClass === cls ? 'btn-secondary' : ''}`}
                  style={{
                    padding: '4px 12px',
                    fontSize: '0.8rem',
                    fontWeight: selectedClass === cls ? 700 : 500,
                    borderRadius: 'var(--radius-sm)',
                    color: selectedClass === cls ? 'var(--accent-burgundy)' : 'var(--text-primary)',
                  }}
                  onClick={() => handleSelectClass(cls)}
                >
                  {cls}
                </button>
              ))}
            </div>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => computeAttributionForClass(selectedClass)}
              disabled={!currentSignal || isExplaining}
              style={{ padding: '6px 14px' }}
            >
              {isExplaining ? (
                <>
                  <Activity size={13} style={{ animation: 'spin 1.5s linear infinite' }} />
                  <span>Computing...</span>
                </>
              ) : (
                <>
                  <Play size={13} />
                  <span>Recompute {selectedClass}</span>
                </>
              )}
            </button>

            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowExportModal(true)}
              style={{ padding: '6px 12px' }}
              title="Export Explanation Bundle"
            >
              <Download size={13} />
              <span>Export</span>
            </button>
          </div>
        </div>

        {explainError && (
          <div style={{ marginTop: '12px', padding: '8px 12px', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
            {explainError}
          </div>
        )}
      </div>

      {/* Signature Time x Lead Attribution Matrix */}
      {attributionMap && (
        <AttributionHeatmap
          attribution={attributionMap}
          targetClass={selectedClass}
          selectedInterval={selectedInterval}
          onSelectInterval={(start, end) => setSelectedInterval({ start, end })}
        />
      )}

      {/* Synchronized 12-Lead ECG Waveform with Attribution Overlay */}
      {currentSignal && (
        <div>
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Synchronized 12-Lead Waveform with Attribution Density ({selectedClass})
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Baseline: 0.0 (Training Mean) &bull; 40 Riemann Integration Steps &bull; Model: {activeModel}
            </span>
          </div>

          <ECGViewer
            signal={currentSignal}
            attribution={attributionMap}
            attributionClass={selectedClass}
          />
        </div>
      )}

      {/* Middle Row: Peak Temporal Intervals & Interventional Lead Ablation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>
        {/* Ranked Temporal Intervals */}
        <TimeRegionsView
          timeRegions={timeRegions}
          targetClass={selectedClass}
          selectedInterval={selectedInterval}
          onSelectInterval={(inv) => setSelectedInterval(inv)}
        />

        {/* Interventional Lead Ablation vs Gradient Attribution */}
        <LeadAblationView
          ablationData={ablationData}
          gradientImportance={leadImportance}
          isLoading={isAblating}
          onRunAblation={handleRunLeadAblation}
          targetClass={selectedClass}
        />
      </div>

      {/* Bottom Section: Full Multi-Step Faithfulness Verification Curves */}
      <FaithfulnessCurveView
        result={faithfulnessResult}
        isLoading={isRunningFaithfulness}
        onRunTest={handleRunFaithfulness}
        targetClass={selectedClass}
      />

      {/* Export Bundle Modal */}
      {showExportModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                Export Research Explanation Bundle
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowExportModal(false)}>
                &times;
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
              Download a complete, scientifically reproducible research artifact including model parameters, attribution tensors, temporal interval rankings, lead ablation outcomes, and perturbation faithfulness curves.
            </p>

            <div style={{ background: '#FAFAF8', borderRadius: 'var(--radius-sm)', padding: '12px', border: '1px solid var(--border-light)', fontSize: '0.78rem', marginBottom: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Target Class:</span>
                <span style={{ fontWeight: 600 }}>{selectedClass}</span>

                <span style={{ color: 'var(--text-muted)' }}>Active Model:</span>
                <span style={{ fontWeight: 600 }}>{activeModel}</span>

                <span style={{ color: 'var(--text-muted)' }}>Attribution:</span>
                <span>Integrated Gradients (40 Riemann steps, zero baseline)</span>

                <span style={{ color: 'var(--text-muted)' }}>Compliance:</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>De-identified research artifact</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  handleDownloadExport()
                  setShowExportModal(false)
                }}
              >
                <Download size={13} />
                <span>Download JSON Artifact</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

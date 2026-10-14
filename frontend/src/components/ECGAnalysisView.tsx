import React, { useState, useEffect } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  FolderOpen,
  Info,
  Layers,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Upload,
  Zap
} from 'lucide-react'
import {
  PreloadedSampleSummary,
  SignalMetadata,
  AnalysisResponse,
  DiagnosticClass,
  BackendHealth
} from '../types'
import {
  validateSignalFile,
  validateSignalJson,
  analyzeECG,
  fetchSampleDetail,
  getAnalysisReportUrl
} from '../api'
import { ECGViewer } from './ECGViewer'
import { DisclaimerBanner } from './DisclaimerBanner'
import { MultiModelComparisonModal } from './MultiModelComparisonModal'
import { RobustnessModal } from './RobustnessModal'
import { AnalysisHistoryModal } from './AnalysisHistoryModal'

interface ECGAnalysisViewProps {
  samples: PreloadedSampleSummary[]
  activeModel: string
  health: BackendHealth | null
  onNavigateToExplain: (cls?: DiagnosticClass) => void
  onSignalChange?: (sig: number[][]) => void
  currentSignalProp?: number[][] | null
}

export const ECGAnalysisView: React.FC<ECGAnalysisViewProps> = ({
  samples,
  activeModel,
  health,
  onNavigateToExplain,
  onSignalChange,
  currentSignalProp,
}) => {
  // Signal State
  const [currentSignal, setCurrentSignal] = useState<number[][] | null>(null)
  const [signalMetadata, setSignalMetadata] = useState<SignalMetadata | null>(null)
  const [selectedSampleIdx, setSelectedSampleIdx] = useState<number>(0)
  const [groundTruthLabels, setGroundTruthLabels] = useState<DiagnosticClass[]>([])

  // UI State
  const [isValidating, setIsValidating] = useState<boolean>(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showProcessed, setShowProcessed] = useState<boolean>(false)
  const [processedSignal, setProcessedSignal] = useState<number[][] | null>(null)

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState<boolean>(false)
  const [showInputModal, setShowInputModal] = useState<boolean>(false)
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false)
  const [showRobustnessModal, setShowRobustnessModal] = useState<boolean>(false)
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false)

  // Automatically load the first sample on mount
  useEffect(() => {
    if (samples.length > 0 && !currentSignal) {
      loadPreloadedSample(0)
    }
  }, [samples])

  // Load one of the 40 real PTB-XL test records
  const loadPreloadedSample = async (idx: number) => {
    setIsValidating(true)
    setValidationError(null)
    setAnalysisResult(null)
    setAnalysisError(null)
    try {
      const data = await fetchSampleDetail(idx)
      setCurrentSignal(data.signal)
      setGroundTruthLabels(data.labels)
      setSelectedSampleIdx(idx)

      const meta: SignalMetadata = {
        format: 'preloaded_ptbxl_test',
        filename: `PTB-XL Test Record #${idx} (Fold 10)`,
        original_samples: data.signal.length,
        n_samples: 1000,
        n_leads: 12,
        leads: data.leads,
        resampled: false,
        duration_sec: data.duration_sec,
        sampling_rate: data.sampling_rate,
        units: data.units,
        min_val: Math.min(...data.signal.flat()),
        max_val: Math.max(...data.signal.flat()),
        mean_val: 0,
        std_val: 1,
        validation_status: 'valid',
      }
      setSignalMetadata(meta)

      // Compute normalized signal preview for raw vs processed comparison
      computeNormalizedPreview(data.signal)
      onSignalChange?.(data.signal)
    } catch (err: any) {
      setValidationError(err.message || 'Failed to load sample')
    } finally {
      setIsValidating(false)
    }
  }

  // Handle file drop / upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (files.length === 0) return

    setIsValidating(true)
    setValidationError(null)
    setAnalysisResult(null)
    setAnalysisError(null)

    try {
      const resp = await validateSignalFile(files.length > 1 ? files : files[0])
      if (!resp.valid || !resp.signal) {
        throw new Error(resp.error || 'Signal validation failed')
      }
      setCurrentSignal(resp.signal)
      setSignalMetadata(resp.metadata || null)
      setGroundTruthLabels([]) // User uploaded, ground truth unknown

      computeNormalizedPreview(resp.signal)
      onSignalChange?.(resp.signal)
    } catch (err: any) {
      setValidationError(err.message || 'Error parsing uploaded ECG file.')
    } finally {
      setIsValidating(false)
    }
  }

  // Compute normalized signal using standard z-score for visual comparison
  const computeNormalizedPreview = (sig: number[][]) => {
    // Quick lead-wise standardization for visual inspection
    const norm = sig.map((row) => [...row])
    for (let l = 0; l < 12; l++) {
      const col = sig.map((row) => row[l])
      const mean = col.reduce((a, b) => a + b, 0) / col.length
      const std = Math.sqrt(col.reduce((a, b) => a + (b - mean) ** 2, 0) / col.length) + 1e-6
      for (let r = 0; r < sig.length; r++) {
        norm[r][l] = (sig[r][l] - mean) / std
      }
    }
    setProcessedSignal(norm)
  }

  // Execute actual ML inference
  const handleRunAnalysis = async () => {
    if (!currentSignal) return

    setIsAnalyzing(true)
    setAnalysisError(null)

    try {
      const res = await analyzeECG(currentSignal, activeModel)
      setAnalysisResult(res)
    } catch (err: any) {
      setAnalysisError(err.message || 'Analysis failed. Check model server status.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Research Disclaimer */}
      <DisclaimerBanner />

      {/* Input Selection Bar: Upload & Preloaded Samples */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* File Upload Area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
              <Upload size={15} />
              <span>Upload 12-Lead ECG (.csv / .npy / .npz / .hea + .dat)</span>
              <input
                type="file"
                multiple
                accept=".csv,.npy,.npz,.hea,.dat"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>

            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>or</span>

            {/* Preloaded PTB-XL Sample Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Test Sample:
              </span>
              <select
                value={selectedSampleIdx}
                onChange={(e) => loadPreloadedSample(Number(e.target.value))}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                  background: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  maxWidth: '320px',
                }}
              >
                {samples.map((s) => (
                  <option key={s.index} value={s.index}>
                    #{s.index} &bull; Labels: {s.labels.length > 0 ? s.labels.join(', ') : 'NORM'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Validation Feedback Status Badge */}
          {signalMetadata && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-success">
                <CheckCircle2 size={12} />
                <span>Validated 12 Leads &bull; 1000 Samples &bull; 100 Hz</span>
              </span>

              {signalMetadata.quality_status && (
                <span
                  className={`badge ${
                    signalMetadata.quality_status === 'optimal'
                      ? 'badge-success'
                      : signalMetadata.quality_status === 'acceptable_with_warnings'
                      ? 'badge-warning'
                      : 'badge-error'
                  }`}
                  title={signalMetadata.quality_warnings?.join(' | ') || 'Signal quality verified optimal'}
                >
                  Quality: {signalMetadata.quality_status.replace(/_/g, ' ').toUpperCase()} (Score: {signalMetadata.quality_score ?? 1.0})
                </span>
              )}

              {groundTruthLabels.length > 0 && (
                <span className="badge badge-neutral" title="Verified Fold 10 Test Label">
                  Ground Truth: <strong>{groundTruthLabels.join(', ')}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div style={{ marginTop: '14px', padding: '10px 14px', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={15} />
            <span>{validationError}</span>
          </div>
        )}
      </div>

      {/* Interactive ECG Waveform Viewer */}
      {currentSignal && (
        <ECGViewer
          signal={currentSignal}
          processedSignal={processedSignal || undefined}
          samplingRate={signalMetadata?.sampling_rate || 100}
          leads={signalMetadata?.leads}
          attribution={analysisResult?.attribution}
          attributionClass={analysisResult?.explain_class}
          showProcessed={showProcessed}
          onToggleProcessed={() => setShowProcessed((prev) => !prev)}
        />
      )}

      {/* Action Buttons: Inference, Multi-Model Comparison, Robustness, History */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary"
          style={{ padding: '12px 28px', fontSize: '0.92rem', fontWeight: 600, boxShadow: 'var(--shadow-card)' }}
          onClick={handleRunAnalysis}
          disabled={!currentSignal || isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <Activity size={17} style={{ animation: 'spin 1.5s linear infinite' }} />
              <span>Executing Model Inference ({activeModel.toUpperCase()})...</span>
            </>
          ) : (
            <>
              <Play size={17} />
              <span>Analyze ECG with {activeModel.toUpperCase()}</span>
            </>
          )}
        </button>

        <button
          className="btn"
          style={{ padding: '12px 18px', fontSize: '0.85rem', fontWeight: 600, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setShowCompareModal(true)}
          disabled={!currentSignal}
          title="Compare predictions across all available architectures"
        >
          <Layers size={15} color="var(--accent-burgundy)" />
          <span>Compare Models</span>
        </button>

        <button
          className="btn"
          style={{ padding: '12px 18px', fontSize: '0.85rem', fontWeight: 600, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setShowRobustnessModal(true)}
          disabled={!currentSignal}
          title="Run noise, baseline wander, and lead dropout stability tests"
        >
          <Activity size={15} color="var(--accent-burgundy)" />
          <span>Robustness Test</span>
        </button>

        <button
          className="btn"
          style={{ padding: '12px 18px', fontSize: '0.85rem', fontWeight: 600, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setShowHistoryModal(true)}
          title="Browse saved analyses from local SQLite persistence"
        >
          <FolderOpen size={15} />
          <span>History</span>
        </button>

        {analysisResult?.analysis_id && (
          <a
            href={getAnalysisReportUrl(analysisResult.analysis_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{ padding: '12px 18px', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', backgroundColor: 'var(--accent-subtle)', color: 'var(--accent-burgundy)', border: '1px solid var(--accent-burgundy)', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Open printable Clinical Research Report"
          >
            <Download size={15} />
            <span>Printable Report</span>
          </a>
        )}
      </div>

      {/* Analysis Error Message */}
      {analysisError && (
        <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{analysisError}</span>
        </div>
      )}

      {/* Prediction Results & Diagnostic Classification */}
      {analysisResult && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
          {/* Prediction Bars Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Diagnostic Multi-Label Detection</h3>
                <p className="card-subtitle">
                  Model probabilities vs. validation fold 9-calibrated thresholds
                </p>
              </div>

              <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                Latency: <strong className="tabular-nums">{analysisResult.latency_ms} ms</strong>
              </span>
            </div>

            <div className="pred-bar-container" style={{ marginTop: '8px' }}>
              {analysisResult.predictions.map((item) => {
                const percent = Math.min(100, Math.max(0, item.probability * 100))
                const thresholdPercent = item.threshold * 100
                const isDetected = item.detected

                return (
                  <div key={item.class} className="pred-bar-row">
                    <div className="pred-bar-header">
                      <div className="pred-bar-label">
                        <span style={{ fontWeight: 700, minWidth: '45px' }}>{item.class}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {item.name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-light)' }}
                          onClick={() => onNavigateToExplain(item.class)}
                          title={`Explain ${item.name} with Integrated Gradients`}
                        >
                          Explain &rarr;
                        </button>

                        <span
                          className={`badge ${isDetected ? 'badge-accent' : 'badge-neutral'}`}
                          style={{ fontSize: '0.7rem' }}
                        >
                          {isDetected ? 'DETECTED' : 'NOT DETECTED'}
                        </span>
                        <span className="pred-bar-val" style={{ color: isDetected ? 'var(--accent-burgundy)' : 'var(--text-primary)' }}>
                          {(item.probability * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="pred-bar-track">
                      <div
                        className="pred-bar-fill"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: isDetected ? 'var(--accent-burgundy)' : '#D1C7C9',
                        }}
                      />
                      {/* Threshold vertical marker */}
                      <div
                        className="pred-bar-threshold-marker"
                        style={{ left: `${thresholdPercent}%` }}
                        title={`Validation decision threshold: ${(item.threshold * 100).toFixed(1)}%`}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span>Raw Score: {item.probability.toFixed(4)}</span>
                      <span>Calibrated Threshold: {item.threshold.toFixed(2)}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span>Vertical black notch marks calibrated decision threshold.</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowExportModal(true)}>
                <Download size={13} />
                <span>Export Report</span>
              </button>
            </div>
          </div>

          {/* Model Inference Details & Gated Allocation Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Inference Engine Specification</h3>
                <p className="card-subtitle">Active checkpoint details and feature allocation</p>
              </div>

              <span className="badge badge-accent">
                {analysisResult.model.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ padding: '12px', background: '#FAFAF8', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>MODEL IDENTIFIER</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '2px' }}>
                    {analysisResult.model_display_name}
                  </div>
                </div>

                <div style={{ padding: '12px', background: '#FAFAF8', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>BACKEND DURATION</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                    {analysisResult.latency_ms} ms (CPU)
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowInputModal(true)}
                  style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                >
                  <Layers size={13} />
                  <span>Inspect Input Tensor Specification</span>
                </button>
              </div>

              {/* Gated Architecture Allocation (if Gated model) */}
              {analysisResult.gate_weight_deep !== null ? (
                <div style={{ padding: '14px', background: '#FAFAF8', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Adaptive Gated Fusion Allocation (g)
                    </span>
                    <span className="badge badge-accent">
                      {(analysisResult.gate_weight_deep * 100).toFixed(1)}% Deep Signal
                    </span>
                  </div>

                  <div style={{ height: '10px', background: '#E0D8D9', borderRadius: '5px', overflow: 'hidden', display: 'flex' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${analysisResult.gate_weight_deep * 100}%`,
                        backgroundColor: 'var(--accent-burgundy)',
                      }}
                      title="Deep ResNet + BiGRU Representation Weight"
                    />
                    <div
                      style={{
                        height: '100%',
                        width: `${(1 - analysisResult.gate_weight_deep) * 100}%`,
                        backgroundColor: '#777773',
                      }}
                      title="Handcrafted 139 Feature MLP Weight"
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    <span>Deep 1D ResNet + BiGRU ({ (analysisResult.gate_weight_deep * 100).toFixed(1) }%)</span>
                    <span>Handcrafted 139-D Features ({ ((1 - analysisResult.gate_weight_deep) * 100).toFixed(1) }%)</span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '14px', background: '#FAFAF8', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <strong>Single-Branch Processing:</strong> Model operates directly over standard 12-lead signal representations with frozen normalization statistics.
                </div>
              )}

              {/* Lead Importance Highlights (from Integrated Gradients) */}
              {analysisResult.lead_importance && analysisResult.lead_importance.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Top Attributed Leads ({analysisResult.explain_class}):</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => onNavigateToExplain(analysisResult.explain_class as DiagnosticClass)} style={{ fontSize: '0.72rem', padding: '0 4px' }}>
                      Deep Dive in Explainability &rarr;
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {analysisResult.lead_importance.slice(0, 5).map((l, idx) => (
                      <div
                        key={l.lead}
                        style={{
                          padding: '6px 10px',
                          background: idx === 0 ? 'var(--accent-subtle)' : '#FFFFFF',
                          border: '1px solid var(--border-light)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.78rem',
                          color: idx === 0 ? 'var(--accent-burgundy)' : 'var(--text-primary)',
                          fontWeight: idx === 0 ? 700 : 500,
                        }}
                      >
                        Lead {l.lead}: <strong>{(l.normalized * 100).toFixed(1)}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Research Disclaimer */}
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4, borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                {analysisResult.disclaimer}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Report Modal */}
      {showExportModal && analysisResult && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="card"
            style={{ maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <h3 className="card-title">Analysis Summary Report</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowExportModal(false)}>
                &times; Close
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
              <div>
                <strong>Record:</strong> {signalMetadata?.filename || 'Uploaded ECG'}
              </div>
              <div>
                <strong>Model:</strong> {analysisResult.model_display_name} ({analysisResult.model})
              </div>
              <div>
                <strong>Sampling Rate:</strong> 100 Hz &bull; Duration: 10.0 s &bull; Leads: 12
              </div>

              <div style={{ marginTop: '8px' }}>
                <strong>Predictions &amp; Detection:</strong>
                <table className="data-table" style={{ marginTop: '6px' }}>
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Category</th>
                      <th>Score</th>
                      <th>Threshold</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisResult.predictions.map((p) => (
                      <tr key={p.class}>
                        <td><strong>{p.class}</strong></td>
                        <td>{p.name}</td>
                        <td className="tabular-nums">{(p.probability * 100).toFixed(1)}%</td>
                        <td className="tabular-nums">{p.threshold.toFixed(2)}</td>
                        <td>{p.detected ? 'DETECTED' : 'NOT DETECTED'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {analysisResult.disclaimer}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(analysisResult, null, 2))
                    const dlAnchor = document.createElement('a')
                    dlAnchor.setAttribute('href', dataStr)
                    dlAnchor.setAttribute('download', `ecg_analysis_${analysisResult.model}_${Date.now()}.json`)
                    dlAnchor.click()
                  }}
                >
                  <Download size={14} />
                  <span>Download JSON</span>
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
                  <span>Print Report</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Model Input Inspection Modal */}
      {showInputModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                Model-Input Tensor &amp; Preprocessing Specification
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowInputModal(false)}>
                &times;
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
              Every model receives exact standardized tensor inputs generated via deterministic preprocessing pipeline using frozen fold-9 statistics.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem', background: '#FAFAF8', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Tensor Shape:</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>(1, 12, 1000) &bull; [batch, channels, samples]</span>

                <span style={{ color: 'var(--text-muted)' }}>Temporal Grid:</span>
                <span>10.0 seconds @ 100 Hz sampling rate</span>

                <span style={{ color: 'var(--text-muted)' }}>Channel Order:</span>
                <span>I, II, III, aVR, aVL, aVF, V1, V2, V3, V4, V5, V6</span>

                <span style={{ color: 'var(--text-muted)' }}>Standardization:</span>
                <span>z = (x - &mu;_train) / &sigma;_train (Frozen norm.npz)</span>

                <span style={{ color: 'var(--text-muted)' }}>Handcrafted Feats:</span>
                <span>139 wavelet subband energies, moments, and Lead II HRV</span>

                <span style={{ color: 'var(--text-muted)' }}>Baseline Strategy:</span>
                <span>0.0 tensor (corresponds precisely to training set mean)</span>

                <span style={{ color: 'var(--text-muted)' }}>Threshold Logic:</span>
                <span>Independent validation fold threshold per diagnostic class</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-primary btn-sm" onClick={() => setShowInputModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Model Comparison Modal */}
      {showCompareModal && (
        <MultiModelComparisonModal
          signal={currentSignal}
          onClose={() => setShowCompareModal(false)}
        />
      )}

      {/* Controlled Robustness Testing Modal */}
      {showRobustnessModal && (
        <RobustnessModal
          signal={currentSignal}
          activeModel={activeModel}
          onClose={() => setShowRobustnessModal(false)}
        />
      )}

      {/* Analysis History Modal */}
      {showHistoryModal && (
        <AnalysisHistoryModal
          onClose={() => setShowHistoryModal(false)}
          onReopenAnalysis={(saved) => {
            if (saved.signal) {
              setCurrentSignal(saved.signal)
              onSignalChange?.(saved.signal)
            }
            setAnalysisResult({
              analysis_id: saved.id,
              model: saved.model_name,
              model_display_name: saved.model_name.toUpperCase(),
              latency_ms: saved.latency_ms,
              probabilities: saved.probabilities,
              thresholds: saved.thresholds,
              predictions: saved.predictions,
              gate_weight_deep: null,
              explain_class: saved.explain_class || null,
              attribution: null,
              lead_importance: null,
              disclaimer: "Research use only.",
            })
          }}
        />
      )}
    </div>
  )
}

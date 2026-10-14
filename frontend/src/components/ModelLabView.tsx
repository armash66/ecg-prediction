import React, { useState, useEffect } from 'react'
import {
  CheckCircle2,
  Cpu,
  Layers,
  Search,
  Sliders,
  Zap,
  Info,
  ArrowUpDown,
  AlertCircle,
  HelpCircle,
  Check,
  FileCheck,
  Database,
  HardDrive
} from 'lucide-react'
import { ModelMetadata, DiagnosticClass, ArtifactItem } from '../types'
import { selectActiveModel, fetchArtifacts } from '../api'
import { DisclaimerBanner } from './DisclaimerBanner'

interface ModelLabViewProps {
  models: ModelMetadata[]
  activeModel: string
  onModelSwitched: (newModel: string) => void
}

type SortField = 'display_name' | 'macro_auc' | 'macro_auprc' | 'macro_f1' | 'macro_sensitivity' | 'param_count'

export const ModelLabView: React.FC<ModelLabViewProps> = ({
  models,
  activeModel,
  onModelSwitched,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('macro_auc')
  const [sortAsc, setSortAsc] = useState<boolean>(false)
  const [selectedModelId, setSelectedModelId] = useState<string>(activeModel || 'seq')
  const [isSwitching, setIsSwitching] = useState<boolean>(false)
  const [switchFeedback, setSwitchFeedback] = useState<string | null>(null)
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([])
  const [showArtifacts, setShowArtifacts] = useState<boolean>(true)

  useEffect(() => {
    fetchArtifacts()
      .then((data) => setArtifacts(data.artifacts || []))
      .catch(() => {})
  }, [])

  // Filtered and sorted models list
  const filteredModels = models.filter((m) => {
    const q = searchQuery.toLowerCase()
    return (
      m.name.toLowerCase().includes(q) ||
      m.display_name.toLowerCase().includes(q) ||
      m.architecture.toLowerCase().includes(q)
    )
  })

  filteredModels.sort((a, b) => {
    const valA = a[sortField] ?? -1
    const valB = b[sortField] ?? -1
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA)
    }
    return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA)
  })

  const selectedModel = models.find((m) => m.id === selectedModelId) || models[0]

  const handleSwitchModel = async (id: string) => {
    if (!id || id === activeModel) return
    setIsSwitching(true)
    setSwitchFeedback(null)
    try {
      await selectActiveModel(id)
      onModelSwitched(id)
      setSwitchFeedback(`Successfully activated ${id.toUpperCase()} for live inference.`)
      setTimeout(() => setSwitchFeedback(null), 4000)
    } catch (err: any) {
      alert(err.message || 'Failed to switch model.')
    } finally {
      setIsSwitching(false)
    }
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Disclaimer */}
      <DisclaimerBanner />

      {/* Header Info */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              Model Registry &amp; Evaluation Laboratory
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Inspect all 11 comparative architectures, verify checkpoint readiness, and switch active inference model.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                  background: '#FFFFFF',
                  fontSize: '0.82rem',
                }}
              />
            </div>
          </div>
        </div>

        {switchFeedback && (
          <div style={{ marginTop: '12px', padding: '8px 14px', background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Check size={14} />
            <span>{switchFeedback}</span>
          </div>
        )}
      </div>

      {/* Model Comparison Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Comparative Performance Table</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Showing {filteredModels.length} models &bull; Evaluated on Test Fold 10
          </span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th onClick={() => toggleSort('display_name')} style={{ cursor: 'pointer' }}>
                  Model / Variant <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: '3px' }} />
                </th>
                <th>Architecture</th>
                <th onClick={() => toggleSort('macro_auc')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  Macro AUROC <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: '3px' }} />
                </th>
                <th onClick={() => toggleSort('macro_auprc')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  Macro AUPRC <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: '3px' }} />
                </th>
                <th onClick={() => toggleSort('macro_f1')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  Macro F1 <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: '3px' }} />
                </th>
                <th onClick={() => toggleSort('param_count')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  Parameters <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: '3px' }} />
                </th>
                <th style={{ textAlign: 'center' }}>Inference Readiness</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredModels.map((m) => {
                const isSelected = m.id === selectedModelId
                const isActive = m.id === activeModel

                return (
                  <tr
                    key={m.id}
                    onClick={() => setSelectedModelId(m.id)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--accent-subtle)' : undefined,
                    }}
                  >
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => setSelectedModelId(m.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {m.display_name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        ID: {m.id}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                        {m.architecture}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {m.macro_auc !== null ? m.macro_auc.toFixed(4) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {m.macro_auprc !== null ? m.macro_auprc.toFixed(4) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {m.macro_f1 !== null ? m.macro_f1.toFixed(4) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {m.param_count ? m.param_count.toLocaleString() : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {m.inference_ready ? (
                        <span className="badge badge-success">Inference Ready</span>
                      ) : (
                        <span className="badge badge-neutral">Saved Results Only</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isActive ? (
                        <span className="badge badge-accent" style={{ padding: '4px 8px' }}>
                          Current Active
                        </span>
                      ) : m.inference_ready ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSwitchModel(m.id)
                          }}
                          disabled={isSwitching}
                        >
                          Activate &rarr;
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No Checkpoint</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Model Deep-Dive Details */}
      {selectedModel && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="card-title">{selectedModel.display_name}</h3>
                {selectedModel.id === activeModel && (
                  <span className="badge badge-accent">Active Inference Model</span>
                )}
                {selectedModel.inference_ready ? (
                  <span className="badge badge-success">Checkpoint Verified</span>
                ) : (
                  <span className="badge badge-neutral">Offline Evaluation Only</span>
                )}
              </div>
              <p className="card-subtitle">{selectedModel.description}</p>
            </div>

            {selectedModel.inference_ready && selectedModel.id !== activeModel && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleSwitchModel(selectedModel.id)}
                disabled={isSwitching}
              >
                <Zap size={13} />
                <span>Set as Active Inference Model</span>
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '12px' }}>
            <div style={{ padding: '14px', background: '#FAFAF8', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>INPUT CONTRACT</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: '4px' }}>
                {selectedModel.input_type}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Frozen per-lead standardization ($(X - \mu)/\sigma$).
              </div>
            </div>

            <div style={{ padding: '14px', background: '#FAFAF8', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>FEATURES EMPLOYED</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: '4px' }}>
                {selectedModel.features_used}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Extracted strictly from verified 12-lead signal.
              </div>
            </div>

            <div style={{ padding: '14px', background: '#FAFAF8', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CHECKPOINT DETAILS</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: '4px' }}>
                {selectedModel.checkpoint_name || 'None'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Size: {selectedModel.checkpoint_size_bytes ? `${(selectedModel.checkpoint_size_bytes / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
              </div>
            </div>

            <div style={{ padding: '14px', background: '#FAFAF8', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>VALIDATION THRESHOLDS (FOLD 9)</div>
              <div style={{ fontSize: '0.82rem', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(['CD', 'HYP', 'MI', 'NORM', 'STTC'] as DiagnosticClass[]).map((cls) => (
                  <span key={cls} className="badge badge-neutral">
                    {cls}: {selectedModel.thresholds[cls]?.toFixed(2) ?? '0.50'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Artifact Files Browser */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HardDrive size={18} color="var(--accent-burgundy)" />
              Trained Checkpoints &amp; Cache Artifact Browser
            </h3>
            <p className="card-subtitle">
              Inspecting {artifacts.length} verified experiment files, PyTorch state dicts, normalization statistics, and evaluation JSONs in <code>artifacts/cache/</code>.
            </p>
          </div>
          <button
            onClick={() => setShowArtifacts(!showArtifacts)}
            className="btn btn-sm"
            style={{ fontSize: '0.78rem' }}
          >
            {showArtifacts ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {showArtifacts && (
          <div style={{ overflowX: 'auto', maxHeight: '380px', overflowY: 'auto', marginTop: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-light)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px 10px' }}>File Name</th>
                  <th style={{ padding: '8px 10px' }}>Type</th>
                  <th style={{ padding: '8px 10px' }}>Size (MB)</th>
                  <th style={{ padding: '8px 10px' }}>Parameters</th>
                  <th style={{ padding: '8px 10px' }}>Verification</th>
                  <th style={{ padding: '8px 10px' }}>Modified (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {artifacts.map((art) => (
                  <tr key={art.filename} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: art.type === 'checkpoint' ? 'var(--accent-burgundy)' : 'var(--text-primary)' }}>
                      {art.filename}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span className={`badge ${art.type === 'checkpoint' ? 'badge-accent' : 'badge-neutral'}`} style={{ fontSize: '0.7rem' }}>
                        {art.type}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                      {art.size_mb.toFixed(2)} MB
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                      {art.param_count ? art.param_count.toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {art.verified ? (
                        <span style={{ color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={12} /> Validated
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Unverified</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                      {art.modified}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Research Methodology Notes */}
      <div className="card" style={{ background: '#FAF9F6' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px' }}>
          Methodological Governance &amp; Leakage Prevention
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          <div>
            <strong>1. Frozen Normalization Parameters:</strong> Normalization parameters ($\mu, \sigma, \mu_F, \sigma_F$) were computed exclusively on training folds 1–8. Test Fold 10 was strictly isolated prior to evaluation.
          </div>
          <div>
            <strong>2. Independent Threshold Calibration:</strong> Decision thresholds were derived by maximizing F1 on Validation Fold 9. No test fold data was accessed during threshold selection.
          </div>
          <div>
            <strong>3. Macro vs. Threshold Metrics:</strong> Macro AUROC and AUPRC represent threshold-independent ranking capability. Binary metrics (Sensitivity, Specificity, F1) are strictly tied to the Fold 9 calibrated operating points.
          </div>
        </div>
      </div>
    </div>
  )
}

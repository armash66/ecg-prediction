import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  Play,
  RotateCcw,
  Sliders,
  Info,
  Layers,
  Activity,
  CheckCircle2,
} from 'lucide-react'
import { DiagnosticClass, LEADS } from '../types'
import { useAnalysis } from '../context/AnalysisContext'
import { FaithfulnessCurveView } from './FaithfulnessCurveView'
import { LeadAblationView } from './LeadAblationView'

const SUPERCLASSES: DiagnosticClass[] = ['CD', 'HYP', 'MI', 'NORM', 'STTC']

export const FaithfulnessLabView: React.FC = () => {
  const {
    currentSignal,
    activeModel,
    selectedClass,
    setSelectedClass,
    faithfulnessResult,
    leadAblationResult,
    fullAblationMatrixResult,
    runFaithfulness,
    runLeadAblation,
    runFullAblationMatrix,
    isExperimenting,
  } = useAnalysis()

  const [topFraction, setTopFraction] = useState<number>(0.10)
  const [activeTab, setActiveTab] = useState<'curves' | 'ablation_leads' | 'ablation_matrix'>('curves')

  useEffect(() => {
    if (currentSignal && !faithfulnessResult && !isExperimenting) {
      runFaithfulness(selectedClass, topFraction)
      runLeadAblation(selectedClass)
    }
  }, [currentSignal, selectedClass])

  const handleRunExperiment = async () => {
    await runFaithfulness(selectedClass, topFraction)
    await runLeadAblation(selectedClass)
  }

  const handleRunFullMatrix = async () => {
    await runFullAblationMatrix()
  }

  if (!currentSignal) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <ShieldCheck size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
        <h3>No Signal Loaded</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          Please upload an ECG recording or select a preloaded sample in ECG Analysis to run faithfulness experiments.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Configuration Toolbar */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
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
                  onClick={() => {
                    setSelectedClass(cls)
                    runFaithfulness(cls, topFraction)
                    runLeadAblation(cls)
                  }}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
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
              Perturbation Fraction k
            </label>
            <div style={{ marginTop: '4px' }}>
              <select
                value={topFraction}
                onChange={(e) => setTopFraction(Number(e.target.value))}
                style={{ padding: '4px 8px', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--border)' }}
              >
                <option value={0.05}>5% (600 samples)</option>
                <option value={0.10}>10% (1,200 samples)</option>
                <option value={0.15}>15% (1,800 samples)</option>
                <option value={0.20}>20% (2,400 samples)</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <button
            className="btn-primary"
            onClick={handleRunExperiment}
            disabled={isExperimenting || !currentSignal}
            style={{ fontSize: '0.8rem', padding: '6px 16px' }}
          >
            {isExperimenting ? 'Executing Experiment...' : 'Run Faithfulness Test'}
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '8px' }}>
        <button
          className={`tab-btn ${activeTab === 'curves' ? 'active' : ''}`}
          onClick={() => setActiveTab('curves')}
          style={{
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'curves' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'curves' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Deletion &amp; Insertion Curves (AUDC / AUIC)
        </button>
        <button
          className={`tab-btn ${activeTab === 'ablation_leads' ? 'active' : ''}`}
          onClick={() => setActiveTab('ablation_leads')}
          style={{
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'ablation_leads' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'ablation_leads' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Single-Lead Interventional Ablation ({selectedClass})
        </button>
        <button
          className={`tab-btn ${activeTab === 'ablation_matrix' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('ablation_matrix')
            if (!fullAblationMatrixResult) handleRunFullMatrix()
          }}
          style={{
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'ablation_matrix' ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'ablation_matrix' ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          5-Class &times; 12-Lead Ablation Heatmap Matrix
        </button>
      </div>

      {/* TAB 1: Deletion and Insertion Curves */}
      {activeTab === 'curves' && (
        <div>
          {faithfulnessResult ? (
            <FaithfulnessCurveView
              result={faithfulnessResult}
              targetClass={selectedClass}
              onRunTest={() => runFaithfulness(selectedClass, topFraction)}
              isLoading={isExperimenting}
            />
          ) : (
            <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Executing multi-step deletion and insertion faithfulness test...
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Single-Lead Interventional Ablation */}
      {activeTab === 'ablation_leads' && (
        <div>
          {leadAblationResult ? (
            <LeadAblationView
              ablationData={leadAblationResult}
              gradientImportance={null}
              targetClass={selectedClass}
              onRunAblation={() => runLeadAblation(selectedClass)}
              isLoading={isExperimenting}
            />
          ) : (
            <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Executing lead zero-masking ablation...
            </div>
          )}
        </div>
      )}

      {/* TAB 3: 5-Class x 12-Lead Full Ablation Matrix */}
      {activeTab === 'ablation_matrix' && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
                Complete 5-Class &times; 12-Lead Interventional Ablation Matrix
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Empirical score change (&Delta;P = P_original &minus; P_ablated) when zero-masking each lead independently
              </span>
            </div>

            <button
              className="btn-secondary"
              onClick={handleRunFullMatrix}
              disabled={isExperimenting}
              style={{ fontSize: '0.78rem', padding: '5px 12px' }}
            >
              {isExperimenting ? 'Computing...' : 'Recompute Matrix'}
            </button>
          </div>

          {fullAblationMatrixResult ? (
            <div>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, width: '100px' }}>Class</th>
                      {LEADS.map((lead) => (
                        <th key={lead} style={{ padding: '10px 4px', fontWeight: 600 }}>
                          {lead}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SUPERCLASSES.map((cls, cIdx) => {
                      const row = fullAblationMatrixResult.delta_p_matrix[cIdx]
                      return (
                        <tr key={cls} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px', textAlign: 'left', fontWeight: 700, color: 'var(--accent-burgundy)' }}>
                            {cls}
                          </td>
                          {row.map((deltaP, lIdx) => {
                            let bg = '#FFFFFF'
                            let textColor = 'var(--text-primary)'
                            if (deltaP > 0) {
                              const intensity = Math.min(1, deltaP * 5.0)
                              bg = `rgba(168, 50, 69, ${0.05 + intensity * 0.85})`
                              if (intensity > 0.5) textColor = '#FFFFFF'
                            } else if (deltaP < 0) {
                              const intensity = Math.min(1, Math.abs(deltaP) * 5.0)
                              bg = `rgba(40, 85, 150, ${0.05 + intensity * 0.85})`
                              if (intensity > 0.5) textColor = '#FFFFFF'
                            }
                            return (
                              <td key={lIdx} style={{ padding: '8px 4px', background: bg, color: textColor, fontWeight: 600 }}>
                                {deltaP > 0 ? `+${deltaP.toFixed(3)}` : deltaP.toFixed(3)}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '14px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <Info size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                Positive values (burgundy) indicate that zeroing the lead caused a drop in the target class probability, demonstrating that the lead supports the class prediction.
              </div>
            </div>
          ) : (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Computing full 5-Class &times; 12-Lead ablation matrix...
            </div>
          )}
        </div>
      )}

      {/* Scientific Caveats & Rigor Notice */}
      <div className="card" style={{ padding: '16px', background: 'var(--bg-subtle)' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={15} style={{ color: 'var(--accent-burgundy)' }} />
          Methodological Notes &amp; Scientific Caveats
        </h4>
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          Deletion and insertion experiments demonstrate faithfulness to the <em>neural network's internal decision mechanics</em>, not clinical biological validity. Replacing signal values with the training-fold mean (0.0) may introduce distribution shift. Interventional ablation directly isolates single-lead dependency, distinct from first-order infinitesimal gradient attributions.
        </p>
      </div>
    </div>
  )
}

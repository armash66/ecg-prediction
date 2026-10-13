import React, { useState } from 'react'
import { Layers, Check, Info, ArrowUpRight } from 'lucide-react'
import { DiagnosticClass, LEADS, BatchExplainMatrixResponse } from '../types'
import { useAnalysis } from '../context/AnalysisContext'

interface ClassLeadImportanceMatrixProps {
  onSelectClassAndLead?: (cls: DiagnosticClass, leadIdx: number) => void
}

const CLASSES_LIST: DiagnosticClass[] = ['CD', 'HYP', 'MI', 'NORM', 'STTC']

export const ClassLeadImportanceMatrix: React.FC<ClassLeadImportanceMatrixProps> = ({
  onSelectClassAndLead,
}) => {
  const {
    currentSignal,
    batchMatrixResult,
    runBatchMatrix,
    isExplaining,
    selectedClass,
    setSelectedClass,
  } = useAnalysis()

  const [mode, setMode] = useState<'magnitude' | 'signed'>('magnitude')
  const [hoverCell, setHoverCell] = useState<{
    cls: DiagnosticClass
    lead: string
    val: number
    leadIdx: number
    clsIdx: number
  } | null>(null)

  const handleCompute = async () => {
    await runBatchMatrix('integrated_gradients', 20)
  }

  const matrix =
    mode === 'magnitude'
      ? batchMatrixResult?.magnitude_matrix
      : batchMatrixResult?.signed_matrix

  // Calculate global min and max for color normalization
  let maxVal = 0.001
  let minSigned = 0
  let maxSigned = 0.001

  if (matrix) {
    matrix.forEach((row) => {
      row.forEach((v) => {
        if (Math.abs(v) > maxVal) maxVal = Math.abs(v)
        if (v < minSigned) minSigned = v
        if (v > maxSigned) maxSigned = v
      })
    })
  }

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Layers size={18} style={{ color: 'var(--accent-burgundy)' }} />
            Class &times; Lead Importance Matrix
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Comprehensive 5-Class &times; 12-Lead attribution magnitude derived from real Integrated Gradients
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: '6px', padding: '2px' }}>
            <button
              className={`btn-tag ${mode === 'magnitude' ? 'active' : ''}`}
              onClick={() => setMode('magnitude')}
              style={{
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: '4px',
                background: mode === 'magnitude' ? 'var(--surface)' : 'transparent',
                fontWeight: mode === 'magnitude' ? 600 : 400,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Absolute Magnitude
            </button>
            <button
              className={`btn-tag ${mode === 'signed' ? 'active' : ''}`}
              onClick={() => setMode('signed')}
              style={{
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: '4px',
                background: mode === 'signed' ? 'var(--surface)' : 'transparent',
                fontWeight: mode === 'signed' ? 600 : 400,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Signed Directional
            </button>
          </div>

          <button
            className="btn-primary"
            onClick={handleCompute}
            disabled={isExplaining || !currentSignal}
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            {isExplaining
              ? 'Computing All 5 Classes...'
              : batchMatrixResult
              ? 'Recompute All Classes'
              : 'Compute 5-Class Matrix'}
          </button>
        </div>
      </div>

      {batchMatrixResult && matrix ? (
        <div>
          {/* Table Heatmap Grid */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, width: '120px' }}>Class</th>
                  {LEADS.map((lead) => (
                    <th key={lead} style={{ padding: '8px 4px', fontWeight: 600 }}>
                      {lead}
                    </th>
                  ))}
                  <th style={{ padding: '8px 10px', fontWeight: 600, width: '100px' }}>Top Lead</th>
                </tr>
              </thead>
              <tbody>
                {CLASSES_LIST.map((cls, cIdx) => {
                  const isSelectedClass = cls === selectedClass
                  const row = matrix[cIdx]
                  const topLead = batchMatrixResult.class_summaries[cls]?.top_lead || '—'

                  return (
                    <tr
                      key={cls}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: isSelectedClass ? 'var(--accent-subtle)' : 'transparent',
                      }}
                    >
                      <td
                        style={{
                          padding: '10px',
                          textAlign: 'left',
                          fontWeight: 700,
                          cursor: 'pointer',
                          color: isSelectedClass ? 'var(--accent-burgundy)' : 'var(--text-primary)',
                        }}
                        onClick={() => setSelectedClass(cls)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{cls}</span>
                          {isSelectedClass && <Check size={14} style={{ color: 'var(--accent-burgundy)' }} />}
                        </div>
                      </td>

                      {row.map((val, lIdx) => {
                        const leadName = LEADS[lIdx]
                        let bg = '#FFFFFF'
                        let textColor = 'var(--text-primary)'

                        if (mode === 'magnitude') {
                          const intensity = Math.min(1, Math.max(0, val / maxVal))
                          bg = `rgba(168, 50, 69, ${0.05 + intensity * 0.85})`
                          if (intensity > 0.5) textColor = '#FFFFFF'
                        } else {
                          // Signed: blue for negative, white for 0, burgundy for positive
                          if (val > 0) {
                            const intensity = Math.min(1, val / (maxSigned || 1))
                            bg = `rgba(168, 50, 69, ${0.05 + intensity * 0.85})`
                            if (intensity > 0.5) textColor = '#FFFFFF'
                          } else {
                            const intensity = Math.min(1, Math.abs(val) / (Math.abs(minSigned) || 1))
                            bg = `rgba(40, 85, 150, ${0.05 + intensity * 0.85})`
                            if (intensity > 0.5) textColor = '#FFFFFF'
                          }
                        }

                        return (
                          <td
                            key={leadName}
                            style={{
                              padding: '8px 2px',
                              background: bg,
                              color: textColor,
                              fontWeight: 600,
                              cursor: 'pointer',
                              position: 'relative',
                              transition: 'transform 0.1s',
                            }}
                            onMouseEnter={() =>
                              setHoverCell({
                                cls,
                                lead: leadName,
                                val,
                                leadIdx: lIdx,
                                clsIdx: cIdx,
                              })
                            }
                            onMouseLeave={() => setHoverCell(null)}
                            onClick={() => {
                              setSelectedClass(cls)
                              if (onSelectClassAndLead) onSelectClassAndLead(cls, lIdx)
                            }}
                            title={`Click to inspect ${cls} on lead ${leadName}`}
                          >
                            <span style={{ fontSize: '0.72rem' }}>{val.toFixed(2)}</span>
                          </td>
                        )
                      })}

                      <td style={{ padding: '8px', fontWeight: 700, color: 'var(--accent-burgundy)' }}>
                        <button
                          onClick={() => {
                            setSelectedClass(cls)
                            const lIdx = LEADS.indexOf(topLead)
                            if (lIdx >= 0 && onSelectClassAndLead) onSelectClassAndLead(cls, lIdx)
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-burgundy)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          {topLead} <ArrowUpRight size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Color Scale Legend & Instructions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Low Attribution</span>
              <div
                style={{
                  width: '120px',
                  height: '10px',
                  borderRadius: '3px',
                  background:
                    mode === 'magnitude'
                      ? 'linear-gradient(to right, rgba(168,50,69,0.05), rgba(168,50,69,0.9))'
                      : 'linear-gradient(to right, rgba(40,85,150,0.8), #fff, rgba(168,50,69,0.9))',
                  border: '1px solid var(--border)',
                }}
              />
              <span>High Attribution</span>
            </div>

            <div>
              <Info size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
              Click any cell to navigate directly to that class's explanation and lead waveform.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
          <p style={{ margin: '0 0 12px 0', color: 'var(--text-muted)' }}>
            The 5-Class &times; 12-Lead importance matrix computes genuine class attributions across all target categories simultaneously.
          </p>
          <button
            className="btn-primary"
            onClick={handleCompute}
            disabled={isExplaining || !currentSignal}
            style={{ fontSize: '0.82rem', padding: '8px 18px' }}
          >
            {isExplaining ? 'Computing...' : 'Generate 5-Class Attribution Matrix'}
          </button>
        </div>
      )}
    </div>
  )
}

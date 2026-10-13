import React, { useState } from 'react'
import { Clock, Info, Check } from 'lucide-react'
import { DiagnosticClass } from '../types'
import { useAnalysis } from '../context/AnalysisContext'

interface ClassTimeMatrixViewProps {
  onSelectTimeWindow?: (startSec: number, endSec: number) => void
}

const CLASSES_LIST: DiagnosticClass[] = ['CD', 'HYP', 'MI', 'NORM', 'STTC']

export const ClassTimeMatrixView: React.FC<ClassTimeMatrixViewProps> = ({
  onSelectTimeWindow,
}) => {
  const {
    currentSignal,
    classTimeMatrixResult,
    runClassTimeMatrix,
    isExplaining,
    selectedClass,
    setSelectedClass,
  } = useAnalysis()

  const [mode, setMode] = useState<'magnitude' | 'signed'>('magnitude')
  const [numWindows, setNumWindows] = useState<number>(20)

  const handleCompute = async () => {
    await runClassTimeMatrix(numWindows)
  }

  const matrix =
    mode === 'magnitude'
      ? classTimeMatrixResult?.magnitude_matrix
      : classTimeMatrixResult?.signed_matrix

  let maxVal = 0.001
  if (matrix) {
    matrix.forEach((row) => {
      row.forEach((v) => {
        if (Math.abs(v) > maxVal) maxVal = Math.abs(v)
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
            <Clock size={18} style={{ color: 'var(--accent-burgundy)' }} />
            Class &times; Time Temporal Saliency Heatmap
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Aggregated attribution across all 12 leads per temporal window (0.50s bins)
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
              Magnitude
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
              Signed
            </button>
          </div>

          <button
            className="btn-primary"
            onClick={handleCompute}
            disabled={isExplaining || !currentSignal}
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            {isExplaining
              ? 'Computing Temporal Saliency...'
              : classTimeMatrixResult
              ? 'Recompute Time Matrix'
              : 'Compute Class × Time Matrix'}
          </button>
        </div>
      </div>

      {classTimeMatrixResult && matrix ? (
        <div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, width: '90px' }}>Class</th>
                  {classTimeMatrixResult.time_points_sec.map((t, idx) => (
                    <th key={idx} style={{ padding: '8px 3px', fontWeight: 500, fontSize: '0.7rem' }}>
                      {t}s
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CLASSES_LIST.map((cls, cIdx) => {
                  const isSelected = cls === selectedClass
                  const row = matrix[cIdx]

                  return (
                    <tr
                      key={cls}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                      }}
                    >
                      <td
                        style={{
                          padding: '8px 10px',
                          textAlign: 'left',
                          fontWeight: 700,
                          cursor: 'pointer',
                          color: isSelected ? 'var(--accent-burgundy)' : 'var(--text-primary)',
                        }}
                        onClick={() => setSelectedClass(cls)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{cls}</span>
                          {isSelected && <Check size={12} />}
                        </div>
                      </td>

                      {row.map((val, tIdx) => {
                        const intensity = Math.min(1, Math.max(0, Math.abs(val) / maxVal))
                        const bg =
                          val >= 0
                            ? `rgba(168, 50, 69, ${0.05 + intensity * 0.85})`
                            : `rgba(40, 85, 150, ${0.05 + intensity * 0.85})`
                        const textColor = intensity > 0.5 ? '#fff' : 'var(--text-primary)'
                        const startSec = classTimeMatrixResult.time_points_sec[tIdx]
                        const endSec = startSec + classTimeMatrixResult.window_duration_sec

                        return (
                          <td
                            key={tIdx}
                            style={{
                              padding: '8px 1px',
                              background: bg,
                              color: textColor,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              setSelectedClass(cls)
                              if (onSelectTimeWindow) onSelectTimeWindow(startSec, endSec)
                            }}
                            title={`${cls} @ ${startSec}s-${endSec}s: ${val.toFixed(2)}`}
                          >
                            <span style={{ fontSize: '0.68rem' }}>{val.toFixed(1)}</span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '10px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <Info size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
            Each cell represents total attribution across all 12 leads within that 0.50-second window. Click any time column to focus that interval in the waveform viewer.
          </div>
        </div>
      ) : (
        <div style={{ padding: '30px', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
          <p style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Compute Class &times; Time temporal attribution across all 5 classes and 20 discrete time windows.
          </p>
          <button
            className="btn-primary"
            onClick={handleCompute}
            disabled={isExplaining || !currentSignal}
            style={{ fontSize: '0.8rem', padding: '6px 16px' }}
          >
            {isExplaining ? 'Computing...' : 'Generate Class × Time Matrix'}
          </button>
        </div>
      )}
    </div>
  )
}

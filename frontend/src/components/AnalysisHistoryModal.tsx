import React, { useState, useEffect } from 'react'
import { X, History, FileText, Trash2, RotateCcw, ExternalLink, Download, CheckCircle2 } from 'lucide-react'
import { fetchAnalyses, fetchAnalysisDetail, deleteAnalysis, getAnalysisReportUrl } from '../api'
import { SavedAnalysisSummary } from '../types'

interface AnalysisHistoryModalProps {
  onClose: () => void
  onReopenAnalysis: (analysisData: any) => void
}

export const AnalysisHistoryModal: React.FC<AnalysisHistoryModalProps> = ({
  onClose,
  onReopenAnalysis,
}) => {
  const [analyses, setAnalyses] = useState<SavedAnalysisSummary[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadList()
  }, [])

  const loadList = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchAnalyses(50)
      setAnalyses(data.analyses || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load analysis history')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Are you sure you want to delete analysis ${id}?`)) return
    setDeletingId(id)
    try {
      await deleteAnalysis(id)
      setAnalyses(analyses.filter((a) => a.id !== id))
    } catch (err: any) {
      alert(err.message || 'Failed to delete record')
    } finally {
      setDeletingId(null)
    }
  }

  const handleReopen = async (id: string) => {
    try {
      const detail = await fetchAnalysisDetail(id)
      onReopenAnalysis(detail)
      onClose()
    } catch (err: any) {
      alert(err.message || 'Failed to reopen analysis')
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-elevated)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={20} color="var(--accent-burgundy)" />
              Analysis History &amp; Session Records
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Locally persisted analysis sessions in SQLite database. Reopen, inspect reports, or delete records.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Loading persisted history...
            </div>
          ) : error ? (
            <div style={{ padding: '12px', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
              {error}
            </div>
          ) : analyses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              No analyses saved yet. Run inference on any ECG record to automatically record an analysis session.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-light)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px 10px' }}>Analysis ID</th>
                  <th style={{ padding: '8px 10px' }}>Created (UTC)</th>
                  <th style={{ padding: '8px 10px' }}>Model</th>
                  <th style={{ padding: '8px 10px' }}>Detected Classes</th>
                  <th style={{ padding: '8px 10px' }}>Latency</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {analyses.map((anl) => {
                  const detected = (anl.predictions || []).filter((p) => p.detected).map((p) => p.class)
                  return (
                    <tr key={anl.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px', fontWeight: 600, color: 'var(--accent-burgundy)' }}>
                        {anl.id}
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                        {anl.created_at}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 600 }}>
                        {anl.model_name.toUpperCase()}
                      </td>
                      <td style={{ padding: '10px' }}>
                        {detected.length > 0 ? (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {detected.map((c) => (
                              <span
                                key={c}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '1px 6px',
                                  borderRadius: '3px',
                                  backgroundColor: 'var(--accent-subtle)',
                                  color: 'var(--accent-burgundy)',
                                  fontWeight: 700,
                                }}
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>NORM Only</span>
                        )}
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                        {anl.latency_ms} ms
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleReopen(anl.id)}
                            title="Reopen in Workbench"
                            style={{
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-light)',
                              background: 'var(--bg-surface)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.75rem',
                            }}
                          >
                            <RotateCcw size={12} /> Reopen
                          </button>
                          <a
                            href={getAnalysisReportUrl(anl.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Printable Clinical Research Report"
                            style={{
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-light)',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.75rem',
                            }}
                          >
                            <FileText size={12} /> Report
                          </a>
                          <button
                            onClick={() => handleDelete(anl.id)}
                            disabled={deletingId === anl.id}
                            title="Delete Analysis"
                            style={{
                              padding: '4px 6px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-light)',
                              background: 'var(--bg-surface)',
                              color: 'var(--color-error)',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-primary)' }}>
          <button onClick={onClose} className="btn" style={{ fontSize: '0.82rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

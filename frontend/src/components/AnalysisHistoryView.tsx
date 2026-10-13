import React, { useState, useEffect } from 'react'
import {
  History,
  Search,
  Trash2,
  ExternalLink,
  FileText,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Activity,
  GitCompare,
} from 'lucide-react'
import { SavedAnalysisSummary, DiagnosticClass } from '../types'
import { fetchAnalyses, deleteAnalysis, getAnalysisReportUrl } from '../api'
import { useAnalysis } from '../context/AnalysisContext'

export const AnalysisHistoryView: React.FC = () => {
  const { restoreSavedAnalysis, setCurrentTab } = useAnalysis()
  const [historyList, setHistoryList] = useState<SavedAnalysisSummary[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterModel, setFilterModel] = useState<string>('all')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [isRestoring, setIsRestoring] = useState<string | null>(null)

  const loadHistory = async () => {
    setIsLoading(true)
    try {
      const res = await fetchAnalyses(50)
      if (res?.analyses) setHistoryList(res.analyses)
    } catch (e) {
      console.error('History load error:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Delete analysis record ${id}?`)) return
    try {
      await deleteAnalysis(id)
      setHistoryList((prev) => prev.filter((item) => item.id !== id))
      setCompareIds((prev) => prev.filter((i) => i !== id))
    } catch (err) {
      console.error('Delete notice:', err)
    }
  }

  const handleOpenAnalysis = async (id: string) => {
    setIsRestoring(id)
    try {
      const ok = await restoreSavedAnalysis(id)
      if (ok) {
        setCurrentTab('analysis')
      }
    } finally {
      setIsRestoring(null)
    }
  }

  const toggleCompare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (compareIds.includes(id)) {
      setCompareIds(compareIds.filter((i) => i !== id))
    } else {
      if (compareIds.length < 2) {
        setCompareIds([...compareIds, id])
      } else {
        setCompareIds([compareIds[1], id])
      }
    }
  }

  // Filtered items
  const filtered = historyList.filter((item) => {
    const matchesSearch =
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.model_name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesModel = filterModel === 'all' || item.model_name === filterModel
    return matchesSearch && matchesModel
  })

  // Unique models in history
  const uniqueModels = Array.from(new Set(historyList.map((h) => h.model_name)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Search & Filter Bar */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Analysis Session History (SQLite Repository)
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Persistent record of executed inferences, predicted diagnostic superclasses, and latency
          </span>
        </div>

        <button
          className="btn-secondary"
          onClick={loadHistory}
          disabled={isLoading}
          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
        >
          {isLoading ? 'Refreshing...' : 'Refresh Records'}
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="card" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by analysis ID, filename, or model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '6px 10px', fontSize: '0.82rem', borderRadius: '4px', border: '1px solid var(--border)' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
          <span>Filter Model:</span>
          <select
            value={filterModel}
            onChange={(e) => setFilterModel(e.target.value)}
            style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)' }}
          >
            <option value="all">All Models</option>
            {uniqueModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* History Records Table */}
      <div className="card" style={{ padding: '20px' }}>
        {filtered.length > 0 ? (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', width: '160px' }}>Analysis ID</th>
                  <th style={{ padding: '10px', width: '140px' }}>Timestamp</th>
                  <th style={{ padding: '10px', width: '160px' }}>File / Source</th>
                  <th style={{ padding: '10px', width: '90px' }}>Model</th>
                  <th style={{ padding: '10px' }}>Detected Classes</th>
                  <th style={{ padding: '10px', width: '90px' }}>Latency</th>
                  <th style={{ padding: '10px', textAlign: 'right', width: '180px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const detected = item.predictions?.filter((p) => p.detected) || []
                  const isOpening = isRestoring === item.id
                  const isCheckedCompare = compareIds.includes(item.id)

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: isCheckedCompare ? 'var(--accent-subtle)' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleOpenAnalysis(item.id)}
                    >
                      <td style={{ padding: '10px', fontWeight: 600, color: 'var(--accent-burgundy)' }}>
                        {item.id}
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {item.created_at}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 500 }}>{item.filename}</td>
                      <td style={{ padding: '10px' }}>
                        <span className="nav-badge info">{item.model_name}</span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        {detected.length > 0 ? (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {detected.map((p) => (
                              <span key={p.class} className="nav-badge success">
                                {p.class} ({(p.probability * 100).toFixed(0)}%)
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>None detected</span>
                        )}
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{item.latency_ms.toFixed(1)} ms</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn-secondary"
                            onClick={() => window.open(getAnalysisReportUrl(item.id), '_blank')}
                            title="Open Printable Research Report"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <FileText size={13} />
                            <span>Report</span>
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => handleOpenAnalysis(item.id)}
                            disabled={isOpening}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            {isOpening ? 'Opening...' : 'Open'}
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={(e) => handleDelete(item.id, e)}
                            title="Delete Record"
                            style={{ padding: '4px 8px', color: 'var(--color-error)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No matching saved analysis records found.
          </div>
        )}
      </div>
    </div>
  )
}

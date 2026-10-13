import React, { useEffect, useState } from 'react'
import {
  Search,
  RefreshCw,
  ArrowRight,
} from 'lucide-react'
import { ECGStudy } from '../types'
import { fetchStudies } from '../api'

interface ECGWorklistViewProps {
  onOpenStudy: (studyId: string, patientId?: string) => void
}

export const ECGWorklistView: React.FC<ECGWorklistViewProps> = ({ onOpenStudy }) => {
  const [studies, setStudies] = useState<ECGStudy[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const loadStudies = async () => {
    try {
      setLoading(true)
      const res = await fetchStudies(statusFilter, undefined, searchQuery)
      setStudies(res.studies)
    } catch (err) {
      console.error('Failed to load studies worklist:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStudies()
  }, [statusFilter, searchQuery])

  const formatStatus = (status: string) => {
    switch (status) {
      case 'finalized':
        return { label: 'Finalized', color: '#34765A', bg: '#E8F4EE' }
      case 'reviewed':
        return { label: 'Reviewed', color: '#34765A', bg: '#E8F4EE' }
      case 'analyzed':
        return { label: 'Analyzed', color: '#2A6BB2', bg: '#EBF3FB' }
      case 'in_progress':
        return { label: 'In Progress', color: '#2A6BB2', bg: '#EBF3FB' }
      case 'awaiting_review':
      default:
        return { label: 'Awaiting review', color: '#B77925', bg: '#FDF4E7' }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Search and Filters Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ position: 'relative', flex: '1', minWidth: '220px', maxWidth: '360px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#777773' }} />
          <input
            type="text"
            placeholder="Search patient, MRN, or study ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '7px 10px 7px 32px',
              fontSize: '13px',
              borderRadius: '6px',
              border: '1px solid #E8E6E1',
              background: '#FAFAF8',
              width: '100%',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              fontSize: '13px',
              borderRadius: '6px',
              border: '1px solid #E8E6E1',
              background: '#FFFFFF',
              color: '#252525',
            }}
          >
            <option value="all">All statuses</option>
            <option value="awaiting_review">Awaiting review</option>
            <option value="reviewed">Reviewed</option>
            <option value="finalized">Finalized</option>
          </select>

          <button className="btn btn-secondary btn-sm" onClick={loadStudies} title="Refresh">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Compact Readable Studies Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#777773', fontSize: '13px' }}>
            <RefreshCw size={20} className="spin-animation" style={{ color: '#A83245', margin: '0 auto 8px' }} />
            Loading studies...
          </div>
        ) : studies.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#777773', fontSize: '13px' }}>
            No studies found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #E8E6E1', textAlign: 'left' }}>
                  <th style={{ padding: '10px 16px', color: '#777773', fontWeight: 600 }}>Study ID</th>
                  <th style={{ padding: '10px 16px', color: '#777773', fontWeight: 600 }}>Patient</th>
                  <th style={{ padding: '10px 16px', color: '#777773', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '10px 16px', color: '#777773', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', color: '#777773', fontWeight: 600 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {studies.map((s) => {
                  const statusInfo = formatStatus(s.status)
                  const dateStr = s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'
                  return (
                    <tr
                      key={s.id}
                      onClick={() => onOpenStudy(s.study_id, s.patient_id)}
                      style={{
                        borderBottom: '1px solid #E8E6E1',
                        cursor: 'pointer',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF9F6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '11px 16px', fontWeight: 600, color: '#252525' }}>
                        {s.study_id}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ fontWeight: 500, color: '#252525' }}>
                          {s.patient_name || s.patient_id}
                        </div>
                        {s.patient_mrn && (
                          <div style={{ fontSize: '11px', color: '#777773' }}>
                            MRN: {s.patient_mrn}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#777773' }}>
                        {dateStr}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: statusInfo.bg,
                            color: statusInfo.color,
                          }}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenStudy(s.study_id, s.patient_id)
                          }}
                          style={{ color: '#A83245', fontSize: '12px', padding: '4px 8px' }}
                        >
                          <span>Review ECG</span>
                          <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

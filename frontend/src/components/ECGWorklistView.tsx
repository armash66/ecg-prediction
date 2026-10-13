import React, { useEffect, useState } from 'react'
import {
  ClipboardList,
  Search,
  Filter,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  User,
  Calendar,
  ShieldAlert,
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'finalized':
        return { label: 'Finalized', bg: '#E8F4EE', color: '#34765A', icon: CheckCircle2 }
      case 'reviewed':
        return { label: 'Reviewed', bg: '#E8F4EE', color: '#34765A', icon: CheckCircle2 }
      case 'in_progress':
        return { label: 'In Progress', bg: '#EBF3FB', color: '#2A6BB2', icon: Activity }
      case 'awaiting_review':
      default:
        return { label: 'Awaiting Review', bg: '#FDF4E7', color: '#B77925', icon: Clock }
    }
  }

  const getQualityBadge = (quality: string, score: number) => {
    if (quality === 'optimal') {
      return <span style={{ fontSize: '11px', color: '#34765A', fontWeight: 600 }}>Optimal ({score.toFixed(2)})</span>
    } else if (quality === 'acceptable_with_warnings') {
      return (
        <span style={{ fontSize: '11px', color: '#B77925', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <AlertTriangle size={12} />
          <span>Warnings ({score.toFixed(2)})</span>
        </span>
      )
    }
    return <span style={{ fontSize: '11px', color: '#B33A3A', fontWeight: 600 }}>Poor ({score.toFixed(2)})</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Worklist Header & Filter Bar */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#252525', margin: 0 }}>
            ECG Worklist
          </h2>
          <p style={{ fontSize: '13px', color: '#777773', margin: '3px 0 0' }}>
            12-lead acquisitions registered and awaiting clinical review or sign-off.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#777773' }} />
            <input
              type="text"
              placeholder="Search patient, ID, study..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '7px 10px 7px 30px',
                fontSize: '13px',
                borderRadius: '6px',
                border: '1px solid #E8E6E1',
                background: '#FAFAF8',
                width: '240px',
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 10px',
              fontSize: '13px',
              borderRadius: '6px',
              border: '1px solid #E8E6E1',
              background: '#FFFFFF',
              color: '#252525',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="awaiting_review">Awaiting Review</option>
            <option value="in_progress">In Progress</option>
            <option value="reviewed">Reviewed</option>
            <option value="finalized">Finalized</option>
          </select>

          <button className="btn btn-secondary btn-sm" onClick={loadStudies} title="Refresh Worklist">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Studies Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#777773', fontSize: '13px' }}>
            <RefreshCw size={22} className="spin-animation" style={{ color: '#A83245', margin: '0 auto 8px' }} />
            Loading study worklist...
          </div>
        ) : studies.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#777773', fontSize: '14px' }}>
            No ECG studies found matching the filter criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #E8E6E1', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', color: '#777773', fontWeight: 600 }}>Study ID</th>
                  <th style={{ padding: '12px 16px', color: '#777773', fontWeight: 600 }}>Patient</th>
                  <th style={{ padding: '12px 16px', color: '#777773', fontWeight: 600 }}>Acquired</th>
                  <th style={{ padding: '12px 16px', color: '#777773', fontWeight: 600 }}>Signal Quality</th>
                  <th style={{ padding: '12px 16px', color: '#777773', fontWeight: 600 }}>AI Model Flags</th>
                  <th style={{ padding: '12px 16px', color: '#777773', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', color: '#777773', fontWeight: 600 }}>Clinician</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: '#777773', fontWeight: 600 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {studies.map((s) => {
                  const badge = getStatusBadge(s.status)
                  const BadgeIcon = badge.icon
                  return (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: '1px solid #E8E6E1',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF9F6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <code style={{ fontWeight: 700, color: '#A83245', background: '#F8EAED', padding: '2px 6px', borderRadius: '4px' }}>
                          {s.study_id}
                        </code>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#252525' }}>{s.patient_name || 'Patient'}</div>
                        <div style={{ fontSize: '11px', color: '#777773' }}>
                          {s.patient_display_id} {s.patient_age ? `\u2022 ${s.patient_age}y` : ''} {s.patient_sex}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#777773' }}>
                        {s.recorded_at?.slice(0, 16)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {getQualityBadge(s.quality_status, s.quality_score)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {s.flags && s.flags.length > 0 ? (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {s.flags.map((f: string) => (
                              <span
                                key={f}
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: f === 'NORM' ? '#E8F4EE' : '#FDEEEE',
                                  color: f === 'NORM' ? '#34765A' : '#B33A3A',
                                }}
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#9C9C96', fontSize: '12px' }}>Analysis pending</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: badge.bg,
                            color: badge.color,
                            fontWeight: 600,
                            fontSize: '11px',
                          }}
                        >
                          <BadgeIcon size={12} />
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#777773', fontSize: '12px' }}>
                        {s.assigned_clinician || 'Unassigned'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => onOpenStudy(s.id, s.patient_id)}
                        >
                          <Activity size={13} />
                          <span>Review</span>
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

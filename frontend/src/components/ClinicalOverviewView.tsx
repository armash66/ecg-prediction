import React, { useEffect, useState } from 'react'
import {
  HeartPulse,
  Users,
  ClipboardList,
  FileText,
  UserPlus,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Clock,
  FlaskConical,
  Activity,
  CheckCircle2,
} from 'lucide-react'
import { ClinicalOverviewData, ECGStudy, NavigationTab } from '../types'
import { fetchClinicalOverview } from '../api'

interface ClinicalOverviewViewProps {
  onNavigateToTab: (tab: NavigationTab) => void
  onRegisterPatient: () => void
  onOpenStudy: (studyId: string, patientId?: string) => void
}

export const ClinicalOverviewView: React.FC<ClinicalOverviewViewProps> = ({
  onNavigateToTab,
  onRegisterPatient,
  onOpenStudy,
}) => {
  const [data, setData] = useState<ClinicalOverviewData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchClinicalOverview()
      setData(res)
    } catch (err: any) {
      setError(err?.message || 'Failed to load clinical overview')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const recentStudies: ECGStudy[] = data?.recent_studies ? data.recent_studies.slice(0, 6) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      {/* Top Banner / Hero Shortcuts */}
      <div
        className="card"
        style={{
          padding: '24px 28px',
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FBF9F9 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '3px 8px',
                borderRadius: '4px',
                background: '#F8EAED',
                color: '#A83245',
              }}
            >
              <HeartPulse size={12} /> Clinical Workspace
            </span>
            <span style={{ fontSize: '13px', color: '#777773' }}>•</span>
            <span style={{ fontSize: '12px', color: '#777773' }}>
              PTB-XL Validated Multi-Lead Engine
            </span>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#252525', margin: 0, letterSpacing: '-0.02em' }}>
            Clinical & Diagnostics Overview
          </h2>
          <p style={{ fontSize: '13px', color: '#777773', margin: '4px 0 0 0' }}>
            Manage registered patients, review multi-lead ECG studies, and launch standalone testing.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={() => onNavigateToTab('ecg_prediction')}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(168, 50, 69, 0.25)',
            }}
          >
            <HeartPulse size={16} />
            New ECG Prediction
          </button>
          <button
            className="btn btn-secondary"
            onClick={onRegisterPatient}
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <UserPlus size={15} />
            Register Patient
          </button>
          <button
            className="btn btn-ghost"
            onClick={loadData}
            title="Refresh clinical overview"
            style={{ padding: '8px', borderRadius: '6px', color: '#777773' }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '14px 18px',
            background: '#FDEEEE',
            border: '1px solid #E8D3D3',
            borderRadius: '8px',
            color: '#B33A3A',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={loadData}
            style={{ marginLeft: 'auto', color: '#B33A3A' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Genuine Clinical Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          className="card"
          onClick={() => onNavigateToTab('patients')}
          style={{
            padding: '18px 20px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#A83245')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E8E6E1')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#777773', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Registered Patients
            </span>
            <div style={{ padding: '6px', background: '#F8EAED', borderRadius: '6px', color: '#A83245' }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#252525', lineHeight: 1 }}>
              {loading ? '—' : (data?.total_patients ?? 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#777773', marginTop: '6px' }}>
              Clinical records in directory
            </div>
          </div>
        </div>

        <div
          className="card"
          onClick={() => onNavigateToTab('worklist')}
          style={{
            padding: '18px 20px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#A83245')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E8E6E1')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#777773', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total ECG Studies
            </span>
            <div style={{ padding: '6px', background: '#F0EFEA', borderRadius: '6px', color: '#252525' }}>
              <Activity size={16} />
            </div>
          </div>
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#252525', lineHeight: 1 }}>
              {loading ? '—' : (data?.total_studies ?? 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#777773', marginTop: '6px' }}>
              Attached to clinical patients
            </div>
          </div>
        </div>

        <div
          className="card"
          onClick={() => onNavigateToTab('worklist')}
          style={{
            padding: '18px 20px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#A83245')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E8E6E1')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#777773', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Awaiting Review
            </span>
            <div
              style={{
                padding: '6px',
                background: (data?.awaiting_review_count ?? 0) > 0 ? '#FDF4E7' : '#F0EFEA',
                borderRadius: '6px',
                color: (data?.awaiting_review_count ?? 0) > 0 ? '#B77925' : '#777773',
              }}
            >
              <ClipboardList size={16} />
            </div>
          </div>
          <div style={{ marginTop: '14px' }}>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: (data?.awaiting_review_count ?? 0) > 0 ? '#B77925' : '#252525',
                lineHeight: 1,
              }}
            >
              {loading ? '—' : (data?.awaiting_review_count ?? 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#777773', marginTop: '6px' }}>
              Unconfirmed automated findings
            </div>
          </div>
        </div>

        <div
          className="card"
          onClick={() => onNavigateToTab('reports')}
          style={{
            padding: '18px 20px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#A83245')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E8E6E1')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#777773', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Finalized Reports
            </span>
            <div style={{ padding: '6px', background: '#E8F4EE', borderRadius: '6px', color: '#34765A' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#34765A', lineHeight: 1 }}>
              {loading ? '—' : (data?.reviewed_finalized_count ?? 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#777773', marginTop: '6px' }}>
              Clinically verified and signed
            </div>
          </div>
        </div>
      </div>

      {/* Main Split: Recent Studies + Navigation Hub */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left: Recent Studies Table */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#252525', margin: 0 }}>
                Recent ECG Studies
              </h3>
              <p style={{ fontSize: '12px', color: '#777773', margin: '2px 0 0 0' }}>
                Latest 12-lead recordings associated with patient charts
              </p>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigateToTab('worklist')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#A83245',
              }}
            >
              Open ECG Worklist <ArrowRight size={13} />
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#777773', fontSize: '13px' }}>
              Loading studies...
            </div>
          ) : recentStudies.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                background: '#FAF9F6',
                borderRadius: '8px',
                border: '1px dashed #E8E6E1',
              }}
            >
              <Activity size={32} style={{ color: '#9C9C96', margin: '0 auto 8px' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#252525' }}>
                No clinical studies recorded yet
              </div>
              <p style={{ fontSize: '12px', color: '#777773', maxWidth: '340px', margin: '4px auto 16px' }}>
                Test any 12-lead ECG in the Standalone Prediction workspace and save it to a patient chart.
              </p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onNavigateToTab('ecg_prediction')}
              >
                Go to ECG Prediction
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E8E6E1', color: '#777773', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Study ID</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Patient</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Recorded</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>AI Findings</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStudies.map((study) => {
                    const isFlagged = study.flags && study.flags.length > 0
                    return (
                      <tr
                        key={study.id}
                        style={{
                          borderBottom: '1px solid #F0EEE9',
                          transition: 'background-color 0.12s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FAF9F6')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontWeight: 600, color: '#252525' }}>
                          {study.study_id}
                        </td>
                        <td style={{ padding: '10px 10px', color: '#252525' }}>
                          <div style={{ fontWeight: 600 }}>{study.patient_name || 'Patient'}</div>
                          <div style={{ fontSize: '11px', color: '#777773', fontFamily: 'monospace' }}>
                            {study.patient_id}
                          </div>
                        </td>
                        <td style={{ padding: '10px 10px', color: '#777773' }}>
                          {study.recorded_at ? study.recorded_at.split('T')[0] : '—'}
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          {isFlagged ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: '#FDEEEE',
                                color: '#B33A3A',
                                fontWeight: 600,
                                fontSize: '11px',
                              }}
                            >
                              {study.flags.join(', ')}
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: '#E8F4EE',
                                color: '#34765A',
                                fontWeight: 500,
                                fontSize: '11px',
                              }}
                            >
                              Normal
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              textTransform: 'capitalize',
                              background:
                                study.status === 'finalized'
                                  ? '#E8F4EE'
                                  : study.status === 'in_progress'
                                  ? '#FDF4E7'
                                  : '#F0EFEA',
                              color:
                                study.status === 'finalized'
                                  ? '#34765A'
                                  : study.status === 'in_progress'
                                  ? '#B77925'
                                  : '#777773',
                            }}
                          >
                            {study.status?.replace('_', ' ') || 'Awaiting'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onOpenStudy(study.id, study.patient_id)}
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                          >
                            Review
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

        {/* Right: Quick Clinical Navigation & Hub */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '20px 22px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#252525', marginBottom: '14px' }}>
              Clinical Workflows
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => onNavigateToTab('ecg_prediction')}
                style={{
                  justifyContent: 'flex-start',
                  padding: '10px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#A83245',
                  background: '#F8EAED',
                  border: '1px solid #E8D3D3',
                }}
              >
                <HeartPulse size={15} style={{ marginRight: '6px' }} />
                Standalone ECG Prediction
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => onNavigateToTab('worklist')}
                style={{
                  justifyContent: 'flex-start',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: '#252525',
                  border: '1px solid #E8E6E1',
                }}
              >
                <ClipboardList size={15} style={{ marginRight: '6px', color: '#777773' }} />
                ECG Worklist & Queue
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => onNavigateToTab('patients')}
                style={{
                  justifyContent: 'flex-start',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: '#252525',
                  border: '1px solid #E8E6E1',
                }}
              >
                <Users size={15} style={{ marginRight: '6px', color: '#777773' }} />
                Patient Records & Charts
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => onNavigateToTab('reports')}
                style={{
                  justifyContent: 'flex-start',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: '#252525',
                  border: '1px solid #E8E6E1',
                }}
              >
                <FileText size={15} style={{ marginRight: '6px', color: '#777773' }} />
                Reports & Medical Records
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => onNavigateToTab('research_lab')}
                style={{
                  justifyContent: 'flex-start',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: '#252525',
                  border: '1px solid #E8E6E1',
                }}
              >
                <FlaskConical size={15} style={{ marginRight: '6px', color: '#777773' }} />
                Research Lab & Benchmarking
              </button>
            </div>
          </div>

          {/* Quick Notice */}
          <div
            style={{
              padding: '14px 16px',
              background: '#FAF9F6',
              border: '1px solid #E8E6E1',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#777773',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: '#252525', display: 'block', marginBottom: '4px' }}>
              Multi-Lead Clinical Safety
            </strong>
            Automated model scores and attributions are supportive clinical diagnostic aids, not confirmed medical diagnoses. Always verify findings against full 12-lead patient waveforms and clinical history before signing reports.
          </div>
        </div>
      </div>
    </div>
  )
}

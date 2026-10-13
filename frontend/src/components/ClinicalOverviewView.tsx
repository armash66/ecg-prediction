import React, { useEffect, useState } from 'react'
import {
  Users,
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  Activity,
  UserPlus,
  Search,
  Upload,
  ArrowRight,
  Calendar,
  FileText,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react'
import { ClinicalOverviewData, Patient, ECGStudy } from '../types'
import { fetchClinicalOverview } from '../api'
import { useAnalysis } from '../context/AnalysisContext'

interface ClinicalOverviewViewProps {
  onNavigateToTab: (tab: any) => void
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
  const { openStudyForReview } = useAnalysis()

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

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}>
        <RefreshCw size={24} className="spin-animation" style={{ color: '#A83245' }} />
        <span style={{ fontSize: '14px', color: '#777773' }}>Loading clinical encounter metrics...</span>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', borderColor: '#FDEEEE' }}>
        <AlertCircle size={32} style={{ color: '#B33A3A', margin: '0 auto 12px' }} />
        <div style={{ fontWeight: 600, color: '#B33A3A', marginBottom: '8px' }}>Unable to retrieve clinical overview</div>
        <div style={{ color: '#777773', fontSize: '13px', marginBottom: '16px' }}>{error}</div>
        <button className="btn btn-secondary btn-sm" onClick={loadData}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  const overview = data!

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Clinician Welcome & Banner */}
      <div
        className="card"
        style={{
          padding: '24px 28px',
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FAFAF8 100%)',
          borderLeft: '4px solid #A83245',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#252525', margin: 0 }}>
              Clinical ECG Review & Documentation Workspace
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#34765A',
                background: '#E8F4EE',
                padding: '2px 8px',
                borderRadius: '4px'
              }}
            >
              Session Active
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#777773', margin: 0, maxWidth: '780px' }}>
            Organize 12-lead ECG studies, inspect rhythm and ST-T morphology, review multilabel deep AI predictions,
            generate structured interpretations, and document finalized encounter reports.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-primary" onClick={onRegisterPatient}>
            <UserPlus size={15} />
            <span>Register Patient</span>
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigateToTab('worklist')}>
            <ClipboardList size={15} />
            <span>Open Worklist</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: '#777773', letterSpacing: '0.5px' }}>
              Registered Patients
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F8EAED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} style={{ color: '#A83245' }} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#252525' }}>{overview.total_patients}</div>
          <div style={{ fontSize: '12px', color: '#777773', marginTop: '4px' }}>
            Active patient charts in database
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: '#777773', letterSpacing: '0.5px' }}>
              Total ECG Studies
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F0EFEA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} style={{ color: '#252525' }} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#252525' }}>{overview.total_studies}</div>
          <div style={{ fontSize: '12px', color: '#777773', marginTop: '4px' }}>
            Recorded 12-lead acquisitions
          </div>
        </div>

        <div className="card" style={{ padding: '20px', borderColor: overview.awaiting_review_count > 0 ? '#FDF4E7' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: '#B77925', letterSpacing: '0.5px' }}>
              Awaiting Review
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FDF4E7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} style={{ color: '#B77925' }} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#B77925' }}>{overview.awaiting_review_count}</div>
          <div style={{ fontSize: '12px', color: '#777773', marginTop: '4px' }}>
            Pending clinician interpretation
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: '#34765A', letterSpacing: '0.5px' }}>
              Reviewed & Finalized
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#E8F4EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} style={{ color: '#34765A' }} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#34765A' }}>{overview.reviewed_finalized_count}</div>
          <div style={{ fontSize: '12px', color: '#777773', marginTop: '4px' }}>
            Encounters signed off
          </div>
        </div>
      </div>

      {/* Main Grid: Studies to Review & Recent Patients */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        {/* ECG Worklist Preview */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#252525', margin: 0 }}>
                Recent ECG Studies & Worklist
              </h3>
              <p style={{ fontSize: '12px', color: '#777773', margin: '2px 0 0' }}>
                Studies awaiting review or in progress
              </p>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigateToTab('worklist')}
              style={{ fontSize: '12px', color: '#A83245' }}
            >
              <span>View full worklist</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {overview.recent_studies.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#777773', fontSize: '13px' }}>
              No ECG studies registered in the database yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {overview.recent_studies.map((study) => {
                const isFinalized = study.status === 'finalized'
                const isAwaiting = study.status === 'awaiting_review'
                const statusBg = isFinalized ? '#E8F4EE' : isAwaiting ? '#FDF4E7' : '#EBF3FB'
                const statusColor = isFinalized ? '#34765A' : isAwaiting ? '#B77925' : '#2A6BB2'

                return (
                  <div
                    key={study.id}
                    onClick={() => onOpenStudy(study.id, study.patient_id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: '#FAFAF8',
                      borderRadius: '8px',
                      border: '1px solid #E8E6E1',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#A83245')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E8E6E1')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: '#FFFFFF',
                          border: '1px solid #E8E6E1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#A83245',
                          fontWeight: 700,
                          fontSize: '11px'
                        }}
                      >
                        12L
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '14px', color: '#252525' }}>
                            {study.patient_name || 'Patient'}
                          </span>
                          <code style={{ fontSize: '11px', color: '#777773', background: '#F0EEE9', padding: '1px 5px', borderRadius: '4px' }}>
                            {study.study_id}
                          </code>
                        </div>
                        <div style={{ fontSize: '12px', color: '#777773', marginTop: '2px' }}>
                          {study.patient_display_id} \u2022 Acquired {study.recorded_at?.slice(0, 16)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {study.flags && study.flags.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {study.flags.slice(0, 2).map((fl: string) => (
                            <span
                              key={fl}
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: '#FDEEEE',
                                color: '#B33A3A'
                              }}
                            >
                              {fl}
                            </span>
                          ))}
                        </div>
                      )}
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: statusBg,
                          color: statusColor,
                          textTransform: 'capitalize'
                        }}
                      >
                        {study.status.replace('_', ' ')}
                      </span>
                      <ArrowRight size={14} style={{ color: '#777773' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recently Opened Patients & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Quick Actions Card */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#252525', marginBottom: '14px' }}>
              Quick Clinical Actions
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={onRegisterPatient}
                style={{ justifyContent: 'flex-start', padding: '10px 12px', fontSize: '13px' }}
              >
                <UserPlus size={15} style={{ color: '#A83245' }} />
                <span>Register Patient</span>
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => onNavigateToTab('patients')}
                style={{ justifyContent: 'flex-start', padding: '10px 12px', fontSize: '13px' }}
              >
                <Search size={15} style={{ color: '#A83245' }} />
                <span>Find Patient</span>
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => onNavigateToTab('worklist')}
                style={{ justifyContent: 'flex-start', padding: '10px 12px', fontSize: '13px' }}
              >
                <ClipboardList size={15} style={{ color: '#A83245' }} />
                <span>Study Worklist</span>
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => onNavigateToTab('ecg_review')}
                style={{ justifyContent: 'flex-start', padding: '10px 12px', fontSize: '13px' }}
              >
                <Activity size={15} style={{ color: '#A83245' }} />
                <span>ECG Review</span>
              </button>
            </div>
          </div>

          {/* Recent Patients */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#252525', margin: 0 }}>
                Patient Directory
              </h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onNavigateToTab('patients')}
                style={{ fontSize: '12px', color: '#A83245' }}
              >
                <span>View all</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {overview.recent_patients.map((pat) => (
                <div
                  key={pat.id}
                  onClick={() => onNavigateToTab('patients')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #E8E6E1',
                    background: '#FFFFFF',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#252525' }}>{pat.name}</div>
                    <div style={{ fontSize: '11px', color: '#777773' }}>
                      {pat.patient_id} \u2022 {pat.age ? `${pat.age}y` : ''} {pat.sex}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: '#777773' }}>
                    {pat.study_count || 0} {pat.study_count === 1 ? 'study' : 'studies'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

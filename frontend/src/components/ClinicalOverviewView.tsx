import React, { useEffect, useState } from 'react'
import {
  Users,
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  ArrowRight,
  RefreshCw,
  Activity,
  FileText,
} from 'lucide-react'
import { ClinicalOverviewData } from '../types'
import { fetchClinicalOverview } from '../api'

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

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchClinicalOverview()
      setData(res)
    } catch (err: any) {
      setError(err?.message || 'Failed to load overview')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '10px' }}>
        <RefreshCw size={22} className="spin-animation" style={{ color: '#A83245' }} />
        <span style={{ fontSize: '13px', color: '#777773' }}>Loading overview...</span>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', maxWidth: '500px', margin: '40px auto' }}>
        <AlertCircle size={28} style={{ color: '#B33A3A', margin: '0 auto 10px' }} />
        <div style={{ fontWeight: 600, color: '#B33A3A', marginBottom: '6px' }}>Unable to load overview</div>
        <div style={{ color: '#777773', fontSize: '13px', marginBottom: '16px' }}>{error}</div>
        <button className="btn btn-secondary btn-sm" onClick={loadData}>
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    )
  }

  const overview = data!

  // Empty state if no patients registered in database
  if (overview.total_patients === 0 && overview.total_studies === 0) {
    return (
      <div style={{ maxWidth: '640px', margin: '60px auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px 32px' }}>
          <Users size={36} style={{ color: '#A83245', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#252525', margin: '0 0 8px' }}>
            Welcome to ECG Intelligence
          </h2>
          <p style={{ fontSize: '14px', color: '#777773', margin: '0 0 24px', lineHeight: 1.5 }}>
            Review 12-lead ECGs, run AI pattern analysis, and prepare clinical documentation.
            Get started by registering your first patient.
          </p>
          <button className="btn btn-primary" onClick={onRegisterPatient}>
            <UserPlus size={15} />
            <span>Add patient</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Welcome & Primary Actions */}
      <div
        className="card"
        style={{
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#252525', margin: '0 0 4px' }}>
            Welcome to ECG Intelligence
          </h2>
          <p style={{ fontSize: '13px', color: '#777773', margin: 0 }}>
            Review 12-lead ECGs, run AI pattern analysis, and prepare clinical documentation.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => onNavigateToTab('worklist')}>
            <ClipboardList size={15} />
            <span>Open worklist</span>
          </button>
          <button className="btn btn-secondary" onClick={onRegisterPatient}>
            <UserPlus size={15} />
            <span>Add patient</span>
          </button>
        </div>
      </div>

      {/* Useful Counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '12px', color: '#777773', marginBottom: '6px' }}>
            Studies awaiting review
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: overview.awaiting_review_count > 0 ? '#B77925' : '#252525' }}>
            {overview.awaiting_review_count}
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '12px', color: '#777773', marginBottom: '6px' }}>
            Recently reviewed studies
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#34765A' }}>
            {overview.reviewed_finalized_count}
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '12px', color: '#777773', marginBottom: '6px' }}>
            Total registered patients
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#252525' }}>
            {overview.total_patients}
          </div>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#252525', margin: 0 }}>
            Recent Activity
          </h3>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onNavigateToTab('worklist')}
            style={{ fontSize: '12px', color: '#A83245' }}
          >
            <span>View worklist</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {overview.recent_studies.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#777773', fontSize: '13px' }}>
            No recent study activity recorded.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {overview.recent_studies.slice(0, 5).map((study) => {
              const isReviewed = study.status === 'finalized' || study.status === 'reviewed'
              return (
                <div
                  key={study.id}
                  onClick={() => onOpenStudy(study.id, study.patient_id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: '1px solid #E8E6E1',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#A83245')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E8E6E1')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Activity size={16} style={{ color: isReviewed ? '#34765A' : '#B77925' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#252525' }}>
                        {study.study_id}
                        {study.patient_name && (
                          <span style={{ fontWeight: 400, color: '#777773', marginLeft: '6px' }}>
                            — {study.patient_name}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#777773' }}>
                        {study.created_at ? new Date(study.created_at).toLocaleDateString() : 'Recent'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: isReviewed ? '#E8F4EE' : '#FDF4E7',
                        color: isReviewed ? '#34765A' : '#B77925',
                      }}
                    >
                      {study.status === 'finalized' ? 'Finalized' : study.status === 'reviewed' ? 'Reviewed' : 'Awaiting review'}
                    </span>
                    <ArrowRight size={13} style={{ color: '#777773' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

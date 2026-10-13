import React from 'react'
import { Activity, ShieldCheck, Zap, User, FileText } from 'lucide-react'
import { BackendHealth, ECGStudy } from '../types'

interface HeaderProps {
  title: string
  subtitle?: string
  activeModel: string
  health: BackendHealth | null
  selectedStudy?: ECGStudy | null
  onOpenReview?: () => void
  showReviewButton?: boolean
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  activeModel,
  health,
  selectedStudy,
  onOpenReview,
  showReviewButton = false,
}) => {
  return (
    <header className="app-header">
      <div className="header-title-area">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {selectedStudy && (
          <div
            className="active-model-pill"
            style={{
              background: '#F8EAED',
              borderColor: 'rgba(168, 50, 69, 0.25)',
              color: '#A83245',
              fontWeight: 600,
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <User size={13} />
            <span>{selectedStudy.patient_display_id || selectedStudy.patient_id} ({selectedStudy.patient_name || 'Patient'})</span>
            <span style={{ color: '#777773', fontWeight: 400 }}>\u2022</span>
            <span>{selectedStudy.study_id}</span>
          </div>
        )}

        <div className="active-model-pill">
          <Zap size={13} style={{ color: 'var(--accent-burgundy)' }} />
          <span>Active Model: <b>{activeModel.toUpperCase()}</b></span>
        </div>

        <div
          className="active-model-pill"
          style={{
            fontSize: '11px',
            background: '#FDF4E7',
            borderColor: '#E8E6E1',
            color: '#B77925',
            fontWeight: 600,
            padding: '4px 8px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="Clinical prototype for research and evaluation purposes only. Not certified for autonomous diagnosis."
        >
          <ShieldCheck size={12} />
          <span>Decision Support Prototype</span>
        </div>

        {showReviewButton && onOpenReview && (
          <button className="btn btn-primary btn-sm" onClick={onOpenReview}>
            <Activity size={14} />
            <span>Open ECG Review</span>
          </button>
        )}
      </div>
    </header>
  )
}

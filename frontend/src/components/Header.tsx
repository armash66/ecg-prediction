import React from 'react'
import { Activity, User } from 'lucide-react'
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
            style={{
              background: '#F8EAED',
              border: '1px solid rgba(168, 50, 69, 0.2)',
              color: '#A83245',
              fontSize: '12px',
              fontWeight: 500,
              padding: '4px 10px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <User size={13} />
            <span>{selectedStudy.patient_name || selectedStudy.patient_id}</span>
            <span style={{ color: '#777773' }}>\u2022</span>
            <span>{selectedStudy.study_id}</span>
          </div>
        )}

        <div
          style={{
            fontSize: '11px',
            color: '#777773',
            background: '#FAFAF8',
            border: '1px solid #E8E6E1',
            padding: '4px 8px',
            borderRadius: '4px',
          }}
          title="Clinical prototype for evaluation purposes. Not certified for autonomous diagnosis."
        >
          Review Support Prototype
        </div>

        {showReviewButton && onOpenReview && (
          <button className="btn btn-primary btn-sm" onClick={onOpenReview}>
            <Activity size={13} />
            <span>Open Review</span>
          </button>
        )}
      </div>
    </header>
  )
}

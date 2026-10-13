import React from 'react'
import { Activity, ShieldCheck, Zap } from 'lucide-react'
import { BackendHealth } from '../types'

interface HeaderProps {
  title: string
  subtitle?: string
  activeModel: string
  health: BackendHealth | null
  onOpenAnalysis?: () => void
  showAnalyzeButton?: boolean
}

export const Header: React.FC<HeaderProps> = ({
  title,
  activeModel,
  health,
  onOpenAnalysis,
  showAnalyzeButton = false,
}) => {
  return (
    <header className="app-header">
      <div className="header-title-area">
        <h1 className="page-title">{title}</h1>
      </div>

      <div className="header-actions">
        <div className="active-model-pill">
          <Zap size={13} style={{ color: 'var(--accent-burgundy)' }} />
          <span>Active Model: <b>{activeModel.toUpperCase()}</b></span>
        </div>

        {health && (
          <div
            className="active-model-pill"
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          >
            <span>Inferences: <b style={{ color: 'var(--text-primary)' }}>{health.session_inferences}</b></span>
          </div>
        )}

        {showAnalyzeButton && onOpenAnalysis && (
          <button className="btn btn-primary btn-sm" onClick={onOpenAnalysis}>
            <Activity size={14} />
            <span>Open ECG Analysis</span>
          </button>
        )}
      </div>
    </header>
  )
}

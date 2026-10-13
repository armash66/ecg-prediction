import React from 'react'
import {
  Activity,
  BarChart3,
  Cpu,
  Layers,
  HeartPulse,
  Info
} from 'lucide-react'
import { BackendHealth } from '../types'

interface SidebarProps {
  currentTab: 'overview' | 'analysis' | 'modellab' | 'explainability'
  onSelectTab: (tab: 'overview' | 'analysis' | 'modellab' | 'explainability') => void
  health: BackendHealth | null
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, health }) => {
  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: BarChart3,
    },
    {
      id: 'analysis',
      label: 'ECG Analysis',
      icon: Activity,
    },
    {
      id: 'modellab',
      label: 'Model Lab',
      icon: Cpu,
    },
    {
      id: 'explainability',
      label: 'Explainability',
      icon: Layers,
    },
  ] as const

  const healthStatus = health?.status || 'offline'

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="brand-title">
          <HeartPulse size={22} className="brand-dot" />
          <span>ECG Intelligence</span>
        </div>
        <div className="brand-subtitle">PTB-XL Research Platform</div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentTab === item.id
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
            >
              <Icon className="nav-item-icon" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="health-status-badge">
          <div className={`status-dot ${healthStatus}`} />
          <span>
            {healthStatus === 'healthy'
              ? 'Backend Online'
              : healthStatus === 'degraded'
              ? 'Degraded Mode'
              : 'Backend Offline'}
          </span>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
          10-Fold Patient Split &bull; 100 Hz
        </div>
      </div>
    </aside>
  )
}

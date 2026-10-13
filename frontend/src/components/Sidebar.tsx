import React, { useState } from 'react'
import {
  BarChart3,
  Activity,
  Waves,
  Layers,
  GitCompare,
  ShieldCheck,
  Sliders,
  LineChart,
  History,
  FileText,
  Cpu,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { NavigationTab, BackendHealth } from '../types'
import { useAnalysis } from '../context/AnalysisContext'

interface SidebarProps {
  currentTab: NavigationTab
  onSelectTab: (tab: NavigationTab) => void
  health: BackendHealth | null
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, health }) => {
  const [collapsed, setCollapsed] = useState<boolean>(false)
  const { analysisResult, attributionResult, comparisonResult, faithfulnessResult } = useAnalysis()

  const navItems = [
    {
      id: 'overview' as NavigationTab,
      label: 'Overview',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'analysis' as NavigationTab,
      label: 'ECG Analysis',
      icon: Activity,
      badge: analysisResult ? 'Ready' : null,
      badgeType: 'success',
    },
    {
      id: 'signal_explorer' as NavigationTab,
      label: 'Signal Explorer',
      icon: Waves,
      badge: null,
    },
    {
      id: 'explainability' as NavigationTab,
      label: 'Explainability Studio',
      icon: Layers,
      badge: attributionResult ? 'Attributed' : null,
      badgeType: 'accent',
    },
    {
      id: 'model_comparison' as NavigationTab,
      label: 'Model Comparison',
      icon: GitCompare,
      badge: comparisonResult ? 'Compared' : null,
      badgeType: 'info',
    },
    {
      id: 'faithfulness' as NavigationTab,
      label: 'Faithfulness Lab',
      icon: ShieldCheck,
      badge: faithfulnessResult ? 'Tested' : null,
      badgeType: 'info',
    },
    {
      id: 'robustness' as NavigationTab,
      label: 'Robustness Lab',
      icon: Sliders,
      badge: null,
    },
    {
      id: 'research_analytics' as NavigationTab,
      label: 'Research Analytics',
      icon: LineChart,
      badge: null,
    },
    {
      id: 'history' as NavigationTab,
      label: 'Analysis History',
      icon: History,
      badge: null,
    },
    {
      id: 'reports' as NavigationTab,
      label: 'Reports & Exports',
      icon: FileText,
      badge: null,
    },
    {
      id: 'modellab' as NavigationTab,
      label: 'Model Lab',
      icon: Cpu,
      badge: null,
    },
  ]

  const healthStatus = health?.status || 'offline'

  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="brand-title" onClick={() => onSelectTab('overview')} style={{ cursor: 'pointer' }}>
          <HeartPulse size={22} className="brand-dot" />
          {!collapsed && <span>ECG Intelligence</span>}
        </div>
        <button
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label="Toggle sidebar collapse"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {!collapsed && (
        <div className="brand-subtitle">
          PTB-XL Research Workbench
        </div>
      )}

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentTab === item.id
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="nav-item-icon" size={18} />
              {!collapsed && (
                <>
                  <span className="nav-item-text">{item.label}</span>
                  {item.badge && (
                    <span className={`nav-badge ${item.badgeType || 'default'}`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="health-status-badge">
          <div className={`status-dot ${healthStatus}`} />
          {!collapsed && (
            <span>
              {healthStatus === 'healthy'
                ? 'Backend Online'
                : healthStatus === 'degraded'
                ? 'Degraded Mode'
                : 'Backend Offline'}
            </span>
          )}
        </div>
        {!collapsed && (
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.3, marginTop: '4px' }}>
            10-Fold Patient Split &bull; 100 Hz
          </div>
        )}
      </div>
    </aside>
  )
}

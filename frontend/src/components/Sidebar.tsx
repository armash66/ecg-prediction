import React, { useState } from 'react'
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  FileText,
  FlaskConical,
  Settings,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
  Activity,
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
  const { selectedStudy } = useAnalysis()

  // Simplified 5 primary sections
  const primaryNavItems: Array<{ id: NavigationTab; label: string; icon: React.ComponentType<any> }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'worklist',
      label: 'ECG Worklist',
      icon: ClipboardList,
    },
    {
      id: 'patients',
      label: 'Patients',
      icon: Users,
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileText,
    },
    {
      id: 'research',
      label: 'Research',
      icon: FlaskConical,
    },
  ]

  const isTabActive = (tabId: NavigationTab) => {
    if (tabId === 'overview') {
      return currentTab === 'overview' || currentTab === 'clinical_overview'
    }
    if (tabId === 'research') {
      return (
        currentTab === 'research' ||
        currentTab === 'research_lab' ||
        [
          'explainability',
          'signal_explorer',
          'model_comparison',
          'faithfulness',
          'robustness',
          'modellab',
          'research_analytics',
        ].includes(currentTab)
      )
    }
    return currentTab === tabId
  }

  const healthStatus = health?.status || 'offline'

  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div
          className="brand-title"
          onClick={() => onSelectTab('overview')}
          style={{ cursor: 'pointer' }}
          title="ECG Intelligence Home"
        >
          <HeartPulse size={20} className="brand-dot" />
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

      <nav className="sidebar-nav">
        {primaryNavItems.map((item) => {
          const Icon = item.icon
          const active = isTabActive(item.id)
          return (
            <button
              key={item.id}
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="nav-item-icon" size={18} />
              {!collapsed && <span className="nav-item-text">{item.label}</span>}
            </button>
          )
        })}

        {/* If an ECG review is active, show contextual link back to review */}
        {currentTab === 'ecg_review' && selectedStudy && (
          <div style={{ marginTop: '12px', padding: collapsed ? '0' : '0 8px' }}>
            <button
              className="nav-item active"
              onClick={() => onSelectTab('ecg_review')}
              title={collapsed ? 'Active Review' : undefined}
              style={{
                background: '#F8EAED',
                borderColor: 'rgba(168, 50, 69, 0.25)',
                color: '#A83245',
              }}
            >
              <Activity className="nav-item-icon" size={18} />
              {!collapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', overflow: 'hidden' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Active Review
                  </span>
                  <span style={{ fontSize: '12px', color: '#252525', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                    {selectedStudy.study_id}
                  </span>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Small bottom Settings option */}
        <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
          <button
            className={`nav-item ${currentTab === 'settings' ? 'active' : ''}`}
            onClick={() => onSelectTab('settings')}
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings className="nav-item-icon" size={17} />
            {!collapsed && <span className="nav-item-text">Settings</span>}
          </button>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="health-status-badge">
          <div className={`status-dot ${healthStatus}`} />
          {!collapsed && (
            <span>
              {healthStatus === 'healthy' ? 'Engine online' : healthStatus === 'degraded' ? 'Degraded' : 'Offline'}
            </span>
          )}
        </div>
      </div>
    </aside>
  )
}

import React, { useState } from 'react'
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Activity,
  Clock,
  FileText,
  FlaskConical,
  Settings,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Cpu,
  Layers,
  GitCompare,
  Waves,
  ShieldCheck,
  Sliders,
  LineChart,
} from 'lucide-react'
import { NavigationTab, ResearchSubTab, BackendHealth } from '../types'
import { useAnalysis } from '../context/AnalysisContext'

interface SidebarProps {
  currentTab: NavigationTab
  onSelectTab: (tab: NavigationTab) => void
  health: BackendHealth | null
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, health }) => {
  const [collapsed, setCollapsed] = useState<boolean>(false)
  const isResearchRoute = currentTab === 'research_lab' || [
    'explainability',
    'signal_explorer',
    'model_comparison',
    'faithfulness',
    'robustness',
    'modellab',
    'research_analytics',
  ].includes(currentTab)
  const [researchExpanded, setResearchExpanded] = useState<boolean>(isResearchRoute)
  const {
    analysisResult,
    researchSubTab,
    setResearchSubTab,
    selectedStudy,
  } = useAnalysis()

  const mainNavItems = [
    {
      id: 'clinical_overview' as NavigationTab,
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'ecg_prediction' as NavigationTab,
      label: 'ECG Prediction',
      icon: HeartPulse,
      badge: null,
    },
    {
      id: 'worklist' as NavigationTab,
      label: 'ECG Worklist',
      icon: ClipboardList,
      badge: null,
    },
    {
      id: 'patients' as NavigationTab,
      label: 'Patients',
      icon: Users,
      badge: null,
    },
    {
      id: 'ecg_review' as NavigationTab,
      label: 'ECG Review',
      icon: Activity,
      badge: selectedStudy ? selectedStudy.study_id : (analysisResult ? 'Active' : null),
      badgeType: 'success',
    },
    {
      id: 'encounters' as NavigationTab,
      label: 'Encounters & History',
      icon: Clock,
      badge: null,
    },
    {
      id: 'reports' as NavigationTab,
      label: 'Reports',
      icon: FileText,
      badge: null,
    },
  ]

  const researchSubItems = [
    { id: 'explainability' as ResearchSubTab, label: 'Why this result?', icon: Layers },
    { id: 'signal_explorer' as ResearchSubTab, label: 'Signal Analysis', icon: Waves },
    { id: 'model_comparison' as ResearchSubTab, label: 'Compare models', icon: GitCompare },
    { id: 'faithfulness' as ResearchSubTab, label: 'Explanation testing', icon: ShieldCheck },
    { id: 'robustness' as ResearchSubTab, label: 'Robustness tests', icon: Sliders },
    { id: 'modellab' as ResearchSubTab, label: 'Model Performance', icon: Cpu },
    { id: 'research_analytics' as ResearchSubTab, label: 'Benchmark Analytics', icon: LineChart },
  ]

  const isResearchActive = currentTab === 'research_lab' || [
    'explainability',
    'signal_explorer',
    'model_comparison',
    'faithfulness',
    'robustness',
    'modellab',
    'research_analytics',
  ].includes(currentTab)

  const handleResearchSubClick = (sub: ResearchSubTab) => {
    setResearchSubTab(sub)
    onSelectTab('research_lab')
  }

  const healthStatus = health?.status || 'offline'

  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div
          className="brand-title"
          onClick={() => onSelectTab('clinical_overview')}
          style={{ cursor: 'pointer' }}
          title="ECG Intelligence Home"
        >
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
          Clinical Review & Documentation
        </div>
      )}

      <nav className="sidebar-nav">
        {mainNavItems.map((item) => {
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

        {/* Research Lab parent section */}
        <div className="nav-group">
          <button
            className={`nav-item ${isResearchActive ? 'active' : ''}`}
            onClick={() => {
              if (collapsed) {
                onSelectTab('research_lab')
              } else {
                onSelectTab('research_lab')
                setResearchExpanded(!researchExpanded)
              }
            }}
            title={collapsed ? 'Research Lab' : undefined}
          >
            <FlaskConical className="nav-item-icon" size={18} />
            {!collapsed && (
              <>
                <span className="nav-item-text" style={{ fontWeight: 600 }}>Research Lab</span>
                <ChevronDown
                  size={14}
                  style={{
                    marginLeft: 'auto',
                    transform: researchExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.15s ease'
                  }}
                />
              </>
            )}
          </button>

          {/* Research Lab secondary items */}
          {!collapsed && researchExpanded && (
            <div className="nav-subgroup" style={{ paddingLeft: '14px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {researchSubItems.map((sub) => {
                const SubIcon = sub.icon
                const isSubActive = isResearchActive && researchSubTab === sub.id
                return (
                  <button
                    key={sub.id}
                    className={`nav-subitem ${isSubActive ? 'active' : ''}`}
                    onClick={() => handleResearchSubClick(sub.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      color: isSubActive ? '#A83245' : '#777773',
                      background: isSubActive ? '#F8EAED' : 'transparent',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: isSubActive ? 600 : 400,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <SubIcon size={14} />
                    <span>{sub.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Settings */}
        <button
          className={`nav-item ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
          title={collapsed ? 'Settings' : undefined}
          style={{ marginTop: 'auto' }}
        >
          <Settings className="nav-item-icon" size={18} />
          {!collapsed && <span className="nav-item-text">Settings</span>}
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="health-status-badge">
          <div className={`status-dot ${healthStatus}`} />
          {!collapsed && (
            <span>
              {healthStatus === 'healthy' ? 'Engine Online' : healthStatus === 'degraded' ? 'Degraded' : 'Offline'}
            </span>
          )}
        </div>
      </div>
    </aside>
  )
}

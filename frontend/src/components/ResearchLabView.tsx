import React from 'react'
import {
  Layers,
  Waves,
  GitCompare,
  ShieldCheck,
  Sliders,
  Cpu,
  LineChart,
  FlaskConical,
} from 'lucide-react'
import { ResearchSubTab } from '../types'
import { useAnalysis } from '../context/AnalysisContext'
import { ExplainabilityView } from './ExplainabilityView'
import { SignalExplorerView } from './SignalExplorerView'
import { ModelComparisonView } from './ModelComparisonView'
import { FaithfulnessLabView } from './FaithfulnessLabView'
import { RobustnessLabView } from './RobustnessLabView'
import { ModelLabView } from './ModelLabView'
import { ResearchAnalyticsView } from './ResearchAnalyticsView'

const SUB_TABS: Array<{ id: ResearchSubTab; label: string; icon: React.ComponentType<any> }> = [
  { id: 'explainability', label: 'Why this result?', icon: Layers },
  { id: 'signal_explorer', label: 'Signal Analysis', icon: Waves },
  { id: 'model_comparison', label: 'Compare models', icon: GitCompare },
  { id: 'faithfulness', label: 'Explanation testing', icon: ShieldCheck },
  { id: 'robustness', label: 'Robustness tests', icon: Sliders },
  { id: 'modellab', label: 'Model Performance', icon: Cpu },
  { id: 'research_analytics', label: 'Benchmark Analytics', icon: LineChart },
]

export const ResearchLabView: React.FC = () => {
  const {
    researchSubTab,
    setResearchSubTab,
    models,
    activeModel,
    setActiveModel,
  } = useAnalysis()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Secondary Sub-Navigation Toolbar */}
      <div
        className="card"
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: '#FFFFFF',
          overflowX: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px', color: '#A83245', fontWeight: 700, fontSize: '13px' }}>
          <FlaskConical size={16} />
          <span>Research Lab:</span>
        </div>

        {SUB_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = researchSubTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setResearchSubTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 500,
                border: 'none',
                background: isActive ? '#F8EAED' : 'transparent',
                color: isActive ? '#A83245' : '#777773',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Sub-view Rendering */}
      <div>
        {researchSubTab === 'explainability' && <ExplainabilityView />}
        {researchSubTab === 'signal_explorer' && <SignalExplorerView />}
        {researchSubTab === 'model_comparison' && <ModelComparisonView />}
        {researchSubTab === 'faithfulness' && <FaithfulnessLabView />}
        {researchSubTab === 'robustness' && <RobustnessLabView />}
        {researchSubTab === 'modellab' && (
          <ModelLabView
            models={models}
            activeModel={activeModel}
            onModelSwitched={(newM) => setActiveModel(newM)}
          />
        )}
        {researchSubTab === 'research_analytics' && <ResearchAnalyticsView />}
      </div>
    </div>
  )
}

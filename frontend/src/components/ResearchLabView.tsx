import React, { useState } from 'react'
import {
  Layers,
  Waves,
  Cpu,
  FlaskConical,
  GitCompare,
  ShieldCheck,
  Sliders,
} from 'lucide-react'
import { ResearchSubTab } from '../types'
import { useAnalysis } from '../context/AnalysisContext'
import { ExplainabilityView } from './ExplainabilityView'
import { SignalExplorerView } from './SignalExplorerView'
import { ModelComparisonView } from './ModelComparisonView'
import { FaithfulnessLabView } from './FaithfulnessLabView'
import { RobustnessLabView } from './RobustnessLabView'
import { ModelLabView } from './ModelLabView'

export const ResearchLabView: React.FC = () => {
  const {
    researchSubTab,
    setResearchSubTab,
    models,
    activeModel,
    setActiveModel,
  } = useAnalysis()

  // Sub-selector for Experiments
  const [experimentType, setExperimentType] = useState<'comparison' | 'faithfulness' | 'robustness'>('comparison')

  // Map legacy subtabs to the 4 simplified ones
  const activeSection: 'performance' | 'explainability' | 'signals' | 'experiments' =
    researchSubTab === 'performance' || researchSubTab === 'modellab' || researchSubTab === 'research_analytics'
      ? 'performance'
      : researchSubTab === 'signals' || researchSubTab === 'signal_explorer'
      ? 'signals'
      : researchSubTab === 'experiments' || researchSubTab === 'model_comparison' || researchSubTab === 'faithfulness' || researchSubTab === 'robustness'
      ? 'experiments'
      : 'explainability'

  const handleSelectSection = (sec: 'performance' | 'explainability' | 'signals' | 'experiments') => {
    setResearchSubTab(sec)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 4 Clean Secondary Sections */}
      <div
        className="card"
        style={{
          padding: '8px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          background: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {[
            { id: 'performance' as const, label: 'Model Performance', icon: Cpu },
            { id: 'explainability' as const, label: 'Explainability', icon: Layers },
            { id: 'signals' as const, label: 'Signal Analysis', icon: Waves },
            { id: 'experiments' as const, label: 'Experiments', icon: FlaskConical },
          ].map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleSelectSection(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  border: 'none',
                  background: isActive ? '#F8EAED' : 'transparent',
                  color: isActive ? '#A83245' : '#777773',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                }}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>

        {/* Experiment sub-selector when on Experiments tab */}
        {activeSection === 'experiments' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FAFAF8', padding: '3px 6px', borderRadius: '6px', border: '1px solid #E8E6E1' }}>
            <button
              onClick={() => setExperimentType('comparison')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                fontSize: '12px',
                border: 'none',
                borderRadius: '4px',
                background: experimentType === 'comparison' ? '#FFFFFF' : 'transparent',
                fontWeight: experimentType === 'comparison' ? 600 : 400,
                color: experimentType === 'comparison' ? '#252525' : '#777773',
                cursor: 'pointer',
                boxShadow: experimentType === 'comparison' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <GitCompare size={12} />
              <span>Compare models</span>
            </button>
            <button
              onClick={() => setExperimentType('faithfulness')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                fontSize: '12px',
                border: 'none',
                borderRadius: '4px',
                background: experimentType === 'faithfulness' ? '#FFFFFF' : 'transparent',
                fontWeight: experimentType === 'faithfulness' ? 600 : 400,
                color: experimentType === 'faithfulness' ? '#252525' : '#777773',
                cursor: 'pointer',
                boxShadow: experimentType === 'faithfulness' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <ShieldCheck size={12} />
              <span>Explanation testing</span>
            </button>
            <button
              onClick={() => setExperimentType('robustness')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                fontSize: '12px',
                border: 'none',
                borderRadius: '4px',
                background: experimentType === 'robustness' ? '#FFFFFF' : 'transparent',
                fontWeight: experimentType === 'robustness' ? 600 : 400,
                color: experimentType === 'robustness' ? '#252525' : '#777773',
                cursor: 'pointer',
                boxShadow: experimentType === 'robustness' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <Sliders size={12} />
              <span>Robustness tests</span>
            </button>
          </div>
        )}
      </div>

      {/* Render Active View */}
      <div>
        {activeSection === 'performance' && (
          <ModelLabView
            models={models}
            activeModel={activeModel}
            onModelSwitched={(newM) => setActiveModel(newM)}
          />
        )}

        {activeSection === 'explainability' && <ExplainabilityView />}

        {activeSection === 'signals' && <SignalExplorerView />}

        {activeSection === 'experiments' && (
          <div>
            {experimentType === 'comparison' && <ModelComparisonView />}
            {experimentType === 'faithfulness' && <FaithfulnessLabView />}
            {experimentType === 'robustness' && <RobustnessLabView />}
          </div>
        )}
      </div>
    </div>
  )
}

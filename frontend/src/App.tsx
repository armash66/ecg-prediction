import React from 'react'
import { AnalysisProvider, useAnalysis } from './context/AnalysisContext'
import { NavigationTab } from './types'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { OverviewView } from './components/OverviewView'
import { ECGAnalysisView } from './components/ECGAnalysisView'
import { SignalExplorerView } from './components/SignalExplorerView'
import { ExplainabilityView } from './components/ExplainabilityView'
import { ModelComparisonView } from './components/ModelComparisonView'
import { FaithfulnessLabView } from './components/FaithfulnessLabView'
import { RobustnessLabView } from './components/RobustnessLabView'
import { ResearchAnalyticsView } from './components/ResearchAnalyticsView'
import { AnalysisHistoryView } from './components/AnalysisHistoryView'
import { ReportsExportView } from './components/ReportsExportView'
import { ModelLabView } from './components/ModelLabView'

const TAB_TITLES: Record<NavigationTab, { title: string; subtitle: string }> = {
  overview: {
    title: 'Research Overview Dashboard',
    subtitle: 'PTB-XL Benchmark Highlights & System Status',
  },
  analysis: {
    title: '12-Lead ECG Analysis Workspace',
    subtitle: 'Multilabel Inference, Threshold Interpretation & Signal Diagnostics',
  },
  signal_explorer: {
    title: 'Signal Explorer & Time-Frequency Studio',
    subtitle: 'High-Resolution 12-Lead Viewer, STFT Spectrogram & Morphology Metrics',
  },
  explainability: {
    title: 'Explainability & Attribution Studio',
    subtitle: 'Time \u00D7 Lead Heatmaps, Class \u00D7 Lead Matrices & Diagnostic Completeness',
  },
  model_comparison: {
    title: 'Multi-Model Evaluation & Agreement',
    subtitle: 'Simultaneous Multi-Model Inference, \u0394P Heatmaps & Consensus Matrix',
  },
  faithfulness: {
    title: 'Faithfulness & Perturbation Laboratory',
    subtitle: 'Deletion / Insertion Trajectories, AUDC / AUIC & 12-Lead Ablation',
  },
  robustness: {
    title: 'Controlled Robustness & Stress-Testing',
    subtitle: 'Electrode Jitter, Baseline Drift, Lead Dropout & Stability Scoring',
  },
  research_analytics: {
    title: 'Research Benchmark Analytics & Leaderboard',
    subtitle: 'Hold-Out Test Fold 10 Performance Metrics & Validation Thresholds',
  },
  history: {
    title: 'Analysis Session History & Persistence',
    subtitle: 'SQLite Database of Recorded Analyses, Inferences & Reports',
  },
  reports: {
    title: 'Research Reports & Data Export Center',
    subtitle: 'Printable HTML/PDF Reports, JSON Records & CSV Experiment Tables',
  },
  modellab: {
    title: 'Comparative Model Laboratory',
    subtitle: 'Architecture Specifications, Checkpoint Registry & Metric Browser',
  },
}

const AppContent: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    activeModel,
    setActiveModel,
    health,
    models,
    metrics,
    samples,
    setSelectedClass,
    currentSignal,
    setSignal,
  } = useAnalysis()

  const { title, subtitle } = TAB_TITLES[currentTab]

  return (
    <div className="app-container">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        health={health}
      />

      <div className="app-main">
        <Header
          title={title}
          subtitle={subtitle}
          activeModel={activeModel}
          health={health}
          showAnalyzeButton={currentTab !== 'analysis'}
          onOpenAnalysis={() => setCurrentTab('analysis')}
        />

        <main className="page-container" style={{ padding: '24px 32px' }}>
          {currentTab === 'overview' && (
            <OverviewView
              metrics={metrics}
              health={health}
              onNavigateToAnalysis={() => setCurrentTab('analysis')}
              onNavigateToModelLab={() => setCurrentTab('modellab')}
            />
          )}

          {currentTab === 'analysis' && (
            <ECGAnalysisView
              samples={samples}
              activeModel={activeModel}
              health={health}
              onNavigateToExplain={(cls) => {
                if (cls) setSelectedClass(cls)
                setCurrentTab('explainability')
              }}
              onSignalChange={(sig) => setSignal(sig)}
              currentSignalProp={currentSignal}
            />
          )}

          {currentTab === 'signal_explorer' && <SignalExplorerView />}

          {currentTab === 'explainability' && <ExplainabilityView />}

          {currentTab === 'model_comparison' && <ModelComparisonView />}

          {currentTab === 'faithfulness' && <FaithfulnessLabView />}

          {currentTab === 'robustness' && <RobustnessLabView />}

          {currentTab === 'research_analytics' && <ResearchAnalyticsView />}

          {currentTab === 'history' && <AnalysisHistoryView />}

          {currentTab === 'reports' && <ReportsExportView />}

          {currentTab === 'modellab' && (
            <ModelLabView
              models={models}
              activeModel={activeModel}
              onModelSwitched={(newM) => setActiveModel(newM)}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <AnalysisProvider>
      <AppContent />
    </AnalysisProvider>
  )
}

export default App

import React from 'react'
import { AnalysisProvider, useAnalysis } from './context/AnalysisContext'
import { NavigationTab } from './types'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { ClinicalOverviewView } from './components/ClinicalOverviewView'
import { PatientsView } from './components/PatientsView'
import { ECGWorklistView } from './components/ECGWorklistView'
import { ClinicalECGReviewView } from './components/ClinicalECGReviewView'
import { EncountersHistoryView } from './components/EncountersHistoryView'
import { ClinicalReportsView } from './components/ClinicalReportsView'
import { ResearchLabView } from './components/ResearchLabView'
import { SettingsView } from './components/SettingsView'

// Legacy / Direct access views
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
  clinical_overview: {
    title: 'Clinical Overview Dashboard',
    subtitle: 'Encounter Highlights, Pending Studies & Quick Actions',
  },
  worklist: {
    title: 'ECG Study Worklist',
    subtitle: '12-Lead Electrocardiograms Awaiting Clinical Review & Interpretation',
  },
  patients: {
    title: 'Patients Directory & Longitudinal Charts',
    subtitle: 'Patient Demographics, Clinical History & Associated ECG Encounters',
  },
  ecg_review: {
    title: 'Clinical ECG Review Workspace',
    subtitle: 'Interactive 12-Lead Viewer, Multilabel AI Findings & Structured Documentation',
  },
  encounters: {
    title: 'Encounters & History Studio',
    subtitle: 'Longitudinal ECG Comparison, Waveform Tracking & Model Delta Analysis',
  },
  reports: {
    title: 'Clinical Reports & Documentation',
    subtitle: 'Printable HTML/PDF Reports, JSON Summaries & Encounter Sign-Offs',
  },
  research_lab: {
    title: 'Research & Explainability Laboratory',
    subtitle: 'Integrated Gradients, Model Agreement, Faithfulness & Robustness Experiments',
  },
  settings: {
    title: 'System Settings & Clinical Governance',
    subtitle: 'Inference Architecture Selection, Privacy Protocols & Regulatory Disclosures',
  },

  // Legacy mappings
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
    setResearchSubTab,
    selectedStudy,
    openStudyForReview,
  } = useAnalysis()

  const tabMeta = TAB_TITLES[currentTab] || {
    title: 'ECG Intelligence',
    subtitle: 'Clinical Review & Documentation Assistant',
  }

  return (
    <div className="app-container">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        health={health}
      />

      <div className="app-main">
        <Header
          title={tabMeta.title}
          subtitle={tabMeta.subtitle}
          activeModel={activeModel}
          health={health}
          selectedStudy={selectedStudy}
          showReviewButton={currentTab !== 'ecg_review'}
          onOpenReview={() => setCurrentTab('ecg_review')}
        />

        <main className="page-container" style={{ padding: '24px 32px' }}>
          {/* Primary Clinical Navigation Views */}
          {currentTab === 'clinical_overview' && (
            <ClinicalOverviewView
              onNavigateToTab={(tab) => setCurrentTab(tab)}
              onRegisterPatient={() => setCurrentTab('patients')}
              onOpenStudy={(studyId, patientId) => openStudyForReview(studyId, patientId)}
            />
          )}

          {currentTab === 'worklist' && (
            <ECGWorklistView
              onOpenStudy={(studyId, patientId) => openStudyForReview(studyId, patientId)}
            />
          )}

          {currentTab === 'patients' && (
            <PatientsView
              onOpenStudyForReview={(studyId, patientId) => openStudyForReview(studyId, patientId)}
            />
          )}

          {currentTab === 'ecg_review' && (
            <ClinicalECGReviewView
              onNavigateToExplain={(cls) => {
                setSelectedClass(cls)
                setResearchSubTab('explainability')
                setCurrentTab('research_lab')
              }}
              onNavigateToReports={(studyId) => {
                setCurrentTab('reports')
              }}
            />
          )}

          {currentTab === 'encounters' && (
            <EncountersHistoryView
              onOpenStudyForReview={(studyId, patientId) => openStudyForReview(studyId, patientId)}
            />
          )}

          {currentTab === 'reports' && (
            <ClinicalReportsView initialStudyId={selectedStudy?.id} />
          )}

          {currentTab === 'research_lab' && <ResearchLabView />}

          {currentTab === 'settings' && <SettingsView />}

          {/* Backward compatibility direct tab renderings */}
          {currentTab === 'overview' && (
            <OverviewView
              metrics={metrics}
              health={health}
              onNavigateToAnalysis={() => setCurrentTab('ecg_review')}
              onNavigateToModelLab={() => {
                setResearchSubTab('modellab')
                setCurrentTab('research_lab')
              }}
            />
          )}

          {currentTab === 'analysis' && (
            <ClinicalECGReviewView
              onNavigateToExplain={(cls) => {
                setSelectedClass(cls)
                setResearchSubTab('explainability')
                setCurrentTab('research_lab')
              }}
              onNavigateToReports={() => setCurrentTab('reports')}
            />
          )}

          {currentTab === 'explainability' && <ExplainabilityView />}
          {currentTab === 'signal_explorer' && <SignalExplorerView />}
          {currentTab === 'model_comparison' && <ModelComparisonView />}
          {currentTab === 'faithfulness' && <FaithfulnessLabView />}
          {currentTab === 'robustness' && <RobustnessLabView />}
          {currentTab === 'research_analytics' && <ResearchAnalyticsView />}
          {currentTab === 'history' && <AnalysisHistoryView />}
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

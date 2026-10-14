import React, { useRef, useEffect } from 'react'
import { AnalysisProvider, useAnalysis } from './context/AnalysisContext'
import { NavigationTab } from './types'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { ClinicalOverviewView } from './components/ClinicalOverviewView'
import { ECGPredictionView } from './components/ECGPredictionView'
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
    title: 'Overview',
    subtitle: 'Studies awaiting review, patient encounters, and recent activity.',
  },
  ecg_prediction: {
    title: 'ECG Prediction',
    subtitle: 'Standalone 12-lead inference, model evaluation, and explainable results.',
  },
  worklist: {
    title: 'ECG Worklist',
    subtitle: '12-lead acquisitions awaiting clinical review or sign-off.',
  },
  patients: {
    title: 'Patients',
    subtitle: 'Patient records, clinical history, and attached ECG studies.',
  },
  ecg_review: {
    title: 'ECG Review',
    subtitle: '12-lead waveforms, AI analysis, and clinical documentation.',
  },
  encounters: {
    title: 'Encounters & History',
    subtitle: 'Longitudinal comparison and changes since previous ECG.',
  },
  reports: {
    title: 'Reports',
    subtitle: 'Printable medical reports and finalized encounter summaries.',
  },
  research_lab: {
    title: 'Research Lab',
    subtitle: 'Model benchmarks, explainability, and technical experiments.',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Model selection, system status, and configuration.',
  },

  // Compatibility mappings
  overview: {
    title: 'Overview',
    subtitle: 'Studies awaiting review, patient encounters, and recent activity.',
  },
  analysis: {
    title: 'AI Analysis',
    subtitle: '12-lead analysis and signal diagnostics.',
  },
  signal_explorer: {
    title: 'Signal Analysis',
    subtitle: '12-lead waveforms, STFT spectrogram, and morphology metrics.',
  },
  explainability: {
    title: 'Why this result?',
    subtitle: 'Important parts of the ECG and lead importance ranking.',
  },
  model_comparison: {
    title: 'Compare models',
    subtitle: 'Multi-model evaluation and agreement measures.',
  },
  faithfulness: {
    title: 'Explanation testing',
    subtitle: 'Deletion and insertion tests comparing attributions.',
  },
  robustness: {
    title: 'Robustness tests',
    subtitle: 'Controlled testing with noise, drift, and lead dropouts.',
  },
  research_analytics: {
    title: 'Model Performance',
    subtitle: 'Benchmark leaderboard and validation thresholds.',
  },
  history: {
    title: 'Analysis History',
    subtitle: 'Recorded analyses and report history.',
  },
  modellab: {
    title: 'Model Performance',
    subtitle: 'Model specifications and performance comparisons.',
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

  const mainRef = useRef<HTMLDivElement | null>(null)

  // Reset scroll position to top whenever navigating between pages
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0
    }
  }, [currentTab])

  return (
    <div className="app-container">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        health={health}
      />

      <div ref={mainRef} className="app-main">
        <Header
          title={tabMeta.title}
          subtitle={tabMeta.subtitle}
          activeModel={activeModel}
          health={health}
          selectedStudy={selectedStudy}
          showReviewButton={currentTab !== 'ecg_review'}
          onOpenReview={() => setCurrentTab('ecg_review')}
        />

        <main className="page-container" style={{ padding: '24px 32px 80px' }}>
          {/* Primary Clinical Navigation Views */}
          {currentTab === 'clinical_overview' && (
            <ClinicalOverviewView
              onNavigateToTab={(tab) => setCurrentTab(tab)}
              onRegisterPatient={() => setCurrentTab('patients')}
              onOpenStudy={(studyId, patientId) => openStudyForReview(studyId, patientId)}
            />
          )}

          {currentTab === 'ecg_prediction' && (
            <ECGPredictionView
              onOpenStudyForReview={(studyId, patientId) => openStudyForReview(studyId, patientId)}
              onNavigateToPatients={() => setCurrentTab('patients')}
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

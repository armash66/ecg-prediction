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

// Plain-language headings without buzzwords or marketing phrases
const TAB_TITLES: Record<NavigationTab, { title: string; subtitle: string }> = {
  overview: {
    title: 'Overview',
    subtitle: 'Studies awaiting review and recent clinical activity.',
  },
  clinical_overview: {
    title: 'Overview',
    subtitle: 'Studies awaiting review and recent clinical activity.',
  },
  worklist: {
    title: 'ECG Worklist',
    subtitle: 'Registered studies awaiting clinical review.',
  },
  patients: {
    title: 'Patients',
    subtitle: 'Patient records, clinical history, and attached ECG studies.',
  },
  ecg_review: {
    title: 'ECG Review',
    subtitle: '12-lead waveforms, AI analysis, and clinical documentation.',
  },
  reports: {
    title: 'Reports',
    subtitle: 'Printable medical reports and finalized encounter summaries.',
  },
  research: {
    title: 'Research',
    subtitle: 'Model benchmarks, explainability, and technical experiments.',
  },
  research_lab: {
    title: 'Research',
    subtitle: 'Model benchmarks, explainability, and technical experiments.',
  },
  settings: {
    title: 'Settings',
    subtitle: 'System status, model selection, and configuration.',
  },
  encounters: {
    title: 'Encounters',
    subtitle: 'Clinical encounters and past ECG history.',
  },
  // Legacy aliases
  analysis: { title: 'AI Analysis', subtitle: '12-lead analysis' },
  signal_explorer: { title: 'Signal Analysis', subtitle: 'Waveform and frequency analysis' },
  explainability: { title: 'Why this result?', subtitle: 'Attribution heatmaps' },
  model_comparison: { title: 'Compare models', subtitle: 'Model agreement' },
  faithfulness: { title: 'Explanation testing', subtitle: 'Testing model explanations' },
  robustness: { title: 'Robustness tests', subtitle: 'Signal perturbation testing' },
  research_analytics: { title: 'Model Performance', subtitle: 'Benchmark metrics' },
  history: { title: 'Analysis History', subtitle: 'Previous analyses' },
  modellab: { title: 'Model Performance', subtitle: 'Model comparison' },
}

const AppContent: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    activeModel,
    health,
    selectedStudy,
    openStudyForReview,
    setSelectedClass,
    setResearchSubTab,
  } = useAnalysis()

  const tabMeta = TAB_TITLES[currentTab] || {
    title: 'ECG Intelligence',
    subtitle: 'Review and documentation assistant',
  }

  return (
    <div className="app-layout">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        health={health}
      />

      <div className="main-wrapper">
        <Header
          title={tabMeta.title}
          subtitle={tabMeta.subtitle}
          activeModel={activeModel}
          health={health}
          selectedStudy={selectedStudy}
          onOpenReview={() => setCurrentTab('ecg_review')}
          showReviewButton={currentTab !== 'ecg_review' && !!selectedStudy}
        />

        <main className="page-container" style={{ padding: '20px 28px' }}>
          {/* Primary Clinical Navigation Views */}
          {(currentTab === 'overview' || currentTab === 'clinical_overview') && (
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

          {(currentTab === 'ecg_review' || currentTab === 'analysis') && (
            <ClinicalECGReviewView
              onNavigateToExplain={(cls) => {
                setSelectedClass(cls)
                setResearchSubTab('explainability')
                setCurrentTab('research')
              }}
              onNavigateToReports={() => {
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

          {(currentTab === 'research' ||
            currentTab === 'research_lab' ||
            currentTab === 'explainability' ||
            currentTab === 'signal_explorer' ||
            currentTab === 'model_comparison' ||
            currentTab === 'faithfulness' ||
            currentTab === 'robustness' ||
            currentTab === 'research_analytics' ||
            currentTab === 'modellab') && (
            <ResearchLabView />
          )}

          {currentTab === 'settings' && <SettingsView />}
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

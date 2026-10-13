import React, { useState, useEffect } from 'react'
import {
  fetchHealth,
  fetchModels,
  fetchMetrics,
  fetchSamples,
  fetchSampleDetail,
} from './api'
import {
  BackendHealth,
  ModelMetadata,
  MetricsResponse,
  PreloadedSampleSummary,
  DiagnosticClass,
} from './types'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { OverviewView } from './components/OverviewView'
import { ECGAnalysisView } from './components/ECGAnalysisView'
import { ModelLabView } from './components/ModelLabView'
import { ExplainabilityView } from './components/ExplainabilityView'

type TabType = 'overview' | 'analysis' | 'modellab' | 'explainability'

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType>('overview')
  const [activeModel, setActiveModel] = useState<string>('seq')
  const [health, setHealth] = useState<BackendHealth | null>(null)
  const [models, setModels] = useState<ModelMetadata[]>([])
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [samples, setSamples] = useState<PreloadedSampleSummary[]>([])
  const [sharedSignal, setSharedSignal] = useState<number[][] | null>(null)
  const [explainTargetClass, setExplainTargetClass] = useState<DiagnosticClass>('MI')

  // Poll backend health and initialize data
  useEffect(() => {
    const initData = async () => {
      try {
        const [h, mList, mets, samp] = await Promise.all([
          fetchHealth().catch(() => null),
          fetchModels().catch(() => ({ active_model: 'seq', models: [] })),
          fetchMetrics().catch(() => null),
          fetchSamples().catch(() => ({ total: 0, samples: [] })),
        ])

        if (h) {
          setHealth(h)
          setActiveModel(h.active_model)
        }
        if (mList?.models) {
          setModels(mList.models)
          if (mList.active_model) setActiveModel(mList.active_model)
        }
        if (mets) {
          setMetrics(mets)
        }
        if (samp?.samples) {
          setSamples(samp.samples)
        }

        // Load first test sample into shared signal for instant inspection
        const firstSample = await fetchSampleDetail(0).catch(() => null)
        if (firstSample?.signal) {
          setSharedSignal(firstSample.signal)
        }
      } catch (err) {
        console.error('Initialization notice:', err)
      }
    }

    initData()

    // Health poll every 10 seconds
    const interval = setInterval(async () => {
      try {
        const h = await fetchHealth()
        setHealth(h)
      } catch {
        setHealth((prev) => (prev ? { ...prev, status: 'offline' } : null))
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const tabTitles: Record<TabType, string> = {
    overview: 'Research Overview Dashboard',
    analysis: '12-Lead ECG Analysis Workspace',
    modellab: 'Comparative Model Laboratory',
    explainability: 'Explainability & Attribution Analysis',
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
          title={tabTitles[currentTab]}
          activeModel={activeModel}
          health={health}
          showAnalyzeButton={currentTab !== 'analysis'}
          onOpenAnalysis={() => setCurrentTab('analysis')}
        />

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
              if (cls) setExplainTargetClass(cls)
              setCurrentTab('explainability')
            }}
            onSignalChange={(sig) => setSharedSignal(sig)}
            currentSignalProp={sharedSignal}
          />
        )}

        {currentTab === 'modellab' && (
          <ModelLabView
            models={models}
            activeModel={activeModel}
            onModelSwitched={(newM) => setActiveModel(newM)}
          />
        )}

        {currentTab === 'explainability' && (
          <ExplainabilityView
            currentSignal={sharedSignal}
            activeModel={activeModel}
            samples={samples}
            targetClass={explainTargetClass}
            onSelectSample={async (idx) => {
              const res = await fetchSampleDetail(idx).catch(() => null)
              if (res?.signal) setSharedSignal(res.signal)
            }}
          />
        )}
      </div>
    </div>
  )
}

export default App

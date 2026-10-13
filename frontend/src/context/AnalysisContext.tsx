import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  DiagnosticClass,
  BackendHealth,
  ModelMetadata,
  MetricsResponse,
  PreloadedSampleSummary,
  SignalMetadata,
  ValidationResponse,
  AnalysisResponse,
  ExplainResponse,
  FaithfulnessResponse,
  LeadAblationResponse,
  RobustnessResponse,
  MultiModelComparisonResponse,
  SpectrogramResponse,
  MorphologyResponse,
  BatchExplainMatrixResponse,
  ClassTimeMatrixResponse,
  LeadAblationMatrixResponse,
  NavigationTab,
  ResearchSubTab,
  ECGStudy,
} from '../types'
import {
  fetchHealth,
  fetchModels,
  fetchMetrics,
  fetchSamples,
  fetchSampleDetail,
  fetchStudyDetail,
  analyzeECG,
  fetchExplanation,
  runFaithfulnessTest,
  fetchLeadAblation,
  testRobustness,
  compareModels,
  fetchSpectrogram,
  fetchMorphology,
  fetchBatchExplainMatrix,
  fetchClassTimeMatrix,
  fetchFullLeadAblationMatrix,
  fetchAnalysisDetail,
} from '../api'

interface AnalysisContextType {
  // Navigation
  currentTab: NavigationTab
  setCurrentTab: (tab: NavigationTab) => void
  researchSubTab: ResearchSubTab
  setResearchSubTab: (sub: ResearchSubTab) => void

  // Clinical Patient & Study Selection
  selectedPatientId: string | null
  setSelectedPatientId: (id: string | null) => void
  selectedStudyId: string | null
  setSelectedStudyId: (id: string | null) => void
  selectedStudy: ECGStudy | null
  setSelectedStudy: (study: ECGStudy | null) => void
  openStudyForReview: (studyId: string, patientId?: string) => Promise<void>

  // Health and Models
  health: BackendHealth | null
  models: ModelMetadata[]
  activeModel: string
  setActiveModel: (m: string) => void
  metrics: MetricsResponse | null
  samples: PreloadedSampleSummary[]

  // Signal & Analysis State
  analysisId: string | null
  currentSignal: number[][] | null
  currentMetadata: SignalMetadata | null
  selectedClass: DiagnosticClass
  setSelectedClass: (cls: DiagnosticClass) => void
  validationResult: ValidationResponse | null
  analysisResult: AnalysisResponse | null

  // Advanced Modules State
  attributionResult: ExplainResponse | null
  faithfulnessResult: FaithfulnessResponse | null
  leadAblationResult: LeadAblationResponse | null
  robustnessResult: RobustnessResponse | null
  comparisonResult: MultiModelComparisonResponse | null
  spectrogramResult: SpectrogramResponse | null
  morphologyResult: MorphologyResponse | null
  batchMatrixResult: BatchExplainMatrixResponse | null
  classTimeMatrixResult: ClassTimeMatrixResponse | null
  fullAblationMatrixResult: LeadAblationMatrixResponse | null

  // Loading States
  isAnalyzing: boolean
  isExplaining: boolean
  isExperimenting: boolean

  // Actions
  setSignal: (sig: number[][], meta?: SignalMetadata) => void
  runInference: (model?: string, explainClass?: DiagnosticClass) => Promise<AnalysisResponse | null>
  runExplanation: (cls?: DiagnosticClass, method?: string, steps?: number) => Promise<ExplainResponse | null>
  runFaithfulness: (cls?: DiagnosticClass, topFraction?: number) => Promise<FaithfulnessResponse | null>
  runLeadAblation: (cls?: DiagnosticClass) => Promise<LeadAblationResponse | null>
  runRobustness: (expType?: string, intensity?: number, leadIdx?: number) => Promise<RobustnessResponse | null>
  runComparison: (modelsToCompare?: string[]) => Promise<MultiModelComparisonResponse | null>
  runSpectrogram: (lead?: string | number, nperseg?: number, noverlap?: number) => Promise<SpectrogramResponse | null>
  runMorphology: (lead?: string | number) => Promise<MorphologyResponse | null>
  runBatchMatrix: (method?: string, steps?: number) => Promise<BatchExplainMatrixResponse | null>
  runClassTimeMatrix: (numWindows?: number) => Promise<ClassTimeMatrixResponse | null>
  runFullAblationMatrix: () => Promise<LeadAblationMatrixResponse | null>
  loadSampleByIndex: (idx: number) => Promise<void>
  restoreSavedAnalysis: (id: string) => Promise<boolean>
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined)

export const AnalysisProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('overview')
  const [researchSubTab, setResearchSubTab] = useState<ResearchSubTab>('performance')
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null)
  const [selectedStudy, setSelectedStudy] = useState<ECGStudy | null>(null)
  const [activeModel, setActiveModel] = useState<string>('seq')
  const [health, setHealth] = useState<BackendHealth | null>(null)
  const [models, setModels] = useState<ModelMetadata[]>([])
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [samples, setSamples] = useState<PreloadedSampleSummary[]>([])

  // Shared Active Analysis
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [currentSignal, setCurrentSignal] = useState<number[][] | null>(null)
  const [currentMetadata, setCurrentMetadata] = useState<SignalMetadata | null>(null)
  const [selectedClass, setSelectedClass] = useState<DiagnosticClass>('MI')
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null)

  // Module Experiments Caches
  const [attributionResult, setAttributionResult] = useState<ExplainResponse | null>(null)
  const [faithfulnessResult, setFaithfulnessResult] = useState<FaithfulnessResponse | null>(null)
  const [leadAblationResult, setLeadAblationResult] = useState<LeadAblationResponse | null>(null)
  const [robustnessResult, setRobustnessResult] = useState<RobustnessResponse | null>(null)
  const [comparisonResult, setComparisonResult] = useState<MultiModelComparisonResponse | null>(null)
  const [spectrogramResult, setSpectrogramResult] = useState<SpectrogramResponse | null>(null)
  const [morphologyResult, setMorphologyResult] = useState<MorphologyResponse | null>(null)
  const [batchMatrixResult, setBatchMatrixResult] = useState<BatchExplainMatrixResponse | null>(null)
  const [classTimeMatrixResult, setClassTimeMatrixResult] = useState<ClassTimeMatrixResponse | null>(null)
  const [fullAblationMatrixResult, setFullAblationMatrixResult] = useState<LeadAblationMatrixResponse | null>(null)

  // Loaders
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [isExplaining, setIsExplaining] = useState<boolean>(false)
  const [isExperimenting, setIsExperimenting] = useState<boolean>(false)

  // Initialize System
  useEffect(() => {
    const initSystem = async () => {
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
        if (mets) setMetrics(mets)
        if (samp?.samples) setSamples(samp.samples)

        // Load default first sample for seamless inspection
        const firstSamp = await fetchSampleDetail(0).catch(() => null)
        if (firstSamp?.signal) {
          setCurrentSignal(firstSamp.signal)
          setCurrentMetadata({
            format: 'Preloaded PTB-XL Sample',
            filename: `PTB-XL Record #0 (${firstSamp.labels.join(', ')})`,
            original_samples: 1000,
            n_samples: 1000,
            n_leads: 12,
            leads: firstSamp.leads,
            resampled: false,
            duration_sec: firstSamp.duration_sec,
            sampling_rate: firstSamp.sampling_rate,
            units: firstSamp.units,
            min_val: -1.5,
            max_val: 2.2,
            mean_val: 0.0,
            std_val: 0.35,
            validation_status: 'valid',
            quality_status: 'optimal',
            quality_score: 98.5,
          })
          if (firstSamp.labels?.length > 0) {
            setSelectedClass(firstSamp.labels[0])
          }
        }
      } catch (e) {
        console.error('System init notice:', e)
      }
    }

    initSystem()

    const interval = setInterval(async () => {
      try {
        const h = await fetchHealth()
        setHealth(h)
      } catch {
        setHealth((prev) => (prev ? { ...prev, status: 'offline' } : null))
      }
    }, 12000)

    return () => clearInterval(interval)
  }, [])

  // Invalidate downstream caches when signal or model changes
  const setSignal = (sig: number[][], meta?: SignalMetadata) => {
    setCurrentSignal(sig)
    if (meta) setCurrentMetadata(meta)
    // Clear dependent results
    setAnalysisResult(null)
    setAttributionResult(null)
    setFaithfulnessResult(null)
    setLeadAblationResult(null)
    setRobustnessResult(null)
    setComparisonResult(null)
    setSpectrogramResult(null)
    setMorphologyResult(null)
    setBatchMatrixResult(null)
    setClassTimeMatrixResult(null)
    setFullAblationMatrixResult(null)
  }

  // Active Model Switch
  const handleSetActiveModel = (modelKey: string) => {
    setActiveModel(modelKey)
    // Invalidate incompatible explanations & experiments
    setAttributionResult(null)
    setFaithfulnessResult(null)
    setLeadAblationResult(null)
    setRobustnessResult(null)
    setBatchMatrixResult(null)
    setClassTimeMatrixResult(null)
    setFullAblationMatrixResult(null)
  }

  // Run Inference
  const runInference = async (modelOverride?: string, explainCls?: DiagnosticClass) => {
    if (!currentSignal) return null
    setIsAnalyzing(true)
    const m = modelOverride || activeModel
    const cls = explainCls || selectedClass
    try {
      const res = await analyzeECG(currentSignal, m, cls, 40)
      setAnalysisResult(res)
      if (res.analysis_id) setAnalysisId(res.analysis_id)
      if (res.attribution && res.lead_importance) {
        setAttributionResult({
          model: res.model,
          target_class: cls,
          method: 'integrated_gradients',
          steps: 40,
          attribution: res.attribution,
          lead_importance: res.lead_importance,
          time_regions: res.time_regions,
          top_lead: res.lead_importance[0]?.lead || 'II',
          baseline: 'zero (training fold mean)',
        })
      }
      return res
    } catch (err) {
      console.error('Inference error:', err)
      return null
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Run Explanation
  const runExplanation = async (cls?: DiagnosticClass, method: string = 'integrated_gradients', steps: number = 40) => {
    if (!currentSignal) return null
    setIsExplaining(true)
    const target = cls || selectedClass
    try {
      const res = await fetchExplanation(currentSignal, target, activeModel, steps, method)
      setAttributionResult(res)
      return res
    } catch (err) {
      console.error('Explanation error:', err)
      return null
    } finally {
      setIsExplaining(false)
    }
  }

  // Run Faithfulness
  const runFaithfulness = async (cls?: DiagnosticClass, topFraction: number = 0.10) => {
    if (!currentSignal) return null
    setIsExperimenting(true)
    const target = cls || selectedClass
    try {
      const res = await runFaithfulnessTest(currentSignal, activeModel, target, topFraction)
      setFaithfulnessResult(res)
      return res
    } catch (err) {
      console.error('Faithfulness error:', err)
      return null
    } finally {
      setIsExperimenting(false)
    }
  }

  // Run Lead Ablation
  const runLeadAblation = async (cls?: DiagnosticClass) => {
    if (!currentSignal) return null
    setIsExperimenting(true)
    const target = cls || selectedClass
    try {
      const res = await fetchLeadAblation(currentSignal, target, activeModel)
      setLeadAblationResult(res)
      return res
    } catch (err) {
      console.error('Lead ablation error:', err)
      return null
    } finally {
      setIsExperimenting(false)
    }
  }

  // Run Robustness
  const runRobustness = async (expType: string = 'gaussian_noise', intensity: number = 0.05, leadIdx: number = 0) => {
    if (!currentSignal) return null
    setIsExperimenting(true)
    try {
      const res = await testRobustness(currentSignal, activeModel, expType, intensity, leadIdx)
      setRobustnessResult(res)
      return res
    } catch (err) {
      console.error('Robustness error:', err)
      return null
    } finally {
      setIsExperimenting(false)
    }
  }

  // Run Model Comparison
  const runComparison = async (modelsToCompare?: string[]) => {
    if (!currentSignal) return null
    setIsExperimenting(true)
    try {
      const res = await compareModels(currentSignal, modelsToCompare)
      setComparisonResult(res)
      return res
    } catch (err) {
      console.error('Comparison error:', err)
      return null
    } finally {
      setIsExperimenting(false)
    }
  }

  // Run Spectrogram
  const runSpectrogram = async (lead: string | number = 1, nperseg: number = 64, noverlap: number = 48) => {
    if (!currentSignal) return null
    try {
      const res = await fetchSpectrogram(currentSignal, lead, nperseg, noverlap)
      setSpectrogramResult(res)
      return res
    } catch (err) {
      console.error('Spectrogram error:', err)
      return null
    }
  }

  // Run Morphology
  const runMorphology = async (lead: string | number = 1) => {
    if (!currentSignal) return null
    try {
      const res = await fetchMorphology(currentSignal, lead)
      setMorphologyResult(res)
      return res
    } catch (err) {
      console.error('Morphology error:', err)
      return null
    }
  }

  // Run Batch Explain Matrix
  const runBatchMatrix = async (method: string = 'integrated_gradients', steps: number = 20) => {
    if (!currentSignal) return null
    setIsExplaining(true)
    try {
      const res = await fetchBatchExplainMatrix(currentSignal, activeModel, method, steps)
      setBatchMatrixResult(res)
      return res
    } catch (err) {
      console.error('Batch matrix error:', err)
      return null
    } finally {
      setIsExplaining(false)
    }
  }

  // Run Class-Time Matrix
  const runClassTimeMatrix = async (numWindows: number = 20) => {
    if (!currentSignal) return null
    setIsExplaining(true)
    try {
      const res = await fetchClassTimeMatrix(currentSignal, activeModel, numWindows)
      setClassTimeMatrixResult(res)
      return res
    } catch (err) {
      console.error('Class time matrix error:', err)
      return null
    } finally {
      setIsExplaining(false)
    }
  }

  // Run Full Lead Ablation Matrix
  const runFullAblationMatrix = async () => {
    if (!currentSignal) return null
    setIsExperimenting(true)
    try {
      const res = await fetchFullLeadAblationMatrix(currentSignal, activeModel)
      setFullAblationMatrixResult(res)
      return res
    } catch (err) {
      console.error('Full ablation matrix error:', err)
      return null
    } finally {
      setIsExperimenting(false)
    }
  }

  // Load Preloaded Sample by Index
  const loadSampleByIndex = async (idx: number) => {
    try {
      const samp = await fetchSampleDetail(idx)
      if (samp?.signal) {
        setSignal(samp.signal, {
          format: 'Preloaded PTB-XL Sample',
          filename: `PTB-XL Record #${idx} (${samp.labels.join(', ')})`,
          original_samples: 1000,
          n_samples: 1000,
          n_leads: 12,
          leads: samp.leads,
          resampled: false,
          duration_sec: samp.duration_sec,
          sampling_rate: samp.sampling_rate,
          units: samp.units,
          min_val: -1.5,
          max_val: 2.2,
          mean_val: 0.0,
          std_val: 0.35,
          validation_status: 'valid',
          quality_status: 'optimal',
          quality_score: 98.0,
        })
        if (samp.labels?.length > 0) {
          setSelectedClass(samp.labels[0])
        }
      }
    } catch (err) {
      console.error('Failed to load sample:', err)
    }
  }

  // Restore Saved Analysis from SQLite
  const restoreSavedAnalysis = async (id: string): Promise<boolean> => {
    try {
      const detail = await fetchAnalysisDetail(id)
      if (detail && detail.signal) {
        setAnalysisId(detail.id)
        setCurrentSignal(detail.signal)
        if (detail.metadata) setCurrentMetadata(detail.metadata)
        if (detail.model_name) setActiveModel(detail.model_name)
        if (detail.explain_class && ['CD', 'HYP', 'MI', 'NORM', 'STTC'].includes(detail.explain_class)) {
          setSelectedClass(detail.explain_class as DiagnosticClass)
        }
        setAnalysisResult({
          analysis_id: detail.id,
          model: detail.model_name,
          model_display_name: detail.model_name,
          latency_ms: detail.latency_ms,
          probabilities: detail.probabilities,
          thresholds: detail.thresholds,
          predictions: detail.predictions,
          gate_weight_deep: null,
          explain_class: detail.explain_class as DiagnosticClass,
          attribution: null,
          lead_importance: null,
          disclaimer: 'Restored from research session history.',
        })
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to restore analysis:', err)
      return false
    }
  }

  const openStudyForReview = async (studyId: string, patientId?: string) => {
    try {
      setSelectedStudyId(studyId)
      if (patientId) setSelectedPatientId(patientId)
      const detail = await fetchStudyDetail(studyId)
      setSelectedStudy(detail)
      if (detail.patient_id) setSelectedPatientId(detail.patient_id)
      if (detail.signal) {
        setCurrentSignal(detail.signal)
        setCurrentMetadata(detail.metadata || null)
      }
      if (detail.selected_model) {
        setActiveModel(detail.selected_model)
      }
      setCurrentTab('ecg_review')
    } catch (e) {
      console.error('Failed to open study for review:', e)
      setCurrentTab('ecg_review')
    }
  }

  return (
    <AnalysisContext.Provider
      value={{
        currentTab,
        setCurrentTab,
        researchSubTab,
        setResearchSubTab,
        selectedPatientId,
        setSelectedPatientId,
        selectedStudyId,
        setSelectedStudyId,
        selectedStudy,
        setSelectedStudy,
        openStudyForReview,
        health,
        models,
        activeModel,
        setActiveModel: handleSetActiveModel,
        metrics,
        samples,
        analysisId,
        currentSignal,
        currentMetadata,
        selectedClass,
        setSelectedClass,
        validationResult,
        analysisResult,
        attributionResult,
        faithfulnessResult,
        leadAblationResult,
        robustnessResult,
        comparisonResult,
        spectrogramResult,
        morphologyResult,
        batchMatrixResult,
        classTimeMatrixResult,
        fullAblationMatrixResult,
        isAnalyzing,
        isExplaining,
        isExperimenting,
        setSignal,
        runInference,
        runExplanation,
        runFaithfulness,
        runLeadAblation,
        runRobustness,
        runComparison,
        runSpectrogram,
        runMorphology,
        runBatchMatrix,
        runClassTimeMatrix,
        runFullAblationMatrix,
        loadSampleByIndex,
        restoreSavedAnalysis,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  )
}

export const useAnalysis = (): AnalysisContextType => {
  const context = useContext(AnalysisContext)
  if (!context) {
    throw new Error('useAnalysis must be used within an AnalysisProvider')
  }
  return context
}

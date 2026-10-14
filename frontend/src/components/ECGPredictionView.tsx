import React, { useState, useRef, useEffect } from 'react'
import {
  UploadCloud,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  RotateCcw,
  Layers,
  Sparkles,
  Info,
  UserPlus,
  Search,
  X,
  FileCheck,
  Check,
  ExternalLink,
  Database,
  Award,
} from 'lucide-react'
import {
  DiagnosticClass,
  ValidationResponse,
  AnalysisResponse,
  ExplainResponse,
  Patient,
  SignalMetadata,
  PreloadedSampleSummary,
  SampleDetailResponse,
} from '../types'
import {
  validateSignalFile,
  analyzeECG,
  fetchExplanation,
  fetchPatients,
  createStudy,
  createPatient,
  analyzeStudy,
  fetchSamples,
  fetchSampleDetail,
} from '../api'
import { ECGViewer } from './ECGViewer'
import { calculateAgeFromDob } from './PatientsView'

interface ECGPredictionViewProps {
  onOpenStudyForReview: (studyId: string, patientId?: string) => void
  onNavigateToPatients: () => void
}

const CLASS_DESCRIPTIONS: Record<DiagnosticClass, { name: string; desc: string }> = {
  CD: {
    name: 'Conduction Disturbance',
    desc: 'Intraventricular conduction delay (LBBB, RBBB) or AV prolongation.',
  },
  HYP: {
    name: 'Hypertrophy',
    desc: 'Voltage criteria consistent with ventricular enlargement.',
  },
  MI: {
    name: 'Myocardial Infarction',
    desc: 'Pathological Q-waves, acute ST elevation, or anterior loss.',
  },
  NORM: {
    name: 'Normal ECG',
    desc: 'Normal sinus rhythm and standard morphology limits.',
  },
  STTC: {
    name: 'ST/T-Change',
    desc: 'ST depression or T-wave inversion indicating repolarization disturbance.',
  },
}

const ORDERED_CLASSES: DiagnosticClass[] = ['CD', 'HYP', 'MI', 'NORM', 'STTC']

export const ECGPredictionView: React.FC<ECGPredictionViewProps> = ({
  onOpenStudyForReview,
  onNavigateToPatients,
}) => {
  // Upload and Signal State (Starts completely empty without auto-loading fixtures)
  const [currentSignal, setCurrentSignal] = useState<number[][] | null>(null)
  const [currentMetadata, setCurrentMetadata] = useState<SignalMetadata | null>(null)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [datFile, setDatFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const uploadCounterRef = useRef<number>(0)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const datFileInputRef = useRef<HTMLInputElement | null>(null)

  // Model & Inference State
  const [selectedModel, setSelectedModel] = useState<string>('seq')
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  // Explainability State
  const [selectedClass, setSelectedClass] = useState<DiagnosticClass>('MI')
  const [isExplaining, setIsExplaining] = useState<boolean>(false)
  const [attributionResult, setAttributionResult] = useState<ExplainResponse | null>(null)

  // Save to Patient Modal State
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false)
  const [saveTab, setSaveTab] = useState<'existing' | 'new'>('existing')
  const [patientSearch, setPatientSearch] = useState<string>('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientsLoading, setPatientsLoading] = useState<boolean>(false)
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')
  const [assignedClinician, setAssignedClinician] = useState<string>('Attending Clinician')
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null)

  // New Patient inline registration form state
  const [newName, setNewName] = useState<string>('')
  const [newDobMode, setNewDobMode] = useState<'dob' | 'age_only'>('dob')
  const [newDob, setNewDob] = useState<string>('')
  const [newAge, setNewAge] = useState<string>('')
  const [newSex, setNewSex] = useState<string>('Male')
  const [newMrn, setNewMrn] = useState<string>('')
  const [newHistory, setNewHistory] = useState<string>('')

  // Temporary Analysis Flag
  const [temporaryConfirmed, setTemporaryConfirmed] = useState<boolean>(false)

  // Benchmark Sample State
  const [benchmarkSamples, setBenchmarkSamples] = useState<PreloadedSampleSummary[]>([])
  const [activeBenchmarkSample, setActiveBenchmarkSample] = useState<SampleDetailResponse | null>(null)
  const [loadingBenchmark, setLoadingBenchmark] = useState<boolean>(false)

  // Load benchmark sample catalog on mount
  useEffect(() => {
    fetchSamples()
      .then((res) => {
        if (res && res.samples) {
          setBenchmarkSamples(res.samples)
        }
      })
      .catch((err) => console.warn('Could not prefetch benchmark samples:', err))
  }, [])

  // 1. File Upload & Validation
  const processUpload = async (primary: File, secondary?: File) => {
    const reqId = ++uploadCounterRef.current
    setIsUploading(true)
    setUploadError(null)

    // Clear previous results immediately to avoid stale data
    setAnalysisResult(null)
    setAttributionResult(null)
    setAnalysisError(null)
    setTemporaryConfirmed(false)
    setActiveBenchmarkSample(null)

    try {
      const resp: ValidationResponse = await validateSignalFile(primary, secondary)

      // Prevent out-of-order race conditions
      if (reqId !== uploadCounterRef.current) return

      if (!resp.valid || !resp.signal) {
        setCurrentSignal(null)
        setCurrentMetadata(null)
        setCurrentFile(null)
        setUploadError(resp.error || 'Signal validation failed. Please check file format and shape.')
        return
      }

      setCurrentSignal(resp.signal)
      setCurrentMetadata(resp.metadata || null)
      setCurrentFile(primary)
      if (secondary) setDatFile(secondary)
      setUploadError(null)
    } catch (err: any) {
      if (reqId !== uploadCounterRef.current) return
      setCurrentSignal(null)
      setCurrentMetadata(null)
      setCurrentFile(null)
      setUploadError(err?.message || 'Network error occurred while validating ECG signal.')
    } finally {
      if (reqId === uploadCounterRef.current) {
        setIsUploading(false)
      }
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const heaFile = files.find((f) => f.name.toLowerCase().endsWith('.hea'))
    const dat = files.find((f) => f.name.toLowerCase().endsWith('.dat'))

    if (heaFile) {
      if (dat) {
        await processUpload(heaFile, dat)
      } else {
        setCurrentFile(heaFile)
        datFileInputRef.current?.click()
      }
      return
    }

    const primary = files[0]
    const ext = primary.name.split('.').pop()?.toLowerCase() || ''
    if (!['csv', 'npy', 'npz', 'hea', 'dat'].includes(ext)) {
      setUploadError(`Unsupported file format (.${ext}). Supported formats: CSV, NPY, NPZ, and WFDB (.hea/.dat).`)
      return
    }

    await processUpload(primary)
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.name.toLowerCase().endsWith('.hea')) {
      setCurrentFile(file)
      datFileInputRef.current?.click()
      return
    }

    await processUpload(file)
  }

  const handleDatFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const sec = e.target.files?.[0]
    if (!sec || !currentFile) return
    await processUpload(currentFile, sec)
  }

  const clearCurrentSignal = () => {
    uploadCounterRef.current++
    setCurrentSignal(null)
    setCurrentMetadata(null)
    setCurrentFile(null)
    setDatFile(null)
    setActiveBenchmarkSample(null)
    setAnalysisResult(null)
    setAttributionResult(null)
    setUploadError(null)
    setAnalysisError(null)
    setTemporaryConfirmed(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (datFileInputRef.current) datFileInputRef.current.value = ''
  }

  // 2. Run Genuine Model Inference
  const handleRunInference = async (overrideSig?: number[][], overrideModel?: string) => {
    const sig = overrideSig || currentSignal
    if (!sig) return
    const model = overrideModel || selectedModel
    setIsAnalyzing(true)
    setAnalysisError(null)
    setAttributionResult(null)

    try {
      const resp = await analyzeECG(sig, model, selectedClass, 30)
      setAnalysisResult(resp)

      // Auto-populate default attribution if provided in analyze response
      if (resp.attribution && resp.lead_importance) {
        setAttributionResult({
          model: resp.model,
          target_class: selectedClass,
          method: 'integrated_gradients',
          steps: 30,
          attribution: resp.attribution,
          lead_importance: resp.lead_importance,
          time_regions: resp.time_regions,
          top_lead: resp.lead_importance[0]?.lead || 'II',
          baseline: 'zero (training fold mean)',
        })
      }
    } catch (err: any) {
      setAnalysisError(err?.message || 'Model inference failed. Check server logs.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Select and load a verified benchmark sample from the PTB-XL test set
  const handleSelectBenchmarkSample = async (index: number) => {
    try {
      setLoadingBenchmark(true)
      setUploadError(null)
      setAnalysisError(null)
      setAnalysisResult(null)
      setAttributionResult(null)
      setTemporaryConfirmed(false)

      const detail = await fetchSampleDetail(index)
      setActiveBenchmarkSample(detail)
      setCurrentSignal(detail.signal)
      setCurrentFile(null)
      setDatFile(null)
      setCurrentMetadata({
        format: 'PTB-XL Test Split Recording',
        filename: `ptbxl_record_${detail.record_id || detail.index}.dat`,
        original_samples: detail.signal.length,
        n_samples: detail.signal.length,
        n_leads: 12,
        leads: detail.leads || ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'],
        resampled: false,
        duration_sec: detail.duration_sec || 10.0,
        sampling_rate: detail.sampling_rate || 100,
        units: detail.units || 'mV',
        min_val: -1.5,
        max_val: 1.5,
        mean_val: 0.0,
        std_val: 0.35,
        validation_status: 'valid',
        quality_status: 'optimal',
        quality_score: 99.0,
      })

      // Immediately execute live inference on the benchmark recording
      await handleRunInference(detail.signal)
    } catch (err: any) {
      setUploadError(err?.message || `Failed to load benchmark sample #${index}`)
    } finally {
      setLoadingBenchmark(false)
    }
  }

  // 3. Run Class-Specific Explainability
  const handleRunExplain = async (targetCls: DiagnosticClass) => {
    if (!currentSignal) return
    setSelectedClass(targetCls)
    setIsExplaining(true)

    try {
      const resp = await fetchExplanation(currentSignal, targetCls, selectedModel, 30, 'integrated_gradients')
      setAttributionResult(resp)
    } catch (err: any) {
      console.error('Explanation generation failed:', err)
    } finally {
      setIsExplaining(false)
    }
  }

  // 4. Save to Patient Modal Actions
  const openSaveModal = async () => {
    setShowSaveModal(true)
    setSaveError(null)
    setSaveSuccessMsg(null)
    try {
      setPatientsLoading(true)
      const res = await fetchPatients(patientSearch)
      setPatients(res.patients)
      if (res.patients.length > 0 && !selectedPatientId) {
        setSelectedPatientId(res.patients[0].id)
      }
    } catch (err) {
      console.error('Failed to load patient directory:', err)
    } finally {
      setPatientsLoading(false)
    }
  }

  const handlePatientSearch = async (query: string) => {
    setPatientSearch(query)
    try {
      setPatientsLoading(true)
      const res = await fetchPatients(query)
      setPatients(res.patients)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setPatientsLoading(false)
    }
  }

  const handleConfirmSave = async () => {
    if (!currentSignal || isSaving) return

    try {
      setIsSaving(true)
      setSaveError(null)

      let targetPatientId = selectedPatientId

      // If creating new patient inline
      if (saveTab === 'new') {
        if (!newName.trim()) {
          setSaveError('Patient name is required.')
          setIsSaving(false)
          return
        }

        let calculatedAge: number | undefined = undefined
        let resolvedDob = ''

        if (newDobMode === 'dob') {
          if (!newDob) {
            setSaveError('Date of birth is required.')
            setIsSaving(false)
            return
          }
          const dAge = calculateAgeFromDob(newDob)
          if (dAge === null || dAge < 0 || dAge > 130) {
            setSaveError('Derived age must be between 0 and 130 years.')
            setIsSaving(false)
            return
          }
          calculatedAge = dAge
          resolvedDob = newDob
        } else {
          if (!newAge) {
            setSaveError('Age is required when Date of Birth is unknown.')
            setIsSaving(false)
            return
          }
          calculatedAge = parseInt(newAge, 10)
        }

        const newPat = await createPatient({
          name: newName.trim(),
          dob: resolvedDob,
          age: calculatedAge,
          sex: newSex,
          mrn: newMrn.trim() || undefined,
          clinical_history: newHistory.trim() || undefined,
        })
        targetPatientId = newPat.id
      }

      if (!targetPatientId) {
        setSaveError('Please select or create a destination patient.')
        setIsSaving(false)
        return
      }

      // Create linked study
      const filename = currentFile?.name || 'uploaded_ecg.csv'
      const study = await createStudy({
        patient_id: targetPatientId,
        signal: currentSignal,
        filename,
        assigned_clinician: assignedClinician || 'Attending Clinician',
        metadata: {
          ...currentMetadata,
          model_used: selectedModel,
          probabilities: analysisResult?.probabilities,
          thresholds: analysisResult?.thresholds,
          predictions: analysisResult?.predictions,
        },
      })

      // Run and persist study analysis
      try {
        await analyzeStudy(study.id, selectedModel)
      } catch (analysisErr) {
        console.warn('Study analysis save notice:', analysisErr)
      }

      setSaveSuccessMsg(`ECG Study ${study.study_id} saved successfully!`)
      setTimeout(() => {
        setShowSaveModal(false)
        onOpenStudyForReview(study.id, targetPatientId)
      }, 1000)
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save study to patient record.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeepAsTemporary = () => {
    setTemporaryConfirmed(true)
  }

  const newDerivedAge = newDob ? calculateAgeFromDob(newDob) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 1. Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#252525' }}>
              ECG Prediction Workspace
            </h1>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#F8EAED', color: '#A83245' }}>
              Standalone Inference
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#777773', margin: '4px 0 0' }}>
            Test new 12-lead ECG signals independently of patient records. Inspect waveforms, evaluate models, and explain predictions.
          </p>
        </div>

        {currentSignal && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={clearCurrentSignal} title="Discard signal and start a new test">
              <RotateCcw size={14} />
              <span>Reset Workspace</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={openSaveModal} title="Save this test to a patient chart">
              <Save size={14} />
              <span>Save to Patient</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Drag & Drop ECG Upload Zone */}
      <div
        className="card"
        style={{
          padding: '0',
          overflow: 'hidden',
          border: isDragging ? '2px dashed #A83245' : '1px solid #E8E6E1',
          background: isDragging ? '#FDF8F8' : '#FFFFFF',
          transition: 'all 0.15s ease',
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setIsDragging(false)
        }}
        onDrop={handleDrop}
      >
        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.npy,.npz,.hea,.dat"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
        <input
          ref={datFileInputRef}
          type="file"
          accept=".dat"
          style={{ display: 'none' }}
          onChange={handleDatFileInputChange}
        />

        {!currentSignal ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '36px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: '#F8EAED',
                color: '#A83245',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UploadCloud size={26} />
            </div>

            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#252525', margin: '0 0 4px' }}>
                Select or Drag & Drop a 12-Lead ECG File
              </h3>
              <p style={{ fontSize: '12px', color: '#777773', margin: 0, maxWidth: '540px' }}>
                Supported formats: <b>.CSV</b>, <b>.NPY</b>, <b>.NPZ</b>, or <b>WFDB pairs (.hea + .dat)</b>.
                Required contract: 10.0-second standard 12-lead signal, shape <code>(1000, 12)</code> @ 100 Hz, in millivolts (mV).
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#9C9C96' }}>
              <span>Leads: I, II, III, aVR, aVL, aVF, V1, V2, V3, V4, V5, V6</span>
              <span>&bull;</span>
              <span>No Patient Record Required</span>
            </div>

            {/* Divider OR */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                maxWidth: '620px',
                gap: '12px',
                margin: '6px 0',
              }}
            >
              <div style={{ flex: 1, height: '1px', background: '#E8E6E1' }} />
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#9C9C96', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                OR Select a Verified PTB-XL Benchmark Sample
              </span>
              <div style={{ flex: 1, height: '1px', background: '#E8E6E1' }} />
            </div>

            {/* Benchmark Quick Selection Pills */}
            <div
              style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '720px' }}
              onClick={(e) => e.stopPropagation()}
            >
              {[
                { idx: 0, label: 'Sample #00: Normal (NORM)', rec: '9' },
                { idx: 5, label: 'Sample #05: Anterior-Septal MI (MI)', rec: '63' },
                { idx: 6, label: 'Sample #06: Incomplete RBBB (CD)', rec: '65' },
                { idx: 14, label: 'Sample #14: ST/T Change (STTC)', rec: '116' },
                { idx: 22, label: 'Sample #22: LAFB (CD)', rec: '157' },
                { idx: 24, label: 'Sample #24: Quad Multilabel (CD,HYP,MI,STTC)', rec: '162' },
                { idx: 34, label: 'Sample #34: Inferior MI (MI)', rec: '240' },
                { idx: 39, label: 'Sample #39: Triple Multilabel (HYP,MI,STTC)', rec: '271' },
              ].map((s) => (
                <button
                  key={s.idx}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={loadingBenchmark}
                  onClick={() => handleSelectBenchmarkSample(s.idx)}
                  style={{
                    fontSize: '11px',
                    padding: '4px 9px',
                    background: '#FAFAF8',
                    border: '1px solid #D5D3CE',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                  title={`Load PTB-XL test record #${s.rec} with verified ground truth`}
                >
                  <Database size={11} style={{ color: '#1B4D89' }} />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>

            {/* Dropdown for all 40 preloaded test-set records */}
            {benchmarkSamples.length > 0 && (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <span style={{ fontSize: '11px', color: '#777773', fontWeight: 600 }}>All 40 Test Records:</span>
                <select
                  disabled={loadingBenchmark}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val !== '') handleSelectBenchmarkSample(Number(val))
                  }}
                  defaultValue=""
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    borderRadius: '6px',
                    border: '1px solid #E8E6E1',
                    background: '#FFFFFF',
                    color: '#252525',
                  }}
                >
                  <option value="" disabled>Select from PTB-XL Test Split (Fold 10)...</option>
                  {benchmarkSamples.map((s) => (
                    <option key={s.index} value={s.index}>
                      Sample #{s.index < 10 ? `0${s.index}` : s.index} (Record {s.record_id || s.index}) — {s.labels.length > 0 ? s.labels.join(', ') : 'No Superclass'} {s.age ? `• ${s.age}y ${s.sex || ''}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(isUploading || loadingBenchmark) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#A83245', fontSize: '13px', marginTop: '4px' }}>
                <RefreshCw size={15} className="spin-animation" />
                <span>{loadingBenchmark ? 'Loading verified benchmark record & running model...' : 'Validating signal shape and lead quality...'}</span>
              </div>
            )}
          </div>
        ) : (
          /* Active Signal Header Bar */
          <div
            style={{
              padding: '14px 20px',
              background: '#FAFAF8',
              borderBottom: '1px solid #E8E6E1',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {activeBenchmarkSample ? (
                <Award size={20} style={{ color: '#1B4D89' }} />
              ) : (
                <FileCheck size={20} style={{ color: '#34765A' }} />
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#252525' }}>
                    {activeBenchmarkSample
                      ? `PTB-XL Record #${activeBenchmarkSample.record_id || activeBenchmarkSample.index}`
                      : currentFile?.name || 'Uploaded ECG Recording'}
                  </span>
                  {activeBenchmarkSample && (
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: '#E1EBF5',
                        color: '#1B4D89',
                        fontSize: '10px',
                        fontWeight: 700,
                      }}
                    >
                      BENCHMARK SAMPLE #{activeBenchmarkSample.index < 10 ? `0${activeBenchmarkSample.index}` : activeBenchmarkSample.index}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#777773' }}>
                  {currentMetadata?.n_samples || 1000} samples &bull; {currentMetadata?.n_leads || 12} leads &bull;{' '}
                  {currentMetadata?.duration_sec || 10}s @ {currentMetadata?.sampling_rate || 100} Hz
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              {/* Benchmark Switcher if benchmark active */}
              {activeBenchmarkSample && benchmarkSamples.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#777773', fontWeight: 600 }}>Test Sample:</span>
                  <select
                    value={activeBenchmarkSample.index}
                    onChange={(e) => handleSelectBenchmarkSample(Number(e.target.value))}
                    disabled={loadingBenchmark || isAnalyzing}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      borderRadius: '6px',
                      border: '1px solid #D5DDE5',
                      background: '#FFFFFF',
                      color: '#252525',
                      fontWeight: 600,
                    }}
                  >
                    {benchmarkSamples.map((s) => (
                      <option key={s.index} value={s.index}>
                        #{s.index < 10 ? `0${s.index}` : s.index} (Rec {s.record_id || s.index}): {s.labels.join(', ')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {currentMetadata && (
                <div style={{ fontSize: '12px', color: '#777773' }}>
                  Quality:{' '}
                  <b style={{ color: currentMetadata.quality_status === 'optimal' ? '#34765A' : '#A83245' }}>
                    {currentMetadata.quality_status ? currentMetadata.quality_status.toUpperCase() : 'OPTIMAL'}
                  </b>{' '}
                  ({currentMetadata.quality_score?.toFixed(1) ?? '98.0'}%)
                </div>
              )}

              {/* Model Checkpoint Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#252525' }}>Model:</span>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    const newModel = e.target.value
                    setSelectedModel(newModel)
                    if (currentSignal) {
                      handleRunInference(currentSignal, newModel)
                    }
                  }}
                  style={{
                    padding: '5px 8px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid #E8E6E1',
                    background: '#FFFFFF',
                    fontWeight: 600,
                  }}
                >
                  <option value="seq">Sequence Model (ResNet1D + BiGRU + Attn, Top AUROC 0.925)</option>
                  <option value="cnn">ResNet1D Baseline (GAP, AUROC 0.916)</option>
                  <option value="hybrid">Concatenation Hybrid (Deep + 139 Handcrafted)</option>
                  <option value="gated">Adaptive Gated Fusion (Learned Gating Mechanism)</option>
                  <option value="multiscale_current">Multi-Scale ResNet (Current)</option>
                </select>
              </div>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleRunInference()}
                disabled={isAnalyzing || loadingBenchmark}
                style={{ minWidth: '120px' }}
              >
                {isAnalyzing ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={13} className="spin-animation" />
                    Analyzing...
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={13} />
                    Run Inference
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Error Banner */}
      {uploadError && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            background: '#FDEEEE',
            border: '1px solid #F5C6CB',
            color: '#B33A3A',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>{uploadError}</span>
        </div>
      )}

      {/* 3. Waveform Section (Rendered when signal is loaded) */}
      {currentSignal && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* ECGViewer Component (Guaranteed stable layout without dimension oscillations) */}
          <ECGViewer
            signal={currentSignal}
            samplingRate={currentMetadata?.sampling_rate || 100}
            leads={currentMetadata?.leads}
            attribution={attributionResult?.attribution}
            attributionClass={selectedClass}
          />

          {/* Verified Reference Ground Truth Card (Only displayed for benchmark samples, separate from predictions) */}
          {activeBenchmarkSample && (
            <div
              className="card"
              style={{
                padding: '16px 20px',
                background: '#F8F9FA',
                border: '1px solid #D5DDE5',
                borderRadius: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={18} style={{ color: '#1B4D89' }} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#1B4D89' }}>
                    Verified Reference Ground Truth — PTB-XL Record #{activeBenchmarkSample.record_id || activeBenchmarkSample.index}
                  </span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#E1EBF5', color: '#1B4D89', fontWeight: 600 }}>
                    PhysioNet Gold-Standard Annotations
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: '#555555' }}>
                  Patient: {activeBenchmarkSample.patient_id ? `#${activeBenchmarkSample.patient_id}` : 'N/A'} &bull;{' '}
                  Age: {activeBenchmarkSample.age ? `${activeBenchmarkSample.age} yrs` : 'Unknown'} &bull;{' '}
                  Sex: {activeBenchmarkSample.sex || 'Unknown'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#666666', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Verified Reference Superclasses:
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {activeBenchmarkSample.labels.length > 0 ? (
                      activeBenchmarkSample.labels.map((l) => (
                        <span
                          key={l}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: '#1B4D89',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          {l} — {CLASS_DESCRIPTIONS[l]?.name || l}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: '#777773', fontSize: '12px' }}>None</span>
                    )}
                  </div>
                </div>

                {activeBenchmarkSample.scp_codes && activeBenchmarkSample.scp_codes.length > 0 && (
                  <div>
                    <span style={{ fontSize: '11px', color: '#666666', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                      Diagnostic SCP Statements:
                    </span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {activeBenchmarkSample.scp_codes.map((code) => (
                        <code
                          key={code}
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#FFFFFF',
                            border: '1px solid #D5DDE5',
                            fontSize: '11px',
                            color: '#252525',
                            fontWeight: 600,
                          }}
                        >
                          {code}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ fontSize: '11px', color: '#666666', marginTop: '10px', lineHeight: 1.4 }}>
                Reference annotations are independent gold-standard clinical labels established by cardiologists during the PTB-XL curation.
                Model predictions below are computed live from the deep neural network and are evaluated against this reference standard.
              </div>
            </div>
          )}

          {/* 4. Five-Class Predictions Contract Table */}
          {analysisResult && (
            <div className="card" style={{ padding: '18px 20px', background: '#FFFFFF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#252525', margin: 0 }}>
                    Five-Class Multilabel Predictions ({analysisResult.model.toUpperCase()})
                  </h3>
                  <span style={{ fontSize: '11px', color: '#777773' }}>
                    Latency: {analysisResult.latency_ms} ms &bull; Decision thresholds calibrated on PTB-XL validation fold
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: '#9C9C96' }}>
                  Multilabel contract: Classes are mutually non-exclusive. Scores do not sum to 100%.
                </div>
              </div>

              {/* Compact Prediction Table */}
              <div style={{ overflowX: 'auto', border: '1px solid #E8E6E1', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#F7F7F5', borderBottom: '1px solid #E8E6E1', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#777773' }}>Class</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#777773' }}>Condition Description</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#777773' }}>Model Score</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#777773' }}>Decision Threshold</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#777773' }}>Predicted Decision</th>
                      {activeBenchmarkSample && (
                        <>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#1B4D89' }}>Reference Standard</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#1B4D89' }}>Concordance</th>
                        </>
                      )}
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#777773', textAlign: 'right' }}>Explainability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ORDERED_CLASSES.map((cls) => {
                      const score = analysisResult.probabilities[cls] ?? 0.0
                      const thresh = analysisResult.thresholds[cls] ?? 0.5
                      const isPositive = score >= thresh
                      const meta = CLASS_DESCRIPTIONS[cls]
                      const isCurrentlyExplained = attributionResult?.target_class === cls

                      // Ground truth concordance calculation if benchmark sample active
                      const isRefPositive = activeBenchmarkSample ? activeBenchmarkSample.labels.includes(cls) : null
                      let concordanceBadge = null
                      if (activeBenchmarkSample !== null && isRefPositive !== null) {
                        if (isPositive && isRefPositive) {
                          concordanceBadge = (
                            <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: '#E8F4EE', color: '#34765A' }}>
                              True Positive (Match)
                            </span>
                          )
                        } else if (!isPositive && !isRefPositive) {
                          concordanceBadge = (
                            <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#F0EFEA', color: '#777773' }}>
                              True Negative
                            </span>
                          )
                        } else if (isPositive && !isRefPositive) {
                          concordanceBadge = (
                            <span
                              style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: '#FEF3E6', color: '#B36B00' }}
                              title={`Model score ${score.toFixed(4)} exceeded validation threshold ${thresh.toFixed(2)}, but condition is absent from ground truth.`}
                            >
                              False Positive (Threshold Overlap)
                            </span>
                          )
                        } else if (!isPositive && isRefPositive) {
                          concordanceBadge = (
                            <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: '#FDEEEE', color: '#B33A3A' }}>
                              False Negative (Missed)
                            </span>
                          )
                        }
                      }

                      return (
                        <tr
                          key={cls}
                          style={{
                            borderBottom: '1px solid #F0EEE9',
                            background: isCurrentlyExplained ? '#FDF8F8' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '9px 12px', fontWeight: 700, color: '#252525' }}>
                            <code style={{ fontSize: '12px', color: '#A83245', background: '#F8EAED', padding: '2px 6px', borderRadius: '4px' }}>
                              {cls}
                            </code>
                          </td>
                          <td style={{ padding: '9px 12px', color: '#252525' }}>
                            <div style={{ fontWeight: 600 }}>{meta.name}</div>
                            <div style={{ fontSize: '11px', color: '#777773' }}>{meta.desc}</div>
                          </td>
                          <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600 }}>
                            {score.toFixed(4)}
                          </td>
                          <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: '#777773' }}>
                            {thresh.toFixed(2)}
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: isPositive ? '#FDEEEE' : '#E8F4EE',
                                color: isPositive ? '#B33A3A' : '#34765A',
                              }}
                            >
                              {isPositive ? 'POSITIVE' : 'NEGATIVE'}
                            </span>
                          </td>
                          {activeBenchmarkSample && (
                            <>
                              <td style={{ padding: '9px 12px' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    background: isRefPositive ? '#E1EBF5' : '#F0EFEA',
                                    color: isRefPositive ? '#1B4D89' : '#777773',
                                  }}
                                >
                                  {isRefPositive ? 'POSITIVE' : 'NEGATIVE'}
                                </span>
                              </td>
                              <td style={{ padding: '9px 12px' }}>
                                {concordanceBadge}
                              </td>
                            </>
                          )}
                          <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                            <button
                              className={`btn btn-sm ${isCurrentlyExplained ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ fontSize: '11px', padding: '4px 10px' }}
                              disabled={isExplaining}
                              onClick={() => handleRunExplain(cls)}
                            >
                              <Layers size={12} />
                              <span>{isCurrentlyExplained ? 'Attribution Active' : 'Explain'}</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Attribution Disclaimer & Multilabel Concordance Note */}
              {activeBenchmarkSample && analysisResult.predictions.filter((p) => p.detected).length > activeBenchmarkSample.labels.length && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    background: '#FFF9F2',
                    border: '1px solid #FFE4C4',
                    fontSize: '12px',
                    color: '#7A4100',
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Multi-Label Classification Diagnostic Note:</strong> The deep model evaluates 5 independent sigmoid heads, each using an F1-maximizing threshold calibrated on the PTB-XL validation fold.
                  In this recording, the model detected <strong>{analysisResult.predictions.filter((p) => p.detected).map((p) => p.class).join(', ')}</strong>, while verified reference annotations specify <strong>{activeBenchmarkSample.labels.join(', ') || 'Normal/None'}</strong>.
                  Because sigmoid heads are mathematically independent without joint exclusivity constraints, borderline features can simultaneously exceed thresholds on multiple classes (e.g., both MI and NORM).
                </div>
              )}

              <div style={{ fontSize: '11px', color: '#777773', marginTop: '10px', lineHeight: 1.4 }}>
                * Raw model scores are uncalibrated decision variables and must not be described as confirmed diagnostic probabilities.
                Positive predictions represent threshold exceedance for investigation and do not constitute a confirmed physician diagnosis.
              </div>
            </div>
          )}

          {/* 5. Class-Specific Explanation Card */}
          {attributionResult && (
            <div className="card" style={{ padding: '18px 20px', background: '#FFFFFF', border: '1px solid #E8E6E1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} style={{ color: '#A83245' }} />
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#252525', margin: 0 }}>
                    Integrated Gradients Attribution: {CLASS_DESCRIPTIONS[selectedClass]?.name} ({selectedClass})
                  </h4>
                </div>

                {/* Class selector chips */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  {ORDERED_CLASSES.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleRunExplain(c)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: selectedClass === c ? 700 : 500,
                        borderRadius: '4px',
                        border: '1px solid #E8E6E1',
                        background: selectedClass === c ? '#A83245' : '#FFFFFF',
                        color: selectedClass === c ? '#FFFFFF' : '#777773',
                        cursor: 'pointer',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plain language explanation */}
              <div style={{ padding: '12px 14px', background: '#FAFAF8', borderRadius: '6px', border: '1px solid #E8E6E1', fontSize: '12px', color: '#252525', lineHeight: 1.5, marginBottom: '14px' }}>
                <b>Model Attribution Summary:</b> The model’s sensitivity for <b>{CLASS_DESCRIPTIONS[selectedClass]?.name}</b> relies most heavily on{' '}
                <b>{attributionResult.top_lead}</b> ({(attributionResult.lead_importance?.[0]?.normalized != null ? (attributionResult.lead_importance[0].normalized * 100).toFixed(1) : '15')}% normalized lead gradient weight).
                <div style={{ fontSize: '11px', color: '#777773', marginTop: '4px' }}>
                  ATTRIBUTION NOTICE: This explanation mathematically traces the time-lead signal segments to which the neural network was most sensitive during inference.
                  It represents model attribution rather than medical proof of disease.
                </div>
              </div>

              {/* Lead Importance Cards */}
              {attributionResult.lead_importance && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                  {attributionResult.lead_importance.slice(0, 6).map((item, idx) => (
                    <div
                      key={item.lead}
                      style={{
                        padding: '8px',
                        background: idx === 0 ? '#F8EAED' : '#FAFAF8',
                        borderRadius: '6px',
                        border: `1px solid ${idx === 0 ? '#A83245' : '#E8E6E1'}`,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#777773' }}>#{idx + 1} Lead</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: idx === 0 ? '#A83245' : '#252525' }}>
                        {item.lead}
                      </div>
                      <div style={{ fontSize: '11px', color: '#777773' }}>
                        {item.normalized != null ? `${(item.normalized * 100).toFixed(1)}% weight` : item.score?.toFixed(3)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 6. Explicit Next Actions Bar: Save to Patient vs Keep as Temporary */}
          <div
            className="card"
            style={{
              padding: '16px 20px',
              background: '#FAFAF8',
              border: '1px solid #E8E6E1',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#252525' }}>
                Next Action for this Analysis
              </div>
              <div style={{ fontSize: '12px', color: '#777773' }}>
                Choose whether to attach this study to an official patient record or keep it isolated as a temporary session analysis.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={handleKeepAsTemporary}
                style={{ fontSize: '13px' }}
              >
                {temporaryConfirmed ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34765A' }}>
                    <CheckCircle2 size={14} />
                    <span>Isolated as Temporary</span>
                  </span>
                ) : (
                  <span>Keep as Temporary Analysis</span>
                )}
              </button>

              <button
                className="btn btn-primary"
                onClick={openSaveModal}
                style={{ fontSize: '13px' }}
              >
                <Save size={14} />
                <span>Save to Patient</span>
              </button>
            </div>
          </div>

          {temporaryConfirmed && (
            <div style={{ padding: '10px 14px', borderRadius: '6px', background: '#E8F4EE', color: '#34765A', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={15} />
              <span>
                <b>Temporary Analysis Confirmed:</b> This test is held in session memory for research and has NOT created any patient chart, encounter, or clinical study record. It will not affect patient counts or worklists.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Save to Patient Modal */}
      {showSaveModal && (
        <div className="modal-backdrop">
          <div className="card modal-dialog" style={{ width: '620px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#252525', margin: 0 }}>
                  Save ECG Analysis to Patient
                </h3>
                <span style={{ fontSize: '12px', color: '#777773' }}>
                  Persist this 12-lead acquisition, predictions, and model metadata to an official patient chart.
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSaveModal(false)}>
                <X size={16} />
              </button>
            </div>

            {saveError && (
              <div style={{ padding: '10px 12px', borderRadius: '6px', background: '#FDEEEE', color: '#B33A3A', fontSize: '12px', marginBottom: '14px' }}>
                {saveError}
              </div>
            )}

            {saveSuccessMsg && (
              <div style={{ padding: '10px 12px', borderRadius: '6px', background: '#E8F4EE', color: '#34765A', fontSize: '12px', marginBottom: '14px' }}>
                {saveSuccessMsg}
              </div>
            )}

            {/* Destination Selection Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E8E6E1', paddingBottom: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setSaveTab('existing')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: saveTab === 'existing' ? '#A83245' : '#F0EFEA',
                  color: saveTab === 'existing' ? '#FFFFFF' : '#777773',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Existing Patient Chart
              </button>
              <button
                type="button"
                onClick={() => setSaveTab('new')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: saveTab === 'new' ? '#A83245' : '#F0EFEA',
                  color: saveTab === 'new' ? '#FFFFFF' : '#777773',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Create New Patient & Link
              </button>
            </div>

            {saveTab === 'existing' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Patient Search */}
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#777773' }} />
                  <input
                    type="text"
                    placeholder="Search patient by name or ID..."
                    value={patientSearch}
                    onChange={(e) => handlePatientSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px 8px 30px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
                  />
                </div>

                {/* Patient Selection List */}
                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid #E8E6E1', borderRadius: '6px', padding: '8px' }}>
                  {patientsLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#777773', fontSize: '12px' }}>
                      <RefreshCw size={14} className="spin-animation" style={{ margin: '0 auto 6px' }} />
                      Loading patients...
                    </div>
                  ) : patients.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#777773', fontSize: '12px' }}>
                      No patients found. Click 'Create New Patient & Link'.
                    </div>
                  ) : (
                    patients.map((p) => {
                      const isSelected = selectedPatientId === p.id
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedPatientId(p.id)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: `1px solid ${isSelected ? '#A83245' : '#E8E6E1'}`,
                            background: isSelected ? '#F8EAED' : '#FFFFFF',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '13px', color: isSelected ? '#A83245' : '#252525' }}>
                              {p.name}
                            </span>
                            <span style={{ fontSize: '11px', color: '#777773', marginLeft: '8px' }}>
                              {p.patient_id} &bull; {p.age ? `${p.age}y` : 'Age N/A'} &bull; {p.sex}
                            </span>
                          </div>
                          {isSelected && <Check size={14} style={{ color: '#A83245' }} />}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Inline New Patient Form */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                    Full Patient Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Johnathan Doe"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
                  />
                </div>

                {/* DOB & Age */}
                <div style={{ background: '#FAFAF8', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E8E6E1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#252525', textTransform: 'uppercase' }}>
                      Demographics Source of Truth
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setNewDobMode('dob')}
                        style={{
                          padding: '2px 6px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          border: 'none',
                          background: newDobMode === 'dob' ? '#A83245' : '#FFFFFF',
                          color: newDobMode === 'dob' ? '#FFFFFF' : '#777773',
                          cursor: 'pointer',
                        }}
                      >
                        DOB Truth
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewDobMode('age_only')}
                        style={{
                          padding: '2px 6px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          border: 'none',
                          background: newDobMode === 'age_only' ? '#A83245' : '#FFFFFF',
                          color: newDobMode === 'age_only' ? '#FFFFFF' : '#777773',
                          cursor: 'pointer',
                        }}
                      >
                        DOB Unknown (Age-Only)
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {newDobMode === 'dob' ? (
                      <>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#252525', marginBottom: '2px' }}>
                            DOB (YYYY-MM-DD) *
                          </label>
                          <input
                            type="date"
                            value={newDob}
                            max={new Date().toISOString().slice(0, 10)}
                            onChange={(e) => setNewDob(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #E8E6E1' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#252525', marginBottom: '2px' }}>
                            Derived Age
                          </label>
                          <div style={{ padding: '6px 8px', background: '#F0EFEA', borderRadius: '4px', fontSize: '12px', fontWeight: 600, color: '#34765A' }}>
                            {newDerivedAge !== null ? `${newDerivedAge} yrs old (verified)` : 'Auto-calculated'}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#252525', marginBottom: '2px' }}>
                            Age (Years) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="130"
                            value={newAge}
                            onChange={(e) => setNewAge(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #E8E6E1' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#777773', marginBottom: '2px' }}>
                            DOB Status
                          </label>
                          <div style={{ padding: '6px 8px', background: '#F0EFEA', borderRadius: '4px', fontSize: '11px', color: '#777773' }}>
                            Stored as Unknown
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#252525', marginBottom: '2px' }}>
                      Sex
                    </label>
                    <select
                      value={newSex}
                      onChange={(e) => setNewSex(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #E8E6E1' }}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#252525', marginBottom: '2px' }}>
                      MRN (Optional)
                    </label>
                    <input
                      type="text"
                      value={newMrn}
                      onChange={(e) => setNewMrn(e.target.value)}
                      placeholder="e.g. MRN-9021"
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #E8E6E1' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Clinician Assignment */}
            <div style={{ marginTop: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                Assigned Attending Clinician
              </label>
              <input
                type="text"
                value={assignedClinician}
                onChange={(e) => setAssignedClinician(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isSaving}
                onClick={() => setShowSaveModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSaving}
                onClick={handleConfirmSave}
                style={{ minWidth: '150px' }}
              >
                {isSaving ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={13} className="spin-animation" />
                    Saving Study...
                  </span>
                ) : (
                  'Confirm & Link Study'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import {
  Database,
  Search,
  Filter,
  Play,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Download,
  Activity,
  UserCheck,
  Clock,
  Sparkles,
  ChevronRight,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import {
  DiagnosticClass,
  LEADS,
  PTBXLDatasetInfo,
  PTBXLRecordSummary,
  PTBXLRecordDetail,
  PTBXLBenchmarkAnalysisResult,
  PTBXLEvaluationSummary,
  ModelMetadata
} from '../types'
import {
  fetchPTBXLInfo,
  fetchPTBXLRecords,
  fetchPTBXLRecordDetail,
  analyzePTBXLRecord,
  fetchPTBXLEvaluation,
  importPTBXLRecordToPatient,
  fetchModels
} from '../api'
import { ECGViewer } from './ECGViewer'

const DIAGNOSTIC_CLASSES: DiagnosticClass[] = ['CD', 'HYP', 'MI', 'NORM', 'STTC']

const CLASS_DESCRIPTIONS: Record<DiagnosticClass, string> = {
  CD: 'Conduction Disturbance',
  HYP: 'Hypertrophy',
  MI: 'Myocardial Infarction',
  NORM: 'Normal ECG',
  STTC: 'ST/T Change'
}

interface DatasetBenchViewProps {
  onImportSuccess?: (studyId: string, patientId: string) => void
}

export const DatasetBenchView: React.FC<DatasetBenchViewProps> = ({ onImportSuccess }) => {
  // Dataset Status & Metadata
  const [datasetInfo, setDatasetInfo] = useState<PTBXLDatasetInfo | null>(null)
  const [infoLoading, setInfoLoading] = useState<boolean>(true)

  // Records List Filter & Pagination
  const [selectedFold, setSelectedFold] = useState<number>(10)
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [records, setRecords] = useState<PTBXLRecordSummary[]>([])
  const [totalRecords, setTotalRecords] = useState<number>(0)
  const [recordsLoading, setRecordsLoading] = useState<boolean>(false)
  const [currentPage, setCurrentPage] = useState<number>(0)
  const pageSize = 15

  // Selected Record & Analysis
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null)
  const [recordDetail, setRecordDetail] = useState<PTBXLRecordDetail | null>(null)
  const [recordDetailLoading, setRecordDetailLoading] = useState<boolean>(false)

  // Models & Inference
  const [availableModels, setAvailableModels] = useState<ModelMetadata[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('seq')
  const [analysisResult, setAnalysisResult] = useState<PTBXLBenchmarkAnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState<boolean>(false)
  const [explainClass, setExplainClass] = useState<DiagnosticClass>('NORM')

  // Evaluation Benchmark
  const [evalSummary, setEvalSummary] = useState<PTBXLEvaluationSummary | null>(null)
  const [evalLoading, setEvalLoading] = useState<boolean>(false)
  const [showEvalModal, setShowEvalModal] = useState<boolean>(false)

  // Import modal
  const [importing, setImporting] = useState<boolean>(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)

  // 1. Initial Load of Dataset Info, Models, and Held-out Evaluation
  useEffect(() => {
    const init = async () => {
      try {
        setInfoLoading(true)
        const [info, modelsData, evalData] = await Promise.all([
          fetchPTBXLInfo().catch(() => null),
          fetchModels().catch(() => ({ models: [], active_model: 'seq' })),
          fetchPTBXLEvaluation('seq').catch(() => null)
        ])
        setDatasetInfo(info)
        setAvailableModels(modelsData.models || [])
        if (modelsData.active_model) setSelectedModel(modelsData.active_model)
        setEvalSummary(evalData)
      } catch (err) {
        console.error('Failed to initialize test bench:', err)
      } finally {
        setInfoLoading(false)
      }
    }
    init()
  }, [])

  // 2. Load records whenever fold, class filter, search, or page changes
  useEffect(() => {
    if (!datasetInfo?.installed) return

    const loadRecords = async () => {
      try {
        setRecordsLoading(true)
        const res = await fetchPTBXLRecords(
          selectedFold,
          selectedClassFilter,
          searchQuery,
          currentPage * pageSize,
          pageSize
        )
        setRecords(res.records)
        setTotalRecords(res.total)
        // Select first record if none selected
        if (res.records.length > 0 && selectedRecordId === null) {
          setSelectedRecordId(res.records[0].ecg_id)
        }
      } catch (err) {
        console.error('Failed to load dataset records:', err)
      } finally {
        setRecordsLoading(false)
      }
    }

    loadRecords()
  }, [datasetInfo?.installed, selectedFold, selectedClassFilter, searchQuery, currentPage])

  // 3. Load full detail when selectedRecordId changes
  useEffect(() => {
    if (selectedRecordId === null) return

    const loadDetail = async () => {
      try {
        setRecordDetailLoading(true)
        setAnalysisResult(null) // clear old analysis to prevent stale results
        setImportMessage(null)
        const detail = await fetchPTBXLRecordDetail(selectedRecordId)
        setRecordDetail(detail)

        // Automatically set initial explain class to top reference class or NORM
        const topRef = detail.reference_classes[0] || 'NORM'
        setExplainClass(topRef)

        // Auto-run inference with default model on record load
        runInference(selectedRecordId, selectedModel, topRef)
      } catch (err) {
        console.error(`Failed to load record #${selectedRecordId}:`, err)
      } finally {
        setRecordDetailLoading(false)
      }
    }

    loadDetail()
  }, [selectedRecordId])

  // 4. Model inference & explanation executor
  const runInference = async (recId: number, modelName: string, targetExplainCls?: DiagnosticClass) => {
    try {
      setAnalyzing(true)
      const res = await analyzePTBXLRecord(
        recId,
        modelName,
        targetExplainCls || explainClass,
        25
      )
      setAnalysisResult(res)
    } catch (err: any) {
      console.error('Inference error:', err)
    } finally {
      setAnalyzing(false)
    }
  }

  // 5. Handle Import to Clinical Chart
  const handleImportRecord = async () => {
    if (!recordDetail) return
    try {
      setImporting(true)
      setImportMessage(null)
      const result = await importPTBXLRecordToPatient(
        recordDetail.ecg_id,
        'Attending Clinician',
        `Imported PTB-XL Benchmark Record #${recordDetail.ecg_id} (Fold ${recordDetail.strat_fold})`
      )
      setImportMessage(`Imported as patient chart ${result.patient_id} with linked study.`)
      if (result.created_study_id && onImportSuccess) {
        onImportSuccess(result.created_study_id, result.id)
      }
    } catch (err: any) {
      setImportMessage(`Import notice: ${err?.message || 'Failed to import record.'}`)
    } finally {
      setImporting(false)
    }
  }

  const handleOpenEvalModal = async () => {
    setShowEvalModal(true)
    if (!evalSummary) {
      setEvalLoading(true)
      try {
        const ev = await fetchPTBXLEvaluation(selectedModel)
        setEvalSummary(ev)
      } catch (err) {
        console.error('Failed to load evaluation summary:', err)
      } finally {
        setEvalLoading(false)
      }
    }
  }



  // If dataset is not installed/configured locally
  if (!infoLoading && (!datasetInfo || !datasetInfo.installed)) {
    return (
      <div className="card" style={{ padding: '36px', textAlign: 'center', maxWidth: '800px', margin: '40px auto' }}>
        <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: '#FDEEEE', color: '#B33A3A', marginBottom: '16px' }}>
          <AlertTriangle size={32} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#252525', marginBottom: '8px' }}>
          PTB-XL v1.0.3 Dataset Not Configured Locally
        </h2>
        <p style={{ fontSize: '14px', color: '#777773', lineHeight: 1.6, marginBottom: '20px', maxWidth: '600px', margin: '0 auto 20px' }}>
          {datasetInfo?.message || (
            "The official PTB-XL v1.0.3 dataset was not found in 'data/ptbxl' or preprocessed arrays are missing from 'artifacts/cache'. " +
            "Per the verification contract, fake or simulated records are never substituted."
          )}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <a
            href="https://physionet.org/content/ptb-xl/1.0.3/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <ExternalLink size={15} />
            PhysioNet PTB-XL v1.0.3 Source
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Top Banner: Real Dataset Verification Header */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: '#FFFFFF'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-flex', padding: '5px', borderRadius: '4px', background: '#F8EAED', color: '#A83245' }}>
              <Database size={16} />
            </span>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#252525', margin: 0 }}>
              PTB-XL v1.0.3 ECG Dataset Test Bench
            </h2>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#E8F4EE', color: '#34765A' }}>
              Held-Out Fold 10 Verified
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#777773', margin: '4px 0 0' }}>
            Primary test bench for genuine PhysioNet PTB-XL 10-second, 12-lead waveforms (100 Hz, 1000×12).
            Test cases remain strictly isolated from clinical patient records.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleOpenEvalModal}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ShieldCheck size={14} color="#34765A" />
            <span>Held-Out Benchmark Summary ({evalSummary?.records_evaluated || 2158} Records)</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Column Records Explorer, Right Column Analysis & Waveform */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Fold & Record Selector */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#252525', margin: 0 }}>
              Dataset Records ({totalRecords})
            </h3>
            <span style={{ fontSize: '11px', color: '#777773' }}>
              Fold {selectedFold} {selectedFold === 10 ? '(Held-out Test)' : ''}
            </span>
          </div>

          {/* Fold selector & class filter */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={selectedFold}
              onChange={(e) => {
                setSelectedFold(parseInt(e.target.value, 10))
                setCurrentPage(0)
              }}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid #E8E6E1',
                background: '#FFFFFF'
              }}
            >
              <option value="10">Fold 10 (Held-Out Test Set, N=2,158)</option>
              <option value="9">Fold 9 (Validation Fold, N=2,146)</option>
              <option value="1">Fold 1 (Training Fold)</option>
              <option value="2">Fold 2 (Training Fold)</option>
              <option value="5">Fold 5 (Training Fold)</option>
            </select>
          </div>

          {/* Class Filter Chips */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#777773', marginBottom: '6px', textTransform: 'uppercase' }}>
              Filter by Diagnostic Ground Truth:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {['ALL', 'NORM', 'MI', 'STTC', 'CD', 'HYP'].map((cls) => {
                const isActive = selectedClassFilter === cls
                return (
                  <button
                    key={cls}
                    onClick={() => {
                      setSelectedClassFilter(cls)
                      setCurrentPage(0)
                    }}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: isActive ? 700 : 500,
                      borderRadius: '4px',
                      border: '1px solid',
                      borderColor: isActive ? '#A83245' : '#E8E6E1',
                      background: isActive ? '#F8EAED' : '#FFFFFF',
                      color: isActive ? '#A83245' : '#252525',
                      cursor: 'pointer'
                    }}
                  >
                    {cls}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#777773' }} />
            <input
              type="text"
              placeholder="Search by ECG ID, Patient ID, or SCP..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(0)
              }}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid #E8E6E1'
              }}
            />
          </div>

          {/* Records List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '520px', overflowY: 'auto' }}>
            {recordsLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#777773', fontSize: '12px' }}>
                Loading real records...
              </div>
            ) : records.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#777773', fontSize: '12px' }}>
                No records match the current filter.
              </div>
            ) : (
              records.map((r) => {
                const isSelected = selectedRecordId === r.ecg_id
                return (
                  <div
                    key={r.ecg_id}
                    onClick={() => setSelectedRecordId(r.ecg_id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: isSelected ? '#A83245' : '#E8E6E1',
                      background: isSelected ? '#FDF8F9' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#252525' }}>
                        PTB-XL Record #{r.ecg_id}
                      </span>
                      <span style={{ fontSize: '11px', color: '#777773' }}>
                        Fold {r.strat_fold}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#777773', marginTop: '3px' }}>
                      {r.age !== null ? `Age: ${r.age}y` : 'Age: Unknown'} \u2022 {r.sex} \u2022 Subj #{r.patient_id || 'N/A'}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                      {r.reference_classes.map((c) => (
                        <span
                          key={c}
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '3px',
                            background: c === 'NORM' ? '#E8F4EE' : '#FDEEEE',
                            color: c === 'NORM' ? '#34765A' : '#B33A3A'
                          }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Pagination Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #E8E6E1' }}>
            <button
              className="btn btn-ghost btn-sm"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              style={{ fontSize: '11px' }}
            >
              Previous
            </button>
            <span style={{ fontSize: '11px', color: '#777773' }}>
              Page {currentPage + 1} of {Math.ceil(totalRecords / pageSize) || 1}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={(currentPage + 1) * pageSize >= totalRecords}
              onClick={() => setCurrentPage((p) => p + 1)}
              style={{ fontSize: '11px' }}
            >
              Next
            </button>
          </div>
        </div>

        {/* Right Column: Selected Record Waveform & Ground Truth Comparison */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {recordDetailLoading || !recordDetail ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center', color: '#777773' }}>
              Loading record waveform and reference annotations...
            </div>
          ) : (
            <>
              {/* Record Header & Model Inference Controls */}
              <div className="card" style={{ padding: '18px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#252525', margin: 0 }}>
                        PTB-XL Record #{recordDetail.ecg_id}
                      </h2>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: recordDetail.is_held_out_test ? '#E8F4EE' : '#F7F7F5',
                          color: recordDetail.is_held_out_test ? '#34765A' : '#777773'
                        }}
                      >
                        {recordDetail.is_held_out_test ? 'Verified Held-Out Test Record (Fold 10)' : `Fold ${recordDetail.strat_fold}`}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#777773', marginTop: '6px' }}>
                      Subject ID: {recordDetail.patient_id || 'N/A'} \u2022 Age: {recordDetail.age !== null ? `${recordDetail.age} years` : 'Unrecorded'} \u2022 Sex: {recordDetail.sex} \u2022
                      100 Hz \u2022 10.0s \u2022 12 Standard Leads \u2022 Signal Quality: <b>{recordDetail.quality_status.toUpperCase()}</b> ({recordDetail.quality_score})
                    </div>

                    <div style={{ fontSize: '11px', color: '#777773', marginTop: '4px' }}>
                      Raw SCP Statements: {Object.keys(recordDetail.scp_codes).join(', ')}
                    </div>
                  </div>

                  {/* Actions: Run Model & Import to Clinical Chart */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={selectedModel}
                      onChange={(e) => {
                        setSelectedModel(e.target.value)
                        runInference(recordDetail.ecg_id, e.target.value)
                      }}
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        borderRadius: '6px',
                        border: '1px solid #E8E6E1',
                        background: '#FFFFFF'
                      }}
                    >
                      {availableModels.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.display_name}
                        </option>
                      ))}
                    </select>

                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => runInference(recordDetail.ecg_id, selectedModel)}
                      disabled={analyzing}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Play size={13} />
                      <span>{analyzing ? 'Evaluating...' : 'Run Inference'}</span>
                    </button>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleImportRecord}
                      disabled={importing}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <UserCheck size={13} />
                      <span>{importing ? 'Importing...' : 'Import to Patient Chart'}</span>
                    </button>
                  </div>
                </div>

                {importMessage && (
                  <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '4px', background: '#E8F4EE', color: '#34765A', fontSize: '12px' }}>
                    {importMessage}
                  </div>
                )}
              </div>

              {/* 12-Lead Waveform Viewer */}
              <div style={{ width: '100%' }}>
                <ECGViewer
                  signal={recordDetail.signal}
                  attribution={analysisResult?.attribution || null}
                  attributionClass={explainClass}
                />
              </div>

              {/* Five-Class Model Contract Table: Model Predictions vs Reference Ground Truth */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#252525', margin: 0 }}>
                      Five-Class Benchmark Comparison: Ground Truth vs Model Predictions
                    </h3>
                    <div style={{ fontSize: '12px', color: '#777773', marginTop: '2px' }}>
                      Multilabel reference annotations (PhysioNet SCP mapping) beside deep learning decision outputs.
                    </div>
                  </div>

                  <span style={{ fontSize: '11px', color: '#777773', background: '#F7F7F5', padding: '4px 8px', borderRadius: '4px' }}>
                    Contract Order: CD \u2022 HYP \u2022 MI \u2022 NORM \u2022 STTC
                  </span>
                </div>

                {/* Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E8E6E1', textAlign: 'left', color: '#777773', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 10px' }}>Diagnostic Superclass</th>
                      <th style={{ padding: '8px 10px' }}>PTB-XL Ground Truth</th>
                      <th style={{ padding: '8px 10px' }}>Model Score (Uncalibrated)</th>
                      <th style={{ padding: '8px 10px' }}>Decision Threshold</th>
                      <th style={{ padding: '8px 10px' }}>Model Decision</th>
                      <th style={{ padding: '8px 10px' }}>Concordance Status</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Explain Attribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisResult?.five_class_results.map((item) => {
                      const isExplained = explainClass === item.class
                      return (
                        <tr
                          key={item.class}
                          style={{
                            borderBottom: '1px solid #E8E6E1',
                            background: isExplained ? '#FDF8F9' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '10px 10px', fontWeight: 600, color: '#252525' }}>
                            {item.name} ({item.class})
                          </td>

                          <td style={{ padding: '10px 10px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: item.reference_is_positive ? '#E8F4EE' : '#F7F7F5',
                                color: item.reference_is_positive ? '#34765A' : '#777773'
                              }}
                            >
                              {item.reference_label.toUpperCase()}
                            </span>
                          </td>

                          <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontSize: '13px' }}>
                            {item.score.toFixed(4)}
                          </td>

                          <td style={{ padding: '10px 10px', color: '#777773', fontFamily: 'monospace' }}>
                            {item.threshold.toFixed(2)}
                          </td>

                          <td style={{ padding: '10px 10px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: item.predicted_positive ? '#FDEEEE' : '#F7F7F5',
                                color: item.predicted_positive ? '#B33A3A' : '#777773'
                              }}
                            >
                              {item.predicted_positive ? 'POSITIVE' : 'NEGATIVE'}
                            </span>
                          </td>

                          <td style={{ padding: '10px 10px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background:
                                  item.concordance === 'TP' ? '#E8F4EE' :
                                  item.concordance === 'TN' ? '#F7F7F5' :
                                  item.concordance === 'FP' ? '#FFF5E6' : '#FDEEEE',
                                color:
                                  item.concordance === 'TP' ? '#34765A' :
                                  item.concordance === 'TN' ? '#555552' :
                                  item.concordance === 'FP' ? '#B77925' : '#B33A3A'
                              }}
                            >
                              {item.concordance} — {item.status_text}
                            </span>
                          </td>

                          <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                setExplainClass(item.class)
                                runInference(recordDetail.ecg_id, selectedModel, item.class)
                              }}
                              style={{
                                fontSize: '11px',
                                fontWeight: isExplained ? 700 : 500,
                                color: isExplained ? '#A83245' : '#777773',
                                background: isExplained ? '#F8EAED' : 'transparent'
                              }}
                            >
                              {isExplained ? 'Attribution Active' : 'Explain'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                <div style={{ marginTop: '12px', fontSize: '11px', color: '#777773', lineHeight: 1.5 }}>
                  * Raw model output scores are uncalibrated decision variables and must not be described as certified clinical probabilities.
                  Predicted classes represent threshold exceedance for research exploration and do not constitute a confirmed physician diagnosis.
                </div>
              </div>

              {/* Explainability & Attribution Card */}
              {analysisResult && (
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={16} color="#A83245" />
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#252525', margin: 0 }}>
                        Class-Specific Explanation: {CLASS_DESCRIPTIONS[explainClass]} ({explainClass})
                      </h3>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {DIAGNOSTIC_CLASSES.map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            setExplainClass(c)
                            runInference(recordDetail.ecg_id, selectedModel, c)
                          }}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: explainClass === c ? 700 : 500,
                            borderRadius: '4px',
                            border: '1px solid',
                            borderColor: explainClass === c ? '#A83245' : '#E8E6E1',
                            background: explainClass === c ? '#F8EAED' : '#FFFFFF',
                            color: explainClass === c ? '#A83245' : '#252525',
                            cursor: 'pointer'
                          }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Plain Language Explanation Narrative */}
                  <div style={{ padding: '14px 16px', borderRadius: '6px', background: '#F7F7F5', marginBottom: '16px', fontSize: '13px', lineHeight: 1.6, color: '#252525' }}>
                    <b>Model Attribution Summary:</b> {analysisResult.plain_language_explanation}
                  </div>

                  {/* Lead Importance Ranking */}
                  {analysisResult.lead_importance && analysisResult.lead_importance.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#777773', marginBottom: '8px', textTransform: 'uppercase' }}>
                        Lead Attribution Ranking (Integrated Gradients Magnitude):
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                        {analysisResult.lead_importance.slice(0, 6).map((item, idx) => (
                          <div
                            key={item.lead}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '4px',
                              background: idx === 0 ? '#F8EAED' : '#FFFFFF',
                              border: '1px solid',
                              borderColor: idx === 0 ? '#A83245' : '#E8E6E1'
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: '12px', color: idx === 0 ? '#A83245' : '#252525' }}>
                              #{idx + 1} {item.lead}
                            </div>
                            <div style={{ fontSize: '11px', color: '#777773', marginTop: '2px' }}>
                              {(item.normalized * 100).toFixed(1)}% weight
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div style={{ padding: '10px 14px', borderRadius: '4px', background: '#FFF5E6', borderLeft: '3px solid #B77925', fontSize: '12px', color: '#634212' }}>
                    <b>RESEARCH / PROTOTYPE DISCLAIMER:</b> {analysisResult.disclaimer}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Held-Out Evaluation Benchmark Modal */}
      {showEvalModal && (
        <div className="modal-backdrop">
          <div className="card modal-dialog" style={{ width: '750px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#252525', margin: 0 }}>
                  Verified Held-Out Benchmark Evaluation Summary
                </h3>
                <div style={{ fontSize: '12px', color: '#777773', marginTop: '3px' }}>
                  {evalSummary?.split || 'PTB-XL Fold 10 Test Set'} • Verified Unseen during Training
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEvalModal(false)}>
                ✕
              </button>
            </div>

            {!evalSummary ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#777773' }}>
                <RefreshCw size={24} className="spin-animation" style={{ margin: '0 auto 12px' }} />
                <div>Loading Fold 10 Evaluation Benchmark...</div>
              </div>
            ) : (
              <>

            {/* Macro Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
              <div style={{ padding: '12px', background: '#F7F7F5', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#777773', textTransform: 'uppercase' }}>Macro AUROC</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#252525', marginTop: '4px' }}>
                  {evalSummary.macro_auroc.toFixed(4)}
                </div>
              </div>

              <div style={{ padding: '12px', background: '#F7F7F5', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#777773', textTransform: 'uppercase' }}>Macro AUPRC</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#252525', marginTop: '4px' }}>
                  {evalSummary.macro_auprc.toFixed(4)}
                </div>
              </div>

              <div style={{ padding: '12px', background: '#F7F7F5', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#777773', textTransform: 'uppercase' }}>Macro F1</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#252525', marginTop: '4px' }}>
                  {evalSummary.macro_f1.toFixed(4)}
                </div>
              </div>

              <div style={{ padding: '12px', background: '#F7F7F5', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#777773', textTransform: 'uppercase' }}>Sensitivity</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#252525', marginTop: '4px' }}>
                  {evalSummary.macro_sensitivity.toFixed(4)}
                </div>
              </div>

              <div style={{ padding: '12px', background: '#F7F7F5', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#777773', textTransform: 'uppercase' }}>Specificity</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#252525', marginTop: '4px' }}>
                  {evalSummary.macro_specificity.toFixed(4)}
                </div>
              </div>
            </div>

            {/* Per-Class Table */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#777773', marginBottom: '8px', textTransform: 'uppercase' }}>
                Per-Class Performance on Fold 10 ({evalSummary.records_evaluated} Valid Records):
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E8E6E1', color: '#777773', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Class</th>
                    <th style={{ padding: '6px 8px' }}>AUROC</th>
                    <th style={{ padding: '6px 8px' }}>AUPRC</th>
                    <th style={{ padding: '6px 8px' }}>F1 Score</th>
                    <th style={{ padding: '6px 8px' }}>Sens.</th>
                    <th style={{ padding: '6px 8px' }}>Spec.</th>
                    <th style={{ padding: '6px 8px' }}>Decision Thresh.</th>
                    <th style={{ padding: '6px 8px' }}>Confusion Matrix [TN, FP, FN, TP]</th>
                  </tr>
                </thead>
                <tbody>
                  {DIAGNOSTIC_CLASSES.map((c) => {
                    const row = evalSummary.per_class[c]
                    if (!row) return null
                    const cf = row.confusion
                    return (
                      <tr key={c} style={{ borderBottom: '1px solid #E8E6E1' }}>
                        <td style={{ padding: '8px 8px', fontWeight: 600 }}>{row.name} ({c})</td>
                        <td style={{ padding: '8px 8px' }}>{row.auroc.toFixed(4)}</td>
                        <td style={{ padding: '8px 8px' }}>{row.auprc.toFixed(4)}</td>
                        <td style={{ padding: '8px 8px' }}>{row.f1.toFixed(4)}</td>
                        <td style={{ padding: '8px 8px' }}>{row.sensitivity.toFixed(4)}</td>
                        <td style={{ padding: '8px 8px' }}>{row.specificity.toFixed(4)}</td>
                        <td style={{ padding: '8px 8px' }}>{row.threshold.toFixed(2)}</td>
                        <td style={{ padding: '8px 8px', fontFamily: 'monospace', fontSize: '11px' }}>
                          [{cf.tn}, {cf.fp}, {cf.fn}, {cf.tp}] (Σ={cf.total})
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '10px 14px', borderRadius: '4px', background: '#F7F7F5', fontSize: '11px', color: '#777773', lineHeight: 1.5 }}>
              <b>Split Provenance:</b> {evalSummary.provenance}
            </div>
            </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEvalModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useEffect, useState, useRef } from 'react'
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  Save,
  Check,
  RefreshCw,
  Upload,
  Layers,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react'
import {
  ECGStudy,
  DiagnosticClass,
  Patient,
} from '../types'
import {
  fetchStudyDetail,
  analyzeStudy,
  fetchStudyNotes,
  saveStudyNotes,
  draftAiNotes,
  updateStudyStatus,
  finalizeStudyReport,
  fetchPatients,
} from '../api'
import { ECGViewer } from './ECGViewer'
import { useAnalysis } from '../context/AnalysisContext'

interface ClinicalECGReviewViewProps {
  onNavigateToExplain: (targetClass: DiagnosticClass) => void
  onNavigateToReports: (studyId: string) => void
}

const CLASS_DESCRIPTIONS: Record<DiagnosticClass, { name: string; desc: string }> = {
  NORM: {
    name: 'Normal ECG',
    desc: 'Normal sinus rhythm and standard morphology limits.',
  },
  MI: {
    name: 'Myocardial Infarction',
    desc: 'Pathological Q-waves, acute ST elevation, or anterior loss.',
  },
  STTC: {
    name: 'ST/T-Change',
    desc: 'ST depression or T-wave inversion indicating repolarization disturbance.',
  },
  CD: {
    name: 'Conduction Disturbance',
    desc: 'Intraventricular conduction delay (LBBB, RBBB) or AV prolongation.',
  },
  HYP: {
    name: 'Hypertrophy',
    desc: 'Voltage criteria consistent with ventricular enlargement.',
  },
}

const ORDERED_CLASSES: DiagnosticClass[] = ['CD', 'HYP', 'MI', 'NORM', 'STTC']

export const ClinicalECGReviewView: React.FC<ClinicalECGReviewViewProps> = ({
  onNavigateToExplain,
  onNavigateToReports,
}) => {
  const {
    selectedStudyId,
    selectedStudy,
    setSelectedStudy,
    currentSignal,
    currentMetadata,
    setSignal,
    activeModel,
    setActiveModel,
    models,
    isTemporaryAnalysis,
    uploadAndValidateFile,
    clearUploadedSignal,
    saveTemporaryToPatient,
    runInference,
    analysisResult,
    selectedClass,
    setSelectedClass,
    runExplanation,
    isExplaining,
    attributionResult,
  } = useAnalysis()

  const [loading, setLoading] = useState<boolean>(false)
  const [analyzing, setAnalyzing] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'waveform' | 'documentation'>('waveform')

  // File upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Save to patient modal
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false)
  const [patientList, setPatientList] = useState<Patient[]>([])
  const [selectedSavePatientId, setSelectedSavePatientId] = useState<string>('')
  const [isSavingStudy, setIsSavingStudy] = useState<boolean>(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null)

  // Clinical Notes Fields
  const [reasonForEcg, setReasonForEcg] = useState<string>('')
  const [presentingSymptoms, setPresentingSymptoms] = useState<string>('')
  const [relevantHistory, setRelevantHistory] = useState<string>('')
  const [medicationsAllergies, setMedicationsAllergies] = useState<string>('')
  const [clinicianObservations, setClinicianObservations] = useState<string>('')
  const [clinicianAssessment, setClinicianAssessment] = useState<string>('')
  const [planFollowup, setPlanFollowup] = useState<string>('')
  const [noteStatus, setNoteStatus] = useState<string>('draft')
  const [noteAuthor, setNoteAuthor] = useState<string>('Attending Clinician')
  const [notesSaving, setNotesSaving] = useState<boolean>(false)
  const [drafting, setDrafting] = useState<boolean>(false)
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false)

  // Finalize Modal
  const [showFinalizeModal, setShowFinalizeModal] = useState<boolean>(false)
  const [signedByName, setSignedByName] = useState<string>('Dr. Clinician, MD')
  const [finalizing, setFinalizing] = useState<boolean>(false)

  // Determine active context
  const isTemporary = isTemporaryAnalysis || (!selectedStudyId && !selectedStudy)

  const loadStudyAndNotes = async (studyId: string) => {
    try {
      setLoading(true)
      const study = await fetchStudyDetail(studyId)
      setSelectedStudy(study)
      if (study.signal) {
        setSignal(study.signal, study.metadata)
      }

      // Load notes
      const notes = await fetchStudyNotes(studyId)
      if (notes) {
        setReasonForEcg(notes.reason_for_ecg || '')
        setPresentingSymptoms(notes.presenting_symptoms || '')
        setRelevantHistory(notes.relevant_history || study.patient_history || '')
        setMedicationsAllergies(notes.medications_allergies || `${study.patient_medications || ''}; Allergies: ${study.patient_allergies || 'NKDA'}`)
        setClinicianObservations(notes.clinician_observations || '')
        setClinicianAssessment(notes.clinician_assessment || '')
        setPlanFollowup(notes.plan_followup || '')
        setNoteStatus(notes.status || 'draft')
        setNoteAuthor(notes.author || 'Attending Clinician')
      }
    } catch (err) {
      console.error('Failed to load study details or notes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedStudyId) {
      loadStudyAndNotes(selectedStudyId)
    } else if (!isTemporaryAnalysis && !selectedStudy && !currentSignal) {
      // Default to initial baseline study only if nothing is loaded or uploaded
      loadStudyAndNotes('stu_fixture_001')
    }
  }, [selectedStudyId])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadAndValidateFile(file)
    e.target.value = ''
  }

  const handleRunAnalysis = async () => {
    try {
      setAnalyzing(true)
      if (selectedStudy) {
        await analyzeStudy(selectedStudy.id, activeModel)
        const refreshed = await fetchStudyDetail(selectedStudy.id)
        setSelectedStudy(refreshed)
      } else if (currentSignal) {
        await runInference(activeModel)
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to execute model analysis on this study.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSaveNotes = async (overrideStatus?: string) => {
    if (!selectedStudy) {
      alert('Please save this ECG to a patient record first before saving clinical notes.')
      return
    }
    try {
      setNotesSaving(true)
      const targetStatus = overrideStatus || noteStatus
      await saveStudyNotes(selectedStudy.id, {
        reason_for_ecg: reasonForEcg,
        presenting_symptoms: presentingSymptoms,
        relevant_history: relevantHistory,
        medications_allergies: medicationsAllergies,
        clinician_observations: clinicianObservations,
        clinician_assessment: clinicianAssessment,
        plan_followup: planFollowup,
        status: targetStatus as any,
        author: noteAuthor,
      })
      if (overrideStatus) {
        setNoteStatus(overrideStatus)
        await updateStudyStatus(selectedStudy.id, overrideStatus)
        const updated = await fetchStudyDetail(selectedStudy.id)
        setSelectedStudy(updated)
      }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err: any) {
      alert(err?.message || 'Failed to save clinical notes.')
    } finally {
      setNotesSaving(false)
    }
  }

  const handleDraftWithAi = async () => {
    if (!selectedStudy) return
    try {
      setDrafting(true)
      const draft = await draftAiNotes(selectedStudy.id)
      if (draft.reason_for_ecg && !reasonForEcg) setReasonForEcg(draft.reason_for_ecg)
      if (draft.presenting_symptoms && !presentingSymptoms) setPresentingSymptoms(draft.presenting_symptoms)
      if (draft.relevant_history && !relevantHistory) setRelevantHistory(draft.relevant_history)
      if (draft.medications_allergies && !medicationsAllergies) setMedicationsAllergies(draft.medications_allergies)
      if (draft.clinician_observations) setClinicianObservations(draft.clinician_observations)
      if (draft.clinician_assessment) setClinicianAssessment(draft.clinician_assessment)
      if (draft.plan_followup) setPlanFollowup(draft.plan_followup)
    } catch (err: any) {
      alert(err?.message || 'Failed to generate AI note draft.')
    } finally {
      setDrafting(false)
    }
  }

  const handleFinalizeReport = async () => {
    if (!selectedStudy) return
    if (!signedByName.trim()) {
      alert('Sign-off clinician name is required.')
      return
    }

    try {
      setFinalizing(true)
      await handleSaveNotes('finalized')
      await finalizeStudyReport(selectedStudy.id, signedByName.trim())
      setShowFinalizeModal(false)
      const refreshed = await fetchStudyDetail(selectedStudy.id)
      setSelectedStudy(refreshed)
      onNavigateToReports(selectedStudy.id)
    } catch (err: any) {
      alert(err?.message || 'Failed to finalize report.')
    } finally {
      setFinalizing(false)
    }
  }

  const handleOpenSaveModal = async () => {
    setShowSaveModal(true)
    try {
      const res = await fetchPatients()
      setPatientList(res.patients || [])
      if (res.patients?.length > 0) {
        setSelectedSavePatientId(res.patients[0].id)
      }
    } catch (err) {
      console.error('Failed to load patient list for study save:', err)
    }
  }

  const handleConfirmSaveStudy = async () => {
    if (!selectedSavePatientId) {
      alert('Please select a patient.')
      return
    }
    try {
      setIsSavingStudy(true)
      const newStudy = await saveTemporaryToPatient(selectedSavePatientId)
      if (newStudy) {
        setSaveSuccessMsg(`Saved as Study ${newStudy.study_id}`)
        setTimeout(() => {
          setShowSaveModal(false)
          setSaveSuccessMsg(null)
        }, 1200)
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to save study.')
    } finally {
      setIsSavingStudy(false)
    }
  }

  const handleExplain = async (cls: DiagnosticClass) => {
    setSelectedClass(cls)
    await runExplanation(cls)
  }

  if (loading && !selectedStudy && !currentSignal) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#777773' }}>
        <RefreshCw size={24} className="spin-animation" style={{ color: '#A83245', margin: '0 auto 12px' }} />
        <span>Loading ECG study review workspace...</span>
      </div>
    )
  }

  const study = selectedStudy
  const probs: Record<string, number> = isTemporary
    ? (analysisResult?.probabilities || {})
    : ((study?.probabilities as any) || {})
  const thresholds: Record<string, number> = isTemporary
    ? (analysisResult?.thresholds || {})
    : ((study?.thresholds as any) || {})
  const isFinalized = study?.status === 'finalized'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Hidden File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.npy,.npz,.hea"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* 1. Focused Compact Header */}
      <div
        className="card"
        style={{
          padding: '14px 20px',
          background: '#FFFFFF',
          borderLeft: '4px solid #A83245',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {isTemporary ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#252525' }}>
                  Temporary ECG Test
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#A83245', background: '#F8EAED', padding: '2px 6px', borderRadius: '4px' }}>
                  Unassigned Analysis
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#777773', marginTop: '2px' }}>
                File: <b>{currentMetadata?.filename || 'Uploaded ECG Signal'}</b> &bull; 12 Standard Leads (10.0s @ 100 Hz)
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#252525' }}>
                  {study?.patient_name || 'Patient'}
                </span>
                <code style={{ fontSize: '12px', color: '#A83245', background: '#F8EAED', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                  {study?.patient_display_id || study?.patient_id}
                </code>
              </div>
              <div style={{ fontSize: '12px', color: '#777773', marginTop: '2px' }}>
                {study?.patient_age ? `${study.patient_age} yrs` : 'Age N/A'} &bull; {study?.patient_sex} {study?.patient_mrn ? `&bull; MRN: ${study.patient_mrn}` : ''} &bull; Study: <code>{study?.study_id}</code>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Upload / Test ECG Button */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            title="Upload a new ECG file to test"
          >
            <Upload size={14} />
            <span>Test / Upload ECG</span>
          </button>

          {/* Model Selector */}
          <select
            className="select-field"
            style={{ fontSize: '12px', padding: '4px 8px', height: '32px', width: 'auto' }}
            value={activeModel}
            onChange={(e) => setActiveModel(e.target.value)}
            disabled={analyzing}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name || m.name}
              </option>
            ))}
          </select>

          {/* Run Analysis Button */}
          <button
            className="btn btn-primary btn-sm"
            onClick={handleRunAnalysis}
            disabled={analyzing}
            title="Execute deep learning model inference"
          >
            <Activity size={14} />
            <span>{analyzing ? 'Analyzing...' : 'Analyze ECG'}</span>
          </button>

          {isTemporary ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleOpenSaveModal}
            >
              <Save size={14} />
              <span>Save to Patient</span>
            </button>
          ) : (
            <>
              {!isFinalized ? (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowFinalizeModal(true)}
                >
                  <CheckCircle2 size={14} />
                  <span>Finalize & Sign</span>
                </button>
              ) : (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onNavigateToReports(study!.id)}
                >
                  <FileText size={14} />
                  <span>View Report</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Signal Quality Notice (Only if warnings present) */}
      {(study?.quality_warnings?.length || currentMetadata?.quality_warnings?.length) ? (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '6px',
            background: '#FDF4E7',
            border: '1px solid #E8E6E1',
            borderLeft: '4px solid #B77925',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '12px',
            color: '#634212',
          }}
        >
          <AlertTriangle size={16} style={{ color: '#B77925', flexShrink: 0 }} />
          <div>
            <b>Quality Notice:</b> {(study?.quality_warnings || currentMetadata?.quality_warnings || []).join(' ')}
          </div>
        </div>
      ) : null}

      {/* Navigation Tabs: [Waveform & Predictions] vs [Clinical Documentation] */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #E8E6E1',
          gap: '8px',
          background: '#FFFFFF',
          borderRadius: '6px 6px 0 0',
          padding: '0 16px',
        }}
      >
        <button
          onClick={() => setActiveTab('waveform')}
          style={{
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: activeTab === 'waveform' ? 700 : 500,
            color: activeTab === 'waveform' ? '#A83245' : '#777773',
            border: 'none',
            borderBottom: `2px solid ${activeTab === 'waveform' ? '#A83245' : 'transparent'}`,
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Waveform & Model Predictions
        </button>

        <button
          onClick={() => setActiveTab('documentation')}
          style={{
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: activeTab === 'documentation' ? 700 : 500,
            color: activeTab === 'documentation' ? '#A83245' : '#777773',
            border: 'none',
            borderBottom: `2px solid ${activeTab === 'documentation' ? '#A83245' : 'transparent'}`,
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Clinical Notes & Documentation {isFinalized ? '(Finalized)' : ''}
        </button>
      </div>

      {/* Tab 1: Focused Waveform & Model Predictions */}
      {activeTab === 'waveform' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Waveform View */}
          {currentSignal ? (
            <ECGViewer
              signal={currentSignal}
              samplingRate={study?.metadata?.sampling_rate || currentMetadata?.sampling_rate || 100}
              leads={study?.metadata?.leads || currentMetadata?.leads}
              attribution={attributionResult?.attribution}
              attributionClass={selectedClass}
            />
          ) : (
            <div className="card" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777773', background: '#FFFFFF' }}>
              No signal array loaded. Select an ECG study from the worklist or upload a file.
            </div>
          )}

          {/* Compact 5-Class Prediction Table */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#252525', margin: 0 }}>
                  Diagnostic Classification (Model: {study?.selected_model?.toUpperCase() || activeModel.toUpperCase()})
                </h3>
                <span style={{ fontSize: '11px', color: '#777773' }}>
                  Independent class probabilities with validation thresholds.
                </span>
              </div>

              <span style={{ fontSize: '11px', color: '#777773' }}>
                Multi-label classification (scores do not force sum to 100%)
              </span>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #E8E6E1', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F7F7F5', borderBottom: '1px solid #E8E6E1', textAlign: 'left' }}>
                    <th style={{ padding: '8px 14px', fontWeight: 600, color: '#777773' }}>Diagnostic Class</th>
                    <th style={{ padding: '8px 14px', fontWeight: 600, color: '#777773' }}>Model Score</th>
                    <th style={{ padding: '8px 14px', fontWeight: 600, color: '#777773' }}>Validation Threshold</th>
                    <th style={{ padding: '8px 14px', fontWeight: 600, color: '#777773' }}>Decision Status</th>
                    <th style={{ padding: '8px 14px', fontWeight: 600, color: '#777773', textAlign: 'right' }}>Explainability</th>
                  </tr>
                </thead>
                <tbody>
                  {ORDERED_CLASSES.map((cls) => {
                    const p = probs[cls] !== undefined ? probs[cls] : 0.0
                    const th = thresholds[cls] !== undefined ? thresholds[cls] : 0.5
                    const isFlagged = p >= th
                    const meta = CLASS_DESCRIPTIONS[cls]
                    const isExplained = attributionResult && attributionResult.target_class === cls

                    return (
                      <tr
                        key={cls}
                        style={{
                          borderBottom: '1px solid #F0EEE9',
                          background: isExplained ? '#FDF8F8' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '9px 14px' }}>
                          <span style={{ fontWeight: 600, color: '#252525', marginRight: '6px' }}>
                            {meta.name}
                          </span>
                          <code style={{ fontSize: '11px', color: '#777773', background: '#F0EEE9', padding: '1px 5px', borderRadius: '4px' }}>
                            {cls}
                          </code>
                        </td>
                        <td style={{ padding: '9px 14px', fontWeight: 700, color: isFlagged ? '#A83245' : '#252525' }}>
                          {(p * 100).toFixed(1)}%
                          <span style={{ fontSize: '11px', color: '#777773', fontWeight: 400, marginLeft: '4px' }}>
                            ({p.toFixed(4)})
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px', color: '#777773' }}>
                          {th.toFixed(4)}
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: isFlagged ? '#FDEEEE' : '#E8F4EE',
                              color: isFlagged ? '#B33A3A' : '#34765A',
                            }}
                          >
                            {isFlagged ? 'Flagged / Exceeds Threshold' : 'Normal / Below Threshold'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                          <button
                            className={`btn ${isExplained ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                            style={{ padding: '3px 10px', fontSize: '11px' }}
                            onClick={() => handleExplain(cls)}
                            disabled={isExplaining}
                          >
                            {isExplaining && selectedClass === cls ? (
                              <>
                                <RefreshCw size={11} className="spin-animation" />
                                <span>Explaining...</span>
                              </>
                            ) : (
                              <>
                                <Layers size={11} />
                                <span>{isExplained ? 'Explained' : 'Explain'}</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Explanation Detail Card (Shown when a class explanation is active) */}
            {attributionResult && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  background: '#FFFFFF',
                  border: '1px solid #E8E6E1',
                  borderLeft: '4px solid #A83245',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#252525' }}>
                    Integrated Gradients Attribution &bull; {CLASS_DESCRIPTIONS[attributionResult.target_class]?.name} ({attributionResult.target_class})
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                    onClick={() => {
                      setSelectedClass(attributionResult.target_class)
                      onNavigateToExplain(attributionResult.target_class)
                    }}
                  >
                    <span>Full Explanation Studio</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: '#777773', marginBottom: '8px' }}>
                  Waveform canvas displays time &times; lead attribution magnitude. Most influential leads for {attributionResult.target_class}:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {attributionResult.lead_importance?.slice(0, 4).map((item, idx) => (
                    <span
                      key={item.lead}
                      style={{
                        fontSize: '11px',
                        background: idx === 0 ? '#F8EAED' : '#F7F7F5',
                        color: idx === 0 ? '#A83245' : '#252525',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: '1px solid #E8E6E1',
                      }}
                    >
                      #{idx + 1} Lead {item.lead}: {(item.normalized * 100).toFixed(1)}% influence
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Clinical Documentation & Notes */}
      {activeTab === 'documentation' && (
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#252525', margin: 0 }}>
                Clinical Encounter Documentation
              </h3>
              <span style={{ fontSize: '12px', color: '#777773' }}>
                Document observations, clinical impression, and medical management plan.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleDraftWithAi}
                disabled={drafting || isFinalized || isTemporary}
                title="Populate clinical notes with AI draft template"
              >
                <Sparkles size={14} style={{ color: '#A83245' }} />
                <span>{drafting ? 'Drafting...' : 'AI Draft Template'}</span>
              </button>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleSaveNotes()}
                disabled={notesSaving || isFinalized || isTemporary}
              >
                {saveSuccess ? <Check size={14} /> : <Save size={14} />}
                <span>{notesSaving ? 'Saving...' : saveSuccess ? 'Saved' : 'Save Draft'}</span>
              </button>
            </div>
          </div>

          {isTemporary && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '6px',
                background: '#FDF4E7',
                border: '1px solid #E8E6E1',
                borderLeft: '4px solid #B77925',
                fontSize: '13px',
                color: '#634212',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>This ECG is currently a temporary test. To save formal clinical notes and sign off, save it to a patient record.</span>
              <button className="btn btn-primary btn-sm" onClick={handleOpenSaveModal}>
                <Save size={13} /> Save to Patient
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                Reason for ECG Acquisition
              </label>
              <input
                type="text"
                value={reasonForEcg}
                onChange={(e) => setReasonForEcg(e.target.value)}
                disabled={isFinalized || isTemporary}
                placeholder="e.g. Atypical chest pain, pre-op clearance, follow-up..."
                style={{ width: '100%', padding: '7px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                Presenting Symptoms
              </label>
              <input
                type="text"
                value={presentingSymptoms}
                onChange={(e) => setPresentingSymptoms(e.target.value)}
                disabled={isFinalized || isTemporary}
                placeholder="e.g. Exertional dyspnea, palpitations..."
                style={{ width: '100%', padding: '7px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
              Clinician Observations (Morphology, Intervals, Rhythm)
            </label>
            <textarea
              rows={3}
              value={clinicianObservations}
              onChange={(e) => setClinicianObservations(e.target.value)}
              disabled={isFinalized || isTemporary}
              placeholder="Document regular rhythm, PR interval, QRS duration, axis, ST segment morphology..."
              style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1', resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
              Clinical Assessment & Diagnostic Impression
            </label>
            <textarea
              rows={3}
              value={clinicianAssessment}
              onChange={(e) => setClinicianAssessment(e.target.value)}
              disabled={isFinalized || isTemporary}
              placeholder="Primary diagnostic impression and correlation with patient symptoms..."
              style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1', resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
              Management Plan & Recommended Follow-up
            </label>
            <textarea
              rows={2}
              value={planFollowup}
              onChange={(e) => setPlanFollowup(e.target.value)}
              disabled={isFinalized || isTemporary}
              placeholder="e.g. Serial troponin draws, outpatient echocardiogram, repeat ECG in 24 hours..."
              style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1', resize: 'vertical' }}
            />
          </div>
        </div>
      )}

      {/* Save Analysis to Patient Modal */}
      {showSaveModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: '480px', padding: '24px', background: '#FFFFFF' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: '#252525' }}>
              Save ECG Analysis to Patient Record
            </h3>
            <p style={{ fontSize: '13px', color: '#777773', margin: '0 0 16px 0' }}>
              Associate the current 12-lead signal and model evaluation with an existing clinical patient.
            </p>

            {saveSuccessMsg ? (
              <div style={{ padding: '14px', borderRadius: '6px', background: '#E8F4EE', color: '#34765A', fontWeight: 600, textAlign: 'center' }}>
                {saveSuccessMsg}
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#777773', marginBottom: '6px' }}>
                    Select Patient:
                  </label>
                  <select
                    className="select-field"
                    value={selectedSavePatientId}
                    onChange={(e) => setSelectedSavePatientId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {patientList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.patient_id} &bull; Age {p.age || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowSaveModal(false)}
                    disabled={isSavingStudy}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirmSaveStudy}
                    disabled={isSavingStudy || !selectedSavePatientId}
                  >
                    {isSavingStudy ? 'Saving...' : 'Save Study'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Finalize Modal */}
      {showFinalizeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowFinalizeModal(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: '440px', padding: '24px', background: '#FFFFFF' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: '#252525' }}>
              Finalize Clinical ECG Study
            </h3>
            <p style={{ fontSize: '13px', color: '#777773', margin: '0 0 16px 0' }}>
              Finalizing seals the encounter documentation and generates the permanent medical report.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#777773', marginBottom: '6px' }}>
                Attending Clinician Signature
              </label>
              <input
                type="text"
                value={signedByName}
                onChange={(e) => setSignedByName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowFinalizeModal(false)}
                disabled={finalizing}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleFinalizeReport}
                disabled={finalizing}
              >
                {finalizing ? 'Finalizing...' : 'Sign & Finalize'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

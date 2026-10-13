import React, { useEffect, useState } from 'react'
import {
  Activity,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  Save,
  Check,
  Send,
  HelpCircle,
  ExternalLink,
  RefreshCw,
  Sliders,
  ShieldCheck,
  ChevronRight,
  Info,
} from 'lucide-react'
import {
  ECGStudy,
  DiagnosticClass,
  ClinicalNote,
  SignalMetadata,
} from '../types'
import {
  fetchStudyDetail,
  analyzeStudy,
  fetchStudyNotes,
  saveStudyNotes,
  draftAiNotes,
  updateStudyStatus,
  finalizeStudyReport,
} from '../api'
import { ECGViewer } from './ECGViewer'
import { useAnalysis } from '../context/AnalysisContext'

interface ClinicalECGReviewViewProps {
  onNavigateToExplain: (targetClass: DiagnosticClass) => void
  onNavigateToReports: (studyId: string) => void
}

const CLASS_DESCRIPTIONS: Record<DiagnosticClass, { name: string; desc: string; caveat: string }> = {
  NORM: {
    name: 'Normal ECG',
    desc: 'Normal sinus rhythm and standard morphology limits without gross axis deviation.',
    caveat: 'A normal ECG does not exclude non-ischemic cardiomyopathy or paroxysmal arrhythmias.',
  },
  MI: {
    name: 'Myocardial Infarction',
    desc: 'Pathological Q-waves, acute ST-segment elevation, or loss of anterior R-wave progression.',
    caveat: 'Requires correlation with serial cardiac troponins and prior baseline tracings.',
  },
  STTC: {
    name: 'ST/T-Change',
    desc: 'ST-segment depressions or primary T-wave inversions indicating repolarization disturbance.',
    caveat: 'Can be induced by ischemia, electrolyte imbalance, medications, or rate-related strain.',
  },
  CD: {
    name: 'Conduction Disturbance',
    desc: 'Intraventricular conduction delay (LBBB, RBBB, fascicular block) or AV node prolongation.',
    caveat: 'Wide QRS alters secondary ST-T repolarization interpretations.',
  },
  HYP: {
    name: 'Hypertrophy',
    desc: 'Voltage criteria and strain patterns consistent with left or right ventricular enlargement.',
    caveat: 'Voltage criteria sensitivity is influenced by age, body habitus, and chest wall anatomy.',
  },
}

export const ClinicalECGReviewView: React.FC<ClinicalECGReviewViewProps> = ({
  onNavigateToExplain,
  onNavigateToReports,
}) => {
  const {
    selectedStudyId,
    selectedStudy,
    setSelectedStudy,
    currentSignal,
    setSignal,
    activeModel,
    setSelectedClass,
  } = useAnalysis()

  const [loading, setLoading] = useState<boolean>(false)
  const [analyzing, setAnalyzing] = useState<boolean>(false)
  const [notesSaving, setNotesSaving] = useState<boolean>(false)
  const [drafting, setDrafting] = useState<boolean>(false)
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false)

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

  // Finalize Modal
  const [showFinalizeModal, setShowFinalizeModal] = useState<boolean>(false)
  const [signedByName, setSignedByName] = useState<string>('Dr. Clinician, MD')
  const [finalizing, setFinalizing] = useState<boolean>(false)

  const activeStudyId = selectedStudyId || selectedStudy?.id || 'stu_fixture_001'

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
    if (activeStudyId) {
      loadStudyAndNotes(activeStudyId)
    }
  }, [activeStudyId])

  const handleRunAnalysis = async () => {
    if (!selectedStudy) return
    try {
      setAnalyzing(true)
      const res = await analyzeStudy(selectedStudy.id, activeModel)
      // Refresh study details
      const refreshed = await fetchStudyDetail(selectedStudy.id)
      setSelectedStudy(refreshed)
    } catch (err: any) {
      alert(err?.message || 'Failed to execute model analysis on this study.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSaveNotes = async (overrideStatus?: string) => {
    if (!selectedStudy) return
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
      // First save latest notes
      await handleSaveNotes('finalized')
      // Then finalize report
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

  if (loading && !selectedStudy) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#777773' }}>
        <RefreshCw size={24} className="spin-animation" style={{ color: '#A83245', margin: '0 auto 12px' }} />
        <span>Loading ECG study review workspace...</span>
      </div>
    )
  }

  const study = selectedStudy
  const probs: Record<string, number> = (study?.probabilities as any) || {}
  const thresholds: Record<string, number> = (study?.thresholds as any) || {}
  const flags = study?.flags || []
  const isFinalized = study?.status === 'finalized'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* 1. Context Banner: Patient & Study Header */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          background: '#FFFFFF',
          borderLeft: '4px solid #A83245',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#252525' }}>
                {study?.patient_name || 'Patient'}
              </span>
              <code style={{ fontSize: '12px', color: '#A83245', background: '#F8EAED', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                {study?.patient_display_id || study?.patient_id}
              </code>
            </div>
            <div style={{ fontSize: '12px', color: '#777773', marginTop: '2px' }}>
              {study?.patient_age ? `${study.patient_age} yrs` : 'Age N/A'} \u2022 {study?.patient_sex} {study?.patient_mrn ? `\u2022 MRN: ${study.patient_mrn}` : ''}
            </div>
          </div>

          <div style={{ width: '1px', height: '36px', background: '#E8E6E1' }} />

          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#252525' }}>
              Study: <code>{study?.study_id}</code>
            </div>
            <div style={{ fontSize: '12px', color: '#777773', marginTop: '2px' }}>
              Acquired: {study?.recorded_at?.slice(0, 16)} \u2022 12 Standard Leads (10.0s)
            </div>
          </div>

          <div style={{ width: '1px', height: '36px', background: '#E8E6E1' }} />

          <div>
            <div style={{ fontSize: '11px', color: '#777773', textTransform: 'uppercase', fontWeight: 600 }}>
              Signal Quality
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: study?.quality_status === 'optimal' ? '#34765A' : '#B77925', marginTop: '2px' }}>
              {study?.quality_status?.replace('_', ' ').toUpperCase()} (QI: {study?.quality_score?.toFixed(2)})
            </div>
          </div>
        </div>

        {/* Status Pill & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '6px',
              background: isFinalized ? '#E8F4EE' : '#FDF4E7',
              color: isFinalized ? '#34765A' : '#B77925',
              textTransform: 'uppercase',
            }}
          >
            {isFinalized ? '\u2713 Finalized Encounter' : `Status: ${study?.status?.replace('_', ' ')}`}
          </span>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRunAnalysis}
            disabled={analyzing}
            title="Re-run deep inference on this study waveform"
          >
            <Activity size={14} style={{ color: '#A83245' }} />
            <span>{analyzing ? 'Analyzing...' : 'Run AI Analysis'}</span>
          </button>

          {!isFinalized && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowFinalizeModal(true)}
            >
              <CheckCircle2 size={14} />
              <span>Finalize & Sign</span>
            </button>
          )}

          {isFinalized && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateToReports(study!.id)}
            >
              <FileText size={14} />
              <span>View Report</span>
            </button>
          )}
        </div>
      </div>

      {/* Signal Quality Warnings Banner (if present) */}
      {study?.quality_warnings && study.quality_warnings.length > 0 && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: '#FDF4E7',
            border: '1px solid #E8E6E1',
            borderLeft: '4px solid #B77925',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '13px',
            color: '#634212',
          }}
        >
          <AlertTriangle size={18} style={{ color: '#B77925', flexShrink: 0 }} />
          <div>
            <b>Quality Validation Notice:</b> {study.quality_warnings.join(' ')}
          </div>
        </div>
      )}

      {/* Main 2-Column Clinical Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '20px' }}>
        {/* Left Side: 12-Lead ECG Viewer + AI Model Findings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Waveform Card */}
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#252525', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                12-Lead Electrocardiogram Waveform
              </span>
              <span style={{ fontSize: '11px', color: '#777773' }}>
                Standard 10 mm/mV \u2022 25 mm/s Grid Calibration
              </span>
            </div>

            {currentSignal ? (
              <div style={{ height: '520px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #E8E6E1' }}>
                <ECGViewer
                  signal={currentSignal}
                  samplingRate={study?.metadata?.sampling_rate || 100}
                />
              </div>
            ) : (
              <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777773' }}>
                No signal array loaded for this study.
              </div>
            )}
          </div>

          {/* AI Model Findings Panel */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#252525', margin: 0 }}>
                  AI Pattern Analysis (Model: {study?.selected_model?.toUpperCase() || activeModel.toUpperCase()})
                </h3>
                <span style={{ fontSize: '12px', color: '#777773' }}>
                  Independent probabilities with decision thresholds. Results support clinical review.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(['NORM', 'MI', 'STTC', 'CD', 'HYP'] as DiagnosticClass[]).map((cls) => {
                const p = probs[cls] !== undefined ? probs[cls] : 0.0
                const th = thresholds[cls] !== undefined ? thresholds[cls] : 0.5
                const isFlagged = p >= th
                const meta = CLASS_DESCRIPTIONS[cls]

                return (
                  <div
                    key={cls}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '6px',
                      border: `1px solid ${isFlagged ? 'rgba(168, 50, 69, 0.3)' : '#E8E6E1'}`,
                      background: isFlagged ? '#FDF8F8' : '#FFFFFF',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#252525' }}>
                          {meta.name}
                        </span>
                        <code style={{ fontSize: '11px', color: '#777773', background: '#F0EEE9', padding: '1px 5px', borderRadius: '4px' }}>
                          {cls}
                        </code>
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
                          {isFlagged ? 'MODEL FLAGGED' : 'NON-SIGNIFICANT'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#777773', marginTop: '3px' }}>
                        {meta.desc}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: isFlagged ? '#A83245' : '#252525' }}>
                          {p.toFixed(3)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#777773' }}>
                          Threshold: {th.toFixed(3)}
                        </div>
                      </div>

                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => onNavigateToExplain(cls)}
                        style={{ fontSize: '12px', color: '#A83245' }}
                        title={`Inspect Integrated Gradients explanation for ${cls} in Research Lab`}
                      >
                        <span>Explain</span>
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div
              style={{
                marginTop: '16px',
                padding: '10px 14px',
                borderRadius: '6px',
                background: '#F7F7F5',
                border: '1px solid #E8E6E1',
                fontSize: '11px',
                color: '#777773',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              <ShieldCheck size={14} style={{ color: '#B77925', flexShrink: 0 }} />
              <span>
                Model scores represent pattern likelihoods and do not sum to 100%. Clinical correlation is required.
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Structured Clinical Notes Editor */}
        <div
          className="card"
          style={{
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#252525', margin: 0 }}>
                Structured Clinical Notes & Interpretation
              </h3>
              <span style={{ fontSize: '12px', color: '#777773' }}>
                Document observations, clinical impression, and patient management plan.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleDraftWithAi}
                disabled={drafting || isFinalized}
                title="Generate deterministic draft from patient history and model findings"
              >
                <Sparkles size={14} style={{ color: '#A83245' }} />
                <span>{drafting ? 'Drafting...' : 'AI Draft Template'}</span>
              </button>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleSaveNotes()}
                disabled={notesSaving || isFinalized}
              >
                {saveSuccess ? <Check size={14} /> : <Save size={14} />}
                <span>{notesSaving ? 'Saving...' : saveSuccess ? 'Saved' : 'Save Draft'}</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                Reason for ECG Acquisition
              </label>
              <input
                type="text"
                value={reasonForEcg}
                onChange={(e) => setReasonForEcg(e.target.value)}
                disabled={isFinalized}
                placeholder="e.g. Atypical chest pain, pre-operative clearance, routine post-MI follow-up..."
                style={{ width: '100%', padding: '7px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                Presenting Symptoms (Clinician-Entered)
              </label>
              <input
                type="text"
                value={presentingSymptoms}
                onChange={(e) => setPresentingSymptoms(e.target.value)}
                disabled={isFinalized}
                placeholder="e.g. Exertional retrosternal tightness, palpitations, dyspnea..."
                style={{ width: '100%', padding: '7px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                Clinician's ECG Observations (Rhythm, Axis, Waves, Intervals)
              </label>
              <textarea
                rows={5}
                value={clinicianObservations}
                onChange={(e) => setClinicianObservations(e.target.value)}
                disabled={isFinalized}
                placeholder="Enter rhythm analysis (sinus rhythm, rate), axis, PR/QRS/QTc intervals, ST-T segment changes, Q-waves..."
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1', lineHeight: '1.4' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                Clinician's Assessment & Clinical Impression
              </label>
              <textarea
                rows={4}
                value={clinicianAssessment}
                onChange={(e) => setClinicianAssessment(e.target.value)}
                disabled={isFinalized}
                placeholder="Overall clinical impression and diagnostic interpretation..."
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1', lineHeight: '1.4' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                Management Plan & Follow-Up
              </label>
              <textarea
                rows={3}
                value={planFollowup}
                onChange={(e) => setPlanFollowup(e.target.value)}
                disabled={isFinalized}
                placeholder="Diagnostic follow-up, cardiology consultation, serial biomarker schedule, medication adjustments..."
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1', lineHeight: '1.4' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #E8E6E1' }}>
              <div style={{ fontSize: '12px', color: '#777773' }}>
                <b>Attending:</b> {noteAuthor} \u2022 <b>Status:</b> <span style={{ textTransform: 'capitalize' }}>{noteStatus}</span>
              </div>

              {!isFinalized && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleSaveNotes('reviewed')}
                >
                  <Check size={14} />
                  <span>Mark as Reviewed</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Finalize Encounter Confirmation Modal */}
      {showFinalizeModal && (
        <div className="modal-backdrop">
          <div className="card modal-dialog" style={{ width: '500px', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#252525', marginBottom: '8px' }}>
              Finalize & Sign Clinical Encounter
            </h3>
            <p style={{ fontSize: '13px', color: '#777773', marginBottom: '16px' }}>
              Finalizing freezes this study encounter report. The patient demographics, waveform parameters,
              AI findings, and clinician interpretation will be permanently recorded into the official report.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                Attending Clinician Signature / Full Name *
              </label>
              <input
                type="text"
                required
                value={signedByName}
                onChange={(e) => setSignedByName(e.target.value)}
                placeholder="e.g. Dr. Jane Smith, MD, FACC"
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
              />
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                background: '#FDF4E7',
                border: '1px solid #E8E6E1',
                fontSize: '11px',
                color: '#634212',
                marginBottom: '20px',
              }}
            >
              <b>Legal Notice:</b> By finalizing, you confirm that you have personally evaluated the electrocardiographic
              waveform and that AI model outputs are used solely as decision-support guidance.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setShowFinalizeModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleFinalizeReport} disabled={finalizing}>
                {finalizing ? 'Finalizing...' : 'Confirm & Finalize Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

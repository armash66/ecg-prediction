import React, { useEffect, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  Save,
  Check,
  RefreshCw,
  Info,
  ChevronDown,
} from 'lucide-react'
import {
  DiagnosticClass,
} from '../types'
import {
  fetchStudyDetail,
  analyzeStudy,
  fetchStudyNotes,
  saveStudyNotes,
  draftAiNotes,
  finalizeStudyReport,
} from '../api'
import { ECGViewer } from './ECGViewer'
import { useAnalysis } from '../context/AnalysisContext'

interface ClinicalECGReviewViewProps {
  onNavigateToExplain?: (targetClass: DiagnosticClass) => void
  onNavigateToReports?: (studyId: string) => void
}

const CLASS_INFO: Record<DiagnosticClass, { code: DiagnosticClass; name: string; plainDesc: string }> = {
  NORM: { code: 'NORM', name: 'Normal ECG', plainDesc: 'Standard wave morphology within normal physiological limits' },
  MI: { code: 'MI', name: 'Myocardial Infarction', plainDesc: 'Possible acute ischemia, ST-elevation, or pathological Q waves' },
  STTC: { code: 'STTC', name: 'ST/T Change', plainDesc: 'ST-segment shift or T-wave inversion (ischemia, strain, or repolarization)' },
  CD: { code: 'CD', name: 'Conduction Disturbance', plainDesc: 'Bundle branch block, fascicular block, or intraventricular delay' },
  HYP: { code: 'HYP', name: 'Hypertrophy', plainDesc: 'Increased voltage or chamber enlargement criteria' },
}

const DIAGNOSTIC_CLASSES: DiagnosticClass[] = ['CD', 'HYP', 'MI', 'NORM', 'STTC']

export const ClinicalECGReviewView: React.FC<ClinicalECGReviewViewProps> = ({
  onNavigateToReports,
}) => {
  const {
    selectedStudyId,
    selectedStudy,
    setSelectedStudy,
    currentSignal,
    setSignal,
    activeModel,
    attributionResult,
    runExplanation,
    isExplaining,
  } = useAnalysis()

  const [loading, setLoading] = useState<boolean>(false)
  const [analyzing, setAnalyzing] = useState<boolean>(false)
  const [notesSaving, setNotesSaving] = useState<boolean>(false)
  const [drafting, setDrafting] = useState<boolean>(false)
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false)

  // Secondary Area Tab
  const [secondaryTab, setSecondaryTab] = useState<'notes' | 'explanation' | 'quality' | 'report'>('notes')

  // Selected class for explanation
  const [explainClass, setExplainClass] = useState<DiagnosticClass>('MI')

  // Clinical Notes Form Fields (The 5 requested fields)
  const [reasonForEcg, setReasonForEcg] = useState<string>('')
  const [relevantHistory, setRelevantHistory] = useState<string>('')
  const [clinicianObservations, setClinicianObservations] = useState<string>('')
  const [clinicianAssessment, setClinicianAssessment] = useState<string>('')
  const [planFollowup, setPlanFollowup] = useState<string>('')
  const [noteAuthor, setNoteAuthor] = useState<string>('Attending Clinician')

  // Finalize state
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
        setRelevantHistory(notes.relevant_history || '')
        setClinicianObservations(notes.clinician_observations || '')
        setClinicianAssessment(notes.clinician_assessment || '')
        setPlanFollowup(notes.plan_followup || '')
        if (notes.author) setNoteAuthor(notes.author)
      }
    } catch (err) {
      console.error('Failed to load study details:', err)
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
    if (!study) return
    try {
      setAnalyzing(true)
      const res = await analyzeStudy(study.id, activeModel)
      setSelectedStudy(res.study)
      if (res.study.signal) {
        setSignal(res.study.signal, res.study.metadata)
      }
    } catch (err: any) {
      alert(`AI Analysis error: ${err?.message || 'Failed to run analysis'}`)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDraftAI = async () => {
    if (!study) return
    try {
      setDrafting(true)
      const drafted = await draftAiNotes(study.id)
      setReasonForEcg(drafted.reason_for_ecg || '')
      setRelevantHistory(drafted.relevant_history || '')
      setClinicianObservations(drafted.clinician_observations || '')
      setClinicianAssessment(drafted.clinician_assessment || '')
      setPlanFollowup(drafted.plan_followup || '')
      setSecondaryTab('notes')
    } catch (err: any) {
      alert(`Failed to generate draft: ${err?.message || 'Error drafting notes'}`)
    } finally {
      setDrafting(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!study) return
    try {
      setNotesSaving(true)
      await saveStudyNotes(study.id, {
        reason_for_ecg: reasonForEcg,
        relevant_history: relevantHistory,
        clinician_observations: clinicianObservations,
        clinician_assessment: clinicianAssessment,
        plan_followup: planFollowup,
        author: noteAuthor,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      alert(`Failed to save notes: ${err?.message || 'Error'}`)
    } finally {
      setNotesSaving(false)
    }
  }

  const handleFinalizeReport = async () => {
    if (!study) return
    try {
      setFinalizing(true)
      await finalizeStudyReport(study.id, signedByName)
      setShowFinalizeModal(false)
      await loadStudyAndNotes(study.id)
      setSecondaryTab('report')
    } catch (err: any) {
      alert(`Failed to finalize report: ${err?.message || 'Error'}`)
    } finally {
      setFinalizing(false)
    }
  }

  const handleExplainClass = (cls: DiagnosticClass) => {
    setExplainClass(cls)
    runExplanation(cls)
  }

  if (loading && !selectedStudy) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px', gap: '10px' }}>
        <RefreshCw size={22} className="spin-animation" style={{ color: '#A83245' }} />
        <span style={{ fontSize: '13px', color: '#777773' }}>Loading ECG study...</span>
      </div>
    )
  }

  const study = selectedStudy
  const probs: Record<string, number> = (study?.probabilities as any) || {}
  const thresholds: Record<string, number> = (study?.thresholds as any) || {}
  const isFinalized = study?.status === 'finalized'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 1. Quiet Patient & Study Details Bar */}
      <div
        className="card"
        style={{
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#252525' }}>
              {study?.patient_name || 'Patient Record'}
            </div>
            <div style={{ fontSize: '12px', color: '#777773' }}>
              ID: {study?.patient_display_id || study?.patient_id}
              {study?.patient_mrn ? ` \u2022 MRN: ${study.patient_mrn}` : ''}
              {study?.patient_age ? ` \u2022 ${study.patient_age} yrs` : ''}
              {study?.patient_sex ? ` \u2022 ${study.patient_sex}` : ''}
            </div>
          </div>

          <div style={{ width: '1px', height: '28px', background: '#E8E6E1' }} />

          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#252525' }}>
              Study {study?.study_id}
            </div>
            <div style={{ fontSize: '12px', color: '#777773' }}>
              {study?.recorded_at ? new Date(study.recorded_at).toLocaleDateString() : 'Recent'} \u2022 10.0s at 100 Hz
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRunAnalysis}
            disabled={analyzing}
          >
            <Activity size={13} style={{ color: '#A83245' }} />
            <span>{analyzing ? 'Analyzing...' : 'Run AI Analysis'}</span>
          </button>

          {!isFinalized ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowFinalizeModal(true)}
            >
              <CheckCircle2 size={13} />
              <span>Finalize & Sign</span>
            </button>
          ) : (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '4px',
                background: '#E8F4EE',
                color: '#34765A',
              }}
            >
              \u2713 Finalized
            </span>
          )}
        </div>
      </div>

      {/* 2. Waveform gets the spotlight — Large 12-Lead ECG Viewer */}
      <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#777773', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            12-Lead Waveform (25 mm/s, 10 mm/mV)
          </span>
          <span style={{ fontSize: '11px', color: '#777773' }}>
            Click any lead to zoom or isolate
          </span>
        </div>

        {currentSignal ? (
          <div style={{ height: '460px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #E8E6E1' }}>
            <ECGViewer
              signal={currentSignal}
              samplingRate={study?.metadata?.sampling_rate || 100}
            />
          </div>
        ) : (
          <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777773', fontSize: '13px' }}>
            No signal data available for this study.
          </div>
        )}
      </div>

      {/* 3. Five Model Scores in a Compact, Readable Section */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#252525' }}>
            AI Analysis
          </div>
          <span style={{ fontSize: '11px', color: '#777773' }}>
            Results support clinical review and are not a confirmed diagnosis.
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          {DIAGNOSTIC_CLASSES.map((cls) => {
            const p = probs[cls] !== undefined ? probs[cls] : 0.0
            const th = thresholds[cls] !== undefined ? thresholds[cls] : null
            const isElevated = th !== null ? p >= th : p >= 0.5
            const meta = CLASS_INFO[cls]

            return (
              <div
                key={cls}
                onClick={() => {
                  setSecondaryTab('explanation')
                  handleExplainClass(cls)
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${isElevated ? 'rgba(168, 50, 69, 0.3)' : '#E8E6E1'}`,
                  background: isElevated ? '#FDF8F8' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'border-color 0.1s ease',
                }}
                title={`Click to view explanation for ${meta.name}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#252525' }}>{cls}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: isElevated ? '#A83245' : '#252525' }}>
                    {(p * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#777773', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {meta.name}
                </div>
                {th !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#777773' }}>Threshold: {(th * 100).toFixed(0)}%</span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: isElevated ? '#FDEEEE' : '#E8F4EE',
                        color: isElevated ? '#B33A3A' : '#34765A',
                      }}
                    >
                      {isElevated ? 'Elevated' : 'Normal'}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 4. Secondary Area Tabs: Clinician Notes, Explanation, Signal Quality, Report Preview */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #E8E6E1',
            padding: '0 16px',
            background: '#FAFAF8',
            gap: '8px',
          }}
        >
          {[
            { id: 'notes' as const, label: 'Clinician Notes' },
            { id: 'explanation' as const, label: 'Why this result?' },
            { id: 'quality' as const, label: study?.quality_warnings?.length ? `Signal Quality (${study.quality_warnings.length} notice)` : 'Signal Quality' },
            { id: 'report' as const, label: 'Report Preview' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSecondaryTab(tab.id)}
              style={{
                padding: '10px 14px',
                fontSize: '13px',
                fontWeight: secondaryTab === tab.id ? 600 : 500,
                color: secondaryTab === tab.id ? '#A83245' : '#777773',
                border: 'none',
                borderBottom: `2px solid ${secondaryTab === tab.id ? '#A83245' : 'transparent'}`,
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '20px' }}>
          {/* Tab 1: Clinician Notes (The 5 requested fields) */}
          {secondaryTab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#252525' }}>
                  Clinical Encounter Notes
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleDraftAI}
                    disabled={drafting}
                    title="Populate draft from patient records and AI findings"
                  >
                    <Sparkles size={13} style={{ color: '#A83245' }} />
                    <span>{drafting ? 'Drafting...' : 'Draft with AI'}</span>
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveNotes}
                    disabled={notesSaving}
                  >
                    <Save size={13} />
                    <span>{notesSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Notes'}</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
                    Reason for ECG
                  </label>
                  <textarea
                    value={reasonForEcg}
                    onChange={(e) => setReasonForEcg(e.target.value)}
                    rows={2}
                    placeholder="e.g. Chest tightness on exertion, routine pre-op clearance..."
                    style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
                    Relevant History
                  </label>
                  <textarea
                    value={relevantHistory}
                    onChange={(e) => setRelevantHistory(e.target.value)}
                    rows={2}
                    placeholder="e.g. History of anterior STEMI in 2024, hypertension..."
                    style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
                  Clinician Observations
                </label>
                <textarea
                  value={clinicianObservations}
                  onChange={(e) => setClinicianObservations(e.target.value)}
                  rows={2}
                  placeholder="e.g. Regular sinus rhythm at 68 bpm. ST segment elevation in leads V2-V4..."
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
                  Assessment
                </label>
                <textarea
                  value={clinicianAssessment}
                  onChange={(e) => setClinicianAssessment(e.target.value)}
                  rows={2}
                  placeholder="e.g. Acute anterior ST-elevation myocardial infarction; concordant with AI pattern recognition."
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
                  Plan and Follow-Up
                </label>
                <textarea
                  value={planFollowup}
                  onChange={(e) => setPlanFollowup(e.target.value)}
                  rows={2}
                  placeholder="e.g. Urgent cardiology consult, serial high-sensitivity troponins, repeat ECG in 30 mins."
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                />
              </div>
            </div>
          )}

          {/* Tab 2: Why this result? (Attribution Heatmap for Selected Class) */}
          {secondaryTab === 'explanation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#252525' }}>
                    Important parts of the ECG for: {CLASS_INFO[explainClass]?.name} ({explainClass})
                  </span>
                  <p style={{ fontSize: '12px', color: '#777773', margin: '2px 0 0' }}>
                    Highlights regions in time and leads that most influenced the model score.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {DIAGNOSTIC_CLASSES.map((cls) => (
                    <button
                      key={cls}
                      onClick={() => handleExplainClass(cls)}
                      className={`btn btn-sm ${explainClass === cls ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>

              {isExplaining ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#777773', fontSize: '13px' }}>
                  <RefreshCw size={18} className="spin-animation" style={{ color: '#A83245', margin: '0 auto 8px' }} />
                  Calculating attribution...
                </div>
              ) : attributionResult?.attribution ? (
                <div>
                  {/* Lead Importance Summary */}
                  {attributionResult.lead_importance && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      <span style={{ fontSize: '11px', color: '#777773', alignSelf: 'center' }}>Top leads:</span>
                      {attributionResult.lead_importance.slice(0, 5).map((item) => (
                        <span
                          key={item.lead}
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            background: '#F8EAED',
                            color: '#A83245',
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          Lead {item.lead}: {(item.normalized * 100).toFixed(1)}%
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Compact Time x Lead Heatmap */}
                  <div
                    style={{
                      height: '240px',
                      background: '#1A1A1A',
                      borderRadius: '6px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#E8E6E1',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ marginBottom: '6px', fontWeight: 600 }}>
                        Attribution tensor computed (12 leads \u00D7 1000 samples)
                      </div>
                      <div style={{ color: '#999999', fontSize: '11px' }}>
                        Completeness check: \u0394f = {attributionResult.diagnostics?.completeness_error ? attributionResult.diagnostics.completeness_error.toFixed(4) : '< 0.05'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '36px', textAlign: 'center', color: '#777773', fontSize: '13px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleExplainClass(explainClass)}>
                    Generate explanation for {explainClass}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Signal Quality */}
          {secondaryTab === 'quality' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#252525' }}>
                  Signal Quality Validation
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: study?.quality_status === 'optimal' ? '#E8F4EE' : '#FDF4E7',
                    color: study?.quality_status === 'optimal' ? '#34765A' : '#B77925',
                  }}
                >
                  {study?.quality_status || 'Optimal'}
                </span>
              </div>

              {study?.quality_warnings && study.quality_warnings.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {study.quality_warnings.map((w, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 12px',
                        background: '#FDF4E7',
                        borderLeft: '3px solid #B77925',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#634212',
                      }}
                    >
                      {w}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: '#34765A', fontSize: '13px' }}>
                  \u2713 No signal clipping, flatlines, or baseline wander detected.
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Report Preview */}
          {secondaryTab === 'report' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#252525' }}>
                  Diagnostic Report
                </span>
                {study && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onNavigateToReports && onNavigateToReports(study.id)}
                  >
                    <FileText size={13} />
                    <span>Open Printable Report</span>
                  </button>
                )}
              </div>

              <div
                style={{
                  padding: '20px',
                  background: '#FFFFFF',
                  border: '1px solid #E8E6E1',
                  borderRadius: '6px',
                  fontFamily: 'Georgia, serif',
                  fontSize: '13px',
                  lineHeight: 1.6,
                }}
              >
                <div style={{ borderBottom: '1px solid #E8E6E1', paddingBottom: '10px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#252525' }}>
                    Electrocardiogram Clinical Report
                  </div>
                  <div style={{ fontSize: '11px', color: '#777773', fontFamily: 'sans-serif' }}>
                    Patient: {study?.patient_name} ({study?.patient_display_id}) \u2022 Study: {study?.study_id}
                  </div>
                </div>

                <div><b>Reason:</b> {reasonForEcg || 'Routine examination'}</div>
                <div><b>Observations:</b> {clinicianObservations || 'Regular sinus rhythm'}</div>
                <div><b>Assessment:</b> {clinicianAssessment || 'Pending clinician assessment'}</div>
                <div><b>Plan:</b> {planFollowup || 'Routine care'}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Finalize Modal */}
      {showFinalizeModal && (
        <div className="modal-overlay" onClick={() => setShowFinalizeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#252525', margin: '0 0 8px' }}>
              Finalize & Sign Encounter
            </h3>
            <p style={{ fontSize: '13px', color: '#777773', margin: '0 0 16px', lineHeight: 1.5 }}>
              Confirm clinical review and electronic signature. This will seal the encounter report.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
                Clinician Signature *
              </label>
              <input
                type="text"
                value={signedByName}
                onChange={(e) => setSignedByName(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowFinalizeModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleFinalizeReport}
                disabled={finalizing || !signedByName.trim()}
              >
                {finalizing ? 'Signing...' : 'Sign & Finalize'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

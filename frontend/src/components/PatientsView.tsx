import React, { useEffect, useState } from 'react'
import {
  Users,
  Search,
  UserPlus,
  Edit2,
  Trash2,
  Activity,
  Clock,
  FileText,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  X,
  RefreshCw,
  Plus,
} from 'lucide-react'
import { Patient, ECGStudy, Encounter, ClinicalNote, ClinicalReport } from '../types'
import {
  fetchPatients,
  fetchPatientDetail,
  createPatient,
  updatePatient,
  deletePatient,
  createStudy,
} from '../api'
import { useAnalysis } from '../context/AnalysisContext'

interface PatientsViewProps {
  onOpenStudyForReview: (studyId: string, patientId?: string) => void
}

type PatientTab = 'summary' | 'history' | 'studies' | 'encounters' | 'notes' | 'reports'

export const PatientsView: React.FC<PatientsViewProps> = ({ onOpenStudyForReview }) => {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('updated_at')

  // Selected Patient Chart
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [chartLoading, setChartLoading] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<PatientTab>('summary')

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false)
  const [showEditModal, setShowEditModal] = useState<boolean>(false)
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false)
  const [showAttachECGModal, setShowAttachECGModal] = useState<boolean>(false)

  // Form states
  const [formName, setFormName] = useState<string>('')
  const [formDob, setFormDob] = useState<string>('')
  const [formAge, setFormAge] = useState<string>('')
  const [formSex, setFormSex] = useState<string>('Male')
  const [formMrn, setFormMrn] = useState<string>('')
  const [formContact, setFormContact] = useState<string>('')
  const [formHistory, setFormHistory] = useState<string>('')
  const [formAllergies, setFormAllergies] = useState<string>('NKDA')
  const [formMedications, setFormMedications] = useState<string>('')
  const [formNotes, setFormNotes] = useState<string>('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false)

  // Attach ECG State
  const [selectedSampleIdx, setSelectedSampleIdx] = useState<number>(0)

  const loadPatientsList = async () => {
    try {
      setLoading(true)
      const res = await fetchPatients(searchQuery, statusFilter, sortBy, 'desc')
      setPatients(res.patients)
    } catch (err) {
      console.error('Failed to load patients list:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatientsList()
  }, [searchQuery, statusFilter, sortBy])

  const openPatientChart = async (patId: string) => {
    try {
      setChartLoading(true)
      const detail = await fetchPatientDetail(patId)
      setSelectedPatient(detail)
      setActiveTab('summary')
    } catch (err) {
      console.error('Failed to open patient chart:', err)
    } finally {
      setChartLoading(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      setFormError('Patient name is required.')
      return
    }

    try {
      setFormSubmitting(true)
      setFormError(null)
      const newPat = await createPatient({
        name: formName.trim(),
        dob: formDob.trim(),
        age: formAge ? parseInt(formAge, 10) : undefined,
        sex: formSex,
        mrn: formMrn.trim(),
        contact: formContact.trim(),
        clinical_history: formHistory.trim(),
        allergies: formAllergies.trim(),
        medications: formMedications.trim(),
        notes: formNotes.trim(),
        status: 'active',
      })
      setShowRegisterModal(false)
      resetForm()
      await loadPatientsList()
      setSelectedPatient(newPat)
    } catch (err: any) {
      setFormError(err?.message || 'Failed to register patient.')
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPatient) return

    try {
      setFormSubmitting(true)
      setFormError(null)
      const updated = await updatePatient(selectedPatient.id, {
        name: formName.trim(),
        dob: formDob.trim(),
        age: formAge ? parseInt(formAge, 10) : undefined,
        sex: formSex,
        mrn: formMrn.trim(),
        contact: formContact.trim(),
        clinical_history: formHistory.trim(),
        allergies: formAllergies.trim(),
        medications: formMedications.trim(),
        notes: formNotes.trim(),
      })
      setSelectedPatient(updated)
      setShowEditModal(false)
      loadPatientsList()
    } catch (err: any) {
      setFormError(err?.message || 'Failed to update patient.')
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedPatient) return
    try {
      await deletePatient(selectedPatient.id)
      setSelectedPatient(null)
      setShowDeleteModal(false)
      loadPatientsList()
    } catch (err) {
      console.error('Failed to delete patient:', err)
    }
  }

  const handleAttachECGSubmit = async () => {
    if (!selectedPatient) return
    try {
      setFormSubmitting(true)
      const newStudy = await createStudy({
        patient_id: selectedPatient.id,
        sample_index: selectedSampleIdx,
        filename: `sample_${selectedSampleIdx}.npz`,
        assigned_clinician: 'Attending Clinician',
      })
      setShowAttachECGModal(false)
      openPatientChart(selectedPatient.id)
      onOpenStudyForReview(newStudy.id, selectedPatient.id)
    } catch (err: any) {
      alert(err?.message || 'Failed to create ECG study.')
    } finally {
      setFormSubmitting(false)
    }
  }

  const openEditModalForPatient = (p: Patient) => {
    setFormName(p.name)
    setFormDob(p.dob || '')
    setFormAge(p.age ? String(p.age) : '')
    setFormSex(p.sex || 'Male')
    setFormMrn(p.mrn || '')
    setFormContact(p.contact || '')
    setFormHistory(p.clinical_history || '')
    setFormAllergies(p.allergies || 'NKDA')
    setFormMedications(p.medications || '')
    setFormNotes(p.notes || '')
    setFormError(null)
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFormName('')
    setFormDob('')
    setFormAge('')
    setFormSex('Male')
    setFormMrn('')
    setFormContact('')
    setFormHistory('')
    setFormAllergies('NKDA')
    setFormMedications('')
    setFormNotes('')
    setFormError(null)
  }

  return (
    <div style={{ display: 'flex', gap: '24px', maxWidth: '1400px', margin: '0 auto', height: 'calc(100vh - 120px)' }}>
      {/* Left Column: Patient Directory / List */}
      <div
        className="card"
        style={{
          width: '420px',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#252525', margin: 0 }}>Patients Directory</h3>
            <span style={{ fontSize: '12px', color: '#777773' }}>{patients.length} registered records</span>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              resetForm()
              setShowRegisterModal(true)
            }}
          >
            <UserPlus size={14} />
            <span>New</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#777773' }} />
            <input
              type="text"
              placeholder="Search by name, ID, or MRN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 32px',
                fontSize: '13px',
                borderRadius: '6px',
                border: '1px solid #E8E6E1',
                background: '#FAFAF8',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid #E8E6E1',
                background: '#FFFFFF',
              }}
            >
              <option value="updated_at">Sort: Recent Activity</option>
              <option value="name">Sort: Name (A-Z)</option>
              <option value="patient_id">Sort: Patient ID</option>
              <option value="created_at">Sort: Registration Date</option>
            </select>
          </div>
        </div>

        {/* Patients List Items */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#777773', fontSize: '13px' }}>
              <RefreshCw size={18} className="spin-animation" style={{ margin: '0 auto 8px' }} />
              Loading patients...
            </div>
          ) : patients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#777773', fontSize: '13px' }}>
              No patients matching search criteria.
            </div>
          ) : (
            patients.map((pat) => {
              const isSelected = selectedPatient?.id === pat.id
              return (
                <div
                  key={pat.id}
                  onClick={() => openPatientChart(pat.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${isSelected ? '#A83245' : '#E8E6E1'}`,
                    background: isSelected ? '#F8EAED' : '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: isSelected ? '#A83245' : '#252525' }}>
                      {pat.name}
                    </span>
                    <code style={{ fontSize: '11px', color: '#777773', background: '#F0EEE9', padding: '1px 5px', borderRadius: '4px' }}>
                      {pat.patient_id}
                    </code>
                  </div>
                  <div style={{ fontSize: '12px', color: '#777773', marginTop: '4px' }}>
                    {pat.age ? `${pat.age} yrs` : 'Age N/A'} \u2022 {pat.sex} {pat.mrn ? `\u2022 MRN: ${pat.mrn}` : ''}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#9C9C96' }}>
                    <span>{pat.study_count || 0} ECG studies</span>
                    <span>{pat.encounter_count || 0} encounters</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Right Column: Selected Patient Chart */}
      <div
        className="card"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden',
        }}
      >
        {!selectedPatient ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#777773' }}>
            <Users size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>No Patient Chart Open</h3>
            <p style={{ fontSize: '13px' }}>Select a patient from the directory on the left or register a new patient.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Chart Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #E8E6E1',
                background: '#FAFAF8',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#252525', margin: 0 }}>
                    {selectedPatient.name}
                  </h2>
                  <code style={{ fontSize: '12px', color: '#A83245', background: '#F8EAED', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    {selectedPatient.patient_id}
                  </code>
                </div>
                <div style={{ fontSize: '12px', color: '#777773', marginTop: '4px', display: 'flex', gap: '16px' }}>
                  <span><b>Age:</b> {selectedPatient.age ?? 'N/A'} yrs</span>
                  <span><b>Sex:</b> {selectedPatient.sex}</span>
                  {selectedPatient.dob && <span><b>DOB:</b> {selectedPatient.dob}</span>}
                  {selectedPatient.mrn && <span><b>MRN:</b> {selectedPatient.mrn}</span>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAttachECGModal(true)}
                  title="Create and attach an ECG study to this patient"
                >
                  <Plus size={14} style={{ color: '#A83245' }} />
                  <span>Attach ECG</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => openEditModalForPatient(selectedPatient)}
                  title="Edit patient details"
                >
                  <Edit2 size={14} />
                  <span>Edit Chart</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowDeleteModal(true)}
                  style={{ color: '#B33A3A' }}
                  title="Safely delete patient record and history"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Chart Navigation Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid #E8E6E1',
                padding: '0 24px',
                background: '#FFFFFF',
                gap: '8px',
              }}
            >
              {[
                { id: 'summary' as PatientTab, label: 'Summary' },
                { id: 'history' as PatientTab, label: 'Medical History' },
                { id: 'studies' as PatientTab, label: `ECG Studies (${selectedPatient.studies?.length || 0})` },
                { id: 'encounters' as PatientTab, label: `Encounters (${selectedPatient.encounters?.length || 0})` },
                { id: 'notes' as PatientTab, label: `Clinical Notes (${selectedPatient.clinical_notes?.length || 0})` },
                { id: 'reports' as PatientTab, label: `Reports (${selectedPatient.reports?.length || 0})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '12px 14px',
                    fontSize: '13px',
                    fontWeight: activeTab === tab.id ? 600 : 500,
                    color: activeTab === tab.id ? '#A83245' : '#777773',
                    border: 'none',
                    borderBottom: `2px solid ${activeTab === tab.id ? '#A83245' : 'transparent'}`,
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {activeTab === 'summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Latest ECG Preview */}
                  <div className="card" style={{ padding: '18px 20px', background: '#FAFAF8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#252525', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Latest 12-Lead ECG Study
                      </span>
                      {selectedPatient.studies && selectedPatient.studies.length > 0 && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => onOpenStudyForReview(selectedPatient.studies![0].id, selectedPatient.id)}
                        >
                          <Activity size={14} />
                          <span>Open in Review Workspace</span>
                        </button>
                      )}
                    </div>

                    {selectedPatient.studies && selectedPatient.studies.length > 0 ? (
                      <div>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', marginBottom: '10px' }}>
                          <span><b>Study ID:</b> {selectedPatient.studies[0].study_id}</span>
                          <span><b>Recorded:</b> {selectedPatient.studies[0].recorded_at?.slice(0, 16)}</span>
                          <span><b>Status:</b> <span style={{ textTransform: 'capitalize' }}>{selectedPatient.studies[0].status.replace('_', ' ')}</span></span>
                        </div>
                        {selectedPatient.studies[0].flags && selectedPatient.studies[0].flags.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#777773' }}>Detected Flags:</span>
                            {selectedPatient.studies[0].flags.map((fl: string) => (
                              <span key={fl} style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#FDEEEE', color: '#B33A3A' }}>
                                {fl}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: '#777773', fontSize: '13px' }}>
                        No ECG studies recorded yet for this patient. Click "Attach ECG" to record an acquisition.
                      </div>
                    )}
                  </div>

                  {/* Clinical Background Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="card" style={{ padding: '16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#777773', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Documented Cardiovascular History
                      </div>
                      <div style={{ fontSize: '13px', color: '#252525', whiteSpace: 'pre-wrap' }}>
                        {selectedPatient.clinical_history || 'No prior cardiovascular conditions recorded.'}
                      </div>
                    </div>

                    <div className="card" style={{ padding: '16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#777773', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Allergies & Current Medications
                      </div>
                      <div style={{ fontSize: '13px', color: '#252525', marginBottom: '8px' }}>
                        <b>Allergies:</b> {selectedPatient.allergies || 'NKDA'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#252525' }}>
                        <b>Medications:</b> {selectedPatient.medications || 'None documented'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="card" style={{ padding: '18px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#252525', marginBottom: '10px' }}>Medical History</h4>
                    <p style={{ fontSize: '13px', color: '#252525', whiteSpace: 'pre-wrap' }}>{selectedPatient.clinical_history || 'None documented.'}</p>
                  </div>
                  <div className="card" style={{ padding: '18px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#252525', marginBottom: '10px' }}>Current Medications</h4>
                    <p style={{ fontSize: '13px', color: '#252525', whiteSpace: 'pre-wrap' }}>{selectedPatient.medications || 'None documented.'}</p>
                  </div>
                  <div className="card" style={{ padding: '18px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#252525', marginBottom: '10px' }}>Known Allergies</h4>
                    <p style={{ fontSize: '13px', color: '#252525' }}>{selectedPatient.allergies || 'None documented.'}</p>
                  </div>
                  <div className="card" style={{ padding: '18px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#252525', marginBottom: '10px' }}>Clinician Chart Notes</h4>
                    <p style={{ fontSize: '13px', color: '#252525', whiteSpace: 'pre-wrap' }}>{selectedPatient.notes || 'No general notes.'}</p>
                  </div>
                </div>
              )}

              {activeTab === 'studies' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(!selectedPatient.studies || selectedPatient.studies.length === 0) ? (
                    <div style={{ color: '#777773', fontSize: '13px', textAlign: 'center', padding: '36px' }}>
                      No ECG studies attached to this patient record.
                    </div>
                  ) : (
                    selectedPatient.studies.map((s) => (
                      <div
                        key={s.id}
                        className="card"
                        style={{
                          padding: '14px 18px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '14px', color: '#252525' }}>{s.study_id}</span>
                            <span style={{ fontSize: '11px', color: '#777773' }}>Acquired: {s.recorded_at?.slice(0, 16)}</span>
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#F0EFEA' }}>
                              {s.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#777773', marginTop: '4px' }}>
                            Model: {s.selected_model} \u2022 Quality: {s.quality_status} ({s.quality_score})
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onOpenStudyForReview(s.id, selectedPatient.id)}
                          >
                            <Activity size={14} />
                            <span>Review Waveform</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'encounters' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(!selectedPatient.encounters || selectedPatient.encounters.length === 0) ? (
                    <div style={{ color: '#777773', fontSize: '13px', textAlign: 'center', padding: '36px' }}>
                      No clinical encounters recorded.
                    </div>
                  ) : (
                    selectedPatient.encounters.map((enc) => (
                      <div key={enc.id} className="card" style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: '#252525' }}>{enc.encounter_id} \u2014 {enc.encounter_type}</span>
                          <span style={{ fontSize: '12px', color: '#777773' }}>{enc.encounter_date}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#777773' }}>
                          <b>Department:</b> {enc.department} | <b>Attending:</b> {enc.attending_clinician}
                        </div>
                        <div style={{ fontSize: '13px', color: '#252525', marginTop: '4px' }}>
                          <b>Reason for visit:</b> {enc.reason_for_visit}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(!selectedPatient.clinical_notes || selectedPatient.clinical_notes.length === 0) ? (
                    <div style={{ color: '#777773', fontSize: '13px', textAlign: 'center', padding: '36px' }}>
                      No clinical notes written for this patient yet.
                    </div>
                  ) : (
                    selectedPatient.clinical_notes.map((n) => (
                      <div key={n.id} className="card" style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px', color: '#252525' }}>Author: {n.author}</span>
                          <span style={{ fontSize: '11px', color: '#777773' }}>{n.updated_at}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#252525', whiteSpace: 'pre-wrap' }}>
                          {n.clinician_observations || n.clinician_assessment || 'Draft note.'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'reports' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(!selectedPatient.reports || selectedPatient.reports.length === 0) ? (
                    <div style={{ color: '#777773', fontSize: '13px', textAlign: 'center', padding: '36px' }}>
                      No finalized clinical reports recorded for this patient yet.
                    </div>
                  ) : (
                    selectedPatient.reports.map((rep) => (
                      <div key={rep.id} className="card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: '#252525' }}>{rep.report_id} (Version {rep.version})</div>
                          <div style={{ fontSize: '12px', color: '#777773', marginTop: '2px' }}>
                            Signed by: {rep.signed_by || 'Clinician'} \u2022 Finalized {rep.finalized_at?.slice(0, 16)}
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px', background: '#E8F4EE', color: '#34765A' }}>
                          FINALIZED
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Patient Registration / Edit Modal */}
      {(showRegisterModal || showEditModal) && (
        <div className="modal-backdrop">
          <div className="card modal-dialog" style={{ width: '600px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#252525', margin: 0 }}>
                {showRegisterModal ? 'Register New Patient' : 'Edit Patient Chart'}
              </h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setShowRegisterModal(false)
                  setShowEditModal(false)
                }}
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '10px 12px', borderRadius: '6px', background: '#FDEEEE', color: '#B33A3A', fontSize: '13px', marginBottom: '16px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={showRegisterModal ? handleRegisterSubmit : handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Eleanor Vance"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    value={formAge}
                    onChange={(e) => setFormAge(e.target.value)}
                    placeholder="e.g. 58"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={formDob}
                    onChange={(e) => setFormDob(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                    Sex (for ECG criteria)
                  </label>
                  <select
                    value={formSex}
                    onChange={(e) => setFormSex(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1', background: '#FFFFFF' }}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                    External MRN (Optional)
                  </label>
                  <input
                    type="text"
                    value={formMrn}
                    onChange={(e) => setFormMrn(e.target.value)}
                    placeholder="e.g. MRN-84920"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                    Contact Info (Optional)
                  </label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="Phone or clinic reference"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                  Relevant Cardiovascular History
                </label>
                <textarea
                  rows={2}
                  value={formHistory}
                  onChange={(e) => setFormHistory(e.target.value)}
                  placeholder="e.g. Prior MI, hypertension, dyslipidemia, CABG..."
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                    Allergies
                  </label>
                  <input
                    type="text"
                    value={formAllergies}
                    onChange={(e) => setFormAllergies(e.target.value)}
                    placeholder="e.g. NKDA, Penicillin"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                    Medications
                  </label>
                  <input
                    type="text"
                    value={formMedications}
                    onChange={(e) => setFormMedications(e.target.value)}
                    placeholder="e.g. Lisinopril, Aspirin"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowRegisterModal(false)
                    setShowEditModal(false)
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? 'Saving...' : showRegisterModal ? 'Register Patient' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attach ECG Study Modal */}
      {showAttachECGModal && selectedPatient && (
        <div className="modal-backdrop">
          <div className="card modal-dialog" style={{ width: '480px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#252525', margin: 0 }}>
                Attach ECG Study to {selectedPatient.name}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAttachECGModal(false)}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#777773', marginBottom: '16px' }}>
              Create a genuine 12-lead study record attached to this patient chart. Select an acquisition from preloaded test records or upload a signal.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '6px' }}>
                Select Acquisition Signal
              </label>
              <select
                value={selectedSampleIdx}
                onChange={(e) => setSelectedSampleIdx(parseInt(e.target.value, 10))}
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1', background: '#FFFFFF' }}
              >
                <option value={5}>Sample 5 — Anteroseptal MI Pattern (Pathological Q/ST)</option>
                <option value={14}>Sample 14 — ST/T Change Pattern (T-wave inversion)</option>
                <option value={6}>Sample 6 — Conduction Disturbance Pattern (LBBB/RBBB)</option>
                <option value={24}>Sample 24 — Complex Multilabel Pattern (MI + CD + HYP)</option>
                <option value={0}>Sample 0 — Normal Sinus ECG (Healthy Controls)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setShowAttachECGModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAttachECGSubmit} disabled={formSubmitting}>
                {formSubmitting ? 'Attaching...' : 'Create Study & Open Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedPatient && (
        <div className="modal-backdrop">
          <div className="card modal-dialog" style={{ width: '440px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#B33A3A', marginBottom: '8px' }}>
              Delete Patient Record?
            </h3>
            <p style={{ fontSize: '13px', color: '#777773', marginBottom: '20px' }}>
              Are you sure you want to delete patient <b>{selectedPatient.name}</b> ({selectedPatient.patient_id})?
              All associated ECG studies, clinical notes, and reports will be permanently deleted.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

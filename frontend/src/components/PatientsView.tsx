import React, { useEffect, useState } from 'react'
import {
  Users,
  Search,
  UserPlus,
  Edit2,
  Trash2,
  Activity,
  FileText,
  Clock,
  X,
  RefreshCw,
  Plus,
  ArrowRight,
} from 'lucide-react'
import { Patient, ECGStudy } from '../types'
import {
  fetchPatients,
  fetchPatientDetail,
  createPatient,
  updatePatient,
  deletePatient,
  createStudy,
} from '../api'

interface PatientsViewProps {
  onOpenStudyForReview: (studyId: string, patientId?: string) => void
}

type PatientTab = 'summary' | 'studies' | 'notes_history'

export const PatientsView: React.FC<PatientsViewProps> = ({ onOpenStudyForReview }) => {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>('')

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
      const res = await fetchPatients(searchQuery, 'all', 'updated_at', 'desc')
      setPatients(res.patients)
      // Auto-select first patient if none selected
      if (!selectedPatient && res.patients.length > 0) {
        openPatientChart(res.patients[0].id)
      }
    } catch (err) {
      console.error('Failed to load patients list:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatientsList()
  }, [searchQuery])

  const openPatientChart = async (patId: string) => {
    try {
      setChartLoading(true)
      const detail = await fetchPatientDetail(patId)
      setSelectedPatient(detail)
    } catch (err) {
      console.error('Failed to open patient chart:', err)
    } finally {
      setChartLoading(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      setFormError('Patient full name is required.')
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
        clinical_history: formHistory.trim(),
        allergies: formAllergies.trim(),
        medications: formMedications.trim(),
        notes: formNotes.trim(),
      })
      setShowRegisterModal(false)
      await loadPatientsList()
      await openPatientChart(newPat.id)
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
      await openPatientChart(selectedPatient.id)
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
    setFormHistory('')
    setFormAllergies('NKDA')
    setFormMedications('')
    setFormNotes('')
    setFormError(null)
  }

  return (
    <div style={{ display: 'flex', gap: '20px', maxWidth: '1200px', margin: '0 auto', minHeight: '640px' }}>
      {/* Left Column: Patient Directory */}
      <div
        className="card"
        style={{
          width: '320px',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#252525', margin: 0 }}>Patients</h3>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              resetForm()
              setShowRegisterModal(true)
            }}
          >
            <UserPlus size={13} />
            <span>Add</span>
          </button>
        </div>

        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <Search size={13} style={{ position: 'absolute', left: '9px', top: '9px', color: '#777773' }} />
          <input
            type="text"
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '6px 10px 6px 28px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid #E8E6E1',
              background: '#FAFAF8',
              width: '100%',
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#777773', fontSize: '12px' }}>
              Loading...
            </div>
          ) : patients.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#777773', fontSize: '12px' }}>
              No patients found.
            </div>
          ) : (
            patients.map((pat) => {
              const isSelected = selectedPatient?.id === pat.id
              return (
                <div
                  key={pat.id}
                  onClick={() => openPatientChart(pat.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${isSelected ? '#A83245' : '#E8E6E1'}`,
                    background: isSelected ? '#F8EAED' : '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '13px', color: isSelected ? '#A83245' : '#252525' }}>
                    {pat.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#777773', marginTop: '2px' }}>
                    {pat.patient_id} {pat.mrn ? `\u2022 MRN: ${pat.mrn}` : ''}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Right Column: Clean Patient Record */}
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
        {chartLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#777773', fontSize: '13px' }}>
            <RefreshCw size={18} className="spin-animation" style={{ color: '#A83245', marginRight: '8px' }} />
            Loading chart...
          </div>
        ) : !selectedPatient ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#777773' }}>
            <Users size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#252525' }}>Select a patient to view chart</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Clean Patient Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E8E6E1',
                background: '#FAFAF8',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#252525', margin: 0 }}>
                    {selectedPatient.name}
                  </h2>
                  <span style={{ fontSize: '12px', color: '#777773', background: '#F0EFEA', padding: '2px 6px', borderRadius: '4px' }}>
                    {selectedPatient.patient_id}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#777773', marginTop: '4px', display: 'flex', gap: '12px' }}>
                  <span>{selectedPatient.age ? `${selectedPatient.age} yrs` : 'Age N/A'}</span>
                  <span>\u2022</span>
                  <span>{selectedPatient.sex}</span>
                  {selectedPatient.dob && (
                    <>
                      <span>\u2022</span>
                      <span>DOB: {selectedPatient.dob}</span>
                    </>
                  )}
                  {selectedPatient.mrn && (
                    <>
                      <span>\u2022</span>
                      <span>MRN: {selectedPatient.mrn}</span>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAttachECGModal(true)}
                  title="Attach ECG"
                >
                  <Plus size={13} style={{ color: '#A83245' }} />
                  <span>Attach ECG</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => openEditModalForPatient(selectedPatient)}
                  title="Edit details"
                >
                  <Edit2 size={13} />
                  <span>Edit</span>
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowDeleteModal(true)}
                  style={{ color: '#B33A3A' }}
                  title="Delete patient"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* 3 Clear Tabs: Summary, ECG Studies, Notes & History */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid #E8E6E1',
                padding: '0 20px',
                background: '#FFFFFF',
                gap: '6px',
              }}
            >
              {[
                { id: 'summary' as PatientTab, label: 'Summary' },
                { id: 'studies' as PatientTab, label: `ECG Studies (${selectedPatient.studies?.length || 0})` },
                { id: 'notes_history' as PatientTab, label: 'Notes & History' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: activeTab === tab.id ? 600 : 500,
                    color: activeTab === tab.id ? '#A83245' : '#777773',
                    border: 'none',
                    borderBottom: `2px solid ${activeTab === tab.id ? '#A83245' : 'transparent'}`,
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {activeTab === 'summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="card" style={{ padding: '16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#777773', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Clinical History
                      </div>
                      <div style={{ fontSize: '13px', color: '#252525', lineHeight: 1.5 }}>
                        {selectedPatient.clinical_history || 'No recorded prior cardiac conditions.'}
                      </div>
                    </div>

                    <div className="card" style={{ padding: '16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#777773', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Medications & Allergies
                      </div>
                      <div style={{ fontSize: '13px', color: '#252525', lineHeight: 1.5 }}>
                        <div><b>Medications:</b> {selectedPatient.medications || 'None recorded'}</div>
                        <div style={{ marginTop: '6px' }}><b>Allergies:</b> {selectedPatient.allergies || 'NKDA'}</div>
                      </div>
                    </div>
                  </div>

                  {selectedPatient.notes && (
                    <div className="card" style={{ padding: '16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#777773', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Clinical Notes
                      </div>
                      <div style={{ fontSize: '13px', color: '#252525', lineHeight: 1.5 }}>
                        {selectedPatient.notes}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'studies' && (
                <div>
                  {!selectedPatient.studies || selectedPatient.studies.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#777773', fontSize: '13px' }}>
                      No ECG studies attached yet. Click "Attach ECG" above to create one.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedPatient.studies.map((study) => (
                        <div
                          key={study.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderRadius: '6px',
                            border: '1px solid #E8E6E1',
                            background: '#FAFAF8',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#252525' }}>
                              {study.study_id}
                            </div>
                            <div style={{ fontSize: '11px', color: '#777773' }}>
                              {study.created_at ? new Date(study.created_at).toLocaleDateString() : '—'} \u2022 Status: {study.status}
                            </div>
                          </div>

                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onOpenStudyForReview(study.id, selectedPatient.id)}
                            style={{ fontSize: '12px' }}
                          >
                            <Activity size={13} />
                            <span>Review ECG</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'notes_history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Encounters */}
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#777773', textTransform: 'uppercase', margin: '0 0 8px' }}>
                      Encounters & Visits
                    </h4>
                    {!selectedPatient.encounters || selectedPatient.encounters.length === 0 ? (
                      <div style={{ fontSize: '13px', color: '#777773' }}>No encounters recorded.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {selectedPatient.encounters.map((enc) => (
                          <div key={enc.id} className="card" style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#252525' }}>
                              <span>{enc.encounter_type || 'Clinical Encounter'}</span>
                              <span style={{ fontSize: '11px', color: '#777773' }}>{enc.encounter_date || enc.created_at}</span>
                            </div>
                            {enc.reason_for_visit && (
                              <div style={{ fontSize: '12px', color: '#777773', marginTop: '4px' }}>
                                Reason: {enc.reason_for_visit}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Previous Reports */}
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#777773', textTransform: 'uppercase', margin: '12px 0 8px' }}>
                      Finalized Reports
                    </h4>
                    {!selectedPatient.reports || selectedPatient.reports.length === 0 ? (
                      <div style={{ fontSize: '13px', color: '#777773' }}>No finalized reports yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {selectedPatient.reports.map((rep) => (
                          <div key={rep.id} className="card" style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#252525' }}>
                              <span>{rep.report_id}</span>
                              <span style={{ fontSize: '11px', color: '#34765A' }}>Signed by {rep.signed_by || 'Clinician'}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#777773', marginTop: '4px' }}>
                              Status: {rep.status === 'finalized' ? 'Finalized diagnostic summary' : 'Draft report'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Register Patient Modal */}
      {showRegisterModal && (
        <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Register Patient</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowRegisterModal(false)}>
                <X size={16} />
              </button>
            </div>
            {formError && (
              <div style={{ background: '#FDEEEE', color: '#B33A3A', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', marginBottom: '12px' }}>
                {formError}
              </div>
            )}
            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Full Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Eleanor Vance"
                  required
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>MRN</label>
                  <input
                    type="text"
                    value={formMrn}
                    onChange={(e) => setFormMrn(e.target.value)}
                    placeholder="e.g. MRN-9012"
                    style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Sex</label>
                  <select
                    value={formSex}
                    onChange={(e) => setFormSex(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Age</label>
                  <input
                    type="number"
                    value={formAge}
                    onChange={(e) => setFormAge(e.target.value)}
                    placeholder="e.g. 64"
                    style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Date of Birth</label>
                  <input
                    type="date"
                    value={formDob}
                    onChange={(e) => setFormDob(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Clinical History</label>
                <textarea
                  value={formHistory}
                  onChange={(e) => setFormHistory(e.target.value)}
                  placeholder="Prior MI, hypertension, etc."
                  rows={2}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRegisterModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={formSubmitting}>
                  {formSubmitting ? 'Registering...' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Patient Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Edit Patient</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEditModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Full Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Age</label>
                  <input
                    type="number"
                    value={formAge}
                    onChange={(e) => setFormAge(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>MRN</label>
                  <input
                    type="text"
                    value={formMrn}
                    onChange={(e) => setFormMrn(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Clinical History</label>
                <textarea
                  value={formHistory}
                  onChange={(e) => setFormHistory(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Medications</label>
                <input
                  type="text"
                  value={formMedications}
                  onChange={(e) => setFormMedications(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={formSubmitting}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attach ECG Modal */}
      {showAttachECGModal && (
        <div className="modal-overlay" onClick={() => setShowAttachECGModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Attach ECG Study</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAttachECGModal(false)}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#777773', margin: '0 0 16px' }}>
              Select a standard 12-lead PTB-XL ECG recording to attach to {selectedPatient?.name}.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Sample Signal</label>
                <select
                  value={selectedSampleIdx}
                  onChange={(e) => setSelectedSampleIdx(parseInt(e.target.value, 10))}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #E8E6E1', borderRadius: '6px' }}
                >
                  <option value={0}>Sample #0 (NORM — Normal ECG)</option>
                  <option value={1}>Sample #1 (MI — Myocardial Infarction)</option>
                  <option value={2}>Sample #2 (STTC — ST/T Change)</option>
                  <option value={3}>Sample #3 (CD — Conduction Disturbance)</option>
                  <option value={4}>Sample #4 (HYP — Hypertrophy)</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAttachECGModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleAttachECGSubmit} disabled={formSubmitting}>
                  Attach & Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#B33A3A', margin: '0 0 8px' }}>Delete Patient</h3>
            <p style={{ fontSize: '13px', color: '#777773', margin: '0 0 16px', lineHeight: 1.5 }}>
              Are you sure you want to delete {selectedPatient?.name}? Associated studies and notes will be removed.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="btn btn-sm" onClick={handleDeleteConfirm} style={{ background: '#B33A3A', color: '#FFFFFF', border: 'none' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

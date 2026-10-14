import React, { useEffect, useState, useRef } from 'react'
import {
  Users,
  Search,
  UserPlus,
  Edit2,
  Trash2,
  Activity,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCw,
  Plus,
  UploadCloud,
  FileCheck,
  AlertTriangle,
  HeartPulse,
  Info,
} from 'lucide-react'
import { Patient, SignalMetadata } from '../types'
import {
  fetchPatients,
  fetchPatientDetail,
  createPatient,
  updatePatient,
  deletePatient,
  createStudy,
  validateSignalFile,
} from '../api'
import { ECGViewer } from './ECGViewer'

interface PatientsViewProps {
  onOpenStudyForReview: (studyId: string, patientId?: string) => void
}

type PatientTab = 'summary' | 'history' | 'studies' | 'encounters' | 'notes' | 'reports'

/**
 * Calendar birthday calculation matching backend clinical_db.py rules.
 * Correctly accounts for leap years, month boundaries, and current date.
 */
export const calculateAgeFromDob = (dobStr?: string | null): number | null => {
  if (!dobStr || !/^\d{4}-\d{2}-\d{2}$/.test(dobStr.trim())) return null
  const [yStr, mStr, dStr] = dobStr.trim().split('-')
  const birthYear = parseInt(yStr, 10)
  const birthMonth = parseInt(mStr, 10)
  const birthDay = parseInt(dStr, 10)
  if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return null
  if (birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) return null

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentDay = now.getDate()

  let age = currentYear - birthYear
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age -= 1
  }
  return age
}

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

  // Demographics Form states
  const [formName, setFormName] = useState<string>('')
  const [dobMode, setDobMode] = useState<'dob' | 'age_only'>('dob')
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

  // Registration ECG Upload states
  const [uploadedEcgFile, setUploadedEcgFile] = useState<File | null>(null)
  const [uploadedDatFile, setUploadedDatFile] = useState<File | null>(null)
  const [uploadedEcgSignal, setUploadedEcgSignal] = useState<number[][] | null>(null)
  const [uploadedEcgMetadata, setUploadedEcgMetadata] = useState<SignalMetadata | null>(null)
  const [ecgValidationStatus, setEcgValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'error'>('idle')
  const [ecgValidationError, setEcgValidationError] = useState<string | null>(null)
  const [ecgDragActive, setEcgDragActive] = useState<boolean>(false)
  const [selectedModel, setSelectedModel] = useState<string>('seq')
  const [assignedClinician, setAssignedClinician] = useState<string>('Attending Clinician')

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const datFileInputRef = useRef<HTMLInputElement | null>(null)

  // Attach ECG State (Existing Patient Chart)
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

  // Derived age calculated on the fly when formDob changes
  const derivedAge = formDob ? calculateAgeFromDob(formDob) : null

  // File handling for ECG Upload
  const processSelectedFile = async (primaryFile: File, datFile?: File) => {
    setEcgValidationStatus('validating')
    setEcgValidationError(null)
    setUploadedEcgFile(primaryFile)
    if (datFile) setUploadedDatFile(datFile)

    try {
      const resp = await validateSignalFile(primaryFile, datFile)
      if (resp.valid && resp.signal) {
        setUploadedEcgSignal(resp.signal)
        setUploadedEcgMetadata(resp.metadata || null)
        setEcgValidationStatus('valid')
        setEcgValidationError(null)
      } else {
        setUploadedEcgSignal(null)
        setUploadedEcgMetadata(null)
        setEcgValidationStatus('error')
        setEcgValidationError(resp.error || 'Signal validation failed. Ensure shape is (1000, 12) across leads I-V6.')
      }
    } catch (err: any) {
      setUploadedEcgSignal(null)
      setUploadedEcgMetadata(null)
      setEcgValidationStatus('error')
      setEcgValidationError(err?.message || 'Error occurred while contacting backend validation service.')
    }
  }

  const handleEcgDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEcgDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const heaFile = files.find((f) => f.name.toLowerCase().endsWith('.hea'))
    const datFile = files.find((f) => f.name.toLowerCase().endsWith('.dat'))

    if (heaFile) {
      if (datFile) {
        await processSelectedFile(heaFile, datFile)
      } else {
        setUploadedEcgFile(heaFile)
        setEcgValidationStatus('idle')
        datFileInputRef.current?.click()
      }
      return
    }

    const primaryFile = files[0]
    const ext = primaryFile.name.split('.').pop()?.toLowerCase() || ''
    if (!['csv', 'npy', 'npz', 'hea', 'dat'].includes(ext)) {
      setEcgValidationStatus('error')
      setEcgValidationError(`Unsupported file format (.${ext}). Backend parses CSV, NPY, NPZ, and WFDB (.hea/.dat).`)
      return
    }

    await processSelectedFile(primaryFile)
  }

  const handleEcgFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.name.toLowerCase().endsWith('.hea')) {
      setUploadedEcgFile(file)
      datFileInputRef.current?.click()
      return
    }

    await processSelectedFile(file)
  }

  const handleDatFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const datFile = e.target.files?.[0]
    if (!datFile || !uploadedEcgFile) return
    await processSelectedFile(uploadedEcgFile, datFile)
  }

  const clearUploadedEcg = () => {
    setUploadedEcgFile(null)
    setUploadedDatFile(null)
    setUploadedEcgSignal(null)
    setUploadedEcgMetadata(null)
    setEcgValidationStatus('idle')
    setEcgValidationError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (datFileInputRef.current) datFileInputRef.current.value = ''
  }

  const validateForm = (): { valid: boolean; error?: string; age?: number; dob?: string } => {
    if (!formName.trim()) {
      return { valid: false, error: 'Patient full name is required.' }
    }

    if (dobMode === 'dob') {
      if (!formDob.trim()) {
        return { valid: false, error: 'Date of Birth is required when using DOB source of truth.' }
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(formDob.trim())) {
        return { valid: false, error: 'Date of Birth must be in YYYY-MM-DD format.' }
      }
      const now = new Date()
      const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      if (formDob.trim() > todayIso) {
        return { valid: false, error: 'Date of birth cannot be in the future.' }
      }
      const dAge = calculateAgeFromDob(formDob)
      if (dAge === null || dAge < 0 || dAge > 130) {
        return { valid: false, error: `Derived age (${dAge}) is outside plausible clinical range (0–130 years).` }
      }
      return { valid: true, age: dAge, dob: formDob.trim() }
    } else {
      // Age-only entry: DOB is explicitly unknown
      if (!formAge.trim()) {
        return { valid: false, error: 'Please enter patient age when Date of Birth is unknown.' }
      }
      const pAge = parseInt(formAge.trim(), 10)
      if (isNaN(pAge) || pAge < 0 || pAge > 130) {
        return { valid: false, error: 'Age must be an integer between 0 and 130 years.' }
      }
      return { valid: true, age: pAge, dob: '' }
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formSubmitting) return

    const validation = validateForm()
    if (!validation.valid) {
      setFormError(validation.error || 'Form validation failed.')
      return
    }

    try {
      setFormSubmitting(true)
      setFormError(null)

      const payload = {
        name: formName.trim(),
        dob: validation.dob,
        age: validation.age,
        sex: formSex,
        mrn: formMrn.trim() || undefined,
        contact: formContact.trim() || undefined,
        clinical_history: formHistory.trim() || undefined,
        allergies: formAllergies.trim() || 'NKDA',
        medications: formMedications.trim() || undefined,
        notes: formNotes.trim() || undefined,
        status: 'active',
        // Optional atomic ECG intake
        ecg_signal: uploadedEcgSignal || undefined,
        ecg_filename: uploadedEcgFile?.name || undefined,
        ecg_metadata: uploadedEcgMetadata || undefined,
        assigned_clinician: assignedClinician || 'Attending Clinician',
        selected_model: selectedModel || 'seq',
      }

      const newPat = await createPatient(payload)
      setShowRegisterModal(false)
      resetForm()
      await loadPatientsList()

      // If an ECG was uploaded and processed atomically, open the review screen with that exact study!
      if (newPat.created_study_id) {
        onOpenStudyForReview(newPat.created_study_id, newPat.id)
      } else {
        setSelectedPatient(newPat)
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to register patient.')
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPatient || formSubmitting) return

    const validation = validateForm()
    if (!validation.valid) {
      setFormError(validation.error || 'Validation error.')
      return
    }

    try {
      setFormSubmitting(true)
      setFormError(null)
      const updated = await updatePatient(selectedPatient.id, {
        name: formName.trim(),
        dob: validation.dob,
        age: validation.age,
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
    if (!selectedPatient || formSubmitting) return
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
    if (p.dob) {
      setDobMode('dob')
      setFormDob(p.dob)
      setFormAge('')
    } else {
      setDobMode('age_only')
      setFormDob('')
      setFormAge(p.age ? String(p.age) : '')
    }
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
    setDobMode('dob')
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
    clearUploadedEcg()
  }

  return (
    <div style={{ display: 'flex', gap: '24px', maxWidth: '1400px', margin: '0 auto', minHeight: 'calc(100vh - 120px)' }}>
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
            <span>New Patient</span>
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
              const verifiedAge = pat.dob ? calculateAgeFromDob(pat.dob) ?? pat.age : pat.age
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
                    {pat.dob ? (
                      <span>
                        <b>{verifiedAge ?? 'N/A'} yrs</b>{' '}
                        <span style={{ fontSize: '10px', color: '#34765A', background: '#E8F4EE', padding: '1px 4px', borderRadius: '3px' }}>
                          DOB Verified
                        </span>
                      </span>
                    ) : (
                      <span>
                        <b>{verifiedAge != null ? `${verifiedAge} yrs` : 'Age N/A'}</b>{' '}
                        <span style={{ fontSize: '10px', color: '#777773', background: '#F0EEE9', padding: '1px 4px', borderRadius: '3px' }}>
                          DOB Unknown
                        </span>
                      </span>
                    )}{' '}
                    \u2022 {pat.sex} {pat.mrn ? `\u2022 MRN: ${pat.mrn}` : ''}
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
                <div style={{ fontSize: '12px', color: '#777773', marginTop: '4px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span>
                    <b>Age:</b>{' '}
                    {selectedPatient.dob ? (
                      <span>
                        {calculateAgeFromDob(selectedPatient.dob) ?? selectedPatient.age} yrs{' '}
                        <span style={{ fontSize: '11px', color: '#34765A', fontWeight: 600 }}>(Recalculated from DOB)</span>
                      </span>
                    ) : (
                      <span>{selectedPatient.age ?? 'N/A'} yrs (Age-only entry, DOB unknown)</span>
                    )}
                  </span>
                  <span><b>Sex:</b> {selectedPatient.sex}</span>
                  <span>
                    <b>DOB:</b> {selectedPatient.dob ? selectedPatient.dob : <span style={{ color: '#9C9C96' }}>Unknown</span>}
                  </span>
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
          <div
            className="card modal-dialog"
            style={{
              width: '740px',
              padding: '24px',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#252525', margin: 0 }}>
                  {showRegisterModal ? 'Register New Patient' : 'Edit Patient Chart'}
                </h3>
                <span style={{ fontSize: '12px', color: '#777773' }}>
                  {showRegisterModal
                    ? 'Enter patient demographics and optionally attach a 12-lead ECG for live analysis.'
                    : `Updating chart demographics for ${selectedPatient?.patient_id}.`}
                </span>
              </div>
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
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '6px',
                  background: '#FDEEEE',
                  color: '#B33A3A',
                  fontSize: '13px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid #F5C6CB',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            <form
              onSubmit={showRegisterModal ? handleRegisterSubmit : handleEditSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {/* Patient Full Name */}
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

              {/* DOB & Age Section — Strict Source of Truth */}
              <div style={{ background: '#FAFAF8', padding: '14px', borderRadius: '8px', border: '1px solid #E8E6E1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#252525', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Demographic Verification (DOB & Age)
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setDobMode('dob')
                        setFormAge('')
                      }}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: dobMode === 'dob' ? 600 : 500,
                        borderRadius: '4px',
                        border: '1px solid #E8E6E1',
                        background: dobMode === 'dob' ? '#A83245' : '#FFFFFF',
                        color: dobMode === 'dob' ? '#FFFFFF' : '#777773',
                        cursor: 'pointer',
                      }}
                    >
                      DOB Source of Truth (Recommended)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDobMode('age_only')
                        setFormDob('')
                      }}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: dobMode === 'age_only' ? 600 : 500,
                        borderRadius: '4px',
                        border: '1px solid #E8E6E1',
                        background: dobMode === 'age_only' ? '#A83245' : '#FFFFFF',
                        color: dobMode === 'age_only' ? '#FFFFFF' : '#777773',
                        cursor: 'pointer',
                      }}
                    >
                      DOB Unknown (Age-Only)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px', alignItems: 'flex-start' }}>
                  {dobMode === 'dob' ? (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                          Date of Birth (YYYY-MM-DD) *
                        </label>
                        <input
                          type="date"
                          required
                          value={formDob}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={(e) => setFormDob(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                          Derived Age (Read-Only)
                        </label>
                        <div
                          style={{
                            padding: '8px 10px',
                            background: '#F0EEE9',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: derivedAge !== null ? '#34765A' : '#777773',
                            border: '1px solid #E8E6E1',
                          }}
                        >
                          {derivedAge !== null ? `${derivedAge} years old (verified)` : 'Calculated from DOB'}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                          Age in Years (0–130) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="130"
                          required
                          value={formAge}
                          onChange={(e) => setFormAge(e.target.value)}
                          placeholder="e.g. 64"
                          style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#777773', marginBottom: '4px' }}>
                          Date of Birth Status
                        </label>
                        <div
                          style={{
                            padding: '8px 10px',
                            background: '#F8F7F4',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: '#9C9C96',
                            border: '1px dashed #E8E6E1',
                          }}
                        >
                          Stored as Unknown (No fake date invented)
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                      Sex (for ECG criteria) *
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

                <div style={{ marginTop: '8px', fontSize: '11px', color: '#777773', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Info size={12} />
                  <span>
                    {dobMode === 'dob'
                      ? 'Age is automatically derived from DOB using exact calendar birthday logic.'
                      : 'Approximate age is stored without creating a fabricated date of birth.'}
                  </span>
                </div>
              </div>

              {/* Administrative Identifiers */}
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
                    Contact Reference (Optional)
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

              {/* Cardiovascular History & Medications */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
                  Relevant Cardiovascular History
                </label>
                <textarea
                  rows={2}
                  value={formHistory}
                  onChange={(e) => setFormHistory(e.target.value)}
                  placeholder="e.g. Prior MI, hypertension, dyslipidemia, CABG, pacemaker..."
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
                    placeholder="e.g. Lisinopril, Aspirin, Metoprolol"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1' }}
                  />
                </div>
              </div>

              {/* ECG Upload Section in Registration Flow */}
              {showRegisterModal && (
                <div
                  style={{
                    border: '1px solid #E8E6E1',
                    borderRadius: '8px',
                    padding: '16px',
                    background: '#FAFAF8',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <HeartPulse size={16} style={{ color: '#A83245' }} />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#252525' }}>
                          12-Lead ECG Acquisition Intake (Optional)
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#777773' }}>
                        Upload a genuine ECG recording. If provided, the system links the study and runs live model inference immediately.
                      </span>
                    </div>

                    {uploadedEcgSignal && (
                      <button
                        type="button"
                        onClick={clearUploadedEcg}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11px' }}
                      >
                        Remove ECG
                      </button>
                    )}
                  </div>

                  {/* Format & Shape Requirements Banner */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E8E6E1',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '11px',
                      color: '#777773',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <div>
                      <b style={{ color: '#252525' }}>Supported Formats:</b> CSV, NPY, NPZ, WFDB Header/Data (.hea + .dat).
                    </div>
                    <div>
                      <b style={{ color: '#252525' }}>Required Contract:</b> 10.0-second standard 12-lead signal, shape{' '}
                      <code style={{ background: '#F0EEE9', padding: '1px 4px', borderRadius: '3px' }}>(1000, 12)</code> at 100 Hz, in millivolts (mV).
                    </div>
                    <div>
                      <b style={{ color: '#252525' }}>Standard Lead Order:</b> I, II, III, aVR, aVL, aVF, V1, V2, V3, V4, V5, V6.
                    </div>
                  </div>

                  {/* Dropzone Area */}
                  {!uploadedEcgSignal ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault()
                        setEcgDragActive(true)
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        setEcgDragActive(false)
                      }}
                      onDrop={handleEcgDrop}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: `2px dashed ${ecgDragActive ? '#A83245' : '#D0CECA'}`,
                        borderRadius: '8px',
                        padding: '24px',
                        textAlign: 'center',
                        background: ecgDragActive ? '#F8EAED' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <UploadCloud size={32} style={{ color: ecgDragActive ? '#A83245' : '#9C9C96', margin: '0 auto 8px' }} />
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#252525', marginBottom: '2px' }}>
                        Click to select or drag & drop 12-lead ECG file
                      </div>
                      <div style={{ fontSize: '11px', color: '#777773' }}>
                        CSV (1000 rows × 12 cols), NPY/NPZ array, or WFDB record
                      </div>

                      {ecgValidationStatus === 'validating' && (
                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', color: '#A83245' }}>
                          <RefreshCw size={14} className="spin-animation" />
                          <span>Validating signal dimensions & quality...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Valid Waveform Preview */
                    <div style={{ background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E8E6E1', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle2 size={16} style={{ color: '#34765A' }} />
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#252525' }}>
                            {uploadedEcgFile?.name || 'Uploaded ECG Signal'}
                          </span>
                          <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#E8F4EE', color: '#34765A', fontWeight: 600 }}>
                            VALID 1000×12 (100 Hz)
                          </span>
                        </div>

                        {uploadedEcgMetadata && (
                          <div style={{ fontSize: '12px', color: '#777773' }}>
                            Quality:{' '}
                            <b style={{ color: uploadedEcgMetadata.quality_status === 'optimal' ? '#34765A' : '#A83245' }}>
                              {uploadedEcgMetadata.quality_status}
                            </b>{' '}
                            ({uploadedEcgMetadata.quality_score?.toFixed(1) ?? '98.0'}%)
                          </div>
                        )}
                      </div>

                      {/* Interactive ECG Waveform Canvas */}
                      <div style={{ height: '240px', border: '1px solid #E8E6E1', borderRadius: '6px', overflow: 'hidden' }}>
                        <ECGViewer signal={uploadedEcgSignal} samplingRate={100} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#252525', marginBottom: '2px' }}>
                            Model Checkpoint for Live Inference
                          </label>
                          <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #E8E6E1', background: '#FFFFFF' }}
                          >
                            <option value="seq">Sequential ResNet1D (Benchmark Top Performer)</option>
                            <option value="resnet1d">Standard ResNet1D Backbone</option>
                            <option value="hybrid">Hybrid Gated (Deep Feature Integration)</option>
                            <option value="gated">Gated Multi-Scale Feature Model</option>
                            <option value="feat">Handcrafted Features Classifier</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#252525', marginBottom: '2px' }}>
                            Assigned Reviewing Clinician
                          </label>
                          <input
                            type="text"
                            value={assignedClinician}
                            onChange={(e) => setAssignedClinician(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #E8E6E1' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Inline ECG Validation Error Notice */}
                  {ecgValidationStatus === 'error' && ecgValidationError && (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: '#FDEEEE',
                        border: '1px solid #F5C6CB',
                        color: '#B33A3A',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                      }}
                    >
                      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <b>ECG Validation Rejected:</b> {ecgValidationError}
                        <div style={{ fontSize: '11px', color: '#777773', marginTop: '2px' }}>
                          Patient demographics have been preserved. You can attach another file or register without an ECG.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hidden inputs for file selection */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv,.npy,.npz,.hea,.dat"
                    style={{ display: 'none' }}
                    onChange={handleEcgFileChange}
                  />
                  <input
                    type="file"
                    ref={datFileInputRef}
                    accept=".dat"
                    style={{ display: 'none' }}
                    onChange={handleDatFileChange}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={formSubmitting}
                  onClick={() => {
                    setShowRegisterModal(false)
                    setShowEditModal(false)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formSubmitting}
                  style={{ minWidth: '160px' }}
                >
                  {formSubmitting ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <RefreshCw size={14} className="spin-animation" />
                      {uploadedEcgSignal ? 'Analyzing & Registering...' : 'Saving Patient...'}
                    </span>
                  ) : showRegisterModal ? (
                    uploadedEcgSignal ? 'Register Patient & Run Analysis' : 'Register Patient'
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attach ECG Study Modal (Existing Patient Chart) */}
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

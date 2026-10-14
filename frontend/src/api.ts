import {
  BackendHealth,
  ModelMetadata,
  MetricsResponse,
  PreloadedSampleSummary,
  SampleDetailResponse,
  ValidationResponse,
  AnalysisResponse,
  ExplainResponse,
  FaithfulnessResponse,
  LeadAblationResponse,
  DiagnosticClass,
  Patient,
  PatientCreatePayload,
  ECGStudy,
  Encounter,
  ClinicalNote,
  ClinicalReport,
  ClinicalOverviewData,
  LongitudinalComparisonResult,
  PTBXLDatasetInfo,
  PTBXLRecordSummary,
  PTBXLRecordsResponse,
  PTBXLRecordDetail,
  FiveClassAnalysisItem,
  PTBXLBenchmarkAnalysisResult,
  PTBXLEvaluationSummary,
} from './types'

const BASE_URL = '' // Relative for same-origin or Vite proxy


export async function fetchHealth(): Promise<BackendHealth> {
  const res = await fetch(`${BASE_URL}/api/health`)
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`)
  return res.json()
}

export async function fetchModels(): Promise<{ active_model: string; models: ModelMetadata[] }> {
  const res = await fetch(`${BASE_URL}/api/models`)
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.statusText}`)
  return res.json()
}

export async function selectActiveModel(model: string): Promise<{ status: string; active_model: string }> {
  const res = await fetch(`${BASE_URL}/api/models/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Failed to switch model')
  }
  return res.json()
}

export async function fetchMetrics(): Promise<MetricsResponse> {
  const res = await fetch(`${BASE_URL}/api/metrics`)
  if (!res.ok) throw new Error(`Failed to fetch metrics: ${res.statusText}`)
  return res.json()
}

export async function fetchSamples(): Promise<{ total: number; samples: PreloadedSampleSummary[] }> {
  const res = await fetch(`${BASE_URL}/api/samples`)
  if (!res.ok) throw new Error(`Failed to fetch samples: ${res.statusText}`)
  return res.json()
}

export async function fetchSampleDetail(index: number): Promise<SampleDetailResponse> {
  const res = await fetch(`${BASE_URL}/api/sample/${index}`)
  if (!res.ok) throw new Error(`Failed to fetch sample ${index}: ${res.statusText}`)
  return res.json()
}

export async function validateSignalJson(signal: number[][], filename?: string): Promise<ValidationResponse> {
  const res = await fetch(`${BASE_URL}/api/ecg/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signal, filename }),
  })
  return res.json()
}

export async function validateSignalFile(
  fileOrFiles: File | File[] | FileList,
  datFile?: File
): Promise<ValidationResponse> {
  const formData = new FormData()

  if (Array.isArray(fileOrFiles) || (typeof FileList !== 'undefined' && fileOrFiles instanceof FileList)) {
    const list = Array.from(fileOrFiles)
    list.forEach((f) => {
      formData.append('files', f)
      if (f.name.toLowerCase().endsWith('.hea')) {
        formData.append('file', f)
      } else if (f.name.toLowerCase().endsWith('.dat')) {
        formData.append('dat_file', f)
      } else {
        formData.append('file', f)
      }
    })
  } else if (fileOrFiles instanceof File) {
    formData.append('file', fileOrFiles)
    if (datFile) {
      formData.append('dat_file', datFile)
    }
  }

  const res = await fetch(`${BASE_URL}/api/ecg/validate`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || err.error || 'Signal validation failed.')
  }
  return res.json()
}

export async function analyzeECG(
  signal: number[][],
  model?: string,
  explain?: DiagnosticClass,
  explainSteps?: number
): Promise<AnalysisResponse> {
  const res = await fetch(`${BASE_URL}/api/ecg/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signal,
      model,
      explain,
      explain_steps: explainSteps || 40,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Inference failed')
  }
  return res.json()
}

export async function runFaithfulnessTest(
  signal: number[][],
  model: string,
  targetClass: DiagnosticClass,
  topFraction: number = 0.10
): Promise<FaithfulnessResponse> {
  const res = await fetch(`${BASE_URL}/api/explain/faithfulness`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signal,
      model,
      target_class: targetClass,
      top_fraction: topFraction,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Faithfulness test failed')
  }
  return res.json()
}

export async function fetchExplanation(
  signal: number[][],
  targetClass: DiagnosticClass,
  model?: string,
  steps: number = 40,
  method: string = 'integrated_gradients'
): Promise<ExplainResponse> {
  const res = await fetch(`${BASE_URL}/api/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signal,
      model,
      target_class: targetClass,
      steps,
      method,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Explanation failed')
  }
  return res.json()
}

export async function fetchSpectrogram(
  signal: number[][],
  lead: string | number = 1,
  nperseg: number = 64,
  noverlap: number = 48
): Promise<import('./types').SpectrogramResponse> {
  const res = await fetch(`${BASE_URL}/api/signal/spectrogram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signal, lead, nperseg, noverlap }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Spectrogram computation failed')
  }
  return res.json()
}

export async function fetchMorphology(
  signal: number[][],
  lead: string | number = 1
): Promise<import('./types').MorphologyResponse> {
  const res = await fetch(`${BASE_URL}/api/signal/morphology`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signal, lead }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Morphology analysis failed')
  }
  return res.json()
}

export async function fetchBatchExplainMatrix(
  signal: number[][],
  model?: string,
  method: string = 'integrated_gradients',
  steps: number = 20
): Promise<import('./types').BatchExplainMatrixResponse> {
  const res = await fetch(`${BASE_URL}/api/explain/batch_matrix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signal, model, method, steps }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Batch attribution matrix computation failed')
  }
  return res.json()
}

export async function fetchClassTimeMatrix(
  signal: number[][],
  model?: string,
  numWindows: number = 20
): Promise<import('./types').ClassTimeMatrixResponse> {
  const res = await fetch(`${BASE_URL}/api/explain/class_time_matrix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signal, model, num_windows: numWindows }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Class-Time matrix computation failed')
  }
  return res.json()
}

export async function fetchFullLeadAblationMatrix(
  signal: number[][],
  model?: string
): Promise<import('./types').LeadAblationMatrixResponse> {
  const res = await fetch(`${BASE_URL}/api/explain/lead_ablation_matrix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signal, model }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Full lead ablation matrix failed')
  }
  return res.json()
}


export async function fetchLeadAblation(
  signal: number[][],
  targetClass: DiagnosticClass,
  model?: string
): Promise<LeadAblationResponse> {
  const res = await fetch(`${BASE_URL}/api/explain/lead_ablation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signal,
      model,
      target_class: targetClass,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Lead ablation failed')
  }
  return res.json()
}

export async function fetchArtifacts(): Promise<{ artifacts: any[] }> {
  const res = await fetch(`${BASE_URL}/api/artifacts`)
  if (!res.ok) throw new Error(`Failed to fetch artifacts: ${res.statusText}`)
  return res.json()
}

export async function compareModels(
  signal: number[][],
  models?: string[]
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/ecg/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signal, models }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Model comparison failed')
  }
  return res.json()
}

export async function testRobustness(
  signal: number[][],
  model?: string,
  experimentType: string = 'gaussian_noise',
  intensity: number = 0.05,
  leadIdx: number = 0
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/robustness`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signal,
      model,
      experiment_type: experimentType,
      intensity,
      lead_idx: leadIdx,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Robustness test failed')
  }
  return res.json()
}

export async function fetchAnalyses(limit: number = 30): Promise<{ total: number; analyses: any[] }> {
  const res = await fetch(`${BASE_URL}/api/analyses?limit=${limit}`)
  if (!res.ok) throw new Error(`Failed to fetch analysis history: ${res.statusText}`)
  return res.json()
}

export async function fetchAnalysisDetail(id: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/analyses/${id}`)
  if (!res.ok) throw new Error(`Failed to load analysis ${id}: ${res.statusText}`)
  return res.json()
}

export async function deleteAnalysis(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/analyses/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete analysis: ${res.statusText}`)
}

export function getAnalysisReportUrl(id: string): string {
  return `${BASE_URL}/api/analyses/${id}/report`
}

// ==============================================================================
// CLINICAL REVIEW & DOCUMENTATION API CLIENT
// ==============================================================================

export async function fetchClinicalOverview(): Promise<ClinicalOverviewData> {
  const res = await fetch(`${BASE_URL}/api/clinical/overview`)
  if (!res.ok) throw new Error(`Failed to load clinical overview: ${res.statusText}`)
  return res.json()
}

export async function fetchPatients(
  query?: string,
  status?: string,
  sortBy: string = 'updated_at',
  order: string = 'desc'
): Promise<{ total: number; patients: Patient[] }> {
  const params = new URLSearchParams()
  if (query) params.append('q', query)
  if (status && status !== 'all') params.append('status', status)
  params.append('sort_by', sortBy)
  params.append('order', order)
  const res = await fetch(`${BASE_URL}/api/patients?${params.toString()}`)
  if (!res.ok) throw new Error(`Failed to fetch patients: ${res.statusText}`)
  return res.json()
}

export async function fetchPatientDetail(id: string): Promise<Patient> {
  const res = await fetch(`${BASE_URL}/api/patients/${id}`)
  if (!res.ok) throw new Error(`Failed to load patient ${id}: ${res.statusText}`)
  return res.json()
}

export async function createPatient(data: PatientCreatePayload): Promise<Patient & { created_study_id?: string; study?: ECGStudy }> {
  const res = await fetch(`${BASE_URL}/api/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Failed to create patient')
  }
  return res.json()
}

export async function updatePatient(id: string, updates: Partial<Patient>): Promise<Patient> {
  const res = await fetch(`${BASE_URL}/api/patients/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Failed to update patient')
  }
  return res.json()
}

export async function deletePatient(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/patients/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete patient: ${res.statusText}`)
}

export async function fetchEncounters(patientId?: string): Promise<{ total: number; encounters: Encounter[] }> {
  const params = new URLSearchParams()
  if (patientId) params.append('patient_id', patientId)
  const res = await fetch(`${BASE_URL}/api/encounters?${params.toString()}`)
  if (!res.ok) throw new Error(`Failed to load encounters: ${res.statusText}`)
  return res.json()
}

export async function fetchEncounterDetail(encounterId: string): Promise<Encounter & { studies?: ECGStudy[] }> {
  const res = await fetch(`${BASE_URL}/api/encounters/${encounterId}`)
  if (!res.ok) throw new Error(`Failed to load encounter ${encounterId}: ${res.statusText}`)
  return res.json()
}

export async function createEncounter(data: {
  patient_id: string
  encounter_date?: string
  encounter_type?: string
  department?: string
  attending_clinician?: string
  reason_for_visit?: string
  status?: string
}): Promise<Encounter> {
  const res = await fetch(`${BASE_URL}/api/encounters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Failed to create encounter')
  }
  return res.json()
}

export async function updateEncounter(encounterId: string, updates: Partial<Encounter>): Promise<Encounter> {
  const res = await fetch(`${BASE_URL}/api/encounters/${encounterId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Failed to update encounter')
  }
  return res.json()
}

export async function deleteEncounter(encounterId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/encounters/${encounterId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete encounter: ${res.statusText}`)
}

export async function fetchStudies(
  status?: string,
  patientId?: string,
  query?: string
): Promise<{ total: number; studies: ECGStudy[] }> {
  const params = new URLSearchParams()
  if (status && status !== 'all') params.append('status', status)
  if (patientId) params.append('patient_id', patientId)
  if (query) params.append('q', query)
  const res = await fetch(`${BASE_URL}/api/studies?${params.toString()}`)
  if (!res.ok) throw new Error(`Failed to load ECG worklist: ${res.statusText}`)
  return res.json()
}

export async function fetchStudyDetail(id: string): Promise<ECGStudy> {
  const res = await fetch(`${BASE_URL}/api/studies/${id}`)
  if (!res.ok) throw new Error(`Failed to load ECG study: ${res.statusText}`)
  return res.json()
}

export async function createStudy(data: {
  patient_id: string
  sample_index?: number
  signal?: number[][]
  filename?: string
  assigned_clinician?: string
  metadata?: any
}): Promise<ECGStudy> {
  const res = await fetch(`${BASE_URL}/api/studies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Failed to create study')
  }
  return res.json()
}

export async function updateStudyStatus(id: string, status: string, assignedClinician?: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/studies/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, assigned_clinician: assignedClinician }),
  })
  if (!res.ok) throw new Error(`Failed to update study status: ${res.statusText}`)
}

export async function deleteStudy(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/studies/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete ECG study: ${res.statusText}`)
}

export async function analyzeStudy(studyId: string, model?: string): Promise<any> {
  const url = model ? `${BASE_URL}/api/studies/${studyId}/analyze?model=${model}` : `${BASE_URL}/api/studies/${studyId}/analyze`
  const res = await fetch(url, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Failed to run model inference on study')
  }
  return res.json()
}

export async function fetchStudyNotes(studyId: string): Promise<ClinicalNote> {
  const res = await fetch(`${BASE_URL}/api/studies/${studyId}/notes`)
  if (!res.ok) throw new Error(`Failed to fetch notes: ${res.statusText}`)
  return res.json()
}

export async function saveStudyNotes(studyId: string, notes: Partial<ClinicalNote>): Promise<ClinicalNote> {
  const res = await fetch(`${BASE_URL}/api/studies/${studyId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notes),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Failed to save clinical notes')
  }
  return res.json()
}

export async function draftAiNotes(studyId: string): Promise<Partial<ClinicalNote>> {
  const res = await fetch(`${BASE_URL}/api/studies/${studyId}/notes/draft_ai`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to generate AI draft: ${res.statusText}`)
  return res.json()
}

export async function fetchStudyReportHtml(studyId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/studies/${studyId}/report?format=html`)
  if (!res.ok) throw new Error(`Failed to load report preview: ${res.statusText}`)
  return res.text()
}

export async function fetchStudyReportJson(studyId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/studies/${studyId}/report?format=json`)
  if (!res.ok) throw new Error(`Failed to load report data: ${res.statusText}`)
  return res.json()
}

export async function finalizeStudyReport(studyId: string, signedBy: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/studies/${studyId}/report/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signed_by: signedBy }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Failed to finalize report')
  }
  return res.json()
}

export async function fetchLongitudinalComparison(studyA: string, studyB: string): Promise<LongitudinalComparisonResult> {
  const res = await fetch(`${BASE_URL}/api/compare/longitudinal?study_a=${studyA}&study_b=${studyB}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Longitudinal comparison failed')
  }
  return res.json()
}

// ==========================================
// PTB-XL Dataset Browser & Test Bench API
// ==========================================

export async function fetchPTBXLInfo(): Promise<PTBXLDatasetInfo> {
  const res = await fetch(`${BASE_URL}/api/dataset/ptbxl/info`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Failed to load dataset information')
  }
  return res.json()
}

export async function fetchPTBXLRecords(
  fold: number = 10,
  label?: string,
  query?: string,
  offset: number = 0,
  limit: number = 30
): Promise<PTBXLRecordsResponse> {
  const params = new URLSearchParams()
  params.append('fold', String(fold))
  if (label && label !== 'ALL') params.append('label', label)
  if (query && query.trim()) params.append('q', query.trim())
  params.append('offset', String(offset))
  params.append('limit', String(limit))

  const res = await fetch(`${BASE_URL}/api/dataset/ptbxl/records?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Failed to load dataset records')
  }
  return res.json()
}

export async function fetchPTBXLRecordDetail(recordId: string | number): Promise<PTBXLRecordDetail> {
  const res = await fetch(`${BASE_URL}/api/dataset/ptbxl/record/${recordId}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Failed to load dataset record #${recordId}`)
  }
  return res.json()
}

export async function analyzePTBXLRecord(
  recordId: string | number,
  model?: string,
  explainClass?: DiagnosticClass,
  explainSteps: number = 30
): Promise<PTBXLBenchmarkAnalysisResult> {
  const res = await fetch(`${BASE_URL}/api/dataset/ptbxl/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      record_id: recordId,
      model,
      explain_class: explainClass,
      explain_steps: explainSteps,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Failed to run model analysis on dataset record')
  }
  return res.json()
}

export async function fetchPTBXLEvaluation(model?: string): Promise<PTBXLEvaluationSummary> {
  const url = model ? `${BASE_URL}/api/dataset/ptbxl/evaluation?model=${model}` : `${BASE_URL}/api/dataset/ptbxl/evaluation`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Failed to fetch held-out dataset evaluation')
  }
  return res.json()
}

export async function importPTBXLRecordToPatient(
  recordId: string | number,
  clinician?: string,
  notes?: string
): Promise<Patient & { created_study_id?: string; study?: ECGStudy }> {
  const res = await fetch(`${BASE_URL}/api/dataset/ptbxl/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      record_id: recordId,
      clinician: clinician || 'Attending Clinician',
      notes: notes || 'Imported benchmark record from PTB-XL v1.0.3',
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Failed to import dataset record into patient chart')
  }
  return res.json()
}



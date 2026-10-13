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

export async function validateSignalFile(file: File, datFile?: File): Promise<ValidationResponse> {
  const formData = new FormData()
  formData.append('file', file)
  if (datFile) {
    formData.append('dat_file', datFile)
  }

  const res = await fetch(`${BASE_URL}/api/ecg/validate`, {
    method: 'POST',
    body: formData,
  })
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
  steps: number = 40
): Promise<ExplainResponse> {
  const res = await fetch(`${BASE_URL}/api/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signal,
      model,
      target_class: targetClass,
      steps,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Explanation failed')
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


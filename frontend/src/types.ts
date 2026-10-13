export type DiagnosticClass = 'CD' | 'HYP' | 'MI' | 'NORM' | 'STTC'

export interface ModelMetadata {
  id: string
  name: string
  display_name: string
  description: string
  architecture: string
  input_type: string
  features_used: string
  checkpoint_name: string | null
  checkpoint_size_bytes: number | null
  checkpoint_exists: boolean
  inference_ready: boolean
  is_active: boolean
  param_count: number | null
  macro_auc: number | null
  macro_auprc: number | null
  macro_f1: number | null
  macro_sensitivity: number | null
  macro_specificity: number | null
  training_duration_sec: number | null
  inference_latency_ms: number | null
  aug_mode: string | null
  best_epoch: number | null
  thresholds: Record<DiagnosticClass, number>
}

export interface BackendHealth {
  status: 'healthy' | 'degraded' | 'offline'
  active_model: string
  device: string
  cache_dir: string
  norm_loaded: boolean
  active_model_loaded: boolean
  loaded_models: string[]
  uptime_sec: number
  session_inferences: number
  last_inference: {
    timestamp: number
    model: string
    latency_ms: number
  } | null
  classes: DiagnosticClass[]
  leads: string[]
  sampling_rate: number
}

export interface ResearchSummary {
  dataset_name: string
  dataset_version: string
  labelled_records: number
  unique_patients: number
  categories: DiagnosticClass[]
  category_names: Record<DiagnosticClass, string>
  split_protocol: string
  test_fold: number
  test_record_count: number
  validation_record_count: number
  sampling_rate_hz: number
  signal_duration_sec: number
  lead_count: number
  best_model: string
  best_macro_auroc: number
  best_bootstrap_ci_95: [number, number]
  best_macro_auprc: number
  best_macro_f1: number
}

export interface ModelComparisonItem {
  model: string
  macro_auc: number | null
  macro_auprc: number | null
  macro_f1: number | null
  macro_sensitivity: number | null
  macro_specificity: number | null
  param_count: number | null
  training_duration_sec: number | null
  inference_latency_ms: number | null
  aug_mode: string | null
  best_epoch: number | null
}

export interface PerClassMetrics {
  auc?: Record<DiagnosticClass, number>
  auprc?: Record<DiagnosticClass, number>
  f1?: Record<DiagnosticClass, number>
  sensitivity?: Record<DiagnosticClass, number>
  specificity?: Record<DiagnosticClass, number>
  confusion?: Record<DiagnosticClass, [[number, number], [number, number]]>
  thresholds?: Record<DiagnosticClass, number>
}

export interface MetricsResponse {
  research_summary: ResearchSummary
  comparison: ModelComparisonItem[]
  per_class: Record<string, PerClassMetrics>
}

export interface PreloadedSampleSummary {
  index: number
  leads: number
  samples: number
  duration_sec: number
  labels: DiagnosticClass[]
  label_names: string[]
}

export interface SampleDetailResponse {
  index: number
  signal: number[][] // 1000 x 12
  labels: DiagnosticClass[]
  label_names: string[]
  leads: string[]
  sampling_rate: number
  duration_sec: number
  units: string
}

export interface SignalMetadata {
  format: string
  filename: string
  original_samples: number
  n_samples: number
  n_leads: number
  leads: string[]
  resampled: boolean
  duration_sec: number
  sampling_rate: number
  units: string
  min_val: number
  max_val: number
  mean_val: number
  std_val: number
  validation_status: 'valid' | 'warning' | 'rejected'
  quality_status?: 'optimal' | 'acceptable_with_warnings' | 'poor' | 'rejected'
  quality_score?: number
  quality_warnings?: string[]
}

export interface ValidationResponse {
  valid: boolean
  metadata?: SignalMetadata
  signal?: number[][]
  error?: string
}

export interface PredictionResultItem {
  class: DiagnosticClass
  name: string
  probability: number
  threshold: number
  detected: boolean
}

export interface LeadImportanceItem {
  lead: string
  score: number
  normalized: number
}

export interface TimeRegionItem {
  rank: number
  start_sample: number
  end_sample: number
  start_sec: number
  end_sec: number
  duration_ms: number
  magnitude: number
  dominant_lead: string
  dominant_lead_pct: number
  lead_breakdown: Record<string, number>
}

export interface LeadAblationItem {
  lead: string
  lead_idx: number
  p_original: number
  p_ablated: number
  delta_p: number
  impact_pct: number
}

export interface LeadAblationResponse {
  model: string
  target_class: DiagnosticClass
  leads: LeadAblationItem[]
  baseline: string
  method: string
  interpretation: string
}

export interface DeletionPoint {
  fraction: number
  p_ig: number
  p_random: number
  drop_ig: number
  drop_random: number
}

export interface InsertionPoint {
  fraction: number
  p_ig: number
  p_random: number
  gain_ig: number
  gain_random: number
}

export interface AnalysisResponse {
  analysis_id?: string
  model: string
  model_display_name: string
  latency_ms: number
  probabilities: Record<DiagnosticClass, number>
  thresholds: Record<DiagnosticClass, number>
  predictions: PredictionResultItem[]
  gate_weight_deep: number | null
  explain_class: DiagnosticClass | null
  attribution: number[][] | null // 12 x 1000
  lead_importance: LeadImportanceItem[] | null
  time_regions?: TimeRegionItem[] | null
  disclaimer: string
}

export interface ExplainResponse {
  model: string
  target_class: DiagnosticClass
  steps: number
  attribution: number[][]
  lead_importance: LeadImportanceItem[]
  time_regions?: TimeRegionItem[] | null
  top_lead: string
  baseline: string
}

export interface FaithfulnessResponse {
  model: string
  target_class: DiagnosticClass
  initial_prob: number
  baseline_prob?: number
  removed_fraction: number
  top_ig_prob_after_deletion: number
  top_ig_prob_drop: number
  random_prob_after_deletion: number
  random_prob_drop: number
  ratio_drop: number
  deletion_curve?: DeletionPoint[]
  insertion_curve?: InsertionPoint[]
  audc_ig?: number
  audc_rand?: number
  auic_ig?: number
  auic_rand?: number
  audc_drop_ratio?: number
  interpretation: string
  note: string
}

export interface ArtifactItem {
  filename: string
  size_bytes: number
  size_mb: number
  modified: string
  type: 'checkpoint' | 'dataset_cache' | 'artifact'
  verified: boolean
  param_count: number | null
}

export interface MultiModelComparisonResponse {
  models: Record<string, {
    display_name: string
    latency_ms: number
    probabilities: Record<DiagnosticClass, number>
    predictions: PredictionResultItem[]
    error?: string
  }>
  agreement: Record<DiagnosticClass, {
    positive_count: number
    total_models: number
    agreement_ratio: number
    unanimous: boolean
    consensus_detected: boolean
  }>
  classes: DiagnosticClass[]
}

export interface RobustnessShiftItem {
  original: number
  perturbed: number
  delta: number
  percent_change: number
}

export interface RobustnessResponse {
  model: string
  experiment_type: string
  description: string
  shifts: Record<DiagnosticClass, RobustnessShiftItem>
  mean_abs_delta: number
  stability_score: number
  perturbed_signal_preview: number[][]
}

export interface SavedAnalysisSummary {
  id: string
  timestamp: number
  created_at: string
  filename: string
  model_name: string
  predictions: PredictionResultItem[]
  probabilities: Record<DiagnosticClass, number>
  latency_ms: number
  explain_class: string
}

export interface SavedAnalysisDetail {
  id: string
  timestamp: number
  created_at: string
  filename: string
  model_name: string
  signal: number[][] | null
  metadata: SignalMetadata
  predictions: PredictionResultItem[]
  probabilities: Record<DiagnosticClass, number>
  thresholds: Record<DiagnosticClass, number>
  latency_ms: number
  explain_class: string
  notes: string
}

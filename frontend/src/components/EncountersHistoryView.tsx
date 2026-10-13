import React, { useEffect, useState } from 'react'
import {
  Clock,
  GitCompare,
  Activity,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  User,
} from 'lucide-react'
import { ECGStudy, LongitudinalComparisonResult, DiagnosticClass } from '../types'
import { fetchStudies, fetchLongitudinalComparison } from '../api'
import { ECGViewer } from './ECGViewer'

interface EncountersHistoryViewProps {
  onOpenStudyForReview: (studyId: string, patientId?: string) => void
}

export const EncountersHistoryView: React.FC<EncountersHistoryViewProps> = ({ onOpenStudyForReview }) => {
  const [studies, setStudies] = useState<ECGStudy[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Comparison State
  const [studyAId, setStudyAId] = useState<string>('')
  const [studyBId, setStudyBId] = useState<string>('')
  const [comparison, setComparison] = useState<LongitudinalComparisonResult | null>(null)
  const [comparing, setComparing] = useState<boolean>(false)

  const loadAllStudies = async () => {
    try {
      setLoading(true)
      const res = await fetchStudies()
      setStudies(res.studies)
      if (res.studies.length >= 2) {
        setStudyAId(res.studies[1].id)
        setStudyBId(res.studies[0].id)
      } else if (res.studies.length === 1) {
        setStudyAId(res.studies[0].id)
        setStudyBId(res.studies[0].id)
      }
    } catch (err) {
      console.error('Failed to load studies for encounters history:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllStudies()
  }, [])

  const handleRunComparison = async () => {
    if (!studyAId || !studyBId) return
    try {
      setComparing(true)
      const res = await fetchLongitudinalComparison(studyAId, studyBId)
      setComparison(res)
    } catch (err: any) {
      alert(err?.message || 'Comparison failed.')
    } finally {
      setComparing(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          background: '#FFFFFF',
          borderLeft: '4px solid #A83245',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#252525', margin: 0 }}>
            Longitudinal ECG Encounter History & Comparison Studio
          </h2>
          <p style={{ fontSize: '13px', color: '#777773', margin: '3px 0 0' }}>
            Compare serial electrocardiograms over time, inspect waveform interval changes, and review delta model predictions.
          </p>
        </div>
      </div>

      {/* Comparison Selector */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#252525', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitCompare size={16} style={{ color: '#A83245' }} />
          <span>Select Studies for Longitudinal Comparison</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
              Baseline / Earlier Study (Study A)
            </label>
            <select
              value={studyAId}
              onChange={(e) => setStudyAId(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1', background: '#FFFFFF' }}
            >
              <option value="">Select Baseline Study...</option>
              {studies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.study_id} \u2014 {s.patient_name} ({s.recorded_at?.slice(0, 10)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#252525', marginBottom: '4px' }}>
              Follow-Up / Recent Study (Study B)
            </label>
            <select
              value={studyBId}
              onChange={(e) => setStudyBId(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #E8E6E1', background: '#FFFFFF' }}
            >
              <option value="">Select Follow-up Study...</option>
              {studies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.study_id} \u2014 {s.patient_name} ({s.recorded_at?.slice(0, 10)})
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleRunComparison}
            disabled={comparing || !studyAId || !studyBId}
            style={{ height: '38px' }}
          >
            {comparing ? 'Comparing...' : 'Compare Studies'}
          </button>
        </div>
      </div>

      {/* Comparison Results */}
      {comparison && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Delta Scores Table */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#252525', margin: 0 }}>
                  Model Prediction Comparison (&Delta;P)
                </h3>
                <span style={{ fontSize: '12px', color: '#777773' }}>
                  Architecture: {comparison.model_a} {comparison.compatible ? '(Compatible Model Architecture)' : '(Incompatible Model Warning)'}
                </span>
              </div>

              {!comparison.same_patient && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#B77925', background: '#FDF4E7', padding: '3px 8px', borderRadius: '4px' }}>
                  Cross-Patient Comparison
                </span>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #E8E6E1', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', color: '#777773', fontWeight: 600 }}>Diagnostic Category</th>
                  <th style={{ padding: '10px 14px', color: '#777773', fontWeight: 600 }}>Baseline ({comparison.study_a.study_id})</th>
                  <th style={{ padding: '10px 14px', color: '#777773', fontWeight: 600 }}>Follow-Up ({comparison.study_b.study_id})</th>
                  <th style={{ padding: '10px 14px', color: '#777773', fontWeight: 600 }}>Delta Score (&Delta;P)</th>
                </tr>
              </thead>
              <tbody>
                {(['NORM', 'MI', 'STTC', 'CD', 'HYP'] as DiagnosticClass[]).map((cls) => {
                  const pA = comparison.study_a.probabilities[cls] || 0.0
                  const pB = comparison.study_b.probabilities[cls] || 0.0
                  const delta = comparison.delta_probabilities[cls] || 0.0
                  const deltaColor = delta > 0.05 ? '#B33A3A' : delta < -0.05 ? '#34765A' : '#777773'

                  return (
                    <tr key={cls} style={{ borderBottom: '1px solid #E8E6E1' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{cls}</td>
                      <td style={{ padding: '10px 14px' }}>{pA.toFixed(3)}</td>
                      <td style={{ padding: '10px 14px' }}>{pB.toFixed(3)}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: deltaColor }}>
                        {delta > 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div
              style={{
                marginTop: '16px',
                padding: '10px 12px',
                borderRadius: '6px',
                background: '#FDF4E7',
                border: '1px solid #E8E6E1',
                fontSize: '11px',
                color: '#634212',
              }}
            >
              <b>Clinical Caution:</b> Model score differences (&Delta;P) do not automatically indicate disease progression.
              Variations can arise from physiological variability, electrode repositioning, or heart rate changes.
            </div>
          </div>

          {/* Quick Review Navigation Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#252525' }}>{comparison.study_a.study_id} (Baseline)</span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onOpenStudyForReview(comparison.study_a.id)}
                >
                  <Activity size={13} />
                  <span>Open in Review</span>
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#777773' }}>
                Recorded: {comparison.study_a.recorded_at?.slice(0, 16)} \u2022 Status: {comparison.study_a.status}
              </div>
              {comparison.study_a.notes?.clinician_observations && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#252525', background: '#FAFAF8', padding: '10px', borderRadius: '6px' }}>
                  <b>Prior Clinician Note:</b> {comparison.study_a.notes.clinician_observations.slice(0, 160)}...
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#252525' }}>{comparison.study_b.study_id} (Follow-Up)</span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onOpenStudyForReview(comparison.study_b.id)}
                >
                  <Activity size={13} />
                  <span>Open in Review</span>
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#777773' }}>
                Recorded: {comparison.study_b.recorded_at?.slice(0, 16)} \u2022 Status: {comparison.study_b.status}
              </div>
              {comparison.study_b.notes?.clinician_observations && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#252525', background: '#FAFAF8', padding: '10px', borderRadius: '6px' }}>
                  <b>Prior Clinician Note:</b> {comparison.study_b.notes.clinician_observations.slice(0, 160)}...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

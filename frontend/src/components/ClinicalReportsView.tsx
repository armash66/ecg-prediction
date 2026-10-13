import React, { useEffect, useState } from 'react'
import {
  FileText,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  User,
} from 'lucide-react'
import { ECGStudy } from '../types'
import { fetchStudies, fetchStudyReportHtml, fetchStudyReportJson } from '../api'

interface ClinicalReportsViewProps {
  initialStudyId?: string
}

export const ClinicalReportsView: React.FC<ClinicalReportsViewProps> = ({ initialStudyId }) => {
  const [studies, setStudies] = useState<ECGStudy[]>([])
  const [selectedStudyId, setSelectedStudyId] = useState<string>(initialStudyId || '')
  const [reportHtml, setReportHtml] = useState<string>('')
  const [reportJson, setReportJson] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const loadStudies = async () => {
    try {
      setLoading(true)
      const res = await fetchStudies()
      setStudies(res.studies)
      if (!selectedStudyId && res.studies.length > 0) {
        setSelectedStudyId(res.studies[0].id)
      }
    } catch (err) {
      console.error('Failed to load studies for reports:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStudies()
  }, [])

  useEffect(() => {
    if (selectedStudyId) {
      loadReport(selectedStudyId)
    }
  }, [selectedStudyId])

  const loadReport = async (studyId: string) => {
    try {
      setLoading(true)
      const [html, json] = await Promise.all([
        fetchStudyReportHtml(studyId),
        fetchStudyReportJson(studyId).catch(() => null),
      ])
      setReportHtml(html)
      setReportJson(json)
    } catch (err) {
      console.error('Failed to load report:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(reportHtml)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    }
  }

  const handleDownloadJson = () => {
    if (!reportJson) return
    const blob = new Blob([JSON.stringify(reportJson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clinical_report_${selectedStudyId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedStudy = studies.find((s) => s.id === selectedStudyId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Report Controls Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#777773', textTransform: 'uppercase', marginBottom: '2px' }}>
              Select Study Encounter Report
            </label>
            <select
              value={selectedStudyId}
              onChange={(e) => setSelectedStudyId(e.target.value)}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                borderRadius: '6px',
                border: '1px solid #E8E6E1',
                background: '#FFFFFF',
                fontWeight: 600,
              }}
            >
              {studies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.study_id} \u2014 {s.patient_name} ({s.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {selectedStudy && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '4px',
                background: selectedStudy.status === 'finalized' ? '#E8F4EE' : '#FDF4E7',
                color: selectedStudy.status === 'finalized' ? '#34765A' : '#B77925',
                marginTop: '16px',
              }}
            >
              {selectedStudy.status === 'finalized' ? '\u2713 Signed Encounter' : 'Draft Report'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadJson} disabled={!reportJson}>
            <Download size={14} />
            <span>Export JSON</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={handlePrint} disabled={!reportHtml}>
            <Printer size={14} />
            <span>Print Report / Save PDF</span>
          </button>
        </div>
      </div>

      {/* HTML Report Preview Frame */}
      <div
        className="card"
        style={{
          padding: '0',
          overflow: 'hidden',
          background: '#FFFFFF',
          minHeight: '800px',
        }}
      >
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#777773' }}>
            <RefreshCw size={24} className="spin-animation" style={{ color: '#A83245', margin: '0 auto 12px' }} />
            <span>Rendering clinical report document...</span>
          </div>
        ) : reportHtml ? (
          <iframe
            srcDoc={reportHtml}
            title="Clinical Report Preview"
            style={{
              width: '100%',
              height: '840px',
              border: 'none',
              background: '#FFFFFF',
            }}
          />
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#777773' }}>
            Select an ECG study above to preview its report.
          </div>
        )}
      </div>
    </div>
  )
}

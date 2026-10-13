import React, { useState } from 'react'
import {
  FileText,
  Download,
  ExternalLink,
  Printer,
  CheckCircle2,
  Info,
  Code,
  Table,
  Layers,
} from 'lucide-react'
import { useAnalysis } from '../context/AnalysisContext'
import { getAnalysisReportUrl } from '../api'

export const ReportsExportView: React.FC = () => {
  const {
    analysisId,
    analysisResult,
    currentMetadata,
    currentSignal,
    activeModel,
    selectedClass,
    attributionResult,
    faithfulnessResult,
    robustnessResult,
  } = useAnalysis()

  const [downloadNotice, setDownloadNotice] = useState<string | null>(null)

  const triggerNotice = (msg: string) => {
    setDownloadNotice(msg)
    setTimeout(() => setDownloadNotice(null), 3000)
  }

  // 1. Download Analysis JSON
  const handleDownloadJSON = () => {
    if (!analysisResult) return
    const payload = {
      analysis_id: analysisId,
      exported_at: new Date().toISOString(),
      model: activeModel,
      metadata: currentMetadata,
      probabilities: analysisResult.probabilities,
      thresholds: analysisResult.thresholds,
      predictions: analysisResult.predictions,
      selected_class: selectedClass,
      attribution_summary: attributionResult?.lead_importance || null,
      faithfulness_summary: faithfulnessResult
        ? {
            audc_ig: faithfulnessResult.audc_ig,
            audc_rand: faithfulnessResult.audc_rand,
            auic_ig: faithfulnessResult.auic_ig,
            auic_rand: faithfulnessResult.auic_rand,
          }
        : null,
      disclaimer: analysisResult.disclaimer,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ecg_analysis_${analysisId || 'active'}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    triggerNotice('Downloaded analysis JSON metadata.')
  }

  // 2. Download Predictions CSV
  const handleDownloadPredictionsCSV = () => {
    if (!analysisResult) return
    const rows = ['class,name,probability,threshold,detected']
    analysisResult.predictions.forEach((p) => {
      rows.push(`${p.class},"${p.name}",${p.probability.toFixed(4)},${p.threshold.toFixed(4)},${p.detected}`)
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ecg_predictions_${analysisId || 'active'}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    triggerNotice('Downloaded predictions CSV table.')
  }

  // 3. Download Faithfulness Curves CSV
  const handleDownloadFaithfulnessCSV = () => {
    if (!faithfulnessResult?.deletion_curve) return
    const rows = ['fraction,p_ig,p_random,drop_ig,drop_random']
    faithfulnessResult.deletion_curve.forEach((pt) => {
      rows.push(`${pt.fraction},${pt.p_ig},${pt.p_random},${pt.drop_ig},${pt.drop_random}`)
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `faithfulness_curves_${selectedClass}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    triggerNotice('Downloaded faithfulness curves CSV.')
  }

  // 4. Download Lead Importance CSV
  const handleDownloadAttributionCSV = () => {
    if (!attributionResult?.lead_importance) return
    const rows = ['lead,score,normalized_pct']
    attributionResult.lead_importance.forEach((item) => {
      rows.push(`${item.lead},${item.score.toFixed(4)},${(item.normalized * 100).toFixed(2)}`)
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lead_importance_${selectedClass}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    triggerNotice('Downloaded lead importance CSV.')
  }

  if (!analysisResult) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <FileText size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
        <h3>No Analysis Result Selected</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          Please run an inference in ECG Analysis or open a recorded analysis from Analysis History before generating reports and exports.
        </p>
      </div>
    )
  }

  const reportUrl = analysisId ? getAnalysisReportUrl(analysisId) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Research Reports &amp; Data Export Hub
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Export active recording analysis ID: <strong>{analysisId || 'Live Session'}</strong>
          </span>
        </div>

        {reportUrl && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn-primary"
              onClick={() => window.open(reportUrl, '_blank')}
              style={{ fontSize: '0.8rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Printer size={14} />
              <span>Print / Save PDF Report</span>
            </button>
          </div>
        )}
      </div>

      {downloadNotice && (
        <div style={{ padding: '10px 16px', background: 'var(--accent-subtle)', border: '1px solid var(--accent-burgundy)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--accent-burgundy)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          <span>{downloadNotice}</span>
        </div>
      )}

      {/* Export Options Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Card 1: Formatted PDF/HTML Report */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <FileText size={20} style={{ color: 'var(--accent-burgundy)' }} />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Printable Research Report</h4>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
              Full multi-page printable HTML report containing patient metadata, 12-lead signal quality diagnostics, 5-class predictions against gated thresholds, and research disclaimer.
            </p>
          </div>

          <div style={{ marginTop: '16px' }}>
            {reportUrl ? (
              <button
                className="btn-secondary"
                onClick={() => window.open(reportUrl, '_blank')}
                style={{ width: '100%', fontSize: '0.8rem', padding: '7px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
              >
                <ExternalLink size={14} />
                <span>Open Printable Report</span>
              </button>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Report available once analysis is saved.</span>
            )}
          </div>
        </div>

        {/* Card 2: JSON Session Metadata */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Code size={20} style={{ color: 'var(--accent-burgundy)' }} />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Complete JSON Session Record</h4>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
              Machine-readable structured JSON document including exact model metadata, sigmoid probabilities, threshold interpretations, and experimental parameter configurations.
            </p>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button
              className="btn-secondary"
              onClick={handleDownloadJSON}
              style={{ width: '100%', fontSize: '0.8rem', padding: '7px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              <span>Download JSON Metadata</span>
            </button>
          </div>
        </div>

        {/* Card 3: Class Scores CSV */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Table size={20} style={{ color: 'var(--accent-burgundy)' }} />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Predictions CSV Table</h4>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
              Exportable tabular CSV containing the five diagnostic superclasses (CD, HYP, MI, NORM, STTC), probability scores, thresholds, and binary detection decisions.
            </p>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button
              className="btn-secondary"
              onClick={handleDownloadPredictionsCSV}
              style={{ width: '100%', fontSize: '0.8rem', padding: '7px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              <span>Download Predictions CSV</span>
            </button>
          </div>
        </div>

        {/* Card 4: Faithfulness & Attribution Data CSV */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Layers size={20} style={{ color: 'var(--accent-burgundy)' }} />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>XAI Attribution &amp; Curves CSV</h4>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
              Download numerical deletion/insertion trajectory measurements, perturbation fraction points, and per-lead importance ranks for downstream research analysis.
            </p>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              className="btn-secondary"
              onClick={handleDownloadAttributionCSV}
              disabled={!attributionResult?.lead_importance}
              style={{ width: '100%', fontSize: '0.78rem', padding: '6px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}
            >
              <Download size={13} />
              <span>Lead Importance CSV</span>
            </button>
            <button
              className="btn-secondary"
              onClick={handleDownloadFaithfulnessCSV}
              disabled={!faithfulnessResult?.deletion_curve}
              style={{ width: '100%', fontSize: '0.78rem', padding: '6px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}
            >
              <Download size={13} />
              <span>Faithfulness Curves CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Live Report Preview */}
      {reportUrl && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
              Report Live Preview (Print Ready)
            </h4>
            <a
              href={reportUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.78rem', color: 'var(--accent-burgundy)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>Open in new window</span>
              <ExternalLink size={13} />
            </a>
          </div>

          <iframe
            src={reportUrl}
            title="Analysis Report Preview"
            style={{
              width: '100%',
              height: '520px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              backgroundColor: '#FFFFFF',
            }}
          />
        </div>
      )}
    </div>
  )
}

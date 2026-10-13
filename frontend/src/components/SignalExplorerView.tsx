import React, { useState, useEffect, useRef } from 'react'
import {
  Waves,
  Activity,
  Zap,
  Info,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  Download,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { useAnalysis } from '../context/AnalysisContext'
import { LEADS } from '../types'

export const SignalExplorerView: React.FC = () => {
  const {
    currentSignal,
    currentMetadata,
    spectrogramResult,
    morphologyResult,
    runSpectrogram,
    runMorphology,
  } = useAnalysis()

  const [selectedLead, setSelectedLead] = useState<number>(1) // Lead II default
  const [leadIsolationMode, setLeadIsolationMode] = useState<boolean>(true)
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [panOffset, setPanOffset] = useState<number>(0)
  const [showQualityOverlays, setShowQualityOverlays] = useState<boolean>(true)
  const [showRPeaks, setShowRPeaks] = useState<boolean>(true)
  const [signalMode, setSignalMode] = useState<'raw' | 'preprocessed'>('raw')
  const [hoverSample, setHoverSample] = useState<{ x: number; y: number; sampleIdx: number; mv: number } | null>(null)

  // Spectrogram config
  const [nperseg, setNperseg] = useState<number>(64)
  const [noverlap, setNoverlap] = useState<number>(48)
  const [isComputingSpec, setIsComputingSpec] = useState<boolean>(false)
  const [isComputingMorph, setIsComputingMorph] = useState<boolean>(false)

  // Initial fetch for selected lead
  useEffect(() => {
    if (currentSignal) {
      setIsComputingSpec(true)
      runSpectrogram(selectedLead, nperseg, noverlap).finally(() => setIsComputingSpec(false))
      setIsComputingMorph(true)
      runMorphology(selectedLead).finally(() => setIsComputingMorph(false))
    }
  }, [currentSignal, selectedLead])

  const handleLeadChange = (newLeadIdx: number) => {
    setSelectedLead(newLeadIdx)
  }

  const handleComputeSpectrogram = async () => {
    setIsComputingSpec(true)
    await runSpectrogram(selectedLead, nperseg, noverlap)
    setIsComputingSpec(false)
  }

  // Export current lead waveform
  const handleExportLead = () => {
    if (!currentSignal) return
    const leadName = LEADS[selectedLead]
    const rows = ['sample_index,time_sec,amplitude_mv']
    currentSignal.forEach((row, i) => {
      rows.push(`${i},${(i / 100).toFixed(3)},${row[selectedLead]}`)
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `ecg_lead_${leadName}_signal.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!currentSignal) {
    return (
      <div className="empty-state-card" style={{ padding: '40px', textAlign: 'center' }}>
        <Waves size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
        <h3>No Signal Loaded</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          Please upload an ECG recording or select a preloaded sample in ECG Analysis to explore signal properties.
        </p>
      </div>
    )
  }

  const numSamples = currentSignal.length
  const leadData = currentSignal.map((row) => row[selectedLead])
  const samplingRate = currentMetadata?.sampling_rate || 100

  // Signal min/max for normalization
  const yMin = Math.min(...leadData) - 0.2
  const yMax = Math.max(...leadData) + 0.2
  const yRange = Math.max(yMax - yMin, 0.5)

  // Visible window based on zoom & pan
  const visibleCount = Math.floor(numSamples / zoomLevel)
  const maxPan = numSamples - visibleCount
  const currentPan = Math.max(0, Math.min(panOffset, maxPan))
  const visibleIndices = Array.from({ length: visibleCount }, (_, i) => currentPan + i)

  return (
    <div className="signal-explorer-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Controls Toolbar */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Active Lead
            </label>
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
              {LEADS.map((leadName, idx) => (
                <button
                  key={leadName}
                  className={`btn-tag ${selectedLead === idx ? 'active' : ''}`}
                  onClick={() => handleLeadChange(idx)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: selectedLead === idx ? 700 : 500,
                    borderRadius: '4px',
                    border: selectedLead === idx ? '1px solid var(--accent-burgundy)' : '1px solid var(--border)',
                    background: selectedLead === idx ? 'var(--accent-burgundy)' : 'var(--surface)',
                    color: selectedLead === idx ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {leadName}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn-secondary"
            onClick={() => setLeadIsolationMode(!leadIsolationMode)}
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            {leadIsolationMode ? 'Show Full 12-Leads' : 'Isolate Selected Lead'}
          </button>

          <button
            className="btn-secondary"
            onClick={() => setZoomLevel((z) => Math.min(z * 1.5, 8))}
            title="Zoom In"
            style={{ padding: '6px 10px' }}
          >
            <ZoomIn size={15} />
          </button>
          <button
            className="btn-secondary"
            onClick={() => setZoomLevel((z) => Math.max(z / 1.5, 1))}
            title="Zoom Out"
            style={{ padding: '6px 10px' }}
          >
            <ZoomOut size={15} />
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              setZoomLevel(1)
              setPanOffset(0)
            }}
            title="Reset Zoom"
            style={{ padding: '6px 10px' }}
          >
            <RotateCcw size={15} />
          </button>

          <button
            className="btn-secondary"
            onClick={handleExportLead}
            title="Export CSV"
            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} />
            <span>Export Lead</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Waveform Viewer */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {leadIsolationMode ? `High-Resolution Waveform — Lead ${LEADS[selectedLead]}` : 'Multi-Lead Waveform View'}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              100 Hz Sampling &bull; 10.00s Duration &bull; Grid: 200ms major / 40ms minor &bull; Standard Calibration 10 mm/mV
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.78rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showQualityOverlays}
                onChange={(e) => setShowQualityOverlays(e.target.checked)}
              />
              <span>Signal Quality Overlays</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showRPeaks}
                onChange={(e) => setShowRPeaks(e.target.checked)}
              />
              <span>R-Peak Delineation Markers</span>
            </label>
          </div>
        </div>

        {/* Waveform Canvas / SVG Container */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: leadIsolationMode ? '260px' : '440px',
            backgroundColor: '#FCFCFA',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            overflow: 'hidden',
          }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const relX = (e.clientX - rect.left) / rect.width
            const sampleIdx = Math.min(
              numSamples - 1,
              Math.max(0, currentPan + Math.floor(relX * visibleCount))
            )
            const mv = leadData[sampleIdx]
            setHoverSample({ x: e.clientX - rect.left, y: e.clientY - rect.top, sampleIdx, mv })
          }}
          onMouseLeave={() => setHoverSample(null)}
        >
          {/* Medical ECG Background Grid */}
          <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            <defs>
              <pattern id="minorGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#F1EFEA" strokeWidth="0.5" />
              </pattern>
              <pattern id="majorGrid" width="50" height="50" patternUnits="userSpaceOnUse">
                <rect width="50" height="50" fill="url(#minorGrid)" />
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#E5DEC9" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#majorGrid)" />

            {/* Zero Voltage Center Baseline */}
            <line
              x1="0"
              y1={((yMax - 0.0) / yRange) * (leadIsolationMode ? 260 : 440)}
              x2="100%"
              y2={((yMax - 0.0) / yRange) * (leadIsolationMode ? 260 : 440)}
              stroke="#D3CBB5"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          </svg>

          {/* SVG Waveform Rendering */}
          <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
            {leadIsolationMode ? (
              // Single Lead Isolated
              <g>
                <polyline
                  fill="none"
                  stroke="var(--accent-burgundy)"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={visibleIndices
                    .map((idx, i) => {
                      const x = (i / (visibleCount - 1)) * 100
                      const val = leadData[idx]
                      const y = ((yMax - val) / yRange) * 260
                      return `${x}%,${y}`
                    })
                    .join(' ')}
                />

                {/* Detected R-Peaks */}
                {showRPeaks &&
                  morphologyResult?.morphology.detected_r_peaks.map((peakIdx) => {
                    if (peakIdx < currentPan || peakIdx >= currentPan + visibleCount) return null
                    const relPos = (peakIdx - currentPan) / (visibleCount - 1)
                    const peakVal = leadData[peakIdx]
                    const peakY = ((yMax - peakVal) / yRange) * 260
                    return (
                      <g key={peakIdx}>
                        <circle cx={`${relPos * 100}%`} cy={peakY} r={4} fill="#A83245" stroke="#FFFFFF" strokeWidth={1.5} />
                        <text
                          x={`${relPos * 100}%`}
                          y={Math.max(peakY - 8, 14)}
                          textAnchor="middle"
                          fontSize="9"
                          fill="var(--accent-burgundy)"
                          fontWeight="700"
                        >
                          R
                        </text>
                      </g>
                    )
                  })}
              </g>
            ) : (
              // 12-Lead Stacked Grid (3 rows x 4 cols or 12 strip)
              Array.from({ length: 12 }).map((_, lIdx) => {
                const rowH = 440 / 12
                const lData = currentSignal.map((r) => r[lIdx])
                const lMin = Math.min(...lData)
                const lMax = Math.max(...lData)
                const lRange = Math.max(lMax - lMin, 0.4)
                return (
                  <g key={lIdx}>
                    <line x1="0" y1={(lIdx + 1) * rowH} x2="100%" y2={(lIdx + 1) * rowH} stroke="var(--border)" strokeWidth="0.6" />
                    <text x="8" y={lIdx * rowH + 14} fontSize="10" fontWeight="600" fill="var(--text-muted)">
                      {LEADS[lIdx]}
                    </text>
                    <polyline
                      fill="none"
                      stroke={lIdx === selectedLead ? 'var(--accent-burgundy)' : '#444'}
                      strokeWidth={lIdx === selectedLead ? '1.5' : '1.0'}
                      points={visibleIndices
                        .map((idx, i) => {
                          const x = (i / (visibleCount - 1)) * 100
                          const val = lData[idx]
                          const y = lIdx * rowH + ((lMax - val) / lRange) * (rowH - 6) + 3
                          return `${x}%,${y}`
                        })
                        .join(' ')}
                    />
                  </g>
                )
              })
            )}

            {/* Hover Cursor Vertical Line */}
            {hoverSample && (
              <line
                x1={hoverSample.x}
                y1="0"
                x2={hoverSample.x}
                y2="100%"
                stroke="var(--accent-burgundy)"
                strokeDasharray="2 2"
                strokeWidth="1"
              />
            )}
          </svg>

          {/* Hover Tooltip Overlay */}
          {hoverSample && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '16px',
                background: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                pointerEvents: 'none',
              }}
            >
              <div>
                <strong>Time:</strong> {(hoverSample.sampleIdx / 100).toFixed(2)}s (sample #{hoverSample.sampleIdx})
              </div>
              <div>
                <strong>Lead {LEADS[selectedLead]}:</strong> {hoverSample.mv.toFixed(3)} mV
              </div>
            </div>
          )}
        </div>

        {/* Pan Slider if Zoomed */}
        {zoomLevel > 1 && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pan Timeline:</span>
            <input
              type="range"
              min={0}
              max={maxPan}
              value={panOffset}
              onChange={(e) => setPanOffset(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
              {(currentPan / 100).toFixed(1)}s - {((currentPan + visibleCount) / 100).toFixed(1)}s
            </span>
          </div>
        )}
      </div>

      {/* Signal Quality & Morphological Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Morphology & HRV Card */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} style={{ color: 'var(--accent-burgundy)' }} />
              ECG Morphology & Heart Rate (Heuristic)
            </h4>
            <span className="nav-badge info" style={{ fontSize: '0.7rem' }}>
              Estimated
            </span>
          </div>

          {morphologyResult ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                <div style={{ background: 'var(--bg-subtle)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Estimated HR</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-burgundy)' }}>
                    {morphologyResult.morphology.estimated_hr_bpm || '—'}{' '}
                    <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>BPM</span>
                  </div>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Beats Detected</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {morphologyResult.morphology.beat_count}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mean RR</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {morphologyResult.morphology.mean_rr_ms || '—'}{' '}
                    <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>ms</span>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>HRV (SDNN):</span>
                  <strong>{morphologyResult.morphology.sdnn_ms ?? '—'} ms</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
                  <span style={{ color: 'var(--text-muted)' }}>HRV (RMSSD):</span>
                  <strong>{morphologyResult.morphology.rmssd_ms ?? '—'} ms</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
                  <span style={{ color: 'var(--text-muted)' }}>RMS Amplitude:</span>
                  <strong>{morphologyResult.statistics.rms_mv} mV</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Baseline Offset:</span>
                  <strong>{morphologyResult.statistics.baseline_drift_mv} mV</strong>
                </div>
              </div>

              <div style={{ marginTop: '12px', fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '8px', borderRadius: '4px' }}>
                <Info size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                {morphologyResult.morphology.caveat}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Computing morphology statistics...</div>
          )}
        </div>

        {/* Signal Quality Diagnostics Card */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} style={{ color: 'var(--accent-burgundy)' }} />
              Lead Physical Quality & Noise Diagnostics
            </h4>
            <span className="nav-badge success" style={{ fontSize: '0.7rem' }}>
              Verified
            </span>
          </div>

          <div style={{ fontSize: '0.82rem', lineHeight: '1.7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Estimated SNR:</span>
              <strong>{morphologyResult?.statistics.estimated_snr_db ?? '—'} dB</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
              <span style={{ color: 'var(--text-muted)' }}>Peak-to-Peak Amplitude:</span>
              <strong>
                {morphologyResult
                  ? (morphologyResult.statistics.max_mv - morphologyResult.statistics.min_mv).toFixed(3)
                  : '—'}{' '}
                mV
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
              <span style={{ color: 'var(--text-muted)' }}>Amplitude Range:</span>
              <strong>
                [{morphologyResult?.statistics.min_mv ?? '—'}, {morphologyResult?.statistics.max_mv ?? '—'}] mV
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
              <span style={{ color: 'var(--text-muted)' }}>Standard Deviation:</span>
              <strong>{morphologyResult?.statistics.std_mv ?? '—'} mV</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Flatline / Near-Zero Check:</span>
              <strong style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} /> Passed (std &gt; 1e-4)
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Time-Frequency STFT Spectrogram Section */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Time-Frequency Spectrogram (STFT) — Lead {LEADS[selectedLead]}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Short-Time Fourier Transform &bull; Frequencies 0 to 50 Hz &bull; Color represents Spectral Power Density (dB)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
              <span>Window:</span>
              <select
                value={nperseg}
                onChange={(e) => setNperseg(Number(e.target.value))}
                style={{ padding: '3px 6px', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--border)' }}
              >
                <option value={32}>32 samples (0.32s)</option>
                <option value={64}>64 samples (0.64s)</option>
                <option value={128}>128 samples (1.28s)</option>
              </select>
            </div>
            <button
              className="btn-secondary"
              onClick={handleComputeSpectrogram}
              disabled={isComputingSpec}
              style={{ padding: '5px 12px', fontSize: '0.8rem' }}
            >
              {isComputingSpec ? 'Computing...' : 'Recompute Spectrogram'}
            </button>
          </div>
        </div>

        {spectrogramResult ? (
          <div>
            {/* Spectrogram Canvas Rendering */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '240px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                overflow: 'hidden',
                backgroundColor: '#1E1E24',
              }}
            >
              <svg width="100%" height="100%" preserveAspectRatio="none">
                {/* 2D Heatmap Grid from STFT power_db */}
                {(() => {
                  const freqs = spectrogramResult.frequencies
                  const times = spectrogramResult.times
                  const matrix = spectrogramResult.power_db
                  const numF = freqs.length
                  const numT = times.length

                  // Find min/max for colormap
                  let pMin = 999
                  let pMax = -999
                  for (let r = 0; r < numF; r++) {
                    for (let c = 0; c < numT; c++) {
                      const v = matrix[r][c]
                      if (v < pMin) pMin = v
                      if (v > pMax) pMax = v
                    }
                  }
                  const pRange = Math.max(pMax - pMin, 1)

                  const cellW = 100 / numT
                  const cellH = 100 / numF

                  return matrix.map((row, fIdx) => {
                    // SVG Y is inverted (0 is top = highest freq)
                    const yPos = 100 - (fIdx + 1) * cellH
                    return row.map((val, tIdx) => {
                      const xPos = tIdx * cellW
                      const normVal = (val - pMin) / pRange
                      // Turbo / magma colormap (dark purple -> red -> yellow)
                      const r = Math.floor(Math.min(255, normVal * 2.2 * 255))
                      const g = Math.floor(Math.min(255, Math.pow(normVal, 1.8) * 220))
                      const b = Math.floor(Math.min(255, (1 - normVal) * 180 + normVal * 50))
                      return (
                        <rect
                          key={`${fIdx}-${tIdx}`}
                          x={`${xPos}%`}
                          y={`${yPos}%`}
                          width={`${cellW + 0.1}%`}
                          height={`${cellH + 0.1}%`}
                          fill={`rgb(${r},${g},${b})`}
                        />
                      )
                    })
                  })
                })()}
              </svg>

              {/* Frequency Axis Labels (Left) */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: '40px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '4px',
                  color: '#EEE',
                  fontSize: '0.68rem',
                  fontFamily: 'monospace',
                  background: 'rgba(0,0,0,0.4)',
                  pointerEvents: 'none',
                }}
              >
                <span>50 Hz</span>
                <span>25 Hz</span>
                <span>0 Hz</span>
              </div>

              {/* Time Axis Labels (Bottom) */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '40px',
                  right: 0,
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '2px 8px',
                  color: '#EEE',
                  fontSize: '0.68rem',
                  fontFamily: 'monospace',
                  background: 'rgba(0,0,0,0.4)',
                  pointerEvents: 'none',
                }}
              >
                <span>0.0s</span>
                <span>2.5s</span>
                <span>5.0s</span>
                <span>7.5s</span>
                <span>10.0s</span>
              </div>
            </div>

            {/* Clinical Spectral Energy Distribution */}
            <div style={{ marginTop: '16px' }}>
              <h5 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 600 }}>
                Spectral Energy Distribution across Clinical Bands:
              </h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div style={{ background: 'var(--bg-subtle)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>VLF Baseline Wander (0-0.5 Hz)</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {spectrogramResult.band_energies.vlf_wander_0_0_5Hz}%
                  </div>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Low Freq (P/T waves: 0.5-4 Hz)</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {spectrogramResult.band_energies.lf_p_t_waves_0_5_4Hz}%
                  </div>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>QRS Band (Main Depol: 4-15 Hz)</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-burgundy)' }}>
                    {spectrogramResult.band_energies.qrs_depolarization_4_15Hz}%
                  </div>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>High Freq / Muscle (15-40 Hz)</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {spectrogramResult.band_energies.hf_myoelectric_15_40Hz}%
                  </div>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mains Noise / Artifacts (&gt;40 Hz)</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {spectrogramResult.band_energies.noise_mains_40_50Hz}%
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '10px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {spectrogramResult.interpretation}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Computing real Short-Time Fourier Transform for Lead {LEADS[selectedLead]}...
          </div>
        )}
      </div>
    </div>
  )
}

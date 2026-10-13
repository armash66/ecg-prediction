import React, { useRef, useEffect, useState, useMemo } from 'react'
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  Maximize2,
  Minimize2,
  Eye,
  Layers,
  ChevronDown
} from 'lucide-react'

interface ECGViewerProps {
  signal: number[][] // 1000 x 12 (time x leads)
  processedSignal?: number[][] // 1000 x 12
  samplingRate?: number
  leads?: string[]
  attribution?: number[][] | null // 12 x 1000
  attributionClass?: string | null
  showProcessed?: boolean
  onToggleProcessed?: () => void
}

const DEFAULT_LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6']

export const ECGViewer: React.FC<ECGViewerProps> = ({
  signal,
  processedSignal,
  samplingRate = 100,
  leads = DEFAULT_LEADS,
  attribution = null,
  attributionClass = null,
  showProcessed = false,
  onToggleProcessed,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Layout modes: 'clinical' (3x4 + II rhythm strip), 'stacked' (all 12 stacked), 'single' (focused lead)
  const [layoutMode, setLayoutMode] = useState<'clinical' | 'stacked' | 'single'>('clinical')
  const [selectedLead, setSelectedLead] = useState<number>(1) // Lead II default for single mode
  const [timeZoom, setTimeZoom] = useState<number>(1.0) // 1.0 = full 10s, 2.0 = 5s, etc.
  const [panOffset, setPanOffset] = useState<number>(0.0) // in seconds

  // Hover state
  const [hoverCursor, setHoverCursor] = useState<{
    timeSec: number
    leadIdx: number
    valMv: number
    xPx: number
    yPx: number
  } | null>(null)

  const activeSignal = showProcessed && processedSignal ? processedSignal : signal

  // Draw ECG Canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !activeSignal || activeSignal.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Clear background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)

    // Calculate time window visible
    const totalDurationSec = activeSignal.length / samplingRate
    const visibleDurationSec = totalDurationSec / timeZoom
    const startSec = Math.max(0, Math.min(panOffset, totalDurationSec - visibleDurationSec))
    const endSec = startSec + visibleDurationSec

    // Grid rendering parameters
    // Standard ECG paper: minor box = 0.04s, major box = 0.20s
    const pxPerSec = width / visibleDurationSec

    // Minor grid
    ctx.strokeStyle = '#F3E8E6' // Subtle light pinkish grid
    ctx.lineWidth = 0.5
    ctx.beginPath()

    const minorStepSec = 0.04
    const firstMinor = Math.floor(startSec / minorStepSec) * minorStepSec
    for (let t = firstMinor; t <= endSec; t += minorStepSec) {
      const x = (t - startSec) * pxPerSec
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
    }

    // Horizontal minor grid (every 10px approx)
    const minorYStep = 10
    for (let y = 0; y < height; y += minorYStep) {
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
    }
    ctx.stroke()

    // Major grid
    ctx.strokeStyle = '#E8D2CF' // Crisper major grid
    ctx.lineWidth = 0.8
    ctx.beginPath()

    const majorStepSec = 0.20
    const firstMajor = Math.floor(startSec / majorStepSec) * majorStepSec
    for (let t = firstMajor; t <= endSec; t += majorStepSec) {
      const x = (t - startSec) * pxPerSec
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
    }

    const majorYStep = 50
    for (let y = 0; y < height; y += majorYStep) {
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
    }
    ctx.stroke()

    // Render ECG Leads based on layout mode
    if (layoutMode === 'single') {
      renderSingleLead(
        ctx,
        activeSignal,
        selectedLead,
        startSec,
        endSec,
        width,
        height,
        leads[selectedLead],
        attribution
      )
    } else if (layoutMode === 'stacked') {
      renderStackedLeads(
        ctx,
        activeSignal,
        startSec,
        endSec,
        width,
        height,
        leads,
        attribution
      )
    } else {
      // Conventional 3x4 layout + Lead II rhythm strip
      renderClinical12Lead(
        ctx,
        activeSignal,
        startSec,
        endSec,
        width,
        height,
        leads,
        attribution
      )
    }

    // Render hover cursor line if hovering
    if (hoverCursor) {
      ctx.strokeStyle = 'rgba(37, 37, 37, 0.4)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(hoverCursor.xPx, 0)
      ctx.lineTo(hoverCursor.xPx, height)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }, [
    activeSignal,
    layoutMode,
    selectedLead,
    timeZoom,
    panOffset,
    hoverCursor,
    leads,
    attribution,
    samplingRate,
  ])

  // Clinical 3x4 Layout:
  // Col 0: I, II, III (2.5s)
  // Col 1: aVR, aVL, aVF (2.5s)
  // Col 2: V1, V2, V3 (2.5s)
  // Col 3: V4, V5, V6 (2.5s)
  // Bottom: Lead II continuous rhythm strip (10s)
  const renderClinical12Lead = (
    ctx: CanvasRenderingContext2D,
    sig: number[][],
    startSec: number,
    endSec: number,
    w: number,
    h: number,
    leadNames: string[],
    attr: number[][] | null
  ) => {
    const clinicalGrid = [
      [0, 3, 6, 9],   // Row 0: I, aVR, V1, V4
      [1, 4, 7, 10],  // Row 1: II, aVL, V2, V5
      [2, 5, 8, 11],  // Row 2: III, aVF, V3, V6
    ]

    const rhythmHeight = 70
    const gridHeight = h - rhythmHeight
    const rowHeight = gridHeight / 3
    const colWidth = w / 4

    // Draw dividers
    ctx.strokeStyle = '#E8E6E1'
    ctx.lineWidth = 1
    for (let c = 1; c < 4; c++) {
      ctx.beginPath()
      ctx.moveTo(c * colWidth, 0)
      ctx.lineTo(c * colWidth, gridHeight)
      ctx.stroke()
    }
    for (let r = 1; r < 3; r++) {
      ctx.beginPath()
      ctx.moveTo(0, r * rowHeight)
      ctx.lineTo(w, r * rowHeight)
      ctx.stroke()
    }
    // Divider before rhythm strip
    ctx.beginPath()
    ctx.moveTo(0, gridHeight)
    ctx.lineTo(w, gridHeight)
    ctx.stroke()

    // 1. Draw 3x4 blocks
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const leadIdx = clinicalGrid[r][c]
        const leadName = leadNames[leadIdx] || `Lead ${leadIdx + 1}`
        const blockX = c * colWidth
        const blockY = r * rowHeight
        const centerY = blockY + rowHeight / 2

        // Lead label
        ctx.fillStyle = '#252525'
        ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ctx.fillText(leadName, blockX + 8, blockY + 16)

        // Time segment for this column (each column is 2.5s in standard 10s recording)
        const colStartSec = c * 2.5
        const colEndSec = (c + 1) * 2.5
        const startSample = Math.floor(colStartSec * samplingRate)
        const endSample = Math.min(sig.length - 1, Math.floor(colEndSec * samplingRate))

        // Draw attribution overlay if present
        if (attr && attr[leadIdx]) {
          drawAttributionHeatmap(
            ctx,
            attr[leadIdx],
            startSample,
            endSample,
            blockX,
            blockY,
            colWidth,
            rowHeight
          )
        }

        // Draw Lead waveform
        ctx.strokeStyle = '#A83245'
        ctx.lineWidth = 1.3
        ctx.beginPath()

        const numPoints = endSample - startSample
        const pxStep = colWidth / (numPoints || 1)
        const scaleY = rowHeight * 0.35 // amplitude scaling

        for (let i = startSample; i <= endSample; i++) {
          const val = sig[i][leadIdx]
          const x = blockX + (i - startSample) * pxStep
          const y = centerY - val * scaleY
          if (i === startSample) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    }

    // 2. Draw continuous Lead II rhythm strip across entire recording
    const rhythmLeadIdx = 1 // Lead II
    const rhythmName = `${leadNames[rhythmLeadIdx] || 'II'} (Continuous Rhythm Strip)`
    const rhythmCenterY = gridHeight + rhythmHeight / 2

    ctx.fillStyle = '#A83245'
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(rhythmName, 8, gridHeight + 16)

    // Attribution on rhythm strip
    if (attr && attr[rhythmLeadIdx]) {
      drawAttributionHeatmap(
        ctx,
        attr[rhythmLeadIdx],
        0,
        sig.length - 1,
        0,
        gridHeight,
        w,
        rhythmHeight
      )
    }

    ctx.strokeStyle = '#A83245'
    ctx.lineWidth = 1.3
    ctx.beginPath()

    const totalSamples = sig.length
    const rhythmPxStep = w / (totalSamples || 1)
    const rhythmScaleY = rhythmHeight * 0.32

    for (let i = 0; i < totalSamples; i++) {
      const val = sig[i][rhythmLeadIdx]
      const x = i * rhythmPxStep
      const y = rhythmCenterY - val * rhythmScaleY
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // Stacked 12 Leads Layout:
  const renderStackedLeads = (
    ctx: CanvasRenderingContext2D,
    sig: number[][],
    startSec: number,
    endSec: number,
    w: number,
    h: number,
    leadNames: string[],
    attr: number[][] | null
  ) => {
    const rowHeight = h / 12
    const totalDurationSec = endSec - startSec
    const startSample = Math.floor(startSec * samplingRate)
    const endSample = Math.min(sig.length - 1, Math.floor(endSec * samplingRate))
    const numPoints = endSample - startSample
    const pxStep = w / (numPoints || 1)

    for (let l = 0; l < 12; l++) {
      const blockY = l * rowHeight
      const centerY = blockY + rowHeight / 2

      // Divider line
      if (l > 0) {
        ctx.strokeStyle = '#F0EEE9'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(0, blockY)
        ctx.lineTo(w, blockY)
        ctx.stroke()
      }

      // Lead label
      ctx.fillStyle = '#252525'
      ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText(leadNames[l] || `Lead ${l + 1}`, 8, blockY + 14)

      // Attribution heatmap overlay
      if (attr && attr[l]) {
        drawAttributionHeatmap(
          ctx,
          attr[l],
          startSample,
          endSample,
          0,
          blockY,
          w,
          rowHeight
        )
      }

      // Waveform
      ctx.strokeStyle = '#A83245'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      const scaleY = rowHeight * 0.38

      for (let i = startSample; i <= endSample; i++) {
        const val = sig[i][l]
        const x = (i - startSample) * pxStep
        const y = centerY - val * scaleY
        if (i === startSample) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }

  // Single Lead Focus Layout:
  const renderSingleLead = (
    ctx: CanvasRenderingContext2D,
    sig: number[][],
    leadIdx: number,
    startSec: number,
    endSec: number,
    w: number,
    h: number,
    leadName: string,
    attr: number[][] | null
  ) => {
    const centerY = h / 2
    const startSample = Math.floor(startSec * samplingRate)
    const endSample = Math.min(sig.length - 1, Math.floor(endSec * samplingRate))
    const numPoints = endSample - startSample
    const pxStep = w / (numPoints || 1)

    // Attribution heatmap overlay
    if (attr && attr[leadIdx]) {
      drawAttributionHeatmap(
        ctx,
        attr[leadIdx],
        startSample,
        endSample,
        0,
        0,
        w,
        h
      )
    }

    // Lead Label and scale indicator
    ctx.fillStyle = '#252525'
    ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(`${leadName} &bull; High Resolution Inspection`, 20, 30)

    ctx.fillStyle = '#777773'
    ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(`Scale: 10 mm/mV &bull; 25 mm/s standard calibration`, 20, 48)

    // Draw baseline 0 mV axis
    ctx.strokeStyle = 'rgba(168, 50, 69, 0.2)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(w, centerY)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw waveform
    ctx.strokeStyle = '#A83245'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    const scaleY = h * 0.28 // Larger scale for single lead

    for (let i = startSample; i <= endSample; i++) {
      const val = sig[i][leadIdx]
      const x = (i - startSample) * pxStep
      const y = centerY - val * scaleY
      if (i === startSample) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // Draw subtle Integrated Gradients heatmap under trace
  const drawAttributionHeatmap = (
    ctx: CanvasRenderingContext2D,
    attrSlice: number[],
    startIdx: number,
    endIdx: number,
    x0: number,
    y0: number,
    w: number,
    h: number
  ) => {
    const numPoints = endIdx - startIdx
    if (numPoints <= 0) return

    const pxStep = w / numPoints
    // Find max attribution magnitude for scaling
    let maxMag = 1e-6
    for (let i = startIdx; i <= endIdx; i++) {
      if (attrSlice[i] !== undefined) {
        maxMag = Math.max(maxMag, Math.abs(attrSlice[i]))
      }
    }

    for (let i = startIdx; i <= endIdx; i++) {
      const mag = Math.abs(attrSlice[i] || 0)
      const normMag = Math.min(1.0, mag / maxMag)
      if (normMag > 0.15) {
        const x = x0 + (i - startIdx) * pxStep
        ctx.fillStyle = `rgba(168, 50, 69, ${normMag * 0.35})`
        ctx.fillRect(x, y0, Math.max(pxStep, 1.5), h)
      }
    }
  }

  // Handle canvas mouse move for interactive time/amplitude inspection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !activeSignal || activeSignal.length === 0) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const totalDurationSec = activeSignal.length / samplingRate
    const visibleDurationSec = totalDurationSec / timeZoom
    const startSec = Math.max(0, Math.min(panOffset, totalDurationSec - visibleDurationSec))
    const timeSec = startSec + (x / canvas.clientWidth) * visibleDurationSec
    const sampleIdx = Math.max(0, Math.min(activeSignal.length - 1, Math.floor(timeSec * samplingRate)))

    // Estimate lead index from y coordinate
    let leadIdx = selectedLead
    if (layoutMode === 'stacked') {
      leadIdx = Math.min(11, Math.max(0, Math.floor((y / canvas.clientHeight) * 12)))
    } else if (layoutMode === 'clinical') {
      const rhythmHeight = 70
      const gridHeight = canvas.clientHeight - rhythmHeight
      if (y > gridHeight) {
        leadIdx = 1 // Lead II rhythm strip
      } else {
        const col = Math.min(3, Math.max(0, Math.floor((x / canvas.clientWidth) * 4)))
        const row = Math.min(2, Math.max(0, Math.floor((y / gridHeight) * 3)))
        const clinicalGrid = [
          [0, 3, 6, 9],
          [1, 4, 7, 10],
          [2, 5, 8, 11],
        ]
        leadIdx = clinicalGrid[row][col]
      }
    }

    const valMv = activeSignal[sampleIdx][leadIdx] || 0

    setHoverCursor({
      timeSec: Number(timeSec.toFixed(3)),
      leadIdx,
      valMv: Number(valMv.toFixed(3)),
      xPx: x,
      yPx: y,
    })
  }

  const handleMouseLeave = () => {
    setHoverCursor(null)
  }

  return (
    <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Layout:</span>
          <div style={{ display: 'inline-flex', padding: '3px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <button
              className={`btn btn-ghost btn-sm ${layoutMode === 'clinical' ? 'btn-secondary' : ''}`}
              style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: 'var(--radius-sm)' }}
              onClick={() => setLayoutMode('clinical')}
            >
              12-Lead Standard (3&times;4 + II)
            </button>
            <button
              className={`btn btn-ghost btn-sm ${layoutMode === 'stacked' ? 'btn-secondary' : ''}`}
              style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: 'var(--radius-sm)' }}
              onClick={() => setLayoutMode('stacked')}
            >
              Stacked Leads
            </button>
            <button
              className={`btn btn-ghost btn-sm ${layoutMode === 'single' ? 'btn-secondary' : ''}`}
              style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: 'var(--radius-sm)' }}
              onClick={() => setLayoutMode('single')}
            >
              Single Lead Focus
            </button>
          </div>

          {layoutMode === 'single' && (
            <select
              value={selectedLead}
              onChange={(e) => setSelectedLead(Number(e.target.value))}
              style={{
                padding: '5px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
                background: '#FFFFFF',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {leads.map((l, idx) => (
                <option key={l} value={idx}>
                  Lead {l}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Action Toggles & Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {processedSignal && onToggleProcessed && (
            <button
              className={`btn btn-sm ${showProcessed ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '5px 12px' }}
              onClick={onToggleProcessed}
              title="Compare raw signal against frozen training-normalized signal"
            >
              <Eye size={13} />
              <span>{showProcessed ? 'Processed Signal (Normalized)' : 'Raw Signal'}</span>
            </button>
          )}

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: '2px 4px', border: '1px solid var(--border-light)' }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '4px 6px' }}
              onClick={() => setTimeZoom((z) => Math.min(4.0, z + 0.5))}
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, minWidth: '32px', textAlign: 'center' }}>
              {timeZoom.toFixed(1)}&times;
            </span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '4px 6px' }}
              onClick={() => setTimeZoom((z) => Math.max(1.0, z - 0.5))}
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '4px 6px' }}
              onClick={() => {
                setTimeZoom(1.0)
                setPanOffset(0.0)
              }}
              title="Reset Zoom"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="ecg-canvas-container"
        style={{ height: layoutMode === 'stacked' ? '600px' : layoutMode === 'single' ? '420px' : '480px' }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Live Hover Readout Badge */}
        {hoverCursor && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              right: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              fontSize: '0.78rem',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              pointerEvents: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>Lead: <strong>{leads[hoverCursor.leadIdx] || hoverCursor.leadIdx + 1}</strong></span>
            <span>Time: <strong>{hoverCursor.timeSec.toFixed(2)} s</strong></span>
            <span>Amplitude: <strong>{hoverCursor.valMv > 0 ? `+${hoverCursor.valMv}` : hoverCursor.valMv} mV</strong></span>
          </div>
        )}
      </div>

      {/* Legend & Grid Specification */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '3px', backgroundColor: 'var(--accent-burgundy)', borderRadius: '2px' }} />
            ECG Waveform (mV)
          </span>

          {attribution && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '14px', height: '10px', backgroundColor: 'rgba(168, 50, 69, 0.35)', borderRadius: '2px' }} />
              Integrated Gradients Attribution ({attributionClass || 'Target Class'})
            </span>
          )}
        </div>

        <div style={{ color: 'var(--text-muted)' }}>
          Standard Calibration: 25 mm/s (0.04s minor / 0.20s major) &bull; 100 Hz Sampling
        </div>
      </div>
    </div>
  )
}

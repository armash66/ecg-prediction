import React, { useRef, useEffect, useState } from 'react'
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
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

  // Measured container dimensions to prevent progressive dimension jumps or reflow
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 })

  // Hover state (decoupled from canvas width/height mutations)
  const [hoverCursor, setHoverCursor] = useState<{
    timeSec: number
    leadIdx: number
    valMv: number
    xPx: number
    yPx: number
  } | null>(null)

  const activeSignal = showProcessed && processedSignal ? processedSignal : signal

  // 1. Observe Container Resize cleanly with ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w > 0 && h > 0) {
        setDimensions((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }))
      }
    }

    updateSize()

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect
          if (cr.width > 0 && cr.height > 0) {
            const nw = Math.round(cr.width)
            const nh = Math.round(cr.height)
            setDimensions((prev) => (prev.width === nw && prev.height === nh ? prev : { width: nw, height: nh }))
          }
        }
      })
      ro.observe(container)
    }

    window.addEventListener('resize', updateSize)

    return () => {
      if (ro) ro.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [layoutMode])

  // 2. Draw ECG Canvas (Only on signal, layout, zoom, or dimension changes — NEVER on hover mousemove)
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !activeSignal || activeSignal.length === 0) return

    const width = dimensions.width > 0 ? dimensions.width : container.clientWidth
    const height = dimensions.height > 0 ? dimensions.height : container.clientHeight
    if (width <= 0 || height <= 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.scale(dpr, dpr)

    // Clear background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)

    // Calculate time window visible
    const totalDurationSec = activeSignal.length / samplingRate
    const visibleDurationSec = totalDurationSec / timeZoom
    const startSec = Math.max(0, Math.min(panOffset, totalDurationSec - visibleDurationSec))
    const endSec = startSec + visibleDurationSec

    // Grid rendering parameters: Standard ECG paper
    // minor box = 0.04s, major box = 0.20s
    const pxPerSec = width / visibleDurationSec

    // Minor grid
    ctx.strokeStyle = '#F4EAE8' // Subtle light pinkish grid
    ctx.lineWidth = 0.5
    ctx.beginPath()

    const minorStepSec = 0.04
    const firstMinor = Math.floor(startSec / minorStepSec) * minorStepSec
    for (let t = firstMinor; t <= endSec; t += minorStepSec) {
      const x = (t - startSec) * pxPerSec
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
    }

    // Horizontal minor grid (approx every 10px)
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
        leads[selectedLead] || `Lead ${selectedLead + 1}`,
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
  }, [
    activeSignal,
    layoutMode,
    selectedLead,
    timeZoom,
    panOffset,
    leads,
    attribution,
    samplingRate,
    dimensions,
  ])

  // Clinical 3x4 Layout:
  // Row 0: I, aVR, V1, V4
  // Row 1: II, aVL, V2, V5
  // Row 2: III, aVF, V3, V6
  // Bottom: Lead II continuous 10s rhythm strip
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

    const rhythmHeight = 85
    const gridHeight = Math.max(100, h - rhythmHeight)
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

    // Rhythm strip divider background and separator
    ctx.fillStyle = '#FAF9F7'
    ctx.fillRect(0, gridHeight, w, rhythmHeight)

    ctx.beginPath()
    ctx.strokeStyle = '#D5D3CE'
    ctx.lineWidth = 1.5
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

        // Time window for this column (2.5s per column in standard 3x4 print)
        const colStartSec = c * 2.5
        const colEndSec = (c + 1) * 2.5

        const startIdx = Math.max(0, Math.floor(colStartSec * samplingRate))
        const endIdx = Math.min(sig.length - 1, Math.ceil(colEndSec * samplingRate))
        if (startIdx >= endIdx) continue

        // Calibration scale: 1 mV = approx 35px at standard row height
        const pxPerMv = Math.min(45, (rowHeight / 2) * 0.75)

        // Draw attribution highlight if present
        if (attr && attr[leadIdx]) {
          const leadAttr = attr[leadIdx]
          ctx.fillStyle = 'rgba(168, 50, 69, 0.22)'
          for (let i = startIdx; i < endIdx; i += 2) {
            const aVal = leadAttr[i] || 0
            if (aVal > 0.05) {
              const relT = (i / samplingRate - colStartSec) / 2.5
              const x = blockX + relT * colWidth
              ctx.fillRect(x - 2, blockY + 2, 4, rowHeight - 4)
            }
          }
        }

        // Draw waveform trace
        ctx.strokeStyle = '#A83245'
        ctx.lineWidth = 1.5
        ctx.lineJoin = 'round'
        ctx.beginPath()

        let first = true
        for (let i = startIdx; i <= endIdx; i++) {
          const val = sig[i][leadIdx] || 0
          const relT = (i / samplingRate - colStartSec) / 2.5
          const x = blockX + relT * colWidth
          const y = centerY - val * pxPerMv

          if (first) {
            ctx.moveTo(x, y)
            first = false
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
      }
    }

    // 2. Draw Lead II Rhythm Strip across bottom
    const rhythmCenterY = gridHeight + rhythmHeight / 2 + 6
    const rhythmLeadIdx = 1 // Lead II
    const pxPerMvRhythm = Math.min(42, (rhythmHeight / 2) * 0.7)

    // Label
    ctx.fillStyle = '#777773'
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText('Rhythm Strip: Lead II (Continuous 10s @ 25 mm/s, 10 mm/mV)', 8, gridHeight + 16)

    // Attribution highlight for rhythm strip
    if (attr && attr[rhythmLeadIdx]) {
      const leadAttr = attr[rhythmLeadIdx]
      ctx.fillStyle = 'rgba(168, 50, 69, 0.20)'
      const totalDur = sig.length / samplingRate
      for (let i = 0; i < sig.length; i += 3) {
        if ((leadAttr[i] || 0) > 0.05) {
          const x = (i / sig.length) * w
          ctx.fillRect(x - 2, gridHeight + 2, 4, rhythmHeight - 4)
        }
      }
    }

    // Trace
    ctx.strokeStyle = '#A83245'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    let firstRhythm = true
    for (let i = 0; i < sig.length; i++) {
      const val = sig[i][rhythmLeadIdx] || 0
      const x = (i / (sig.length - 1)) * w
      const y = rhythmCenterY - val * pxPerMvRhythm

      if (firstRhythm) {
        ctx.moveTo(x, y)
        firstRhythm = false
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
  }

  // Stacked Leads Layout (All 12 Leads Vertically)
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
    const totalDurationSec = sig.length / samplingRate
    const visibleDurationSec = totalDurationSec / timeZoom
    const pxPerSec = w / visibleDurationSec

    for (let leadIdx = 0; leadIdx < 12; leadIdx++) {
      const centerY = leadIdx * rowHeight + rowHeight / 2
      const leadName = leadNames[leadIdx] || `Lead ${leadIdx + 1}`

      // Divider line
      if (leadIdx > 0) {
        ctx.strokeStyle = '#E8E6E1'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(0, leadIdx * rowHeight)
        ctx.lineTo(w, leadIdx * rowHeight)
        ctx.stroke()
      }

      // Label
      ctx.fillStyle = '#252525'
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText(leadName, 8, centerY - 6)

      // Waveform
      const pxPerMv = Math.min(30, (rowHeight / 2) * 0.8)
      const startIdx = Math.max(0, Math.floor(startSec * samplingRate))
      const endIdx = Math.min(sig.length - 1, Math.ceil(endSec * samplingRate))

      // Attribution
      if (attr && attr[leadIdx]) {
        const leadAttr = attr[leadIdx]
        ctx.fillStyle = 'rgba(168, 50, 69, 0.25)'
        for (let i = startIdx; i <= endIdx; i += 2) {
          if ((leadAttr[i] || 0) > 0.05) {
            const x = (i / samplingRate - startSec) * pxPerSec
            ctx.fillRect(x - 2, leadIdx * rowHeight, 4, rowHeight)
          }
        }
      }

      ctx.strokeStyle = '#A83245'
      ctx.lineWidth = 1.3
      ctx.beginPath()
      let first = true
      for (let i = startIdx; i <= endIdx; i++) {
        const val = sig[i][leadIdx] || 0
        const x = (i / samplingRate - startSec) * pxPerSec
        const y = centerY - val * pxPerMv

        if (first) {
          ctx.moveTo(x, y)
          first = false
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    }
  }

  // Single Lead Focus Layout
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
    const totalDurationSec = sig.length / samplingRate
    const visibleDurationSec = totalDurationSec / timeZoom
    const pxPerSec = w / visibleDurationSec

    // Large title
    ctx.fillStyle = '#252525'
    ctx.font = '700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(`Lead ${leadName} (Focused Waveform)`, 16, 24)

    const pxPerMv = 70 // High amplitude magnification
    const startIdx = Math.max(0, Math.floor(startSec * samplingRate))
    const endIdx = Math.min(sig.length - 1, Math.ceil(endSec * samplingRate))

    // Attribution
    if (attr && attr[leadIdx]) {
      const leadAttr = attr[leadIdx]
      ctx.fillStyle = 'rgba(168, 50, 69, 0.28)'
      for (let i = startIdx; i <= endIdx; i++) {
        if ((leadAttr[i] || 0) > 0.05) {
          const x = (i / samplingRate - startSec) * pxPerSec
          ctx.fillRect(x - 2, 40, 4, h - 50)
        }
      }
    }

    ctx.strokeStyle = '#A83245'
    ctx.lineWidth = 2.0
    ctx.beginPath()
    let first = true
    for (let i = startIdx; i <= endIdx; i++) {
      const val = sig[i][leadIdx] || 0
      const x = (i / samplingRate - startSec) * pxPerSec
      const y = centerY - val * pxPerMv

      if (first) {
        ctx.moveTo(x, y)
        first = false
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
  }

  // Handle canvas mouse move for interactive time/amplitude inspection
  // NOTE: This does NOT trigger canvas re-render or canvas dimension mutation!
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !activeSignal || activeSignal.length === 0) return

    const rect = canvas.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))

    let timeSec = 0
    let leadIdx = selectedLead

    if (layoutMode === 'stacked') {
      const totalDurationSec = activeSignal.length / samplingRate
      const visibleDurationSec = totalDurationSec / timeZoom
      const startSec = Math.max(0, Math.min(panOffset, totalDurationSec - visibleDurationSec))
      timeSec = startSec + (x / rect.width) * visibleDurationSec
      leadIdx = Math.min(11, Math.max(0, Math.floor((y / rect.height) * 12)))
    } else if (layoutMode === 'single') {
      const totalDurationSec = activeSignal.length / samplingRate
      const visibleDurationSec = totalDurationSec / timeZoom
      const startSec = Math.max(0, Math.min(panOffset, totalDurationSec - visibleDurationSec))
      timeSec = startSec + (x / rect.width) * visibleDurationSec
      leadIdx = selectedLead
    } else {
      // Clinical 3x4 Layout:
      // Row 0: I, aVR, V1, V4
      // Row 1: II, aVL, V2, V5
      // Row 2: III, aVF, V3, V6
      // Bottom: Continuous Lead II rhythm strip
      const rhythmHeight = 85
      const gridHeight = Math.max(100, rect.height - rhythmHeight)

      if (y >= gridHeight) {
        // Continuous Lead II rhythm strip across full duration
        leadIdx = 1 // Lead II
        const totalDurationSec = activeSignal.length / samplingRate
        timeSec = (x / rect.width) * totalDurationSec
      } else {
        const col = Math.min(3, Math.max(0, Math.floor((x / rect.width) * 4)))
        const row = Math.min(2, Math.max(0, Math.floor((y / gridHeight) * 3)))
        const clinicalGrid = [
          [0, 3, 6, 9],   // Row 0: I, aVR, V1, V4
          [1, 4, 7, 10],  // Row 1: II, aVL, V2, V5
          [2, 5, 8, 11],  // Row 2: III, aVF, V3, V6
        ]
        leadIdx = clinicalGrid[row][col]

        // Time window for this column (2.5s per column in standard 3x4 print)
        const colWidth = rect.width / 4
        const colStartSec = col * 2.5
        const relX = (x - col * colWidth) / colWidth
        timeSec = colStartSec + Math.max(0, Math.min(1, relX)) * 2.5
      }
    }

    const sampleIdx = Math.max(0, Math.min(activeSignal.length - 1, Math.floor(timeSec * samplingRate)))
    const valMv = activeSignal[sampleIdx] ? activeSignal[sampleIdx][leadIdx] || 0 : 0

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

  const canvasHeight = layoutMode === 'stacked' ? '540px' : layoutMode === 'single' ? '360px' : '440px'

  return (
    <div
      className="card"
      style={{
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: '#FFFFFF',
        border: '1px solid #E8E6E1',
        borderRadius: '8px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#777773' }}>Layout:</span>
          <div style={{ display: 'inline-flex', padding: '2px', background: '#F0EFEA', borderRadius: '6px', border: '1px solid #E8E6E1' }}>
            <button
              className={`btn btn-ghost btn-sm ${layoutMode === 'clinical' ? 'btn-secondary' : ''}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px' }}
              onClick={() => setLayoutMode('clinical')}
            >
              12-Lead Standard (3&times;4 + II)
            </button>
            <button
              className={`btn btn-ghost btn-sm ${layoutMode === 'stacked' ? 'btn-secondary' : ''}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px' }}
              onClick={() => setLayoutMode('stacked')}
            >
              Stacked Leads
            </button>
            <button
              className={`btn btn-ghost btn-sm ${layoutMode === 'single' ? 'btn-secondary' : ''}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px' }}
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
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #E8E6E1',
                background: '#FFFFFF',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#252525',
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
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              onClick={onToggleProcessed}
              title="Compare raw signal against frozen training-normalized signal"
            >
              <Eye size={13} />
              <span>{showProcessed ? 'Processed Signal (Normalized)' : 'Raw Signal'}</span>
            </button>
          )}

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: '#F0EFEA', borderRadius: '6px', padding: '2px 4px', border: '1px solid #E8E6E1' }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '3px 6px' }}
              onClick={() => setTimeZoom((z) => Math.min(4.0, z + 0.5))}
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, minWidth: '32px', textAlign: 'center' }}>
              {timeZoom.toFixed(1)}&times;
            </span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '3px 6px' }}
              onClick={() => setTimeZoom((z) => Math.max(1.0, z - 0.5))}
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '3px 6px' }}
              onClick={() => {
                setTimeZoom(1.0)
                setPanOffset(0.0)
              }}
              title="Reset Zoom"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Area with Position Relative */}
      <div
        ref={containerRef}
        className="ecg-canvas-container"
        style={{
          position: 'relative',
          width: '100%',
          height: canvasHeight,
          borderRadius: '6px',
          overflow: 'hidden',
          border: '1px solid #E8E6E1',
          background: '#FFFFFF',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Vertical cursor indicator line (Positioned via CSS, zero canvas reflow) */}
        {hoverCursor && (
          <div
            style={{
              position: 'absolute',
              left: `${hoverCursor.xPx}px`,
              top: 0,
              bottom: 0,
              width: '1px',
              borderLeft: '1px dashed rgba(37, 37, 37, 0.45)',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          />
        )}

        {/* Live Hover Readout Badge */}
        {hoverCursor && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #E8E6E1',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.75rem',
              color: '#252525',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              pointerEvents: 'none',
              fontVariantNumeric: 'tabular-nums',
              zIndex: 10,
            }}
          >
            <span>Lead: <strong>{leads[hoverCursor.leadIdx] || hoverCursor.leadIdx + 1}</strong></span>
            <span>Time: <strong>{hoverCursor.timeSec.toFixed(2)} s</strong></span>
            <span>Amplitude: <strong>{hoverCursor.valMv > 0 ? `+${hoverCursor.valMv}` : hoverCursor.valMv} mV</strong></span>
          </div>
        )}
      </div>

      {/* Legend & Grid Specification */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: '#777773', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '3px', backgroundColor: '#A83245', borderRadius: '2px' }} />
            ECG Waveform (mV)
          </span>

          {attribution && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '10px', backgroundColor: 'rgba(168, 50, 69, 0.35)', borderRadius: '2px' }} />
              Attribution Highlights ({attributionClass || 'Target Class'})
            </span>
          )}
        </div>

        <div style={{ color: '#9C9C96' }}>
          Standard Calibration: 25 mm/s (0.04s minor / 0.20s major) &bull; 100 Hz Sampling
        </div>
      </div>
    </div>
  )
}

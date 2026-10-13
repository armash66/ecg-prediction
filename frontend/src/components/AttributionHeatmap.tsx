import React, { useRef, useEffect, useState, useMemo } from 'react'

interface AttributionHeatmapProps {
  attribution: number[][] // 12 x 1000
  targetClass: string
  selectedInterval?: { start: number; end: number } | null
  onSelectInterval?: (start: number, end: number) => void
}

const LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6']

export const AttributionHeatmap: React.FC<AttributionHeatmapProps> = ({
  attribution,
  targetClass,
  selectedInterval,
  onSelectInterval,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hoverInfo, setHoverInfo] = useState<{
    leadIndex: number
    leadName: string
    sampleIndex: number
    timeSec: number
    value: number
    x: number
    y: number
  } | null>(null)

  // Compute maximum absolute attribution for symmetric diverging scale
  const maxAbsVal = useMemo(() => {
    let m = 1e-6
    for (let l = 0; l < 12; l++) {
      if (!attribution[l]) continue
      for (let t = 0; t < attribution[l].length; t++) {
        const absV = Math.abs(attribution[l][t])
        if (absV > m) m = absV
      }
    }
    return m
  }, [attribution])

  // Draw heatmap onto canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !attribution || attribution.length < 12) return

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

    const rowHeight = height / 12
    const nSamples = attribution[0].length || 1000

    // Draw heatmap cells
    for (let l = 0; l < 12; l++) {
      const rowData = attribution[l]
      const y = l * rowHeight

      for (let t = 0; t < nSamples; t++) {
        const val = rowData[t] || 0
        const normVal = Math.max(-1, Math.min(1, val / maxAbsVal))

        // Diverging color scale:
        // normVal > 0 -> Burgundy (#A83245, rgb: 168, 50, 69)
        // normVal < 0 -> Deep Slate Blue (#2B4C6F, rgb: 43, 76, 111)
        // normVal = 0 -> Off-white neutral (#FAF9F6, rgb: 250, 249, 246)
        let r: number, g: number, b: number
        if (normVal >= 0) {
          const ratio = normVal
          r = Math.round(250 + (168 - 250) * ratio)
          g = Math.round(249 + (50 - 249) * ratio)
          b = Math.round(246 + (69 - 246) * ratio)
        } else {
          const ratio = -normVal
          r = Math.round(250 + (43 - 250) * ratio)
          g = Math.round(249 + (76 - 249) * ratio)
          b = Math.round(246 + (111 - 246) * ratio)
        }

        const cellX = (t / nSamples) * width
        const cellW = width / nSamples + 0.5 // overlap slightly to eliminate sub-pixel gaps

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
        ctx.fillRect(cellX, y, cellW, rowHeight)
      }

      // Draw subtle row divider
      ctx.strokeStyle = '#E8E6E1'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, y + rowHeight)
      ctx.lineTo(width, y + rowHeight)
      ctx.stroke()
    }

    // Highlight selected interval if provided
    if (selectedInterval) {
      const xStart = (selectedInterval.start / nSamples) * width
      const xEnd = (selectedInterval.end / nSamples) * width
      ctx.strokeStyle = '#A83245'
      ctx.lineWidth = 2
      ctx.strokeRect(xStart, 0, xEnd - xStart, height)
      ctx.fillStyle = 'rgba(168, 50, 69, 0.12)'
      ctx.fillRect(xStart, 0, xEnd - xStart, height)
    }

    // Draw active vertical time cursor line if hovering
    if (hoverInfo) {
      const cursorX = (hoverInfo.sampleIndex / nSamples) * width
      ctx.strokeStyle = '#252525'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 2])
      ctx.beginPath()
      ctx.moveTo(cursorX, 0)
      ctx.lineTo(cursorX, height)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }, [attribution, maxAbsVal, selectedInterval, hoverInfo])

  // Mouse interaction for hover inspection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !attribution || attribution.length < 12) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const mouseY = Math.max(0, Math.min(rect.height, e.clientY - rect.top))

    const rowHeight = rect.height / 12
    const leadIndex = Math.min(11, Math.max(0, Math.floor(mouseY / rowHeight)))
    const nSamples = attribution[0].length || 1000
    const sampleIndex = Math.min(nSamples - 1, Math.max(0, Math.floor((mouseX / rect.width) * nSamples)))

    const value = attribution[leadIndex]?.[sampleIndex] || 0
    const timeSec = sampleIndex / 100.0 // 100 Hz PTB-XL sampling rate

    setHoverInfo({
      leadIndex,
      leadName: LEADS[leadIndex],
      sampleIndex,
      timeSec,
      value,
      x: mouseX,
      y: mouseY,
    })
  }

  const handleMouseLeave = () => {
    setHoverInfo(null)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', background: '#FFFFFF', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', padding: '16px' }}>
      {/* Header with Title and Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Time &times; Lead Attribution Matrix (Integrated Gradients: {targetClass})
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            12 leads &times; 1,000 samples (10.0s at 100 Hz). Hover over matrix cells for point-wise gradient inspection.
          </div>
        </div>

        {/* Diverging Color Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={{ color: '#2B4C6F', fontWeight: 600 }}>&minus;{maxAbsVal.toFixed(3)}</span>
          <div
            style={{
              width: '120px',
              height: '10px',
              borderRadius: '3px',
              background: 'linear-gradient(to right, #2B4C6F 0%, #FAF9F6 50%, #A83245 100%)',
              border: '1px solid var(--border-subtle)',
            }}
          />
          <span style={{ color: '#A83245', fontWeight: 600 }}>+{maxAbsVal.toFixed(3)}</span>
        </div>
      </div>

      {/* Main Heatmap Canvas Layout */}
      <div style={{ display: 'flex' }}>
        {/* Lead Labels Column */}
        <div style={{ width: '45px', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', height: '240px', paddingRight: '8px', textAlign: 'right' }}>
          {LEADS.map((ld, i) => (
            <div
              key={ld}
              style={{
                fontSize: '0.72rem',
                fontWeight: hoverInfo?.leadIndex === i ? 700 : 500,
                color: hoverInfo?.leadIndex === i ? 'var(--accent-burgundy)' : 'var(--text-secondary)',
                lineHeight: 1,
              }}
            >
              {ld}
            </div>
          ))}
        </div>

        {/* Heatmap Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '240px', display: 'block', cursor: 'crosshair', borderRadius: '4px' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />

          {/* Time axis ticks */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            <span>0.0s</span>
            <span>2.0s</span>
            <span>4.0s</span>
            <span>6.0s</span>
            <span>8.0s</span>
            <span>10.0s</span>
          </div>

          {/* Interactive Inspection Tooltip */}
          {hoverInfo && (
            <div
              style={{
                position: 'absolute',
                left: `${Math.min(hoverInfo.x + 12, canvasRef.current ? canvasRef.current.clientWidth - 170 : hoverInfo.x)}px`,
                top: `${Math.max(10, hoverInfo.y - 60)}px`,
                background: 'rgba(37, 37, 37, 0.94)',
                color: '#FFFFFF',
                padding: '6px 10px',
                borderRadius: '5px',
                fontSize: '0.72rem',
                pointerEvents: 'none',
                zIndex: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                minWidth: '150px',
              }}
            >
              <div style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Lead {hoverInfo.leadName}</span>
                <span style={{ color: '#E8E6E1' }}>{hoverInfo.timeSec.toFixed(2)}s (#{hoverInfo.sampleIndex})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span style={{ color: '#C0C0BC' }}>Attribution:</span>
                <span
                  style={{
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: hoverInfo.value >= 0 ? '#F8B4BF' : '#A4C3E2',
                  }}
                >
                  {hoverInfo.value >= 0 ? '+' : ''}{hoverInfo.value.toFixed(5)}
                </span>
              </div>
              <div style={{ fontSize: '0.65rem', color: '#A0A09C', marginTop: '3px' }}>
                {hoverInfo.value > 0 ? '&uarr; Increases prediction score' : hoverInfo.value < 0 ? '&darr; Suppresses prediction score' : 'Neutral influence'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

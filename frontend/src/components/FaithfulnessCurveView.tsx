import React, { useState } from 'react'
import { FaithfulnessResponse } from '../types'
import { Activity, ShieldCheck, AlertCircle } from 'lucide-react'

interface FaithfulnessCurveViewProps {
  result: FaithfulnessResponse | null
  isLoading: boolean
  onRunTest: () => void
  targetClass: string
}

export const FaithfulnessCurveView: React.FC<FaithfulnessCurveViewProps> = ({
  result,
  isLoading,
  onRunTest,
  targetClass,
}) => {
  const [activeTab, setActiveTab] = useState<'deletion' | 'insertion'>('deletion')

  // Render SVG Chart for curves
  const renderCurveSvg = () => {
    if (!result) return null

    const delCurve = result.deletion_curve || []
    const insCurve = result.insertion_curve || []
    const isDel = activeTab === 'deletion'
    const curveData = isDel ? delCurve : insCurve

    if (curveData.length === 0) return null

    const svgWidth = 460
    const svgHeight = 220
    const padX = 50
    const padY = 30
    const plotW = svgWidth - padX - 25
    const plotH = svgHeight - padY - 35

    // Fractions: 0% to 30% (0.0 to 0.30)
    const maxFrac = 0.30
    // Probability range: 0.0 to 1.0 (or max observed)
    const p0 = result.initial_prob
    const pBase = result.baseline_prob ?? 0.0

    // Coordinates mapping
    const getX = (frac: number) => padX + (frac / maxFrac) * plotW
    const getY = (p: number) => padY + plotH - Math.max(0, Math.min(1, p)) * plotH

    // Line paths
    // For deletion: starts at (0, p0)
    // For insertion: starts at (0, pBase)
    const startYVal = isDel ? p0 : pBase

    let igPoints = `${getX(0)},${getY(startYVal)}`
    let randPoints = `${getX(0)},${getY(startYVal)}`

    curveData.forEach((pt) => {
      igPoints += ` ${getX(pt.fraction)},${getY(pt.p_ig)}`
      randPoints += ` ${getX(pt.fraction)},${getY(pt.p_random)}`
    })

    return (
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {/* Background & grid lines */}
        <rect x={padX} y={padY} width={plotW} height={plotH} fill="#FAFAF8" />

        {[0.0, 0.25, 0.5, 0.75, 1.0].map((pVal) => {
          const y = getY(pVal)
          return (
            <g key={pVal}>
              <line x1={padX} y1={y} x2={padX + plotW} y2={y} stroke="#E8E6E1" strokeWidth="1" strokeDasharray="3 3" />
              <text x={padX - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#777773" fontFamily="inherit">
                {(pVal * 100).toFixed(0)}%
              </text>
            </g>
          )
        })}

        {[0.05, 0.10, 0.15, 0.20, 0.25, 0.30].map((fVal) => {
          const x = getX(fVal)
          return (
            <g key={fVal}>
              <line x1={x} y1={padY} x2={x} y2={padY + plotH} stroke="#E8E6E1" strokeWidth="1" strokeDasharray="3 3" />
              <text x={x} y={padY + plotH + 16} textAnchor="middle" fontSize="10" fill="#777773" fontFamily="inherit">
                {(fVal * 100).toFixed(0)}%
              </text>
            </g>
          )
        })}

        {/* Axis titles */}
        <text x={padX + plotW / 2} y={svgHeight - 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="#252525">
          Perturbed Fraction of ECG Samples (k)
        </text>
        <text
          x={12}
          y={padY + plotH / 2}
          textAnchor="middle"
          fontSize="10"
          fontWeight="600"
          fill="#252525"
          transform={`rotate(-90 12 ${padY + plotH / 2})`}
        >
          Model Probability P({targetClass})
        </text>

        {/* Random baseline line (dashed gray) */}
        <polyline
          fill="none"
          stroke="#777773"
          strokeWidth="2"
          strokeDasharray="4 3"
          points={randPoints}
        />

        {/* Attribution curve line (solid burgundy) */}
        <polyline
          fill="none"
          stroke="#A83245"
          strokeWidth="2.5"
          points={igPoints}
        />

        {/* Data points dots */}
        {curveData.map((pt, i) => (
          <g key={i}>
            <circle cx={getX(pt.fraction)} cy={getY(pt.p_random)} r="3.5" fill="#777773" />
            <circle cx={getX(pt.fraction)} cy={getY(pt.p_ig)} r="4" fill="#A83245" />
          </g>
        ))}
      </svg>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Attribution Faithfulness Verification</h3>
          <p className="card-subtitle">
            Controlled deletion and insertion experiments testing whether the model truly relies on attributed samples
          </p>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={onRunTest}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Activity size={13} style={{ animation: 'spin 1.5s linear infinite' }} />
              <span>Perturbing Model...</span>
            </>
          ) : (
            <>
              <ShieldCheck size={13} />
              <span>Run Faithfulness Experiment</span>
            </>
          )}
        </button>
      </div>

      {result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            <div style={{ padding: '10px', background: '#FAFAF8', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>INITIAL SCORE P₀</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                {(result.initial_prob * 100).toFixed(1)}%
              </div>
            </div>

            <div style={{ padding: '10px', background: '#FAFAF8', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--accent-burgundy)', fontWeight: 600 }}>10% TOP-IG DROP</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-burgundy)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                -{(result.top_ig_prob_drop * 100).toFixed(1)}%
              </div>
            </div>

            <div style={{ padding: '10px', background: '#FAFAF8', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>10% RANDOM DROP</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                -{(result.random_prob_drop * 100).toFixed(1)}%
              </div>
            </div>

            <div style={{ padding: '10px', background: '#FAFAF8', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--accent-burgundy)', fontWeight: 600 }}>DROP RATIO (IG/RAND)</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-burgundy)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                {result.ratio_drop}&times;
              </div>
            </div>
          </div>

          {/* Area Under Curve Metrics (AUDC & AUIC) */}
          {result.audc_ig !== undefined && result.audc_rand !== undefined && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div style={{ padding: '12px', background: '#FAFAF8', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Area Under Deletion Curve (AUDC)</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Lower = More Faithful</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.85rem' }}>
                  <span>Top-IG: <strong style={{ color: 'var(--accent-burgundy)' }}>{result.audc_ig.toFixed(4)}</strong></span>
                  <span>Random: <strong>{result.audc_rand.toFixed(4)}</strong></span>
                </div>
              </div>

              <div style={{ padding: '12px', background: '#FAFAF8', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Area Under Insertion Curve (AUIC)</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Higher = More Faithful</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.85rem' }}>
                  <span>Top-IG: <strong style={{ color: 'var(--accent-burgundy)' }}>{result.auic_ig?.toFixed(4) ?? 'N/A'}</strong></span>
                  <span>Random: <strong>{result.auic_rand?.toFixed(4) ?? 'N/A'}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Curve Visualization Tabs */}
          <div style={{ background: '#FFFFFF', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'inline-flex', padding: '3px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <button
                  className={`btn btn-ghost btn-sm ${activeTab === 'deletion' ? 'btn-secondary' : ''}`}
                  style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                  onClick={() => setActiveTab('deletion')}
                >
                  Deletion Curve (Target Drop)
                </button>
                <button
                  className={`btn btn-ghost btn-sm ${activeTab === 'insertion' ? 'btn-secondary' : ''}`}
                  style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                  onClick={() => setActiveTab('insertion')}
                >
                  Insertion Curve (Recovery)
                </button>
              </div>

              {/* Curve Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.72rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '3px', background: 'var(--accent-burgundy)', borderRadius: '2px' }} />
                  <span style={{ fontWeight: 600, color: 'var(--accent-burgundy)' }}>Attribution-Guided</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '2px', background: '#777773', borderTop: '1px dashed #777773' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Random Baseline (Mean &plusmn; 3 runs)</span>
                </div>
              </div>
            </div>

            {renderCurveSvg()}
          </div>

          {/* Scientific Interpretation & Disclaimer */}
          <div style={{ padding: '12px 14px', background: '#FAFAF8', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Scientific Faithfulness Assessment:
            </div>
            <div>{result.interpretation}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {result.note}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Click <strong>Run Faithfulness Experiment</strong> above to evaluate attribution faithfulness across 5%–30% signal deletion and insertion curves.
        </div>
      )}
    </div>
  )
}

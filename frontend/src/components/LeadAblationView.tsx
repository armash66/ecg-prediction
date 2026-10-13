import React, { useState } from 'react'
import { LeadAblationResponse, LeadImportanceItem } from '../types'
import { Activity, Sliders, Info, Zap } from 'lucide-react'

interface LeadAblationViewProps {
  ablationData: LeadAblationResponse | null
  gradientImportance: LeadImportanceItem[] | null
  isLoading: boolean
  onRunAblation: () => void
  targetClass: string
}

export const LeadAblationView: React.FC<LeadAblationViewProps> = ({
  ablationData,
  gradientImportance,
  isLoading,
  onRunAblation,
  targetClass,
}) => {
  const [viewMode, setViewMode] = useState<'ablation' | 'comparison'>('ablation')

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Lead Importance &amp; Interventional Ablation</h3>
          <p className="card-subtitle">
            Direct intervention test: masks individual leads to baseline (0.0) and measures score drop (&Delta;P)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '3px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <button
              className={`btn btn-ghost btn-sm ${viewMode === 'ablation' ? 'btn-secondary' : ''}`}
              style={{ padding: '3px 8px', fontSize: '0.75rem' }}
              onClick={() => setViewMode('ablation')}
            >
              Interventional &Delta;P
            </button>
            <button
              className={`btn btn-ghost btn-sm ${viewMode === 'comparison' ? 'btn-secondary' : ''}`}
              style={{ padding: '3px 8px', fontSize: '0.75rem' }}
              onClick={() => setViewMode('comparison')}
            >
              Ablation vs. Gradient
            </button>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onRunAblation}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Activity size={13} style={{ animation: 'spin 1.5s linear infinite' }} />
                <span>Ablating...</span>
              </>
            ) : (
              <>
                <Sliders size={13} />
                <span>Run 12-Lead Ablation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {ablationData && ablationData.leads.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {viewMode === 'ablation' ? (
            /* Interventional Delta P Bars */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ablationData.leads.map((item, idx) => {
                const isTop = idx === 0
                const percent = Math.min(100, Math.max(0, item.impact_pct))
                const dropsScore = item.delta_p > 0

                return (
                  <div key={item.lead} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem' }}>
                    <div style={{ width: '60px', fontWeight: isTop ? 700 : 500, color: isTop ? 'var(--accent-burgundy)' : 'var(--text-primary)' }}>
                      Lead {item.lead}
                    </div>

                    <div style={{ flex: 1, height: '14px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${percent}%`,
                          backgroundColor: isTop ? 'var(--accent-burgundy)' : dropsScore ? '#C48A93' : '#777773',
                          borderRadius: '4px',
                        }}
                      />
                    </div>

                    <div style={{ width: '85px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: dropsScore ? 'var(--accent-burgundy)' : 'var(--text-secondary)' }}>
                      {dropsScore ? '-' : '+'}{Math.abs(item.delta_p * 100).toFixed(1)}% &Delta;P
                    </div>

                    <div style={{ width: '50px', textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {item.impact_pct}%
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Comparison Table: Interventional Delta P vs Gradient Attribution */
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>LEAD</th>
                    <th style={{ padding: '6px 8px' }}>P(ABLATED)</th>
                    <th style={{ padding: '6px 8px' }}>&Delta;P DROP</th>
                    <th style={{ padding: '6px 8px' }}>ABLATION RANK</th>
                    <th style={{ padding: '6px 8px' }}>IG MAGNITUDE</th>
                    <th style={{ padding: '6px 8px' }}>IG RANK</th>
                  </tr>
                </thead>
                <tbody>
                  {ablationData.leads.map((item, abIdx) => {
                    const igItem = gradientImportance?.find((g) => g.lead === item.lead)
                    const igRank = gradientImportance ? gradientImportance.findIndex((g) => g.lead === item.lead) + 1 : '-'

                    return (
                      <tr key={item.lead} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>Lead {item.lead}</td>
                        <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>
                          {(item.p_ablated * 100).toFixed(1)}%
                        </td>
                        <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: item.delta_p > 0 ? 'var(--accent-burgundy)' : 'var(--text-secondary)' }}>
                          {(item.delta_p * 100).toFixed(2)}%
                        </td>
                        <td style={{ padding: '6px 8px' }}>#{abIdx + 1}</td>
                        <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>
                          {igItem ? `${(igItem.normalized * 100).toFixed(1)}%` : 'N/A'}
                        </td>
                        <td style={{ padding: '6px 8px' }}>#{igRank}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ padding: '10px 12px', background: '#FAFAF8', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <strong>Methodology Distinction:</strong> Interventional lead ablation zeroes out each lead independently ($x[:, l, :] = 0.0$) and re-evaluates model output. Unlike Integrated Gradients (a path-integral of first-order gradients), ablation measures true non-linear counterfactual impact.
          </div>
        </div>
      ) : (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Click <strong>Run 12-Lead Ablation</strong> to perform counterfactual masking across all 12 ECG channels for {targetClass}.
        </div>
      )}
    </div>
  )
}

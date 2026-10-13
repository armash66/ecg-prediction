import React from 'react'
import { TimeRegionItem } from '../types'
import { Clock, Eye, Layers } from 'lucide-react'

interface TimeRegionsViewProps {
  timeRegions: TimeRegionItem[] | null
  targetClass: string
  selectedInterval: { start: number; end: number } | null
  onSelectInterval: (interval: { start: number; end: number } | null) => void
}

export const TimeRegionsView: React.FC<TimeRegionsViewProps> = ({
  timeRegions,
  targetClass,
  selectedInterval,
  onSelectInterval,
}) => {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Peak Temporal Attribution Intervals</h3>
          <p className="card-subtitle">
            Non-overlapping temporal windows (150ms) ranked by integrated attribution density for {targetClass}
          </p>
        </div>

        {selectedInterval && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onSelectInterval(null)}
            style={{ fontSize: '0.75rem' }}
          >
            Clear Selection
          </button>
        )}
      </div>

      {timeRegions && timeRegions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {timeRegions.map((region) => {
            const isSelected =
              selectedInterval?.start === region.start_sample &&
              selectedInterval?.end === region.end_sample

            return (
              <div
                key={region.rank}
                onClick={() =>
                  onSelectInterval(
                    isSelected
                      ? null
                      : { start: region.start_sample, end: region.end_sample }
                  )
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: isSelected ? 'var(--bg-subtle-burgundy)' : '#FAFAF8',
                  borderRadius: 'var(--radius-sm)',
                  border: isSelected
                    ? '1.5px solid var(--accent-burgundy)'
                    : '1px solid var(--border-light)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: isSelected ? 'var(--accent-burgundy)' : 'var(--bg-subtle)',
                      color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                    }}
                  >
                    #{region.rank}
                  </div>

                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {region.start_sec.toFixed(2)}s &ndash; {region.end_sec.toFixed(2)}s ({region.duration_ms}ms)
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Dominant Lead: <strong>{region.dominant_lead}</strong> ({region.dominant_lead_pct}% of window attribution)
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: isSelected ? 'var(--accent-burgundy)' : 'var(--text-primary)',
                    }}
                  >
                    {region.magnitude.toFixed(4)}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {isSelected ? 'Selected (Active on waveform)' : 'Click to inspect window'}
                  </div>
                </div>
              </div>
            )
          })}

          <div
            style={{
              padding: '8px 12px',
              background: '#FAFAF8',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
            }}
          >
            <strong>Note:</strong> Peak attribution ranking is computed via non-overlapping sliding window convolution across the 12-lead attribution matrix. It does not imply clinical wave delineation (e.g. automated P, QRS, or T labeling).
          </div>
        </div>
      ) : (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Compute attribution to view peak temporal intervals for {targetClass}.
        </div>
      )}
    </div>
  )
}

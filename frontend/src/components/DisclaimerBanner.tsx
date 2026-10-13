import React from 'react'
import { AlertCircle } from 'lucide-react'

export const DisclaimerBanner: React.FC = () => {
  return (
    <div className="disclaimer-banner">
      <AlertCircle size={15} style={{ flexShrink: 0, color: 'var(--accent-burgundy)' }} />
      <span>
        <strong>Research use only.</strong> Model outputs are experimental and are not a clinical diagnosis. ECG interpretation and medical decisions require qualified healthcare professionals.
      </span>
    </div>
  )
}

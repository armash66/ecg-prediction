import React from 'react'
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Database,
  Lock,
  Cpu,
  Info,
  CheckCircle2,
  AlertTriangle,
  Server,
  HeartPulse,
} from 'lucide-react'
import { useAnalysis } from '../context/AnalysisContext'

export const SettingsView: React.FC = () => {
  const { health, activeModel, setActiveModel, models } = useAnalysis()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Settings Header */}
      <div
        className="card"
        style={{
          padding: '24px',
          background: '#FFFFFF',
          borderLeft: '4px solid #A83245',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <HeartPulse size={20} style={{ color: '#A83245' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#252525', margin: 0 }}>
            ECG Intelligence System Settings & Clinical Disclosures
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: '#777773', margin: 0 }}>
          System configuration, inference architecture management, data governance, and regulatory disclosures.
        </p>
      </div>

      {/* Model Selection Preference */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#252525', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={16} style={{ color: '#A83245' }} />
          <span>Active Inference Model Selection</span>
        </h3>
        <p style={{ fontSize: '13px', color: '#777773', marginBottom: '16px' }}>
          Select the active machine learning architecture executed for live 12-lead pattern recognition.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {models.filter(m => m.inference_ready).map((m) => {
            const isSelected = activeModel === m.id
            return (
              <div
                key={m.id}
                onClick={() => setActiveModel(m.id)}
                style={{
                  padding: '14px 16px',
                  borderRadius: '8px',
                  border: `2px solid ${isSelected ? '#A83245' : '#E8E6E1'}`,
                  background: isSelected ? '#F8EAED' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: isSelected ? '#A83245' : '#252525' }}>
                    {m.display_name}
                  </span>
                  {isSelected && <CheckCircle2 size={16} style={{ color: '#A83245' }} />}
                </div>
                <div style={{ fontSize: '12px', color: '#777773' }}>
                  {m.description.slice(0, 110)}...
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Privacy, Security & Data Sovereignty */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#252525', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={16} style={{ color: '#34765A' }} />
          <span>Privacy & Security Architecture</span>
        </h3>
        <p style={{ fontSize: '13px', color: '#777773', marginBottom: '16px' }}>
          Compliance with sensitive health information management principles.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: '#252525' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <CheckCircle2 size={16} style={{ color: '#34765A', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <b>Strict Local Execution:</b> All PyTorch inference models, Integrated Gradients attributions, and clinical notes run 100% locally on this host. No patient data or waveform arrays are sent to external cloud APIs or third-party LLMs.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <CheckCircle2 size={16} style={{ color: '#34765A', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <b>Deterministic AI Note Generation:</b> The AI draft assistant uses local deterministic templates based strictly on recorded signal metrics and model outputs. It does not fabricate symptoms or hallucinate clinical history.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <CheckCircle2 size={16} style={{ color: '#34765A', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <b>Relational Data Integrity:</b> Patient charts, encounters, ECG studies, and reports are persisted via parameterized SQLite queries with cascading referential integrity.
            </div>
          </div>
        </div>
      </div>

      {/* Regulatory & Clinical Prototype Disclaimer */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          background: '#FDF4E7',
          border: '1px solid #E8E6E1',
          borderLeft: '4px solid #B77925',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <AlertTriangle size={18} style={{ color: '#B77925' }} />
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#634212', margin: 0 }}>
            Regulatory Notice & Research Prototype Limitations
          </h4>
        </div>
        <p style={{ fontSize: '12px', color: '#634212', lineHeight: '1.6', margin: 0 }}>
          ECG Intelligence is an investigational decision-support research application developed on the PTB-XL dataset.
          It has not been cleared or certified by the FDA, CE, or other health authorities for autonomous medical diagnostic use.
          All model classifications, threshold flags, and attribution heatmaps must be independently inspected, verified, and signed off
          by a licensed physician before any patient management or diagnostic decisions are made.
        </p>
      </div>
    </div>
  )
}

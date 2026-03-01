import React, { useState } from 'react';
import { useOnboarding } from '../../runtime/OnboardingContext';

const SAFETY_TIERS: { value: 'strict' | 'balanced' | 'permissive'; label: string; description: string }[] = [
  { value: 'strict', label: 'Strict', description: 'Require approval for write/exec actions' },
  { value: 'balanced', label: 'Balanced', description: 'Approve only sensitive operations' },
  { value: 'permissive', label: 'Permissive', description: 'Auto-approve most actions' },
];

export const AgentSetup: React.FC = () => {
   const { nextStep, prevStep, updateData, onboardingData } = useOnboarding();
   const [nickname, setNickname] = useState(onboardingData.agentNickname || '');
   const [selectedSafety, setSelectedSafety] = useState<'strict' | 'balanced' | 'permissive'>(
     onboardingData.safetyTier || 'balanced'
   );

   const handleNext = () => {
     updateData({ agentNickname: nickname || 'My Agent', safetyTier: selectedSafety });
     nextStep();
   };

   return (
     <div className="onboarding-overlay">
       <div className="onboarding-card">
         <div className="onboarding-header">
           <div className="onboarding-emoji">🛡️</div>
           <h1 className="onboarding-title">Configure Your Profile</h1>
           <p className="onboarding-subtitle">
             Set your agent name and safety preferences for actions
           </p>
         </div>

         <div className="onboarding-content">
           <div className="onboarding-form-group">
             <label className="onboarding-label">
               Agent Nickname
               <span className="tooltip-trigger">
                 ?
                 <span className="tooltip-content">How you'll refer to your AI assistant</span>
               </span>
             </label>
             <input
               type="text"
               className="onboarding-input"
               placeholder="e.g. Jarvis, Friday, Hal..."
               value={nickname}
               onChange={(e) => setNickname(e.target.value)}
               autoFocus
             />
           </div>

           <div className="onboarding-form-group">
             <label className="onboarding-label">
               Safety Tier
               <span className="tooltip-trigger">
                 ?
                 <span className="tooltip-content">Controls when you need to approve agent actions</span>
               </span>
             </label>

             <div className="skill-grid">
               {SAFETY_TIERS.map((tier) => (
                 <div
                   key={tier.value}
                   className={`skill-card ${selectedSafety === tier.value ? 'selected' : ''}`}
                   onClick={() => setSelectedSafety(tier.value)}
                 >
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div className="skill-title" style={{ margin: 0 }}>{tier.label}</div>
                     {selectedSafety === tier.value && (
                       <div style={{ color: 'var(--ob-primary)', fontSize: '1.2rem' }}>✓</div>
                     )}
                   </div>
                   <div className="skill-desc">{tier.description}</div>
                 </div>
               ))}
             </div>
           </div>

           <div style={{
             padding: '16px',
             background: 'rgba(56, 189, 248, 0.1)',
             borderRadius: '12px',
             border: '1px solid rgba(56, 189, 248, 0.3)',
             fontSize: '0.875rem',
             color: 'var(--ob-text-main)',
           }}>
             <strong>💡 Tip:</strong> "Balanced" is recommended for most users. It requires approval for write/exec actions but auto-approves read operations.
           </div>
         </div>

         <div className="onboarding-actions">
           <button className="onboarding-btn onboarding-btn-ghost" onClick={prevStep}>
             Back
           </button>
           <div className="onboarding-progress">
             <div className="progress-dot" />
             <div className="progress-dot" />
             <div className="progress-dot active" />
             <div className="progress-dot" />
             <div className="progress-dot" />
             <div className="progress-dot" />
           </div>
           <button className="onboarding-btn onboarding-btn-primary" onClick={handleNext}>
             Continue <span>→</span>
           </button>
         </div>
       </div>
     </div>
   );
 };

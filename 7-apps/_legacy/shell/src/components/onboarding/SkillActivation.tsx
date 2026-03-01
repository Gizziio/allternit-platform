import React from 'react';
import { useOnboarding, SkillPackage } from '../../runtime/OnboardingContext';

const SKILL_PACKAGES: SkillPackage[] = [
  {
    id: 'fwk.research',
    name: 'Study Framework',
    description: 'Gather information from web, analyze documents, and synthesize research findings.',
    icon: '📚',
    frameworkType: 'fwk.research',
    skills: ['web_browse', 'document_analysis', 'summarization', 'citation'],
  },
  {
    id: 'fwk.build',
    name: 'Build Framework',
    description: 'Code generation, debugging, testing, and implementation tasks.',
    icon: '🔨',
    frameworkType: 'fwk.build',
    skills: ['code_generation', 'git_integration', 'debugging', 'testing'],
  },
  {
    id: 'fwk.plan',
    name: 'Plan Framework',
    description: 'Project scheduling, task breakdown, and roadmap planning.',
    icon: '📋',
    frameworkType: 'fwk.plan',
    skills: ['task_management', 'calendar_integration', 'scheduling', 'roadmapping'],
  },
  {
    id: 'fwk.diff_review',
    name: 'Compare Framework',
    description: 'Code review, diff analysis, and quality assessment.',
    icon: '⚖️',
    frameworkType: 'fwk.diff_review',
    skills: ['code_review', 'diff_analysis', 'quality_check', 'security_audit'],
  },
];

export const SkillActivation: React.FC = () => {
  const { nextStep, prevStep, updateData, onboardingData } = useOnboarding();
  const selectedPackages = new Set(onboardingData.selectedSkillPackages || []);

  const togglePackage = (id: string) => {
    const newSelection = new Set(selectedPackages);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    updateData({ selectedSkillPackages: Array.from(newSelection) });
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card" style={{ maxWidth: '800px' }}>
        <div className="onboarding-header">
          <div className="onboarding-emoji">⚡</div>
          <h1 className="onboarding-title">Activate Skills</h1>
          <p className="onboarding-subtitle">
            Choose the capabilities you want your agent to have out of the box. You can always add more later.
          </p>
        </div>

        <div className="onboarding-content">
          <div style={{
            padding: '16px',
            background: 'rgba(56, 189, 248, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            fontSize: '0.875rem',
            color: 'var(--ob-text-main)',
            marginBottom: '16px'
          }}>
            <strong>💡 How Frameworks work:</strong> Each framework creates a specialized capsule workspace. You can spawn these capsules anytime from the Inspector panel.
          </div>

          <div className="skill-grid">
            {SKILL_PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                className={`skill-card ${selectedPackages.has(pkg.id) ? 'selected' : ''}`}
                onClick={() => togglePackage(pkg.id)}
              >
                <div className="skill-icon">{pkg.icon}</div>
                <div className="skill-title">{pkg.name}</div>
                <div className="skill-desc">{pkg.description}</div>
                {selectedPackages.has(pkg.id) && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    color: 'var(--ob-primary)',
                    fontSize: '1.2rem',
                    background: 'rgba(56, 189, 248, 0.2)',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>✓</div>
                )}
                <div style={{
                  marginTop: '12px',
                  fontSize: '0.75rem',
                  color: 'var(--ob-text-muted)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px'
                }}>
                  {pkg.skills.map((skill) => (
                    <span
                      key={skill}
                      style={{
                        padding: '2px 8px',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '999px',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="onboarding-actions">
          <button className="onboarding-btn onboarding-btn-ghost" onClick={prevStep}>
            Back
          </button>
          <div className="onboarding-progress">
            <div className="progress-dot" />
            <div className="progress-dot" />
            <div className="progress-dot" />
            <div className="progress-dot active" />
            <div className="progress-dot" />
            <div className="progress-dot" />
          </div>
          <button className="onboarding-btn onboarding-btn-primary" onClick={nextStep}>
            Activate {selectedPackages.size > 0 && `(${selectedPackages.size})`} <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
};

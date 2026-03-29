import { useState } from 'react';
import {
  UploadSimple,
  CheckCircle,
  FileText,
  Package,
  Shield,
  RocketLaunch,
  Copy,
  Check,
  Terminal,
  Warning,
  Star,
  Users,
} from '@phosphor-icons/react';

const steps = [
  {
    id: 'prepare',
    number: 1,
    title: 'Prepare Your Skill',
    description: 'Ensure your skill meets all requirements',
    icon: FileText,
    content: {
      title: 'Preparation Checklist',
      items: [
        'Valid skill.toml manifest file',
        'README with usage instructions',
        'Properly configured dependencies',
        'Environment variables documented',
        'Error handling implemented',
        'Tests passing (if applicable)',
      ],
    },
  },
  {
    id: 'validate',
    number: 2,
    title: 'Validate',
    description: 'Run validation checks locally',
    icon: Shield,
    content: {
      title: 'Validation Steps',
      items: [
        'Run a2r validate to check manifest',
        'Test skill execution locally',
        'Verify all inputs/outputs',
        'Check security best practices',
        'Review rate limiting setup',
      ],
    },
  },
  {
    id: 'package',
    number: 3,
    title: 'Package',
    description: 'Create distributable package',
    icon: Package,
    content: {
      title: 'Packaging Commands',
      items: [
        'a2r build - Build the skill',
        'a2r test - Run all tests',
        'a2r package - Create .a2r package',
      ],
    },
  },
  {
    id: 'publish',
    number: 4,
    title: 'Publish',
    description: 'Submit to the marketplace',
    icon: RocketLaunch,
    content: {
      title: 'Publishing Options',
      items: [
        'Public - Available to all users',
        'Private - Organization only',
        'Unlisted - Link-only access',
      ],
    },
  },
];

const requirements = [
  {
    title: 'Manifest Requirements',
    items: [
      { label: 'Unique skill ID', required: true },
      { label: 'Semantic version', required: true },
      { label: 'Description (min 50 chars)', required: true },
      { label: 'Author information', required: true },
      { label: 'License specified', required: true },
      { label: 'Input/output schemas', required: true },
    ],
  },
  {
    title: 'Code Requirements',
    items: [
      { label: 'No hardcoded secrets', required: true },
      { label: 'Error handling', required: true },
      { label: 'Rate limiting respected', required: true },
      { label: 'Timeout handling', required: true },
      { label: 'Logging implemented', required: false },
      { label: 'Documentation comments', required: false },
    ],
  },
];

export default function PublishGuide() {
  const [activeStep, setActiveStep] = useState('prepare');
  const [copied, setCopied] = useState(false);

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentStep = steps.find(s => s.id === activeStep);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-a2r-text mb-2">Publish Guide</h1>
        <p className="text-a2r-text-secondary">
          Learn how to package and publish your skills to the A2R marketplace.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = activeStep === step.id;
          const isPast = steps.findIndex(s => s.id === activeStep) > index;
          
          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border min-w-fit transition-all ${
                isActive 
                  ? 'bg-a2r-accent/10 border-a2r-accent' 
                  : isPast
                    ? 'bg-a2r-surface border-a2r-border hover:border-a2r-border-hover'
                    : 'bg-a2r-surface/50 border-a2r-border/50 hover:border-a2r-border'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isActive 
                  ? 'bg-a2r-accent text-a2r-bg' 
                  : isPast
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-a2r-bg text-a2r-text-muted'
              }`}>
                {isPast ? <CheckCircle size={16} /> : <Icon size={16} />}
              </div>
              <div className="text-left">
                <div className={`text-sm font-medium ${isActive ? 'text-a2r-accent' : 'text-a2r-text'}`}>
                  Step {step.number}
                </div>
                <div className="text-xs text-a2r-text-muted">{step.title}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Step Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-a2r-surface border border-a2r-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-a2r-accent/10 flex items-center justify-center">
                {currentStep && <currentStep.icon className="w-6 h-6 text-a2r-accent" />}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-a2r-text">{currentStep?.title}</h2>
                <p className="text-sm text-a2r-text-secondary">{currentStep?.description}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-a2r-text">{currentStep?.content.title}</h3>
              <ul className="space-y-3">
                {currentStep?.content.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-a2r-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle className="w-3 h-3 text-a2r-accent" />
                    </div>
                    <span className="text-a2r-text-secondary">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Code Example */}
          <div className="bg-a2r-surface border border-a2r-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-a2r-border bg-a2r-surface-elevated">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-a2r-text-muted" />
                <span className="text-sm font-medium text-a2r-text">CLI Commands</span>
              </div>
              <button
                onClick={() => copyCommand('a2r validate && a2r build && a2r publish')}
                className="p-1.5 text-a2r-text-muted hover:text-a2r-text hover:bg-a2r-surface-hover rounded transition-colors"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <div className="p-4">
              <pre className="font-mono text-sm text-a2r-text">
                <code>{`# Validate your skill
$ a2r validate
✓ Manifest valid
✓ Schema valid
✓ Dependencies resolved

# Build the package
$ a2r build
Building my-skill v1.0.0...
✓ Build complete

# Publish to marketplace
$ a2r publish --public
Uploading...
✓ Published successfully!
  URL: https://a2r.dev/marketplace/skill/my-skill`}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Requirements */}
          {requirements.map((section) => (
            <div key={section.title} className="bg-a2r-surface border border-a2r-border rounded-xl p-5">
              <h3 className="font-medium text-a2r-text mb-4">{section.title}</h3>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-a2r-text-secondary">{item.label}</span>
                    {item.required ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400">
                        Required
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-a2r-bg text-a2r-text-muted">
                        Optional
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Tips */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Warning className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-400 mb-1">Pro Tips</h4>
                <ul className="text-sm text-amber-400/80 space-y-1">
                  <li>• Use semantic versioning</li>
                  <li>• Include example inputs</li>
                  <li>• Add a demo video/GIF</li>
                  <li>• Respond to user feedback</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-a2r-border">
        {[
          { label: 'Published Skills', value: '1,234', icon: Package },
          { label: 'Active Publishers', value: '567', icon: Users },
          { label: 'Total Downloads', value: '45.2K', icon: UploadSimple },
          { label: 'Avg Rating', value: '4.8', icon: Star },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="text-center p-4 bg-a2r-surface rounded-xl border border-a2r-border">
              <Icon className="w-5 h-5 text-a2r-accent mx-auto mb-2" />
              <div className="text-2xl font-bold text-a2r-text">{stat.value}</div>
              <div className="text-xs text-a2r-text-muted">{stat.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Code,
  Browsers,
  UploadSimple,
  Lightning,
  Shield,
  Globe,
  Sparkle,
} from '@phosphor-icons/react';

const quickStartCards = [
  {
    icon: BookOpen,
    title: 'Documentation',
    description: 'Learn the fundamentals of building skills for the A2R platform.',
    link: '/docs',
    color: 'from-blue-500/20 to-blue-600/10',
  },
  {
    icon: Code,
    title: 'API Explorer',
    description: 'Explore our REST and WebSocket APIs with interactive examples.',
    link: '/api',
    color: 'from-purple-500/20 to-purple-600/10',
  },
  {
    icon: Browsers,
    title: 'Templates',
    description: 'Start quickly with pre-built skill templates and boilerplates.',
    link: '/templates',
    color: 'from-emerald-500/20 to-emerald-600/10',
  },
  {
    icon: UploadSimple,
    title: 'Publish Guide',
    description: 'Learn how to package and publish your skills to the marketplace.',
    link: '/publish',
    color: 'from-amber-500/20 to-amber-600/10',
  },
];

const features = [
  {
    icon: Lightning,
    title: 'Lightning Fast',
    description: 'Optimized runtime with sub-100ms cold start times.',
  },
  {
    icon: Shield,
    title: 'Secure by Default',
    description: 'End-to-end encryption and sandboxed execution.',
  },
  {
    icon: Globe,
    title: 'Global Edge',
    description: 'Deploy to 35+ regions worldwide.',
  },
  {
    icon: Sparkle,
    title: 'AI-Native',
    description: 'Built for AI agents with native LLM integrations.',
  },
];

export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-12 lg:py-20">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-a2r-accent/10 border border-a2r-accent/20 mb-8">
          <Sparkle className="w-4 h-4 text-a2r-accent" />
          <span className="text-sm text-a2r-accent">A2R Platform v1.0 is now available</span>
        </div>
        
        <h1 className="text-4xl lg:text-6xl font-bold mb-6">
          <span className="text-gradient">Build skills</span>
          <br />
          <span className="text-a2r-text">for the AI era</span>
        </h1>
        
        <p className="text-lg lg:text-xl text-a2r-text-secondary max-w-2xl mx-auto mb-10">
          Create, deploy, and distribute intelligent skills for the A2R platform. 
          Join thousands of developers building the future of AI automation.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/docs"
            className="flex items-center gap-2 px-6 py-3 bg-a2r-accent text-a2r-bg rounded-lg font-medium hover:bg-a2r-accent-hover transition-colors"
          >
            <BookOpen size={16} />
            Get Started
          </Link>
          <Link
            to="/templates"
            className="flex items-center gap-2 px-6 py-3 border border-a2r-border rounded-lg text-a2r-text hover:bg-a2r-surface-hover transition-colors"
          >
            <Browsers size={16} />
            Browse Templates
          </Link>
        </div>
      </section>

      {/* Quick Start Cards */}
      <section>
        <h2 className="text-2xl font-semibold text-a2r-text mb-6">Quick Start</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickStartCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                to={card.link}
                className="group p-6 rounded-xl bg-a2r-surface border border-a2r-border hover:border-a2r-border-hover transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6 text-a2r-text" />
                </div>
                <h3 className="text-lg font-semibold text-a2r-text mb-2 group-hover:text-a2r-accent transition-colors">
                  {card.title}
                </h3>
                <p className="text-a2r-text-secondary text-sm mb-4">
                  {card.description}
                </p>
                <div className="flex items-center gap-1 text-sm text-a2r-accent group-hover:gap-2 transition-all">
                  <span>Learn more</span>
                  <ArrowRight size={16} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Features */}
      <section className="py-8">
        <h2 className="text-2xl font-semibold text-a2r-text mb-6">Why build on A2R?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="text-center">
                <div className="w-12 h-12 mx-auto rounded-lg bg-a2r-surface border border-a2r-border flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-a2r-accent" />
                </div>
                <h3 className="font-medium text-a2r-text mb-2">{feature.title}</h3>
                <p className="text-sm text-a2r-text-secondary">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-6 lg:px-12 rounded-2xl bg-gradient-to-br from-a2r-surface to-a2r-surface-elevated border border-a2r-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl lg:text-3xl font-semibold text-a2r-text mb-4">
            Ready to start building?
          </h2>
          <p className="text-a2r-text-secondary mb-8">
            Join our community of developers and start creating intelligent skills today. 
            Get started in minutes with our CLI and templates.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <code className="px-4 py-2 bg-a2r-bg rounded-lg text-sm font-mono text-a2r-accent border border-a2r-border">
              npm create a2r-skill@latest
            </code>
            <Link
              to="/docs/getting-started"
              className="flex items-center gap-2 text-a2r-accent hover:text-a2r-accent-hover transition-colors"
            >
              <span>View installation guide</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

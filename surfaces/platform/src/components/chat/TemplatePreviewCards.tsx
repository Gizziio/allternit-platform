/**
 * Template Preview Cards
 * 
 * Polished preview cards that appear when selecting a mode.
 * Shows 4-6 template examples with nice preview images, similar to Kimi/MiniMax.
 * 
 * Each card shows:
 * - Visual preview (gradient/image representing output)
 * - Template name
 * - Brief description
 * - One-click to use
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  Image, Video, FileText, Code, Globe, 
  Presentation, Database, Cpu, Network, 
  Sparkles, ArrowRight, Wand2, Palette,
  LineChart, FileSpreadsheet, FileCode,
  Search, Bot, Workflow
} from 'lucide-react';

// =============================================================================
// TEMPLATE DATA BY MODE
// =============================================================================

export interface TemplatePreview {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: React.ElementType;
  preview: {
    type: 'gradient' | 'image' | 'code' | 'chart';
    gradient?: string;
    imageUrl?: string;
    codeSnippet?: string;
  };
}

const MODE_TEMPLATES: Record<string, TemplatePreview[]> = {
  // === CREATE GROUP (Violet) ===
  image: [
    {
      id: 'product-photo',
      name: 'Product Photography',
      description: 'Professional product shots with studio lighting',
      prompt: 'A sleek wireless headphones product photo, floating on white background, soft studio lighting, professional commercial photography, 8k, detailed textures',
      icon: Image,
      preview: { type: 'gradient', gradient: 'from-violet-500 via-purple-500 to-fuchsia-500' }
    },
    {
      id: 'portrait',
      name: 'Portrait Art',
      description: 'Artistic portrait with custom style',
      prompt: 'Portrait of a creative professional in their studio, natural window lighting, shallow depth of field, warm tones, professional photography',
      icon: Palette,
      preview: { type: 'gradient', gradient: 'from-fuchsia-500 via-pink-500 to-rose-500' }
    },
    {
      id: 'landscape',
      name: 'Landscape',
      description: 'Stunning natural landscapes',
      prompt: 'Dramatic mountain landscape at golden hour, snow-capped peaks reflecting in a crystal lake, epic clouds, cinematic composition, 8k resolution',
      icon: Image,
      preview: { type: 'gradient', gradient: 'from-blue-500 via-violet-500 to-purple-500' }
    },
    {
      id: 'abstract',
      name: 'Abstract Art',
      description: 'Creative abstract compositions',
      prompt: 'Abstract flowing shapes in teal and coral, liquid metal texture, studio lighting, minimalist composition, high-end 3D render',
      icon: Sparkles,
      preview: { type: 'gradient', gradient: 'from-teal-400 via-cyan-500 to-blue-500' }
    },
    {
      id: 'interior',
      name: 'Interior Design',
      description: 'Modern interior spaces',
      prompt: 'Modern minimalist living room, floor-to-ceiling windows, neutral tones with accent colors, architectural photography, natural lighting',
      icon: Image,
      preview: { type: 'gradient', gradient: 'from-amber-400 via-orange-400 to-rose-400' }
    },
    {
      id: 'food',
      name: 'Food Photography',
      description: 'Appetizing food shots',
      prompt: 'Gourmet dish plating, overhead angle, rustic wooden table, soft natural light, food photography, editorial style',
      icon: Image,
      preview: { type: 'gradient', gradient: 'from-green-400 via-emerald-500 to-teal-500' }
    }
  ],
  
  video: [
    {
      id: 'cinematic',
      name: 'Cinematic Scene',
      description: 'Movie-quality dramatic shots',
      prompt: 'A cyberpunk city street at night, neon lights reflecting on wet pavement, flying cars, cinematic atmosphere, blade runner style',
      icon: Video,
      preview: { type: 'gradient', gradient: 'from-cyan-500 via-blue-600 to-purple-700' }
    },
    {
      id: 'nature',
      name: 'Nature Motion',
      description: 'Beautiful natural movements',
      prompt: 'Cherry blossoms falling in slow motion, sunlight filtering through petals, peaceful Japanese garden, dreamy atmosphere',
      icon: Video,
      preview: { type: 'gradient', gradient: 'from-pink-400 via-rose-400 to-purple-400' }
    },
    {
      id: 'product-demo',
      name: 'Product Demo',
      description: '360° product showcases',
      prompt: 'Sleek smartphone rotating 360 degrees, studio lighting, floating particles, premium product video',
      icon: Video,
      preview: { type: 'gradient', gradient: 'from-slate-600 via-gray-600 to-zinc-700' }
    },
    {
      id: 'animation',
      name: 'Animated Story',
      description: 'Character animations',
      prompt: 'Cute robot exploring a futuristic city, Pixar style animation, warm lighting, adventure scene',
      icon: Video,
      preview: { type: 'gradient', gradient: 'from-orange-400 via-amber-500 to-yellow-500' }
    }
  ],
  
  slides: [
    {
      id: 'pitch-deck',
      name: 'Pitch Deck',
      description: 'Investor presentation',
      prompt: 'Create a 10-slide pitch deck for a SaaS startup: Problem, Solution, Market Size, Business Model, Traction, Team, Financials, Ask',
      icon: Presentation,
      preview: { type: 'gradient', gradient: 'from-blue-600 via-indigo-600 to-violet-600' }
    },
    {
      id: 'quarterly-review',
      name: 'QTR Review',
      description: 'Business quarterly report',
      prompt: 'Q3 2024 quarterly business review with: Executive Summary, Key Metrics, Wins, Challenges, Q4 Goals, charts and data visualizations',
      icon: FileText,
      preview: { type: 'gradient', gradient: 'from-emerald-500 via-teal-600 to-cyan-600' }
    },
    {
      id: 'training',
      name: 'Training Deck',
      description: 'Employee onboarding',
      prompt: 'New employee onboarding presentation: Company Culture, Tools & Systems, Team Structure, First Week Goals, Resources',
      icon: Presentation,
      preview: { type: 'gradient', gradient: 'from-orange-500 via-red-500 to-pink-500' }
    },
    {
      id: 'research',
      name: 'Research Findings',
      description: 'User research presentation',
      prompt: 'User research findings deck: Methodology, Participant Demographics, Key Insights, Recommendations, Next Steps, with quotes and data',
      icon: Search,
      preview: { type: 'gradient', gradient: 'from-violet-500 via-purple-600 to-fuchsia-600' }
    }
  ],
  
  website: [
    {
      id: 'landing-page',
      name: 'Landing Page',
      description: 'High-converting landing page',
      prompt: 'Create a landing page for a productivity app: Hero with CTA, Features grid, Testimonials, Pricing, FAQ, Footer. Modern, clean design.',
      icon: Globe,
      preview: { type: 'gradient', gradient: 'from-blue-500 via-cyan-500 to-teal-400' }
    },
    {
      id: 'portfolio',
      name: 'Portfolio Site',
      description: 'Personal portfolio',
      prompt: 'Design portfolio website: Hero section, About, Selected Works grid, Skills, Contact form. Minimalist aesthetic.',
      icon: Palette,
      preview: { type: 'gradient', gradient: 'from-zinc-700 via-stone-700 to-neutral-700' }
    },
    {
      id: 'dashboard',
      name: 'Dashboard UI',
      description: 'Analytics dashboard',
      prompt: 'Create an analytics dashboard: Sidebar nav, KPI cards, Charts area, Recent activity, User menu. Dark mode.',
      icon: LineChart,
      preview: { type: 'gradient', gradient: 'from-slate-800 via-gray-800 to-zinc-900' }
    },
    {
      id: 'ecommerce',
      name: 'E-commerce',
      description: 'Online store',
      prompt: 'Build an e-commerce homepage: Navigation, Hero banner, Featured products grid, Categories, Newsletter signup, Footer.',
      icon: Globe,
      preview: { type: 'gradient', gradient: 'from-emerald-500 via-green-500 to-teal-500' }
    }
  ],
  
  // === ANALYZE GROUP (Blue) ===
  research: [
    {
      id: 'market-research',
      name: 'Market Analysis',
      description: 'Industry deep-dive',
      prompt: 'Research the AI code assistant market: Market size, Key players (GitHub Copilot, Cursor, etc.), Pricing models, Feature comparison, Trends',
      icon: Search,
      preview: { type: 'gradient', gradient: 'from-blue-500 via-blue-600 to-indigo-600' }
    },
    {
      id: 'competitor',
      name: 'Competitor Intel',
      description: 'Competitive analysis',
      prompt: 'Analyze competitors in the project management space: Notion, Asana, Monday.com, ClickUp - features, pricing, strengths, weaknesses',
      icon: Bot,
      preview: { type: 'gradient', gradient: 'from-cyan-500 via-blue-500 to-indigo-500' }
    },
    {
      id: 'trends',
      name: 'Trend Report',
      description: 'Emerging trends',
      prompt: 'Research 2024 trends in remote work technology: Key technologies, Adoption stats, Leading companies, Future predictions, Citations',
      icon: LineChart,
      preview: { type: 'gradient', gradient: 'from-violet-500 via-purple-500 to-fuchsia-500' }
    },
    {
      id: 'regulatory',
      name: 'Regulatory',
      description: 'Compliance research',
      prompt: 'Research GDPR compliance requirements for AI companies: Key obligations, Recent fines, Best practices, Implementation checklist',
      icon: FileText,
      preview: { type: 'gradient', gradient: 'from-emerald-500 via-teal-500 to-cyan-500' }
    }
  ],
  
  data: [
    {
      id: 'csv-analysis',
      name: 'CSV Analysis',
      description: 'Upload & analyze data',
      prompt: 'Analyze this sales data CSV: Calculate total revenue by month, Identify top products, Find trends, Create visualizations',
      icon: FileSpreadsheet,
      preview: { type: 'gradient', gradient: 'from-green-500 via-emerald-500 to-teal-500' }
    },
    {
      id: 'sql-query',
      name: 'SQL Queries',
      description: 'Database analysis',
      prompt: 'Write SQL queries for: Monthly active users, Churn rate by cohort, Revenue per customer segment, Top feature usage',
      icon: Database,
      preview: { type: 'gradient', gradient: 'from-blue-500 via-indigo-500 to-purple-500' }
    },
    {
      id: 'visualization',
      name: 'Data Viz',
      description: 'Charts & dashboards',
      prompt: 'Create data visualizations: Bar chart for sales by region, Line chart for growth over time, Pie chart for market share, KPI cards',
      icon: LineChart,
      preview: { type: 'gradient', gradient: 'from-orange-500 via-amber-500 to-yellow-500' }
    },
    {
      id: 'forecasting',
      name: 'Forecasting',
      description: 'Predictive analytics',
      prompt: 'Forecast Q4 revenue based on historical data: Trend analysis, Seasonal adjustments, Confidence intervals, Risk factors',
      icon: LineChart,
      preview: { type: 'gradient', gradient: 'from-purple-500 via-violet-500 to-fuchsia-500' }
    }
  ],
  
  // === BUILD GROUP (Emerald) ===
  code: [
    {
      id: 'react-component',
      name: 'React Component',
      description: 'UI components',
      prompt: 'Create a React data table component with: Sortable columns, Pagination, Search/filter, Row selection, Export to CSV. TypeScript + Tailwind.',
      icon: FileCode,
      preview: { type: 'gradient', gradient: 'from-cyan-400 via-blue-500 to-indigo-500' }
    },
    {
      id: 'api-endpoint',
      name: 'API Endpoint',
      description: 'Backend routes',
      prompt: 'Build a REST API for user authentication: Register, Login, Logout, Refresh token, Password reset. Express + TypeScript + Prisma.',
      icon: Code,
      preview: { type: 'gradient', gradient: 'from-green-500 via-emerald-500 to-teal-500' }
    },
    {
      id: 'python-script',
      name: 'Python Script',
      description: 'Automation scripts',
      prompt: 'Write a Python script to: Scrape product prices from website, Compare with competitor prices, Generate alert if price drops, Save to CSV',
      icon: Code,
      preview: { type: 'gradient', gradient: 'from-yellow-400 via-amber-500 to-orange-500' }
    },
    {
      id: 'sql-schema',
      name: 'Database Schema',
      description: 'Data modeling',
      prompt: 'Design a database schema for an e-commerce app: Users, Products, Orders, OrderItems, Payments, Reviews. Include indexes and constraints.',
      icon: Database,
      preview: { type: 'gradient', gradient: 'from-blue-600 via-indigo-600 to-violet-600' }
    }
  ],
  
  // === AUTOMATE GROUP (Amber) ===
  swarms: [
    {
      id: 'code-review',
      name: 'Code Review',
      description: 'Multi-agent review',
      prompt: 'Run a multi-agent code review: Security agent checks for vulnerabilities, Performance agent optimizes, Style agent ensures consistency, Architecture agent reviews patterns',
      icon: Bot,
      preview: { type: 'gradient', gradient: 'from-orange-500 via-red-500 to-pink-500' }
    },
    {
      id: 'research-team',
      name: 'Research Team',
      description: 'Collaborative research',
      prompt: 'Deploy a research swarm: Web search agent finds sources, Analysis agent extracts insights, Synthesis agent combines findings, Citation agent formats references',
      icon: Search,
      preview: { type: 'gradient', gradient: 'from-blue-500 via-cyan-500 to-teal-400' }
    },
    {
      id: 'content-team',
      name: 'Content Team',
      description: 'Content creation',
      prompt: 'Create a content team: Strategy agent plans topics, Writer agent drafts posts, Editor agent reviews, SEO agent optimizes, Scheduler agent plans publishing',
      icon: Workflow,
      preview: { type: 'gradient', gradient: 'from-purple-500 via-fuchsia-500 to-pink-500' }
    }
  ],
  
  flow: [
    {
      id: 'email-automation',
      name: 'Email Workflow',
      description: 'Automated emails',
      prompt: 'Create a workflow: Trigger on new signup → Wait 1 hour → Send welcome email → Wait 1 day → Send onboarding tips → Wait 3 days → Check engagement → Send personalized follow-up',
      icon: Workflow,
      preview: { type: 'gradient', gradient: 'from-blue-500 via-indigo-500 to-violet-500' }
    },
    {
      id: 'data-pipeline',
      name: 'Data Pipeline',
      description: 'ETL automation',
      prompt: 'Build a data pipeline: Extract from API every hour → Transform and clean → Validate schema → Load to warehouse → Send notification on completion/failure',
      icon: Network,
      preview: { type: 'gradient', gradient: 'from-green-500 via-teal-500 to-cyan-500' }
    },
    {
      id: 'approval-flow',
      name: 'Approval Flow',
      description: 'Review processes',
      prompt: 'Create approval workflow: Submit request → Manager review (24h timeout) → If approved → Finance review → If >$10k → Director approval → Notify submitter',
      icon: Workflow,
      preview: { type: 'gradient', gradient: 'from-amber-500 via-orange-500 to-red-500' }
    }
  ]
};

// Default templates for modes without specific ones
const DEFAULT_TEMPLATES: TemplatePreview[] = [
  {
    id: 'default-1',
    name: 'Quick Start',
    description: 'Get started quickly',
    prompt: 'Help me get started with this task',
    icon: Sparkles,
    preview: { type: 'gradient', gradient: 'from-blue-500 via-violet-500 to-purple-500' }
  },
  {
    id: 'default-2',
    name: 'Custom Request',
    description: 'Describe what you need',
    prompt: 'I need help with...',
    icon: Wand2,
    preview: { type: 'gradient', gradient: 'from-emerald-500 via-teal-500 to-cyan-500' }
  }
];

// =============================================================================
// PREVIEW CARD COMPONENT
// =============================================================================

interface TemplateCardProps {
  template: TemplatePreview;
  colorClass: string;
  onSelect: (prompt: string) => void;
  index: number;
}

function TemplateCard({ template, colorClass, onSelect, index }: TemplateCardProps) {
  const Icon = template.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(template.prompt)}
      className={cn(
        "group relative overflow-hidden rounded-xl cursor-pointer",
        "bg-zinc-900 border border-zinc-800 hover:border-zinc-700",
        "transition-all duration-200"
      )}
    >
      {/* Preview Area */}
      <div className={cn(
        "h-28 w-full bg-gradient-to-br relative overflow-hidden",
        template.preview.gradient || 'from-zinc-800 to-zinc-900'
      )}>
        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '20px 20px'
          }} />
        </div>
        
        {/* Icon badge */}
        <div className="absolute top-3 left-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            "bg-white/10 backdrop-blur-sm border border-white/20"
          )}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
        
        {/* Hover arrow */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <ArrowRight className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/5 blur-xl group-hover:bg-white/10 transition-colors" />
      </div>
      
      {/* Content Area */}
      <div className="p-3">
        <h4 className="font-medium text-zinc-100 text-sm mb-1 group-hover:text-white transition-colors">
          {template.name}
        </h4>
        <p className="text-xs text-zinc-500 line-clamp-2 group-hover:text-zinc-400 transition-colors">
          {template.description}
        </p>
      </div>
      
      {/* Bottom gradient line */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity",
        template.preview.gradient || 'from-blue-500 to-violet-500'
      )} />
    </motion.div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface TemplatePreviewCardsProps {
  modeId: string;
  modeName: string;
  modeColor: 'violet' | 'blue' | 'emerald' | 'amber';
  onSelectTemplate: (prompt: string) => void;
  isVisible: boolean;
}

export function TemplatePreviewCards({ 
  modeId, 
  modeName, 
  modeColor,
  onSelectTemplate,
  isVisible 
}: TemplatePreviewCardsProps) {
  const [showAll, setShowAll] = useState(false);
  
  const templates = MODE_TEMPLATES[modeId] || DEFAULT_TEMPLATES;
  const displayTemplates = showAll ? templates : templates.slice(0, 4);
  
  const colorClasses = {
    violet: 'from-violet-500 to-fuchsia-500',
    blue: 'from-blue-500 to-cyan-500',
    emerald: 'from-emerald-500 to-teal-500',
    amber: 'from-amber-500 to-orange-500'
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="w-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full bg-gradient-to-r",
              colorClasses[modeColor]
            )} />
            <span className="text-sm font-medium text-zinc-300">
              {modeName} Templates
            </span>
            <span className="text-xs text-zinc-500">
              ({templates.length})
            </span>
          </div>
          
          {templates.length > 4 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showAll ? 'Show less' : `+${templates.length - 4} more`}
            </button>
          )}
        </div>
        
        {/* Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {displayTemplates.map((template, index) => (
            <TemplateCard
              key={template.id}
              template={template}
              colorClass={colorClasses[modeColor]}
              onSelect={onSelectTemplate}
              index={index}
            />
          ))}
        </div>
        
        {/* Custom input hint */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800/50"
        >
          <Wand2 className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs text-zinc-500">
            Or type your own request above
          </span>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// =============================================================================
// HOOK FOR EASY INTEGRATION
// =============================================================================

export function useTemplatePreviews(modeId: string) {
  const templates = MODE_TEMPLATES[modeId] || DEFAULT_TEMPLATES;
  
  const getRandomTemplate = () => {
    return templates[Math.floor(Math.random() * templates.length)];
  };
  
  const getTemplateById = (id: string) => {
    return templates.find(t => t.id === id);
  };
  
  return {
    templates,
    count: templates.length,
    getRandomTemplate,
    getTemplateById,
  };
}

export default TemplatePreviewCards;

/**
 * Template Preview Cards - With Real Preview Images
 * 
 * Shows actual preview images like Kimi/MiniMax.
 * Each card displays a representative image of the template output.
 * 
 * Image Strategy:
 * - Pre-downloaded high-quality images stored locally
 * - Fast loading, no external dependencies
 * - Fallback gradients while images load
 * - Show actual representation of what user will get
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  Image, Video, FileText, Code, Globe, 
  Presentation, Database, Cpu, Network, 
  Sparkles, ArrowUpRight, Search, Bot, 
  LineChart, FileSpreadsheet, Palette,
  Loader2
} from 'lucide-react';

// =============================================================================
// LOCAL PREVIEW IMAGES
// =============================================================================

// All images stored in /public/images/templates/ for fast loading
// Organized by category: create/, analyze/, build/, automate/

export interface TemplatePreview {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: React.ElementType;
  // Real preview image
  previewImage: string;
  // Fallback color while loading
  fallbackGradient: string;
  category: 'image' | 'video' | 'slides' | 'website' | 'research' | 'data' | 'code' | 'swarms' | 'flow';
}

// Curated preview images for each template
// These are actual AI-generated images that represent the output
const MODE_TEMPLATES: Record<string, TemplatePreview[]> = {
  // === CREATE GROUP - IMAGE MODE ===
  image: [
    {
      id: 'product-photo',
      name: 'Product Photography',
      description: 'Professional studio shots with perfect lighting',
      prompt: 'A sleek wireless headphones product photo, floating on white background, soft studio lighting, professional commercial photography, 8k, detailed textures',
      icon: Image,
      previewImage: '/images/templates/create/image-product.jpg',
      fallbackGradient: 'from-violet-600 via-purple-600 to-fuchsia-700',
      category: 'image'
    },
    {
      id: 'portrait',
      name: 'Portrait Art',
      description: 'Artistic portraits with cinematic lighting',
      prompt: 'Portrait of a creative professional in their studio, natural window lighting, shallow depth of field, warm tones, professional photography',
      icon: Palette,
      previewImage: '/images/templates/create/image-portrait.jpg',
      fallbackGradient: 'from-fuchsia-600 via-pink-600 to-rose-600',
      category: 'image'
    },
    {
      id: 'landscape',
      name: 'Landscape',
      description: 'Dramatic natural scenery',
      prompt: 'Dramatic mountain landscape at golden hour, snow-capped peaks reflecting in a crystal lake, epic clouds, cinematic composition, 8k resolution',
      icon: Image,
      previewImage: '/images/templates/create/image-landscape.jpg',
      fallbackGradient: 'from-blue-600 via-violet-600 to-purple-700',
      category: 'image'
    },
    {
      id: 'abstract',
      name: 'Abstract Art',
      description: 'Creative artistic compositions',
      prompt: 'Abstract flowing shapes in teal and coral, liquid metal texture, studio lighting, minimalist composition, high-end 3D render',
      icon: Sparkles,
      previewImage: '/images/templates/create/image-abstract.jpg',
      fallbackGradient: 'from-cyan-500 via-teal-600 to-emerald-700',
      category: 'image'
    },
    {
      id: 'interior',
      name: 'Interior Design',
      description: 'Modern architectural spaces',
      prompt: 'Modern minimalist living room, floor-to-ceiling windows, neutral tones with accent colors, architectural photography, natural lighting',
      icon: Image,
      previewImage: '/images/templates/create/image-interior.jpg',
      fallbackGradient: 'from-amber-500 via-orange-500 to-rose-600',
      category: 'image'
    },
    {
      id: 'food',
      name: 'Food Photography',
      description: 'Appetizing culinary shots',
      prompt: 'Gourmet dish plating, overhead angle, rustic wooden table, soft natural light, food photography, editorial style',
      icon: Image,
      previewImage: '/images/templates/create/image-food.jpg',
      fallbackGradient: 'from-green-500 via-emerald-600 to-teal-700',
      category: 'image'
    }
  ],
  
  // === CREATE GROUP - VIDEO MODE ===
  video: [
    {
      id: 'cinematic',
      name: 'Cinematic Scene',
      description: 'Movie-quality dramatic shots',
      prompt: 'A cyberpunk city street at night, neon lights reflecting on wet pavement, flying cars, cinematic atmosphere, blade runner style',
      icon: Video,
      previewImage: '/images/templates/create/video-cinematic.jpg',
      fallbackGradient: 'from-cyan-600 via-blue-700 to-purple-800',
      category: 'video'
    },
    {
      id: 'nature',
      name: 'Nature Motion',
      description: 'Beautiful natural movements',
      prompt: 'Cherry blossoms falling in slow motion, sunlight filtering through petals, peaceful Japanese garden, dreamy atmosphere',
      icon: Video,
      previewImage: '/images/templates/create/video-nature.jpg',
      fallbackGradient: 'from-pink-500 via-rose-500 to-purple-600',
      category: 'video'
    },
    {
      id: 'product-demo',
      name: 'Product Demo',
      description: '360° product showcases',
      prompt: 'Sleek smartphone rotating 360 degrees, studio lighting, floating particles, premium product video',
      icon: Video,
      previewImage: '/images/templates/create/video-product.jpg',
      fallbackGradient: 'from-slate-700 via-gray-700 to-zinc-800',
      category: 'video'
    },
    {
      id: 'animation',
      name: 'Animated Story',
      description: 'Character animations',
      prompt: 'Cute robot exploring a futuristic city, Pixar style animation, warm lighting, adventure scene',
      icon: Video,
      previewImage: '/images/templates/create/video-animation.jpg',
      fallbackGradient: 'from-orange-500 via-amber-500 to-yellow-500',
      category: 'video'
    }
  ],
  
  // === CREATE GROUP - SLIDES MODE ===
  slides: [
    {
      id: 'pitch-deck',
      name: 'Pitch Deck',
      description: 'Investor-ready presentations',
      prompt: 'Create a 10-slide pitch deck for a SaaS startup: Problem, Solution, Market Size, Business Model, Traction, Team, Financials, Ask',
      icon: Presentation,
      previewImage: '/images/templates/create/slides-pitch.jpg',
      fallbackGradient: 'from-blue-700 via-indigo-700 to-violet-800',
      category: 'slides'
    },
    {
      id: 'quarterly-review',
      name: 'QTR Review',
      description: 'Business quarterly reports',
      prompt: 'Q3 2024 quarterly business review with: Executive Summary, Key Metrics, Wins, Challenges, Q4 Goals, charts and data visualizations',
      icon: FileText,
      previewImage: '/images/templates/create/slides-quarterly.jpg',
      fallbackGradient: 'from-emerald-600 via-teal-700 to-cyan-800',
      category: 'slides'
    },
    {
      id: 'training',
      name: 'Training Deck',
      description: 'Employee onboarding materials',
      prompt: 'New employee onboarding presentation: Company Culture, Tools & Systems, Team Structure, First Week Goals, Resources',
      icon: Presentation,
      previewImage: '/images/templates/create/slides-training.jpg',
      fallbackGradient: 'from-orange-500 via-red-500 to-pink-600',
      category: 'slides'
    },
    {
      id: 'research',
      name: 'Research Findings',
      description: 'User research presentations',
      prompt: 'User research findings deck: Methodology, Participant Demographics, Key Insights, Recommendations, Next Steps, with quotes and data',
      icon: Search,
      previewImage: '/images/templates/create/slides-research.jpg',
      fallbackGradient: 'from-violet-700 via-purple-700 to-fuchsia-800',
      category: 'slides'
    }
  ],
  
  // === CREATE GROUP - WEBSITE MODE ===
  website: [
    {
      id: 'landing-page',
      name: 'Landing Page',
      description: 'High-converting landing pages',
      prompt: 'Create a landing page for a productivity app: Hero with CTA, Features grid, Testimonials, Pricing, FAQ, Footer. Modern, clean design.',
      icon: Globe,
      previewImage: '/images/templates/create/website-landing.jpg',
      fallbackGradient: 'from-blue-600 via-cyan-600 to-teal-500',
      category: 'website'
    },
    {
      id: 'portfolio',
      name: 'Portfolio Site',
      description: 'Personal portfolio websites',
      prompt: 'Design portfolio website: Hero section, About, Selected Works grid, Skills, Contact form. Minimalist aesthetic.',
      icon: Palette,
      previewImage: '/images/templates/create/website-portfolio.jpg',
      fallbackGradient: 'from-zinc-700 via-stone-700 to-neutral-700',
      category: 'website'
    },
    {
      id: 'dashboard',
      name: 'Dashboard UI',
      description: 'Analytics dashboards',
      prompt: 'Create an analytics dashboard: Sidebar nav, KPI cards, Charts area, Recent activity, User menu. Dark mode.',
      icon: LineChart,
      previewImage: '/images/templates/create/website-dashboard.jpg',
      fallbackGradient: 'from-slate-800 via-gray-800 to-zinc-900',
      category: 'website'
    },
    {
      id: 'ecommerce',
      name: 'E-commerce',
      description: 'Online store designs',
      prompt: 'Build an e-commerce homepage: Navigation, Hero banner, Featured products grid, Categories, Newsletter signup, Footer.',
      icon: Globe,
      previewImage: '/images/templates/create/website-ecommerce.jpg',
      fallbackGradient: 'from-emerald-600 via-green-600 to-teal-600',
      category: 'website'
    }
  ],
  
  // === ANALYZE GROUP - RESEARCH MODE ===
  research: [
    {
      id: 'market-research',
      name: 'Market Analysis',
      description: 'Deep industry research',
      prompt: 'Research the AI code assistant market: Market size, Key players (GitHub Copilot, Cursor, etc.), Pricing models, Feature comparison, Trends',
      icon: Search,
      previewImage: '/images/templates/analyze/research-market.jpg',
      fallbackGradient: 'from-blue-700 via-indigo-700 to-violet-800',
      category: 'research'
    },
    {
      id: 'competitor',
      name: 'Competitor Intel',
      description: 'Competitive analysis',
      prompt: 'Analyze competitors in the project management space: Notion, Asana, Monday.com, ClickUp - features, pricing, strengths, weaknesses',
      icon: Bot,
      previewImage: '/images/templates/analyze/research-competitor.jpg',
      fallbackGradient: 'from-cyan-600 via-blue-700 to-indigo-800',
      category: 'research'
    },
    {
      id: 'trends',
      name: 'Trend Report',
      description: 'Emerging trends research',
      prompt: 'Research 2024 trends in remote work technology: Key technologies, Adoption stats, Leading companies, Future predictions, Citations',
      icon: LineChart,
      previewImage: '/images/templates/analyze/research-trends.jpg',
      fallbackGradient: 'from-violet-700 via-purple-700 to-fuchsia-800',
      category: 'research'
    },
    {
      id: 'regulatory',
      name: 'Regulatory',
      description: 'Compliance research',
      prompt: 'Research GDPR compliance requirements for AI companies: Key obligations, Recent fines, Best practices, Implementation checklist',
      icon: FileText,
      previewImage: '/images/templates/analyze/research-regulatory.jpg',
      fallbackGradient: 'from-emerald-600 via-teal-700 to-cyan-800',
      category: 'research'
    }
  ],
  
  // === ANALYZE GROUP - DATA MODE ===
  data: [
    {
      id: 'csv-analysis',
      name: 'CSV Analysis',
      description: 'Upload and analyze datasets',
      prompt: 'Analyze this sales data CSV: Calculate total revenue by month, Identify top products, Find trends, Create visualizations',
      icon: FileSpreadsheet,
      previewImage: '/images/templates/analyze/data-csv.jpg',
      fallbackGradient: 'from-green-600 via-emerald-700 to-teal-800',
      category: 'data'
    },
    {
      id: 'sql-query',
      name: 'SQL Queries',
      description: 'Database analysis',
      prompt: 'Write SQL queries for: Monthly active users, Churn rate by cohort, Revenue per customer segment, Top feature usage',
      icon: Database,
      previewImage: '/images/templates/analyze/data-sql.jpg',
      fallbackGradient: 'from-blue-800 via-indigo-800 to-violet-900',
      category: 'data'
    },
    {
      id: 'visualization',
      name: 'Data Viz',
      description: 'Charts and dashboards',
      prompt: 'Create data visualizations: Bar chart for sales by region, Line chart for growth over time, Pie chart for market share, KPI cards',
      icon: LineChart,
      previewImage: '/images/templates/analyze/data-viz.jpg',
      fallbackGradient: 'from-amber-600 via-orange-600 to-red-700',
      category: 'data'
    },
    {
      id: 'forecasting',
      name: 'Forecasting',
      description: 'Predictive analytics',
      prompt: 'Forecast Q4 revenue based on historical data: Trend analysis, Seasonal adjustments, Confidence intervals, Risk factors',
      icon: LineChart,
      previewImage: '/images/templates/analyze/data-forecast.jpg',
      fallbackGradient: 'from-purple-700 via-fuchsia-700 to-pink-700',
      category: 'data'
    }
  ],
  
  // === BUILD GROUP - CODE MODE ===
  code: [
    {
      id: 'react-component',
      name: 'React Component',
      description: 'Production UI components',
      prompt: 'Create a React data table component with: Sortable columns, Pagination, Search/filter, Row selection, Export to CSV. TypeScript + Tailwind.',
      icon: Code,
      previewImage: '/images/templates/build/code-react.jpg',
      fallbackGradient: 'from-cyan-600 via-blue-700 to-indigo-800',
      category: 'code'
    },
    {
      id: 'api-endpoint',
      name: 'API Endpoint',
      description: 'Backend routes',
      prompt: 'Build a REST API for user authentication: Register, Login, Logout, Refresh token, Password reset. Express + TypeScript + Prisma.',
      icon: Code,
      previewImage: '/images/templates/build/code-api.jpg',
      fallbackGradient: 'from-green-600 via-emerald-700 to-teal-800',
      category: 'code'
    },
    {
      id: 'python-script',
      name: 'Python Script',
      description: 'Automation scripts',
      prompt: 'Write a Python script to: Scrape product prices from website, Compare with competitor prices, Generate alert if price drops, Save to CSV',
      icon: Code,
      previewImage: '/images/templates/build/code-python.jpg',
      fallbackGradient: 'from-yellow-500 via-amber-600 to-orange-700',
      category: 'code'
    },
    {
      id: 'sql-schema',
      name: 'Database Schema',
      description: 'Data modeling',
      prompt: 'Design a database schema for an e-commerce app: Users, Products, Orders, OrderItems, Payments, Reviews. Include indexes and constraints.',
      icon: Database,
      previewImage: '/images/templates/build/code-schema.jpg',
      fallbackGradient: 'from-blue-800 via-slate-800 to-gray-900',
      category: 'code'
    }
  ],
  
  // === AUTOMATE GROUP - SWARMS MODE ===
  swarms: [
    {
      id: 'code-review',
      name: 'Code Review',
      description: 'Multi-agent review',
      prompt: 'Run a multi-agent code review: Security agent checks for vulnerabilities, Performance agent optimizes, Style agent ensures consistency, Architecture agent reviews patterns',
      icon: Bot,
      previewImage: '/images/templates/automate/swarms-review.jpg',
      fallbackGradient: 'from-orange-600 via-red-600 to-pink-700',
      category: 'swarms'
    },
    {
      id: 'research-team',
      name: 'Research Team',
      description: 'Collaborative research',
      prompt: 'Deploy a research swarm: Web search agent finds sources, Analysis agent extracts insights, Synthesis agent combines findings, Citation agent formats references',
      icon: Search,
      previewImage: '/images/templates/automate/swarms-research.jpg',
      fallbackGradient: 'from-blue-800 via-indigo-800 to-violet-900',
      category: 'swarms'
    },
    {
      id: 'content-team',
      name: 'Content Team',
      description: 'Content creation',
      prompt: 'Create a content team: Strategy agent plans topics, Writer agent drafts posts, Editor agent reviews, SEO agent optimizes, Scheduler agent plans publishing',
      icon: Bot,
      previewImage: '/images/templates/automate/swarms-content.jpg',
      fallbackGradient: 'from-purple-700 via-fuchsia-700 to-pink-800',
      category: 'swarms'
    }
  ],
  
  // === AUTOMATE GROUP - FLOW MODE ===
  flow: [
    {
      id: 'email-automation',
      name: 'Email Workflow',
      description: 'Automated sequences',
      prompt: 'Create a workflow: Trigger on new signup → Wait 1 hour → Send welcome email → Wait 1 day → Send onboarding tips → Wait 3 days → Check engagement → Send personalized follow-up',
      icon: Network,
      previewImage: '/images/templates/automate/flow-email.jpg',
      fallbackGradient: 'from-blue-800 via-indigo-800 to-violet-900',
      category: 'flow'
    },
    {
      id: 'data-pipeline',
      name: 'Data Pipeline',
      description: 'ETL automation',
      prompt: 'Build a data pipeline: Extract from API every hour → Transform and clean → Validate schema → Load to warehouse → Send notification on completion/failure',
      icon: Network,
      previewImage: '/images/templates/automate/flow-pipeline.jpg',
      fallbackGradient: 'from-teal-700 via-cyan-800 to-blue-900',
      category: 'flow'
    },
    {
      id: 'approval-flow',
      name: 'Approval Flow',
      description: 'Review processes',
      prompt: 'Create approval workflow: Submit request → Manager review (24h timeout) → If approved → Finance review → If >$10k → Director approval → Notify submitter',
      icon: Network,
      previewImage: '/images/templates/automate/flow-approval.jpg',
      fallbackGradient: 'from-amber-600 via-orange-700 to-red-800',
      category: 'flow'
    }
  ]
};

// Default templates for modes without specific ones
const DEFAULT_TEMPLATES: TemplatePreview[] = [
  {
    id: 'default-1',
    name: 'Quick Start',
    description: 'Get started immediately',
    prompt: 'Help me get started with this task',
    icon: Sparkles,
    previewImage: '/images/templates/create/image-abstract.jpg',
    fallbackGradient: 'from-blue-600 via-violet-600 to-purple-700',
    category: 'image'
  },
  {
    id: 'default-2',
    name: 'Custom Request',
    description: 'Describe what you need',
    prompt: 'I need help with...',
    icon: ArrowUpRight,
    previewImage: '/images/templates/create/slides-pitch.jpg',
    fallbackGradient: 'from-emerald-600 via-teal-600 to-cyan-600',
    category: 'image'
  }
];

// =============================================================================
// PREMIUM TEMPLATE CARD WITH REAL IMAGE
// =============================================================================

interface TemplateCardProps {
  template: TemplatePreview;
  onSelect: (prompt: string) => void;
  index: number;
}

function TemplateCard({ template, onSelect, index }: TemplateCardProps) {
  const Icon = template.icon;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.08, 
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(template.prompt)}
      className="group relative cursor-pointer"
    >
      {/* Card Container */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0f0f0f] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300">
        
        {/* Image Area - 75% of card */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {/* Fallback Gradient (shown while loading or on error) */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br transition-opacity duration-500",
            template.fallbackGradient,
            imageLoaded && !imageError ? 'opacity-0' : 'opacity-100'
          )} />
          
          {/* Real Preview Image */}
          <img
            src={template.previewImage}
            alt={template.name}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-all duration-700",
              imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
          
          {/* Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
          
          {/* Loading State */}
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
            </div>
          )}
          
          {/* Icon Badge - Top Left */}
          <div className="absolute top-3 left-3 z-10">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              "bg-black/40 backdrop-blur-md border border-white/20",
              "shadow-lg shadow-black/20"
            )}>
              <Icon className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
          </div>
          
          {/* Arrow - Top Right (appears on hover) */}
          <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
            <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
              <ArrowUpRight className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
          </div>
          
          {/* Category Label - Bottom Left */}
          <div className="absolute bottom-3 left-3 z-10">
            <span className="px-2.5 py-1 rounded-md bg-black/40 backdrop-blur-sm border border-white/10 text-[11px] font-medium text-white/80 uppercase tracking-wider">
              {template.category}
            </span>
          </div>
          
          {/* Accent Line at Bottom */}
          <div className={cn(
            "absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300",
            template.fallbackGradient.split(' ')[0].replace('from-', 'bg-')
          )} />
        </div>
        
        {/* Content Area - 25% of card */}
        <div className="p-5">
          <h4 className="font-semibold text-white text-[15px] mb-1.5 tracking-tight group-hover:text-white/90 transition-colors">
            {template.name}
          </h4>
          <p className="text-sm text-white/50 leading-relaxed group-hover:text-white/60 transition-colors">
            {template.description}
          </p>
        </div>
        
        {/* Hover Glow Effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-t from-white/[0.02] to-transparent" />
        </div>
      </div>
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
  
  const colorLabels = {
    violet: 'Create',
    blue: 'Analyze',
    emerald: 'Build',
    amber: 'Automate'
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full py-8"
      >
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-2 h-2 rounded-full",
              modeColor === 'violet' && 'bg-violet-500',
              modeColor === 'blue' && 'bg-blue-500',
              modeColor === 'emerald' && 'bg-emerald-500',
              modeColor === 'amber' && 'bg-amber-500'
            )} />
            <h3 className="text-lg font-semibold text-white tracking-tight">
              {colorLabels[modeColor]} Templates
            </h3>
            <span className="text-sm text-white/40 font-medium">
              {templates.length}
            </span>
          </div>
          
          {templates.length > 4 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-white/40 hover:text-white/70 font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              {showAll ? 'Show less' : `View all ${templates.length}`}
            </button>
          )}
        </div>
        
        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayTemplates.map((template, index) => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={onSelectTemplate}
              index={index}
            />
          ))}
        </div>
        
        {/* Custom Request Hint */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 flex items-center justify-center"
        >
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
            <Sparkles className="w-3.5 h-3.5 text-white/40" />
            <span className="text-sm text-white/40">
              Or type your own request above
            </span>
          </div>
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
  
  return {
    templates,
    count: templates.length,
    getRandomTemplate: () => templates[Math.floor(Math.random() * templates.length)],
    getTemplateById: (id: string) => templates.find(t => t.id === id),
  };
}

export default TemplatePreviewCards;

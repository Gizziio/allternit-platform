/**
 * Template Preview Cards - With Real Preview Images
 * 
 * Shows actual AI-generated preview images like Kimi/MiniMax.
 * Each card displays a representative image of the template output.
 * 
 * Image Strategy:
 * - Use Pollinations.ai for free AI-generated preview images
 * - Fallback to curated Unsplash images for reliability
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
// REAL PREVIEW IMAGES
// =============================================================================

// Use Pollinations.ai for free AI image generation
// Format: https://image.pollinations.ai/prompt/{encoded_prompt}?width=400&height=300&nologo=true

const generatePollinationsUrl = (prompt: string, width = 400, height = 300): string => {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&seed=42`;
};

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
      previewImage: generatePollinationsUrl('professional product photography wireless headphones floating white background studio lighting 8k commercial photo'),
      fallbackGradient: 'from-violet-600 via-purple-600 to-fuchsia-700',
      category: 'image'
    },
    {
      id: 'portrait',
      name: 'Portrait Art',
      description: 'Artistic portraits with cinematic lighting',
      prompt: 'Portrait of a creative professional in their studio, natural window lighting, shallow depth of field, warm tones, professional photography',
      icon: Palette,
      previewImage: generatePollinationsUrl('artistic portrait professional photographer natural window light shallow depth of field warm tones cinematic'),
      fallbackGradient: 'from-fuchsia-600 via-pink-600 to-rose-600',
      category: 'image'
    },
    {
      id: 'landscape',
      name: 'Landscape',
      description: 'Dramatic natural scenery',
      prompt: 'Dramatic mountain landscape at golden hour, snow-capped peaks reflecting in a crystal lake, epic clouds, cinematic composition, 8k resolution',
      icon: Image,
      previewImage: generatePollinationsUrl('dramatic mountain landscape golden hour snow peaks crystal lake reflection epic clouds cinematic 8k'),
      fallbackGradient: 'from-blue-600 via-violet-600 to-purple-700',
      category: 'image'
    },
    {
      id: 'abstract',
      name: 'Abstract Art',
      description: 'Creative artistic compositions',
      prompt: 'Abstract flowing shapes in teal and coral, liquid metal texture, studio lighting, minimalist composition, high-end 3D render',
      icon: Sparkles,
      previewImage: generatePollinationsUrl('abstract art flowing shapes teal coral liquid metal texture minimalist high end 3d render modern'),
      fallbackGradient: 'from-cyan-500 via-teal-600 to-emerald-700',
      category: 'image'
    },
    {
      id: 'interior',
      name: 'Interior Design',
      description: 'Modern architectural spaces',
      prompt: 'Modern minimalist living room, floor-to-ceiling windows, neutral tones with accent colors, architectural photography, natural lighting',
      icon: Image,
      previewImage: generatePollinationsUrl('modern minimalist living room floor to ceiling windows neutral tones architectural photography natural light interior design'),
      fallbackGradient: 'from-amber-500 via-orange-500 to-rose-600',
      category: 'image'
    },
    {
      id: 'food',
      name: 'Food Photography',
      description: 'Appetizing culinary shots',
      prompt: 'Gourmet dish plating, overhead angle, rustic wooden table, soft natural light, food photography, editorial style',
      icon: Image,
      previewImage: generatePollinationsUrl('gourmet food photography overhead shot rustic wooden table soft natural light editorial style culinary'),
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
      previewImage: generatePollinationsUrl('cyberpunk city street night neon lights wet pavement flying cars cinematic blade runner style video frame'),
      fallbackGradient: 'from-cyan-600 via-blue-700 to-purple-800',
      category: 'video'
    },
    {
      id: 'nature',
      name: 'Nature Motion',
      description: 'Beautiful natural movements',
      prompt: 'Cherry blossoms falling in slow motion, sunlight filtering through petals, peaceful Japanese garden, dreamy atmosphere',
      icon: Video,
      previewImage: generatePollinationsUrl('cherry blossoms falling slow motion sunlight petals japanese garden dreamy atmosphere nature video'),
      fallbackGradient: 'from-pink-500 via-rose-500 to-purple-600',
      category: 'video'
    },
    {
      id: 'product-demo',
      name: 'Product Demo',
      description: '360° product showcases',
      prompt: 'Sleek smartphone rotating 360 degrees, studio lighting, floating particles, premium product video',
      icon: Video,
      previewImage: generatePollinationsUrl('sleek smartphone rotating 360 studio lighting floating particles premium product video commercial'),
      fallbackGradient: 'from-slate-700 via-gray-700 to-zinc-800',
      category: 'video'
    },
    {
      id: 'animation',
      name: 'Animated Story',
      description: 'Character animations',
      prompt: 'Cute robot exploring a futuristic city, Pixar style animation, warm lighting, adventure scene',
      icon: Video,
      previewImage: generatePollinationsUrl('cute robot exploring futuristic city pixar style animation warm lighting adventure scene 3d render'),
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
      previewImage: generatePollinationsUrl('modern pitch deck presentation slide clean design startup investor deck professional layout dark theme'),
      fallbackGradient: 'from-blue-700 via-indigo-700 to-violet-800',
      category: 'slides'
    },
    {
      id: 'quarterly-review',
      name: 'QTR Review',
      description: 'Business quarterly reports',
      prompt: 'Q3 2024 quarterly business review with: Executive Summary, Key Metrics, Wins, Challenges, Q4 Goals, charts and data visualizations',
      icon: FileText,
      previewImage: generatePollinationsUrl('quarterly business review presentation slide charts graphs data visualization professional corporate dark mode'),
      fallbackGradient: 'from-emerald-600 via-teal-700 to-cyan-800',
      category: 'slides'
    },
    {
      id: 'training',
      name: 'Training Deck',
      description: 'Employee onboarding materials',
      prompt: 'New employee onboarding presentation: Company Culture, Tools & Systems, Team Structure, First Week Goals, Resources',
      icon: Presentation,
      previewImage: generatePollinationsUrl('employee training presentation slide onboarding company culture modern clean design professional corporate'),
      fallbackGradient: 'from-orange-500 via-red-500 to-pink-600',
      category: 'slides'
    },
    {
      id: 'research',
      name: 'Research Findings',
      description: 'User research presentations',
      prompt: 'User research findings deck: Methodology, Participant Demographics, Key Insights, Recommendations, Next Steps, with quotes and data',
      icon: Search,
      previewImage: generatePollinationsUrl('user research findings presentation slide UX design data insights quotes methodology professional layout'),
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
      previewImage: generatePollinationsUrl('modern landing page website design hero section CTA features grid testimonials dark theme UI mockup'),
      fallbackGradient: 'from-blue-600 via-cyan-600 to-teal-500',
      category: 'website'
    },
    {
      id: 'portfolio',
      name: 'Portfolio Site',
      description: 'Personal portfolio websites',
      prompt: 'Design portfolio website: Hero section, About, Selected Works grid, Skills, Contact form. Minimalist aesthetic.',
      icon: Palette,
      previewImage: generatePollinationsUrl('minimalist portfolio website design personal branding selected works grid dark theme clean aesthetic'),
      fallbackGradient: 'from-zinc-700 via-stone-700 to-neutral-700',
      category: 'website'
    },
    {
      id: 'dashboard',
      name: 'Dashboard UI',
      description: 'Analytics dashboards',
      prompt: 'Create an analytics dashboard: Sidebar nav, KPI cards, Charts area, Recent activity, User menu. Dark mode.',
      icon: LineChart,
      previewImage: generatePollinationsUrl('analytics dashboard UI design dark mode KPI cards charts sidebar navigation data visualization modern'),
      fallbackGradient: 'from-slate-800 via-gray-800 to-zinc-900',
      category: 'website'
    },
    {
      id: 'ecommerce',
      name: 'E-commerce',
      description: 'Online store designs',
      prompt: 'Build an e-commerce homepage: Navigation, Hero banner, Featured products grid, Categories, Newsletter signup, Footer.',
      icon: Globe,
      previewImage: generatePollinationsUrl('e-commerce website homepage design product grid hero banner dark theme modern online store UI'),
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
      previewImage: generatePollinationsUrl('market research analysis data visualization charts AI industry report professional document dark theme'),
      fallbackGradient: 'from-blue-700 via-indigo-700 to-violet-800',
      category: 'research'
    },
    {
      id: 'competitor',
      name: 'Competitor Intel',
      description: 'Competitive analysis',
      prompt: 'Analyze competitors in the project management space: Notion, Asana, Monday.com, ClickUp - features, pricing, strengths, weaknesses',
      icon: Bot,
      previewImage: generatePollinationsUrl('competitive analysis comparison matrix chart business intelligence report dark theme professional'),
      fallbackGradient: 'from-cyan-600 via-blue-700 to-indigo-800',
      category: 'research'
    },
    {
      id: 'trends',
      name: 'Trend Report',
      description: 'Emerging trends research',
      prompt: 'Research 2024 trends in remote work technology: Key technologies, Adoption stats, Leading companies, Future predictions, Citations',
      icon: LineChart,
      previewImage: generatePollinationsUrl('trends report 2024 data visualization forecast remote work technology graph chart dark theme professional'),
      fallbackGradient: 'from-violet-700 via-purple-700 to-fuchsia-800',
      category: 'research'
    },
    {
      id: 'regulatory',
      name: 'Regulatory',
      description: 'Compliance research',
      prompt: 'Research GDPR compliance requirements for AI companies: Key obligations, Recent fines, Best practices, Implementation checklist',
      icon: FileText,
      previewImage: generatePollinationsUrl('GDPR compliance regulatory document legal framework checklist business professional dark theme layout'),
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
      previewImage: generatePollinationsUrl('data analysis spreadsheet CSV sales dashboard charts revenue trends data visualization dark theme professional'),
      fallbackGradient: 'from-green-600 via-emerald-700 to-teal-800',
      category: 'data'
    },
    {
      id: 'sql-query',
      name: 'SQL Queries',
      description: 'Database analysis',
      prompt: 'Write SQL queries for: Monthly active users, Churn rate by cohort, Revenue per customer segment, Top feature usage',
      icon: Database,
      previewImage: generatePollinationsUrl('SQL code editor database query analytics dark theme syntax highlighting programming code screenshot'),
      fallbackGradient: 'from-blue-800 via-indigo-800 to-violet-900',
      category: 'data'
    },
    {
      id: 'visualization',
      name: 'Data Viz',
      description: 'Charts and dashboards',
      prompt: 'Create data visualizations: Bar chart for sales by region, Line chart for growth over time, Pie chart for market share, KPI cards',
      icon: LineChart,
      previewImage: generatePollinationsUrl('data visualization dashboard charts bar chart line chart pie chart KPI cards dark theme analytics professional'),
      fallbackGradient: 'from-amber-600 via-orange-600 to-red-700',
      category: 'data'
    },
    {
      id: 'forecasting',
      name: 'Forecasting',
      description: 'Predictive analytics',
      prompt: 'Forecast Q4 revenue based on historical data: Trend analysis, Seasonal adjustments, Confidence intervals, Risk factors',
      icon: LineChart,
      previewImage: generatePollinationsUrl('forecasting prediction chart trend analysis confidence intervals risk factors data analytics dark theme professional'),
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
      previewImage: generatePollinationsUrl('React TypeScript code component data table UI modern syntax highlighting dark theme VS code editor style'),
      fallbackGradient: 'from-cyan-600 via-blue-700 to-indigo-800',
      category: 'code'
    },
    {
      id: 'api-endpoint',
      name: 'API Endpoint',
      description: 'Backend routes',
      prompt: 'Build a REST API for user authentication: Register, Login, Logout, Refresh token, Password reset. Express + TypeScript + Prisma.',
      icon: Code,
      previewImage: generatePollinationsUrl('REST API code Express TypeScript Prisma backend authentication endpoints dark theme code editor professional'),
      fallbackGradient: 'from-green-600 via-emerald-700 to-teal-800',
      category: 'code'
    },
    {
      id: 'python-script',
      name: 'Python Script',
      description: 'Automation scripts',
      prompt: 'Write a Python script to: Scrape product prices from website, Compare with competitor prices, Generate alert if price drops, Save to CSV',
      icon: Code,
      previewImage: generatePollinationsUrl('Python code script automation web scraping data analysis CSV dark theme syntax highlighting code editor'),
      fallbackGradient: 'from-yellow-500 via-amber-600 to-orange-700',
      category: 'code'
    },
    {
      id: 'sql-schema',
      name: 'Database Schema',
      description: 'Data modeling',
      prompt: 'Design a database schema for an e-commerce app: Users, Products, Orders, OrderItems, Payments, Reviews. Include indexes and constraints.',
      icon: Database,
      previewImage: generatePollinationsUrl('database schema diagram ERD entity relationship SQL tables e-commerce dark theme professional data modeling'),
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
      previewImage: generatePollinationsUrl('multi agent code review system AI agents collaboration security performance architecture dark theme diagram'),
      fallbackGradient: 'from-orange-600 via-red-600 to-pink-700',
      category: 'swarms'
    },
    {
      id: 'research-team',
      name: 'Research Team',
      description: 'Collaborative research',
      prompt: 'Deploy a research swarm: Web search agent finds sources, Analysis agent extracts insights, Synthesis agent combines findings, Citation agent formats references',
      icon: Search,
      previewImage: generatePollinationsUrl('AI research team multi agent system web search analysis synthesis workflow diagram dark theme professional'),
      fallbackGradient: 'from-blue-800 via-indigo-800 to-violet-900',
      category: 'swarms'
    },
    {
      id: 'content-team',
      name: 'Content Team',
      description: 'Content creation',
      prompt: 'Create a content team: Strategy agent plans topics, Writer agent drafts posts, Editor agent reviews, SEO agent optimizes, Scheduler agent plans publishing',
      icon: Bot,
      previewImage: generatePollinationsUrl('AI content creation team workflow strategy writing editing SEO scheduling multi agent system dark theme'),
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
      previewImage: generatePollinationsUrl('email automation workflow diagram flowchart trigger welcome email onboarding sequence dark theme professional'),
      fallbackGradient: 'from-blue-800 via-indigo-800 to-violet-900',
      category: 'flow'
    },
    {
      id: 'data-pipeline',
      name: 'Data Pipeline',
      description: 'ETL automation',
      prompt: 'Build a data pipeline: Extract from API every hour → Transform and clean → Validate schema → Load to warehouse → Send notification on completion/failure',
      icon: Network,
      previewImage: generatePollinationsUrl('data pipeline ETL workflow diagram extract transform load API data warehouse dark theme professional'),
      fallbackGradient: 'from-teal-700 via-cyan-800 to-blue-900',
      category: 'flow'
    },
    {
      id: 'approval-flow',
      name: 'Approval Flow',
      description: 'Review processes',
      prompt: 'Create approval workflow: Submit request → Manager review (24h timeout) → If approved → Finance review → If >$10k → Director approval → Notify submitter',
      icon: Network,
      previewImage: generatePollinationsUrl('approval workflow diagram flowchart manager finance director authorization process dark theme professional'),
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
    previewImage: generatePollinationsUrl('abstract technology background AI assistant futuristic interface dark theme modern minimal'),
    fallbackGradient: 'from-blue-600 via-violet-600 to-purple-700',
    category: 'image'
  },
  {
    id: 'default-2',
    name: 'Custom Request',
    description: 'Describe what you need',
    prompt: 'I need help with...',
    icon: ArrowUpRight,
    previewImage: generatePollinationsUrl('creative workspace brainstorming ideas lightbulb innovation dark theme modern professional'),
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

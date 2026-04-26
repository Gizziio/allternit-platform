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
 * 
 * Prompt Strategy:
 * - Open-ended guidance templates (not specific examples)
 * - Users fill in their specific context
 * - Helpful structure without being prescriptive
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  Image, Video, FileText, Code, Globe, 
  Presentation, Database, Cpu, Network, 
  Sparkles, ArrowUpRight, Search, Bot, 
  LineChart, FileSpreadsheet, Palette, Terminal,
  Layout, FileCode, TestTube, Settings, Mail,
  Calendar, Bell, RefreshCw, Shield, Zap,
  Package, PenTool, BookOpen, BarChart3, PieChart,
  GitBranch, Webhook, Clock, Filter, MessageSquare,
  Layers, Fingerprint, Scan, FileSearch, Users,
  ShoppingBag, CheckCircle, Box,
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
  // Open-ended guidance prompt (not specific example)
  prompt: string;
  icon: React.ElementType;
  // Real preview image
  previewImage: string;
  // Fallback color while loading
  fallbackGradient: string;
  category: 'image' | 'video' | 'slides' | 'website' | 'research' | 'data' | 'code' | 'swarms' | 'flow';
}

// =============================================================================
// OPEN-ENDED TEMPLATE DEFINITIONS
// =============================================================================

const MODE_TEMPLATES: Record<string, TemplatePreview[]> = {
  // ==========================================================================
  // === CREATE GROUP - IMAGE MODE (10 templates) ===
  // ==========================================================================
  image: [
    {
      id: 'product-photo',
      name: 'Product Photography',
      description: 'Professional studio shots with perfect lighting',
      prompt: `Generate a professional product photograph. Describe what you're showcasing (physical product, digital item, or concept) and I'll create studio-quality lighting, clean backgrounds, and commercial composition that highlights its best features.`,
      icon: Package,
      previewImage: '/images/templates/create/image-product.jpg',
      fallbackGradient: 'from-violet-600 via-purple-600 to-fuchsia-700',
      category: 'image'
    },
    {
      id: 'portrait',
      name: 'Portrait Art',
      description: 'Artistic portraits with cinematic lighting',
      prompt: `Create a portrait with artistic flair. Describe your subject (person, character, or persona) and the mood you want (professional, creative, dramatic, warm) and I'll craft cinematic lighting and composition.`,
      icon: Palette,
      previewImage: '/images/templates/create/image-portrait.jpg',
      fallbackGradient: 'from-fuchsia-600 via-pink-600 to-rose-600',
      category: 'image'
    },
    {
      id: 'landscape',
      name: 'Landscape',
      description: 'Dramatic natural scenery',
      prompt: `Generate a stunning landscape scene. Tell me the environment you envision (mountains, ocean, forest, desert, cityscape) and the atmosphere (sunrise, storm, golden hour, night) and I'll create cinematic composition.`,
      icon: Image,
      previewImage: '/images/templates/create/image-landscape.jpg',
      fallbackGradient: 'from-blue-600 via-violet-600 to-purple-700',
      category: 'image'
    },
    {
      id: 'abstract',
      name: 'Abstract Art',
      description: 'Creative artistic compositions',
      prompt: `Create abstract visual art. Describe the feeling or concept you want to express (flowing energy, geometric precision, organic forms, digital chaos) and your preferred color palette, and I'll generate a unique composition.`,
      icon: Sparkles,
      previewImage: '/images/templates/create/image-abstract.jpg',
      fallbackGradient: 'from-cyan-500 via-teal-600 to-emerald-700',
      category: 'image'
    },
    {
      id: 'interior',
      name: 'Interior Design',
      description: 'Modern architectural spaces',
      prompt: `Visualize an interior space. Describe the room type (living room, office, retail, hospitality) and style (minimalist, industrial, cozy, luxury) and I'll create architectural photography with proper lighting and spatial composition.`,
      icon: Layout,
      previewImage: '/images/templates/create/image-interior.jpg',
      fallbackGradient: 'from-amber-500 via-orange-500 to-rose-600',
      category: 'image'
    },
    {
      id: 'food',
      name: 'Food Photography',
      description: 'Appetizing culinary shots',
      prompt: `Create appetizing food photography. Describe the dish or cuisine you want to showcase and the setting (rustic, modern, editorial, casual) and I'll generate professional culinary composition with perfect lighting.`,
      icon: Image,
      previewImage: '/images/templates/create/image-food.jpg',
      fallbackGradient: 'from-green-500 via-emerald-600 to-teal-700',
      category: 'image'
    },
    {
      id: 'logo',
      name: 'Logo & Branding',
      description: 'Professional brand assets',
      prompt: `Design a logo or brand mark. Describe your brand (company name, industry, values, target audience) and style preferences (modern, classic, playful, sophisticated) and I'll create logo concepts with proper spacing and versatility.`,
      icon: Fingerprint,
      previewImage: '/images/templates/create/image-abstract.jpg',
      fallbackGradient: 'from-indigo-600 via-purple-600 to-pink-600',
      category: 'image'
    },
    {
      id: 'social',
      name: 'Social Graphics',
      description: 'Instagram, X, LinkedIn posts',
      prompt: `Create social media graphics. Tell me the platform (Instagram, X/Twitter, LinkedIn, etc.) and what you're promoting (announcement, quote, event, product) and I'll design engaging visuals optimized for that format.`,
      icon: Layout,
      previewImage: '/images/templates/create/slides-pitch.jpg',
      fallbackGradient: 'from-pink-500 via-rose-500 to-orange-500',
      category: 'image'
    },
    {
      id: 'mockup',
      name: '3D Mockups',
      description: 'Device and packaging mockups',
      prompt: `Generate 3D mockups of your design. Describe what you need mocked up (app on phone, packaging, billboard, merchandise) and I'll create realistic 3D renders with proper lighting, shadows, and materials.`,
      icon: Box,
      previewImage: '/images/templates/create/website-dashboard.jpg',
      fallbackGradient: 'from-slate-600 via-gray-600 to-zinc-700',
      category: 'image'
    },
    {
      id: 'illustration',
      name: 'Custom Illustration',
      description: 'Unique drawn artwork',
      prompt: `Create a custom illustration. Describe your subject matter and preferred style (flat vector, detailed realism, watercolor, line art, isometric) and I'll generate artwork perfect for your use case.`,
      icon: PenTool,
      previewImage: '/images/templates/create/image-portrait.jpg',
      fallbackGradient: 'from-violet-500 via-fuchsia-500 to-pink-500',
      category: 'image'
    }
  ],
  
  // ==========================================================================
  // === CREATE GROUP - VIDEO MODE (8 templates) ===
  // ==========================================================================
  video: [
    {
      id: 'cinematic',
      name: 'Cinematic Scene',
      description: 'Movie-quality dramatic shots',
      prompt: `Create a cinematic video scene. Describe the setting, mood, and action you want (cyberpunk city, nature documentary, emotional moment, action sequence) and I'll craft movie-quality visuals with proper pacing and atmosphere.`,
      icon: Video,
      previewImage: '/images/templates/create/video-cinematic.jpg',
      fallbackGradient: 'from-cyan-600 via-blue-700 to-purple-800',
      category: 'video'
    },
    {
      id: 'nature',
      name: 'Nature Motion',
      description: 'Beautiful natural movements',
      prompt: `Generate nature video content. Describe the scene you want captured (waterfalls, wildlife, time-lapse clouds, ocean waves, forest) and the feeling (peaceful, powerful, meditative, dramatic) and I'll create stunning natural motion.`,
      icon: Video,
      previewImage: '/images/templates/create/video-nature.jpg',
      fallbackGradient: 'from-pink-500 via-rose-500 to-purple-600',
      category: 'video'
    },
    {
      id: 'product-demo',
      name: 'Product Demo',
      description: '360° product showcases',
      prompt: `Create a product demonstration video. Describe what you're showcasing and the key features to highlight, and I'll generate smooth camera movements, proper lighting, and professional presentation that sells.`,
      icon: Video,
      previewImage: '/images/templates/create/video-product.jpg',
      fallbackGradient: 'from-slate-700 via-gray-700 to-zinc-800',
      category: 'video'
    },
    {
      id: 'animation',
      name: 'Animated Story',
      description: 'Character animations',
      prompt: `Produce an animated scene. Describe your characters, the story moment, and style (Pixar-style 3D, anime, motion graphics, stop-motion feel) and I'll create engaging animation with personality and emotion.`,
      icon: Video,
      previewImage: '/images/templates/create/video-animation.jpg',
      fallbackGradient: 'from-orange-500 via-amber-500 to-yellow-500',
      category: 'video'
    },
    {
      id: 'explainer',
      name: 'Explainer Video',
      description: 'How-it-works animations',
      prompt: `Make an explainer video. Describe the concept, product, or process you need explained and your target audience, and I'll create clear motion graphics that educate and engage viewers.`,
      icon: Zap,
      previewImage: '/images/templates/create/slides-training.jpg',
      fallbackGradient: 'from-blue-500 via-cyan-500 to-teal-500',
      category: 'video'
    },
    {
      id: 'tutorial',
      name: 'Tutorial Video',
      description: 'Step-by-step guides',
      prompt: `Create a tutorial video. Describe what skill or process you're teaching and the audience level (beginner, intermediate, advanced), and I'll structure clear instruction with proper pacing and visual clarity.`,
      icon: BookOpen,
      previewImage: '/images/templates/create/video-product.jpg',
      fallbackGradient: 'from-green-500 via-emerald-500 to-teal-600',
      category: 'video'
    },
    {
      id: 'ads',
      name: 'Ad Creative',
      description: 'Marketing video spots',
      prompt: `Produce an advertising video. Describe your product/service, target audience, and campaign goal (awareness, conversion, engagement), and I'll create compelling ad creative with strong hooks and calls-to-action.`,
      icon: Sparkles,
      previewImage: '/images/templates/create/video-cinematic.jpg',
      fallbackGradient: 'from-rose-500 via-pink-500 to-purple-500',
      category: 'video'
    },
    {
      id: 'social-video',
      name: 'Social Shorts',
      description: 'TikTok, Reels, Shorts',
      prompt: `Create short-form social video. Tell me the platform (TikTok, Reels, Shorts) and your content idea (trending format, educational, entertaining, promotional), and I'll optimize for vertical format and engagement.`,
      icon: Video,
      previewImage: '/images/templates/create/video-animation.jpg',
      fallbackGradient: 'from-fuchsia-500 via-purple-500 to-violet-500',
      category: 'video'
    }
  ],
  
  // ==========================================================================
  // === CREATE GROUP - SLIDES MODE (8 templates) ===
  // ==========================================================================
  slides: [
    {
      id: 'pitch-deck',
      name: 'Pitch Deck',
      description: 'Investor-ready presentations',
      prompt: `Build a pitch deck for your startup or project. Share your business concept, target market, and traction so far, and I'll structure a compelling narrative covering Problem, Solution, Market, Model, Traction, Team, and Ask.`,
      icon: Presentation,
      previewImage: '/images/templates/create/slides-pitch.jpg',
      fallbackGradient: 'from-blue-700 via-indigo-700 to-violet-800',
      category: 'slides'
    },
    {
      id: 'quarterly-review',
      name: 'QTR Review',
      description: 'Business quarterly reports',
      prompt: `Create a quarterly business review presentation. Share your key metrics, wins, challenges, and goals for next quarter, and I'll build professional slides with data visualizations and executive-ready formatting.`,
      icon: BarChart3,
      previewImage: '/images/templates/create/slides-quarterly.jpg',
      fallbackGradient: 'from-emerald-600 via-teal-700 to-cyan-800',
      category: 'slides'
    },
    {
      id: 'training',
      name: 'Training Deck',
      description: 'Employee onboarding materials',
      prompt: `Develop training materials. Describe what you're teaching (new hire onboarding, tool training, process documentation) and your audience, and I'll create clear, engaging slides with proper pacing and takeaways.`,
      icon: BookOpen,
      previewImage: '/images/templates/create/slides-training.jpg',
      fallbackGradient: 'from-orange-500 via-red-500 to-pink-600',
      category: 'slides'
    },
    {
      id: 'research',
      name: 'Research Findings',
      description: 'User research presentations',
      prompt: `Present your research findings. Share your methodology, key insights, supporting data, and recommendations, and I'll structure a compelling narrative that drives decisions with evidence.`,
      icon: Search,
      previewImage: '/images/templates/create/slides-research.jpg',
      fallbackGradient: 'from-violet-700 via-purple-700 to-fuchsia-800',
      category: 'slides'
    },
    {
      id: 'status-update',
      name: 'Status Update',
      description: 'Project progress reports',
      prompt: `Create a project status update presentation. Share what's been completed, what's in progress, blockers, and next steps, and I'll format it for stakeholders with clear progress indicators and action items.`,
      icon: Clock,
      previewImage: '/images/templates/create/slides-quarterly.jpg',
      fallbackGradient: 'from-cyan-600 via-blue-600 to-indigo-700',
      category: 'slides'
    },
    {
      id: 'all-hands',
      name: 'All-Hands Deck',
      description: 'Company-wide updates',
      prompt: `Build an all-hands meeting presentation. Share company updates, team wins, upcoming initiatives, and key messages, and I'll create engaging slides that inform and inspire your entire organization.`,
      icon: Users,
      previewImage: '/images/templates/create/slides-training.jpg',
      fallbackGradient: 'from-purple-600 via-violet-600 to-indigo-700',
      category: 'slides'
    },
    {
      id: 'proposal',
      name: 'Client Proposal',
      description: 'Win new business',
      prompt: `Create a client proposal presentation. Describe your prospect, their challenges, your proposed solution, pricing, and timeline, and I'll build persuasive slides that close deals.`,
      icon: FileText,
      previewImage: '/images/templates/create/slides-pitch.jpg',
      fallbackGradient: 'from-amber-500 via-orange-500 to-rose-600',
      category: 'slides'
    },
    {
      id: 'workshop',
      name: 'Workshop Deck',
      description: 'Interactive sessions',
      prompt: `Design a workshop presentation. Describe the topic, activities, and participant outcomes, and I'll create interactive slides with exercises, discussion prompts, and facilitator notes.`,
      icon: PenTool,
      previewImage: '/images/templates/create/slides-research.jpg',
      fallbackGradient: 'from-teal-500 via-emerald-500 to-green-600',
      category: 'slides'
    }
  ],
  
  // ==========================================================================
  // === CREATE GROUP - WEBSITE MODE (8 templates) ===
  // ==========================================================================
  website: [
    {
      id: 'landing-page',
      name: 'Landing Page',
      description: 'High-converting landing pages',
      prompt: `Design a landing page. Describe what you're offering (product, service, app, event) and your target audience, and I'll create a high-converting page with compelling hero, features, social proof, and clear CTAs.`,
      icon: Globe,
      previewImage: '/images/templates/create/website-landing.jpg',
      fallbackGradient: 'from-blue-600 via-cyan-600 to-teal-500',
      category: 'website'
    },
    {
      id: 'portfolio',
      name: 'Portfolio Site',
      description: 'Personal portfolio websites',
      prompt: `Build a portfolio website. Tell me about your work, style, and what you want to showcase (projects, writing, photography, case studies), and I'll design a site that highlights your best work beautifully.`,
      icon: Palette,
      previewImage: '/images/templates/create/website-portfolio.jpg',
      fallbackGradient: 'from-zinc-700 via-stone-700 to-neutral-700',
      category: 'website'
    },
    {
      id: 'dashboard',
      name: 'Dashboard UI',
      description: 'Analytics dashboards',
      prompt: `Create a dashboard interface. Describe what data you're displaying (analytics, admin tools, project management) and user types, and I'll design an intuitive UI with proper data visualization and navigation.`,
      icon: LineChart,
      previewImage: '/images/templates/create/website-dashboard.jpg',
      fallbackGradient: 'from-slate-800 via-gray-800 to-zinc-900',
      category: 'website'
    },
    {
      id: 'ecommerce',
      name: 'E-commerce',
      description: 'Online store designs',
      prompt: `Design an e-commerce experience. Describe what you're selling and your brand vibe, and I'll create product pages, cart flows, and checkout that convert browsers into buyers.`,
      icon: ShoppingBag,
      previewImage: '/images/templates/create/website-ecommerce.jpg',
      fallbackGradient: 'from-emerald-600 via-green-600 to-teal-600',
      category: 'website'
    },
    {
      id: 'blog',
      name: 'Blog / Publication',
      description: 'Content-focused sites',
      prompt: `Create a blog or publication website. Describe your content type (articles, news, stories) and reading experience goals, and I'll design typography-focused layouts that make reading delightful.`,
      icon: BookOpen,
      previewImage: '/images/templates/create/website-portfolio.jpg',
      fallbackGradient: 'from-amber-600 via-orange-600 to-red-700',
      category: 'website'
    },
    {
      id: 'docs',
      name: 'Documentation Site',
      description: 'Technical docs & guides',
      prompt: `Build a documentation website. Describe your product/API and the documentation structure you need (getting started, API reference, tutorials), and I'll create searchable, navigable docs that developers love.`,
      icon: FileCode,
      previewImage: '/images/templates/create/slides-training.jpg',
      fallbackGradient: 'from-blue-700 via-indigo-700 to-violet-800',
      category: 'website'
    },
    {
      id: 'auth',
      name: 'Auth & Onboarding',
      description: 'Login, signup flows',
      prompt: `Design authentication and onboarding flows. Describe your app and user types, and I'll create signup, login, password reset, and onboarding screens with great UX and security best practices.`,
      icon: Shield,
      previewImage: '/images/templates/create/website-dashboard.jpg',
      fallbackGradient: 'from-violet-700 via-purple-700 to-fuchsia-800',
      category: 'website'
    },
    {
      id: 'marketing',
      name: 'Marketing Site',
      description: 'Full company websites',
      prompt: `Create a complete marketing website. Describe your company, offerings, and brand personality, and I'll build multi-page site with home, about, features, pricing, and contact sections.`,
      icon: Globe,
      previewImage: '/images/templates/create/website-landing.jpg',
      fallbackGradient: 'from-cyan-600 via-blue-600 to-indigo-700',
      category: 'website'
    }
  ],
  
  // ==========================================================================
  // === ANALYZE GROUP - RESEARCH MODE (8 templates) ===
  // ==========================================================================
  research: [
    {
      id: 'market-research',
      name: 'Market Analysis',
      description: 'Deep industry research',
      prompt: `Research a market for me. Tell me the industry or product category you're exploring, and I'll analyze market size, key players, trends, growth drivers, and opportunities with sources and data.`,
      icon: Search,
      previewImage: '/images/templates/analyze/research-market.jpg',
      fallbackGradient: 'from-blue-700 via-indigo-700 to-violet-800',
      category: 'research'
    },
    {
      id: 'competitor',
      name: 'Competitor Intel',
      description: 'Competitive analysis',
      prompt: `Analyze your competition. Share who your competitors are (or the space you're entering), and I'll create a competitive landscape report covering their positioning, strengths, weaknesses, and differentiation opportunities.`,
      icon: Bot,
      previewImage: '/images/templates/analyze/research-competitor.jpg',
      fallbackGradient: 'from-cyan-600 via-blue-700 to-indigo-800',
      category: 'research'
    },
    {
      id: 'trends',
      name: 'Trend Report',
      description: 'Emerging trends research',
      prompt: `Research emerging trends. Describe the topic or industry you want trend analysis on, and I'll identify patterns, forecast developments, and highlight implications with supporting evidence.`,
      icon: LineChart,
      previewImage: '/images/templates/analyze/research-trends.jpg',
      fallbackGradient: 'from-violet-700 via-purple-700 to-fuchsia-800',
      category: 'research'
    },
    {
      id: 'regulatory',
      name: 'Regulatory',
      description: 'Compliance research',
      prompt: `Research regulatory requirements. Describe your industry, geography, and specific compliance area (privacy, security, financial, environmental), and I'll summarize obligations, deadlines, and best practices.`,
      icon: Shield,
      previewImage: '/images/templates/analyze/research-regulatory.jpg',
      fallbackGradient: 'from-emerald-600 via-teal-700 to-cyan-800',
      category: 'research'
    },
    {
      id: 'academic',
      name: 'Academic Research',
      description: 'Scholarly literature review',
      prompt: `Conduct academic research on a topic. Describe your research question or subject area, and I'll summarize key theories, seminal papers, current state of knowledge, and gaps in the literature.`,
      icon: BookOpen,
      previewImage: '/images/templates/analyze/research-market.jpg',
      fallbackGradient: 'from-amber-600 via-orange-600 to-red-700',
      category: 'research'
    },
    {
      id: 'investment',
      name: 'Investment Research',
      description: 'Stock & crypto analysis',
      prompt: `Research an investment opportunity. Share the company, asset, or sector you're analyzing, and I'll provide fundamentals, valuation metrics, risks, catalysts, and investment thesis with data.`,
      icon: PieChart,
      previewImage: '/images/templates/analyze/data-forecast.jpg',
      fallbackGradient: 'from-green-600 via-emerald-600 to-teal-700',
      category: 'research'
    },
    {
      id: 'patent',
      name: 'Patent & IP Research',
      description: 'Intellectual property search',
      prompt: `Research patent and IP landscape. Describe the technology or invention area, and I'll analyze existing patents, identify white space, freedom-to-operate issues, and filing strategies.`,
      icon: FileSearch,
      previewImage: '/images/templates/analyze/research-regulatory.jpg',
      fallbackGradient: 'from-purple-600 via-violet-600 to-indigo-700',
      category: 'research'
    },
    {
      id: 'customer',
      name: 'Customer Research',
      description: 'User & buyer insights',
      prompt: `Research customer insights. Describe your target market or customer segment, and I'll analyze demographics, psychographics, pain points, buying behavior, and unmet needs with actionable findings.`,
      icon: Users,
      previewImage: '/images/templates/analyze/research-competitor.jpg',
      fallbackGradient: 'from-rose-600 via-pink-600 to-fuchsia-700',
      category: 'research'
    }
  ],
  
  // ==========================================================================
  // === ANALYZE GROUP - DATA MODE (8 templates) ===
  // ==========================================================================
  data: [
    {
      id: 'csv-analysis',
      name: 'CSV Analysis',
      description: 'Upload and analyze datasets',
      prompt: `Analyze my data. Upload your CSV/spreadsheet or describe your dataset, and I'll calculate statistics, identify patterns, segment results, and extract actionable insights with visualizations.`,
      icon: FileSpreadsheet,
      previewImage: '/images/templates/analyze/data-csv.jpg',
      fallbackGradient: 'from-green-600 via-emerald-700 to-teal-800',
      category: 'data'
    },
    {
      id: 'sql-query',
      name: 'SQL Queries',
      description: 'Database analysis',
      prompt: `Help me write SQL queries. Describe your database schema and what analysis you need (metrics, trends, segments), and I'll write optimized queries with explanations and performance considerations.`,
      icon: Database,
      previewImage: '/images/templates/analyze/data-sql.jpg',
      fallbackGradient: 'from-blue-800 via-indigo-800 to-violet-900',
      category: 'data'
    },
    {
      id: 'visualization',
      name: 'Data Viz',
      description: 'Charts and dashboards',
      prompt: `Create data visualizations. Share your dataset or metrics, and I'll recommend the best chart types, design clear visualizations, and help you build dashboards that communicate insights effectively.`,
      icon: BarChart3,
      previewImage: '/images/templates/analyze/data-viz.jpg',
      fallbackGradient: 'from-amber-600 via-orange-600 to-red-700',
      category: 'data'
    },
    {
      id: 'forecasting',
      name: 'Forecasting',
      description: 'Predictive analytics',
      prompt: `Build a forecast model. Share your historical data and what you're predicting (revenue, demand, traffic), and I'll analyze trends, seasonality, and create projections with confidence intervals.`,
      icon: LineChart,
      previewImage: '/images/templates/analyze/data-forecast.jpg',
      fallbackGradient: 'from-purple-700 via-fuchsia-700 to-pink-700',
      category: 'data'
    },
    {
      id: 'cleanup',
      name: 'Data Cleaning',
      description: 'Fix messy datasets',
      prompt: `Clean up my messy data. Describe or share your dataset issues (duplicates, missing values, formatting), and I'll provide strategies, scripts, and step-by-step cleaning procedures.`,
      icon: Filter,
      previewImage: '/images/templates/analyze/data-csv.jpg',
      fallbackGradient: 'from-cyan-600 via-teal-600 to-emerald-700',
      category: 'data'
    },
    {
      id: 'correlation',
      name: 'Correlation Analysis',
      description: 'Find relationships',
      prompt: `Find correlations in my data. Describe your variables and hypothesis, and I'll perform correlation analysis, identify significant relationships, and explain what drives your outcomes.`,
      icon: GitBranch,
      previewImage: '/images/templates/analyze/data-viz.jpg',
      fallbackGradient: 'from-indigo-600 via-purple-600 to-pink-600',
      category: 'data'
    },
    {
      id: 'anomaly',
      name: 'Anomaly Detection',
      description: 'Find outliers & issues',
      prompt: `Detect anomalies in my data. Describe your dataset and what normal looks like, and I'll identify outliers, unusual patterns, fraud signals, or quality issues with explanations.`,
      icon: Scan,
      previewImage: '/images/templates/analyze/data-sql.jpg',
      fallbackGradient: 'from-rose-600 via-red-600 to-orange-600',
      category: 'data'
    },
    {
      id: 'report',
      name: 'Data Report',
      description: 'Executive summaries',
      prompt: `Create a data report. Share your analysis results or raw data, and I'll write an executive summary with key findings, insights, and recommendations in business-friendly language.`,
      icon: FileText,
      previewImage: '/images/templates/analyze/research-market.jpg',
      fallbackGradient: 'from-blue-600 via-cyan-600 to-teal-700',
      category: 'data'
    }
  ],
  
  // ==========================================================================
  // === BUILD GROUP - CODE MODE (10 templates) ===
  // ==========================================================================
  code: [
    {
      id: 'react-component',
      name: 'React Component',
      description: 'Production UI components',
      prompt: `Build a React component for me. Describe what UI element you need (table, form, modal, card, navigation), and I'll write production-ready TypeScript code with Tailwind styling, accessibility, and best practices.`,
      icon: Code,
      previewImage: '/images/templates/build/code-react.jpg',
      fallbackGradient: 'from-cyan-600 via-blue-700 to-indigo-800',
      category: 'code'
    },
    {
      id: 'api-endpoint',
      name: 'API Endpoint',
      description: 'Backend routes',
      prompt: `Create API endpoints. Describe your backend framework and what functionality you need (CRUD operations, auth, webhooks), and I'll write RESTful or GraphQL code with proper error handling and validation.`,
      icon: Webhook,
      previewImage: '/images/templates/build/code-api.jpg',
      fallbackGradient: 'from-green-600 via-emerald-700 to-teal-800',
      category: 'code'
    },
    {
      id: 'python-script',
      name: 'Python Script',
      description: 'Automation scripts',
      prompt: `Write a Python script for me. Describe what task you're automating (data processing, API integration, file manipulation), and I'll create clean, documented code with error handling.`,
      icon: Terminal,
      previewImage: '/images/templates/build/code-python.jpg',
      fallbackGradient: 'from-yellow-500 via-amber-600 to-orange-700',
      category: 'code'
    },
    {
      id: 'sql-schema',
      name: 'Database Schema',
      description: 'Data modeling',
      prompt: `Design a database schema. Describe your application requirements and entities, and I'll create normalized tables with proper indexes, constraints, and relationships for your chosen database.`,
      icon: Database,
      previewImage: '/images/templates/build/code-schema.jpg',
      fallbackGradient: 'from-blue-800 via-slate-800 to-gray-900',
      category: 'code'
    },
    {
      id: 'tests',
      name: 'Test Suite',
      description: 'Unit & integration tests',
      prompt: `Write tests for my code. Share your code or describe what you're testing, and I'll create comprehensive unit tests, integration tests, and edge case coverage with proper mocking.`,
      icon: TestTube,
      previewImage: '/images/templates/build/code-react.jpg',
      fallbackGradient: 'from-rose-500 via-pink-500 to-fuchsia-600',
      category: 'code'
    },
    {
      id: 'cli-tool',
      name: 'CLI Tool',
      description: 'Command-line utilities',
      prompt: `Build a CLI tool. Describe the command-line utility you need (file processor, DevOps tool, code generator), and I'll create a well-structured CLI with arguments, help text, and error handling.`,
      icon: Terminal,
      previewImage: '/images/templates/build/code-python.jpg',
      fallbackGradient: 'from-zinc-600 via-gray-600 to-slate-700',
      category: 'code'
    },
    {
      id: 'documentation',
      name: 'Code Documentation',
      description: 'Docs & comments',
      prompt: `Document my code. Share your code or API, and I'll write comprehensive documentation, README files, inline comments, and usage examples that other developers will love.`,
      icon: FileCode,
      previewImage: '/images/templates/build/code-api.jpg',
      fallbackGradient: 'from-amber-500 via-orange-500 to-red-600',
      category: 'code'
    },
    {
      id: 'config',
      name: 'Config & Infra',
      description: 'Docker, CI/CD, IaC',
      prompt: `Create infrastructure configuration. Describe what you need (Docker setup, CI/CD pipeline, Terraform, Kubernetes), and I'll write production-ready config files with security and best practices.`,
      icon: Settings,
      previewImage: '/images/templates/automate/flow-pipeline.jpg',
      fallbackGradient: 'from-teal-600 via-cyan-600 to-blue-700',
      category: 'code'
    },
    {
      id: 'migration',
      name: 'Migration Script',
      description: 'Database & data migrations',
      prompt: `Write a migration script. Describe your source and target systems (database versions, schema changes, data transforms), and I'll create safe, reversible migration code with rollback procedures.`,
      icon: RefreshCw,
      previewImage: '/images/templates/build/code-schema.jpg',
      fallbackGradient: 'from-violet-600 via-purple-600 to-indigo-700',
      category: 'code'
    },
    {
      id: 'library',
      name: 'Library/Package',
      description: 'Reusable modules',
      prompt: `Create a code library. Describe the functionality you want packaged (utility functions, SDK, wrapper), and I'll structure a proper module with exports, types, and package configuration.`,
      icon: Package,
      previewImage: '/images/templates/build/code-api.jpg',
      fallbackGradient: 'from-emerald-600 via-green-600 to-teal-700',
      category: 'code'
    }
  ],
  
  // ==========================================================================
  // === AUTOMATE GROUP - SWARMS MODE (8 templates) ===
  // ==========================================================================
  swarms: [
    {
      id: 'code-review',
      name: 'Code Review',
      description: 'Multi-agent review',
      prompt: `Run a multi-agent code review on my code. Upload or paste your code, and I'll deploy specialized agents to check security vulnerabilities, performance optimizations, style consistency, and architectural patterns with actionable feedback.`,
      icon: Bot,
      previewImage: '/images/templates/automate/swarms-review.jpg',
      fallbackGradient: 'from-orange-600 via-red-600 to-pink-700',
      category: 'swarms'
    },
    {
      id: 'research-team',
      name: 'Research Team',
      description: 'Collaborative research',
      prompt: `Deploy a research swarm on a topic. Describe what you're researching, and I'll coordinate multiple agents to search sources, extract insights, synthesize findings, and format citations into a comprehensive report.`,
      icon: Search,
      previewImage: '/images/templates/automate/swarms-research.jpg',
      fallbackGradient: 'from-blue-800 via-indigo-800 to-violet-900',
      category: 'swarms'
    },
    {
      id: 'content-team',
      name: 'Content Team',
      description: 'Content creation',
      prompt: `Create a content production team. Describe your content needs (blog, social, video scripts), and I'll coordinate strategy, writing, editing, SEO optimization, and publishing schedule across specialized agents.`,
      icon: PenTool,
      previewImage: '/images/templates/automate/swarms-content.jpg',
      fallbackGradient: 'from-purple-700 via-fuchsia-700 to-pink-800',
      category: 'swarms'
    },
    {
      id: 'qa-swarm',
      name: 'QA & Testing',
      description: 'Automated quality assurance',
      prompt: `Run a QA swarm on my project. Describe your application and testing needs, and I'll deploy agents to perform functional testing, edge case discovery, regression checks, and bug reporting.`,
      icon: TestTube,
      previewImage: '/images/templates/automate/swarms-review.jpg',
      fallbackGradient: 'from-rose-600 via-pink-600 to-purple-700',
      category: 'swarms'
    },
    {
      id: 'data-entry',
      name: 'Data Processing',
      description: 'Extract, transform, validate',
      prompt: `Process data with a swarm. Describe your data source and what you need extracted or transformed, and I'll coordinate agents for parsing, validation, enrichment, and formatting at scale.`,
      icon: Database,
      previewImage: '/images/templates/automate/swarms-research.jpg',
      fallbackGradient: 'from-cyan-600 via-teal-600 to-emerald-700',
      category: 'swarms'
    },
    {
      id: 'support-team',
      name: 'Support Team',
      description: 'Customer service swarm',
      prompt: `Create a customer support swarm. Describe your product and common support scenarios, and I'll deploy agents for triage, troubleshooting, response drafting, and escalation handling.`,
      icon: MessageSquare,
      previewImage: '/images/templates/automate/swarms-content.jpg',
      fallbackGradient: 'from-green-600 via-emerald-600 to-teal-700',
      category: 'swarms'
    },
    {
      id: 'analysis-swarm',
      name: 'Analysis Team',
      description: 'Multi-perspective analysis',
      prompt: `Analyze something from multiple angles. Share what you're analyzing (decision, data, strategy), and I'll coordinate agents with different perspectives (optimist, pessimist, data-driven, creative) for balanced insights.`,
      icon: BarChart3,
      previewImage: '/images/templates/analyze/research-market.jpg',
      fallbackGradient: 'from-amber-600 via-orange-600 to-red-700',
      category: 'swarms'
    },
    {
      id: 'dev-team',
      name: 'Dev Team Simulation',
      description: 'Full-stack collaboration',
      prompt: `Simulate a development team. Describe your feature or project, and I'll coordinate agents as PM, architect, frontend, backend, and QA to design and plan the implementation.`,
      icon: Users,
      previewImage: '/images/templates/build/code-react.jpg',
      fallbackGradient: 'from-blue-700 via-indigo-700 to-violet-800',
      category: 'swarms'
    }
  ],
  
  // ==========================================================================
  // === AUTOMATE GROUP - FLOW MODE (8 templates) ===
  // ==========================================================================
  flow: [
    {
      id: 'email-automation',
      name: 'Email Workflow',
      description: 'Automated sequences',
      prompt: `Design an email automation workflow. Describe your trigger (signup, purchase, event) and the journey you want (onboarding, nurture, retention), and I'll create a sequence with timing, personalization, and branching logic.`,
      icon: Mail,
      previewImage: '/images/templates/automate/flow-email.jpg',
      fallbackGradient: 'from-blue-800 via-indigo-800 to-violet-900',
      category: 'flow'
    },
    {
      id: 'data-pipeline',
      name: 'Data Pipeline',
      description: 'ETL automation',
      prompt: `Build a data pipeline. Describe your data sources, transformations needed, and destination, and I'll design an ETL workflow with scheduling, error handling, monitoring, and data quality checks.`,
      icon: GitBranch,
      previewImage: '/images/templates/automate/flow-pipeline.jpg',
      fallbackGradient: 'from-teal-700 via-cyan-800 to-blue-900',
      category: 'flow'
    },
    {
      id: 'approval-flow',
      name: 'Approval Flow',
      description: 'Review processes',
      prompt: `Create an approval workflow. Describe what needs approval (expenses, content, access) and the stakeholders involved, and I'll design a process with routing, reminders, escalations, and audit trails.`,
      icon: CheckCircle,
      previewImage: '/images/templates/automate/flow-approval.jpg',
      fallbackGradient: 'from-amber-600 via-orange-700 to-red-800',
      category: 'flow'
    },
    {
      id: 'cron-job',
      name: 'Scheduled Tasks',
      description: 'Recurring automation',
      prompt: `Set up scheduled automation. Describe what task you need run regularly (reports, backups, cleanup, syncing) and the schedule, and I'll create a cron job or scheduled workflow with monitoring.`,
      icon: Clock,
      previewImage: '/images/templates/automate/flow-pipeline.jpg',
      fallbackGradient: 'from-indigo-600 via-purple-600 to-fuchsia-700',
      category: 'flow'
    },
    {
      id: 'webhook',
      name: 'Webhook Handler',
      description: 'Event-driven workflows',
      prompt: `Build a webhook workflow. Describe the service sending events and what you need to happen when they arrive, and I'll create event handlers with verification, retries, and downstream actions.`,
      icon: Webhook,
      previewImage: '/images/templates/automate/flow-email.jpg',
      fallbackGradient: 'from-cyan-600 via-blue-600 to-indigo-700',
      category: 'flow'
    },
    {
      id: 'alerts',
      name: 'Alert System',
      description: 'Monitoring & notifications',
      prompt: `Design an alert system. Describe what you need to monitor (metrics, errors, events) and who should be notified, and I'll create thresholds, escalation policies, and notification routing.`,
      icon: Bell,
      previewImage: '/images/templates/analyze/data-forecast.jpg',
      fallbackGradient: 'from-rose-600 via-red-600 to-pink-700',
      category: 'flow'
    },
    {
      id: 'sync',
      name: 'Sync Workflow',
      description: 'Keep systems in sync',
      prompt: `Build a synchronization workflow. Describe the systems you need to keep in sync (databases, APIs, files) and conflict resolution preferences, and I'll design bidirectional sync with change detection.`,
      icon: RefreshCw,
      previewImage: '/images/templates/automate/flow-pipeline.jpg',
      fallbackGradient: 'from-emerald-600 via-green-600 to-teal-700',
      category: 'flow'
    },
    {
      id: 'form-handler',
      name: 'Form Processing',
      description: 'Form submission workflows',
      prompt: `Create a form processing workflow. Describe your form and what should happen to submissions (validation, storage, notifications, CRM), and I'll design the complete data flow with error handling.`,
      icon: FileText,
      previewImage: '/images/templates/automate/flow-approval.jpg',
      fallbackGradient: 'from-violet-600 via-purple-600 to-indigo-700',
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
    prompt: `I'm ready to help. Describe what you'd like to create, analyze, build, or automate, and I'll assist you with best practices and quality output.`,
    icon: Sparkles,
    previewImage: '/images/templates/create/image-abstract.jpg',
    fallbackGradient: 'from-blue-600 via-violet-600 to-purple-700',
    category: 'image'
  },
  {
    id: 'default-2',
    name: 'Custom Request',
    description: 'Describe what you need',
    prompt: `Tell me what you're working on. Share your goals, constraints, and any specific requirements, and I'll provide tailored assistance for your situation.`,
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
          <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <ArrowUpRight className="w-4 h-4 text-white" />
            </div>
          </div>
          
          {/* Category Badge - Bottom Left */}
          <div className="absolute bottom-3 left-3 z-10">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wide uppercase bg-black/50 backdrop-blur-md text-white/80 border border-white/10">
              {template.category}
            </span>
          </div>
        </div>
        
        {/* Content Area - 25% of card */}
        <div className="p-4 space-y-1.5">
          <h3 className="text-sm font-semibold text-white/95 group-hover:text-white transition-colors line-clamp-1">
            {template.name}
          </h3>
          <p className="text-xs text-white/50 group-hover:text-white/60 transition-colors line-clamp-1">
            {template.description}
          </p>
        </div>
        
        {/* Hover Glow Effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-20",
            template.fallbackGradient
          )} />
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// TEMPLATE GRID SECTION
// =============================================================================

interface TemplateGridProps {
  templates: TemplatePreview[];
  onSelectTemplate: (prompt: string) => void;
  title?: string;
}

function TemplateGrid({ templates, onSelectTemplate, title }: TemplateGridProps) {
  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center gap-3 px-1">
          <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
            {title}
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {templates.map((template, index) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={onSelectTemplate}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT EXPORTS
// =============================================================================

export interface TemplatePreviewCardsProps {
  modeId: string;
  onSelectTemplate: (prompt: string) => void;
}

export function TemplatePreviewCards({ modeId, onSelectTemplate }: TemplatePreviewCardsProps) {
  const templates = MODE_TEMPLATES[modeId] || DEFAULT_TEMPLATES;
  
  return (
    <div className="space-y-6 py-4">
      <TemplateGrid
        templates={templates}
        onSelectTemplate={onSelectTemplate}
        title={`${templates.length} Templates Available`}
      />
    </div>
  );
}

// Export for use in other components
export { MODE_TEMPLATES, DEFAULT_TEMPLATES };

// Helper to get templates for a mode
export function getTemplatesForMode(modeId: string): TemplatePreview[] {
  return MODE_TEMPLATES[modeId] || DEFAULT_TEMPLATES;
}

// Helper to get all template count
export function getTotalTemplateCount(): number {
  return Object.values(MODE_TEMPLATES).reduce((sum, templates) => sum + templates.length, 0);
}



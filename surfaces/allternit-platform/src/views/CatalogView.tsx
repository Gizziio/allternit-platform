/**
 * Udemy Catalog Browser for A://Labs
 * 
 * Browse and curate free Udemy courses matching A://Labs subject areas.
 * No authentication required - uses public search API.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  BookOpen,
  Star,
  Users,
  ExternalLink,
  Plus,
  Check,
  BookmarkPlus,
  Layers,
  Trophy,
  Rocket,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Globe,
  BarChart3,
  X,
  Info,
  PlayCircle,
  Award,
} from 'lucide-react';

// Types
interface UdemyPublicCourse {
  id: number;
  title: string;
  headline: string;
  url: string;
  image_240x135: string;
  rating: number;
  num_reviews: number;
  num_subscribers: number;
  price: string;
  is_paid: boolean;
  level: string;
  lang: string;
  num_lectures: number;
  published_title: string;
  category?: string;
  topics?: string[];
}

interface A2LabsCategory {
  id: string;
  tier: 'CORE' | 'OPS' | 'AGENTS';
  label: string;
  description: string;
  searchQueries: string[];
}

type TierFilter = 'ALL' | 'CORE' | 'OPS' | 'AGENTS';
type PriceFilter = 'free' | 'paid' | 'all';
type LevelFilter = 'all' | 'Beginner' | 'Intermediate' | 'Expert';

// A://Labs Categories (inline to avoid import issues in platform)
const A2LABS_CATEGORIES: A2LabsCategory[] = [
  {
    id: 'core-reasoning',
    tier: 'CORE',
    label: 'AI Reasoning & Prompt Engineering',
    description: 'Structured reasoning, prompt engineering, decomposition',
    searchQueries: ['prompt engineering', 'AI reasoning', 'chain of thought', 'LLM prompting'],
  },
  {
    id: 'core-multimodal',
    tier: 'CORE',
    label: 'Multimodal AI Workflows',
    description: 'Processing text/images/PDFs, document intelligence',
    searchQueries: ['multimodal AI', 'computer vision AI', 'document processing AI', 'OCR AI'],
  },
  {
    id: 'core-evaluation',
    tier: 'CORE',
    label: 'AI Evaluation & Trust',
    description: 'Evaluation criteria, trust boundaries, quality assessment',
    searchQueries: ['AI evaluation', 'LLM evaluation', 'AI safety', 'AI trust'],
  },
  {
    id: 'ops-workflows',
    tier: 'OPS',
    label: 'AI Workflow Design',
    description: 'Process mapping, automation, AI-augmented workflows',
    searchQueries: ['AI workflow automation', 'AI automation', 'AI productivity'],
  },
  {
    id: 'ops-research',
    tier: 'OPS',
    label: 'Research Operations',
    description: 'AI-assisted research workflows',
    searchQueries: ['AI research', 'research automation AI', 'web scraping AI'],
  },
  {
    id: 'ops-content',
    tier: 'OPS',
    label: 'Content Operations',
    description: 'Content generation, content pipeline automation',
    searchQueries: ['AI content generation', 'AI writing', 'content automation'],
  },
  {
    id: 'ops-knowledge',
    tier: 'OPS',
    label: 'Knowledge Management',
    description: 'Knowledge base design, information organization',
    searchQueries: ['knowledge management AI', 'enterprise search AI', 'document management AI'],
  },
  {
    id: 'agents-rag',
    tier: 'AGENTS',
    label: 'RAG & Document Intelligence',
    description: 'RAG systems, vector databases, semantic search',
    searchQueries: ['RAG AI', 'retrieval augmented generation', 'vector database', 'LangChain RAG'],
  },
  {
    id: 'agents-orchestration',
    tier: 'AGENTS',
    label: 'Multi-Agent Orchestration',
    description: 'Agent orchestration, collaboration, LangGraph, CrewAI',
    searchQueries: ['multi-agent AI', 'LangGraph', 'CrewAI', 'AI agent collaboration'],
  },
  {
    id: 'agents-code',
    tier: 'AGENTS',
    label: 'AI Copilot & Code Generation',
    description: 'Repo-aware coding assistants, code suggestion',
    searchQueries: ['AI coding assistant', 'code generation AI', 'automated code review'],
  },
  {
    id: 'agents-web',
    tier: 'AGENTS',
    label: 'Web Research Agent',
    description: 'Web search automation, content extraction',
    searchQueries: ['web scraping Python', 'web automation AI', 'AI web research'],
  },
  {
    id: 'agents-kb',
    tier: 'AGENTS',
    label: 'Knowledge Base Assistant',
    description: 'Multi-source ingestion, unified search, document Q&A',
    searchQueries: ['chatbot knowledge base', 'RAG chatbot', 'document Q&A AI'],
  },
];

const CURATED_KEY = 'allternit-labs-curated-courses';

export function CatalogView() {
  const [courses, setCourses] = useState<UdemyPublicCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('free');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [curatedCourses, setCuratedCourses] = useState<Set<number>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['CORE', 'OPS', 'AGENTS']));
  const [, setCurrentSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [view, setView] = useState<'search' | 'browse' | 'curated'>('browse');
  const [selectedCourse, setSelectedCourse] = useState<UdemyPublicCourse | null>(null);

  // Load curated courses
  useEffect(() => {
    const saved = localStorage.getItem(CURATED_KEY);
    if (saved) {
      try {
        setCuratedCourses(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error('Failed to load curated courses:', e);
      }
    }
  }, []);

  // Save curated courses
  const saveCurated = useCallback((ids: Set<number>) => {
    setCuratedCourses(ids);
    localStorage.setItem(CURATED_KEY, JSON.stringify([...ids]));
  }, []);

  // Toggle curated status
  const toggleCurated = useCallback((course: UdemyPublicCourse) => {
    const newCurated = new Set(curatedCourses);
    if (newCurated.has(course.id)) {
      newCurated.delete(course.id);
      showNotification(`Removed: ${course.title}`);
    } else {
      newCurated.add(course.id);
      showNotification(`✓ Curated for A://Labs: ${course.title}`);
    }
    saveCurated(newCurated);
  }, [curatedCourses, saveCurated]);

  // Show notification
  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Search courses
  const searchCourses = useCallback(async (query: string) => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    setCurrentSearch(query);

    try {
      const response = await fetch('/api/v1/udemy/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          page: 1,
          pageSize: 50,
          price: priceFilter,
          level: levelFilter === 'all' ? undefined : levelFilter,
        }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      setCourses(data.results || []);
      setView('search');
      
      const source = data.source === 'mock' ? ' (mock data)' : '';
      showNotification(`Found ${data.count || 0} courses${source}`);
    } catch (err: any) {
      console.error('Search failed:', err);
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [priceFilter, levelFilter, showNotification]);

  // Browse by category - fetch from backend
  const browseCategory = useCallback(async (categoryId: string) => {
    setSelectedCategory(categoryId);
    setLoading(true);

    try {
      // Use the first search query for the category as the search term
      const category = A2LABS_CATEGORIES.find(c => c.id === categoryId);
      if (!category) {
        showNotification(`Unknown category: ${categoryId}`);
        return;
      }

      const query = category.searchQueries[0];
      
      const response = await fetch('/api/v1/udemy/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          page: 1,
          pageSize: 50,
          price: priceFilter,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();
      setCourses(data.results || []);
      setCurrentSearch(query);
      setView('search');
      showNotification(`${category.label}: ${data.count || 0} courses`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [priceFilter, showNotification]);

  // Toggle category expansion
  const toggleCategoryGroup = useCallback((tier: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(tier)) {
      newExpanded.delete(tier);
    } else {
      newExpanded.add(tier);
    }
    setExpandedCategories(newExpanded);
  }, [expandedCategories]);

  // Filter courses
  const filteredCourses = courses.filter(course => {
    if (levelFilter !== 'all' && course.level !== levelFilter && course.level !== 'All Levels') {
      return false;
    }
    if (priceFilter === 'free' && course.is_paid) {
      return false;
    }
    return true;
  });

  // Format utilities
  const formatRating = (rating: number, reviews: number) => {
    return `${rating.toFixed(1)} (${reviews.toLocaleString()})`;
  };

  const formatSubscribers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return count.toString();
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Beginner':
      case 'All Levels':
        return 'var(--status-success)';
      case 'Intermediate':
        return 'var(--status-warning)';
      case 'Expert':
        return 'var(--status-error)';
      default:
        return 'var(--ui-text-muted)';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'CORE':
        return 'var(--status-info)';
      case 'OPS':
        return '#8b5cf6';
      case 'AGENTS':
        return '#ec4899';
      default:
        return 'var(--ui-text-muted)';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'CORE':
        return Layers;
      case 'OPS':
        return BarChart3;
      case 'AGENTS':
        return Rocket;
      default:
        return BookOpen;
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary, #0a0a0a)',
      color: 'var(--text-primary, #e5e5e5)',
    }}>
      {/* Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          background: curatedCourses.has(Number(notification.match(/\d+/)?.[0])) 
            ? 'var(--success-bg, #065f46)' 
            : 'var(--bg-secondary, #111113)',
          border: `1px solid ${curatedCourses.has(Number(notification.match(/\d+/)?.[0])) ? 'var(--status-success)' : 'var(--border-subtle, #27272a)'}`,
          borderRadius: 8,
          padding: '12px 20px',
          zIndex: 9999,
          animation: 'slideIn 0.3s ease-out',
          boxShadow: 'var(--shadow-md)',
        }}>
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '24px 32px',
        borderBottom: '1px solid var(--border-subtle, #27272a)',
        background: 'var(--bg-secondary, #111113)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Globe size={32} color="var(--status-info)" />
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
              Udemy Course Catalog
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted, #a1a1aa)', margin: 0 }}>
              Browse and curate free courses for A://Labs
            </p>
          </div>
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          {([
            { id: 'browse' as const, icon: Layers, label: 'Browse Categories' },
            { id: 'search' as const, icon: Search, label: 'Search' },
            { id: 'curated' as const, icon: BookmarkPlus, label: `Curated (${curatedCourses.size})` },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                background: view === tab.id ? 'var(--accent, #7c3aed)' : 'transparent',
                border: '1px solid var(--border-subtle, #27272a)',
                borderRadius: 6,
                color: view === tab.id ? '#fff' : 'var(--text-secondary, #d4d4d8)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{
        padding: '12px 32px',
        borderBottom: '1px solid var(--border-subtle, #27272a)',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        background: 'var(--bg-secondary, #111113)',
      }}>
        <Filter size={16} color="#a1a1aa" />
        
        {/* Tier Filter */}
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as TierFilter)}
          style={{
            padding: '6px 12px',
            background: 'var(--bg-tertiary, #18181b)',
            border: '1px solid var(--border-subtle, #27272a)',
            borderRadius: 6,
            color: 'var(--text-primary, #e5e5e5)',
            fontSize: 13,
          }}
        >
          <option value="ALL">All Tiers</option>
          <option value="CORE">CORE (Foundations)</option>
          <option value="OPS">OPS (Operations)</option>
          <option value="AGENTS">AGENTS (Advanced)</option>
        </select>

        {/* Level Filter */}
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
          style={{
            padding: '6px 12px',
            background: 'var(--bg-tertiary, #18181b)',
            border: '1px solid var(--border-subtle, #27272a)',
            borderRadius: 6,
            color: 'var(--text-primary, #e5e5e5)',
            fontSize: 13,
          }}
        >
          <option value="all">All Levels</option>
          <option value="Beginner">Beginner</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Expert">Expert</option>
        </select>

        {/* Price Filter */}
        <select
          value={priceFilter}
          onChange={(e) => setPriceFilter(e.target.value as PriceFilter)}
          style={{
            padding: '6px 12px',
            background: 'var(--bg-tertiary, #18181b)',
            border: '1px solid var(--border-subtle, #27272a)',
            borderRadius: 6,
            color: 'var(--text-primary, #e5e5e5)',
            fontSize: 13,
          }}
        >
          <option value="free">Free Only</option>
          <option value="paid">Paid Only</option>
          <option value="all">All Prices</option>
        </select>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        {/* Error Banner */}
        {error && (
          <div style={{
            marginBottom: 20,
            padding: '12px 16px',
            background: 'var(--info-bg, #1e1b4b)',
            border: '1px solid var(--info-border, #4338ca)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <GraduationCap size={18} color="#818cf8" />
            <span>{error}</span>
          </div>
        )}

        {/* BROWSE CATEGORIES VIEW */}
        {view === 'browse' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>
              <Layers size={20} style={{ display: 'inline', marginRight: 8 }} />
              A://Labs Course Categories
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {(['CORE', 'OPS', 'AGENTS'] as const).map(tier => {
                const isExpanded = expandedCategories.has(tier);
                const TierIcon = getTierIcon(tier);
                const tierCategories = A2LABS_CATEGORIES.filter(c => c.tier === tier);

                return (
                  <div key={tier}>
                    {/* Tier Header */}
                    <button
                      onClick={() => toggleCategoryGroup(tier)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 16px',
                        background: 'var(--bg-secondary, #111113)',
                        border: `1px solid ${getTierColor(tier)}33`,
                        borderRadius: 8,
                        color: getTierColor(tier),
                        cursor: 'pointer',
                        width: '100%',
                        fontSize: 16,
                        fontWeight: 600,
                        marginBottom: 12,
                      }}
                    >
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      <TierIcon size={20} />
                      <span>Tier {tier}: {tier === 'CORE' ? 'Foundations' : tier === 'OPS' ? 'Operations' : 'Advanced'}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.7 }}>
                        {tierCategories.length} categories
                      </span>
                    </button>

                    {/* Category Grid */}
                    {isExpanded && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: 12,
                        paddingLeft: 20,
                      }}>
                        {tierCategories.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => browseCategory(cat.id)}
                            style={{
                              padding: 16,
                              background: selectedCategory === cat.id 
                                ? `${getTierColor(tier)}22` 
                                : 'var(--bg-secondary, #111113)',
                              border: `1px solid ${selectedCategory === cat.id ? getTierColor(tier) : 'var(--border-subtle, #27272a)'}`,
                              borderRadius: 8,
                              color: 'var(--text-primary, #e5e5e5)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'var(--transition-fast)',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.borderColor = getTierColor(tier);
                            }}
                            onMouseLeave={(e) => {
                              if (selectedCategory !== cat.id) {
                                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle, #27272a)';
                              }
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                              {cat.label}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted, #a1a1aa)', marginBottom: 8 }}>
                              {cat.description}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted, #a1a1aa)' }}>
                              Search terms: {cat.searchQueries.slice(0, 3).join(', ')}...
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Info Card */}
            <div style={{
              marginTop: 32,
              padding: 20,
              background: 'var(--info-bg, #1e1b4b)',
              border: '1px solid var(--info-border, #4338ca)',
              borderRadius: 8,
            }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>
                <BookmarkPlus size={16} style={{ display: 'inline', marginRight: 6 }} />
                How to Curate Courses for A://Labs
              </h3>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
                <li>Browse categories or search for specific topics</li>
                <li>Review course details, ratings, and reviews</li>
                <li>Click <strong>✓ Add to A://Labs</strong> to curate relevant courses</li>
                <li>View all curated courses in the "Curated" tab</li>
                <li>Later: Import curated courses into Canvas LMS</li>
              </ol>
            </div>
          </div>
        )}

        {/* SEARCH VIEW */}
        {view === 'search' && (
          <div>
            {/* Search Bar */}
            <div style={{ marginBottom: 24, display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search 
                  size={18} 
                  color="#a1a1aa" 
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} 
                />
                <input
                  type="text"
                  placeholder="Search Udemy courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchCourses(searchQuery)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    background: 'var(--bg-secondary, #111113)',
                    border: '1px solid var(--border-subtle, #27272a)',
                    borderRadius: 6,
                    color: 'var(--text-primary, #e5e5e5)',
                    fontSize: 14,
                  }}
                />
              </div>
              <button
                onClick={() => searchCourses(searchQuery)}
                disabled={loading || !searchQuery.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 20px',
                  background: 'var(--accent, #7c3aed)',
                  border: 'none',
                  borderRadius: 6,
                  color: 'var(--ui-text-primary)',
                  fontWeight: 600,
                  cursor: loading || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  opacity: loading || !searchQuery.trim() ? 0.6 : 1,
                }}
              >
                <Search size={16} />
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Results */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted, #a1a1aa)' }}>
                <div className="animate-spin" style={{ display: 'inline-block' }}>⏳</div>
                <p>Searching Udemy...</p>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted, #a1a1aa)' }}>
                <Search size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                <p>No courses found. Try a different search term or adjust filters.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                {filteredCourses.map(course => {
                  const isCurated = curatedCourses.has(course.id);
                  return (
                    <div
                      key={course.id}
                      style={{
                        background: 'var(--bg-secondary, #111113)',
                        border: `1px solid ${isCurated ? 'var(--status-success)' : 'var(--border-subtle, #27272a)'}`,
                        borderRadius: 10,
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={course.image_240x135}
                        alt={course.title}
                        style={{ width: '100%', height: 135, objectFit: 'cover' }}
                      />
                      <div style={{ padding: 16 }}>
                        <h3 
                          style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px', cursor: 'pointer' }}
                          onClick={() => setSelectedCourse(course)}
                        >
                          {course.title}
                        </h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted, #a1a1aa)', margin: '0 0 12px' }}>
                          {course.headline}
                        </p>

                        <div style={{ display: 'flex', gap: 12, fontSize: 12, marginBottom: 12 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Star size={12} color="var(--status-warning)" />
                            {formatRating(course.rating, course.num_reviews)}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Users size={12} />
                            {formatSubscribers(course.num_subscribers)}
                          </span>
                          <span style={{
                            padding: '2px 6px',
                            background: getLevelColor(course.level),
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                          }}>
                            {course.level}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => toggleCurated(course)}
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              padding: '8px 12px',
                              background: isCurated ? 'var(--status-success)' : 'var(--accent, #7c3aed)',
                              border: 'none',
                              borderRadius: 6,
                              color: 'var(--ui-text-primary)',
                              fontWeight: 600,
                              fontSize: 13,
                              cursor: 'pointer',
                            }}
                          >
                            {isCurated ? <Check size={14} /> : <Plus size={14} />}
                            {isCurated ? 'Curated' : 'Add to A://Labs'}
                          </button>
                          <a
                            href={`https://www.udemy.com${course.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '8px 12px',
                              background: 'transparent',
                              border: '1px solid var(--border-subtle, #27272a)',
                              borderRadius: 6,
                              color: 'var(--text-secondary, #d4d4d8)',
                              textDecoration: 'none',
                            }}
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CURATED VIEW */}
        {view === 'curated' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>
              <BookmarkPlus size={20} style={{ display: 'inline', marginRight: 8 }} />
              Curated Courses for A://Labs
            </h2>

            {curatedCourses.size === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted, #a1a1aa)' }}>
                <BookmarkPlus size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                <p style={{ fontSize: 16, marginBottom: 8 }}>No courses curated yet</p>
                <p style={{ fontSize: 13 }}>
                  Browse categories or search to find relevant courses
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{
                  padding: 16,
                  background: 'var(--bg-secondary, #111113)',
                  border: '1px solid var(--border-subtle, #27272a)',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span>
                    <Trophy size={16} style={{ display: 'inline', marginRight: 8 }} />
                    <strong>{curatedCourses.size}</strong> courses curated for A://Labs
                  </span>
                  <button
                    style={{
                      padding: '8px 16px',
                      background: 'var(--accent, #7c3aed)',
                      border: 'none',
                      borderRadius: 6,
                      color: 'var(--ui-text-primary)',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                    onClick={() => showNotification('Export/Canvas upload coming soon!')}
                  >
                    Export to Canvas LMS
                  </button>
                </div>

                {/* List of curated course IDs (placeholder - in production load full data) */}
                <div style={{ fontSize: 13, color: 'var(--text-muted, #a1a1aa)', textAlign: 'center', padding: 40 }}>
                  Course details will be loaded from Udemy API when backend proxy is configured
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>

      {/* Course Detail Modal */}
      {selectedCourse && (
        <div
          onClick={() => setSelectedCourse(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-primary, #0a0a0a)',
              border: '1px solid var(--border-subtle, #27272a)',
              borderRadius: 12,
              maxWidth: 600,
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Modal Header */}
            <div style={{ position: 'relative' }}>
              <img
                src={selectedCourse.image_240x135}
                alt={selectedCourse.title}
                style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: '12px 12px 0 0' }}
              />
              <button
                onClick={() => setSelectedCourse(null)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  background: 'var(--shell-overlay-backdrop)',
                  border: 'none',
                  color: 'var(--ui-text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
                {selectedCourse.title}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary, #d4d4d8)', margin: '0 0 16px' }}>
                {selectedCourse.headline}
              </p>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
                <div style={{
                  padding: 12,
                  background: 'var(--bg-secondary, #111113)',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle, #27272a)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Star size={16} color="var(--status-warning)" />
                    <span style={{ fontSize: 18, fontWeight: 700 }}>
                      {selectedCourse.rating.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #a1a1aa)' }}>
                    {selectedCourse.num_reviews.toLocaleString()} reviews
                  </div>
                </div>

                <div style={{
                  padding: 12,
                  background: 'var(--bg-secondary, #111113)',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle, #27272a)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Users size={16} />
                    <span style={{ fontSize: 18, fontWeight: 700 }}>
                      {formatSubscribers(selectedCourse.num_subscribers)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #a1a1aa)' }}>
                    Students enrolled
                  </div>
                </div>

                <div style={{
                  padding: 12,
                  background: 'var(--bg-secondary, #111113)',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle, #27272a)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <PlayCircle size={16} />
                    <span style={{ fontSize: 18, fontWeight: 700 }}>
                      {selectedCourse.num_lectures}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #a1a1aa)' }}>
                    Lectures
                  </div>
                </div>

                <div style={{
                  padding: 12,
                  background: 'var(--bg-secondary, #111113)',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle, #27272a)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Award size={16} color={getLevelColor(selectedCourse.level)} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: getLevelColor(selectedCourse.level) }}>
                      {selectedCourse.level}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #a1a1aa)' }}>
                    Difficulty level
                  </div>
                </div>
              </div>

              {/* Category Tag */}
              {selectedCourse.category && (
                <div style={{ marginBottom: 16 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    background: 'var(--info-bg, #1e1b4b)',
                    border: '1px solid var(--info-border, #4338ca)',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#818cf8',
                  }}>
                    <Info size={12} />
                    {selectedCourse.category}
                  </span>
                </div>
              )}

              {/* Topics */}
              {selectedCourse.topics && selectedCourse.topics.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                    Topics:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedCourse.topics.map(topic => (
                      <span
                        key={topic}
                        style={{
                          padding: '4px 10px',
                          background: 'var(--bg-secondary, #111113)',
                          border: '1px solid var(--border-subtle, #27272a)',
                          borderRadius: 12,
                          fontSize: 11,
                          color: 'var(--text-secondary, #d4d4d8)',
                        }}
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => {
                    toggleCurated(selectedCourse);
                    setSelectedCourse(null);
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '12px 16px',
                    background: curatedCourses.has(selectedCourse.id) ? 'var(--status-success)' : 'var(--accent, #7c3aed)',
                    border: 'none',
                    borderRadius: 8,
                    color: 'var(--ui-text-primary)',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  {curatedCourses.has(selectedCourse.id) ? <Check size={16} /> : <Plus size={16} />}
                  {curatedCourses.has(selectedCourse.id) ? 'Curated for A://Labs' : 'Add to A://Labs'}
                </button>
                <a
                  href={`https://www.udemy.com${selectedCourse.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '12px 16px',
                    background: 'transparent',
                    border: '1px solid var(--border-subtle, #27272a)',
                    borderRadius: 8,
                    color: 'var(--text-secondary, #d4d4d8)',
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  <ExternalLink size={16} />
                  View on Udemy
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CatalogView;

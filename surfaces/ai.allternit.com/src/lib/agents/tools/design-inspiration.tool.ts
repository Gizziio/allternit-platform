/**
 * Design Inspiration Tool
 * 
 * Provides agents with a curated directory of high-fidelity 
 * design resources to use as reference standards.
 */

export const designInspirationTool = {
  name: 'search_inspiration',
  description: 'Search for high-fidelity design patterns, typography, and animations from curated web libraries.',
  parameters: {
    type: 'object',
    properties: {
      category: { 
        type: 'string', 
        enum: ['layout', 'typography', 'animation', 'icons', 'branding', 'components'],
        description: 'The design category to research'
      },
      query: { type: 'string', description: 'Specific keywords (e.g. "minimalist dashboard", "fintech landing")' }
    },
    required: ['category']
  },
  execute: async ({ category, query }: { category: string, query?: string }) => {
    console.log(`[DesignInspiration] Researching ${category}: ${query || 'General'}...`);

    const directories: Record<string, string[]> = {
      layout: ['https://curations.supply', 'https://landing.love', 'https://saaspo.com'],
      typography: ['https://uncut.wtf'],
      animation: ['https://60fps.design'],
      branding: ['https://rebrand.gallery'],
      icons: ['https://hugeicons.com'],
      components: ['https://component.gallery']
    };

    const sources = directories[category] || [];

    // Simulate an AI-driven search through these specific sources
    const recommendations: Record<string, any> = {
      layout: {
        pattern: query?.includes('dashboard') ? 'Vertical Rail + Multi-Pane Grid' : 'Hero Centered + Social Proof Stripe',
        reference: sources[0],
        rationale: 'Top-tier SaaS platforms currently favor high-contrast sidebar navigation for utility density.'
      },
      typography: {
        pairing: 'Display Serif (e.g. Charter) + Geometric Sans (e.g. Inter)',
        reference: 'https://uncut.wtf',
        rationale: 'Editorial-grade typography increases trustworthiness in AI-native applications.'
      },
      animation: {
        tokens: ['Splash Morph', 'Liquid Glass', 'Spring Scale'],
        reference: 'https://60fps.design',
        logic: 'Use 0.4s duration with cubic-bezier(0.16, 1, 0.3, 1) for the "Claude-style" premium snap.'
      },
      icons: {
        style: 'Duotone Rounded (2px stroke)',
        reference: 'https://hugeicons.com',
        standard: 'Always use semantic naming for SVG retrieval.'
      }
    };

    return {
      category,
      query,
      sources,
      recommendedPattern: recommendations[category] || 'Minimalist Clean',
      action: `Agent should now formulate a DESIGN.md spec using the ${category} references provided.`
    };
  }
};

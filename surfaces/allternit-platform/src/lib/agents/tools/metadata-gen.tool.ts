/**
 * Metadata Generation Tool
 * 
 * Inspired by metadata-gen.
 * Generates SEO, OpenGraph, and Branding metadata based on project context.
 */
export const metadataGenTool = {
  name: 'generate_metadata',
  description: 'Generate production-ready SEO, Social (OG/Twitter), and Branding metadata for a design project.',
  parameters: {
    type: 'object',
    properties: {
      projectName: { type: 'string' },
      description: { type: 'string' },
      brandColors: { type: 'array', items: { type: 'string' } },
      targetAudience: { type: 'string' }
    },
    required: ['projectName', 'description']
  },
  execute: async ({ projectName, description, brandColors = [], targetAudience }: any) => {
    console.log(`[MetadataGen] Generating brand package for: ${projectName}...`);

    return {
      seo: {
        title: `${projectName} | High-Fidelity Design`,
        metaDescription: description.slice(0, 160),
        keywords: ['design', 'ai-native', 'allternit', targetAudience].filter(Boolean)
      },
      social: {
        ogTitle: projectName,
        ogImage: `https://api.allternit.design/og/${projectName.toLowerCase().replace(/\s/g, '-')}.png`,
        twitterCard: 'summary_large_image'
      },
      branding: {
        themeColor: brandColors[0] || '#d4b08c',
        appleTouchIcon: '/icons/apple-touch-icon.png',
        favicon: '/favicon.ico'
      },
      schemaOrg: {
        type: 'WebApplication',
        name: projectName,
        applicationCategory: 'DesignEngine'
      }
    };
  }
};

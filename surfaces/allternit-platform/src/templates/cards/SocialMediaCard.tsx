/**
 * Social Media Template
 * Creates social media content
 */

export interface SocialMediaParams {
  topic: string;
  platform: 'twitter' | 'linkedin' | 'instagram';
  tone?: 'professional' | 'casual' | 'witty';
}

export async function socialMedia(params: SocialMediaParams) {
  const { topic, platform, tone = 'professional' } = params;
  return {
    content: `Check out ${topic}!`,
    hashtags: ['#topic'],
    platform,
    tone
  };
}

export default socialMedia;

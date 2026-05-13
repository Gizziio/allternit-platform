
import React from 'react';

const ProviderLogos: Record<string, React.FC<{ size?: number }>> = {
  'anthropic': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M17.304 3.541h-3.672l6.696 16.918h3.672zm-10.608 0L0 20.459h3.744l1.368-3.6h6.696l1.368 3.6h3.744L10.416 3.541H6.696zm-.264 10.656 2.088-5.472 2.088 5.472z" fill="#D97757"/>
    </svg>
  ),
  'openai': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="openaiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10a37f"/>
          <stop offset="100%" stopColor="#0d8c6d"/>
        </linearGradient>
      </defs>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494z" fill="url(#openaiGrad)"/>
    </svg>
  ),
  'gemini': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="geminiGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4"/>
          <stop offset="50%" stopColor="#9B72CB"/>
          <stop offset="100%" stopColor="#EA4335"/>
        </linearGradient>
        <linearGradient id="geminiGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBC05"/>
          <stop offset="100%" stopColor="#34A853"/>
        </linearGradient>
      </defs>
      <path d="M12 2L14.5 9.5H22.5L16 14.5L18.5 22L12 17L5.5 22L8 14.5L1.5 9.5H9.5L12 2Z" fill="url(#geminiGrad1)"/>
      <path d="M12 6L13.5 10.5H18L14.5 13.5L16 18L12 15L8 18L9.5 13.5L6 10.5H10.5L12 6Z" fill="url(#geminiGrad2)"/>
    </svg>
  ),
  'xai': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#FFFFFF"/>
    </svg>
  ),
  'github': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" fill="#FFFFFF"/>
    </svg>
  ),
  'azure': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="azureGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0078D4"/>
          <stop offset="50%" stopColor="#005A9E"/>
          <stop offset="100%" stopColor="#003A5E"/>
        </linearGradient>
      </defs>
      <path d="M5.483 21.3H24L14.025 4.013l-3.038 8.347 5.836 6.938L5.483 21.3zM13.23 2.7L6.105 8.677 0 19.253h5.505l7.848-13.735z" fill="url(#azureGrad)"/>
    </svg>
  ),
  'aws': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="awsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF9900"/>
          <stop offset="100%" stopColor="#EC7211"/>
        </linearGradient>
      </defs>
      <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.863.279a2.01 2.01 0 0 1-.28.103.49.49 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.28-.144.617-.264 1.013-.36.4-.096.823-.143 1.274-.143.97 0 1.677.223 2.13.662.447.44.67 1.104.67 1.996v2.638zm-3.063.96c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.048-.191.08-.423.08-.694v-.335c-.232-.056-.479-.104-.743-.136a6.54 6.54 0 0 0-.766-.048c-.55 0-.95.104-1.22.32-.271.215-.4.518-.4.919 0 .375.095.655.295.846.191.2.47.296.842.296z" fill="url(#awsGrad)"/>
    </svg>
  ),
  'mistral': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="mistralGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF7000"/>
          <stop offset="100%" stopColor="#FFB800"/>
        </linearGradient>
      </defs>
      <path d="M2 3h3.5l3.5 8.5L12.5 3H17l-3 18h-3L11 13l-2.5 8H5.5L2 3z" fill="url(#mistralGrad)"/>
      <path d="M13 3h3l3 18h-3l-1.5-9-1.5 9h-3L13 3z" fill="url(#mistralGrad)" opacity="0.7"/>
    </svg>
  ),
  'cohere': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="cohereGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6B6B"/>
          <stop offset="100%" stopColor="#FF4757"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" stroke="url(#cohereGrad)" strokeWidth="2" fill="none"/>
      <circle cx="12" cy="12" r="6" stroke="url(#cohereGrad)" strokeWidth="2" fill="none"/>
      <circle cx="12" cy="12" r="2" fill="url(#cohereGrad)"/>
    </svg>
  ),
  'deepseek': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="deepseekGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5"/>
          <stop offset="100%" stopColor="#7C3AED"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" stroke="url(#deepseekGrad)" strokeWidth="2" fill="none"/>
      <path d="M11 7h2v6h-2zm0 8h2v2h-2z" fill="url(#deepseekGrad)"/>
    </svg>
  ),
  'perplexity': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="perplexityGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00D4AA"/>
          <stop offset="100%" stopColor="#00A8E8"/>
        </linearGradient>
      </defs>
      <circle cx="10" cy="10" r="7" stroke="url(#perplexityGrad)" strokeWidth="2" fill="none"/>
      <path d="M15.5 15.5L21 21" stroke="url(#perplexityGrad)" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="10" cy="10" r="3" fill="url(#perplexityGrad)"/>
    </svg>
  ),
  'openrouter': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="routerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EF4444"/>
          <stop offset="100%" stopColor="#DC2626"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="5" r="3" fill="url(#routerGrad)"/>
      <circle cx="5" cy="19" r="3" fill="url(#routerGrad)"/>
      <circle cx="19" cy="19" r="3" fill="url(#routerGrad)"/>
      <path d="M12 8L5 19M12 8L19 19" stroke="url(#routerGrad)" strokeWidth="2"/>
    </svg>
  ),
  'qwen': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="qwenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6A00"/>
          <stop offset="100%" stopColor="#FF4500"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" stroke="url(#qwenGrad)" strokeWidth="2.5" fill="none"/>
      <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5c.9 0 1.74-.24 2.47-.66l2.12 2.12 1.41-1.41-2.12-2.12A4.98 4.98 0 0 0 17 12c0-2.76-2.24-5-5-5z" fill="url(#qwenGrad)"/>
    </svg>
  ),
  'kimi': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="kimiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6"/>
          <stop offset="50%" stopColor="#A855F7"/>
          <stop offset="100%" stopColor="#C084FC"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" stroke="url(#kimiGrad)" strokeWidth="2" fill="none"/>
      <path d="M8 7v10l4-5 4 5V7" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'glm': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="glmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E40AF"/>
          <stop offset="100%" stopColor="#3B82F6"/>
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="url(#glmGrad)" strokeWidth="2" fill="none"/>
      <path d="M8 12h4c1.1 0 2-.9 2-2s-.9-2-2-2H8v8h2v-4z" fill="url(#glmGrad)"/>
    </svg>
  ),
  'local': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="localGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981"/>
          <stop offset="100%" stopColor="#059669"/>
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="url(#localGrad)" strokeWidth="2" fill="none"/>
      <rect x="9" y="9" width="6" height="6" fill="url(#localGrad)"/>
      <path d="M2 9h2M2 15h2M20 9h2M20 15h2M9 2v2M15 2v2M9 20v2M15 20v2" stroke="url(#localGrad)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  "allternit": ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="#d4966a" strokeWidth="2" fill="none"/>
      <circle cx="12" cy="12" r="8" stroke="#d4966a" strokeWidth="2" strokeDasharray="4 2" fill="none"/>
    </svg>
  ),
  'gizzi': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5" stroke="#d4966a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M2 12l10 5 10-5" stroke="#d4966a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  'terminal': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="#9CA3AF" strokeWidth="2" fill="none"/>
      <path d="M6 8l4 4-4 4M10 16h8" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'opencode': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="opencodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1"/>
          <stop offset="100%" stopColor="#8B5CF6"/>
        </linearGradient>
      </defs>
      <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" stroke="url(#opencodeGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="2" fill="url(#opencodeGrad)"/>
    </svg>
  ),
};

export function getProviderLogo(providerId: string): React.FC<{ size?: number }> {
  const normalized = providerId.toLowerCase();
  return ProviderLogos[normalized] || ProviderLogos['allternit'];
}

export default ProviderLogos;

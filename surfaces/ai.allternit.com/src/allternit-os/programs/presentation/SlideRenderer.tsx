"use client";

import React from 'react';
import type { PresentationSlide } from '../../types/programs';

interface SlideRendererProps {
  slide: PresentationSlide;
  isActive: boolean;
  theme: string;
}

export const SlideRenderer: React.FC<SlideRendererProps> = ({ slide, isActive, theme }) => {
  const themeStyles: Record<string, string> = {
    default: 'bg-white text-zinc-900',
    dark: 'bg-zinc-900 text-white',
    blue: 'bg-gradient-to-br from-blue-600 to-blue-800 text-white',
    gradient: 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white',
    minimal: 'bg-zinc-50 text-zinc-900',
  };

  const getLayoutStyles = () => {
    switch (slide.type) {
      case 'title':
        return 'flex flex-col items-center justify-center text-center';
      case 'content':
        return 'flex flex-col p-12';
      case 'two-column':
        return 'flex gap-8 p-12';
      case 'image':
        return 'flex flex-col items-center justify-center';
      default:
        return 'flex flex-col p-12';
    }
  };

  return (
    <div 
      className={`
        w-full h-full rounded-lg shadow-2xl overflow-hidden
        ${themeStyles[theme] || themeStyles.default}
        ${getLayoutStyles()}
        transition-all duration-500
      `}
    >
      {slide.type === 'title' && (
        <>
          <h1 className="text-5xl font-bold mb-6">{slide.content}</h1>
          {slide.metadata?.subtitle && (
            <p className="text-2xl opacity-80">{slide.metadata.subtitle as string}</p>
          )}
        </>
      )}
      
      {slide.type === 'content' && (
        <>
          <h2 className="text-3xl font-semibold mb-6">{slide.content}</h2>
          {slide.metadata?.bullets && (
            <ul className="space-y-3 text-xl">
              {(slide.metadata.bullets as string[]).map((bullet) => (
                <li key={`${slide.id}-${bullet}`} className="flex items-start gap-3">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {slide.type === 'two-column' && (
        <>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold mb-4">{slide.content}</h2>
          </div>
          <div className="flex-1">
            {slide.metadata?.rightContent && (
              <div className="text-lg">{slide.metadata.rightContent as string}</div>
            )}
          </div>
        </>
      )}

      {slide.type === 'image' && (
        <>
          {slide.metadata?.imageUrl && (
            <img 
              src={slide.metadata.imageUrl as string} 
              alt={slide.content}
              className="max-h-3/4 max-w-full object-contain mb-6 rounded"
            />
          )}
          <p className="text-xl">{slide.content}</p>
        </>
      )}

      {slide.type === 'code' && (
        <>
          <h2 className="text-2xl font-semibold mb-4">{slide.content}</h2>
          {slide.metadata?.code && (
            <pre className="flex-1 w-full bg-zinc-900 text-zinc-100 p-6 rounded-lg overflow-auto text-sm">
              <code>{slide.metadata.code as string}</code>
            </pre>
          )}
        </>
      )}
    </div>
  );
};

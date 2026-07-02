"use client";

import type { PresentationState } from '../../types/programs';

export const exportToPPTX = async (state: PresentationState): Promise<void> => {
  // Generate a simple PPTX-compatible HTML that can be opened in PowerPoint
  const slidesHtml = state.slides.map((slide) => {
    let content = '';
    
    switch (slide.type) {
      case 'title':
        content = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 40px;">
            <h1 style="font-size: 44px; font-weight: bold; margin-bottom: 20px; color: #333;">${slide.content}</h1>
            ${slide.metadata?.subtitle ? `<p style="font-size: 24px; color: #666;">${slide.metadata.subtitle}</p>` : ''}
          </div>
        `;
        break;
      case 'content':
        const bullets = (slide.metadata?.bullets as string[] || [])
          .map(b => `<li style="font-size: 20px; margin-bottom: 12px; color: #333;">${b}</li>`)
          .join('');
        content = `
          <div style="padding: 40px;">
            <h2 style="font-size: 32px; font-weight: bold; margin-bottom: 30px; color: #333;">${slide.content}</h2>
            <ul style="list-style: none; padding: 0;">${bullets}</ul>
          </div>
        `;
        break;
      case 'image':
        content = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px;">
            ${slide.metadata?.imageUrl ? `<img src="${slide.metadata.imageUrl}" style="max-height: 400px; max-width: 100%; object-fit: contain; margin-bottom: 20px;" />` : ''}
            <p style="font-size: 20px; color: #666;">${slide.content}</p>
          </div>
        `;
        break;
      default:
        content = `<div style="padding: 40px;"><h2 style="font-size: 32px;">${slide.content}</h2></div>`;
    }
    
    return `
      <div class="slide" style="width: 960px; height: 540px; background: white; margin: 0 auto 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); page-break-after: always;">
        ${content}
        ${slide.notes ? `<div style="margin-top: 20px; padding: 10px; background: #fffbeb; font-size: 12px; color: #666;"><strong>Notes:</strong> ${slide.notes}</div>` : ''}
      </div>
    `;
  }).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${state.title || 'Presentation'} - Export</title>
  <style>
    @page { size: 10in 5.625in; margin: 0; }
    body { font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .slide { page-break-inside: avoid; }
    @media print {
      body { background: white; padding: 0; }
      .slide { box-shadow: none; margin: 0; }
    }
  </style>
</head>
<body>
  ${slidesHtml}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(state.title || 'presentation').replace(/\s+/g, '_')}.html`;
  a.click();
  window.open(url, '_blank');
  URL.revokeObjectURL(url);
};

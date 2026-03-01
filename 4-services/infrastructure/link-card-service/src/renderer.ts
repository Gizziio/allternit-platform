import { createCanvas, registerFont } from 'canvas';
import { z } from 'zod';

export const CardRenderSchema = z.object({
  title: z.string().min(1).max(80),
  subtitle: z.string().optional(),
  bullets: z.array(z.string()).max(6).optional(),
  cta_label: z.string().default('Tap to expand'),
  theme: z.object({
    primary: z.string().regex(/^#([A-Fa-f0-9]{6})$/),
    background: z.string().regex(/^#([A-Fa-f0-9]{6})$/),
  }),
});

export type CardRenderPayload = z.infer<typeof CardRenderSchema>;

export function renderCard(data: CardRenderPayload): Buffer {
  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = data.theme.background;
  ctx.fillRect(0, 0, width, height);

  // Gradient Header
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, data.theme.primary);
  grad.addColorStop(1, '#6366f1'); // violet-500
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, 20);

  // Content Container
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 60px sans-serif';
  ctx.fillStyle = '#1f2937'; // gray-800
  ctx.fillText(data.title, 60, 120);

  if (data.subtitle) {
    ctx.font = '40px sans-serif';
    ctx.fillStyle = '#6b7280'; // gray-500
    ctx.fillText(data.subtitle, 60, 180);
  }

  // Bullets
  if (data.bullets && data.bullets.length > 0) {
    let y = 260;
    ctx.font = '32px sans-serif';
    ctx.fillStyle = '#374151'; // gray-700
    
    for (const bullet of data.bullets) {
      // Bullet point
      ctx.beginPath();
      ctx.arc(70, y - 10, 6, 0, 2 * Math.PI);
      ctx.fillStyle = data.theme.primary;
      ctx.fill();
      
      // Text
      ctx.fillStyle = '#374151';
      ctx.fillText(bullet, 100, y);
      y += 50;
    }
  }

  // Fake iMessage bubbles
  drawBubble(ctx, 700, 150, "Hey, can you help me with this?", 'user');
  drawBubble(ctx, 700, 280, "Sure! I can analyze that locally for you.", 'agent', data.theme.primary);

  // CTA Footer
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, height - 100, width, 100);
  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = data.theme.primary;
  ctx.textAlign = 'center';
  ctx.fillText(data.cta_label.toUpperCase(), width / 2, height - 35);

  return canvas.toBuffer('image/png');
}

function drawBubble(ctx: any, x: number, y: number, text: string, type: 'user' | 'agent', color?: string) {
  const isUser = type === 'user';
  const bgColor = isUser ? '#3b82f6' : '#e5e7eb';
  const textColor = isUser ? '#ffffff' : '#1f2937';
  
  ctx.font = '30px sans-serif';
  const textWidth = ctx.measureText(text).width;
  const padding = 20;
  const bubbleWidth = textWidth + padding * 2;
  const bubbleHeight = 70;

  // Align bubbles
  const drawX = isUser ? 1140 - bubbleWidth : x; // Right align user

  ctx.fillStyle = color || bgColor;
  roundRect(ctx, drawX, y, bubbleWidth, bubbleHeight, 25);
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.fillText(text, drawX + padding, y + 45);
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

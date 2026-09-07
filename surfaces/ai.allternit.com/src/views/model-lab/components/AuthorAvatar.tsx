'use client';

import React, { useState } from 'react';
import { Cube } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/**
 * Deterministic muted background color for the author monogram fallback,
 * derived from a hash of the author name so it stays stable across renders.
 */
function monogramBackground(author: string): string {
  let hash = 0;
  for (let i = 0; i < author.length; i += 1) {
    hash = (hash * 31 + author.charCodeAt(i)) >>> 0;
  }
  const hues = [215, 250, 280, 320, 160, 30, 5, 190];
  const hue = hues[hash % hues.length];
  const saturation = 22 + (hash % 16); // 22–37%
  const lightness = 26 + ((hash >> 8) % 10); // 26–35%
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

/**
 * Author avatar with a graceful fallback stack: tries the Hugging Face
 * author avatar (or an explicit `src`), falls back to a deterministic
 * monogram tile (first letter of the author), and finally a neutral cube icon
 * when there is no author at all.
 */
export function AuthorAvatar({
  author,
  src,
  className,
  iconSize = 28,
}: {
  author: string;
  src?: string | null;
  className?: string;
  iconSize?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const avatarUrl =
    src ?? (author ? `https://huggingface.co/${encodeURIComponent(author)}/avatar` : null);

  if (!avatarUrl || imgFailed) {
    if (author) {
      return (
        <div
          className={cn('size-full flex items-center justify-center', className)}
          style={{ backgroundColor: monogramBackground(author) }}
          aria-hidden="true"
        >
          <span className="text-lg font-semibold uppercase text-white/80">
            {author.trim().charAt(0)}
          </span>
        </div>
      );
    }
    return (
      <div
        className={cn(
          'size-full flex items-center justify-center text-[var(--accent-primary)]',
          className
        )}
      >
        <Cube size={iconSize} weight="duotone" />
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={author}
      className={cn('size-full object-cover', className)}
      onError={() => setImgFailed(true)}
    />
  );
}

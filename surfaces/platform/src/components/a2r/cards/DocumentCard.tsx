/**
 * DocumentCard.tsx
 * 
 * Compact A2R Document card for chat thread.
 * Shows preview with "Open Full" option to expand to sidecar.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  ArrowUpRight, 
  Clock, 
  Maximize2,
  ChevronDown,
  ChevronUp,
  Quote
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DocumentCardProps {
  id: string;
  title: string;
  content: string;
  citations?: Array<{
    id: string;
    source: string;
    url?: string;
  }>;
  evidence?: Array<{
    type: 'image' | 'screenshot' | 'chart';
    url: string;
    caption?: string;
  }>;
  metadata?: {
    author?: string;
    createdAt?: Date;
    wordCount?: number;
    blockCount?: number;
  };
  isLoading?: boolean;
  progress?: number;
  onOpenFull?: () => void;
  className?: string;
}

/**
 * A2R Document Card
 * 
 * Inline preview of an A2R Document in the chat thread.
 * Shows hero section, excerpt, and citations.
 * "Open Full" expands to full editor in sidecar.
 */
export function DocumentCard({
  id,
  title,
  content,
  citations = [],
  evidence = [],
  metadata,
  isLoading = false,
  progress = 100,
  onOpenFull,
  className,
}: DocumentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse first few paragraphs for preview
  const previewContent = content
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .slice(0, 3)
    .join(' ')
    .slice(0, 200);

  const hasMoreContent = content.length > 200 || content.split('\n').length > 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "w-full max-w-[680px] rounded-xl overflow-hidden border border-[#333] bg-[#1a1a1a]",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#333] bg-[#1e1e1e] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#D4956A]/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-[#D4956A]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#ECECEC]">
              A2R Document
            </h3>
            <p className="text-xs text-[#666]">
              {metadata?.wordCount || 0} words • {citations.length} sources
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-[#333] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#D4956A]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-xs text-[#666]">{Math.round(progress)}%</span>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenFull}
            className="h-7 text-[#888] hover:text-[#ECECEC] hover:bg-[#333]"
          >
            <Maximize2 className="w-3.5 h-3.5 mr-1" />
            <span className="text-xs">Open Full</span>
          </Button>
        )}
      </div>

      {/* Content Preview */}
      <div className="p-4">
        {/* Title */}
        <h2 className="text-lg font-semibold text-[#ECECEC] mb-2">
          {title}
        </h2>

        {/* Excerpt */}
        <div className="text-sm text-[#b8b8b8] leading-relaxed mb-4">
          {isExpanded ? (
            <div className="space-y-2">
              {content.split('\n').filter(line => line.trim()).slice(0, 10).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
              {hasMoreContent && (
                <p className="text-[#666] italic">
                  ...and {content.split('\n').length - 10} more sections
                </p>
              )}
            </div>
          ) : (
            <p>{previewContent}{hasMoreContent && '...'}</p>
          )}
        </div>

        {/* Evidence Preview */}
        {evidence.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {evidence.slice(0, 3).map((item, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-24 h-16 rounded-lg bg-[#242424] border border-[#333] overflow-hidden"
              >
                {item.type === 'image' || item.type === 'screenshot' ? (
                  <img
                    src={item.url}
                    alt={item.caption || 'Evidence'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#666]">
                    <Quote className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}
            {evidence.length > 3 && (
              <div className="flex-shrink-0 w-24 h-16 rounded-lg bg-[#242424] border border-[#333] flex items-center justify-center text-xs text-[#666]">
                +{evidence.length - 3} more
              </div>
            )}
          </div>
        )}

        {/* Citations */}
        {citations.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {citations.slice(0, 4).map((citation) => (
              <a
                key={citation.id}
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#242424] border border-[#333] text-xs text-[#888] hover:text-[#D4956A] hover:border-[#D4956A]/30 transition-colors"
              >
                <span>[{citation.id}]</span>
                <span className="truncate max-w-[120px]">{citation.source}</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
            ))}
            {citations.length > 4 && (
              <span className="inline-flex items-center px-2 py-1 text-xs text-[#666]">
                +{citations.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#333]">
          <div className="flex items-center gap-3 text-xs text-[#666]">
            {metadata?.author && (
              <span>By {metadata.author}</span>
            )}
            {metadata?.createdAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(metadata.createdAt)}
              </span>
            )}
          </div>

          {hasMoreContent && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-xs text-[#888] hover:text-[#ECECEC] transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Show More
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default DocumentCard;

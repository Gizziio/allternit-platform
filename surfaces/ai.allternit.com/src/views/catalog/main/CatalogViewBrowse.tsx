import React from "react";
import { 
  Layers, 
  ChevronDown, 
  ChevronRight, 
  BookmarkPlus 
} from 'lucide-react';
import { A2LABS_CATEGORIES } from "./CatalogView.constants";
import { getTierIcon, getTierColor } from "./CatalogSharedComponents";

interface CatalogViewBrowseProps {
  expandedCategories: Set<string>;
  toggleCategoryGroup: (tier: string) => void;
  selectedCategory: string;
  browseCategory: (id: string) => void;
}

export const CatalogViewBrowse: React.FC<CatalogViewBrowseProps> = ({
  expandedCategories,
  toggleCategoryGroup,
  selectedCategory,
  browseCategory,
}) => {
  return (
    <div>
      <h2 className="text-[20px] font-semibold mb-6 flex items-center gap-2">
        <Layers size={20} />
        A://Labs Course Categories
      </h2>

      <div className="flex flex-col gap-6">
        {(['CORE', 'OPS', 'AGENTS'] as const).map(tier => {
          const isExpanded = expandedCategories.has(tier);
          const TierIcon = getTierIcon(tier);
          const tierCategories = A2LABS_CATEGORIES.filter(c => c.tier === tier);

          return (
            <div key={tier}>
              {/* Tier Header */}
              <button type="button"
                onClick={() => toggleCategoryGroup(tier)}
                className="flex items-center gap-3 p-3 px-4 bg-[var(--bg-secondary,#111113)] border border-solid rounded-lg cursor-pointer w-full text-[16px] font-semibold mb-3 transition-colors hover:bg-white/5"
                style={{ borderColor: `${getTierColor(tier)}33`, color: getTierColor(tier) }}
              >
                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <TierIcon size={20} />
                <span>Tier {tier}: {tier === 'CORE' ? 'Foundations' : tier === 'OPS' ? 'Operations' : 'Advanced'}</span>
                <span className="ml-auto text-[13px] opacity-70">
                  {tierCategories.length} categories
                </span>
              </button>

              {/* Category Grid */}
              {isExpanded && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 pl-5">
                  {tierCategories.map(cat => (
                    <button type="button"
                      key={cat.id}
                      onClick={() => browseCategory(cat.id)}
                      className={`
                        p-4 rounded-lg cursor-pointer text-left transition-all duration-150 border border-solid
                        ${selectedCategory === cat.id 
                          ? 'bg-[var(--bg-tertiary,#18181b)] shadow-sm' 
                          : 'bg-[var(--bg-secondary,#111113)] hover:bg-white/5'
                        }
                      `}
                      style={{ 
                        borderColor: selectedCategory === cat.id ? getTierColor(tier) : 'var(--border-subtle,#27272a)',
                        background: selectedCategory === cat.id ? `${getTierColor(tier)}12` : undefined
                      }}
                    >
                      <div className="font-semibold text-[14px] mb-1.5">{cat.label}</div>
                      <div className="text-[12px] text-[var(--text-muted,#a1a1aa)] mb-2 line-clamp-2">
                        {cat.description}
                      </div>
                      <div className="text-[12px] text-[var(--text-muted,#a1a1aa)] opacity-60">
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
      <div className="mt-8 p-5 bg-[var(--info-bg,#1e1b4b)] border border-solid border-[var(--info-border,#4338ca)] rounded-lg">
        <h3 className="m-0 mb-3 text-[15px] font-semibold flex items-center gap-1.5">
          <BookmarkPlus size={16} />
          How to Curate Courses for A://Labs
        </h3>
        <ol className="m-0 pl-5 text-[13px] leading-[1.8]">
          <li>Browse categories or search for specific topics</li>
          <li>Review course details, ratings, and reviews</li>
          <li>Click <strong>✓ Add to A://Labs</strong> to curate relevant courses</li>
          <li>View all curated courses in the "Curated" tab</li>
          <li>Later: Import curated courses into Canvas LMS</li>
        </ol>
      </div>
    </div>
  );
};

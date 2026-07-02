import React from "react";
import { BookmarkPlus, Trophy } from 'lucide-react';

interface CatalogViewCuratedProps {
  curatedCount: number;
  showNotification: (msg: string) => void;
}

export const CatalogViewCurated: React.FC<CatalogViewCuratedProps> = ({
  curatedCount,
  showNotification,
}) => {
  return (
    <div>
      <h2 className="text-[20px] font-semibold mb-6 flex items-center gap-2">
        <BookmarkPlus size={20} />
        Curated Courses for A://Labs
      </h2>

      {curatedCount === 0 ? (
        <div className="text-center py-20 text-[var(--text-muted,#a1a1aa)]">
          <BookmarkPlus size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-[16px] mb-2 font-medium">No courses curated yet</p>
          <p className="text-[13px]">
            Browse categories or search to find relevant courses
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="p-4 bg-[var(--bg-secondary,#111113)] border border-solid border-[var(--border-subtle,#27272a)] rounded-lg flex justify-between items-center">
            <span className="flex items-center gap-2">
              <Trophy size={16} />
              <span>
                <strong>{curatedCount}</strong> courses curated for A://Labs
              </span>
            </span>
            <button type="button"
              onClick={() => showNotification('Export/Canvas upload coming soon!')}
              className="px-4 py-2 bg-[var(--accent,#7c3aed)] border-none rounded-md text-white font-semibold text-[13px] cursor-pointer transition-all hover:opacity-90"
            >
              Export to Canvas LMS
            </button>
          </div>

          <div className="text-[13px] text-[var(--text-muted,#a1a1aa)] text-center py-10 italic">
            Course details will be loaded from Udemy API when backend proxy is configured
          </div>
        </div>
      )}
    </div>
  );
};

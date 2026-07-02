import React from "react";
import { 
  X, 
  Star, 
  Users, 
  PlayCircle, 
  Award, 
  Info, 
  Check, 
  Plus, 
  ExternalLink 
} from 'lucide-react';
import type { UdemyPublicCourse } from "./CatalogView.types";
import { formatSubscribers, getLevelColor } from "./CatalogSharedComponents";

interface CourseDetailModalProps {
  course: UdemyPublicCourse;
  isCurated: boolean;
  onClose: () => void;
  onToggleCurated: (course: UdemyPublicCourse) => void;
}

export const CourseDetailModal: React.FC<CourseDetailModalProps> = ({
  course,
  isCurated,
  onClose,
  onToggleCurated,
}) => {
  return (
    <div role="button" tabIndex={0}
      onClick={onClose}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[10000] p-6 animate-in fade-in duration-200"
    >
      <div role="button" tabIndex={0}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--bg-primary,#0a0a0a)] border border-solid border-[var(--border-subtle,#27272a)] rounded-xl max-w-[600px] w-full max-h-[85vh] overflow-auto shadow-2xl relative"
      >
        {/* Modal Header */}
        <div className="relative">
          <img
            src={course.image_240x135}
            alt={course.title}
            className="w-full h-[200px] object-cover rounded-t-xl"
          />
          <button type="button"
            onClick={onClose}
            className="absolute top-3 right-3 size-8 rounded-full bg-[var(--shell-overlay-backdrop)] border-none text-[var(--ui-text-primary)] cursor-pointer flex items-center justify-center transition-colors hover:bg-black/40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          <h2 className="text-[20px] font-bold m-0 mb-2 leading-tight">
            {course.title}
          </h2>
          <p className="text-[14px] text-[var(--text-secondary,#d4d4d8)] m-0 mb-5 leading-relaxed">
            {course.headline}
          </p>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 bg-[var(--bg-secondary,#111113)] rounded-lg border border-solid border-[var(--border-subtle,#27272a)]">
              <div className="flex items-center gap-2 mb-1">
                <Star size={16} className="text-[var(--status-warning)]" />
                <span className="text-[18px] font-bold">
                  {course.rating.toFixed(1)}
                </span>
              </div>
              <div className="text-[12px] text-[var(--text-muted,#a1a1aa)]">
                {course.num_reviews.toLocaleString()} reviews
              </div>
            </div>

            <div className="p-3 bg-[var(--bg-secondary,#111113)] rounded-lg border border-solid border-[var(--border-subtle,#27272a)]">
              <div className="flex items-center gap-2 mb-1">
                <Users size={16} />
                <span className="text-[18px] font-bold">
                  {formatSubscribers(course.num_subscribers)}
                </span>
              </div>
              <div className="text-[12px] text-[var(--text-muted,#a1a1aa)]">
                Students enrolled
              </div>
            </div>

            <div className="p-3 bg-[var(--bg-secondary,#111113)] rounded-lg border border-solid border-[var(--border-subtle,#27272a)]">
              <div className="flex items-center gap-2 mb-1">
                <PlayCircle size={16} />
                <span className="text-[18px] font-bold">
                  {course.num_lectures}
                </span>
              </div>
              <div className="text-[12px] text-[var(--text-muted,#a1a1aa)]">
                Lectures
              </div>
            </div>

            <div className="p-3 bg-[var(--bg-secondary,#111113)] rounded-lg border border-solid border-[var(--border-subtle,#27272a)]">
              <div className="flex items-center gap-2 mb-1">
                <Award size={16} style={{ color: getLevelColor(course.level) }} />
                <span className="text-[14px] font-semibold" style={{ color: getLevelColor(course.level) }}>
                  {course.level}
                </span>
              </div>
              <div className="text-[12px] text-[var(--text-muted,#a1a1aa)]">
                Difficulty level
              </div>
            </div>
          </div>

          {/* Category Tag */}
          {course.category && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--info-bg,#1e1b4b)] border border-solid border-[var(--info-border,#4338ca)] rounded-full text-[12px] font-semibold text-[#818cf8]">
                <Info size={12} />
                {course.category}
              </span>
            </div>
          )}

          {/* Topics */}
          {course.topics && course.topics.length > 0 && (
            <div className="mb-6">
              <div className="text-[13px] font-semibold mb-2 text-[var(--ui-text-primary)]">
                Topics:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {course.topics.map(topic => (
                  <span
                    key={topic}
                    className="px-2.5 py-1 bg-[var(--bg-secondary,#111113)] border border-solid border-[var(--border-subtle,#27272a)] rounded-xl text-[12px] text-[var(--text-secondary,#d4d4d8)]"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            <button type="button"
              onClick={() => {
                onToggleCurated(course);
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-none text-white font-bold text-[14px] cursor-pointer transition-all hover:opacity-90"
              style={{ background: isCurated ? 'var(--status-success)' : 'var(--accent,#7c3aed)' }}
            >
              {isCurated ? <Check size={16} /> : <Plus size={16} />}
              {isCurated ? 'Curated for A://Labs' : 'Add to A://Labs'}
            </button>
            <a
              href={`https://www.udemy.com${course.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-transparent border border-solid border-[var(--border-subtle,#27272a)] text-[var(--text-secondary,#d4d4d8)] no-underline text-[14px] font-semibold transition-colors hover:bg-white/5"
            >
              <ExternalLink size={16} />
              View on Udemy
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

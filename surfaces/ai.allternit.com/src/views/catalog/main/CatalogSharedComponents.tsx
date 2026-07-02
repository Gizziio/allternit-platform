import React from "react";
import { 
  Star, 
  Users, 
  Plus, 
  Check, 
  ExternalLink,
  Layers,
  BarChart3,
  Rocket,
  BookOpen
} from 'lucide-react';
import type { UdemyPublicCourse } from "./CatalogView.types";

export const formatRating = (rating: number, reviews: number) => {
  return `${rating.toFixed(1)} (${reviews.toLocaleString()})`;
};

export const formatSubscribers = (count: number) => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
  return count.toString();
};

export const getLevelColor = (level: string) => {
  switch (level) {
    case 'Beginner':
    case 'All Levels':
      return 'var(--status-success)';
    case 'Intermediate':
      return 'var(--status-warning)';
    case 'Expert':
      return 'var(--status-error)';
    default:
      return 'var(--ui-text-muted)';
  }
};

export const getTierColor = (tier: string) => {
  switch (tier) {
    case 'CORE':
      return 'var(--status-info)';
    case 'OPS':
      return '#8b5cf6';
    case 'AGENTS':
      return '#ec4899';
    default:
      return 'var(--ui-text-muted)';
  }
};

export const getTierIcon = (tier: string) => {
  switch (tier) {
    case 'CORE':
      return Layers;
    case 'OPS':
      return BarChart3;
    case 'AGENTS':
      return Rocket;
    default:
      return BookOpen;
  }
};

export const CourseCard = ({ 
  course, 
  isCurated, 
  onToggleCurated, 
  onSelect 
}: { 
  course: UdemyPublicCourse;
  isCurated: boolean;
  onToggleCurated: (course: UdemyPublicCourse) => void;
  onSelect: (course: UdemyPublicCourse) => void;
}) => {
  return (
    <div
      className="bg-[var(--bg-secondary,#111113)] border border-solid rounded-[10px] overflow-hidden transition-all duration-200"
      style={{ borderColor: isCurated ? 'var(--status-success)' : 'var(--border-subtle,#27272a)' }}
    >
      <img
        src={course.image_240x135}
        alt={course.title}
        className="w-full h-[135px] object-cover"
      />
      <div className="p-4">
        <h3 
          className="text-[15px] font-semibold m-0 mb-2 cursor-pointer truncate"
          onClick={() => onSelect(course)}
        >
          {course.title}
        </h3>
        <p className="text-[12px] text-[var(--text-muted,#a1a1aa)] m-0 mb-3 line-clamp-2 h-9">
          {course.headline}
        </p>

        <div className="flex gap-3 text-[12px] mb-3">
          <span className="flex items-center gap-1">
            <Star size={12} className="text-[var(--status-warning)]" />
            {formatRating(course.rating, course.num_reviews)}
          </span>
          <span className="flex items-center gap-1">
            <Users size={12} />
            {formatSubscribers(course.num_subscribers)}
          </span>
          <span 
            className="px-1.5 py-0.5 rounded text-[12px] font-semibold"
            style={{ background: getLevelColor(course.level) }}
          >
            {course.level}
          </span>
        </div>

        <div className="flex gap-2">
          <button type="button"
            onClick={() => onToggleCurated(course)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-[var(--accent,#7c3aed)] text-[var(--ui-text-primary)] font-semibold text-[13px] border-none cursor-pointer transition-all hover:opacity-90"
            style={{ background: isCurated ? 'var(--status-success)' : 'var(--accent,#7c3aed)' }}
          >
            {isCurated ? <Check size={14} /> : <Plus size={14} />}
            {isCurated ? 'Curated' : 'Add to A://Labs'}
          </button>
          <a
            href={`https://www.udemy.com${course.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-3 py-2 rounded-md bg-transparent border border-solid border-[var(--border-subtle,#27272a)] text-[var(--text-secondary,#d4d4d8)] no-underline transition-colors hover:bg-white/5"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};

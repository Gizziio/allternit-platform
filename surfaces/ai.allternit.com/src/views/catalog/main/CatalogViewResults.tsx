import React from "react";
import { Search } from 'lucide-react';
import type { UdemyPublicCourse } from "./CatalogView.types";
import { CourseCard } from "./CatalogSharedComponents";

interface CatalogViewResultsProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchCourses: (query: string) => void;
  loading: boolean;
  filteredCourses: UdemyPublicCourse[];
  curatedCourses: Set<number>;
  toggleCurated: (course: UdemyPublicCourse) => void;
  setSelectedCourse: (course: UdemyPublicCourse) => void;
}

export const CatalogViewResults: React.FC<CatalogViewResultsProps> = ({
  searchQuery,
  setSearchQuery,
  searchCourses,
  loading,
  filteredCourses,
  curatedCourses,
  toggleCurated,
  setSelectedCourse,
}) => {
  return (
    <div>
      {/* Search Bar */}
      <div className="mb-6 flex gap-3">
        <div className="flex-1 relative">
          <Search 
            size={18} 
            className="text-[#a1a1aa] absolute left-3 top-1/2 -translate-y-1/2" 
          />
          <input
            type="text"
            placeholder="Search Udemy courses…"
            aria-label="Search courses"
            value={searchQuery}            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchCourses(searchQuery)}
            className="w-full p-2.5 pl-10 bg-[var(--bg-secondary,#111113)] border border-solid border-[var(--border-subtle,#27272a)] rounded-md text-[var(--text-primary,#e5e5e5)] text-[14px] outline-none transition-all focus:border-[var(--accent,#7c3aed)] focus:ring-1 focus:ring-[var(--accent,#7c3aed)]"
          />
        </div>
        <button type="button"
          onClick={() => searchCourses(searchQuery)}
          disabled={loading || !searchQuery.trim()}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-[var(--accent,#7c3aed)] border-none rounded-md text-white font-semibold cursor-pointer text-[14px] transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Search size={16} />
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-20 text-[var(--text-muted,#a1a1aa)]">
          <div className="animate-spin inline-block text-2xl mb-2">⏳</div>
          <p>Searching Udemy…</p>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="text-center py-20 text-[var(--text-muted,#a1a1aa)]">
          <Search size={48} className="mx-auto mb-4 opacity-30" />
          <p>No courses found. Try a different search term or adjust filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5">
          {filteredCourses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              isCurated={curatedCourses.has(course.id)}
              onToggleCurated={toggleCurated}
              onSelect={setSelectedCourse}
            />
          ))}
        </div>
      )}
    </div>
  );
};

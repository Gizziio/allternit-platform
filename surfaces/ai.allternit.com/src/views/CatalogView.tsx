"use client";

import React from 'react';
import { useCatalogManager } from './catalog/main/useCatalogManager';
import { CatalogViewHeader } from './catalog/main/CatalogViewHeader';
import { CatalogViewFilters } from './catalog/main/CatalogViewFilters';
import { CatalogViewBrowse } from './catalog/main/CatalogViewBrowse';
import { CatalogViewResults } from './catalog/main/CatalogViewResults';
import { CatalogViewCurated } from './catalog/main/CatalogViewCurated';
import { CourseDetailModal } from './catalog/main/CourseDetailModal';
import { GraduationCap } from 'lucide-react';

export function CatalogView() {
  const {
    loading,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    tierFilter,
    setTierFilter,
    priceFilter,
    setPriceFilter,
    levelFilter,
    setLevelFilter,
    curatedCourses,
    expandedCategories,
    error,
    notification,
    showNotification,
    view,
    setView,
    selectedCourse,
    setSelectedCourse,
    toggleCurated,
    searchCourses,
    browseCategory,
    toggleCategoryGroup,
    filteredCourses,
  } = useCatalogManager();

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary,#0a0a0a)] text-[var(--text-primary,#e5e5e5)] overflow-hidden">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-5 right-5 p-3 px-5 rounded-lg border border-solid shadow-md z-[9999] animate-in slide-in-from-right duration-300"
          style={{ 
            background: 'var(--bg-secondary, #111113)',
            borderColor: 'var(--border-subtle, #27272a)'
          }}
        >
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <CatalogViewHeader 
        view={view} 
        setView={setView} 
        curatedCount={curatedCourses.size} 
      />

      {/* Filters Bar */}
      <CatalogViewFilters
        tierFilter={tierFilter}
        setTierFilter={setTierFilter}
        levelFilter={levelFilter}
        setLevelFilter={setLevelFilter}
        priceFilter={priceFilter}
        setPriceFilter={setPriceFilter}
      />

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-5 p-3 px-4 bg-[#1e1b4b] border border-solid border-[#4338ca] rounded-lg flex items-center gap-2">
            <GraduationCap size={18} className="text-[#818cf8]" />
            <span>{error}</span>
          </div>
        )}

        {/* Views */}
        {view === 'browse' && (
          <CatalogViewBrowse
            expandedCategories={expandedCategories}
            toggleCategoryGroup={toggleCategoryGroup}
            selectedCategory={selectedCategory}
            browseCategory={browseCategory}
          />
        )}

        {view === 'search' && (
          <CatalogViewResults
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchCourses={searchCourses}
            loading={loading}
            filteredCourses={filteredCourses}
            curatedCourses={curatedCourses}
            toggleCurated={toggleCurated}
            setSelectedCourse={setSelectedCourse}
          />
        )}

        {view === 'curated' && (
          <CatalogViewCurated
            curatedCount={curatedCourses.size}
            showNotification={showNotification}
          />
        )}
      </div>

      {/* Course Detail Modal */}
      {selectedCourse && (
        <CourseDetailModal
          course={selectedCourse}
          isCurated={curatedCourses.has(selectedCourse.id)}
          onClose={() => setSelectedCourse(null)}
          onToggleCurated={toggleCurated}
        />
      )}
    </div>
  );
}

export default CatalogView;
